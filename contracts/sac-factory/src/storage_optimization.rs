//! Storage Optimization Module
//!
//! Implements check-before-write pattern to reduce gas costs.
//! Best Practice from Soroban 2026 guidelines:
//! - Never write unchanged values
//! - Check before every storage write
//! - Can reduce costs by 10-20%
//!
//! Reference: https://dev.to/koxy/gas-inefficiencies-developers-dont-notice-until-its-too-late-2m42

use soroban_sdk::Env;

/// Check if value changed before writing to Instance storage
///
/// Usage:
/// ```ignore
/// // Only writes if value changed
/// set_if_changed_instance(env, &InstanceKey::Treasury, &new_treasury);
/// ```
pub fn set_if_changed_instance<K, V>(env: &Env, key: &K, new_value: &V) -> bool
where
    K: soroban_sdk::IntoVal<Env, soroban_sdk::Val> + Clone,
    V: soroban_sdk::TryFromVal<Env, soroban_sdk::Val>
        + soroban_sdk::IntoVal<Env, soroban_sdk::Val>
        + Clone
        + PartialEq,
{
    let old_value: Option<V> = env.storage().instance().get(key);

    // Only write if value changed
    if old_value.as_ref() != Some(new_value) {
        env.storage().instance().set(key, new_value);
        true // Value was written
    } else {
        false // No write needed
    }
}

/// Check if value changed before writing to Persistent storage
pub fn set_if_changed_persistent<K, V>(env: &Env, key: &K, new_value: &V) -> bool
where
    K: soroban_sdk::IntoVal<Env, soroban_sdk::Val> + Clone,
    V: soroban_sdk::TryFromVal<Env, soroban_sdk::Val>
        + soroban_sdk::IntoVal<Env, soroban_sdk::Val>
        + Clone
        + PartialEq,
{
    let old_value: Option<V> = env.storage().persistent().get(key);

    // Only write if value changed
    if old_value.as_ref() != Some(new_value) {
        env.storage().persistent().set(key, new_value);
        true // Value was written
    } else {
        false // No write needed
    }
}

/// Check before remove from Instance storage
pub fn remove_if_exists_instance<K>(env: &Env, key: &K) -> bool
where
    K: soroban_sdk::IntoVal<Env, soroban_sdk::Val> + Clone,
{
    if env.storage().instance().has(key) {
        env.storage().instance().remove(key);
        true // Was removed
    } else {
        false // Already gone
    }
}

/// Check before remove from Persistent storage
pub fn remove_if_exists_persistent<K>(env: &Env, key: &K) -> bool
where
    K: soroban_sdk::IntoVal<Env, soroban_sdk::Val> + Clone,
{
    if env.storage().persistent().has(key) {
        env.storage().persistent().remove(key);
        true // Was removed
    } else {
        false // Already gone
    }
}

// Tests for storage optimization are in src/tests.rs
// Per Soroban best practices, internal module functions should only be tested
// through the contract client interface, not directly.
// The functionality is tested through state_management pause/unpause operations.
