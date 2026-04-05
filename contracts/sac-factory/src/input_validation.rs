//! Input Validation Module
//!
//! Soroban Best Practice 2026: Validate all unbounded inputs to prevent DoS attacks.
//!
//! References:
//! - Veridise Security Checklist: "Validate vector/map sizes before storage operations"
//! - OpenZeppelin: "Protect against unbounded loops and storage growth"

use soroban_sdk::{Env, String, Bytes, Vec};
use crate::errors::Error;

// ====================
// SIZE LIMITS
// ====================

/// Maximum length for token name (e.g., "Astro Launch Token")
pub const MAX_NAME_LENGTH: u32 = 32;

/// Maximum length for token symbol (e.g., "ASTRO")
/// Matching standard Stellar symbol length limit
pub const MAX_SYMBOL_LENGTH: u32 = 12;

/// Maximum length for image URL (IPFS URLs are ~60 chars)
/// Example: ipfs://QmT5NvUtoM5nWFfrQdVrFtvGfKFmG7AHE8P34isapyhCxX
pub const MAX_IMAGE_URL_LENGTH: u32 = 256;

/// Maximum length for description (short pitch for token)
pub const MAX_DESCRIPTION_LENGTH: u32 = 512;

/// Maximum length for issuer public key (Stellar addresses are 56 chars: G...)
pub const MAX_ISSUER_LENGTH: u32 = 64;

/// Maximum size for serialized asset bytes (Stellar XDR Asset is ~100 bytes)
pub const MAX_SERIALIZED_ASSET_SIZE: u32 = 256;

/// Maximum number of anti-whale fee tiers
pub const MAX_FEE_TIERS: u32 = 10;

/// Maximum length for role description
pub const MAX_ROLE_DESCRIPTION_LENGTH: u32 = 128;

// ====================
// VALIDATION FUNCTIONS
// ====================

/// Validate token name
///
/// Rules:
/// - Not empty
/// - Length <= MAX_NAME_LENGTH
///
/// # Errors
/// Returns Error::InvalidName if validation fails
pub fn validate_name(env: &Env, name: &String) -> Result<(), Error> {
    if name.len() == 0 {
        return Err(Error::InvalidName);
    }
    if name.len() > MAX_NAME_LENGTH {
        return Err(Error::InvalidName);
    }
    Ok(())
}

/// Validate token symbol
///
/// Rules:
/// - Not empty
/// - Length <= MAX_SYMBOL_LENGTH
///
/// # Errors
/// Returns Error::InvalidSymbol if validation fails
pub fn validate_symbol(env: &Env, symbol: &String) -> Result<(), Error> {
    if symbol.len() == 0 {
        return Err(Error::InvalidSymbol);
    }
    if symbol.len() > MAX_SYMBOL_LENGTH {
        return Err(Error::InvalidSymbol);
    }
    Ok(())
}

/// Validate image URL
///
/// Rules:
/// - Can be empty (optional)
/// - If provided, length <= MAX_IMAGE_URL_LENGTH
///
/// # Errors
/// Returns Error::InvalidAmount if validation fails
pub fn validate_image_url(env: &Env, image_url: &String) -> Result<(), Error> {
    if image_url.len() > MAX_IMAGE_URL_LENGTH {
        return Err(Error::InvalidAmount);
    }
    Ok(())
}

/// Validate description
///
/// Rules:
/// - Can be empty (optional)
/// - If provided, length <= MAX_DESCRIPTION_LENGTH
///
/// # Errors
/// Returns Error::InvalidAmount if validation fails
pub fn validate_description(env: &Env, description: &String) -> Result<(), Error> {
    if description.len() > MAX_DESCRIPTION_LENGTH {
        return Err(Error::InvalidAmount);
    }
    Ok(())
}

/// Validate issuer public key
///
/// Rules:
/// - Can be empty (for pure Soroban tokens)
/// - If provided, length <= MAX_ISSUER_LENGTH
///
/// # Errors
/// Returns Error::InvalidAmount if validation fails
pub fn validate_issuer(env: &Env, issuer: &String) -> Result<(), Error> {
    if issuer.len() > MAX_ISSUER_LENGTH {
        return Err(Error::InvalidAmount);
    }
    Ok(())
}

/// Validate serialized asset bytes
///
/// Rules:
/// - Can be empty (for v2 tokens)
/// - If provided, size <= MAX_SERIALIZED_ASSET_SIZE
///
/// # Errors
/// Returns Error::InvalidAmount if validation fails
pub fn validate_serialized_asset(env: &Env, serialized_asset: &Bytes) -> Result<(), Error> {
    if serialized_asset.len() > MAX_SERIALIZED_ASSET_SIZE {
        return Err(Error::InvalidAmount);
    }
    Ok(())
}

