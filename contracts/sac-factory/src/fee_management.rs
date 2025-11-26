//! Fee Management Module
//!
//! Implements dual-fee system for AstroShiba:
//! - Protocol Fee: 0.05% → Multi-sig treasury (team revenue)
//! - LP Fee: 0.25% → Bonding curve (liquidity provision)
//! - Creation Fee: 10 XLM → Anti-spam + revenue
//!
//! Design principles:
//! - Gas-optimized calculations
//! - Atomic fee collection
//! - Multi-sig treasury support
//! - Zero precision loss

use soroban_sdk::{contracttype, Address, Env};
use crate::errors::Error;
use crate::math;
use crate::access_control::Role;
use crate::events;

/// Basis points precision (10000 = 100%)
const BPS_PRECISION: i128 = 10_000;

/// Default protocol fee: 0.05% = 5 basis points
const DEFAULT_PROTOCOL_FEE_BPS: i128 = 5;

/// Default LP fee: 0.25% = 25 basis points
const DEFAULT_LP_FEE_BPS: i128 = 25;

/// Default creation fee: 10 XLM = 100,000,000 stroops
const DEFAULT_CREATION_FEE: i128 = 100_000_000;

/// Maximum allowed protocol fee: 1% = 100 basis points
const MAX_PROTOCOL_FEE_BPS: i128 = 100;

/// Maximum allowed LP fee: 1% = 100 basis points
const MAX_LP_FEE_BPS: i128 = 100;

/// Fee configuration with dual-fee model
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct FeeConfig {
    /// Token creation fee (in stroops) - Anti-spam measure
    pub creation_fee: i128,
    
    /// Protocol fee in basis points (revenue to team multi-sig)
    pub protocol_fee_bps: i128,
    
    /// LP fee in basis points (liquidity provision to bonding curve)
    pub lp_fee_bps: i128,
    
    /// Multi-sig treasury address (receives protocol fees)
    pub treasury: Address,
}

/// Fee breakdown for a transaction
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct FeeBreakdown {
    /// Gross amount before fees
    pub gross_amount: i128,
    
    /// Protocol fee amount
    pub protocol_fee: i128,
    
    /// LP fee amount
    pub lp_fee: i128,
    
    /// Total fees (protocol + LP)
    pub total_fees: i128,
    
    /// Net amount after fees
    pub net_amount: i128,
}

/// Storage key for fee configuration
#[derive(Clone)]
#[contracttype]
pub enum FeeKey {
    Config,
    AccumulatedProtocolFees, // Track accumulated fees for transparency
}

impl FeeConfig {
    /// Create new fee configuration with validation
    pub fn new(
        creation_fee: i128,
        protocol_fee_bps: i128,
        lp_fee_bps: i128,
        treasury: Address,
    ) -> Result<Self, Error> {
        // Validate creation fee
        if creation_fee < 0 {
            return Err(Error::InvalidFeeConfiguration);
        }

        // Validate protocol fee
        if protocol_fee_bps < 0 || protocol_fee_bps > MAX_PROTOCOL_FEE_BPS {
            return Err(Error::FeeTooHigh);
        }

        // Validate LP fee
        if lp_fee_bps < 0 || lp_fee_bps > MAX_LP_FEE_BPS {
            return Err(Error::FeeTooHigh);
        }

        // Total fees should not exceed 2% (reasonable limit)
        let total_fee_bps = protocol_fee_bps
            .checked_add(lp_fee_bps)
            .ok_or(Error::Overflow)?;
        
        if total_fee_bps > 200 {
            return Err(Error::FeeTooHigh);
        }

        Ok(FeeConfig {
            creation_fee,
            protocol_fee_bps,
            lp_fee_bps,
            treasury,
        })
    }

    /// Get total fee percentage in basis points
    pub fn total_fee_bps(&self) -> Result<i128, Error> {
        self.protocol_fee_bps
            .checked_add(self.lp_fee_bps)
            .ok_or(Error::Overflow)
    }
}

