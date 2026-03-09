//! Storage module for SAC Factory
//!
//! Storage Type Strategy (Stellar Best Practices):
//! - Instance: Small, frequently accessed config (< 100KB) - Admin, Treasury, TokenCount
//! - Persistent: User/token specific data (unbounded, separate keys) - TokenInfo, CreatorTokens
//! - Temporary: Time-bound data (not used yet, reserved for future features)

#![allow(dead_code)] // Config helpers for future features (views, oracle, bridge)

use soroban_sdk::{contracttype, Address, Env, Vec};
use crate::bonding_curve::BondingCurve;

/// Storage keys for Instance storage (small, frequently accessed)
#[contracttype]
#[derive(Clone)]
pub enum InstanceKey {
    Admin,
    Treasury,
    TokenCount,
    AmmWasmHash,           // WASM hash for AMM pair contract deployment
    OracleAddress,         // DIA Oracle contract address for price feeds
    MinMarketCapUsd,       // Minimum market cap in USD (18 decimals) for graduation
    GraduationThreshold,   // Configurable graduation threshold in stroops
    XlmTokenAddress,       // Native XLM SAC address (network-specific)
    OraclePriceMaxAge,     // Max age for oracle price staleness check (seconds)
    // ASTRO Token Integration
    AstroTokenAddress,     // ASTRO protocol token address
    AstroLiquidityBps,     // Basis points for ASTRO liquidity (default: 1000 = 10%)
    AstroBuybackBps,       // Basis points for buyback & burn (default: 500 = 5%)
    AstroAmmAddress,       // Pre-deployed ASTRO/XLM AMM for swaps
    // DEX Bridge Integration
    BridgeAddress,         // AstroSwap Bridge address for graduation to DEX
    UseBridgeForGraduation, // Whether to use Bridge (true) or local AMM (false)
    // Launchpad Token WASM (Pure Soroban tokens, not SAC)
    TokenWasmHash,         // WASM hash for launchpad token contract deployment
    // SECURITY: Track total locked XLM to protect bonding curve reserves
    TotalLockedXlm,        // Total XLM locked in active bonding curves (cannot be withdrawn)
}

/// Storage keys for Persistent storage (unbounded, per-entity)
#[contracttype]
#[derive(Clone)]
pub enum PersistentKey {
    TokenInfo(Address),           // token_address -> TokenInfo
    CreatorTokens(Address),       // creator -> Vec<token_addresses>
    AmmPairAddress(Address),      // token_address -> XLM/TOKEN amm_pair_address (primary pool)
    AstroAmmPairAddress(Address), // token_address -> ASTRO/TOKEN amm_pair_address (ecosystem pool)
}

/// Token status
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum TokenStatus {
    Bonding,             // In bonding curve phase
    GraduationInProgress, // Graduation in progress (prevents race conditions)
    Graduated,           // Successfully moved to AMM
    GraduationFailed,    // Graduation attempt failed (requires recovery)
}

/// Token information
#[contracttype]
#[derive(Clone)]
pub struct TokenInfo {
    pub id: u32,
    pub creator: Address,
    pub token_address: Address,
    pub name: soroban_sdk::String,
    pub symbol: soroban_sdk::String,
    pub issuer: soroban_sdk::String,  // Asset issuer public key (G...) for trustline creation
    pub image_url: soroban_sdk::String,
    pub description: soroban_sdk::String,
    pub created_at: u64,
    pub status: TokenStatus,
    pub bonding_curve: BondingCurve,
    pub xlm_raised: i128,
    pub market_cap: i128,
    pub holders_count: u32,
}

// ========== Instance Storage (Small, Frequent Access) ==========

pub fn has_admin(env: &Env) -> bool {
    env.storage().instance().has(&InstanceKey::Admin)
}

pub fn get_admin(env: &Env) -> Address {
    env.storage().instance().get(&InstanceKey::Admin).unwrap()
}

pub fn set_admin(env: &Env, admin: &Address) {
    env.storage().instance().set(&InstanceKey::Admin, admin);
}

pub fn get_treasury(env: &Env) -> Address {
    env.storage().instance().get(&InstanceKey::Treasury).unwrap()
}

pub fn set_treasury(env: &Env, treasury: &Address) {
    env.storage().instance().set(&InstanceKey::Treasury, treasury);
}

