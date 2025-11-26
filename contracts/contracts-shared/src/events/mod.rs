//! # Standard Events
//!
//! Common event emission helpers for the Astro ecosystem.
//! Using structured events for better indexing.

use soroban_sdk::{Address, Env, Symbol, symbol_short};

// ════════════════════════════════════════════════════════════════════════════
// Event Topics (short symbols for gas efficiency)
// ════════════════════════════════════════════════════════════════════════════

/// Initialize event
pub const TOPIC_INIT: Symbol = symbol_short!("init");
/// Deposit event
pub const TOPIC_DEPOSIT: Symbol = symbol_short!("deposit");
/// Withdraw event
pub const TOPIC_WITHDRAW: Symbol = symbol_short!("withdraw");
/// Stake event
pub const TOPIC_STAKE: Symbol = symbol_short!("stake");
/// Unstake event
pub const TOPIC_UNSTAKE: Symbol = symbol_short!("unstake");
/// Claim event
pub const TOPIC_CLAIM: Symbol = symbol_short!("claim");
/// Lock event
pub const TOPIC_LOCK: Symbol = symbol_short!("lock");
/// Unlock event
pub const TOPIC_UNLOCK: Symbol = symbol_short!("unlock");
/// Distribute event
pub const TOPIC_DIST: Symbol = symbol_short!("dist");
/// Admin event
pub const TOPIC_ADMIN: Symbol = symbol_short!("admin");
/// Pause event
pub const TOPIC_PAUSE: Symbol = symbol_short!("pause");

// ════════════════════════════════════════════════════════════════════════════
// Common Event Emitters
// ════════════════════════════════════════════════════════════════════════════

/// Emit initialization event
pub fn emit_initialized(env: &Env, admin: &Address) {
    let topics = (TOPIC_INIT, admin.clone());
    let data = env.ledger().timestamp();
    env.events().publish(topics, data);
}

/// Emit deposit event
pub fn emit_deposit(env: &Env, token: &Address, from: &Address, amount: i128) {
    let topics = (TOPIC_DEPOSIT, token.clone());
    let data = (from.clone(), amount, env.ledger().timestamp());
    env.events().publish(topics, data);
}

/// Emit withdraw event
pub fn emit_withdraw(env: &Env, token: &Address, to: &Address, amount: i128) {
    let topics = (TOPIC_WITHDRAW, token.clone());
    let data = (to.clone(), amount, env.ledger().timestamp());
    env.events().publish(topics, data);
}

/// Emit stake event
pub fn emit_stake(env: &Env, user: &Address, amount: i128, total_staked: i128) {
    let topics = (TOPIC_STAKE, user.clone());
    let data = (amount, total_staked, env.ledger().timestamp());
    env.events().publish(topics, data);
}

/// Emit unstake event
pub fn emit_unstake(env: &Env, user: &Address, amount: i128, remaining: i128) {
    let topics = (TOPIC_UNSTAKE, user.clone());
    let data = (amount, remaining, env.ledger().timestamp());
    env.events().publish(topics, data);
}

/// Emit claim event
pub fn emit_claim(env: &Env, user: &Address, token: &Address, amount: i128) {
    let topics = (TOPIC_CLAIM, user.clone());
    let data = (token.clone(), amount, env.ledger().timestamp());
    env.events().publish(topics, data);
}

/// Emit lock event
pub fn emit_lock(
    env: &Env,
    lock_id: u64,
    owner: &Address,
    token: &Address,
    amount: i128,
    unlock_time: u64,
) {
    let topics = (TOPIC_LOCK, owner.clone());
    let data = (lock_id, token.clone(), amount, unlock_time);
    env.events().publish(topics, data);
}

/// Emit unlock event
pub fn emit_unlock(env: &Env, lock_id: u64, owner: &Address, token: &Address, amount: i128) {
    let topics = (TOPIC_UNLOCK, owner.clone());
    let data = (lock_id, token.clone(), amount, env.ledger().timestamp());
    env.events().publish(topics, data);
}

/// Emit distribution event
pub fn emit_distribution(
    env: &Env,
    token: &Address,
    total: i128,
    treasury: i128,
    staking: i128,
    burn: i128,
) {
    let topics = (TOPIC_DIST, token.clone());
    let data = (total, treasury, staking, burn, env.ledger().timestamp());
    env.events().publish(topics, data);
}

/// Emit admin change event
pub fn emit_admin_changed(env: &Env, old_admin: &Address, new_admin: &Address) {
    let topics = (TOPIC_ADMIN, Symbol::new(env, "changed"));
    let data = (old_admin.clone(), new_admin.clone(), env.ledger().timestamp());
    env.events().publish(topics, data);
}

/// Emit pause event
pub fn emit_paused(env: &Env, paused: bool, by: &Address) {
    let topics = (TOPIC_PAUSE, by.clone());
    let data = (paused, env.ledger().timestamp());
    env.events().publish(topics, data);
}

// ════════════════════════════════════════════════════════════════════════════
// Custom Event Builder (for complex events)
// ════════════════════════════════════════════════════════════════════════════

/// Builder for custom events
pub struct EventBuilder<'a> {
    env: &'a Env,
}

impl<'a> EventBuilder<'a> {
    pub fn new(env: &'a Env) -> Self {
        Self { env }
    }

    /// Publish a custom event with symbol topic
    pub fn publish<T: soroban_sdk::IntoVal<Env, soroban_sdk::Val>, D: soroban_sdk::IntoVal<Env, soroban_sdk::Val>>(
        &self,
        topic: &str,
        sub_topic: T,
        data: D,
    ) {
        let topics = (Symbol::new(self.env, topic), sub_topic);
        self.env.events().publish(topics, data);
    }
}
