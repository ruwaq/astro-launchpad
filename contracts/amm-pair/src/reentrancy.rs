//! Reentrancy Guard for AMM Pair Contract
//!
//! **Sprint 1 Day 4:** Protection against reentrancy attacks
//!
//! The reentrancy guard ensures that critical functions cannot be called
//! recursively through external contract calls.

use soroban_sdk::{Env, Symbol, symbol_short};

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
/// # Panics
/// Panics if the lock is already acquired (reentrancy detected)
pub fn acquire_lock(env: &Env) {
    if is_locked(env) {
        panic!("reentrancy detected");
    }
    env.storage().temporary().set(&LOCK_KEY, &true);
}

/// Release the reentrancy lock
pub fn release_lock(env: &Env) {
    env.storage().temporary().remove(&LOCK_KEY);
}

/// RAII guard that automatically releases the lock when dropped
///
/// This ensures the lock is always released, even if the function panics.
pub struct ReentrancyGuard<'a> {
    env: &'a Env,
}

impl<'a> ReentrancyGuard<'a> {
    /// Create a new reentrancy guard and acquire the lock
    ///
    /// # Panics
    /// Panics if a lock is already held (reentrancy attack)
    pub fn new(env: &'a Env) -> Self {
        acquire_lock(env);
        Self { env }
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
    use soroban_sdk::Env;

    #[test]
    fn test_lock_acquire_release() {
        let env = Env::default();

        assert!(!is_locked(&env));

        acquire_lock(&env);
        assert!(is_locked(&env));

        release_lock(&env);
        assert!(!is_locked(&env));
    }

    #[test]
    #[should_panic(expected = "reentrancy detected")]
    fn test_double_lock_panics() {
        let env = Env::default();

        acquire_lock(&env);
        acquire_lock(&env); // Should panic
    }

    #[test]
    fn test_guard_auto_release() {
        let env = Env::default();

        {
            let _guard = ReentrancyGuard::new(&env);
            assert!(is_locked(&env));
        } // Guard dropped here

        assert!(!is_locked(&env));
    }
}
