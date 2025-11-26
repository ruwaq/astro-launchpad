#![no_std]

//! # Staking Pool Contract
//!
//! Allows users to stake ASTRO tokens and earn rewards from protocol fees.
//! Uses reward-per-token accounting for fair distribution.
//!
//! ## Features
//! - Stake/unstake tokens with no lockup
//! - Earn rewards from multiple tokens
//! - Compound rewards automatically
//! - Time-weighted reward distribution

use soroban_sdk::{
    contract, contractimpl, contracttype, token, Address, Env, Vec,
};
use astro_core_shared::{
    events::{emit_stake, emit_unstake, emit_claim, EventBuilder},
    math::{safe_add, safe_sub, safe_mul, safe_div, PRECISION},
    types::{
        SharedError, UserStake, StakingConfig,
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
    /// Staking configuration
    Config,
    /// Whether contract is initialized
    Initialized,
    /// Whether contract is paused
    Paused,
    /// Token being staked
    StakeToken,
    /// Total tokens staked
    TotalStaked,
    /// User stake info (Address -> UserStake)
    UserStake(Address),
    /// Accumulated reward per share for a token (Address -> i128)
    AccRewardPerShare(Address),
    /// Total rewards distributed for a token (Address -> i128)
    TotalRewards(Address),
    /// Supported reward tokens
    RewardTokens,
    /// Fee distributor address
    FeeDistributor,
}

// ════════════════════════════════════════════════════════════════════════════
// Contract Implementation
// ════════════════════════════════════════════════════════════════════════════

#[contract]
pub struct StakingPool;

#[contractimpl]
impl StakingPool {
    // ────────────────────────────────────────────────────────────────────────
    // Initialization
    // ────────────────────────────────────────────────────────────────────────

    /// Initialize the staking pool
    pub fn initialize(
        env: Env,
        admin: Address,
        stake_token: Address,
        fee_distributor: Address,
        config: StakingConfig,
    ) -> Result<(), SharedError> {
        // Check not already initialized
        if env.storage().instance().has(&DataKey::Initialized) {
            return Err(SharedError::AlreadyInitialized);
        }

        // Validate config
        if config.min_stake_amount <= 0 {
            return Err(SharedError::InvalidAmount);
        }

        // Store initial state
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::StakeToken, &stake_token);
        env.storage().instance().set(&DataKey::FeeDistributor, &fee_distributor);
        env.storage().instance().set(&DataKey::Config, &config);
        env.storage().instance().set(&DataKey::Initialized, &true);
        env.storage().instance().set(&DataKey::Paused, &false);
        env.storage().instance().set(&DataKey::TotalStaked, &0_i128);
        env.storage().instance().set(&DataKey::RewardTokens, &Vec::<Address>::new(&env));

        extend_instance_ttl(&env);

        let events = EventBuilder::new(&env);
        events.publish("staking", "initialized", (admin.clone(), stake_token, env.ledger().timestamp()));

        Ok(())
    }

    // ────────────────────────────────────────────────────────────────────────
    // Staking Functions
    // ────────────────────────────────────────────────────────────────────────

    /// Stake tokens
    pub fn stake(env: Env, user: Address, amount: i128) -> Result<i128, SharedError> {
        user.require_auth();
        Self::require_initialized(&env)?;
        Self::require_not_paused(&env)?;

        let config: StakingConfig = env.storage().instance().get(&DataKey::Config)
            .ok_or(SharedError::NotInitialized)?;

        if amount < config.min_stake_amount {
            return Err(SharedError::AmountBelowMin);
        }

        let stake_token: Address = env.storage().instance().get(&DataKey::StakeToken)
            .ok_or(SharedError::NotInitialized)?;

        // Transfer tokens to contract
        let token_client = token::Client::new(&env, &stake_token);
        token_client.transfer(&user, &env.current_contract_address(), &amount);

        // Get or create user stake
        let mut user_stake = Self::get_user_stake(&env, &user);
        let reward_tokens = Self::get_reward_tokens(&env);

        // Harvest pending rewards before updating stake
        Self::internal_harvest(&env, &user, &mut user_stake, &reward_tokens)?;

        // Update user stake
        let new_amount = safe_add(user_stake.amount, amount)?;
        user_stake.amount = new_amount;
        user_stake.stake_time = env.ledger().timestamp();

        // Update reward debts for all reward tokens
        for reward_token in reward_tokens.iter() {
            let acc_per_share = Self::get_acc_reward_per_share(&env, &reward_token);
            user_stake.reward_debt = safe_div(safe_mul(new_amount, acc_per_share)?, PRECISION)?;
        }

        // Save user stake
        env.storage().persistent().set(&DataKey::UserStake(user.clone()), &user_stake);

        // Update total staked
        let total_staked = Self::get_total_staked(&env);
        let new_total = safe_add(total_staked, amount)?;
        env.storage().instance().set(&DataKey::TotalStaked, &new_total);

        emit_stake(&env, &user, amount, new_total);
        extend_instance_ttl(&env);

        Ok(new_amount)
    }

    /// Unstake tokens
    pub fn unstake(env: Env, user: Address, amount: i128) -> Result<i128, SharedError> {
        user.require_auth();
        Self::require_initialized(&env)?;
        Self::require_not_paused(&env)?;

        if amount <= 0 {
            return Err(SharedError::InvalidAmount);
        }

        let mut user_stake = Self::get_user_stake(&env, &user);

        if user_stake.amount < amount {
            return Err(SharedError::InsufficientBalance);
        }

        let reward_tokens = Self::get_reward_tokens(&env);

        // Harvest pending rewards before updating stake
        Self::internal_harvest(&env, &user, &mut user_stake, &reward_tokens)?;

        // Update user stake
        let remaining = safe_sub(user_stake.amount, amount)?;
        user_stake.amount = remaining;

        // Update reward debts
        for reward_token in reward_tokens.iter() {
            let acc_per_share = Self::get_acc_reward_per_share(&env, &reward_token);
            user_stake.reward_debt = safe_div(safe_mul(remaining, acc_per_share)?, PRECISION)?;
        }

        // Save user stake
        env.storage().persistent().set(&DataKey::UserStake(user.clone()), &user_stake);

        // Update total staked
        let total_staked = Self::get_total_staked(&env);
        let new_total = safe_sub(total_staked, amount)?;
        env.storage().instance().set(&DataKey::TotalStaked, &new_total);

        // Transfer tokens back to user
        let stake_token: Address = env.storage().instance().get(&DataKey::StakeToken)
            .ok_or(SharedError::NotInitialized)?;
        let token_client = token::Client::new(&env, &stake_token);
        token_client.transfer(&env.current_contract_address(), &user, &amount);

        emit_unstake(&env, &user, amount, remaining);
        extend_instance_ttl(&env);

        Ok(remaining)
    }

    /// Claim pending rewards without unstaking
    pub fn claim(env: Env, user: Address) -> Result<Vec<(Address, i128)>, SharedError> {
        user.require_auth();
        Self::require_initialized(&env)?;
        Self::require_not_paused(&env)?;

        let mut user_stake = Self::get_user_stake(&env, &user);
        let reward_tokens = Self::get_reward_tokens(&env);

        let rewards = Self::internal_harvest(&env, &user, &mut user_stake, &reward_tokens)?;

        // Update reward debt
        for reward_token in reward_tokens.iter() {
            let acc_per_share = Self::get_acc_reward_per_share(&env, &reward_token);
            user_stake.reward_debt = safe_div(safe_mul(user_stake.amount, acc_per_share)?, PRECISION)?;
        }

        env.storage().persistent().set(&DataKey::UserStake(user.clone()), &user_stake);
        extend_instance_ttl(&env);

        Ok(rewards)
    }

    // ────────────────────────────────────────────────────────────────────────
    // Reward Management (called by Fee Distributor)
    // ────────────────────────────────────────────────────────────────────────

    /// Add rewards to the pool (called by Fee Distributor)
    pub fn add_rewards(env: Env, caller: Address, reward_token: Address, amount: i128) -> Result<(), SharedError> {
        caller.require_auth();
        Self::require_initialized(&env)?;

        // Verify caller is fee distributor
        let fee_distributor: Address = env.storage().instance().get(&DataKey::FeeDistributor)
            .ok_or(SharedError::NotInitialized)?;

        if caller != fee_distributor {
            // Also allow admin
            let admin: Address = env.storage().instance().get(&DataKey::Admin)
                .ok_or(SharedError::NotInitialized)?;
            if caller != admin {
                return Err(SharedError::Unauthorized);
            }
        }

        if amount <= 0 {
            return Err(SharedError::InvalidAmount);
        }

        // Transfer reward tokens to contract
        let token_client = token::Client::new(&env, &reward_token);
        token_client.transfer(&caller, &env.current_contract_address(), &amount);

        let total_staked = Self::get_total_staked(&env);

        // Only update accumulated rewards if there are stakers
        if total_staked > 0 {
            let current_acc = Self::get_acc_reward_per_share(&env, &reward_token);
            let reward_per_share = safe_div(safe_mul(amount, PRECISION)?, total_staked)?;
            let new_acc = safe_add(current_acc, reward_per_share)?;
            env.storage().persistent().set(&DataKey::AccRewardPerShare(reward_token.clone()), &new_acc);
        }

        // Update total rewards
        let total_rewards = Self::get_total_rewards(&env, &reward_token);
        let new_total = safe_add(total_rewards, amount)?;
        env.storage().persistent().set(&DataKey::TotalRewards(reward_token.clone()), &new_total);

        // Ensure reward token is tracked
        Self::add_reward_token(&env, &reward_token);

        let events = EventBuilder::new(&env);
        events.publish("staking", "rewards_added", (reward_token, amount, env.ledger().timestamp()));

        extend_instance_ttl(&env);

        Ok(())
    }

    // ────────────────────────────────────────────────────────────────────────
    // Admin Functions
    // ────────────────────────────────────────────────────────────────────────

    /// Update staking configuration
    pub fn update_config(env: Env, new_config: StakingConfig) -> Result<(), SharedError> {
        Self::require_admin(&env)?;

        if new_config.min_stake_amount <= 0 {
            return Err(SharedError::InvalidAmount);
        }

        env.storage().instance().set(&DataKey::Config, &new_config);
        extend_instance_ttl(&env);

        Ok(())
    }

    /// Update fee distributor address
    pub fn set_fee_distributor(env: Env, new_distributor: Address) -> Result<(), SharedError> {
        Self::require_admin(&env)?;

        env.storage().instance().set(&DataKey::FeeDistributor, &new_distributor);
        extend_instance_ttl(&env);

        Ok(())
    }

    /// Set admin address
    pub fn set_admin(env: Env, new_admin: Address) -> Result<(), SharedError> {
        Self::require_admin(&env)?;

        env.storage().instance().set(&DataKey::Admin, &new_admin);
        extend_instance_ttl(&env);

        Ok(())
    }

    /// Pause/unpause the contract
    pub fn set_paused(env: Env, paused: bool) -> Result<(), SharedError> {
        Self::require_admin(&env)?;

        env.storage().instance().set(&DataKey::Paused, &paused);

        let events = EventBuilder::new(&env);
        events.publish("staking", "paused", (paused, env.ledger().timestamp()));

        extend_instance_ttl(&env);
        Ok(())
    }

    /// Emergency withdrawal of stuck tokens (admin only)
    pub fn emergency_withdraw(
        env: Env,
        token: Address,
        to: Address,
        amount: i128,
    ) -> Result<(), SharedError> {
        Self::require_admin(&env)?;

        let paused: bool = env.storage().instance().get(&DataKey::Paused).unwrap_or(false);
        if !paused {
            return Err(SharedError::ContractNotPaused);
        }

        let token_client = token::Client::new(&env, &token);
        token_client.transfer(&env.current_contract_address(), &to, &amount);

        let events = EventBuilder::new(&env);
        events.publish("staking", "emergency_withdraw", (token, to, amount));

        Ok(())
    }

    // ────────────────────────────────────────────────────────────────────────
    // Query Functions
    // ────────────────────────────────────────────────────────────────────────

    /// Get user stake information
    pub fn get_stake(env: Env, user: Address) -> UserStake {
        Self::get_user_stake(&env, &user)
    }

    /// Get pending rewards for a user
    pub fn pending_rewards(env: Env, user: Address) -> Vec<(Address, i128)> {
        let user_stake = Self::get_user_stake(&env, &user);
        let reward_tokens = Self::get_reward_tokens(&env);
        let mut rewards = Vec::new(&env);

        if user_stake.amount == 0 {
            return rewards;
        }

        for reward_token in reward_tokens.iter() {
            let acc_per_share = Self::get_acc_reward_per_share(&env, &reward_token);
            let pending = Self::calculate_pending(&user_stake.amount, acc_per_share, user_stake.reward_debt);
            if pending > 0 {
                rewards.push_back((reward_token, pending));
            }
        }

        rewards
    }

    /// Get total staked amount
    pub fn total_staked(env: Env) -> i128 {
        Self::get_total_staked(&env)
    }

    /// Get staking configuration
    pub fn get_config(env: Env) -> Result<StakingConfig, SharedError> {
        env.storage().instance().get(&DataKey::Config)
            .ok_or(SharedError::NotInitialized)
    }

    /// Get stake token address
    pub fn stake_token(env: Env) -> Result<Address, SharedError> {
        env.storage().instance().get(&DataKey::StakeToken)
            .ok_or(SharedError::NotInitialized)
    }

    /// Get all reward tokens
    pub fn reward_tokens(env: Env) -> Vec<Address> {
        Self::get_reward_tokens(&env)
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

    /// Get APR estimate (based on recent rewards)
    pub fn get_apr(env: Env, reward_token: Address) -> i128 {
        let total_staked = Self::get_total_staked(&env);
        let total_rewards = Self::get_total_rewards(&env, &reward_token);

        if total_staked == 0 || total_rewards == 0 {
            return 0;
        }

        // Simple APR calculation: (rewards / staked) * 100
        // This is a simplified estimate
        safe_div(safe_mul(total_rewards, 10000).unwrap_or(0), total_staked).unwrap_or(0)
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

    fn get_user_stake(env: &Env, user: &Address) -> UserStake {
        env.storage().persistent()
            .get(&DataKey::UserStake(user.clone()))
            .unwrap_or(UserStake::new(0, env.ledger().timestamp()))
    }

    fn get_total_staked(env: &Env) -> i128 {
        env.storage().instance()
            .get(&DataKey::TotalStaked)
            .unwrap_or(0)
    }

    fn get_acc_reward_per_share(env: &Env, reward_token: &Address) -> i128 {
        env.storage().persistent()
            .get(&DataKey::AccRewardPerShare(reward_token.clone()))
            .unwrap_or(0)
    }

    fn get_total_rewards(env: &Env, reward_token: &Address) -> i128 {
        env.storage().persistent()
            .get(&DataKey::TotalRewards(reward_token.clone()))
            .unwrap_or(0)
    }

    fn get_reward_tokens(env: &Env) -> Vec<Address> {
        env.storage().instance()
            .get(&DataKey::RewardTokens)
            .unwrap_or(Vec::new(env))
    }

    fn add_reward_token(env: &Env, token: &Address) {
        let mut tokens = Self::get_reward_tokens(env);

        // Check if already in list
        for t in tokens.iter() {
            if t == *token {
                return;
            }
        }

        tokens.push_back(token.clone());
        env.storage().instance().set(&DataKey::RewardTokens, &tokens);
    }

    fn calculate_pending(stake_amount: &i128, acc_per_share: i128, reward_debt: i128) -> i128 {
        let accumulated = safe_div(safe_mul(*stake_amount, acc_per_share).unwrap_or(0), PRECISION).unwrap_or(0);
        safe_sub(accumulated, reward_debt).unwrap_or(0)
    }

    fn internal_harvest(
        env: &Env,
        user: &Address,
        user_stake: &mut UserStake,
        reward_tokens: &Vec<Address>,
    ) -> Result<Vec<(Address, i128)>, SharedError> {
        let mut rewards = Vec::new(env);

        if user_stake.amount == 0 {
            return Ok(rewards);
        }

        for reward_token in reward_tokens.iter() {
            let acc_per_share = Self::get_acc_reward_per_share(env, &reward_token);
            let pending = Self::calculate_pending(&user_stake.amount, acc_per_share, user_stake.reward_debt);

            if pending > 0 {
                // Transfer rewards to user
                let token_client = token::Client::new(env, &reward_token);
                token_client.transfer(&env.current_contract_address(), user, &pending);

                emit_claim(env, user, &reward_token, pending);
                rewards.push_back((reward_token, pending));
            }
        }

        user_stake.last_claim_time = env.ledger().timestamp();

        Ok(rewards)
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

    fn default_config() -> StakingConfig {
        StakingConfig {
            min_stake_amount: 10_000_000, // 1 token
            cooldown_period: 0,
            max_stake_per_user: 0, // No limit
            emergency_unlock: false,
        }
    }

    #[test]
    fn test_initialize() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(StakingPool, ());
        let client = StakingPoolClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let stake_token = Address::generate(&env);
        let fee_distributor = Address::generate(&env);

        client.initialize(&admin, &stake_token, &fee_distributor, &default_config());

        assert_eq!(client.admin(), admin);
        assert_eq!(client.stake_token(), stake_token);
        assert_eq!(client.total_staked(), 0);
    }

    #[test]
    fn test_stake_and_unstake() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(StakingPool, ());
        let client = StakingPoolClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let fee_distributor = Address::generate(&env);
        let user = Address::generate(&env);

        // Create stake token
        let (stake_token, stake_admin) = create_token(&env, &admin);
        stake_admin.mint(&user, &1_000_000_000_000); // 100,000 tokens

        client.initialize(&admin, &stake_token.address, &fee_distributor, &default_config());

        // Stake
        let stake_amount = 100_000_000_000_i128; // 10,000 tokens
        let new_balance = client.stake(&user, &stake_amount);
        assert_eq!(new_balance, stake_amount);
        assert_eq!(client.total_staked(), stake_amount);

        // Check user stake
        let user_stake = client.get_stake(&user);
        assert_eq!(user_stake.amount, stake_amount);

        // Unstake half
        let unstake_amount = 50_000_000_000_i128;
        let remaining = client.unstake(&user, &unstake_amount);
        assert_eq!(remaining, stake_amount - unstake_amount);
        assert_eq!(client.total_staked(), stake_amount - unstake_amount);
    }

    #[test]
    fn test_add_rewards_and_claim() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(StakingPool, ());
        let client = StakingPoolClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let fee_distributor = Address::generate(&env);
        let user = Address::generate(&env);

        // Create tokens
        let (stake_token, stake_admin) = create_token(&env, &admin);
        let (reward_token, reward_admin) = create_token(&env, &admin);

        stake_admin.mint(&user, &1_000_000_000_000);
        reward_admin.mint(&fee_distributor, &1_000_000_000_000);

        client.initialize(&admin, &stake_token.address, &fee_distributor, &default_config());

        // User stakes
        client.stake(&user, &100_000_000_000);

        // Add rewards
        client.add_rewards(&fee_distributor, &reward_token.address, &10_000_000_000);

        // Check pending rewards
        let pending = client.pending_rewards(&user);
        assert_eq!(pending.len(), 1);
        let (token, amount) = pending.get(0).unwrap();
        assert_eq!(token, reward_token.address);
        assert_eq!(amount, 10_000_000_000);

        // Claim rewards
        client.claim(&user);

        // Verify user received rewards
        assert_eq!(reward_token.balance(&user), 10_000_000_000);
    }

    #[test]
    fn test_multiple_stakers() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(StakingPool, ());
        let client = StakingPoolClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let fee_distributor = Address::generate(&env);
        let user1 = Address::generate(&env);
        let user2 = Address::generate(&env);

        let (stake_token, stake_admin) = create_token(&env, &admin);
        let (reward_token, reward_admin) = create_token(&env, &admin);

        stake_admin.mint(&user1, &1_000_000_000_000);
        stake_admin.mint(&user2, &1_000_000_000_000);
        reward_admin.mint(&fee_distributor, &1_000_000_000_000);

        client.initialize(&admin, &stake_token.address, &fee_distributor, &default_config());

        // User1 stakes 75%, User2 stakes 25%
        client.stake(&user1, &75_000_000_000);
        client.stake(&user2, &25_000_000_000);

        // Add rewards
        client.add_rewards(&fee_distributor, &reward_token.address, &100_000_000_000);

        // User1 should get 75% of rewards, User2 gets 25%
        let pending1 = client.pending_rewards(&user1);
        let pending2 = client.pending_rewards(&user2);

        let (_, amount1) = pending1.get(0).unwrap();
        let (_, amount2) = pending2.get(0).unwrap();

        // 75% of 100B = 75B
        assert_eq!(amount1, 75_000_000_000);
        // 25% of 100B = 25B
        assert_eq!(amount2, 25_000_000_000);
    }
}
