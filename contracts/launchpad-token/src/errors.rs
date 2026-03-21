//! Error types for Launchpad Token Contract

use soroban_sdk::contracterror;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    /// Amount cannot be negative
    NegativeAmount = 1,
    /// Decimal places must not exceed 18
    InvalidDecimals = 2,
    /// Contract has already been initialized
    AlreadyInitialized = 3,
    /// Insufficient balance for operation
    InsufficientBalance = 4,
    /// Allowance expiration ledger is invalid
    InvalidExpiration = 5,
    /// Insufficient allowance for operation
    InsufficientAllowance = 6,
    /// Admin not initialized
    NotInitialized = 7,
}
