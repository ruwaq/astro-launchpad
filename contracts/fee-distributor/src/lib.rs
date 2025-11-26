#![no_std]

//! # Fee Distributor Contract
//!
//! Distributes collected fees to:
//! - Treasury Vault (50% default)
//! - Staking Pool (30% default)
//! - Burn address (20% default)
//!
//! Supports multiple tokens and configurable distribution ratios.

use soroban_sdk::{
    contract, contractimpl, contracttype, token, Address, Env, Vec,
};
use astro_core_shared::{
    events::{emit_distribution, EventBuilder},
    math::{safe_add, safe_mul, safe_div, BPS_DENOMINATOR},
    types::{
        DistributionConfig, DistributionResult, SharedError,
        extend_instance_ttl,
    },
};

// ════════════════════════════════════════════════════════════════════════════
// Storage Keys
// ════════════════════════════════════════════════════════════════════════════

#[contracttype]
#[derive(Clone, Debug)]
pub enum DataKey {
    /// Admin address
    Admin,
    /// Distribution configuration
    Config,
    /// Whether contract is initialized
    Initialized,
    /// Whether contract is paused
    Paused,
    /// Pending fees per token (Address -> i128)
    PendingFees(Address),
    /// Total distributed per token (Address -> i128)
    TotalDistributed(Address),
    /// Supported tokens list
    SupportedTokens,
    /// Emergency withdrawal address
    EmergencyAddress,
}

// ════════════════════════════════════════════════════════════════════════════
// Contract Implementation
// ════════════════════════════════════════════════════════════════════════════

#[contract]
pub struct FeeDistributor;

#[contractimpl]
impl FeeDistributor {
    // ────────────────────────────────────────────────────────────────────────
    // Initialization
    // ────────────────────────────────────────────────────────────────────────

    /// Initialize the fee distributor
    pub fn initialize(
        env: Env,
        admin: Address,
        treasury_vault: Address,
        staking_pool: Address,
        burn_address: Address,
    ) -> Result<(), SharedError> {
        // Check not already initialized
        if env.storage().instance().has(&DataKey::Initialized) {
            return Err(SharedError::AlreadyInitialized);
        }

        // Validate addresses are different
        if treasury_vault == staking_pool || treasury_vault == burn_address || staking_pool == burn_address {
            return Err(SharedError::InvalidAddress);
        }

        // Create default config (50/30/20 split)
        let config = DistributionConfig {
            treasury_vault,
            staking_pool,
            burn_address,
            treasury_bps: 5000,  // 50%
            staking_bps: 3000,   // 30%
            burn_bps: 2000,      // 20%
            min_distribution: 10_000_000, // 1 token minimum (7 decimals)
        };

        // Validate percentages sum to 100%
        if config.treasury_bps + config.staking_bps + config.burn_bps != 10_000 {
            return Err(SharedError::InvalidPercentage);
        }

        // Store initial state
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Config, &config);
        env.storage().instance().set(&DataKey::Initialized, &true);
        env.storage().instance().set(&DataKey::Paused, &false);
        env.storage().instance().set(&DataKey::SupportedTokens, &Vec::<Address>::new(&env));

        extend_instance_ttl(&env);

        // Emit init event
        let events = EventBuilder::new(&env);
        events.publish("fee_dist", "initialized", (admin.clone(), env.ledger().timestamp()));

