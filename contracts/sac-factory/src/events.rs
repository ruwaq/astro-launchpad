//! Events for SAC Factory
//!
//! Using modern #[contractevent] macro for type-safe event emission

use soroban_sdk::{contractevent, Address, Env, String};
use crate::access_control::Role;

/// Token launched event
#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TokenLaunched {
    pub creator: Address,
    pub token: Address,
    pub name: String,
    pub symbol: String,
}

/// Tokens bought event
#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TokensBought {
    pub buyer: Address,
    pub token: Address,
    pub xlm_amount: i128,
    pub tokens_received: i128,
}

/// Tokens sold event
#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TokensSold {
    pub seller: Address,
    pub token: Address,
    pub tokens_sold: i128,
    pub xlm_received: i128,
}

/// Token graduated to AMM
#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TokenGraduated {
    pub token: Address,
    pub xlm_raised: i128,
}

/// Liquidity locked in AMM (permanent)
#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct LiquidityLocked {
    pub amm_pair: Address,
    pub lp_tokens: i128,
}

pub fn token_launched(
    env: &Env,
    creator: &Address,
    token: &Address,
    name: &String,
    symbol: &String,
) {
    TokenLaunched {
        creator: creator.clone(),
        token: token.clone(),
        name: name.clone(),
        symbol: symbol.clone(),
    }.publish(env);
}

pub fn tokens_bought(
    env: &Env,
    buyer: &Address,
    token: &Address,
    xlm_amount: i128,
    tokens_received: i128,
) {
    TokensBought {
        buyer: buyer.clone(),
        token: token.clone(),
        xlm_amount,
        tokens_received,
    }.publish(env);
}

pub fn tokens_sold(
    env: &Env,
    seller: &Address,
    token: &Address,
    tokens_sold: i128,
    xlm_received: i128,
) {
    TokensSold {
        seller: seller.clone(),
        token: token.clone(),
        tokens_sold,
        xlm_received,
    }.publish(env);
}

pub fn token_graduated(
    env: &Env,
    token: &Address,
    xlm_raised: i128,
) {
    TokenGraduated {
        token: token.clone(),
        xlm_raised,
    }.publish(env);
}

pub fn liquidity_locked(
    env: &Env,
    amm_pair: &Address,
    lp_tokens: i128,
) {
    LiquidityLocked {
        amm_pair: amm_pair.clone(),
        lp_tokens,
    }.publish(env);
}

// ========== Enhanced Events ==========

/// Enhanced token launched event with more details
#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TokenLaunchedDetailed {
    pub creator: Address,
    pub token: Address,
    pub name: String,
    pub symbol: String,
    pub initial_supply: i128,
    pub bonding_curve_supply: i128,
    pub timestamp: u64,
    pub creation_fee_paid: i128,
}

/// Enhanced tokens bought event with slippage info
#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TokensBoughtDetailed {
    pub buyer: Address,
    pub token: Address,
    pub xlm_amount: i128,
    pub tokens_gross: i128,
    pub fee_amount: i128,
    pub tokens_net: i128,
    pub price_before: i128,
    pub price_after: i128,
    pub slippage_bps: i128,
    pub timestamp: u64,
}

/// Graduation event with AMM details
#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct GraduationDetailed {
    pub token: Address,
    pub xlm_raised: i128,
    pub tokens_graduated: i128,
    pub amm_pair_address: Address,
    pub lp_tokens_burned: i128,
    pub timestamp: u64,
}

/// Access control events
#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RoleGranted {
    pub account: Address,
    pub role: Role,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RoleRevoked {
    pub account: Address,
    pub role: Role,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct OwnershipTransferred {
    pub previous_owner: Address,
    pub new_owner: Address,
}

/// State management events
#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ContractPaused {
    pub paused_by: Address,
    pub timestamp: u64,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ContractUnpaused {
    pub unpaused_by: Address,
    pub timestamp: u64,
}

/// Fee configuration events
#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct FeeConfigUpdated {
    pub creation_fee: i128,
    pub trading_fee_bps: i128,
    pub updated_by: Address,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TreasuryUpdated {
    pub old_treasury: Address,
    pub new_treasury: Address,
    pub updated_by: Address,
}

// ========== Event Publishers ==========

pub fn token_launched_detailed(
    env: &Env,
    creator: &Address,
    token: &Address,
    name: &String,
    symbol: &String,
    initial_supply: i128,
    bonding_curve_supply: i128,
    creation_fee_paid: i128,
) {
    TokenLaunchedDetailed {
        creator: creator.clone(),
        token: token.clone(),
        name: name.clone(),
        symbol: symbol.clone(),
        initial_supply,
        bonding_curve_supply,
        timestamp: env.ledger().timestamp(),
        creation_fee_paid,
    }.publish(env);
}

pub fn tokens_bought_detailed(
    env: &Env,
    buyer: &Address,
    token: &Address,
    xlm_amount: i128,
    tokens_gross: i128,
    fee_amount: i128,
    tokens_net: i128,
    price_before: i128,
    price_after: i128,
    slippage_bps: i128,
) {
    TokensBoughtDetailed {
        buyer: buyer.clone(),
        token: token.clone(),
        xlm_amount,
        tokens_gross,
        fee_amount,
        tokens_net,
        price_before,
        price_after,
        slippage_bps,
        timestamp: env.ledger().timestamp(),
    }.publish(env);
}

pub fn role_granted(env: &Env, account: &Address, role: Role) {
    RoleGranted {
        account: account.clone(),
        role,
    }.publish(env);
}

pub fn role_revoked(env: &Env, account: &Address, role: Role) {
    RoleRevoked {
        account: account.clone(),
        role,
    }.publish(env);
}

pub fn ownership_transferred(env: &Env, previous_owner: &Address, new_owner: &Address) {
    OwnershipTransferred {
        previous_owner: previous_owner.clone(),
        new_owner: new_owner.clone(),
    }.publish(env);
}

pub fn contract_paused(env: &Env, paused_by: &Address) {
    ContractPaused {
        paused_by: paused_by.clone(),
        timestamp: env.ledger().timestamp(),
    }.publish(env);
}

pub fn contract_unpaused(env: &Env, unpaused_by: &Address) {
    ContractUnpaused {
        unpaused_by: unpaused_by.clone(),
        timestamp: env.ledger().timestamp(),
    }.publish(env);
}

pub fn fee_config_updated(env: &Env, creation_fee: i128, trading_fee_bps: i128, updated_by: &Address) {
    FeeConfigUpdated {
        creation_fee,
        trading_fee_bps,
        updated_by: updated_by.clone(),
    }.publish(env);
}

pub fn treasury_updated(env: &Env, old_treasury: &Address, new_treasury: &Address, updated_by: &Address) {
    TreasuryUpdated {
        old_treasury: old_treasury.clone(),
        new_treasury: new_treasury.clone(),
        updated_by: updated_by.clone(),
    }.publish(env);
}