/// Validate Vec size (generic)
///
/// Rules:
/// - Length <= max_length
///
/// # Errors
/// Returns Error::InvalidAmount if validation fails
pub fn validate_vec_size<T>(env: &Env, vec: &Vec<T>, max_length: u32) -> Result<(), Error> {
    if vec.len() > max_length {
        return Err(Error::InvalidAmount);
    }
    Ok(())
}

/// Validate anti-whale fee tiers
///
/// Rules:
/// - tier_thresholds and tier_fees must have same length
/// - Number of tiers <= MAX_FEE_TIERS
/// - Thresholds must be in ascending order
/// - All values must be non-negative
///
/// # Errors
/// Returns Error::InvalidAmount if validation fails
pub fn validate_fee_tiers(
    env: &Env,
    tier_thresholds: &Vec<i128>,
    tier_fees: &Vec<i128>,
) -> Result<(), Error> {
    // Check lengths match
    if tier_thresholds.len() != tier_fees.len() {
        return Err(Error::InvalidAmount);
    }

    // Check max tiers limit
    if tier_thresholds.len() > MAX_FEE_TIERS {
        return Err(Error::InvalidAmount);
    }

    // Validate each tier
    let mut prev_threshold = 0i128;
    for i in 0..tier_thresholds.len() {
        let threshold = tier_thresholds.get(i).ok_or(Error::InvalidAmount)?;
        let fee = tier_fees.get(i).ok_or(Error::InvalidAmount)?;

        // Check non-negative
        if threshold < 0 || fee < 0 {
            return Err(Error::InvalidAmount);
        }

        // Check ascending order
        if threshold <= prev_threshold && i > 0 {
            return Err(Error::InvalidAmount);
        }

        prev_threshold = threshold;
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::Env;

    #[test]
    fn test_validate_name_valid() {
        let env = Env::default();
        let name = String::from_str(&env, "Astro Token");
        assert!(validate_name(&env, &name).is_ok());
    }

    #[test]
    fn test_validate_name_empty() {
        let env = Env::default();
        let name = String::from_str(&env, "");
        assert!(validate_name(&env, &name).is_err());
    }

    #[test]
    fn test_validate_name_too_long() {
        let env = Env::default();
        // Create a string longer than MAX_NAME_LENGTH (64)
        let long_name = "A".repeat(65);
        let name = String::from_str(&env, &long_name);
        assert!(validate_name(&env, &name).is_err());
    }

    #[test]
    fn test_validate_symbol_valid() {
        let env = Env::default();
        let symbol = String::from_str(&env, "ASTRO");
        assert!(validate_symbol(&env, &symbol).is_ok());
    }

    #[test]
    fn test_validate_image_url_empty_allowed() {
        let env = Env::default();
        let url = String::from_str(&env, "");
        assert!(validate_image_url(&env, &url).is_ok());
    }

    #[test]
    fn test_validate_vec_size_within_limit() {
        let env = Env::default();
        let vec = Vec::from_array(&env, [1, 2, 3]);
        assert!(validate_vec_size(&env, &vec, 5).is_ok());
    }

    #[test]
    fn test_validate_vec_size_exceeds_limit() {
        let env = Env::default();
        let vec = Vec::from_array(&env, [1, 2, 3, 4, 5]);
        assert!(validate_vec_size(&env, &vec, 3).is_err());
    }

    #[test]
    fn test_validate_fee_tiers_valid() {
        let env = Env::default();
        let thresholds = Vec::from_array(&env, [1000, 2000, 5000]);
        let fees = Vec::from_array(&env, [100, 200, 500]);
        assert!(validate_fee_tiers(&env, &thresholds, &fees).is_ok());
    }

    #[test]
    fn test_validate_fee_tiers_length_mismatch() {
        let env = Env::default();
        let thresholds = Vec::from_array(&env, [1000, 2000]);
        let fees = Vec::from_array(&env, [100, 200, 500]);
        assert!(validate_fee_tiers(&env, &thresholds, &fees).is_err());
    }

    #[test]
    fn test_validate_fee_tiers_not_ascending() {
        let env = Env::default();
        let thresholds = Vec::from_array(&env, [2000, 1000, 5000]); // Not ascending
        let fees = Vec::from_array(&env, [100, 200, 500]);
        assert!(validate_fee_tiers(&env, &thresholds, &fees).is_err());
    }
}
