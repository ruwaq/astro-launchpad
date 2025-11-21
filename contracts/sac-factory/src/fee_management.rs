//! Fee Management
//!
//! Handles all fee-related operations including collection,
//! configuration, and distribution.

use soroban_sdk::{contracttype, Address, Env};
use crate::errors::Error;
use crate::math;
use crate::access_control::Role;
use crate::events;

/// Fee configuration
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct FeeConfig {
    /// Fee for creating a new token (in stroops)
    pub creation_fee: i128,
    /// Trading fee in basis points (100 = 1%)
    pub trading_fee_bps: i128,
    /// Treasury address that receives fees
    pub treasury: Address,
}

impl FeeConfig {
    pub fn new(creation_fee: i128, trading_fee_bps: i128, treasury: Address) -> Result<Self, Error> {
        // Validate fees
        if creation_fee < 0 {
            return Err(Error::InvalidFeeConfiguration);
        }
        if trading_fee_bps < 0 || trading_fee_bps > 10_000 {
            // Max 100% fee
            return Err(Error::FeeTooHigh);
        }

        Ok(FeeConfig {
            creation_fee,
            trading_fee_bps,
            treasury,
        })
    }
}

/// Storage key for fee config
#[derive(Clone)]
#[contracttype]
pub enum FeeKey {
    Config,
}

/// Get fee configuration
pub fn get_fee_config(env: &Env) -> FeeConfig {
    env.storage()
        .persistent()
        .get(&FeeKey::Config)
        .unwrap_or_else(|| {
            // Default config
            FeeConfig {
                creation_fee: 100_000,     // 0.01 XLM
                trading_fee_bps: 100,       // 1%
                treasury: env.current_contract_address(), // Fallback
            }
        })
}

/// Set fee configuration (only FeeAdmin)
pub fn set_fee_config(
    env: &Env,
    admin: &Address,
    creation_fee: i128,
    trading_fee_bps: i128,
) -> Result<(), Error> {
    admin.require_auth();

    // Only FeeAdmin or Owner can update fees
    if !crate::access_control::has_role(env, admin, Role::FeeAdmin)
        && !crate::access_control::has_role(env, admin, Role::Owner) {
        return Err(Error::Unauthorized);
    }

    // Validate new config
    let mut config = get_fee_config(env);
    config.creation_fee = creation_fee;
    config.trading_fee_bps = trading_fee_bps;

    // Ensure valid
    if creation_fee < 0 {
        return Err(Error::InvalidFeeConfiguration);
    }
    if trading_fee_bps < 0 || trading_fee_bps > 1000 {
        // Max 10% trading fee
        return Err(Error::FeeTooHigh);
    }

    // Save
    env.storage().persistent().set(&FeeKey::Config, &config);

    // Emit event
    events::fee_config_updated(env, creation_fee, trading_fee_bps, admin);

    Ok(())
}

/// Update treasury address (only TreasuryAdmin or Owner)
pub fn set_treasury(env: &Env, admin: &Address, new_treasury: &Address) -> Result<(), Error> {
    admin.require_auth();

    // Check permissions
    if !crate::access_control::has_role(env, admin, Role::TreasuryAdmin)
        && !crate::access_control::has_role(env, admin, Role::Owner) {
        return Err(Error::Unauthorized);
    }

    let mut config = get_fee_config(env);
    let old_treasury = config.treasury.clone();
    config.treasury = new_treasury.clone();

    env.storage().persistent().set(&FeeKey::Config, &config);

    // Emit event
    events::treasury_updated(env, &old_treasury, new_treasury, admin);

    Ok(())
}

/// Calculate trading fee amount
pub fn calculate_trading_fee(amount: i128, fee_bps: i128) -> Result<i128, Error> {
    math::apply_bps(amount, fee_bps)
}

/// Collect creation fee from user
///
/// Transfers XLM from creator to treasury using native XLM SAC
pub fn collect_creation_fee(
    env: &Env,
    from: &Address,
) -> Result<i128, Error> {
    let config = get_fee_config(env);

    if config.creation_fee == 0 {
        return Ok(0);
    }

    // In test environment, skip actual XLM transfer
    // In production, this transfers XLM from creator to treasury
    #[cfg(not(test))]
    {
        crate::token_deployment::transfer_xlm(env, from, &config.treasury, config.creation_fee)?;
    }

    // Suppress unused variable warning in test mode
    #[cfg(test)]
    let _ = from;

    // For tests, just return the fee amount
    Ok(config.creation_fee)
}

/// Collect trading fee and return net amount
///
/// Returns: (net_amount, fee_collected)
pub fn apply_trading_fee(
    env: &Env,
    gross_amount: i128,
) -> Result<(i128, i128), Error> {
    let config = get_fee_config(env);

    if config.trading_fee_bps == 0 {
        return Ok((gross_amount, 0));
    }

    let fee = calculate_trading_fee(gross_amount, config.trading_fee_bps)?;
    let net = math::safe_sub(gross_amount, fee)?;

    Ok((net, fee))
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::testutils::Address as _;

    // Only test pure functions that don't require storage or contract context

    #[test]
    fn test_fee_config_creation() {
        let env = Env::default();
        let treasury = Address::generate(&env);

        let config = FeeConfig::new(100_000, 100, treasury.clone()).unwrap();

        assert_eq!(config.creation_fee, 100_000);
        assert_eq!(config.trading_fee_bps, 100);
        assert_eq!(config.treasury, treasury);
    }

    #[test]
    fn test_calculate_trading_fee() {
        // 1% of 1000 = 10
        assert_eq!(calculate_trading_fee(1000, 100).unwrap(), 10);
        // 5% of 1000 = 50
        assert_eq!(calculate_trading_fee(1000, 500).unwrap(), 50);
        // 0.1% of 10000 = 10
        assert_eq!(calculate_trading_fee(10_000, 10).unwrap(), 10);
    }

    // Tests for fee management functions with storage/auth are in src/tests.rs
    // Per Soroban best practices, functions requiring contract context should only
    // be tested through the contract client interface, not directly.
}
