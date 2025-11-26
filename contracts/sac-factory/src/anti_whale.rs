//! Anti-Whale Protection Module v2
//!
//! Progressive fee system to discourage token concentration during bonding curve phase.
//! Instead of hard limits, uses exponential fees that increase with holdings.
//!
//! ## Key Features
//! - **No hard block** until 40% - anyone can accumulate up to 40%
//! - **Exponential fees** - the more you hold, the more you pay
//! - **Only during bonding** - no restrictions after graduation to DEX
//! - **Configurable tiers** - admin can adjust fee structure
//!
//! ## Default Fee Tiers (Holdings % -> Extra Fee)
//!
//! NOTA: La bonding curve YA es anti-whale (precio sube con volumen).
//! Estos fees son solo un pequeño desincentivo adicional, no un bloqueo.
//! MAX FEE: 1% (para no ahuyentar ballenas que ayudan a graduacion)
//!
//! | Holdings | Extra Fee | Razon |
//! |----------|-----------|-------|
//! | 0-10%    | 0%        | Zona libre - incentivar early adopters |
//! | 10-20%   | +0.1%     | Fee minimo |
//! | 20-30%   | +0.25%    | Fee bajo |
//! | 30-40%   | +0.5%     | Fee moderado |
//! | 40-50%   | +1%       | Fee maximo (cap) |
//! | 50%+     | BLOCKED   | Hard cap - nadie puede tener >50% |

use soroban_sdk::{contracttype, Address, Env, Vec};
use crate::errors::Error;
use crate::access_control;

/// Storage key for anti-whale configuration
#[contracttype]
#[derive(Clone)]
pub enum AntiWhaleKey {
    Config,                    // Global anti-whale config
    WalletHoldings(Address),   // Per-wallet token holdings tracking
    LastBuyTime(Address),      // Per-wallet last buy timestamp
}

/// Fee tier definition
#[contracttype]
#[derive(Clone, Debug)]
pub struct FeeTier {
    /// Holdings threshold in basis points (e.g., 500 = 5%)
    pub threshold_bps: i128,
    /// Extra fee in basis points (e.g., 100 = 1%)
    pub extra_fee_bps: i128,
}

/// Anti-whale configuration
#[contracttype]
#[derive(Clone, Debug)]
pub struct AntiWhaleConfig {
    /// Maximum wallet holdings as basis points of total supply
    /// Above this, purchases are BLOCKED (e.g., 4000 = 40%)
    pub absolute_max_holdings_bps: i128,

    /// Fee tiers - progressive fees based on holdings percentage
    /// Stored as parallel arrays for Soroban compatibility
    pub tier_thresholds: Vec<i128>,  // Holdings thresholds in bps
    pub tier_fees: Vec<i128>,        // Extra fees in bps for each tier

    /// Minimum time between purchases from same wallet (seconds)
    /// 0 = no cooldown
    pub cooldown_seconds: u64,

    /// Whether anti-whale protection is enabled
    pub enabled: bool,
}

/// Result of anti-whale validation
#[derive(Clone, Debug)]
pub struct AntiWhaleResult {
    /// Whether the transaction is allowed
    pub allowed: bool,
    /// Additional fee in basis points (0 if no extra fee)
    pub extra_fee_bps: i128,
    /// Reason if not allowed
    pub reason: Option<&'static str>,
}

/// Initialize anti-whale configuration with gentle fee defaults
///
/// Philosophy: The bonding curve already increases price with volume (natural anti-whale).
/// These fees are just a small additional disincentive, NOT a blocker.
/// We want whales to participate (helps graduation), just not dominate completely.
pub fn initialize_anti_whale(env: &Env) {
    // Create default tier thresholds (in basis points)
    // Note: 0-10% is FREE (no extra fees) to encourage early adoption
    let mut thresholds = Vec::new(env);
    thresholds.push_back(1000);  // 10% - start of light fees
    thresholds.push_back(2000);  // 20%
    thresholds.push_back(3000);  // 30%
    thresholds.push_back(4000);  // 40%

    // Create default fees for each tier (VERY GENTLE - max 1%)
    // These are intentionally LOW - the bonding curve handles most anti-whale
    // Max fee capped at 1% to not scare away whales who help graduation
    let mut fees = Vec::new(env);
    fees.push_back(10);    // 0.1% extra at 10%+
    fees.push_back(25);    // 0.25% extra at 20%+
    fees.push_back(50);    // 0.5% extra at 30%+
    fees.push_back(100);   // 1% extra at 40%+ (MAX CAP)

    let config = AntiWhaleConfig {
        absolute_max_holdings_bps: 5000,  // 50% absolute max (generous - let whales help graduation)
        tier_thresholds: thresholds,
        tier_fees: fees,
        cooldown_seconds: 10,  // 10 seconds between buys (reduced from 15)
        enabled: true,
    };

    env.storage().instance().set(&AntiWhaleKey::Config, &config);
}

