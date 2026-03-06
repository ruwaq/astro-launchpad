#![no_std]

//! # Liquidity Locker Contract
//!
//! Locks LP tokens from graduated tokens to provide liquidity security.
//!
//! ## Features
//! - Time-based locks with configurable duration
//! - Permanent locks (burn) for maximum security
//! - Early unlock with penalty (optional)
//! - Multiple locks per user
//! - Lock extensions
//! - Lock transfers (ownership)

use soroban_sdk::{
    contract, contractimpl, contracttype, token, Address, Env, Vec,
};
use astro_core_shared::{
    events::{emit_lock, emit_unlock, EventBuilder},
    math::{safe_add, safe_sub, apply_bps},
    types::{
        SharedError, LockInfo, LockConfig,
        extend_instance_ttl,
    },
};

// ════════════════════════════════════════════════════════════════════════════
// Storage Keys
// ════════════════════════════════════════════════════════════════════════════

#[contracttype]
#[derive(Clone, Debug)]
pub enum DataKey {
    /// Admin address
    Admin,
    /// Lock configuration
    Config,
    /// Whether contract is initialized
    Initialized,
    /// Whether contract is paused
    Paused,
    /// Next lock ID counter
    NextLockId,
    /// Lock info by ID (u64 -> LockInfo)
    Lock(u64),
    /// User's lock IDs (Address -> Vec<u64>)
    UserLocks(Address),
    /// LP token's lock IDs (Address -> Vec<u64>)
    TokenLocks(Address),
    /// Total locked per token (Address -> i128)
    TotalLocked(Address),
    /// Treasury for penalty fees
    Treasury,
}

// ════════════════════════════════════════════════════════════════════════════
// Contract Implementation
// ════════════════════════════════════════════════════════════════════════════

#[contract]
pub struct LiquidityLocker;

#[contractimpl]
impl LiquidityLocker {
    // ════════════════════════════════════════════════════════════════════════
    // CONSTRUCTOR (CAP-58 Protocol 22+)
    // ════════════════════════════════════════════════════════════════════════

    /// Constructor - runs atomically with contract deployment
    /// Prevents front-running attacks during initialization
    pub fn __constructor(
        env: Env,
        admin: Address,
        treasury: Address,
        config: LockConfig,
    ) {
        // Validate config
        if config.min_lock_duration > config.max_lock_duration {
            panic!("invalid lock duration config");
        }

        if config.early_unlock_penalty_bps > 5000 {
            panic!("penalty exceeds 50% max");
        }

        // Store initial state
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Treasury, &treasury);
        env.storage().instance().set(&DataKey::Config, &config);
        env.storage().instance().set(&DataKey::Initialized, &true);
        env.storage().instance().set(&DataKey::Paused, &false);
        env.storage().instance().set(&DataKey::NextLockId, &1_u64);

        extend_instance_ttl(&env);