/// Initialize fee configuration (called once during contract initialization)
pub fn initialize_fee_config(
    env: &Env,
    treasury: Address,
) -> Result<(), Error> {
    let config = FeeConfig::new(
        DEFAULT_CREATION_FEE,
        DEFAULT_PROTOCOL_FEE_BPS,
        DEFAULT_LP_FEE_BPS,
        treasury,
    )?;

    env.storage().persistent().set(&FeeKey::Config, &config);
    env.storage().persistent().set(&FeeKey::AccumulatedProtocolFees, &0i128);

    Ok(())
}

/// Get current fee configuration
pub fn get_fee_config(env: &Env) -> FeeConfig {
    env.storage()
        .persistent()
        .get(&FeeKey::Config)
        .unwrap_or_else(|| {
            // Fallback to default config (should not happen in production)
            FeeConfig {
                creation_fee: DEFAULT_CREATION_FEE,
                protocol_fee_bps: DEFAULT_PROTOCOL_FEE_BPS,
                lp_fee_bps: DEFAULT_LP_FEE_BPS,
                treasury: env.current_contract_address(),
            }
        })
}

/// Update protocol fee (only FeeAdmin or Owner)
pub fn set_protocol_fee(
    env: &Env,
    admin: &Address,
    new_protocol_fee_bps: i128,
) -> Result<(), Error> {
    admin.require_auth();

    // Authorization check
    if !crate::access_control::has_role(env, admin, Role::FeeAdmin)
        && !crate::access_control::has_role(env, admin, Role::Owner) {
        return Err(Error::Unauthorized);
    }

    // Validate new fee
    if new_protocol_fee_bps < 0 || new_protocol_fee_bps > MAX_PROTOCOL_FEE_BPS {
        return Err(Error::FeeTooHigh);
    }

    let mut config = get_fee_config(env);
    let old_fee = config.protocol_fee_bps;
    config.protocol_fee_bps = new_protocol_fee_bps;

    // Ensure total fees don't exceed limit
    if config.total_fee_bps()? > 200 {
        return Err(Error::FeeTooHigh);
    }

    env.storage().persistent().set(&FeeKey::Config, &config);

    events::protocol_fee_updated(env, old_fee, new_protocol_fee_bps, admin);

    Ok(())
}

/// Update LP fee (only FeeAdmin or Owner)
pub fn set_lp_fee(
    env: &Env,
    admin: &Address,
    new_lp_fee_bps: i128,
) -> Result<(), Error> {
    admin.require_auth();

    // Authorization check
    if !crate::access_control::has_role(env, admin, Role::FeeAdmin)
        && !crate::access_control::has_role(env, admin, Role::Owner) {
        return Err(Error::Unauthorized);
    }

    // Validate new fee
    if new_lp_fee_bps < 0 || new_lp_fee_bps > MAX_LP_FEE_BPS {
        return Err(Error::FeeTooHigh);
    }

    let mut config = get_fee_config(env);
    let old_fee = config.lp_fee_bps;
    config.lp_fee_bps = new_lp_fee_bps;

    // Ensure total fees don't exceed limit
    if config.total_fee_bps()? > 200 {
        return Err(Error::FeeTooHigh);
    }

    env.storage().persistent().set(&FeeKey::Config, &config);

    events::lp_fee_updated(env, old_fee, new_lp_fee_bps, admin);

    Ok(())
}

/// Update creation fee (only FeeAdmin or Owner)
pub fn set_creation_fee(
    env: &Env,
    admin: &Address,
    new_creation_fee: i128,
) -> Result<(), Error> {
    admin.require_auth();

    // Authorization check
    if !crate::access_control::has_role(env, admin, Role::FeeAdmin)
        && !crate::access_control::has_role(env, admin, Role::Owner) {
        return Err(Error::Unauthorized);
    }

    // Validate new fee
    if new_creation_fee < 0 {
        return Err(Error::InvalidFeeConfiguration);
    }

    let mut config = get_fee_config(env);
    let old_fee = config.creation_fee;
    config.creation_fee = new_creation_fee;

    env.storage().persistent().set(&FeeKey::Config, &config);

    events::creation_fee_updated(env, old_fee, new_creation_fee, admin);

    Ok(())
}

