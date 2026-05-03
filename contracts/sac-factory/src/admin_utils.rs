//! Admin authorization helpers
//!
//! Extracts repeated `require_auth() + require_role()` pattern
//! into reusable, type-safe helpers.

use crate::access_control::{has_role, Role};
use crate::errors::Error;
use soroban_sdk::{Address, Env};

/// Require that `account` has authenticated AND has any of the given `roles`.
///
/// This is the unified authorization helper used by all fee-management,
/// state-management, and access-control operations.
pub fn require_auth_and_any_role(
    env: &Env,
    account: &Address,
    roles: &[Role],
) -> Result<(), Error> {
    account.require_auth();

    let has_any = roles.iter().any(|role| has_role(env, account, *role));
    if !has_any {
        return Err(Error::Unauthorized);
    }
    Ok(())
}

/// Convenience wrapper: require auth + Owner role.
pub fn require_owner(env: &Env, account: &Address) -> Result<(), Error> {
    require_auth_and_any_role(env, account, &[Role::Owner])
}

/// Convenience wrapper: require auth + (FeeAdmin | Owner).
pub fn require_fee_admin(env: &Env, account: &Address) -> Result<(), Error> {
    require_auth_and_any_role(env, account, &[Role::FeeAdmin, Role::Owner])
}

/// Convenience wrapper: require auth + (TreasuryAdmin | Owner).
pub fn require_treasury_admin(env: &Env, account: &Address) -> Result<(), Error> {
    require_auth_and_any_role(env, account, &[Role::TreasuryAdmin, Role::Owner])
}

/// Convenience wrapper: require auth + (PauseAdmin | Owner | EmergencyPauser).
/// Note: EmergencyPauser can ONLY pause, not unpause.
pub fn require_pausable(env: &Env, account: &Address) -> Result<(), Error> {
    account.require_auth();
    if has_role(env, account, Role::PauseAdmin)
        || has_role(env, account, Role::Owner)
        || has_role(env, account, Role::EmergencyPauser)
    {
        return Ok(());
    }
    Err(Error::Unauthorized)
}

/// Convenience wrapper: require auth + (PauseAdmin | Owner).
/// Only Owner or PauseAdmin can unpause.
pub fn require_unpause_admin(env: &Env, account: &Address) -> Result<(), Error> {
    require_auth_and_any_role(env, account, &[Role::PauseAdmin, Role::Owner])
}