        let events = EventBuilder::new(&env);
        events.publish("locker", "initialized", (admin.clone(), env.ledger().timestamp()));
    }

    // ════════════════════════════════════════════════════════════════════════
    // LEGACY INITIALIZATION (backwards compatibility)
    // ════════════════════════════════════════════════════════════════════════

    /// Initialize the liquidity locker (LEGACY - use constructor for new deployments)
    pub fn initialize(
        env: Env,
        admin: Address,
        treasury: Address,
        config: LockConfig,
    ) -> Result<(), SharedError> {
        // Check not already initialized
        if env.storage().instance().has(&DataKey::Initialized) {
            return Err(SharedError::AlreadyInitialized);
        }

        // Validate config
        if config.min_lock_duration > config.max_lock_duration {
            return Err(SharedError::InvalidTimestamp);
        }

        if config.early_unlock_penalty_bps > 5000 {
            // Max 50% penalty
            return Err(SharedError::InvalidBps);
        }

        // Store initial state
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Treasury, &treasury);
        env.storage().instance().set(&DataKey::Config, &config);
        env.storage().instance().set(&DataKey::Initialized, &true);
        env.storage().instance().set(&DataKey::Paused, &false);
        env.storage().instance().set(&DataKey::NextLockId, &1_u64);

        extend_instance_ttl(&env);

        let events = EventBuilder::new(&env);
        events.publish("locker", "initialized", (admin.clone(), env.ledger().timestamp()));

        Ok(())
    }

    // ────────────────────────────────────────────────────────────────────────
    // Lock Functions
    // ────────────────────────────────────────────────────────────────────────

    /// Lock LP tokens
    pub fn lock(
        env: Env,
        owner: Address,
        lp_token: Address,
        amount: i128,
        unlock_time: u64,
    ) -> Result<u64, SharedError> {
        owner.require_auth();
        Self::require_initialized(&env)?;
        Self::require_not_paused(&env)?;

        if amount <= 0 {
            return Err(SharedError::InvalidAmount);
        }

        let config: LockConfig = env.storage().instance().get(&DataKey::Config)
            .ok_or(SharedError::NotInitialized)?;

        let current_time = env.ledger().timestamp();
        let lock_duration = unlock_time.saturating_sub(current_time);

        // Validate lock duration
        if lock_duration < config.min_lock_duration {
            return Err(SharedError::InvalidTimestamp);
        }

        if lock_duration > config.max_lock_duration && config.max_lock_duration > 0 {
            return Err(SharedError::InvalidTimestamp);
        }

        // Transfer LP tokens to contract
        let token_client = token::Client::new(&env, &lp_token);
        token_client.transfer(&owner, &env.current_contract_address(), &amount);

        // Create lock
        let lock_id: u64 = env.storage().instance().get(&DataKey::NextLockId).unwrap_or(1);

        let lock_info = LockInfo {
            id: lock_id,
            owner: owner.clone(),
            lp_token: lp_token.clone(),
            amount,
            lock_time: current_time,
            unlock_time,
            unlocked: false,
        };

        // Store lock
        env.storage().persistent().set(&DataKey::Lock(lock_id), &lock_info);

        // Update user's lock list
        Self::add_lock_to_user(&env, &owner, lock_id);

        // Update token's lock list
        Self::add_lock_to_token(&env, &lp_token, lock_id);

        // Update total locked
        let total = Self::get_total_locked(&env, &lp_token);
        let new_total = safe_add(total, amount)?;
        env.storage().persistent().set(&DataKey::TotalLocked(lp_token.clone()), &new_total);

        // Increment lock ID
        env.storage().instance().set(&DataKey::NextLockId, &(lock_id + 1));

        emit_lock(&env, lock_id, &owner, &lp_token, amount, unlock_time);
        extend_instance_ttl(&env);

        Ok(lock_id)
    }

    /// Permanent lock (burn) - cannot be unlocked
    pub fn permanent_lock(
        env: Env,
        owner: Address,
        lp_token: Address,
        amount: i128,
    ) -> Result<u64, SharedError> {
        owner.require_auth();
        Self::require_initialized(&env)?;
        Self::require_not_paused(&env)?;

        if amount <= 0 {
            return Err(SharedError::InvalidAmount);
        }

        // Transfer LP tokens to contract
        let token_client = token::Client::new(&env, &lp_token);
        token_client.transfer(&owner, &env.current_contract_address(), &amount);

        let current_time = env.ledger().timestamp();
        let lock_id: u64 = env.storage().instance().get(&DataKey::NextLockId).unwrap_or(1);

        // Permanent lock uses u64::MAX as unlock time (effectively never)
        let lock_info = LockInfo {
            id: lock_id,
            owner: owner.clone(),
            lp_token: lp_token.clone(),
            amount,
            lock_time: current_time,
            unlock_time: u64::MAX, // Permanent
            unlocked: false,
        };

        env.storage().persistent().set(&DataKey::Lock(lock_id), &lock_info);

        Self::add_lock_to_user(&env, &owner, lock_id);
        Self::add_lock_to_token(&env, &lp_token, lock_id);

        let total = Self::get_total_locked(&env, &lp_token);
        let new_total = safe_add(total, amount)?;
        env.storage().persistent().set(&DataKey::TotalLocked(lp_token.clone()), &new_total);

        env.storage().instance().set(&DataKey::NextLockId, &(lock_id + 1));

        let events = EventBuilder::new(&env);
        events.publish("locker", "permanent_lock", (lock_id, owner.clone(), lp_token, amount));

        extend_instance_ttl(&env);

        Ok(lock_id)
    }

    /// Unlock LP tokens after lock period expires
    pub fn unlock(env: Env, owner: Address, lock_id: u64) -> Result<i128, SharedError> {
        owner.require_auth();
        Self::require_initialized(&env)?;
        Self::require_not_paused(&env)?;

        let mut lock_info: LockInfo = env.storage().persistent()
            .get(&DataKey::Lock(lock_id))
            .ok_or(SharedError::TokenNotFound)?;

        // Verify ownership
        if lock_info.owner != owner {
            return Err(SharedError::NotOwner);
        }

        if lock_info.unlocked {
            return Err(SharedError::AlreadyExecuted);
        }

        let current_time = env.ledger().timestamp();

        // Check if permanent lock
        if lock_info.unlock_time == u64::MAX {
            return Err(SharedError::InvalidState);
        }

        // Check if unlock time reached
        if current_time < lock_info.unlock_time {
            return Err(SharedError::DeadlineExpired);
        }

        // Mark as unlocked
        lock_info.unlocked = true;
        env.storage().persistent().set(&DataKey::Lock(lock_id), &lock_info);

        // Transfer LP tokens back to owner
        let token_client = token::Client::new(&env, &lock_info.lp_token);
        token_client.transfer(&env.current_contract_address(), &owner, &lock_info.amount);

        // Update total locked
        let total = Self::get_total_locked(&env, &lock_info.lp_token);
        let new_total = safe_sub(total, lock_info.amount)?;
        env.storage().persistent().set(&DataKey::TotalLocked(lock_info.lp_token.clone()), &new_total);

        emit_unlock(&env, lock_id, &owner, &lock_info.lp_token, lock_info.amount);
        extend_instance_ttl(&env);

        Ok(lock_info.amount)
    }

    /// Early unlock with penalty (if enabled)
    pub fn early_unlock(env: Env, owner: Address, lock_id: u64) -> Result<i128, SharedError> {
        owner.require_auth();
        Self::require_initialized(&env)?;
        Self::require_not_paused(&env)?;

        let config: LockConfig = env.storage().instance().get(&DataKey::Config)
            .ok_or(SharedError::NotInitialized)?;

        if !config.early_unlock_enabled {
            return Err(SharedError::InvalidState);
        }

        let mut lock_info: LockInfo = env.storage().persistent()
            .get(&DataKey::Lock(lock_id))
            .ok_or(SharedError::TokenNotFound)?;

        if lock_info.owner != owner {
            return Err(SharedError::NotOwner);
        }

        if lock_info.unlocked {
            return Err(SharedError::AlreadyExecuted);
        }

        // Permanent locks cannot be early unlocked
        if lock_info.unlock_time == u64::MAX {
            return Err(SharedError::InvalidState);
        }

        // Mark as unlocked
        lock_info.unlocked = true;
        env.storage().persistent().set(&DataKey::Lock(lock_id), &lock_info);

        // Calculate penalty
        let penalty = apply_bps(lock_info.amount, config.early_unlock_penalty_bps)?;
        let amount_after_penalty = safe_sub(lock_info.amount, penalty)?;

        let token_client = token::Client::new(&env, &lock_info.lp_token);

        // Transfer penalty to treasury
        if penalty > 0 {
            let treasury: Address = env.storage().instance().get(&DataKey::Treasury)
                .ok_or(SharedError::NotInitialized)?;
            token_client.transfer(&env.current_contract_address(), &treasury, &penalty);
        }

        // Transfer remaining to owner
        token_client.transfer(&env.current_contract_address(), &owner, &amount_after_penalty);

        // Update total locked
        let total = Self::get_total_locked(&env, &lock_info.lp_token);
        let new_total = safe_sub(total, lock_info.amount)?;
        env.storage().persistent().set(&DataKey::TotalLocked(lock_info.lp_token.clone()), &new_total);

        let events = EventBuilder::new(&env);
        events.publish("locker", "early_unlock", (lock_id, owner, amount_after_penalty, penalty));

        extend_instance_ttl(&env);

        Ok(amount_after_penalty)
    }

    /// Extend lock duration
    pub fn extend_lock(env: Env, owner: Address, lock_id: u64, new_unlock_time: u64) -> Result<(), SharedError> {
        owner.require_auth();
        Self::require_initialized(&env)?;
        Self::require_not_paused(&env)?;

        let mut lock_info: LockInfo = env.storage().persistent()
            .get(&DataKey::Lock(lock_id))
            .ok_or(SharedError::TokenNotFound)?;

        if lock_info.owner != owner {
            return Err(SharedError::NotOwner);
        }

        if lock_info.unlocked {
            return Err(SharedError::AlreadyExecuted);
        }

        // Cannot extend permanent locks (they're already permanent)
        if lock_info.unlock_time == u64::MAX {
            return Err(SharedError::InvalidState);
        }

        // New unlock time must be later than current
        if new_unlock_time <= lock_info.unlock_time {
            return Err(SharedError::InvalidTimestamp);
        }

        let config: LockConfig = env.storage().instance().get(&DataKey::Config)
            .ok_or(SharedError::NotInitialized)?;

        let current_time = env.ledger().timestamp();
        let new_duration = new_unlock_time.saturating_sub(current_time);

        if new_duration > config.max_lock_duration && config.max_lock_duration > 0 {
            return Err(SharedError::InvalidTimestamp);
        }

        lock_info.unlock_time = new_unlock_time;
        env.storage().persistent().set(&DataKey::Lock(lock_id), &lock_info);

        let events = EventBuilder::new(&env);
        events.publish("locker", "lock_extended", (lock_id, new_unlock_time));

        extend_instance_ttl(&env);

        Ok(())
    }

    /// Transfer lock ownership
    pub fn transfer_lock(env: Env, owner: Address, lock_id: u64, new_owner: Address) -> Result<(), SharedError> {
        owner.require_auth();
        Self::require_initialized(&env)?;

        let mut lock_info: LockInfo = env.storage().persistent()
            .get(&DataKey::Lock(lock_id))
            .ok_or(SharedError::TokenNotFound)?;

        if lock_info.owner != owner {
            return Err(SharedError::NotOwner);
        }

        if lock_info.unlocked {
            return Err(SharedError::AlreadyExecuted);
        }

        // Update owner
        lock_info.owner = new_owner.clone();
        env.storage().persistent().set(&DataKey::Lock(lock_id), &lock_info);

        // Update user lock lists
        Self::remove_lock_from_user(&env, &owner, lock_id);
        Self::add_lock_to_user(&env, &new_owner, lock_id);

        let events = EventBuilder::new(&env);
        events.publish("locker", "lock_transferred", (lock_id, owner, new_owner));

        extend_instance_ttl(&env);

        Ok(())
    }

    // ────────────────────────────────────────────────────────────────────────
    // Admin Functions
    // ────────────────────────────────────────────────────────────────────────

    /// Update configuration
    pub fn update_config(env: Env, new_config: LockConfig) -> Result<(), SharedError> {
        Self::require_admin(&env)?;

        if new_config.min_lock_duration > new_config.max_lock_duration {
            return Err(SharedError::InvalidTimestamp);
        }

        env.storage().instance().set(&DataKey::Config, &new_config);
        extend_instance_ttl(&env);

        Ok(())
    }

    /// Set admin address
    pub fn set_admin(env: Env, new_admin: Address) -> Result<(), SharedError> {
        Self::require_admin(&env)?;

        env.storage().instance().set(&DataKey::Admin, &new_admin);
        extend_instance_ttl(&env);

        Ok(())
    }

    /// Set treasury address
    pub fn set_treasury(env: Env, new_treasury: Address) -> Result<(), SharedError> {
        Self::require_admin(&env)?;

        env.storage().instance().set(&DataKey::Treasury, &new_treasury);
        extend_instance_ttl(&env);

        Ok(())
    }

    /// Pause/unpause the contract
    pub fn set_paused(env: Env, paused: bool) -> Result<(), SharedError> {
        Self::require_admin(&env)?;

        env.storage().instance().set(&DataKey::Paused, &paused);
        extend_instance_ttl(&env);

        Ok(())
    }

    // ────────────────────────────────────────────────────────────────────────
    // Query Functions
    // ────────────────────────────────────────────────────────────────────────

    /// Get lock information
    pub fn get_lock(env: Env, lock_id: u64) -> Option<LockInfo> {
        env.storage().persistent().get(&DataKey::Lock(lock_id))
    }

    /// Get all locks for a user
    pub fn get_user_locks(env: Env, user: Address) -> Vec<LockInfo> {
        let lock_ids: Vec<u64> = env.storage().persistent()
            .get(&DataKey::UserLocks(user))
            .unwrap_or(Vec::new(&env));

        let mut locks = Vec::new(&env);
        for id in lock_ids.iter() {
            if let Some(lock) = env.storage().persistent().get(&DataKey::Lock(id)) {
                let lock_info: LockInfo = lock;
                locks.push_back(lock_info);
            }
        }
        locks
    }

    /// Get all locks for a token
    pub fn get_token_locks(env: Env, lp_token: Address) -> Vec<LockInfo> {
        let lock_ids: Vec<u64> = env.storage().persistent()
            .get(&DataKey::TokenLocks(lp_token))
            .unwrap_or(Vec::new(&env));

        let mut locks = Vec::new(&env);
        for id in lock_ids.iter() {
            if let Some(lock) = env.storage().persistent().get(&DataKey::Lock(id)) {
                let lock_info: LockInfo = lock;
                locks.push_back(lock_info);
            }
        }
        locks
    }

    /// Get total locked for a token
    pub fn get_total_locked_amount(env: Env, lp_token: Address) -> i128 {
        Self::get_total_locked(&env, &lp_token)
    }

    /// Get configuration
    pub fn get_config(env: Env) -> Result<LockConfig, SharedError> {
        env.storage().instance().get(&DataKey::Config)
            .ok_or(SharedError::NotInitialized)
    }

    /// Get admin address
    pub fn admin(env: Env) -> Result<Address, SharedError> {
        env.storage().instance().get(&DataKey::Admin)
            .ok_or(SharedError::NotInitialized)
    }

    /// Check if contract is paused
    pub fn is_paused(env: Env) -> bool {
        env.storage().instance().get(&DataKey::Paused).unwrap_or(false)
    }

    /// Get next lock ID
    pub fn next_lock_id(env: Env) -> u64 {
        env.storage().instance().get(&DataKey::NextLockId).unwrap_or(1)
    }

    // ────────────────────────────────────────────────────────────────────────
    // Internal Helpers
    // ────────────────────────────────────────────────────────────────────────

    fn require_initialized(env: &Env) -> Result<(), SharedError> {
        let initialized: bool = env.storage().instance()
            .get(&DataKey::Initialized)
            .unwrap_or(false);

        if !initialized {
            return Err(SharedError::NotInitialized);
        }
        Ok(())
    }

    fn require_not_paused(env: &Env) -> Result<(), SharedError> {
        let paused: bool = env.storage().instance()
            .get(&DataKey::Paused)
            .unwrap_or(false);

        if paused {
            return Err(SharedError::ContractPaused);
        }
        Ok(())
    }

    fn require_admin(env: &Env) -> Result<(), SharedError> {
        let admin: Address = env.storage().instance()
            .get(&DataKey::Admin)
            .ok_or(SharedError::NotInitialized)?;

        admin.require_auth();
        Ok(())
    }

    fn get_total_locked(env: &Env, lp_token: &Address) -> i128 {
        env.storage().persistent()
            .get(&DataKey::TotalLocked(lp_token.clone()))
            .unwrap_or(0)
    }

    fn add_lock_to_user(env: &Env, user: &Address, lock_id: u64) {
        let mut locks: Vec<u64> = env.storage().persistent()
            .get(&DataKey::UserLocks(user.clone()))
            .unwrap_or(Vec::new(env));
        locks.push_back(lock_id);
        env.storage().persistent().set(&DataKey::UserLocks(user.clone()), &locks);
    }

    fn remove_lock_from_user(env: &Env, user: &Address, lock_id: u64) {
        let locks: Vec<u64> = env.storage().persistent()
            .get(&DataKey::UserLocks(user.clone()))
            .unwrap_or(Vec::new(env));

        let mut new_locks = Vec::new(env);
        for id in locks.iter() {
            if id != lock_id {
                new_locks.push_back(id);
            }
        }
        env.storage().persistent().set(&DataKey::UserLocks(user.clone()), &new_locks);
    }

    fn add_lock_to_token(env: &Env, token: &Address, lock_id: u64) {
        let mut locks: Vec<u64> = env.storage().persistent()
            .get(&DataKey::TokenLocks(token.clone()))
            .unwrap_or(Vec::new(env));
        locks.push_back(lock_id);
        env.storage().persistent().set(&DataKey::TokenLocks(token.clone()), &locks);
    }
}