/// Get current anti-whale configuration
pub fn get_config(env: &Env) -> AntiWhaleConfig {
    env.storage()
        .instance()
        .get(&AntiWhaleKey::Config)
        .unwrap_or_else(|| {
            // Return a minimal default if not initialized
            AntiWhaleConfig {
                absolute_max_holdings_bps: 5000,  // 50% max
                tier_thresholds: Vec::new(env),
                tier_fees: Vec::new(env),
                cooldown_seconds: 10,
                enabled: true,
            }
        })
}

/// Set anti-whale configuration (Owner or FeeAdmin only)
pub fn set_config(
    env: &Env,
    admin: &Address,
    config: AntiWhaleConfig,
) -> Result<(), Error> {
    admin.require_auth();

    // Only Owner or FeeAdmin can configure
    if !access_control::has_role(env, admin, access_control::Role::Owner)
        && !access_control::has_role(env, admin, access_control::Role::FeeAdmin)
    {
        return Err(Error::Unauthorized);
    }

    // Validate config
    if config.absolute_max_holdings_bps <= 0 || config.absolute_max_holdings_bps > 10000 {
        return Err(Error::InvalidAmount);
    }

    // Validate tiers are in ascending order and fees are reasonable
    let thresholds = &config.tier_thresholds;
    let fees = &config.tier_fees;

    if thresholds.len() != fees.len() {
        return Err(Error::InvalidAmount);
    }

    let mut prev_threshold: i128 = 0;
    for i in 0..thresholds.len() {
        let threshold = thresholds.get(i).unwrap_or(0);
        let fee = fees.get(i).unwrap_or(0);

        if threshold <= prev_threshold {
            return Err(Error::InvalidAmount); // Must be ascending
        }
        if fee < 0 || fee > 5000 {
            return Err(Error::InvalidAmount); // Max 50% fee per tier
        }
        prev_threshold = threshold;
    }

    env.storage().instance().set(&AntiWhaleKey::Config, &config);
    Ok(())
}

/// Get wallet's current holdings for a token (tracked by contract)
pub fn get_wallet_holdings(env: &Env, wallet: &Address) -> i128 {
    env.storage()
        .persistent()
        .get(&AntiWhaleKey::WalletHoldings(wallet.clone()))
        .unwrap_or(0)
}

/// Update wallet holdings after a trade
pub fn update_wallet_holdings(env: &Env, wallet: &Address, new_balance: i128) {
    let key = AntiWhaleKey::WalletHoldings(wallet.clone());
    env.storage().persistent().set(&key, &new_balance);

    // Extend TTL to 30 days
    env.storage().persistent().extend_ttl(&key, 518_400, 518_400);
}

/// Get last buy timestamp for a wallet
pub fn get_last_buy_time(env: &Env, wallet: &Address) -> u64 {
    env.storage()
        .persistent()
        .get(&AntiWhaleKey::LastBuyTime(wallet.clone()))
        .unwrap_or(0)
}

/// Update last buy timestamp
pub fn set_last_buy_time(env: &Env, wallet: &Address, timestamp: u64) {
    let key = AntiWhaleKey::LastBuyTime(wallet.clone());
    env.storage().persistent().set(&key, &timestamp);

    // Extend TTL to 7 days
    env.storage().persistent().extend_ttl(&key, 120_960, 120_960);
}

/// Calculate the extra fee based on holdings percentage after purchase
///
/// Uses tier system where fee increases with holdings:
/// - Find the tier where new_holdings_bps falls
/// - Return the corresponding extra fee
fn calculate_progressive_fee(config: &AntiWhaleConfig, new_holdings_bps: i128) -> i128 {
    let thresholds = &config.tier_thresholds;
    let fees = &config.tier_fees;

    // Find the highest tier that the holdings exceed
    let mut extra_fee: i128 = 0;

    for i in 0..thresholds.len() {
        let threshold = thresholds.get(i).unwrap_or(0);
        if new_holdings_bps >= threshold {
            extra_fee = fees.get(i).unwrap_or(0);
        } else {
            break;
        }
    }

    extra_fee
}

