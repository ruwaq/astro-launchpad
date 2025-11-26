//! Balance management for ASTRO Token

use soroban_sdk::{Address, Env};
use crate::storage::{self, DataKey, BALANCE_BUMP_AMOUNT, BALANCE_LIFETIME_THRESHOLD};

/// Read balance for an address
pub fn read_balance(env: &Env, addr: &Address) -> i128 {
    let key = DataKey::Balance(addr.clone());
    if let Some(balance) = env.storage().persistent().get::<DataKey, i128>(&key) {
        storage::extend_balance_ttl(env, addr);
        balance
    } else {
        0
    }
}

/// Write balance for an address
fn write_balance(env: &Env, addr: &Address, amount: i128) {
    let key = DataKey::Balance(addr.clone());
    env.storage().persistent().set(&key, &amount);
    env.storage()
        .persistent()
        .extend_ttl(&key, BALANCE_LIFETIME_THRESHOLD, BALANCE_BUMP_AMOUNT);
}

/// Receive tokens (add to balance)
pub fn receive_balance(env: &Env, addr: &Address, amount: i128) {
    let balance = read_balance(env, addr);
    write_balance(env, addr, balance + amount);
}

/// Spend tokens (subtract from balance)
pub fn spend_balance(env: &Env, addr: &Address, amount: i128) {
    let balance = read_balance(env, addr);
    if balance < amount {
        panic!("Insufficient balance");
    }
    write_balance(env, addr, balance - amount);
}
