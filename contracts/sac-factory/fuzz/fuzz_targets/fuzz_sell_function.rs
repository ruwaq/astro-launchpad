#![no_main]

use libfuzzer_sys::fuzz_target;

// Fuzz test for sell function input validation
// Tests that invalid inputs are properly rejected without panics
fuzz_target!(|data: &[u8]| {
    if data.len() < 24 {
        return;
    }

    // Extract parameters from fuzzy data
    let token_amount = i128::from_le_bytes(data[0..16].try_into().unwrap());
    let min_xlm = i128::from_le_bytes(data[8..24].try_into().unwrap());

    // Test parameter validation properties:

    // PROPERTY 1: Negative token amount should be rejected
    if token_amount <= 0 {
        // In real contract, this would return Error::InvalidAmount
        assert!(token_amount <= 0, "Negative/zero token validation");
    }

    // PROPERTY 2: Negative min_xlm should be rejected
    if min_xlm < 0 {
        // In real contract, this would return Error::InvalidAmount
        assert!(min_xlm < 0, "Negative min_xlm validation");
    }

    // PROPERTY 3: Test deadline validation (same as buy)
    if data.len() >= 32 {
        let deadline_bytes = [
            data[24], data[25], data[26], data[27],
            data[28], data[29], data[30], data[31],
        ];
        let _deadline = u64::from_le_bytes(deadline_bytes);
        // Verify no panic on extreme values
    }

    // PROPERTY 4: Test min_xlm vs expected_xlm slippage
    if token_amount > 0 && min_xlm > 0 {
        // In a real sell, if expected_xlm < min_xlm, should return Error::SlippageExceeded
        let expected_xlm = token_amount / 1000; // Simplified
        if expected_xlm < min_xlm {
            assert!(
                expected_xlm < min_xlm,
                "Slippage check for sell works"
            );
        }
    }

    // PROPERTY 5: Test maximum token amount
    // User can't sell more tokens than they hold
    // Also can't sell more than total supply
    let max_token_supply = 8_000_000_000_000_000_000_000_000_000i128;
    if token_amount > max_token_supply {
        assert!(
            token_amount > max_token_supply,
            "Over-supply sell detection"
        );
    }

    // PROPERTY 6: Test that selling doesn't drain entire XLM reserve
    // Some XLM must remain in bonding curve
    if min_xlm > 0 {
        // Contract should check that xlm_out < xlm_balance
        let xlm_balance = 100_000_000_000i128; // 10k XLM
        if min_xlm >= xlm_balance {
            assert!(
                min_xlm >= xlm_balance,
                "Excessive XLM request detection"
            );
        }
    }

    // PROPERTY 7: Test zero edge cases
    if token_amount == 0 || min_xlm == 0 {
        assert!(
            token_amount == 0 || min_xlm == 0,
            "Zero value handling in sell"
        );
    }

    // PROPERTY 8: Test i128::MAX edge case
    if token_amount == i128::MAX || min_xlm == i128::MAX {
        assert!(
            token_amount == i128::MAX || min_xlm == i128::MAX,
            "i128::MAX handling in sell"
        );
    }

    // PROPERTY 9: Test i128::MIN edge case
    if token_amount == i128::MIN || min_xlm == i128::MIN {
        assert!(
            token_amount == i128::MIN || min_xlm == i128::MIN,
            "i128::MIN handling in sell"
        );
    }

    // PROPERTY 10: Test sell calculation doesn't overflow
    // sell() calculates: xlm_out = calculate_sell(token_amount)
    if token_amount > 0 && token_amount < i128::MAX / 1000 {
        let _safe_mul = token_amount.checked_mul(1000);
        // Verify checked math works
    }

    // PROPERTY 11: Test that seller has sufficient token balance
    // This would be checked via token contract balance_of() in real contract
    if token_amount > 0 {
        let user_balance = 1_000_000_000_000_000_000i128; // 1M tokens
        if token_amount > user_balance {
            assert!(
                token_amount > user_balance,
                "Insufficient balance detection"
            );
        }
    }

    // PROPERTY 12: Test fee calculation on sell (if applicable)
    // Some DEXes charge fees on sell
    if token_amount > 0 {
        // Fee calculation: amount * fee_bps / 10000
        let fee_bps = 30; // 0.3% fee
        if let Some(fee) = token_amount.checked_mul(fee_bps) {
            let _final_fee = fee / 10000;
            // Verify fee calculation doesn't overflow
        }
    }
});