pub fn get_token_count(env: &Env) -> u32 {
    env.storage().instance().get(&InstanceKey::TokenCount).unwrap_or(0)
}

pub fn set_token_count(env: &Env, count: u32) {
    env.storage().instance().set(&InstanceKey::TokenCount, &count);
}

pub fn increment_token_count(env: &Env) {
    let count = get_token_count(env);
    set_token_count(env, count.saturating_add(1));
}

pub fn get_oracle_address(env: &Env) -> Option<Address> {
    env.storage().instance().get(&InstanceKey::OracleAddress)
}

pub fn set_oracle_address(env: &Env, oracle: &Address) {
    env.storage().instance().set(&InstanceKey::OracleAddress, oracle);
}

pub fn get_min_market_cap_usd(env: &Env) -> u128 {
    env.storage()
        .instance()
        .get(&InstanceKey::MinMarketCapUsd)
        .unwrap_or(0u128) // Default: no minimum
}

pub fn set_min_market_cap_usd(env: &Env, min_market_cap: u128) {
    env.storage()
        .instance()
        .set(&InstanceKey::MinMarketCapUsd, &min_market_cap);
}

/// Default graduation threshold: 34,500 XLM in stroops
/// 34,500 XLM = 345_000_000_000 stroops (34500 * 10^7)
/// Market cap = xlm_raised * 2, so 34,500 XLM raised → 69,000 XLM market cap (~$69k)
const DEFAULT_GRADUATION_THRESHOLD: i128 = 345_000_000_000;

// ========== Token WASM Hash (for pure Soroban token deployment) ==========

pub fn has_token_wasm_hash(env: &Env) -> bool {
    env.storage().instance().has(&InstanceKey::TokenWasmHash)
}

pub fn get_token_wasm_hash(env: &Env) -> soroban_sdk::BytesN<32> {
    env.storage().instance().get(&InstanceKey::TokenWasmHash).unwrap()
}

pub fn set_token_wasm_hash(env: &Env, wasm_hash: &soroban_sdk::BytesN<32>) {
    env.storage().instance().set(&InstanceKey::TokenWasmHash, wasm_hash);
}

pub fn get_graduation_threshold(env: &Env) -> i128 {
    env.storage()
        .instance()
        .get(&InstanceKey::GraduationThreshold)
        .unwrap_or(DEFAULT_GRADUATION_THRESHOLD)
}

pub fn set_graduation_threshold(env: &Env, threshold: i128) {
    env.storage()
        .instance()
        .set(&InstanceKey::GraduationThreshold, &threshold);
}

// ========== Total Locked XLM (Security: Protect Bonding Curve Reserves) ==========

/// Get total XLM locked in active bonding curves
/// This amount CANNOT be withdrawn via withdraw_fees
pub fn get_total_locked_xlm(env: &Env) -> i128 {
    env.storage()
        .instance()
        .get(&InstanceKey::TotalLockedXlm)
        .unwrap_or(0)
}

/// Increase total locked XLM (called on buy)
pub fn add_locked_xlm(env: &Env, amount: i128) {
    let current = get_total_locked_xlm(env);
    let new_total = current.saturating_add(amount);
    env.storage()
        .instance()
        .set(&InstanceKey::TotalLockedXlm, &new_total);
}

/// Decrease total locked XLM (called on sell)
pub fn sub_locked_xlm(env: &Env, amount: i128) {
    let current = get_total_locked_xlm(env);
    let new_total = current.saturating_sub(amount).max(0);
    env.storage()
        .instance()
        .set(&InstanceKey::TotalLockedXlm, &new_total);
}

/// Release locked XLM on graduation (liquidity moves to AMM)
pub fn release_locked_xlm(env: &Env, amount: i128) {
    sub_locked_xlm(env, amount);
}

// ========== Persistent Storage (Unbounded, Per-Entity) ==========

/// Get token info (returns None if not found)
pub fn get_token_info(env: &Env, token: &Address) -> Option<TokenInfo> {
    env.storage()
        .persistent()
        .get(&PersistentKey::TokenInfo(token.clone()))
}

/// Set token info with 30-day TTL extension
pub fn set_token_info(env: &Env, token: &Address, info: &TokenInfo) {
    let key = PersistentKey::TokenInfo(token.clone());
    env.storage().persistent().set(&key, info);

    // Extend TTL to 30 days (measured in ledgers, ~5 seconds per ledger)
    // 30 days = 30 * 24 * 60 * 60 / 5 = 518,400 ledgers
    env.storage().persistent().extend_ttl(&key, 518_400, 518_400);
}

