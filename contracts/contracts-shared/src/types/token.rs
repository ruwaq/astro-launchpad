//! # Token Types
//!
//! Types related to tokens in the Astro ecosystem.

use soroban_sdk::{contracttype, Address, String};

/// Token metadata shared between projects
#[contracttype]
#[derive(Clone, Debug)]
pub struct TokenMetadata {
    /// Token name (e.g., "Astro Shiba")
    pub name: String,
    /// Token symbol (e.g., "ASTRO")
    pub symbol: String,
    /// Number of decimals (typically 7 for Stellar)
    pub decimals: u32,
    /// Creator address
    pub creator: Address,
    /// Total supply
    pub total_supply: i128,
}

/// Token lifecycle states
#[contracttype]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[repr(u32)]
pub enum TokenLifecycle {
    /// Token is in bonding curve phase
    Bonding = 0,
    /// Token graduated to internal AMM
    GraduatedInternal = 1,
    /// Token graduated to external DEX (AstroSwap)
    GraduatedDex = 2,
    /// Graduation failed, needs recovery
    GraduationFailed = 3,
    /// Token is deprecated
    Deprecated = 4,
}

/// Graduation information
#[contracttype]
#[derive(Clone, Debug)]
pub struct GraduationInfo {
    /// Token address
    pub token: Address,
    /// AMM pair address
    pub pair_address: Address,
    /// Staking pool ID (if created)
    pub staking_pool_id: u32,
    /// Initial price at graduation
    pub initial_price: i128,
    /// Graduation timestamp
    pub graduation_time: u64,
    /// XLM locked in pool
    pub xlm_locked: i128,
    /// Tokens locked in pool
    pub tokens_locked: i128,
    /// Destination (internal or DEX)
    pub destination: TokenLifecycle,
}

/// Distribution result after fee split
#[contracttype]
#[derive(Clone, Debug)]
pub struct DistributionResult {
    /// Token that was distributed
    pub token: Address,
    /// Total amount distributed
    pub total_amount: i128,
    /// Amount sent to treasury
    pub treasury_amount: i128,
    /// Amount sent to staking pool
    pub staking_amount: i128,
    /// Amount burned
    pub burn_amount: i128,
    /// Timestamp of distribution
    pub timestamp: u64,
}

/// User stake information
#[contracttype]
#[derive(Clone, Debug)]
pub struct UserStake {
    /// Amount staked
    pub amount: i128,
    /// Timestamp when staked
    pub stake_time: u64,
    /// Last claim timestamp
    pub last_claim_time: u64,
    /// Accumulated reward debt per token (for reward calculation)
    pub reward_debt: i128,
}

impl UserStake {
    pub fn new(amount: i128, timestamp: u64) -> Self {
        Self {
            amount,
            stake_time: timestamp,
            last_claim_time: timestamp,
            reward_debt: 0,
        }
    }
}

/// Lock information for liquidity locker
#[contracttype]
#[derive(Clone, Debug)]
pub struct LockInfo {
    /// Unique lock ID
    pub id: u64,
    /// Lock owner
    pub owner: Address,
    /// LP token address
    pub lp_token: Address,
    /// Amount locked
    pub amount: i128,
    /// When locked
    pub lock_time: u64,
    /// When can unlock
    pub unlock_time: u64,
    /// Whether already unlocked
    pub unlocked: bool,
}

impl LockInfo {
    pub fn is_unlockable(&self, current_time: u64) -> bool {
        !self.unlocked && current_time >= self.unlock_time
    }
}

/// Pending reward for a user
#[contracttype]
#[derive(Clone, Debug)]
pub struct PendingReward {
    /// Reward token address
    pub token: Address,
    /// Pending amount
    pub amount: i128,
}