// ════════════════════════════════════════════════════════════════════════════
// Tests
// ════════════════════════════════════════════════════════════════════════════

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::testutils::{Address as _, Ledger as _};

    fn create_token<'a>(env: &Env, admin: &Address) -> (token::Client<'a>, token::StellarAssetClient<'a>) {
        let contract_id = env.register_stellar_asset_contract_v2(admin.clone());
        (
            token::Client::new(env, &contract_id.address()),
            token::StellarAssetClient::new(env, &contract_id.address()),
        )
    }

    fn default_config() -> LockConfig {
        LockConfig {
            min_lock_duration: 86400,       // 1 day
            max_lock_duration: 31536000,    // 1 year
            early_unlock_enabled: true,
            early_unlock_penalty_bps: 2500, // 25%
            unlock_buffer: 0,               // No buffer for tests
        }
    }

    #[test]
    fn test_initialize() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(LiquidityLocker, ());
        let client = LiquidityLockerClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let treasury = Address::generate(&env);

        client.initialize(&admin, &treasury, &default_config());

        assert_eq!(client.admin(), admin);
        assert_eq!(client.next_lock_id(), 1);
    }

    #[test]
    fn test_lock_and_unlock() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(LiquidityLocker, ());
        let client = LiquidityLockerClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let treasury = Address::generate(&env);
        let user = Address::generate(&env);

        let (lp_token, lp_admin) = create_token(&env, &admin);
        lp_admin.mint(&user, &1_000_000_000_000);

        client.initialize(&admin, &treasury, &default_config());

        // Set current time
        env.ledger().set_timestamp(1000);

        // Lock for 1 week
        let lock_amount = 100_000_000_000_i128;
        let unlock_time = 1000 + 7 * 86400; // 1 week from now
        let lock_id = client.lock(&user, &lp_token.address, &lock_amount, &unlock_time);

        assert_eq!(lock_id, 1);
        assert_eq!(client.get_total_locked_amount(&lp_token.address), lock_amount);

        // Check lock info
        let lock_info = client.get_lock(&lock_id).unwrap();
        assert_eq!(lock_info.owner, user);
        assert_eq!(lock_info.amount, lock_amount);
        assert!(!lock_info.unlocked);

        // Fast forward past unlock time
        env.ledger().set_timestamp(unlock_time + 1);

        // Unlock
        let unlocked_amount = client.unlock(&user, &lock_id);
        assert_eq!(unlocked_amount, lock_amount);
        assert_eq!(client.get_total_locked_amount(&lp_token.address), 0);

        // Verify user received tokens back
        assert_eq!(lp_token.balance(&user), 1_000_000_000_000);
    }

    #[test]
    fn test_permanent_lock() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(LiquidityLocker, ());
        let client = LiquidityLockerClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let treasury = Address::generate(&env);
        let user = Address::generate(&env);

        let (lp_token, lp_admin) = create_token(&env, &admin);
        lp_admin.mint(&user, &1_000_000_000_000);

        client.initialize(&admin, &treasury, &default_config());

        let lock_amount = 100_000_000_000_i128;
        let lock_id = client.permanent_lock(&user, &lp_token.address, &lock_amount);

        // Check it's a permanent lock
        let lock_info = client.get_lock(&lock_id).unwrap();
        assert_eq!(lock_info.unlock_time, u64::MAX);

        // Cannot unlock permanent lock
        let result = client.try_unlock(&user, &lock_id);
        assert!(result.is_err());
    }

    #[test]
    fn test_early_unlock_with_penalty() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(LiquidityLocker, ());
        let client = LiquidityLockerClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let treasury = Address::generate(&env);
        let user = Address::generate(&env);

        let (lp_token, lp_admin) = create_token(&env, &admin);
        lp_admin.mint(&user, &1_000_000_000_000);

        client.initialize(&admin, &treasury, &default_config());

        env.ledger().set_timestamp(1000);

        let lock_amount = 100_000_000_000_i128;
        let unlock_time = 1000 + 30 * 86400; // 30 days
        let lock_id = client.lock(&user, &lp_token.address, &lock_amount, &unlock_time);

        // Early unlock (25% penalty)
        let received = client.early_unlock(&user, &lock_id);

        // Should receive 75% (100B - 25%)
        let expected = 75_000_000_000_i128;
        assert_eq!(received, expected);

        // Treasury should receive 25%
        assert_eq!(lp_token.balance(&treasury), 25_000_000_000);
    }

    #[test]
    fn test_extend_lock() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(LiquidityLocker, ());
        let client = LiquidityLockerClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let treasury = Address::generate(&env);
        let user = Address::generate(&env);

        let (lp_token, lp_admin) = create_token(&env, &admin);
        lp_admin.mint(&user, &1_000_000_000_000);

        client.initialize(&admin, &treasury, &default_config());

        env.ledger().set_timestamp(1000);

        let lock_amount = 100_000_000_000_i128;
        let original_unlock_time = 1000 + 7 * 86400;
        let lock_id = client.lock(&user, &lp_token.address, &lock_amount, &original_unlock_time);

        // Extend lock
        let new_unlock_time = 1000 + 30 * 86400;
        client.extend_lock(&user, &lock_id, &new_unlock_time);

        let lock_info = client.get_lock(&lock_id).unwrap();
        assert_eq!(lock_info.unlock_time, new_unlock_time);
    }

    #[test]
    fn test_transfer_lock() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(LiquidityLocker, ());
        let client = LiquidityLockerClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let treasury = Address::generate(&env);
        let user1 = Address::generate(&env);
        let user2 = Address::generate(&env);

        let (lp_token, lp_admin) = create_token(&env, &admin);
        lp_admin.mint(&user1, &1_000_000_000_000);

        client.initialize(&admin, &treasury, &default_config());

        env.ledger().set_timestamp(1000);

        let lock_id = client.lock(&user1, &lp_token.address, &100_000_000_000, &(1000 + 86400));

        // Transfer lock to user2
        client.transfer_lock(&user1, &lock_id, &user2);

        let lock_info = client.get_lock(&lock_id).unwrap();
        assert_eq!(lock_info.owner, user2);

        // user2 can now unlock
        env.ledger().set_timestamp(1000 + 86400 + 1);
        let result = client.unlock(&user2, &lock_id);
        assert_eq!(result, 100_000_000_000);
    }
}
