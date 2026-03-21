//! Temporary Storage Optimization Module
//!
//! Soroban Best Practice 2026: Use temporary storage for ephemeral data
//! to reduce costs compared to persistent storage.
//!
//! Temporary storage is cheaper but only lasts for the current ledger.
//! Perfect for:
//! - Transaction-scoped caching
//! - Rate limiting counters
//! - Intermediate calculations
//! - Non-critical state that doesn't need persistence
//!
//! References:
//! - Stellar Docs: https://developers.stellar.org/docs/build/smart-contracts/

use soroban_sdk::{contracttype, Address, Env};

/// Keys for temporary storage
#[contracttype]
#[derive(Clone)]
pub enum TempStorageKey {
    /// Cache key for market cap calculation result
    /// Format: MarketCapCache(token_address, timestamp)
    MarketCapCache(Address, u64),

    /// Rate limiting counter for a specific operation
    /// Format: RateLimit(operation_name, address)
    RateLimit(soroban_sdk::String, Address),

    /// Nonce for preventing replay attacks within same ledger
    /// Format: Nonce(address, operation_id)
    Nonce(Address, u64),

    /// Cache for bonding curve calculation
    /// Format: BondingCurveCache(token_address, xlm_in)
    BondingCurveCache(Address, i128),
}

/// Set a value in temporary storage
///
/// Temporary storage is cheaper than persistent but only lasts for current ledger.
/// Use for data that doesn't need to persist between ledgers.
pub fn set_temp<V>(env: &Env, key: &TempStorageKey, value: &V)
where
    V: soroban_sdk::IntoVal<Env, soroban_sdk::Val>,
{
    env.storage().temporary().set(key, value);
}

/// Get a value from temporary storage
///
/// Returns None if the value doesn't exist or has expired.
pub fn get_temp<V>(env: &Env, key: &TempStorageKey) -> Option<V>
where
    V: soroban_sdk::TryFromVal<Env, soroban_sdk::Val>,
{
    env.storage().temporary().get(key)
}

/// Check if a key exists in temporary storage
pub fn has_temp(env: &Env, key: &TempStorageKey) -> bool {
    env.storage().temporary().has(key)
}

/// Remove a value from temporary storage
pub fn remove_temp(env: &Env, key: &TempStorageKey) {
    env.storage().temporary().remove(key);
}

/// Cache a market cap calculation for the current ledger
///
/// This avoids recalculating market cap multiple times in the same transaction.
pub fn cache_market_cap(env: &Env, token: &Address, market_cap_usd: i128) {
    let timestamp = env.ledger().timestamp();
    let key = TempStorageKey::MarketCapCache(token.clone(), timestamp);
    set_temp(env, &key, &market_cap_usd);
}

/// Get cached market cap if available
///
/// Returns None if not cached or cache is stale.
pub fn get_cached_market_cap(env: &Env, token: &Address) -> Option<i128> {
    let timestamp = env.ledger().timestamp();
    let key = TempStorageKey::MarketCapCache(token.clone(), timestamp);
    get_temp(env, &key)
}

/// Set rate limit counter for an operation
///
/// Use for preventing spam or DoS attacks within a single ledger.
pub fn set_rate_limit_counter(env: &Env, operation: &str, user: &Address, count: u32) {
    let operation_name = soroban_sdk::String::from_str(env, operation);
    let key = TempStorageKey::RateLimit(operation_name, user.clone());
    set_temp(env, &key, &count);
}

/// Get rate limit counter
///
/// Returns 0 if no counter exists.
pub fn get_rate_limit_counter(env: &Env, operation: &str, user: &Address) -> u32 {
    let operation_name = soroban_sdk::String::from_str(env, operation);
    let key = TempStorageKey::RateLimit(operation_name, user.clone());
    get_temp(env, &key).unwrap_or(0)
}

/// Increment rate limit counter
///
/// Returns the new count.
pub fn increment_rate_limit(env: &Env, operation: &str, user: &Address) -> u32 {
    let current = get_rate_limit_counter(env, operation, user);
    let new_count = current + 1;
    set_rate_limit_counter(env, operation, user, new_count);
    new_count
}