        Ok(())
    }

    // ────────────────────────────────────────────────────────────────────────
    // Core Distribution Functions
    // ────────────────────────────────────────────────────────────────────────

    /// Receive fees for a token (called by SAC Factory or AMM)
    pub fn receive_fees(
        env: Env,
        caller: Address,
        token: Address,
        amount: i128,
    ) -> Result<(), SharedError> {
        caller.require_auth();
        Self::require_initialized(&env)?;
        Self::require_not_paused(&env)?;

        if amount <= 0 {
            return Err(SharedError::InvalidAmount);
        }

        // Transfer tokens to this contract
        let token_client = token::Client::new(&env, &token);
        token_client.transfer(&caller, &env.current_contract_address(), &amount);

        // Add to pending fees
        let current = Self::get_pending_fees(&env, &token);
        let new_pending = safe_add(current, amount)?;
        env.storage().persistent().set(&DataKey::PendingFees(token.clone()), &new_pending);

        // Ensure token is in supported list
        Self::add_supported_token(&env, &token);

        extend_instance_ttl(&env);

        Ok(())
    }

    /// Distribute pending fees for a token
    pub fn distribute(env: Env, token: Address) -> Result<DistributionResult, SharedError> {
        Self::require_initialized(&env)?;
        Self::require_not_paused(&env)?;

        let config: DistributionConfig = env.storage().instance().get(&DataKey::Config)
            .ok_or(SharedError::NotInitialized)?;

        let pending = Self::get_pending_fees(&env, &token);

        if pending < config.min_distribution {
            return Err(SharedError::BelowMinimum);
        }

        let token_client = token::Client::new(&env, &token);

        // Calculate distribution amounts
        let treasury_amount = safe_div(
            safe_mul(pending, config.treasury_bps as i128)?,
            BPS_DENOMINATOR
        )?;

        let staking_amount = safe_div(
            safe_mul(pending, config.staking_bps as i128)?,
            BPS_DENOMINATOR
        )?;

        let burn_amount = safe_div(
            safe_mul(pending, config.burn_bps as i128)?,
            BPS_DENOMINATOR
        )?;

        // Handle rounding - any dust goes to treasury
        let total_calculated = safe_add(safe_add(treasury_amount, staking_amount)?, burn_amount)?;
        let dust = pending - total_calculated;
        let final_treasury = safe_add(treasury_amount, dust)?;

        // Execute transfers
        if final_treasury > 0 {
            token_client.transfer(
                &env.current_contract_address(),
                &config.treasury_vault,
                &final_treasury
            );
        }

        if staking_amount > 0 {
            token_client.transfer(
                &env.current_contract_address(),
                &config.staking_pool,
                &staking_amount
            );
        }

        if burn_amount > 0 {
            // For burn, we transfer to burn address (could be zero address or actual burn)
            token_client.transfer(
                &env.current_contract_address(),
                &config.burn_address,
                &burn_amount
            );
        }

        // Update state
        env.storage().persistent().set(&DataKey::PendingFees(token.clone()), &0_i128);

        let prev_total = Self::get_total_distributed(&env, &token);
        let new_total = safe_add(prev_total, pending)?;
        env.storage().persistent().set(&DataKey::TotalDistributed(token.clone()), &new_total);

        // Emit event
        emit_distribution(&env, &token, pending, final_treasury, staking_amount, burn_amount);

        extend_instance_ttl(&env);

        Ok(DistributionResult {
            token,
            total_amount: pending,
            treasury_amount: final_treasury,
            staking_amount,
            burn_amount,
            timestamp: env.ledger().timestamp(),
        })
    }

    /// Distribute all pending fees for all supported tokens
    pub fn distribute_all(env: Env) -> Result<Vec<DistributionResult>, SharedError> {
        Self::require_initialized(&env)?;
        Self::require_not_paused(&env)?;

        let tokens = Self::get_supported_tokens(&env);
        let mut results = Vec::new(&env);

        for token in tokens.iter() {
            let pending = Self::get_pending_fees(&env, &token);
            let config: DistributionConfig = env.storage().instance().get(&DataKey::Config)
                .ok_or(SharedError::NotInitialized)?;

            if pending >= config.min_distribution {
                match Self::distribute(env.clone(), token) {
                    Ok(result) => results.push_back(result),
                    Err(_) => continue, // Skip failed distributions
                }
            }
        }

        Ok(results)
    }

    // ────────────────────────────────────────────────────────────────────────
    // Admin Functions
    // ────────────────────────────────────────────────────────────────────────

    /// Update distribution configuration
    pub fn update_config(
        env: Env,
        new_config: DistributionConfig,
    ) -> Result<(), SharedError> {
        Self::require_admin(&env)?;

        // Validate percentages sum to 100%
        if new_config.treasury_bps + new_config.staking_bps + new_config.burn_bps != 10_000 {
            return Err(SharedError::InvalidPercentage);
        }

        // Validate addresses are different
        if new_config.treasury_vault == new_config.staking_pool
            || new_config.treasury_vault == new_config.burn_address
            || new_config.staking_pool == new_config.burn_address
        {
            return Err(SharedError::InvalidAddress);
        }

        env.storage().instance().set(&DataKey::Config, &new_config);
        extend_instance_ttl(&env);

        Ok(())
    }

    /// Update admin address
    pub fn set_admin(env: Env, new_admin: Address) -> Result<(), SharedError> {
        Self::require_admin(&env)?;

        let old_admin: Address = env.storage().instance().get(&DataKey::Admin)
            .ok_or(SharedError::NotInitialized)?;

        env.storage().instance().set(&DataKey::Admin, &new_admin);

        // Emit admin change event
        let events = EventBuilder::new(&env);
        events.publish("fee_dist", "admin_changed", (old_admin, new_admin, env.ledger().timestamp()));

        extend_instance_ttl(&env);
        Ok(())
    }

    /// Pause/unpause the contract
    pub fn set_paused(env: Env, paused: bool) -> Result<(), SharedError> {
        Self::require_admin(&env)?;

        env.storage().instance().set(&DataKey::Paused, &paused);

        let events = EventBuilder::new(&env);
        events.publish("fee_dist", "paused", (paused, env.ledger().timestamp()));

        extend_instance_ttl(&env);
        Ok(())
    }

    /// Emergency withdrawal (admin only, when paused)
    pub fn emergency_withdraw(
        env: Env,
        token: Address,
        to: Address,
        amount: i128,
    ) -> Result<(), SharedError> {
        Self::require_admin(&env)?;

        // Only allow emergency withdrawal when paused
        let paused: bool = env.storage().instance().get(&DataKey::Paused).unwrap_or(false);
        if !paused {
            return Err(SharedError::ContractNotPaused);
        }

        let token_client = token::Client::new(&env, &token);
        token_client.transfer(&env.current_contract_address(), &to, &amount);

        let events = EventBuilder::new(&env);
        events.publish("fee_dist", "emergency_withdraw", (token, to, amount, env.ledger().timestamp()));

        Ok(())
    }

    // ────────────────────────────────────────────────────────────────────────
    // Query Functions
    // ────────────────────────────────────────────────────────────────────────

    /// Get current distribution configuration
    pub fn get_config(env: Env) -> Result<DistributionConfig, SharedError> {
        env.storage().instance().get(&DataKey::Config)
            .ok_or(SharedError::NotInitialized)
    }

    /// Get pending fees for a token
    pub fn get_pending_distribution(env: Env, token: Address) -> i128 {
        Self::get_pending_fees(&env, &token)
    }

    /// Get total distributed for a token
    pub fn get_total_distributed_for_token(env: Env, token: Address) -> i128 {
        Self::get_total_distributed(&env, &token)
    }

    /// Get all supported tokens
    pub fn get_tokens(env: Env) -> Vec<Address> {
        Self::get_supported_tokens(&env)
    }

    /// Get admin address
    pub fn admin(env: Env) -> Result<Address, SharedError> {
        env.storage().instance().get(&DataKey::Admin)
            .ok_or(SharedError::NotInitialized)
    }

    /// Check if contract is paused
    pub fn is_paused(env: Env) -> bool {
        env.storage().instance().get(&DataKey::Paused).unwrap_or(false)
    }

    /// Get contract balance for a token
    pub fn balance(env: Env, token: Address) -> i128 {
        let token_client = token::Client::new(&env, &token);
        token_client.balance(&env.current_contract_address())
    }

    // ────────────────────────────────────────────────────────────────────────
    // Internal Helpers
    // ────────────────────────────────────────────────────────────────────────

    fn require_initialized(env: &Env) -> Result<(), SharedError> {
        let initialized: bool = env.storage().instance()
            .get(&DataKey::Initialized)
            .unwrap_or(false);

        if !initialized {
            return Err(SharedError::NotInitialized);
        }
        Ok(())
    }

    fn require_not_paused(env: &Env) -> Result<(), SharedError> {
        let paused: bool = env.storage().instance()
            .get(&DataKey::Paused)
            .unwrap_or(false);

        if paused {
            return Err(SharedError::ContractPaused);
        }
        Ok(())
    }

    fn require_admin(env: &Env) -> Result<(), SharedError> {
        let admin: Address = env.storage().instance()
            .get(&DataKey::Admin)
            .ok_or(SharedError::NotInitialized)?;

        admin.require_auth();
        Ok(())
    }

    fn get_pending_fees(env: &Env, token: &Address) -> i128 {
        env.storage().persistent()
            .get(&DataKey::PendingFees(token.clone()))
            .unwrap_or(0)
    }

    fn get_total_distributed(env: &Env, token: &Address) -> i128 {
        env.storage().persistent()
            .get(&DataKey::TotalDistributed(token.clone()))
            .unwrap_or(0)
    }

    fn get_supported_tokens(env: &Env) -> Vec<Address> {
        env.storage().instance()
            .get(&DataKey::SupportedTokens)
            .unwrap_or(Vec::new(env))
    }

    fn add_supported_token(env: &Env, token: &Address) {
        let mut tokens = Self::get_supported_tokens(env);

        // Check if already in list
        for t in tokens.iter() {
            if t == *token {
                return;
            }
        }

        tokens.push_back(token.clone());
        env.storage().instance().set(&DataKey::SupportedTokens, &tokens);
    }
}

