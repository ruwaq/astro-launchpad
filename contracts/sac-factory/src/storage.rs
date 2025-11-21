//! Storage module for SAC Factory
//!
//! Storage Type Strategy (Stellar Best Practices):
//! - Instance: Small, frequently accessed config (< 100KB) - Admin, Treasury, TokenCount
//! - Persistent: User/token specific data (unbounded, separate keys) - TokenInfo, CreatorTokens
//! - Temporary: Time-bound data (not used yet, reserved for future features)

use soroban_sdk::{contracttype, Address, Env, Vec};
use crate::bonding_curve::BondingCurve;

/// Storage keys for Instance storage (small, frequently accessed)
#[contracttype]
#[derive(Clone)]
pub enum InstanceKey {
    Admin,
    Treasury,
    TokenCount,
}

/// Storage keys for Persistent storage (unbounded, per-entity)
#[contracttype]
#[derive(Clone)]
pub enum PersistentKey {
    TokenInfo(Address),        // token_address -> TokenInfo
    CreatorTokens(Address),    // creator -> Vec<token_addresses>
}

/// Token status
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum TokenStatus {
    Bonding,    // In bonding curve phase
    Graduated,  // Moved to AMM
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