/// Set a nonce to prevent replay attacks within the same ledger
pub fn set_nonce(env: &Env, user: &Address, operation_id: u64) {
    let key = TempStorageKey::Nonce(user.clone(), operation_id);
    set_temp(env, &key, &true);
}

/// Check if a nonce has been used
pub fn has_nonce(env: &Env, user: &Address, operation_id: u64) -> bool {
    let key = TempStorageKey::Nonce(user.clone(), operation_id);
    has_temp(env, &key)
}

/// Cache bonding curve calculation result
///
/// Useful when multiple operations in same transaction need the same calculation.
pub fn cache_bonding_curve_result(env: &Env, token: &Address, xlm_in: i128, tokens_out: i128) {
    let key = TempStorageKey::BondingCurveCache(token.clone(), xlm_in);
    set_temp(env, &key, &tokens_out);
}

/// Get cached bonding curve result
pub fn get_cached_bonding_curve_result(env: &Env, token: &Address, xlm_in: i128) -> Option<i128> {
    let key = TempStorageKey::BondingCurveCache(token.clone(), xlm_in);
    get_temp(env, &key)
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Env};

    #[test]
    fn test_temp_storage_market_cap_cache() {
        let env = Env::default();
        let token = Address::generate(&env);

        env.as_contract(&env.register(crate::SacFactory, ()), || {
            // Cache a value
            cache_market_cap(&env, &token, 69_000_0000000);

            // Retrieve cached value
            let cached = get_cached_market_cap(&env, &token);
            assert_eq!(cached, Some(69_000_0000000));
        });
    }

    #[test]
    fn test_rate_limit_counter() {
        let env = Env::default();
        let user = Address::generate(&env);

        env.as_contract(&env.register(crate::SacFactory, ()), || {
            // Initial count should be 0
            assert_eq!(get_rate_limit_counter(&env, "buy", &user), 0);

            // Increment counter
            assert_eq!(increment_rate_limit(&env, "buy", &user), 1);
            assert_eq!(increment_rate_limit(&env, "buy", &user), 2);
            assert_eq!(increment_rate_limit(&env, "buy", &user), 3);

            // Check final count
            assert_eq!(get_rate_limit_counter(&env, "buy", &user), 3);
        });
    }

    #[test]
    fn test_nonce_replay_protection() {
        let env = Env::default();
        let user = Address::generate(&env);

        env.as_contract(&env.register(crate::SacFactory, ()), || {
            // Nonce should not exist initially
            assert!(!has_nonce(&env, &user, 123));

            // Set nonce
            set_nonce(&env, &user, 123);

            // Nonce should now exist
            assert!(has_nonce(&env, &user, 123));

            // Different nonce should not exist
            assert!(!has_nonce(&env, &user, 456));
        });
    }

    #[test]
    fn test_bonding_curve_cache() {
        let env = Env::default();
        let token = Address::generate(&env);

        env.as_contract(&env.register(crate::SacFactory, ()), || {
            // Cache calculation
            cache_bonding_curve_result(&env, &token, 100_0000000, 50_000_0000000);

            // Retrieve cached result
            let cached = get_cached_bonding_curve_result(&env, &token, 100_0000000);
            assert_eq!(cached, Some(50_000_0000000));

            // Different input should not have cache
            let no_cache = get_cached_bonding_curve_result(&env, &token, 200_0000000);
            assert_eq!(no_cache, None);
        });
    }

    #[test]
    fn test_temp_storage_isolation() {
        let env = Env::default();
        let user1 = Address::generate(&env);
        let user2 = Address::generate(&env);

        env.as_contract(&env.register(crate::SacFactory, ()), || {
            // Set rate limit for user1
            set_rate_limit_counter(&env, "buy", &user1, 5);

            // user2 should have separate counter
            assert_eq!(get_rate_limit_counter(&env, "buy", &user2), 0);
            assert_eq!(get_rate_limit_counter(&env, "buy", &user1), 5);
        });
    }
}
