//! # Shared Error Types
//!
//! Common error codes used across all Astro ecosystem contracts.
//! Using `contracterror` for type-safe error handling.

use soroban_sdk::contracterror;

/// Common errors shared across all contracts
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum SharedError {
    // ════════════════════════════════════════════════════════════════
    // Initialization Errors (1-99)
    // ════════════════════════════════════════════════════════════════

    /// Contract already initialized
    AlreadyInitialized = 1,
    /// Contract not initialized
    NotInitialized = 2,
    /// Invalid initialization parameters
    InvalidInitParams = 3,

    // ════════════════════════════════════════════════════════════════
    // Authorization Errors (100-199)
    // ════════════════════════════════════════════════════════════════

    /// Caller is not authorized
    Unauthorized = 100,
    /// Caller is not the admin
    NotAdmin = 101,
    /// Caller is not the owner
    NotOwner = 102,
    /// Operation requires specific role
    RoleRequired = 103,

    // ════════════════════════════════════════════════════════════════
    // Validation Errors (200-299)
    // ════════════════════════════════════════════════════════════════

    /// Invalid amount (zero or negative)
    InvalidAmount = 200,
    /// Amount exceeds maximum allowed
    AmountExceedsMax = 201,
    /// Amount below minimum required
    AmountBelowMin = 202,
    /// Invalid address provided
    InvalidAddress = 203,
    /// Invalid percentage/basis points
    InvalidBps = 204,
    /// Invalid timestamp
    InvalidTimestamp = 205,
    /// Amount below minimum threshold
    BelowMinimum = 206,
    /// Invalid percentage (must sum to 100%)
    InvalidPercentage = 207,

    // ════════════════════════════════════════════════════════════════
    // State Errors (300-399)
    // ════════════════════════════════════════════════════════════════

    /// Contract is paused
    ContractPaused = 300,
    /// Contract is not paused
    ContractNotPaused = 301,
    /// Invalid state transition
    InvalidState = 302,
    /// Operation already executed
    AlreadyExecuted = 303,
    /// Deadline expired
    DeadlineExpired = 304,

    // ════════════════════════════════════════════════════════════════
    // Token Errors (400-499)
    // ════════════════════════════════════════════════════════════════

    /// Insufficient balance
    InsufficientBalance = 400,
    /// Token not found
    TokenNotFound = 401,
    /// Token transfer failed
    TransferFailed = 402,
    /// Insufficient allowance
    InsufficientAllowance = 403,

    // ════════════════════════════════════════════════════════════════
    // Math Errors (500-599)
    // ════════════════════════════════════════════════════════════════

    /// Arithmetic overflow
    Overflow = 500,
    /// Arithmetic underflow
    Underflow = 501,
    /// Division by zero
    DivisionByZero = 502,

    // ════════════════════════════════════════════════════════════════
    // External Call Errors (600-699)
    // ════════════════════════════════════════════════════════════════

    /// Cross-contract call failed
    CrossContractCallFailed = 600,
    /// External contract not configured
    ExternalContractNotSet = 601,
}
