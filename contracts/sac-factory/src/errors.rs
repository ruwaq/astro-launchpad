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

    // Transaction Protection
    TransactionExpired = 100,
    TransferFailed = 101,

    // AMM / Graduation
    AmmInitializationFailed = 110,
    InsufficientLiquidityForGraduation = 111,
}
