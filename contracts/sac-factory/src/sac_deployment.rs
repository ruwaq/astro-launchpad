//! Real SAC (Stellar Asset Contract) Token Deployment
//!
//! This module implements REAL token deployment using Stellar Asset Contracts.
//! Tokens deployed with this module are:
//! - ✅ Transferable to any wallet
//! - ✅ Visible in Freighter, Lobstr, etc.
//! - ✅ Compatible with all Stellar DEXs
//! - ✅ SEP-41 compliant
//!
//! ## Architecture
//! The client creates and serializes the Asset XDR to bytes, then passes it to the contract.
//! This follows Stellar/Soroban best practices and avoids XDR serialization in no_std contracts.

use soroban_sdk::{Bytes, Env};
use crate::errors::Error;

/// Deploy a REAL Stellar Asset Contract from serialized asset bytes
///
/// # Arguments
/// * `env` - Contract environment
/// * `serialized_asset` - Stellar Asset XDR serialized to bytes (created by client)
///
/// # Returns
/// Address of the deployed SAC token contract
///
/// # Client Responsibility
/// The client must:
/// 1. Create a unique Asset (AlphaNum4 or AlphaNum12)
/// 2. Use a unique issuer AccountId (deterministic or random)
/// 3. Serialize the Asset to XDR bytes using stellar-sdk
/// 4. Pass the serialized bytes to this function
///
/// See SOLUTION_SAC_DEPLOYMENT.md for complete frontend examples.
pub fn deploy_sac_from_serialized_asset(
    env: &Env,
    serialized_asset: Bytes,
) -> Result<soroban_sdk::Address, Error> {
    // Deploy the SAC using Stellar's built-in deployer
    // This calls the host function: create_asset_contract(serialized_asset)
    let deployer = env.deployer().with_stellar_asset(serialized_asset);
    let token_address = deployer.deploy();

    Ok(token_address)
}

/// Get the address that would be created for a serialized asset (without deploying)
///
/// Useful for pre-calculating the token address before deployment.
pub fn get_sac_address(
    env: &Env,
    serialized_asset: Bytes,
) -> soroban_sdk::Address {
    let deployer = env.deployer().with_stellar_asset(serialized_asset);
    deployer.deployed_address()
}

// ====================================================================================
// HELPER FUNCTIONS FOR TESTS ONLY
// These functions create and serialize Asset XDR in tests where std is available
// ====================================================================================

#[cfg(test)]
pub mod test_helpers {
    use super::*;
    use soroban_sdk::{BytesN, String as SorobanString, Address};
    use soroban_sdk::xdr::{
        Asset, AlphaNum4, AlphaNum12, AssetCode4, AssetCode12,
        AccountId, PublicKey, Uint256, WriteXdr, Limits
    };

    /// Create a serialized Asset for testing
    /// This ONLY works in tests - production must create this in the client
    pub fn create_test_serialized_asset(
        env: &Env,
        symbol: &SorobanString,
        creator: &Address,
        salt: &BytesN<32>,
    ) -> Result<Bytes, crate::errors::Error> {
        use soroban_sdk::Bytes as SorobanBytes;

        let symbol_len = symbol.len();

        // Create unique issuer AccountId using salt
        let issuer_account_id = create_test_issuer(env, symbol, creator, salt)?;

        // Create asset based on symbol length
        let asset = if symbol_len <= 4 {
            // AlphaNum4 (1-4 characters)
            let mut code_bytes = [0u8; 4];
            let len = symbol.len().min(4) as usize;
            if len > 0 {
                symbol.copy_into_slice(&mut code_bytes[..len]);
            }
            Asset::CreditAlphanum4(AlphaNum4 {
                asset_code: AssetCode4(code_bytes),
                issuer: issuer_account_id,
            })
        } else if symbol_len <= 12 {
            // AlphaNum12 (5-12 characters)
            let mut code_bytes = [0u8; 12];
            let len = symbol.len().min(12) as usize;
            if len > 0 {
                symbol.copy_into_slice(&mut code_bytes[..len]);
            }
            Asset::CreditAlphanum12(AlphaNum12 {
                asset_code: AssetCode12(code_bytes),
                issuer: issuer_account_id,
            })
        } else {
            return Err(crate::errors::Error::InvalidSymbol);
        };

        // Serialize to bytes (ONLY works in tests with std available)
        let serialized_bytes = asset
            .to_xdr(Limits::none())
            .map_err(|_| crate::errors::Error::InvalidName)?;

        Ok(SorobanBytes::from_slice(env, &serialized_bytes))
    }

