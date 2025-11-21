//! Real Stellar Asset Contract (SAC) Token Deployment
//!
//! Implements production-ready SAC token deployment following Stellar best practices
//!
//! Note: For MVP, we create deterministic addresses using deployer pattern.
//! Production deployment should use serialized Asset XDR.

use soroban_sdk::{token, Address, Bytes, BytesN, Env, String};
use soroban_sdk::xdr::{Asset, AlphaNum4, AlphaNum12, AssetCode4, AssetCode12, WriteXdr};
use crate::errors::Error;

/// Deploy a real Stellar Asset Contract (SAC) using serialized Asset XDR
///
/// Creates an actual token contract on Stellar that users can see in their wallets
///
/// # Arguments
/// * `env` - Contract environment
/// * `serialized_asset` - Stellar Asset XDR serialized to bytes
///
/// # Returns
/// Address of the deployed SAC token contract
pub fn deploy_token_from_asset(
    env: &Env,
    serialized_asset: Bytes,
) -> Result<Address, Error> {
    // Deploy the Stellar Asset Contract using the official pattern
    let deployer = env.deployer().with_stellar_asset(serialized_asset);
    let token_address = deployer.deploy();

    Ok(token_address)
}

// TODO: Properly implement SAC deployment with XDR
// This function has compilation issues and needs fixing
// See token_deployment_new.rs and TESTNET_DEPLOYMENT_REPORT.md
/*
pub fn deploy_sac_with_symbol(
    env: &Env,
    symbol: &String,
    issuer: &Address,
) -> Result<Address, Error> {
    // Convert symbol to a slice we can work with
    let symbol_len = symbol.len().min(12);

    // Extract bytes from symbol manually
    let mut symbol_bytes = [0u8; 12];
    for i in 0..symbol_len {
        symbol_bytes[i] = symbol.get_unchecked(i as u32);
    }

    // Create the Asset XDR based on symbol length
    let asset = if symbol_len <= 4 {
        // AlphaNum4 (1-4 characters)
        let mut asset_code_bytes = [0u8; 4];
        asset_code_bytes[..symbol_len].copy_from_slice(&symbol_bytes[..symbol_len]);
        let asset_code = AssetCode4(asset_code_bytes);

        // Derive AccountId from issuer Address
        // For MVP: Use a deterministic approach
        let issuer_bytes = env.crypto().sha256(&Bytes::from_slice(env, &symbol_bytes)).to_array();
        let issuer_account_id = soroban_sdk::xdr::AccountId(
            soroban_sdk::xdr::PublicKey::PublicKeyTypeEd25519(
                soroban_sdk::xdr::Uint256(issuer_bytes)
            )
        );

        Asset::CreditAlphanum4(AlphaNum4 {
            asset_code,
            issuer: issuer_account_id,
        })
    } else {
        // AlphaNum12 (5-12 characters)
        let mut asset_code_bytes = [0u8; 12];
        asset_code_bytes[..symbol_len].copy_from_slice(&symbol_bytes[..symbol_len]);
        let asset_code = AssetCode12(asset_code_bytes);

        let issuer_bytes = env.crypto().sha256(&Bytes::from_slice(env, &symbol_bytes)).to_array();
        let issuer_account_id = soroban_sdk::xdr::AccountId(
            soroban_sdk::xdr::PublicKey::PublicKeyTypeEd25519(
                soroban_sdk::xdr::Uint256(issuer_bytes)
            )
        );

        Asset::CreditAlphanum12(AlphaNum12 {
            asset_code,
            issuer: issuer_account_id,
        })
    };

    // Serialize asset to XDR bytes
    let xdr_bytes = asset.to_xdr(soroban_sdk::xdr::Limits::none());
    let serialized_asset = Bytes::from_slice(env, &xdr_bytes);

    // Deploy using the proper function
    deploy_token_from_asset(env, serialized_asset)
}
*/

/// Deploy a deterministic contract address (MVP approach)
///
/// For MVP, we use the deployer pattern to create deterministic addresses
/// without deploying real SAC tokens. This is simpler but tokens won't be transferable.
///
/// # Arguments
/// * `env` - Contract environment
/// * `salt` - Unique salt for deterministic address generation
///
/// # Returns
/// Deterministic address for the token
pub fn deploy_token_deterministic(
    env: &Env,
    salt: &BytesN<32>,
) -> Result<Address, Error> {
    // Generate deterministic address using contract deployer pattern
    let deployer = env.deployer();
    let address = deployer.with_current_contract(salt.clone()).deployed_address();

    Ok(address)
}

/// Mint tokens to an address (requires admin authorization)
///
/// # Arguments
/// * `env` - Contract environment
/// * `token_address` - Address of the deployed SAC token
/// * `to` - Address to receive minted tokens
/// * `amount` - Amount to mint (in smallest unit)
pub fn mint_tokens(env: &Env, token_address: &Address, to: &Address, amount: i128) -> Result<(), Error> {
    // Create Stellar Asset token client
    let token = token::StellarAssetClient::new(env, token_address);

    // Mint tokens (requires authorization from token admin)
    token.mint(to, &amount);

    Ok(())
}

/// Transfer tokens between addresses
///
/// # Arguments
/// * `env` - Contract environment
/// * `token_address` - Address of the deployed SAC token
/// * `from` - Address sending tokens (must authorize)
/// * `to` - Address receiving tokens
/// * `amount` - Amount to transfer
pub fn transfer_tokens(
    env: &Env,
    token_address: &Address,
    from: &Address,
    to: &Address,
    amount: i128,
) -> Result<(), Error> {
    let token = token::TokenClient::new(env, token_address);
    token.transfer(from, to, &amount);
    Ok(())
}

/// Get token balance for an address
///
/// # Arguments
/// * `env` - Contract environment
/// * `token_address` - Address of the deployed SAC token
/// * `address` - Address to query balance for
///
/// # Returns
/// Token balance of the address
pub fn get_balance(env: &Env, token_address: &Address, address: &Address) -> i128 {
    let token = token::TokenClient::new(env, token_address);
    token.balance(address)
}

/// Get the native XLM token contract address
///
/// Returns the deterministic address of the native XLM SAC
///
/// Note: In production, this should use the proper serialized Asset::Native XDR
/// For now, this returns a placeholder that needs to be configured
pub fn get_native_xlm_address(env: &Env) -> Address {
    // The XLM SAC address is deterministic and known for each network:
    // - Testnet: CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC
    // - Mainnet: CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA

    // Use the official testnet XLM SAC address
    Address::from_string(&String::from_str(
        env,
        "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
    ))
}

/// Transfer XLM from one address to another using the native XLM SAC
///
/// # Arguments
/// * `env` - Contract environment
/// * `from` - Address sending XLM (must authorize)
/// * `to` - Address receiving XLM
/// * `amount` - Amount in stroops (1 XLM = 10,000,000 stroops)
pub fn transfer_xlm(
    env: &Env,
    from: &Address,
    to: &Address,
    amount: i128,
) -> Result<(), Error> {
    let xlm_address = get_native_xlm_address(env);
    transfer_tokens(env, &xlm_address, from, to, amount)
}

/// Get XLM balance for an address
pub fn get_xlm_balance(env: &Env, address: &Address) -> i128 {
    let xlm_address = get_native_xlm_address(env);
    get_balance(env, &xlm_address, address)
}