/// Get creator's tokens (returns empty Vec if none)
pub fn get_creator_tokens(env: &Env, creator: &Address) -> Vec<Address> {
    env.storage()
        .persistent()
        .get(&PersistentKey::CreatorTokens(creator.clone()))
        .unwrap_or(Vec::new(env))
}

/// Add token to creator's list
pub fn add_creator_token(env: &Env, creator: &Address, token: &Address) {
    let mut tokens = get_creator_tokens(env, creator);
    tokens.push_back(token.clone());

    let key = PersistentKey::CreatorTokens(creator.clone());
    env.storage().persistent().set(&key, &tokens);

    // Extend TTL to 30 days
    env.storage().persistent().extend_ttl(&key, 518_400, 518_400);
}

/// Get paginated creator tokens (DoS prevention)
pub fn get_creator_tokens_paginated(
    env: &Env,
    creator: &Address,
    offset: u32,
    limit: u32,
) -> Vec<Address> {
    let all_tokens = get_creator_tokens(env, creator);
    let len = all_tokens.len();

    if offset >= len {
        return Vec::new(env);
    }

    let end = offset.saturating_add(limit).min(len).min(offset.saturating_add(100)); // Max 100 per page
    let start = offset;

    let mut result = Vec::new(env);
    for i in start..end {
        if let Some(token) = all_tokens.get(i) {
            result.push_back(token);
        }
    }

    result
}

// ========== XLM Token Address (Network-Specific) ==========

/// Get native XLM token address (must be set during initialization)
pub fn get_xlm_token_address(env: &Env) -> Option<Address> {
    env.storage().instance().get(&InstanceKey::XlmTokenAddress)
}

/// Set native XLM token address (called once during initialization)
pub fn set_xlm_token_address(env: &Env, address: &Address) {
    env.storage().instance().set(&InstanceKey::XlmTokenAddress, address);
}

/// Check if XLM token address is configured
pub fn has_xlm_token_address(env: &Env) -> bool {
    env.storage().instance().has(&InstanceKey::XlmTokenAddress)
}

// ========== Oracle Configuration ==========

/// Default max age for oracle prices: 5 minutes in seconds
/// Reduced from 3600 (1 hour) to 300 (5 min) for security (VULN #H3)
/// XLM/USD can fluctuate significantly in 1 hour, risking graduation with stale prices
const DEFAULT_ORACLE_PRICE_MAX_AGE: u64 = 300;

/// Get oracle price max age (staleness threshold)
pub fn get_oracle_price_max_age(env: &Env) -> u64 {
    env.storage()
        .instance()
        .get(&InstanceKey::OraclePriceMaxAge)
        .unwrap_or(DEFAULT_ORACLE_PRICE_MAX_AGE)
}

/// Set oracle price max age
pub fn set_oracle_price_max_age(env: &Env, max_age: u64) {
    env.storage()
        .instance()
        .set(&InstanceKey::OraclePriceMaxAge, &max_age);
}

// ========== ASTRO Token Integration ==========

/// Default ASTRO liquidity allocation: 10% = 1000 basis points
const DEFAULT_ASTRO_LIQUIDITY_BPS: i128 = 1000;

/// Default ASTRO buyback allocation: 5% = 500 basis points
const DEFAULT_ASTRO_BUYBACK_BPS: i128 = 500;

/// Get ASTRO token address
pub fn get_astro_token_address(env: &Env) -> Option<Address> {
    env.storage().instance().get(&InstanceKey::AstroTokenAddress)
}

/// Set ASTRO token address
pub fn set_astro_token_address(env: &Env, address: &Address) {
    env.storage().instance().set(&InstanceKey::AstroTokenAddress, address);
}

/// Check if ASTRO token is configured
pub fn has_astro_token_address(env: &Env) -> bool {
    env.storage().instance().has(&InstanceKey::AstroTokenAddress)
}

/// Get ASTRO liquidity basis points (default 10%)
pub fn get_astro_liquidity_bps(env: &Env) -> i128 {
    env.storage()
        .instance()
        .get(&InstanceKey::AstroLiquidityBps)
        .unwrap_or(DEFAULT_ASTRO_LIQUIDITY_BPS)
}

