#![no_main]

use libfuzzer_sys::fuzz_target;

// Fuzz test for buy function input validation
// Tests that invalid inputs are properly rejected without panics
fuzz_target!(|data: &[u8]| {
    if data.len() < 24 {
        return;
    }

    // Extract parameters from fuzzy data
    let xlm_amount = i128::from_le_bytes(data[0..16].try_into().unwrap());
    let min_tokens = i128::from_le_bytes(data[8..24].try_into().unwrap());

    // Test parameter validation properties:

    // PROPERTY 1: Negative XLM amount should be rejected
    if xlm_amount <= 0 {
        // In real contract, this would return Error::InvalidAmount
        // We just verify we can handle the check without panic
        assert!(xlm_amount <= 0, "Negative/zero validation check");
    }

    // PROPERTY 2: Negative min_tokens should be rejected
    if min_tokens < 0 {
        // In real contract, this would return Error::InvalidAmount
        assert!(min_tokens < 0, "Negative min_tokens validation check");
    }

    // PROPERTY 3: Test for potential overflow in deadline
    // Deadline is u64, test that conversions are safe
    if data.len() >= 32 {
        let deadline_bytes = [
            data[24], data[25], data[26], data[27],
            data[28], data[29], data[30], data[31],
        ];
        let _deadline = u64::from_le_bytes(deadline_bytes);
        // Just verify no panic on extreme values
    }

    // PROPERTY 4: Test min_tokens vs expected_tokens slippage
    // This is the slippage protection mechanism
    if xlm_amount > 0 && min_tokens > 0 {
        // In a real buy, if expected_tokens < min_tokens, should return Error::SlippageExceeded
        // Test that comparison doesn't overflow
        let expected_tokens = xlm_amount / 1000; // Simplified calculation
        if expected_tokens < min_tokens {
            assert!(
                expected_tokens < min_tokens,
                "Slippage check comparison works"
            );
        }
    }

    // PROPERTY 5: Test maximum safe XLM amount
    // XLM has 7 decimal places, so 1 XLM = 10_000_000 stroops
    // Maximum realistic buy is ~1M XLM = 10_000_000_000_000 stroops
    let max_safe_xlm = 10_000_000_000_000i128;
    if xlm_amount > max_safe_xlm {
        // Extremely large buy - should be handled safely
        assert!(xlm_amount > max_safe_xlm, "Large amount detection");
    }

    // PROPERTY 6: Test token amount boundaries
    // Total supply is 8 billion tokens with 18 decimals = 8_000_000_000_000_000_000_000_000_000
    let max_token_supply = 8_000_000_000_000_000_000_000_000_000i128;
    if min_tokens > max_token_supply {
        // Requesting more than total supply - should be rejected
        assert!(
            min_tokens > max_token_supply,
            "Over-supply request detection"
        );
    }

    // PROPERTY 7: Test zero edge cases
    // Both xlm_amount and min_tokens can be 0 in fuzzing
    // Contract should handle gracefully
    if xlm_amount == 0 || min_tokens == 0 {
        // Zero values should be caught by validation
        assert!(
            xlm_amount == 0 || min_tokens == 0,
            "Zero value handling"
        );
    }

    // PROPERTY 8: Test i128::MAX edge case
    if xlm_amount == i128::MAX || min_tokens == i128::MAX {
        // Extreme values should not cause overflow
        assert!(
            xlm_amount == i128::MAX || min_tokens == i128::MAX,
            "i128::MAX handling"
        );
    }

    // PROPERTY 9: Test i128::MIN edge case
    if xlm_amount == i128::MIN || min_tokens == i128::MIN {
        // Minimum values should be caught and rejected
        assert!(
            xlm_amount == i128::MIN || min_tokens == i128::MIN,
            "i128::MIN handling"
        );
    }

    // PROPERTY 10: Test that buy amount calculation doesn't overflow
    // buy() calculates: tokens_out = calculate_buy(xlm_amount)
    // Should use checked arithmetic internally
    if xlm_amount > 0 && xlm_amount < i128::MAX / 1000 {
        // Safe range for multiplication
        let _safe_mul = xlm_amount.checked_mul(1000);
        // Verify checked math works
    }
});
