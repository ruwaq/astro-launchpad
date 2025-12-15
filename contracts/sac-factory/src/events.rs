//! Events for SAC Factory
//!
//! Using modern #[contractevent] macro for type-safe event emission
//!
//! Note: Some events are defined for future features (graduation, ASTRO integration)

#![allow(dead_code)] // Future features: graduation events, fee config events

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
pub struct ProtocolFeeUpdated {
    pub old_fee_bps: i128,
    pub new_fee_bps: i128,
    pub updated_by: Address,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct LpFeeUpdated {
    pub old_fee_bps: i128,
    pub new_fee_bps: i128,
    pub updated_by: Address,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CreationFeeUpdated {
    pub old_fee: i128,
    pub new_fee: i128,
    pub updated_by: Address,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TreasuryUpdated {
    pub old_treasury: Address,
    pub new_treasury: Address,
    pub updated_by: Address,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ProtocolFeeCollected {
    pub token: Address,
    pub amount: i128,
    pub treasury: Address,
    pub timestamp: u64,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct LpFeeCollected {
    pub token: Address,
    pub amount: i128,
    pub timestamp: u64,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct FeeBreakdownEvent {
    pub transaction_type: String,
    pub token: Address,
    pub user: Address,
    pub gross_amount: i128,
    pub protocol_fee: i128,
    pub lp_fee: i128,
    pub net_amount: i128,
    pub timestamp: u64,
}

// ========== Event Publishers ==========

#[allow(clippy::too_many_arguments)]
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

#[allow(clippy::too_many_arguments)]
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

pub fn protocol_fee_updated(env: &Env, old_fee_bps: i128, new_fee_bps: i128, updated_by: &Address) {
    ProtocolFeeUpdated {
        old_fee_bps,
        new_fee_bps,
        updated_by: updated_by.clone(),
    }.publish(env);
}

pub fn lp_fee_updated(env: &Env, old_fee_bps: i128, new_fee_bps: i128, updated_by: &Address) {
    LpFeeUpdated {
        old_fee_bps,
        new_fee_bps,
        updated_by: updated_by.clone(),
    }.publish(env);
}

pub fn creation_fee_updated(env: &Env, old_fee: i128, new_fee: i128, updated_by: &Address) {
    CreationFeeUpdated {
        old_fee,
        new_fee,
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

pub fn protocol_fee_collected(env: &Env, token: &Address, amount: i128, treasury: &Address) {
    ProtocolFeeCollected {
        token: token.clone(),
        amount,
        treasury: treasury.clone(),
        timestamp: env.ledger().timestamp(),
    }.publish(env);
}

pub fn lp_fee_collected(env: &Env, token: &Address, amount: i128) {
    LpFeeCollected {
        token: token.clone(),
        amount,
        timestamp: env.ledger().timestamp(),
    }.publish(env);
}

#[allow(clippy::too_many_arguments)]
pub fn fee_breakdown_event(
    env: &Env,
    transaction_type: &str,
    token: &Address,
    user: &Address,
    gross_amount: i128,
    protocol_fee: i128,
    lp_fee: i128,
    net_amount: i128,
) {
    FeeBreakdownEvent {
        transaction_type: String::from_str(env, transaction_type),
        token: token.clone(),
        user: user.clone(),
        gross_amount,
        protocol_fee,
        lp_fee,
        net_amount,
        timestamp: env.ledger().timestamp(),
    }.publish(env);
}

// ========== Admin Configuration Events ==========

/// XLM token address updated event
#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct XlmAddressUpdated {
    pub old_address: Option<Address>,
    pub new_address: Address,
    pub updated_by: Address,
    pub timestamp: u64,
}

/// Graduation threshold updated event
#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct GraduationThresholdUpdated {
    pub old_threshold: i128,
    pub new_threshold: i128,
    pub updated_by: Address,
    pub timestamp: u64,
}

/// AMM WASM hash updated event
#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AmmWasmHashUpdated {
    pub updated_by: Address,
    pub timestamp: u64,
}

/// Oracle address updated event
#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct OracleAddressUpdated {
    pub old_address: Option<Address>,
    pub new_address: Address,
    pub updated_by: Address,
    pub timestamp: u64,
}

/// Minimum market cap updated event
#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MinMarketCapUpdated {
    pub old_min_market_cap: u128,
    pub new_min_market_cap: u128,
    pub updated_by: Address,
    pub timestamp: u64,
}

/// Oracle price max age updated event
#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct OraclePriceMaxAgeUpdated {
    pub old_max_age: u64,
    pub new_max_age: u64,
    pub updated_by: Address,
    pub timestamp: u64,
}

/// Fee withdrawal event
#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct FeesWithdrawn {
    pub token: Address,
    pub amount: i128,
    pub recipient: Address,
    pub withdrawn_by: Address,
    pub timestamp: u64,
}

/// Anti-whale config updated event
#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AntiWhaleConfigUpdated {
    pub updated_by: Address,
    pub timestamp: u64,
}

