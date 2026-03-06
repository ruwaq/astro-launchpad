//! Reentrancy Guard for AMM Pair Contract
//!
//! Re-exports from astro-core-shared with local error conversion.
//!
//! The reentrancy guard ensures that critical functions cannot be called
//! recursively through external contract calls.

use crate::errors::Error;
use soroban_sdk::Env;

/// RAII guard that automatically releases the lock when dropped
///
/// This wraps astro-core's SimpleReentrancyGuard with local error conversion.
pub struct ReentrancyGuard<'a> {
    inner: astro_core_shared::reentrancy::SimpleReentrancyGuard<'a>,
}

impl<'a> ReentrancyGuard<'a> {
    /// Create a new reentrancy guard and acquire the lock
    ///
    /// # Errors
    /// Returns `Error::Reentrancy` if a lock is already held (reentrancy attack)
    pub fn new(env: &'a Env) -> Result<Self, Error> {
        let inner = astro_core_shared::reentrancy::SimpleReentrancyGuard::acquire(env)
            .map_err(|_| Error::Reentrancy)?;
        Ok(Self { inner })
    }
}

// Note: Drop is handled by the inner guard - lock is automatically released

// Legacy functions for backwards compatibility
// These are no longer needed but kept for reference

/// Check if the contract is currently locked (in a critical section)
#[allow(dead_code)]
pub fn is_locked(env: &Env) -> bool {
    use soroban_sdk::{symbol_short, Symbol};
    const LOCK_KEY: Symbol = symbol_short!("LOCK");
    env.storage()
        .temporary()
        .get(&LOCK_KEY)
        .unwrap_or(false)
}

/// Acquire the reentrancy lock (legacy - prefer ReentrancyGuard::new)
#[allow(dead_code)]
pub fn acquire_lock(env: &Env) -> Result<(), Error> {
    use soroban_sdk::{symbol_short, Symbol};
    const LOCK_KEY: Symbol = symbol_short!("LOCK");
    if is_locked(env) {
        return Err(Error::Reentrancy);
    }
    env.storage().temporary().set(&LOCK_KEY, &true);
    Ok(())
}

/// Release the reentrancy lock (legacy - prefer RAII guard)
#[allow(dead_code)]
pub fn release_lock(env: &Env) {
    use soroban_sdk::{symbol_short, Symbol};
    const LOCK_KEY: Symbol = symbol_short!("LOCK");
    env.storage().temporary().remove(&LOCK_KEY);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_error_code() {
        // Verify error code matches expected value
        assert_eq!(Error::Reentrancy as u32, 51);
    }
}
