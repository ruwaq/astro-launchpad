//! Safe Math Utilities
//!
//! Provides overflow-protected arithmetic operations for all contract calculations.
//! All operations return Result<i128, Error> for consistent error handling.
//!
//! ## Rounding Philosophy (Uniswap V2 Best Practice)
//! - Fees: Round UP to ensure protocol always receives at least 1 stroop
//! - Token output: Round DOWN to protect liquidity pool
//! - XLM output: Round DOWN to protect liquidity pool

use crate::errors::Error;

/// Minimum trade amount: 0.1 XLM = 1,000,000 stroops
/// This prevents dust attacks and ensures fees don't round to 0
pub const MIN_TRADE_AMOUNT: i128 = 1_000_000;

/// Safe addition with overflow protection
pub fn safe_add(a: i128, b: i128) -> Result<i128, Error> {
    a.checked_add(b).ok_or(Error::Overflow)
}

/// Safe subtraction with underflow protection
pub fn safe_sub(a: i128, b: i128) -> Result<i128, Error> {
    a.checked_sub(b).ok_or(Error::Underflow)
}

/// Safe multiplication with overflow protection
pub fn safe_mul(a: i128, b: i128) -> Result<i128, Error> {
    a.checked_mul(b).ok_or(Error::Overflow)
}

/// Safe division with zero-check and overflow protection
pub fn safe_div(a: i128, b: i128) -> Result<i128, Error> {
    if b == 0 {
        return Err(Error::DivisionByZero);
    }
    a.checked_div(b).ok_or(Error::Overflow)
}

/// Multiply two numbers and divide by a third: (a * b) / c
///
/// Useful for percentage calculations and fee computations.
/// Example: calculate_fee(amount, fee_bps, 10_000)
pub fn mul_div(a: i128, b: i128, c: i128) -> Result<i128, Error> {
    let numerator = safe_mul(a, b)?;
    safe_div(numerator, c)
}

/// Calculate percentage in basis points (1% = 100 bps)
/// Rounds DOWN (standard behavior)
///
/// # Arguments
/// * `amount` - The base amount
/// * `bps` - Basis points (e.g., 100 for 1%, 10000 for 100%)
///
/// # Returns
/// The percentage of the amount
pub fn apply_bps(amount: i128, bps: i128) -> Result<i128, Error> {
    mul_div(amount, bps, 10_000)
}

/// Calculate percentage in basis points with ROUND UP
/// Used for fee calculations to ensure protocol always receives at least 1 stroop
///
/// Formula: ceil((amount * bps) / 10000) = (amount * bps + 9999) / 10000
///
/// # Arguments
/// * `amount` - The base amount
/// * `bps` - Basis points (e.g., 100 for 1%, 10000 for 100%)
///
/// # Returns
/// The percentage of the amount, rounded up
pub fn apply_bps_round_up(amount: i128, bps: i128) -> Result<i128, Error> {
    if bps == 0 {
        return Ok(0);
    }

    let numerator = safe_mul(amount, bps)?;
    // Add (denominator - 1) before dividing to round up
    let numerator_adjusted = safe_add(numerator, 9_999)?;
    safe_div(numerator_adjusted, 10_000)
}

/// Calculate slippage in basis points
///
/// # Arguments
/// * `price_before` - Price before the operation
/// * `price_after` - Price after the operation
///
/// # Returns
/// Slippage in basis points (e.g., 100 = 1%)
pub fn calculate_slippage_bps(price_before: i128, price_after: i128) -> Result<i128, Error> {
    let diff = safe_sub(price_after, price_before)?;
    let slippage = mul_div(diff, 10_000, price_before)?;
    Ok(slippage)
}

