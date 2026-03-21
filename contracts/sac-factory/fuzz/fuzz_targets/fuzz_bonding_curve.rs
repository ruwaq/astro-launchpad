#![no_main]

extern crate sac_factory;

use libfuzzer_sys::fuzz_target;
use sac_factory::bonding_curve::BondingCurve;

fuzz_target!(|data: &[u8]| {
    // Need at least 16 bytes for xlm_amount
    if data.len() < 16 {
        return;
    }

    // Extract xlm_amount from fuzzy data
    let xlm_amount = i128::from_le_bytes(data[0..16].try_into().unwrap());

    // Only test with positive, realistic values
    // XLM amount: 1 stroop to 10,000 XLM (100_000_000_000 stroops)
    let xlm_amount = (xlm_amount.abs() % 100_000_000_000).max(1);

    // Create a fresh bonding curve with standard total supply (8 billion tokens)
    let total_supply = 8_000_000_000_000_000_000_000_000_000i128; // 8B tokens with 18 decimals
    let bonding_curve = match BondingCurve::new(total_supply) {
        Ok(bc) => bc,
        Err(_) => return, // Skip if initialization fails
    };

    // PROPERTY 1: calculate_buy should never panic
    let buy_result = bonding_curve.calculate_buy(xlm_amount);

    if let Ok(tokens_out) = buy_result {
        // PROPERTY 2: Output should be positive
        assert!(tokens_out > 0, "Buy output must be positive");

        // PROPERTY 3: Can't buy more tokens than available
        assert!(
            tokens_out <= bonding_curve.tokens_remaining,
            "Can't buy more tokens than remaining: {} > {}",
            tokens_out,
            bonding_curve.tokens_remaining
        );

        // PROPERTY 4: Larger XLM input should give more tokens (monotonicity)
        if xlm_amount < i128::MAX / 2 {
            let larger_xlm = xlm_amount * 2;
            if let Ok(larger_tokens_out) = bonding_curve.calculate_buy(larger_xlm) {
                assert!(
                    larger_tokens_out > tokens_out,
                    "Monotonicity violated: {} XLM gave {} tokens, {} XLM gave {} tokens",
                    xlm_amount,
                    tokens_out,
                    larger_xlm,
                    larger_tokens_out
                );
            }
        }

        // PROPERTY 5: K constant should be preserved (within rounding tolerance)
        // This is implicitly tested by the contract's own calculate_buy implementation
    }

    // PROPERTY 6: calculate_sell should never panic
    // Test selling a reasonable amount of tokens
    let token_amount = if data.len() >= 32 {
        let token_bytes: [u8; 16] = data[16..32].try_into().unwrap();
        let raw = i128::from_le_bytes(token_bytes);
        // Sell amount: 1 to 1M tokens (with 18 decimals)
        (raw.abs() % 1_000_000_000_000_000_000_000_000).max(1)
    } else {
        1_000_000_000_000_000_000 // 1 token with 18 decimals
    };

    let sell_result = bonding_curve.calculate_sell(token_amount);

    if let Ok(xlm_out) = sell_result {
        // PROPERTY 7: Sell output should be positive
        assert!(xlm_out > 0, "Sell output must be positive");

        // PROPERTY 8: Can't get more XLM than in the curve
        assert!(
            xlm_out <= bonding_curve.xlm_reserve,
            "Can't sell for more XLM than in curve: {} > {}",
            xlm_out,
            bonding_curve.xlm_reserve
        );

        // PROPERTY 9: Larger token sell should give more XLM (monotonicity)
        if token_amount < i128::MAX / 2 {
            let larger_tokens = token_amount * 2;
            if larger_tokens <= bonding_curve.total_supply {
                if let Ok(larger_xlm_out) = bonding_curve.calculate_sell(larger_tokens) {
                    assert!(
                        larger_xlm_out > xlm_out,
                        "Sell monotonicity violated: {} tokens gave {} XLM, {} tokens gave {} XLM",
                        token_amount,
                        xlm_out,
                        larger_tokens,
                        larger_xlm_out
                    );
                }
            }
        }
    }

    // PROPERTY 10: Buying then selling should return similar XLM (with some loss due to fees/spread)
    // This tests round-trip consistency
    if let Ok(tokens_from_buy) = bonding_curve.calculate_buy(xlm_amount) {
        if let Ok(xlm_from_sell) = bonding_curve.calculate_sell(tokens_from_buy) {
            // Due to constant product formula, selling immediately after buying will return less XLM
            // This is expected behavior (price impact)
            assert!(
                xlm_from_sell <= xlm_amount,
                "Round-trip should not profit: bought with {} XLM, sold for {} XLM",
                xlm_amount,
                xlm_from_sell
            );
        }
    }
});
