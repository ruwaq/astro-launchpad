/// Math library for AMM calculations
/// Wrapper around astro-core-shared math module
/// Maintains backward-compatible panic-based API

use astro_core_shared::math as core_math;

/// Fee in basis points (30 = 0.3%)
const FEE_BPS: u32 = 30;

/// Calculate square root using Newton's method
/// Used for initial liquidity calculation
pub fn sqrt(y: i128) -> i128 {
    core_math::sqrt(y)
}

/// Calculate quote amount based on reserves
/// Used for calculating optimal liquidity amounts
///
/// # Arguments
/// * `amount_a` - Amount of token A
/// * `reserve_a` - Reserve of token A
/// * `reserve_b` - Reserve of token B
///
/// # Returns
/// Equivalent amount of token B
///
/// # Panics
/// - If amount_a <= 0
/// - If reserves are <= 0
pub fn quote(amount_a: i128, reserve_a: i128, reserve_b: i128) -> i128 {
    core_math::quote(amount_a, reserve_a, reserve_b)
        .unwrap_or_else(|_| panic!("insufficient liquidity"))
}

/// Calculate output amount for a swap
/// Formula: amount_out = (amount_in * 9970 * reserve_out) / (reserve_in * 10000 + amount_in * 9970)
///
/// # Arguments
/// * `amount_in` - Input amount
/// * `reserve_in` - Input token reserve
/// * `reserve_out` - Output token reserve
///
/// # Returns
/// Output amount after fee
///
/// # Panics
/// - If amount_in <= 0
/// - If reserves are <= 0
pub fn get_amount_out(amount_in: i128, reserve_in: i128, reserve_out: i128) -> i128 {
    core_math::get_amount_out(amount_in, reserve_in, reserve_out, FEE_BPS)
        .unwrap_or_else(|_| panic!("insufficient liquidity"))
}

/// Calculate input amount needed for a desired output
/// Formula: amount_in = (reserve_in * amount_out * 10000) / ((reserve_out - amount_out) * 9970) + 1
///
/// # Arguments
/// * `amount_out` - Desired output amount
/// * `reserve_in` - Input token reserve
/// * `reserve_out` - Output token reserve
///
/// # Returns
/// Required input amount (including fee)
///
/// # Panics
/// - If amount_out <= 0
/// - If reserves are <= 0
/// - If amount_out >= reserve_out
pub fn get_amount_in(amount_out: i128, reserve_in: i128, reserve_out: i128) -> i128 {
    core_math::get_amount_in(amount_out, reserve_in, reserve_out, FEE_BPS)
        .unwrap_or_else(|_| panic!("insufficient liquidity"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sqrt() {
        assert_eq!(sqrt(0), 0);
        assert_eq!(sqrt(1), 1);
        assert_eq!(sqrt(4), 2);
        assert_eq!(sqrt(9), 3);
        assert_eq!(sqrt(16), 4);
        assert_eq!(sqrt(100), 10);
        assert_eq!(sqrt(10000), 100);
    }

    #[test]
    fn test_quote() {
        // 1:1 ratio
        assert_eq!(quote(100, 1000, 1000), 100);

        // 1:2 ratio
        assert_eq!(quote(100, 1000, 2000), 200);

        // 2:1 ratio
        assert_eq!(quote(100, 2000, 1000), 50);
    }

    #[test]
    fn test_get_amount_out() {
        // With 10M reserve each, swapping 1M should give ~900K (due to 0.3% fee + price impact)
        let reserve_in = 10_000_000;
        let reserve_out = 10_000_000;
        let amount_in = 1_000_000;

        let amount_out = get_amount_out(amount_in, reserve_in, reserve_out);

        // Should be less than input due to fee and price impact
        assert!(amount_out < amount_in);
        assert!(amount_out > 0);

        // Verify approximately 0.3% fee
        assert!(amount_out > 900_000 && amount_out < 1_000_000);
    }

    #[test]
    fn test_get_amount_in() {
        let reserve_in = 10_000_000;
        let reserve_out = 10_000_000;
        let amount_out = 900_000;

        let amount_in = get_amount_in(amount_out, reserve_in, reserve_out);

        // Should be more than output due to fee
        assert!(amount_in > amount_out);
    }

    #[test]
    fn test_roundtrip() {
        let reserve_in = 10_000_000;
        let reserve_out = 10_000_000;
        let amount_in = 1_000_000;

        let amount_out = get_amount_out(amount_in, reserve_in, reserve_out);
        let amount_in_required = get_amount_in(amount_out, reserve_in, reserve_out);

        // Should be approximately equal (within small margin due to rounding)
        assert!(
            (amount_in - amount_in_required).abs() <= 2,
            "amount_in: {}, amount_in_required: {}",
            amount_in,
            amount_in_required
        );
    }

    #[test]
    #[should_panic]
    fn test_get_amount_out_zero_input() {
        get_amount_out(0, 1000, 1000);
    }

    #[test]
    #[should_panic]
    fn test_get_amount_out_zero_reserve() {
        get_amount_out(100, 0, 1000);
    }

    #[test]
    #[should_panic]
    fn test_get_amount_in_exceeds_reserve() {
        get_amount_in(1001, 1000, 1000);
    }
}
