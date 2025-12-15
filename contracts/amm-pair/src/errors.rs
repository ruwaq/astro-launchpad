//! Error types for AMM Pair contract
//!
//! Comprehensive error handling for better debugging and security

use soroban_sdk::contracterror;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    // Initialization errors (1-10)
    AlreadyInitialized = 1,
    NotInitialized = 2,
    InvalidTokenPair = 3,

    // Liquidity errors (11-30)
    InsufficientLiquidityMinted = 11,
    InsufficientLiquidity = 12,
    InsufficientLPBalance = 13,
    InsufficientToken0Amount = 14,
    InsufficientToken1Amount = 15,
    InsufficientInputAmount = 16,
    InsufficientOutputAmount = 17,
    InsufficientReserve = 18,

    // Slippage errors (31-40)
    SlippageExceeded = 31,
    PriceImpactTooHigh = 32,

    // Trading errors (41-50)
    InvalidToken = 41,
    InvalidAmount = 42,
    KInvariantViolated = 43,

    // Security errors (51-60)
    Reentrancy = 51,
    ContractPaused = 52,
    Unauthorized = 53,

    // Math errors (61-70)
    Overflow = 61,
    Underflow = 62,
    DivisionByZero = 63,

    // Flash swap errors (71-80)
    InvalidFlashLoan = 71,
    FlashLoanNotRepaid = 72,

    // Transaction errors (81-90)
    TransactionExpired = 81,
}
