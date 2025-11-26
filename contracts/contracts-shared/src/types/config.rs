//! # Configuration Types
//!
//! Common configuration structures used across contracts.

use soroban_sdk::{contracttype, Address};

/// Fee configuration for trading
#[contracttype]
#[derive(Clone, Debug)]
pub struct FeeConfig {
    /// Protocol fee in basis points (max 100 = 1%)
    pub protocol_fee_bps: u32,
    /// LP fee in basis points (max 100 = 1%)
    pub lp_fee_bps: u32,
    /// Treasury address to receive protocol fees
    pub treasury: Address,
}

impl FeeConfig {
    /// Maximum allowed fee in basis points (1%)
    pub const MAX_FEE_BPS: u32 = 100;
    /// Maximum total fee (protocol + LP) in basis points (2%)
    pub const MAX_TOTAL_FEE_BPS: u32 = 200;
    /// Basis points denominator
    pub const BPS_DENOMINATOR: u32 = 10_000;

    /// Validate fee configuration
    pub fn is_valid(&self) -> bool {
        self.protocol_fee_bps <= Self::MAX_FEE_BPS
            && self.lp_fee_bps <= Self::MAX_FEE_BPS
            && (self.protocol_fee_bps + self.lp_fee_bps) <= Self::MAX_TOTAL_FEE_BPS
    }

    /// Calculate total fee in basis points
    pub fn total_fee_bps(&self) -> u32 {
        self.protocol_fee_bps + self.lp_fee_bps
    }
}

/// Distribution configuration for Fee Distributor
#[contracttype]
#[derive(Clone, Debug)]
pub struct DistributionConfig {
    /// Treasury vault address (receives treasury_bps)
    pub treasury_vault: Address,
    /// Staking pool address (receives staking_bps)
    pub staking_pool: Address,
    /// Burn address or dead address (receives burn_bps)
    pub burn_address: Address,
    /// Treasury percentage in basis points (e.g., 5000 = 50%)
    pub treasury_bps: u32,
    /// Staking percentage in basis points (e.g., 3000 = 30%)
    pub staking_bps: u32,
    /// Burn percentage in basis points (e.g., 2000 = 20%)
    pub burn_bps: u32,
    /// Minimum amount to trigger distribution
    pub min_distribution: i128,
}

impl DistributionConfig {
    /// Validate that percentages sum to 100%
    pub fn is_valid(&self) -> bool {
        self.treasury_bps + self.staking_bps + self.burn_bps == 10_000
            && self.min_distribution >= 0
    }
}

/// Staking pool configuration
#[contracttype]
#[derive(Clone, Debug)]
pub struct StakingConfig {
    /// Minimum stake amount
    pub min_stake_amount: i128,
    /// Cooldown period for unstaking (seconds)
    pub cooldown_period: u64,
    /// Maximum stake per user (0 = unlimited)
    pub max_stake_per_user: i128,
    /// Whether emergency unlock is enabled
    pub emergency_unlock: bool,
}

/// Lock configuration for Liquidity Locker
#[contracttype]
#[derive(Clone, Debug)]
pub struct LockConfig {
    /// Minimum lock duration in seconds
    pub min_lock_duration: u64,
    /// Maximum lock duration in seconds
    pub max_lock_duration: u64,
    /// Whether early unlock is allowed (with penalty)
    pub early_unlock_enabled: bool,
    /// Early unlock penalty in basis points
    pub early_unlock_penalty_bps: u32,
}

impl LockConfig {
    /// Default minimum lock: 7 days
    pub const DEFAULT_MIN_LOCK: u64 = 7 * 24 * 60 * 60;
    /// Default maximum lock: 4 years
    pub const DEFAULT_MAX_LOCK: u64 = 4 * 365 * 24 * 60 * 60;
}
