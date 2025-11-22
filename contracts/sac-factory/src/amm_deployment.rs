//! AMM Pair Deployment Module
//!
//! Handles automatic AMM pair creation when a token graduates from bonding curve.
//! Sprint 2 - Complete Graduation Flow

use soroban_sdk::{Address, Bytes, BytesN, Env, IntoVal, xdr::ToXdr};

use crate::errors::Error;
use crate::{storage, storage::InstanceKey};

/// Deploy a new AMM pair contract
///
/// # Arguments
/// * `env` - Contract environment
/// * `token_a` - First token address (typically XLM)
/// * `token_b` - Second token address (graduated token)
/// * `factory` - Factory contract address (this contract)
/// * `fee_to` - Fee recipient address
///
/// # Returns
/// Address of the deployed AMM pair contract
pub fn deploy_amm_pair(
    env: &Env,
    token_a: &Address,
    token_b: &Address,
    factory: &Address,
    fee_to: &Address,
) -> Result<Address, Error> {
    // Get AMM WASM hash from storage
    let wasm_hash: BytesN<32> = env
        .storage()
        .instance()
        .get(&InstanceKey::AmmWasmHash)
        .ok_or(Error::AmmWasmNotSet)?;

    // Create salt for deterministic deployment (based on token addresses)
    // Use XDR serialization for consistent byte representation
    let token_a_bytes = token_a.to_xdr(env);
    let token_b_bytes = token_b.to_xdr(env);

    let mut salt_data = Bytes::new(env);
    salt_data.append(&token_a_bytes);
    salt_data.append(&token_b_bytes);

    let salt_hash = env.crypto().sha256(&salt_data);
    let salt = BytesN::from_array(env, &salt_hash.to_array());

    // Deploy the AMM pair contract with salt for deterministic address
    // Using deploy_v2 with empty constructor args (AMM uses separate initialize function)
    let deployed_address = env
        .deployer()
        .with_current_contract(salt)
        .deploy_v2(wasm_hash, ());

    // Initialize the AMM pair
    // Note: We can't directly call the AMM contract from here due to cross-contract limitations
    // The caller needs to initialize the AMM after deployment
    // This is handled in the graduate_to_amm function

    Ok(deployed_address)
}

/// Calculate deterministic AMM pair address without deploying
///
/// Useful for checking if a pair already exists before graduation
pub fn get_amm_pair_address(
    env: &Env,
    token_a: &Address,
    token_b: &Address,
) -> Result<Address, Error> {
    // Get AMM WASM hash from storage
    let wasm_hash: BytesN<32> = env
        .storage()
        .instance()
        .get(&InstanceKey::AmmWasmHash)
        .ok_or(Error::AmmWasmNotSet)?;

    // Create same salt as deploy_amm_pair
    let token_a_bytes = token_a.to_xdr(env);
    let token_b_bytes = token_b.to_xdr(env);

    let mut salt_data = Bytes::new(env);
    salt_data.append(&token_a_bytes);
    salt_data.append(&token_b_bytes);

    let salt_hash = env.crypto().sha256(&salt_data);
    let salt = BytesN::from_array(env, &salt_hash.to_array());

    // Calculate address without deploying
    let address = env
        .deployer()
        .with_current_contract(salt)
        .deployed_address();

    Ok(address)
}

// AMM deployment tests are in the main SAC Factory integration tests
// These functions require contract context to access instance storage