/// Update treasury address (only TreasuryAdmin or Owner)
pub fn set_treasury(
    env: &Env,
    admin: &Address,
    new_treasury: &Address,
) -> Result<(), Error> {
    admin.require_auth();

    // Authorization check
    if !crate::access_control::has_role(env, admin, Role::TreasuryAdmin)
        && !crate::access_control::has_role(env, admin, Role::Owner) {
        return Err(Error::Unauthorized);
    }

    let mut config = get_fee_config(env);
    let old_treasury = config.treasury.clone();
    config.treasury = new_treasury.clone();

    env.storage().persistent().set(&FeeKey::Config, &config);

    events::treasury_updated(env, &old_treasury, new_treasury, admin);

    Ok(())
}

/// Calculate fee breakdown for a given amount
///
/// This is a pure calculation function with no side effects
pub fn calculate_fee_breakdown(
    gross_amount: i128,
    protocol_fee_bps: i128,
    lp_fee_bps: i128,
) -> Result<FeeBreakdown, Error> {
    if gross_amount <= 0 {
        return Err(Error::InvalidAmount);
    }

    // Calculate protocol fee
    let protocol_fee = math::apply_bps(gross_amount, protocol_fee_bps)?;

    // Calculate LP fee
    let lp_fee = math::apply_bps(gross_amount, lp_fee_bps)?;

    // Calculate total fees
    let total_fees = protocol_fee
        .checked_add(lp_fee)
        .ok_or(Error::Overflow)?;

    // Calculate net amount
    let net_amount = gross_amount
        .checked_sub(total_fees)
        .ok_or(Error::Underflow)?;

    Ok(FeeBreakdown {
        gross_amount,
        protocol_fee,
        lp_fee,
        total_fees,
        net_amount,
    })
}

/// Apply fees to a trading amount and return breakdown
///
/// This function calculates fees but does NOT transfer them
/// The caller is responsible for handling the actual transfers
pub fn apply_trading_fees(
    env: &Env,
    gross_amount: i128,
) -> Result<FeeBreakdown, Error> {
    let config = get_fee_config(env);
    
    calculate_fee_breakdown(
        gross_amount,
        config.protocol_fee_bps,
        config.lp_fee_bps,
    )
}

/// Collect creation fee from creator
///
/// Transfers XLM from creator to treasury using native XLM SAC
pub fn collect_creation_fee(
    env: &Env,
    from: &Address,
) -> Result<i128, Error> {
    use soroban_sdk::token;

    let config = get_fee_config(env);

    if config.creation_fee == 0 {
        return Ok(0);
    }

    // Transfer creation fee from creator to treasury using native XLM SAC
    #[cfg(not(test))]
    {
        // Get XLM token address from storage (set during initialization)
        let xlm_token_address = crate::storage::get_xlm_token_address(env)
            .expect("XLM token address not configured - contract not initialized");

        let xlm_client = token::Client::new(env, &xlm_token_address);

        // Transfer creation fee from creator to treasury
        xlm_client.transfer(from, &config.treasury, &config.creation_fee);
    }

    // Track accumulated fees for transparency
    let accumulated: i128 = env.storage()
        .persistent()
        .get(&FeeKey::AccumulatedProtocolFees)
        .unwrap_or(0);

    let new_accumulated = accumulated
        .checked_add(config.creation_fee)
        .ok_or(Error::Overflow)?;

    env.storage()
        .persistent()
        .set(&FeeKey::AccumulatedProtocolFees, &new_accumulated);

    // Suppress unused variable warning in test mode
    #[cfg(test)]
    let _ = from;

    Ok(config.creation_fee)
}

/// Transfer protocol fee to treasury
///
/// Called after a trade to send protocol fees to multi-sig
pub fn transfer_protocol_fee(
    env: &Env,
    token: &Address,
    amount: i128,
) -> Result<(), Error> {
    if amount == 0 {
        return Ok(());
    }

    let config = get_fee_config(env);
    
    #[cfg(not(test))]
    {
        use soroban_sdk::token;

        // Use StellarAssetClient to MINT protocol fee directly to treasury
        // We can't use transfer because the factory doesn't hold tokens
        // (bonding curve mints tokens on buy, doesn't transfer from reserves)
        let token_client = token::StellarAssetClient::new(env, token);

        // Mint protocol fee to treasury (factory must be token admin)
        token_client.mint(&config.treasury, &amount);
    }

    #[cfg(test)]
    let _ = config; // Suppress unused warning in test mode

    // Track accumulated protocol fees
    let accumulated: i128 = env.storage()
        .persistent()
        .get(&FeeKey::AccumulatedProtocolFees)
        .unwrap_or(0);
    
    let new_accumulated = accumulated
        .checked_add(amount)
        .ok_or(Error::Overflow)?;
    
    env.storage()
        .persistent()
        .set(&FeeKey::AccumulatedProtocolFees, &new_accumulated);

    // Suppress unused variable warning in test mode
    #[cfg(test)]
    let _ = (token, amount);

    Ok(())
}