/// Calculate square root for initial liquidity calculations
/// Uses Newton's method for approximation
pub fn sqrt(y: i128) -> Result<i128, Error> {
    if y < 0 {
        return Err(Error::InvalidAmount);
    }
    if y == 0 {
        return Ok(0);
    }

    let mut z = y;
    let mut x = safe_div(y, 2)?.checked_add(1).ok_or(Error::Overflow)?;

    while x < z {
        z = x;
        let y_div_x = safe_div(y, x)?;
        x = safe_div(safe_add(x, y_div_x)?, 2)?;
    }

    Ok(z)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_safe_add() {
        assert_eq!(safe_add(100, 50).unwrap(), 150);
        assert!(safe_add(i128::MAX, 1).is_err());
    }

    #[test]
    fn test_safe_sub() {
        assert_eq!(safe_sub(100, 50).unwrap(), 50);
        assert!(safe_sub(i128::MIN, 1).is_err());
    }

    #[test]
    fn test_safe_mul() {
        assert_eq!(safe_mul(10, 5).unwrap(), 50);
        assert!(safe_mul(i128::MAX, 2).is_err());
    }

    #[test]
    fn test_safe_div() {
        assert_eq!(safe_div(100, 5).unwrap(), 20);
        assert!(safe_div(100, 0).is_err());
    }

    #[test]
    fn test_mul_div() {
        // (100 * 5) / 10 = 50
        assert_eq!(mul_div(100, 5, 10).unwrap(), 50);
        assert!(mul_div(100, 5, 0).is_err());
    }

    #[test]
    fn test_apply_bps() {
        // 1% of 1000 = 10
        assert_eq!(apply_bps(1000, 100).unwrap(), 10);
        // 50% of 1000 = 500
        assert_eq!(apply_bps(1000, 5000).unwrap(), 500);
    }

    #[test]
    fn test_apply_bps_round_up() {
        // 0.05% of 1000 = 0.5 → rounds UP to 1
        assert_eq!(apply_bps_round_up(1000, 5).unwrap(), 1);
        // 0.25% of 1000 = 2.5 → rounds UP to 3
        assert_eq!(apply_bps_round_up(1000, 25).unwrap(), 3);
        // 0% of anything = 0
        assert_eq!(apply_bps_round_up(1000, 0).unwrap(), 0);
        // Exact division still works: 1% of 1000 = 10
        assert_eq!(apply_bps_round_up(1000, 100).unwrap(), 10);
        // Small amount: 0.05% of 100 = 0.005 → rounds UP to 1
        assert_eq!(apply_bps_round_up(100, 5).unwrap(), 1);
    }

    #[test]
    fn test_apply_bps_round_up_vs_down() {
        // Compare round up vs round down for small amounts
        let amount = 1000i128;
        let protocol_fee_bps = 5i128; // 0.05%

        // Round down: 1000 * 5 / 10000 = 0
        let fee_down = apply_bps(amount, protocol_fee_bps).unwrap();
        // Round up: (1000 * 5 + 9999) / 10000 = 1
        let fee_up = apply_bps_round_up(amount, protocol_fee_bps).unwrap();

        assert_eq!(fee_down, 0);
        assert_eq!(fee_up, 1);
        assert!(fee_up >= fee_down, "Round up should always be >= round down");
    }

    #[test]
    fn test_min_trade_amount_constant() {
        // Verify MIN_TRADE_AMOUNT is 0.1 XLM
        assert_eq!(MIN_TRADE_AMOUNT, 1_000_000);
        // At 0.1 XLM, fees should be non-zero with round up
        let protocol_fee = apply_bps_round_up(MIN_TRADE_AMOUNT, 5).unwrap();
        let lp_fee = apply_bps_round_up(MIN_TRADE_AMOUNT, 25).unwrap();
        assert!(protocol_fee > 0, "Protocol fee should be > 0 at min trade");
        assert!(lp_fee > 0, "LP fee should be > 0 at min trade");
    }

    #[test]
    fn test_calculate_slippage_bps() {
        // Price increase from 100 to 110 = 10% = 1000 bps
        assert_eq!(calculate_slippage_bps(100, 110).unwrap(), 1000);
        // Price increase from 100 to 105 = 5% = 500 bps
        assert_eq!(calculate_slippage_bps(100, 105).unwrap(), 500);
    }

    #[test]
    fn test_sqrt() {
        assert_eq!(sqrt(0).unwrap(), 0);
        assert_eq!(sqrt(1).unwrap(), 1);
        assert_eq!(sqrt(4).unwrap(), 2);
        assert_eq!(sqrt(9).unwrap(), 3);
        assert_eq!(sqrt(16).unwrap(), 4);
        assert_eq!(sqrt(100).unwrap(), 10);
        assert!(sqrt(-1).is_err());
    }
}
