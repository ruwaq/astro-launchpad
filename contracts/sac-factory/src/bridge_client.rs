//! Bridge Client for AstroSwap DEX Bridge
//!
//! Handles cross-contract calls to graduate tokens from the bonding curve
//! to the AstroSwap DEX.

use soroban_sdk::{contracttype, Address, Env, IntoVal, String, Symbol, Val};

use crate::errors::Error;

/// Token metadata for bridge graduation
#[contracttype]
#[derive(Clone, Debug)]
pub struct TokenMetadata {
    pub name: String,
    pub symbol: String,
    pub decimals: u32,
    pub total_supply: i128,
    pub creator: Address,
    pub graduation_time: u64,
}

/// Result from bridge graduation
#[contracttype]
#[derive(Clone, Debug)]
pub struct GraduatedToken {
    pub token: Address,
    pub pair: Address,
    pub staking_pool_id: u32,
    pub initial_price: i128,
    pub graduation_time: u64,
}

/// Call the DEX Bridge to graduate a token
///
/// # Arguments
/// * `env` - Soroban environment
/// * `bridge_address` - Address of the Bridge contract
/// * `caller` - Address calling the bridge (SAC Factory)
/// * `token` - Token address to graduate
/// * `token_amount` - Amount of tokens for liquidity
/// * `quote_amount` - Amount of XLM for liquidity
/// * `metadata` - Token metadata
///
/// # Returns
/// The pair address created on the DEX
pub fn graduate_token(
    env: &Env,
    bridge_address: &Address,
    caller: &Address,
    token: &Address,
    token_amount: i128,
    quote_amount: i128,
    metadata: TokenMetadata,
) -> Result<Address, Error> {
    // Use invoke_contract which panics on failure - we catch it with the outer Result
    // For cross-contract calls, we use the simpler invoke_contract approach
    let args: soroban_sdk::Vec<Val> = (
        caller.clone(),
        token.clone(),
        token_amount,
        quote_amount,
        metadata,
    )
        .into_val(env);

    // Try to invoke the bridge contract
    // This will panic if the contract call fails, which we catch at the caller level
    let result: GraduatedToken = env.invoke_contract(
        bridge_address,
        &Symbol::new(env, "graduate_token"),
        args,
    );

    Ok(result.pair)
}

/// Call the DEX Bridge to graduate a token with error handling
///
/// This version catches errors from the bridge contract
pub fn try_graduate_token(
    env: &Env,
    bridge_address: &Address,
    caller: &Address,
    token: &Address,
    token_amount: i128,
    quote_amount: i128,
    metadata: TokenMetadata,
) -> Result<Address, Error> {
    let args: soroban_sdk::Vec<Val> = (
        caller.clone(),
        token.clone(),
        token_amount,
        quote_amount,
        metadata,
    )
        .into_val(env);

    // try_invoke_contract returns Result<Result<T, ContractError>, Result<ContractError, InvokeError>>
    // We use Val as the error type since we don't know the bridge's error type
    let result = env.try_invoke_contract::<GraduatedToken, Val>(
        bridge_address,
        &Symbol::new(env, "graduate_token"),
        args,
    );

    match result {
        Ok(Ok(graduated)) => Ok(graduated.pair),
        Ok(Err(_)) => Err(Error::BridgeGraduationFailed),
        Err(_) => Err(Error::BridgeCallFailed),
    }
}

/// Check if a token has already graduated on the bridge
pub fn is_token_graduated(env: &Env, bridge_address: &Address, token: &Address) -> bool {
    let args: soroban_sdk::Vec<Val> = (token.clone(),).into_val(env);

    let result = env.try_invoke_contract::<bool, Val>(
        bridge_address,
        &Symbol::new(env, "is_token_graduated"),
        args,
    );

    match result {
        Ok(Ok(graduated)) => graduated,
        _ => false,
    }
}

/// Get pair address for a graduated token from the bridge
pub fn get_pair_address(
    env: &Env,
    bridge_address: &Address,
    token: &Address,
) -> Option<Address> {
    let args: soroban_sdk::Vec<Val> = (token.clone(),).into_val(env);

    let result = env.try_invoke_contract::<Option<Address>, Val>(
        bridge_address,
        &Symbol::new(env, "get_pair_address"),
        args,
    );

    match result {
        Ok(Ok(pair)) => pair,
        _ => None,
    }
}
