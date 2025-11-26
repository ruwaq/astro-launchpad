//! # Storage Key Types
//!
//! Common storage key patterns for contracts.

use soroban_sdk::{contracttype, Address};

/// Common instance storage keys
#[contracttype]
#[derive(Clone, Debug)]
pub enum CommonInstanceKey {
    /// Admin address
    Admin,
    /// Owner address (if different from admin)
    Owner,
    /// Whether contract is initialized
    Initialized,
    /// Whether contract is paused
    Paused,
    /// Contract version for upgrades
    Version,
}

/// Common persistent storage keys
#[contracttype]
#[derive(Clone, Debug)]
pub enum CommonPersistentKey {
    /// Per-user data
    UserData(Address),
    /// Per-token data
    TokenData(Address),
    /// Nonce for replay protection
    Nonce(Address),
}

/// TTL constants for storage management
pub mod ttl {
    /// Threshold to trigger TTL extension for instance storage
    pub const INSTANCE_TTL_THRESHOLD: u32 = 100;
    /// TTL extension amount for instance storage
    pub const INSTANCE_TTL_EXTEND: u32 = 100_000;

    /// Threshold to trigger TTL extension for persistent storage
    pub const PERSISTENT_TTL_THRESHOLD: u32 = 1_000;
    /// TTL extension amount for persistent storage
    pub const PERSISTENT_TTL_EXTEND: u32 = 200_000;

    /// Threshold for temporary storage
    pub const TEMPORARY_TTL_THRESHOLD: u32 = 100;
    /// TTL extension for temporary storage
    pub const TEMPORARY_TTL_EXTEND: u32 = 1_000;
}

/// Helper to extend instance storage TTL
pub fn extend_instance_ttl(env: &soroban_sdk::Env) {
    env.storage().instance().extend_ttl(
        ttl::INSTANCE_TTL_THRESHOLD,
        ttl::INSTANCE_TTL_EXTEND,
    );
}

/// Helper to extend persistent storage TTL
pub fn extend_persistent_ttl<K: soroban_sdk::TryFromVal<soroban_sdk::Env, soroban_sdk::Val> + soroban_sdk::IntoVal<soroban_sdk::Env, soroban_sdk::Val>>(
    env: &soroban_sdk::Env,
    key: &K,
) {
    env.storage().persistent().extend_ttl(
        key,
        ttl::PERSISTENT_TTL_THRESHOLD,
        ttl::PERSISTENT_TTL_EXTEND,
    );
}