/// Set ASTRO liquidity basis points
pub fn set_astro_liquidity_bps(env: &Env, bps: i128) {
    env.storage()
        .instance()
        .set(&InstanceKey::AstroLiquidityBps, &bps);
}

/// Get ASTRO buyback basis points (default 5%)
pub fn get_astro_buyback_bps(env: &Env) -> i128 {
    env.storage()
        .instance()
        .get(&InstanceKey::AstroBuybackBps)
        .unwrap_or(DEFAULT_ASTRO_BUYBACK_BPS)
}

/// Set ASTRO buyback basis points
pub fn set_astro_buyback_bps(env: &Env, bps: i128) {
    env.storage()
        .instance()
        .set(&InstanceKey::AstroBuybackBps, &bps);
}

/// Get ASTRO AMM address (for XLM/ASTRO swaps)
pub fn get_astro_amm_address(env: &Env) -> Option<Address> {
    env.storage().instance().get(&InstanceKey::AstroAmmAddress)
}

/// Set ASTRO AMM address
pub fn set_astro_amm_address(env: &Env, address: &Address) {
    env.storage().instance().set(&InstanceKey::AstroAmmAddress, address);
}

/// Clear ASTRO token address (disables ASTRO integration)
pub fn clear_astro_token_address(env: &Env) {
    env.storage().instance().remove(&InstanceKey::AstroTokenAddress);
}

/// Clear ASTRO AMM address
pub fn clear_astro_amm_address(env: &Env) {
    env.storage().instance().remove(&InstanceKey::AstroAmmAddress);
}

/// Clear all ASTRO configuration (disables ASTRO integration)
pub fn clear_astro_config(env: &Env) {
    clear_astro_token_address(env);
    clear_astro_amm_address(env);
    // Also clear the basis points to reset to defaults
    env.storage().instance().remove(&InstanceKey::AstroLiquidityBps);
    env.storage().instance().remove(&InstanceKey::AstroBuybackBps);
}

/// ASTRO integration configuration
#[contracttype]
#[derive(Clone, Debug)]
pub struct AstroConfig {
    pub token_address: Address,
    pub amm_address: Address,
    pub liquidity_bps: i128,
    pub buyback_bps: i128,
}

/// Get full ASTRO configuration (returns None if not configured)
pub fn get_astro_config(env: &Env) -> Option<AstroConfig> {
    let token_address = get_astro_token_address(env)?;
    let amm_address = get_astro_amm_address(env)?;

    Some(AstroConfig {
        token_address,
        amm_address,
        liquidity_bps: get_astro_liquidity_bps(env),
        buyback_bps: get_astro_buyback_bps(env),
    })
}

// ========== DEX Bridge Integration ==========

/// Get DEX Bridge address
pub fn get_bridge_address(env: &Env) -> Option<Address> {
    env.storage().instance().get(&InstanceKey::BridgeAddress)
}

/// Set DEX Bridge address
pub fn set_bridge_address(env: &Env, address: &Address) {
    env.storage().instance().set(&InstanceKey::BridgeAddress, address);
}

/// Check if Bridge is configured
pub fn has_bridge_address(env: &Env) -> bool {
    env.storage().instance().has(&InstanceKey::BridgeAddress)
}

/// Get whether to use Bridge for graduation (default: false for backwards compatibility)
pub fn use_bridge_for_graduation(env: &Env) -> bool {
    env.storage()
        .instance()
        .get(&InstanceKey::UseBridgeForGraduation)
        .unwrap_or(false)
}

/// Set whether to use Bridge for graduation
pub fn set_use_bridge_for_graduation(env: &Env, use_bridge: bool) {
    env.storage()
        .instance()
        .set(&InstanceKey::UseBridgeForGraduation, &use_bridge);
}

/// Bridge configuration
#[contracttype]
#[derive(Clone, Debug)]
pub struct BridgeConfig {
    pub bridge_address: Address,
    pub enabled: bool,
}

/// Get full Bridge configuration (returns None if not configured)
pub fn get_bridge_config(env: &Env) -> Option<BridgeConfig> {
    let bridge_address = get_bridge_address(env)?;

    Some(BridgeConfig {
        bridge_address,
        enabled: use_bridge_for_graduation(env),
    })
}
