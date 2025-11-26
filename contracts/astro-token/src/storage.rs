//! Storage management for ASTRO Token

use soroban_sdk::{contracttype, Address, Env};

/// Storage keys
#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Admin,
    Balance(Address),
    Allowance(AllowanceKey),
    TotalSupply,
    Decimals,
    Name,
    Symbol,
}

/// Allowance storage key
#[derive(Clone)]
#[contracttype]
pub struct AllowanceKey {
    pub from: Address,
    pub spender: Address,
}

/// Allowance value with expiration
#[derive(Clone)]
#[contracttype]
pub struct AllowanceValue {
    pub amount: i128,
    pub expiration_ledger: u32,
}

/// TTL Constants
pub const INSTANCE_BUMP_AMOUNT: u32 = 7 * 24 * 60 * 60 / 5; // 7 days in ledgers (~5s per ledger)
pub const INSTANCE_LIFETIME_THRESHOLD: u32 = INSTANCE_BUMP_AMOUNT - 24 * 60 * 60 / 5; // 1 day buffer

pub const BALANCE_BUMP_AMOUNT: u32 = 30 * 24 * 60 * 60 / 5; // 30 days
pub const BALANCE_LIFETIME_THRESHOLD: u32 = BALANCE_BUMP_AMOUNT - 7 * 24 * 60 * 60 / 5; // 7 day buffer

// ========== Admin Functions ==========

pub fn has_admin(env: &Env) -> bool {
    env.storage().instance().has(&DataKey::Admin)
}

pub fn get_admin(env: &Env) -> Address {
    env.storage().instance().get(&DataKey::Admin).unwrap()
}

pub fn set_admin(env: &Env, admin: &Address) {
    env.storage().instance().set(&DataKey::Admin, admin);
}

// ========== Total Supply ==========

pub fn get_total_supply(env: &Env) -> i128 {
    env.storage()
        .instance()
        .get(&DataKey::TotalSupply)
        .unwrap_or(0)
}

pub fn set_total_supply(env: &Env, supply: i128) {
    env.storage().instance().set(&DataKey::TotalSupply, &supply);
}

// ========== TTL Extension ==========

pub fn extend_instance_ttl(env: &Env) {
    env.storage()
        .instance()
        .extend_ttl(INSTANCE_LIFETIME_THRESHOLD, INSTANCE_BUMP_AMOUNT);
}

pub fn extend_balance_ttl(env: &Env, address: &Address) {
    let key = DataKey::Balance(address.clone());
    if env.storage().persistent().has(&key) {
        env.storage()
            .persistent()
            .extend_ttl(&key, BALANCE_LIFETIME_THRESHOLD, BALANCE_BUMP_AMOUNT);
    }
}

pub fn extend_allowance_ttl(env: &Env, from: &Address, spender: &Address, expiration_ledger: u32) {
    let key = DataKey::Allowance(AllowanceKey {
        from: from.clone(),
        spender: spender.clone(),
    });

    if env.storage().temporary().has(&key) {
        let current_ledger = env.ledger().sequence();
        if expiration_ledger > current_ledger {
            let live_for = expiration_ledger - current_ledger;
            env.storage().temporary().extend_ttl(&key, live_for, live_for);
        }
    }
}