pub fn xlm_address_updated(
    env: &Env,
    old_address: Option<&Address>,
    new_address: &Address,
    updated_by: &Address,
) {
    XlmAddressUpdated {
        old_address: old_address.cloned(),
        new_address: new_address.clone(),
        updated_by: updated_by.clone(),
        timestamp: env.ledger().timestamp(),
    }.publish(env);
}

pub fn graduation_threshold_updated(
    env: &Env,
    old_threshold: i128,
    new_threshold: i128,
    updated_by: &Address,
) {
    GraduationThresholdUpdated {
        old_threshold,
        new_threshold,
        updated_by: updated_by.clone(),
        timestamp: env.ledger().timestamp(),
    }.publish(env);
}

pub fn amm_wasm_hash_updated(env: &Env, updated_by: &Address) {
    AmmWasmHashUpdated {
        updated_by: updated_by.clone(),
        timestamp: env.ledger().timestamp(),
    }.publish(env);
}

pub fn oracle_address_updated(
    env: &Env,
    old_address: Option<&Address>,
    new_address: &Address,
    updated_by: &Address,
) {
    OracleAddressUpdated {
        old_address: old_address.cloned(),
        new_address: new_address.clone(),
        updated_by: updated_by.clone(),
        timestamp: env.ledger().timestamp(),
    }.publish(env);
}

pub fn min_market_cap_updated(
    env: &Env,
    old_min_market_cap: u128,
    new_min_market_cap: u128,
    updated_by: &Address,
) {
    MinMarketCapUpdated {
        old_min_market_cap,
        new_min_market_cap,
        updated_by: updated_by.clone(),
        timestamp: env.ledger().timestamp(),
    }.publish(env);
}

pub fn oracle_price_max_age_updated(
    env: &Env,
    old_max_age: u64,
    new_max_age: u64,
    updated_by: &Address,
) {
    OraclePriceMaxAgeUpdated {
        old_max_age,
        new_max_age,
        updated_by: updated_by.clone(),
        timestamp: env.ledger().timestamp(),
    }.publish(env);
}

pub fn fees_withdrawn(
    env: &Env,
    token: &Address,
    amount: i128,
    recipient: &Address,
    withdrawn_by: &Address,
) {
    FeesWithdrawn {
        token: token.clone(),
        amount,
        recipient: recipient.clone(),
        withdrawn_by: withdrawn_by.clone(),
        timestamp: env.ledger().timestamp(),
    }.publish(env);
}

pub fn anti_whale_config_updated(env: &Env, updated_by: &Address) {
    AntiWhaleConfigUpdated {
        updated_by: updated_by.clone(),
        timestamp: env.ledger().timestamp(),
    }.publish(env);
}

// ========== Emergency Recovery Events ==========

/// Graduation failed event
#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct GraduationFailed {
    pub token: Address,
    pub xlm_raised: i128,
    pub reason: String,
    pub timestamp: u64,
}

/// Token recovery event (reset to bonding)
#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TokenRecovered {
    pub token: Address,
    pub recovered_by: Address,
    pub recovery_type: String,
    pub timestamp: u64,
}

/// Graduation retry event
#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct GraduationRetried {
    pub token: Address,
    pub retried_by: Address,
    pub timestamp: u64,
}

pub fn graduation_failed(env: &Env, token: &Address, xlm_raised: i128, reason: &str) {
    GraduationFailed {
        token: token.clone(),
        xlm_raised,
        reason: String::from_str(env, reason),
        timestamp: env.ledger().timestamp(),
    }.publish(env);
}

pub fn token_recovered(env: &Env, token: &Address, recovered_by: &Address, recovery_type: &str) {
    TokenRecovered {
        token: token.clone(),
        recovered_by: recovered_by.clone(),
        recovery_type: String::from_str(env, recovery_type),
        timestamp: env.ledger().timestamp(),
    }.publish(env);
}

