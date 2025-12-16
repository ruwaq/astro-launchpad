//! Reentrancy Guard for AMM Pair Contract
//!
//! **Sprint 1 Day 4:** Protection against reentrancy attacks
//!
//! The reentrancy guard ensures that critical functions cannot be called
//! recursively through external contract calls.
//!
//! **Updated:** Now uses Result instead of panic for better error handling.

use soroban_sdk::{Env, Symbol, symbol_short};
use crate::errors::Error;

/// Storage key for the reentrancy lock
const LOCK_KEY: Symbol = symbol_short!("LOCK");

/// Check if the contract is currently locked (in a critical section)
pub fn is_locked(env: &Env) -> bool {
    env.storage()
        .temporary()
        .get(&LOCK_KEY)
        .unwrap_or(false)
}

/// Acquire the reentrancy lock
///
/// # Errors
/// Returns `Error::Reentrancy` if the lock is already acquired
pub fn acquire_lock(env: &Env) -> Result<(), Error> {
    if is_locked(env) {
        return Err(Error::Reentrancy);
    }
    env.storage().temporary().set(&LOCK_KEY, &true);
    Ok(())
}

/// Release the reentrancy lock
pub fn release_lock(env: &Env) {
    env.storage().temporary().remove(&LOCK_KEY);
}

/// RAII guard that automatically releases the lock when dropped
///
/// This ensures the lock is always released, even if the function returns an error.
pub struct ReentrancyGuard<'a> {
    env: &'a Env,
}

impl<'a> ReentrancyGuard<'a> {
    /// Create a new reentrancy guard and acquire the lock
    ///
    /// # Errors
    /// Returns `Error::Reentrancy` if a lock is already held (reentrancy attack)
    pub fn new(env: &'a Env) -> Result<Self, Error> {
        acquire_lock(env)?;
        Ok(Self { env })
    }
}

impl<'a> Drop for ReentrancyGuard<'a> {
    fn drop(&mut self) {
        release_lock(self.env);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // Note: Full reentrancy tests require contract context
    // These are basic unit tests for the guard logic

    #[test]
    fn test_error_code() {
        // Verify error code matches expected value
        assert_eq!(Error::Reentrancy as u32, 51);
    }
}
