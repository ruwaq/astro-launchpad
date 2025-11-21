//! State Management
//!
//! Handles contract lifecycle states including pause/unpause
//! for emergency response.

use soroban_sdk::{contracttype, Address, Env};
use crate::errors::Error;
use crate::access_control::{require_role, Role};
use crate::events;

/// Contract lifecycle states
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq, Copy)]
pub enum ContractState {
    /// Not yet initialized
    Uninitialized = 0,
    /// Normal operation
    Active = 1,
    /// Paused (no new operations)
    Paused = 2,
    /// Migrating to new version
    Migrating = 3,
    /// Deprecated (old version)
    Deprecated = 4,
}

/// Storage key for contract state
#[derive(Clone)]
#[contracttype]
pub enum StateKey {
    State,
}

/// Get current contract state
pub fn get_state(env: &Env) -> ContractState {
    env.storage()
        .persistent()
        .get(&StateKey::State)
        .unwrap_or(ContractState::Uninitialized)
}

/// Set contract state
fn set_state(env: &Env, state: ContractState) {
    env.storage().persistent().set(&StateKey::State, &state);
}

/// Initialize contract state to Active
pub fn initialize_state(env: &Env) {
    set_state(env, ContractState::Active);
}

/// Require contract to be in Active state
pub fn require_active(env: &Env) -> Result<(), Error> {
    let state = get_state(env);
    if state != ContractState::Active {
        return Err(Error::ContractPaused);
    }
    Ok(())
}

/// Require contract to NOT be paused
pub fn require_not_paused(env: &Env) -> Result<(), Error> {
    let state = get_state(env);
    if state == ContractState::Paused {
        return Err(Error::ContractPaused);
    }
    Ok(())
}

/// Pause the contract (PauseAdmin or EmergencyPauser)
pub fn pause(env: &Env, admin: &Address) -> Result<(), Error> {
    admin.require_auth();

    // Check permissions: PauseAdmin, EmergencyPauser, or Owner
    let has_permission = crate::access_control::has_role(env, admin, Role::PauseAdmin)
        || crate::access_control::has_role(env, admin, Role::EmergencyPauser)
        || crate::access_control::has_role(env, admin, Role::Owner);

    if !has_permission {
        return Err(Error::Unauthorized);
    }

    // Check current state
    let current_state = get_state(env);
    if current_state == ContractState::Paused {
        return Err(Error::ContractPaused);
    }

    // Pause
    set_state(env, ContractState::Paused);

    // Emit event
    events::contract_paused(env, admin);

    Ok(())
}

/// Unpause the contract (only Owner or PauseAdmin, NOT EmergencyPauser)
pub fn unpause(env: &Env, admin: &Address) -> Result<(), Error> {
    admin.require_auth();

    // Check permissions: Only Owner or PauseAdmin can unpause
    // EmergencyPauser can ONLY pause, not unpause
    let has_permission = crate::access_control::has_role(env, admin, Role::PauseAdmin)
        || crate::access_control::has_role(env, admin, Role::Owner);

    if !has_permission {
        return Err(Error::Unauthorized);
    }

    // Check current state
    let current_state = get_state(env);
    if current_state != ContractState::Paused {
        return Err(Error::ContractNotPaused);
    }

    // Unpause
    set_state(env, ContractState::Active);

    // Emit event
    events::contract_unpaused(env, admin);

    Ok(())
}

/// Set contract to migrating state (Owner only)
pub fn start_migration(env: &Env, owner: &Address) -> Result<(), Error> {
    owner.require_auth();
    require_role(env, owner, Role::Owner)?;

    set_state(env, ContractState::Migrating);

    Ok(())
}

/// Set contract to deprecated (Owner only)
pub fn deprecate(env: &Env, owner: &Address) -> Result<(), Error> {
    owner.require_auth();
    require_role(env, owner, Role::Owner)?;

    set_state(env, ContractState::Deprecated);

    Ok(())
}

// Tests for state management are in src/tests.rs
// Per Soroban best practices, internal module functions should only be tested
// through the contract client interface, not directly.