pub fn graduation_retried(env: &Env, token: &Address, retried_by: &Address) {
    GraduationRetried {
        token: token.clone(),
        retried_by: retried_by.clone(),
        timestamp: env.ledger().timestamp(),
    }.publish(env);
}

// ========== ASTRO Token Integration Events ==========

/// ASTRO configuration updated event
#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AstroConfigUpdated {
    pub token_address: Address,
    pub amm_address: Address,
    pub liquidity_bps: i128,
    pub buyback_bps: i128,
    pub updated_by: Address,
    pub timestamp: u64,
}

/// ASTRO buyback executed event
#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AstroBuybackExecuted {
    pub graduated_token: Address,
    pub xlm_used: i128,
    pub astro_burned: i128,
    pub timestamp: u64,
}

/// ASTRO liquidity added event (ASTRO/TOKEN pair)
#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AstroLiquidityAdded {
    pub graduated_token: Address,
    pub astro_amount: i128,
    pub token_amount: i128,
    pub amm_pair: Address,
    pub timestamp: u64,
}

/// Graduation detailed with ASTRO integration
#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct GraduationWithAstro {
    pub token: Address,
    pub xlm_raised: i128,
    pub xlm_main_pool: i128,
    pub xlm_astro_liquidity: i128,
    pub xlm_buyback: i128,
    pub astro_burned: i128,
    pub timestamp: u64,
}

pub fn astro_config_updated(
    env: &Env,
    token_address: &Address,
    amm_address: &Address,
    liquidity_bps: i128,
    buyback_bps: i128,
    updated_by: &Address,
) {
    AstroConfigUpdated {
        token_address: token_address.clone(),
        amm_address: amm_address.clone(),
        liquidity_bps,
        buyback_bps,
        updated_by: updated_by.clone(),
        timestamp: env.ledger().timestamp(),
    }.publish(env);
}

pub fn astro_buyback_executed(
    env: &Env,
    graduated_token: &Address,
    xlm_used: i128,
    astro_burned: i128,
) {
    AstroBuybackExecuted {
        graduated_token: graduated_token.clone(),
        xlm_used,
        astro_burned,
        timestamp: env.ledger().timestamp(),
    }.publish(env);
}

pub fn astro_liquidity_added(
    env: &Env,
    graduated_token: &Address,
    astro_amount: i128,
    token_amount: i128,
    amm_pair: &Address,
) {
    AstroLiquidityAdded {
        graduated_token: graduated_token.clone(),
        astro_amount,
        token_amount,
        amm_pair: amm_pair.clone(),
        timestamp: env.ledger().timestamp(),
    }.publish(env);
}

pub fn graduation_with_astro(
    env: &Env,
    token: &Address,
    xlm_raised: i128,
    xlm_main_pool: i128,
    xlm_astro_liquidity: i128,
    xlm_buyback: i128,
    astro_burned: i128,
) {
    GraduationWithAstro {
        token: token.clone(),
        xlm_raised,
        xlm_main_pool,
        xlm_astro_liquidity,
        xlm_buyback,
        astro_burned,
        timestamp: env.ledger().timestamp(),
    }.publish(env);
}

// ========== DEX Bridge Integration Events ==========

/// Token graduated via DEX Bridge
#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct BridgeGraduation {
    pub token: Address,
    pub pair_address: Address,
    pub xlm_raised: i128,
    pub timestamp: u64,
}

/// Bridge configuration updated
#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct BridgeConfigUpdated {
    pub old_bridge: Option<Address>,
    pub new_bridge: Address,
    pub enabled: bool,
    pub updated_by: Address,
    pub timestamp: u64,
}

pub fn bridge_graduation(
    env: &Env,
    token: &Address,
    pair_address: &Address,
    xlm_raised: i128,
) {
    BridgeGraduation {
        token: token.clone(),
        pair_address: pair_address.clone(),
        xlm_raised,
        timestamp: env.ledger().timestamp(),
    }.publish(env);
}

pub fn bridge_config_updated(
    env: &Env,
    old_bridge: Option<&Address>,
    new_bridge: &Address,
    enabled: bool,
    updated_by: &Address,
) {
    BridgeConfigUpdated {
        old_bridge: old_bridge.cloned(),
        new_bridge: new_bridge.clone(),
        enabled,
        updated_by: updated_by.clone(),
        timestamp: env.ledger().timestamp(),
    }.publish(env);
}