// ════════════════════════════════════════════════════════════════════════════
// Tests
// ════════════════════════════════════════════════════════════════════════════

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::testutils::Address as _;

    fn create_token<'a>(env: &Env, admin: &Address) -> (token::Client<'a>, token::StellarAssetClient<'a>) {
        let contract_id = env.register_stellar_asset_contract_v2(admin.clone());
        (
            token::Client::new(env, &contract_id.address()),
            token::StellarAssetClient::new(env, &contract_id.address()),
        )
    }

    #[test]
    fn test_initialize() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(FeeDistributor, ());
        let client = FeeDistributorClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let treasury = Address::generate(&env);
        let staking = Address::generate(&env);
        let burn = Address::generate(&env);

        client.initialize(&admin, &treasury, &staking, &burn);

        let config = client.get_config();
        assert_eq!(config.treasury_vault, treasury);
        assert_eq!(config.staking_pool, staking);
        assert_eq!(config.burn_address, burn);
        assert_eq!(config.treasury_bps, 5000);
        assert_eq!(config.staking_bps, 3000);
        assert_eq!(config.burn_bps, 2000);
    }

    #[test]
    fn test_receive_and_distribute() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(FeeDistributor, ());
        let client = FeeDistributorClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let treasury = Address::generate(&env);
        let staking = Address::generate(&env);
        let burn = Address::generate(&env);
        let user = Address::generate(&env);

        // Create and mint test token
        let (token_client, token_admin) = create_token(&env, &admin);
        token_admin.mint(&user, &1_000_000_000_000); // 100,000 tokens

        // Initialize contract
        client.initialize(&admin, &treasury, &staking, &burn);

        // Receive fees
        let fee_amount = 100_000_000_000_i128; // 10,000 tokens
        client.receive_fees(&user, &token_client.address, &fee_amount);

        // Check pending
        let pending = client.get_pending_distribution(&token_client.address);
        assert_eq!(pending, fee_amount);

        // Distribute
        let result = client.distribute(&token_client.address);

        // Verify distribution (50/30/20 split)
        assert_eq!(result.total_amount, fee_amount);
        // 50% = 50,000,000,000
        // 30% = 30,000,000,000
        // 20% = 20,000,000,000
        assert!(result.treasury_amount >= 50_000_000_000);
        assert_eq!(result.staking_amount, 30_000_000_000);
        assert_eq!(result.burn_amount, 20_000_000_000);

        // Verify balances
        assert_eq!(token_client.balance(&treasury), result.treasury_amount);
        assert_eq!(token_client.balance(&staking), result.staking_amount);
        assert_eq!(token_client.balance(&burn), result.burn_amount);
    }

    #[test]
    fn test_below_minimum() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(FeeDistributor, ());
        let client = FeeDistributorClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let treasury = Address::generate(&env);
        let staking = Address::generate(&env);
        let burn = Address::generate(&env);
        let user = Address::generate(&env);

        let (token_client, token_admin) = create_token(&env, &admin);
        token_admin.mint(&user, &1_000_000_000);

        client.initialize(&admin, &treasury, &staking, &burn);

        // Receive small fee (below minimum)
        let small_fee = 1_000_000_i128; // 0.1 tokens (below 1 token minimum)
        client.receive_fees(&user, &token_client.address, &small_fee);

        // Distribution should fail due to below minimum
        let result = client.try_distribute(&token_client.address);
        assert!(result.is_err());
    }

    #[test]
    fn test_update_config() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(FeeDistributor, ());
        let client = FeeDistributorClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let treasury = Address::generate(&env);
        let staking = Address::generate(&env);
        let burn = Address::generate(&env);

        client.initialize(&admin, &treasury, &staking, &burn);

        // Update to 40/40/20 split
        let new_config = DistributionConfig {
            treasury_vault: treasury.clone(),
            staking_pool: staking.clone(),
            burn_address: burn.clone(),
            treasury_bps: 4000,
            staking_bps: 4000,
            burn_bps: 2000,
            min_distribution: 10_000_000,
        };

        client.update_config(&new_config);

        let config = client.get_config();
        assert_eq!(config.treasury_bps, 4000);
        assert_eq!(config.staking_bps, 4000);
    }

    #[test]
    fn test_pause_emergency_withdraw() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(FeeDistributor, ());
        let client = FeeDistributorClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let treasury = Address::generate(&env);
        let staking = Address::generate(&env);
        let burn = Address::generate(&env);
        let user = Address::generate(&env);
        let emergency_to = Address::generate(&env);

        let (token_client, token_admin) = create_token(&env, &admin);
        token_admin.mint(&user, &1_000_000_000_000);

        client.initialize(&admin, &treasury, &staking, &burn);

        // Receive fees
        client.receive_fees(&user, &token_client.address, &100_000_000_000);

        // Pause contract
        client.set_paused(&true);
        assert!(client.is_paused());

        // Emergency withdraw
        let withdraw_amount = 50_000_000_000_i128;
        client.emergency_withdraw(&token_client.address, &emergency_to, &withdraw_amount);

        assert_eq!(token_client.balance(&emergency_to), withdraw_amount);
    }
}
