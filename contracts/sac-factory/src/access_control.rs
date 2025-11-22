//! Role-Based Access Control (RBAC)
//!
//! Implements granular permission system for contract administration.
//! Inspired by Aquarius AMM access control patterns.

use soroban_sdk::{contracttype, Address, Env};
use crate::errors::Error;
use crate::events;

/// Available roles in the system
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq, Copy)]
pub enum Role {
    /// Super admin - can do everything
    Owner = 0,
    /// Can pause/unpause contract in emergencies
    PauseAdmin = 1,
    /// Can modify treasury address
    TreasuryAdmin = 2,
    /// Can adjust fee parameters
    FeeAdmin = 3,
    /// Can trigger emergency pause only (no unpause)
    EmergencyPauser = 4,
}

/// Access control storage key
#[derive(Clone)]
#[contracttype]
pub enum AccessControlKey {
    Role(Address, Role),
}

/// Check if an address has a specific role
pub fn has_role(env: &Env, account: &Address, role: Role) -> bool {
    let key = AccessControlKey::Role(account.clone(), role);
    env.storage().persistent().get(&key).unwrap_or(false)
}

/// Require that an address has a specific role, panic otherwise
pub fn require_role(env: &Env, account: &Address, role: Role) -> Result<(), Error> {
    if !has_role(env, account, role) {
        return Err(Error::Unauthorized);
    }
    Ok(())
}

/// Grant a role to an address (only Owner can do this)
pub fn grant_role(env: &Env, granter: &Address, account: &Address, role: Role) -> Result<(), Error> {
    granter.require_auth();

    // Only Owner can grant roles
    require_role(env, granter, Role::Owner)?;

    // Set the role
    let key = AccessControlKey::Role(account.clone(), role);
    env.storage().persistent().set(&key, &true);

    // Emit event
    events::role_granted(env, account, role);

    Ok(())
}

/// Revoke a role from an address (only Owner can do this)
pub fn revoke_role(env: &Env, revoker: &Address, account: &Address, role: Role) -> Result<(), Error> {
    revoker.require_auth();

    // Only Owner can revoke roles
    require_role(env, revoker, Role::Owner)?;

    // Cannot revoke Owner from themselves (safety check)
    if role == Role::Owner && account == revoker {
        return Err(Error::CannotRevokeOwnOwnership);
    }

    // Remove the role
    let key = AccessControlKey::Role(account.clone(), role);
    env.storage().persistent().remove(&key);

    // Emit event
    events::role_revoked(env, account, role);

    Ok(())
}

/// Transfer ownership to a new address
pub fn transfer_ownership(env: &Env, current_owner: &Address, new_owner: &Address) -> Result<(), Error> {
    current_owner.require_auth();

    // Check current owner has Owner role
    require_role(env, current_owner, Role::Owner)?;

    // Revoke from current
    let key_old = AccessControlKey::Role(current_owner.clone(), Role::Owner);
    env.storage().persistent().remove(&key_old);

    // Grant to new
    let key_new = AccessControlKey::Role(new_owner.clone(), Role::Owner);
    env.storage().persistent().set(&key_new, &true);

    // Emit event
    events::ownership_transferred(env, current_owner, new_owner);

    Ok(())
}

/// Initialize access control with initial owner
pub fn initialize_access_control(env: &Env, owner: &Address) {
    let key = AccessControlKey::Role(owner.clone(), Role::Owner);
    env.storage().persistent().set(&key, &true);
}

// Tests for access control are in src/tests.rs
// Per Soroban best practices, internal module functions should only be tested
// through the contract client interface, not directly.
