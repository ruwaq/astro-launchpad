//! Allowance management for ASTRO Token

use soroban_sdk::{Address, Env};
use crate::storage::{self, AllowanceKey, AllowanceValue, DataKey};

/// Read allowance for a spender
pub fn read_allowance(env: &Env, from: &Address, spender: &Address) -> AllowanceValue {
    let key = DataKey::Allowance(AllowanceKey {
        from: from.clone(),
        spender: spender.clone(),
    });

    if let Some(allowance) = env.storage().temporary().get::<DataKey, AllowanceValue>(&key) {
        // Check if expired
        if allowance.expiration_ledger < env.ledger().sequence() {
            return AllowanceValue {
                amount: 0,
                expiration_ledger: allowance.expiration_ledger,
            };
        }
        storage::extend_allowance_ttl(env, from, spender, allowance.expiration_ledger);
        allowance
    } else {
        AllowanceValue {
            amount: 0,
            expiration_ledger: 0,
        }
    }
}

/// Write allowance for a spender
pub fn write_allowance(
    env: &Env,
    from: &Address,
    spender: &Address,
    amount: i128,
    expiration_ledger: u32,
) {
    let key = DataKey::Allowance(AllowanceKey {
        from: from.clone(),
        spender: spender.clone(),
    });

    let allowance = AllowanceValue {
        amount,
        expiration_ledger,
    };

    if amount > 0 && expiration_ledger > env.ledger().sequence() {
        let live_for = expiration_ledger - env.ledger().sequence();
        env.storage().temporary().set(&key, &allowance);
        env.storage().temporary().extend_ttl(&key, live_for, live_for);
    } else {
        // Remove allowance if zero or expired
        env.storage().temporary().remove(&key);
    }
}

/// Spend from allowance
pub fn spend_allowance(env: &Env, from: &Address, spender: &Address, amount: i128) {
    let allowance = read_allowance(env, from, spender);

    // Check expiration
    if allowance.expiration_ledger < env.ledger().sequence() {
        panic!("Allowance expired");
    }

    if allowance.amount < amount {
        panic!("Insufficient allowance");
    }

    if amount > 0 {
        write_allowance(
            env,
            from,
            spender,
            allowance.amount - amount,
            allowance.expiration_ledger,
        );
    }
}