/// Get total accumulated protocol fees (for transparency)
pub fn get_accumulated_protocol_fees(env: &Env) -> i128 {
    env.storage()
        .persistent()
        .get(&FeeKey::AccumulatedProtocolFees)
        .unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::testutils::Address as _;

    #[test]
    fn test_fee_config_creation() {
        let env = Env::default();
        let treasury = Address::generate(&env);

        let config = FeeConfig::new(
            DEFAULT_CREATION_FEE,
            DEFAULT_PROTOCOL_FEE_BPS,
            DEFAULT_LP_FEE_BPS,
            treasury.clone(),
        ).unwrap();

        assert_eq!(config.creation_fee, DEFAULT_CREATION_FEE);
        assert_eq!(config.protocol_fee_bps, DEFAULT_PROTOCOL_FEE_BPS);
        assert_eq!(config.lp_fee_bps, DEFAULT_LP_FEE_BPS);
        assert_eq!(config.treasury, treasury);
    }

    #[test]
    fn test_fee_config_validation() {
        let env = Env::default();
        let treasury = Address::generate(&env);

        // Negative creation fee should fail
        assert!(FeeConfig::new(-1, 5, 25, treasury.clone()).is_err());

        // Protocol fee too high should fail
        assert!(FeeConfig::new(100_000_000, 101, 25, treasury.clone()).is_err());

        // LP fee too high should fail
        assert!(FeeConfig::new(100_000_000, 5, 101, treasury.clone()).is_err());

        // Total fees > 2% should fail
        assert!(FeeConfig::new(100_000_000, 100, 101, treasury.clone()).is_err());
    }

    #[test]
    fn test_calculate_fee_breakdown() {
        let amount = 100_000_000i128; // 10 XLM

        let breakdown = calculate_fee_breakdown(
            amount,
            DEFAULT_PROTOCOL_FEE_BPS,
            DEFAULT_LP_FEE_BPS,
        ).unwrap();

        // Protocol fee: 0.05% of 100M = 50,000
        assert_eq!(breakdown.protocol_fee, 50_000);

        // LP fee: 0.25% of 100M = 250,000
        assert_eq!(breakdown.lp_fee, 250_000);

        // Total fees: 300,000
        assert_eq!(breakdown.total_fees, 300_000);

        // Net: 99,700,000
        assert_eq!(breakdown.net_amount, 99_700_000);
    }

    #[test]
    fn test_fee_breakdown_precision() {
        // Test with small amounts to verify precision
        let amount = 1_000i128;

        let breakdown = calculate_fee_breakdown(amount, 5, 25).unwrap();

        // Protocol fee: 0.05% of 1000 = 0.5 → rounds down to 0
        assert_eq!(breakdown.protocol_fee, 0);

        // LP fee: 0.25% of 1000 = 2.5 → rounds down to 2
        assert_eq!(breakdown.lp_fee, 2);

        // Total fees: 2
        assert_eq!(breakdown.total_fees, 2);

        // Net: 998
        assert_eq!(breakdown.net_amount, 998);
    }

    #[test]
    fn test_total_fee_bps() {
        let env = Env::default();
        let treasury = Address::generate(&env);

        let config = FeeConfig::new(
            DEFAULT_CREATION_FEE,
            5,
            25,
            treasury,
        ).unwrap();

        assert_eq!(config.total_fee_bps().unwrap(), 30); // 0.3%
    }

    #[test]
    fn test_zero_amount_fails() {
        let result = calculate_fee_breakdown(0, 5, 25);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), Error::InvalidAmount);
    }

    #[test]
    fn test_negative_amount_fails() {
        let result = calculate_fee_breakdown(-1000, 5, 25);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), Error::InvalidAmount);
    }
}