//! Admin management for ASTRO Token

use soroban_sdk::{Address, Env};
use crate::storage;

/// Read the current administrator
pub fn read_administrator(env: &Env) -> Address {
    storage::get_admin(env)
}

/// Write a new administrator
pub fn write_administrator(env: &Env, admin: &Address) {
    storage::set_admin(env, admin);
}