/// Validate a buy transaction against anti-whale rules
///
/// # Arguments
/// * `env` - Contract environment
/// * `buyer` - Address attempting to buy
/// * `tokens_to_buy` - Number of tokens being purchased
/// * `total_supply` - Total token supply
///
/// # Returns
/// * `AntiWhaleResult` - Validation result with extra fees if applicable
///
/// # Note
/// This should ONLY be called during bonding curve phase.
/// After graduation, anti-whale does not apply.
pub fn validate_buy(
    env: &Env,
    buyer: &Address,
    tokens_to_buy: i128,
    _circulating_supply: i128,  // Kept for API compatibility
    total_supply: i128,
) -> AntiWhaleResult {
    let config = get_config(env);

    // If anti-whale is disabled, allow everything
    if !config.enabled {
        return AntiWhaleResult {
            allowed: true,
            extra_fee_bps: 0,
            reason: None,
        };
    }

    // 1. Check cooldown period
    let current_time = env.ledger().timestamp();
    let last_buy = get_last_buy_time(env, buyer);

    if config.cooldown_seconds > 0 && last_buy > 0 {
        let time_since_last = current_time.saturating_sub(last_buy);
        if time_since_last < config.cooldown_seconds {
            return AntiWhaleResult {
                allowed: false,
                extra_fee_bps: 0,
                reason: Some("Cooldown period not elapsed"),
            };
        }
    }

    // 2. Calculate new holdings percentage
    let current_holdings = get_wallet_holdings(env, buyer);
    let new_holdings = current_holdings.saturating_add(tokens_to_buy);

    // Calculate holdings as basis points of total supply
    let new_holdings_bps = new_holdings
        .checked_mul(10_000)
        .and_then(|v| v.checked_div(total_supply))
        .unwrap_or(10_000);

    // 3. Check absolute maximum (hard cap at 50%)
    if new_holdings_bps > config.absolute_max_holdings_bps {
        return AntiWhaleResult {
            allowed: false,
            extra_fee_bps: 0,
            reason: Some("Exceeds absolute max holdings (50%)"),
        };
    }

    // 4. Calculate progressive fee based on new holdings tier
    let extra_fee_bps = calculate_progressive_fee(&config, new_holdings_bps);

    AntiWhaleResult {
        allowed: true,
        extra_fee_bps,
        reason: None,
    }
}

/// Record a successful buy (update tracking data)
pub fn record_buy(env: &Env, buyer: &Address, tokens_bought: i128) {
    // Update holdings
    let current = get_wallet_holdings(env, buyer);
    let new_balance = current.saturating_add(tokens_bought);
    update_wallet_holdings(env, buyer, new_balance);

    // Update last buy time
    set_last_buy_time(env, buyer, env.ledger().timestamp());
}

/// Record a successful sell (update tracking data)
pub fn record_sell(env: &Env, seller: &Address, tokens_sold: i128) {
    // Update holdings
    let current = get_wallet_holdings(env, seller);
    let new_balance = current.saturating_sub(tokens_sold).max(0);
    update_wallet_holdings(env, seller, new_balance);
}

/// Check if anti-whale is enabled
pub fn is_enabled(env: &Env) -> bool {
    get_config(env).enabled
}

/// Enable or disable anti-whale protection (Owner only)
pub fn set_enabled(env: &Env, admin: &Address, enabled: bool) -> Result<(), Error> {
    admin.require_auth();

    // Only Owner can toggle
    access_control::require_role(env, admin, access_control::Role::Owner)?;

    let mut config = get_config(env);
    config.enabled = enabled;
    env.storage().instance().set(&AntiWhaleKey::Config, &config);

    Ok(())
}

/// Get the fee tier info for display purposes
/// Returns: (holdings_bps, extra_fee_bps) for each tier
pub fn get_fee_tiers(env: &Env) -> Vec<(i128, i128)> {
    let config = get_config(env);
    let mut tiers = Vec::new(env);

    for i in 0..config.tier_thresholds.len() {
        let threshold = config.tier_thresholds.get(i).unwrap_or(0);
        let fee = config.tier_fees.get(i).unwrap_or(0);
        tiers.push_back((threshold, fee));
    }

    tiers
}
