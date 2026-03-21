//! Error types for SAC Factory
//!
//! Hierarchical error code structure following OpenZeppelin pattern
//! Error codes are grouped by category for better organization and debugging
//!
//! References:
//! - OpenZeppelin Stellar Contracts: https://docs.openzeppelin.com/stellar-contracts
//! - Soroban Best Practices 2026: Hierarchical error codes prevent collisions

use soroban_sdk::contracterror;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    // =============================================================================
    // 1XX - INITIALIZATION & CONTRACT STATE
    // =============================================================================
    /// Contract has already been initialized
    AlreadyInitialized = 100,
    /// Contract has not been initialized yet
    NotInitialized = 101,
    /// Contract is paused - operations not allowed
    ContractPaused = 102,
    /// Contract is not paused - cannot unpause
    ContractNotPaused = 103,
    /// Invalid contract state for this operation
    InvalidState = 104,

    // =============================================================================
    // 2XX - AUTHORIZATION & ACCESS CONTROL
    // =============================================================================
    /// Caller is not authorized for this operation
    Unauthorized = 200,
    /// Caller is not an admin
    NotAdmin = 201,
    /// Cannot revoke your own ownership
    CannotRevokeOwnOwnership = 202,
    /// Role not found for the given address
    RoleNotFound = 203,

    // =============================================================================
    // 3XX - INPUT VALIDATION
    // =============================================================================
    /// Token name is invalid (empty or too long)
    InvalidName = 300,
    /// Token symbol is invalid (empty or too long)
    InvalidSymbol = 301,
    /// Amount is invalid (negative, zero, or out of range)
    InvalidAmount = 302,
    /// Token symbol already exists
    DuplicateSymbol = 303,
    /// WASM hash is invalid
    InvalidWasmHash = 304,
    /// Fee configuration is invalid
    InvalidFeeConfiguration = 305,

    // =============================================================================
    // 4XX - TOKEN STATE & LIFECYCLE
    // =============================================================================
    /// Token not found in registry
    TokenNotFound = 400,
    /// Token has already graduated to DEX
    AlreadyGraduated = 401,
    /// Insufficient liquidity in bonding curve
    InsufficientLiquidity = 402,
    /// Invalid token status for this operation
    InvalidTokenStatus = 403,
    /// Graduation already in progress - concurrent attempt
    GraduationAlreadyInProgress = 404,
    /// Token already exists with this address
    TokenAlreadyExists = 405,
    /// Token deployment failed
    DeploymentFailed = 406,
    /// Token not in failed graduation state
    TokenNotFailedGraduation = 407,

    // =============================================================================
    // 5XX - TRADING & OPERATIONS
    // =============================================================================
    /// Slippage tolerance exceeded
    SlippageExceeded = 500,
    /// Insufficient balance for operation
    InsufficientBalance = 501,
    /// Transaction deadline has expired
    TransactionExpired = 502,
    /// Token transfer failed
    TransferFailed = 503,
    /// Insufficient fee provided
    InsufficientFee = 504,
    /// Fee is too high (above maximum allowed)
    FeeTooHigh = 505,
    /// Amount is below minimum trade size
    AmountBelowMinimum = 506,
    /// Insufficient liquidity for graduation
    InsufficientLiquidityForGraduation = 507,
    /// Recovery operation not allowed
    RecoveryNotAllowed = 508,

    // =============================================================================
    // 6XX - MATH OPERATIONS
    // =============================================================================
    /// Integer overflow occurred
    Overflow = 600,
    /// Integer underflow occurred
    Underflow = 601,
    /// Division by zero attempted
    DivisionByZero = 602,
    /// Math operation resulted in overflow
    MathOverflow = 603,

    // =============================================================================
    // 7XX - ANTI-WHALE PROTECTION
    // =============================================================================
    /// Buy amount exceeds anti-whale maximum
    AntiWhaleMaxBuyExceeded = 700,
    /// Holdings would exceed anti-whale maximum
    AntiWhaleMaxHoldingsExceeded = 701,
    /// Anti-whale cooldown period is active
    AntiWhaleCooldownActive = 702,

    // =============================================================================
    // 8XX - AMM & GRADUATION
    // =============================================================================
    /// AMM initialization failed
    AmmInitializationFailed = 800,
    /// AMM WASM hash not configured
    AmmWasmNotSet = 801,
    /// Token WASM hash not configured
    TokenWasmNotSet = 802,

    // =============================================================================
    // 9XX - EXTERNAL SERVICES (Oracle, Bridge)
    // =============================================================================
    /// Oracle not configured
    OracleNotConfigured = 900,
    /// Oracle contract call failed
    OracleCallFailed = 901,
    /// Oracle price feed not found
    OraclePriceFeedNotFound = 902,
    /// Oracle price data is stale
    OraclePriceStale = 903,
    /// Market cap is below minimum required
    MarketCapBelowMinimum = 904,
    /// DEX bridge not configured
    BridgeNotConfigured = 905,
    /// Bridge graduation failed
    BridgeGraduationFailed = 906,
    /// Bridge contract call failed
    BridgeCallFailed = 907,
}

// Convert astro-core SharedError to local Error
impl From<astro_core_shared::SharedError> for Error {
    fn from(e: astro_core_shared::SharedError) -> Self {
        match e {
            astro_core_shared::SharedError::Overflow => Error::Overflow,
            astro_core_shared::SharedError::Underflow => Error::Underflow,
            astro_core_shared::SharedError::DivisionByZero => Error::DivisionByZero,
            astro_core_shared::SharedError::InvalidAmount => Error::InvalidAmount,
            astro_core_shared::SharedError::InsufficientBalance => Error::InsufficientBalance,
            _ => Error::InvalidState,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_error_hierarchy() {
        // Verify error codes are in correct ranges
        assert!((Error::AlreadyInitialized as u32) >= 100 && (Error::AlreadyInitialized as u32) < 200);
        assert!((Error::Unauthorized as u32) >= 200 && (Error::Unauthorized as u32) < 300);
        assert!((Error::InvalidName as u32) >= 300 && (Error::InvalidName as u32) < 400);
        assert!((Error::TokenNotFound as u32) >= 400 && (Error::TokenNotFound as u32) < 500);
        assert!((Error::SlippageExceeded as u32) >= 500 && (Error::SlippageExceeded as u32) < 600);
        assert!((Error::Overflow as u32) >= 600 && (Error::Overflow as u32) < 700);
        assert!((Error::AntiWhaleMaxBuyExceeded as u32) >= 700 && (Error::AntiWhaleMaxBuyExceeded as u32) < 800);
        assert!((Error::AmmInitializationFailed as u32) >= 800 && (Error::AmmInitializationFailed as u32) < 900);
        assert!((Error::OracleNotConfigured as u32) >= 900 && (Error::OracleNotConfigured as u32) < 1000);
    }

    #[test]
    fn test_error_ordering() {
        // Verify errors can be ordered (useful for binary search, etc.)
        assert!(Error::InvalidName < Error::TokenNotFound);
        assert!(Error::Unauthorized < Error::InvalidName);
        assert!(Error::Overflow < Error::AntiWhaleMaxBuyExceeded);
    }

    #[test]
    fn test_shared_error_conversion() {
        // Verify astro-core error conversion
        let overflow = astro_core_shared::SharedError::Overflow;
        let local_error: Error = overflow.into();
        assert_eq!(local_error, Error::Overflow);

        let underflow = astro_core_shared::SharedError::Underflow;
        let local_error: Error = underflow.into();
        assert_eq!(local_error, Error::Underflow);
    }
}