    /// Create a unique issuer AccountId for testing
    fn create_test_issuer(
        env: &Env,
        symbol: &SorobanString,
        _creator: &Address,
        salt: &BytesN<32>,
    ) -> Result<AccountId, crate::errors::Error> {
        use soroban_sdk::Bytes as SorobanBytes;

        // Create a GUARANTEED UNIQUE issuer using the salt
        let mut seed = SorobanBytes::new(env);
        seed.append(&SorobanBytes::from_slice(env, b"SAC_ISSUER_V3"));

        // Add the unique salt
        seed.append(&SorobanBytes::from(salt.clone()));

        // Add symbol for additional differentiation
        let mut symbol_bytes = [0u8; 12];
        let symbol_len = symbol.len().min(12) as usize;
        if symbol_len > 0 {
            symbol.copy_into_slice(&mut symbol_bytes[..symbol_len]);
            seed.append(&SorobanBytes::from_slice(env, &symbol_bytes[..symbol_len]));
        }

        // Hash to create deterministic 32-byte public key
        let issuer_hash = env.crypto().sha256(&seed);
        let issuer_bytes = issuer_hash.to_array();

        // Create AccountId with Ed25519 public key
        let public_key = PublicKey::PublicKeyTypeEd25519(Uint256(issuer_bytes));
        let account_id = AccountId(public_key);

        Ok(account_id)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use super::test_helpers::*;
    use soroban_sdk::{Env, String, BytesN};
    use soroban_sdk::testutils::Address as _;

    #[test]
    fn test_deploy_sac_from_serialized_asset() {
        let env = Env::default();
        let creator = soroban_sdk::Address::generate(&env);
        let symbol = String::from_str(&env, "TEST");
        let salt = BytesN::from_array(&env, &[1u8; 32]);

        // Create serialized asset (only works in tests)
        let serialized_asset = create_test_serialized_asset(&env, &symbol, &creator, &salt).unwrap();

        // Deploy SAC
        let result = deploy_sac_from_serialized_asset(&env, serialized_asset.clone());
        assert!(result.is_ok());

        let token_address = result.unwrap();

        // Verify we got a valid address (just check it exists)
        let _ = token_address; // Address was created successfully
    }

    #[test]
    fn test_get_sac_address() {
        let env = Env::default();
        let creator = soroban_sdk::Address::generate(&env);
        let symbol = String::from_str(&env, "TEST");
        let salt = BytesN::from_array(&env, &[1u8; 32]);

        // Create serialized asset
        let serialized_asset = create_test_serialized_asset(&env, &symbol, &creator, &salt).unwrap();

        // Get address without deploying
        let predicted_address = get_sac_address(&env, serialized_asset.clone());

        // Deploy and compare
        let deployed_address = deploy_sac_from_serialized_asset(&env, serialized_asset).unwrap();

        assert_eq!(predicted_address, deployed_address);
    }

    #[test]
    fn test_unique_assets_different_salts() {
        let env = Env::default();
        let creator = soroban_sdk::Address::generate(&env);
        let symbol = String::from_str(&env, "TEST");
        let salt1 = BytesN::from_array(&env, &[1u8; 32]);
        let salt2 = BytesN::from_array(&env, &[2u8; 32]);

        // Create two serialized assets with different salts
        let asset1 = create_test_serialized_asset(&env, &symbol, &creator, &salt1).unwrap();
        let asset2 = create_test_serialized_asset(&env, &symbol, &creator, &salt2).unwrap();

        // Deploy both
        let addr1 = deploy_sac_from_serialized_asset(&env, asset1).unwrap();
        let addr2 = deploy_sac_from_serialized_asset(&env, asset2).unwrap();

        // Should have different addresses
        assert_ne!(addr1, addr2);
    }

    #[test]
    fn test_12_char_symbol() {
        let env = Env::default();
        let creator = soroban_sdk::Address::generate(&env);
        let symbol = String::from_str(&env, "LONGSYMBOL");
        let salt = BytesN::from_array(&env, &[1u8; 32]);

        // Create and deploy 12-char symbol (AlphaNum12)
        let serialized_asset = create_test_serialized_asset(&env, &symbol, &creator, &salt).unwrap();
        let result = deploy_sac_from_serialized_asset(&env, serialized_asset);

        assert!(result.is_ok());
    }
}
