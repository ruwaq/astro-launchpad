//! Events for ASTRO Token

use soroban_sdk::{contracttype, Address, Env, Symbol};

/// Event data for transfers
#[contracttype]
#[derive(Clone, Debug)]
pub struct TransferEvent {
    pub from: Address,
    pub to: Address,
    pub amount: i128,
}

/// Event data for approvals
#[contracttype]
#[derive(Clone, Debug)]
pub struct ApproveEvent {
    pub from: Address,
    pub spender: Address,
    pub amount: i128,
    pub expiration_ledger: u32,
}

/// Event data for mint
#[contracttype]
#[derive(Clone, Debug)]
pub struct MintEvent {
    pub admin: Address,
    pub to: Address,
    pub amount: i128,
}

/// Event data for burn
#[contracttype]
#[derive(Clone, Debug)]
pub struct BurnEvent {
    pub from: Address,
    pub amount: i128,
}

/// Event data for admin change
#[contracttype]
#[derive(Clone, Debug)]
pub struct SetAdminEvent {
    pub old_admin: Address,
    pub new_admin: Address,
}

/// Event data for buyback burn
#[contracttype]
#[derive(Clone, Debug)]
pub struct BuybackBurnEvent {
    pub caller: Address,
    pub amount: i128,
}

/// Emit transfer event
pub fn transfer(env: &Env, from: &Address, to: &Address, amount: i128) {
    let topics = (Symbol::new(env, "transfer"), from.clone(), to.clone());
    env.events().publish(topics, amount);
}

/// Emit approval event
pub fn approve(env: &Env, from: &Address, spender: &Address, amount: i128, expiration_ledger: u32) {
    let topics = (Symbol::new(env, "approve"), from.clone(), spender.clone());
    env.events().publish(topics, (amount, expiration_ledger));
}

/// Emit mint event
pub fn mint(env: &Env, admin: &Address, to: &Address, amount: i128) {
    let topics = (Symbol::new(env, "mint"), admin.clone(), to.clone());
    env.events().publish(topics, amount);
}

/// Emit burn event
pub fn burn(env: &Env, from: &Address, amount: i128) {
    let topics = (Symbol::new(env, "burn"), from.clone());
    env.events().publish(topics, amount);
}

/// Emit admin change event
pub fn set_admin(env: &Env, old_admin: &Address, new_admin: &Address) {
    let topics = (Symbol::new(env, "set_admin"), old_admin.clone(), new_admin.clone());
    env.events().publish(topics, ());
}

/// Emit buyback burn event
/// This is a special event for buyback & burn mechanism
pub fn buyback_burn(env: &Env, caller: &Address, amount: i128) {
    let topics = (Symbol::new(env, "buyback_burn"), caller.clone());
    env.events().publish(topics, amount);
}
