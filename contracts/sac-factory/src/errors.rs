//! Error types for SAC Factory

use soroban_sdk::contracterror;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    // Initialization
    AlreadyInitialized = 1,
    NotInitialized = 2,

    // Authorization
    Unauthorized = 10,
    NotAdmin = 11,

    // Validation
    InvalidName = 20,
    InvalidSymbol = 21,
    InvalidAmount = 22,

    // Token state
    TokenNotFound = 30,
    AlreadyGraduated = 31,
    InsufficientLiquidity = 32,
    InvalidTokenStatus = 33,  // Token in invalid status for operation (e.g., GraduationInProgress)

    // Trading
    SlippageExceeded = 40,
    InsufficientBalance = 41,

    // Math
    Overflow = 50,
    Underflow = 51,
    DivisionByZero = 52,

    // Access Control
    CannotRevokeOwnOwnership = 60,
    RoleNotFound = 61,

    // State Management
    ContractPaused = 70,
    ContractNotPaused = 71,
    InvalidState = 72,

    // Fee Management
    InsufficientFee = 80,
    FeeTooHigh = 81,
    InvalidFeeConfiguration = 82,

    // Deployment
    DeploymentFailed = 90,
    TokenAlreadyExists = 91,
    InvalidWasmHash = 92,
    AmmWasmNotSet = 93,
    TokenWasmNotSet = 94,

    // Transaction Protection
    TransactionExpired = 100,
    TransferFailed = 101,

    // AMM / Graduation
    AmmInitializationFailed = 110,
    InsufficientLiquidityForGraduation = 111,

    // Price Oracle
    OracleNotConfigured = 120,
    OracleCallFailed = 121,
    OraclePriceFeedNotFound = 122,
    OraclePriceStale = 123,
    MarketCapBelowMinimum = 124,

    // Math Operations
    MathOverflow = 130,

    // Anti-Whale Protection
    AntiWhaleMaxBuyExceeded = 140,
    AntiWhaleMaxHoldingsExceeded = 141,
    AntiWhaleCooldownActive = 142,

    // Trade Validation
    AmountBelowMinimum = 145,

    // Emergency Recovery
    TokenNotFailedGraduation = 150,
    RecoveryNotAllowed = 151,

    // DEX Bridge Integration
    BridgeNotConfigured = 160,
    BridgeGraduationFailed = 161,
    BridgeCallFailed = 162,
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
