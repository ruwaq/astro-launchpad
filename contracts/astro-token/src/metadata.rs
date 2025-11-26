//! Metadata management for ASTRO Token

use soroban_sdk::{Env, String};
use crate::storage::DataKey;

/// Write token metadata
pub fn write_metadata(env: &Env, decimal: u32, name: String, symbol: String) {
    env.storage().instance().set(&DataKey::Decimals, &decimal);
    env.storage().instance().set(&DataKey::Name, &name);
    env.storage().instance().set(&DataKey::Symbol, &symbol);
}

/// Read token decimals
pub fn read_decimal(env: &Env) -> u32 {
    env.storage().instance().get(&DataKey::Decimals).unwrap_or(7)
}

/// Read token name
pub fn read_name(env: &Env) -> String {
    env.storage()
        .instance()
        .get(&DataKey::Name)
        .unwrap_or_else(|| String::from_str(env, "Astro Shiba"))
}

/// Read token symbol
pub fn read_symbol(env: &Env) -> String {
    env.storage()
        .instance()
        .get(&DataKey::Symbol)
        .unwrap_or_else(|| String::from_str(env, "ASTRO"))
}
