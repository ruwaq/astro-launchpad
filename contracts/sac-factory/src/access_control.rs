//! Role-Based Access Control (RBAC)
//!
//! Implements granular permission system for contract administration.
//! Inspired by Aquarius AMM access control patterns.

#![allow(dead_code)] // Some role checks not yet used in main contract

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

/// Check if address has any of the specified roles
///
/// Returns true if the address has AT LEAST ONE of the roles.
pub fn has_any_role(env: &Env, account: &Address, roles: &[Role]) -> bool {
    for role in roles {
        if has_role(env, account, *role) {
            return true;
        }
    }
    false
}

/// Require that address has at least one of the specified roles
pub fn require_any_role(env: &Env, account: &Address, roles: &[Role]) -> Result<(), Error> {
    if !has_any_role(env, account, roles) {
        return Err(Error::Unauthorized);
    }
    Ok(())
}

/// Check if address has ALL of the specified roles
pub fn has_all_roles(env: &Env, account: &Address, roles: &[Role]) -> bool {
    for role in roles {
        if !has_role(env, account, *role) {
            return false;
        }
    }
    true
}

/// Batch grant multiple roles to an address
///
/// Only Owner can do this.
pub fn grant_roles_batch(
    env: &Env,
    granter: &Address,
    account: &Address,
    roles: &[Role],
) -> Result<(), Error> {
    granter.require_auth();
    require_role(env, granter, Role::Owner)?;

    for role in roles {
        let key = AccessControlKey::Role(account.clone(), *role);
        env.storage().persistent().set(&key, &true);
        events::role_granted(env, account, *role);
    }

    Ok(())
}

/// Batch revoke multiple roles from an address
///
/// Only Owner can do this.
pub fn revoke_roles_batch(
    env: &Env,
    revoker: &Address,
    account: &Address,
    roles: &[Role],
) -> Result<(), Error> {
    revoker.require_auth();
    require_role(env, revoker, Role::Owner)?;

    for role in roles {
        // Cannot revoke Owner from themselves
        if *role == Role::Owner && account == revoker {
            return Err(Error::CannotRevokeOwnOwnership);
        }

        let key = AccessControlKey::Role(account.clone(), *role);
        env.storage().persistent().remove(&key);
        events::role_revoked(env, account, *role);
    }

    Ok(())
}

/// Get human-readable role description
pub fn get_role_description(role: Role) -> &'static str {
    match role {
        Role::Owner => "Owner - Full control over all contract functions",
        Role::PauseAdmin => "Pause Admin - Can pause/unpause contract",
        Role::TreasuryAdmin => "Treasury Admin - Can modify treasury address",
        Role::FeeAdmin => "Fee Admin - Can adjust fee parameters",
        Role::EmergencyPauser => "Emergency Pauser - Can trigger emergency pause only",
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Env};

    #[test]
    fn test_has_any_role() {
        let env = Env::default();
        let owner = Address::generate(&env);
        let user = Address::generate(&env);

        env.as_contract(&env.register(crate::SacFactory, ()), || {
            // Initialize
            initialize_access_control(&env, &owner);

            // Owner should have Owner role
            assert!(has_any_role(&env, &owner, &[Role::Owner]));
            assert!(has_any_role(&env, &owner, &[Role::Owner, Role::PauseAdmin]));

            // User should not have any role
            assert!(!has_any_role(&env, &user, &[Role::Owner]));
            assert!(!has_any_role(&env, &user, &[Role::Owner, Role::PauseAdmin]));
        });
    }

    // NOTE: These tests require full contract context for auth checking.
    // The functionality is tested through the contract client interface in src/tests.rs
    // as per Soroban best practices.

    // #[test]
    // fn test_has_all_roles() { ... }
    // Tested via contract client in src/tests.rs

    // #[test]
    // fn test_batch_grant_revoke() { ... }
    // Tested via contract client in src/tests.rs

    #[test]
    fn test_role_descriptions() {
        assert_eq!(get_role_description(Role::Owner), "Owner - Full control over all contract functions");
        assert_eq!(get_role_description(Role::PauseAdmin), "Pause Admin - Can pause/unpause contract");
    }
}

// Tests for access control integration are in src/tests.rs
// Per Soroban best practices, internal module functions should only be tested
// through the contract client interface, not directly.
