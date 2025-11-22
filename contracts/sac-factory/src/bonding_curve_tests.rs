//! Bonding Curve Math Tests
//! Sprint 2 - Comprehensive coverage for bonding curve calculations

#[cfg(test)]
mod bonding_curve_tests {
    use crate::bonding_curve::BondingCurve;
    use crate::errors::Error;

    const BONDING_CURVE_SUPPLY: i128 = 800_000_000_0000000; // 800M tokens

    // ========== Creation Tests ==========

    #[test]
    fn test_new_bonding_curve_success() {
        let curve = BondingCurve::new(BONDING_CURVE_SUPPLY).unwrap();

        assert_eq!(curve.total_supply, BONDING_CURVE_SUPPLY);
        assert_eq!(curve.tokens_sold, 0);
        assert_eq!(curve.tokens_remaining, BONDING_CURVE_SUPPLY);
        assert!(curve.xlm_reserve > 0);
        assert!(curve.k > 0);
    }

    #[test]
    fn test_new_bonding_curve_zero_supply_fails() {
        let result = BondingCurve::new(0);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), Error::InvalidAmount);
    }

    #[test]
    fn test_new_bonding_curve_negative_supply_fails() {
        let result = BondingCurve::new(-100);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), Error::InvalidAmount);
    }

    // ========== Buy Calculation Tests ==========

    #[test]
    fn test_calculate_buy_small_amount() {
        let curve = BondingCurve::new(BONDING_CURVE_SUPPLY).unwrap();
        let xlm_in = 1_0000000; // 1 XLM

        let tokens_out = curve.calculate_buy(xlm_in).unwrap();
        assert!(tokens_out > 0);
        assert!(tokens_out < curve.tokens_remaining);
    }

    #[test]
    fn test_calculate_buy_large_amount() {
        let curve = BondingCurve::new(BONDING_CURVE_SUPPLY).unwrap();
        let xlm_in = 1000_0000000; // 1000 XLM

        let tokens_out = curve.calculate_buy(xlm_in).unwrap();
        assert!(tokens_out > 0);
        assert!(tokens_out < curve.tokens_remaining);
    }

    #[test]
    fn test_calculate_buy_zero_amount_fails() {
        let curve = BondingCurve::new(BONDING_CURVE_SUPPLY).unwrap();
        let result = curve.calculate_buy(0);

        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), Error::InvalidAmount);
    }

    #[test]
    fn test_calculate_buy_negative_amount_fails() {
        let curve = BondingCurve::new(BONDING_CURVE_SUPPLY).unwrap();
        let result = curve.calculate_buy(-100);

        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), Error::InvalidAmount);
    }

    #[test]
    fn test_buy_price_increases() {
        let curve = BondingCurve::new(BONDING_CURVE_SUPPLY).unwrap();
        let xlm_amount = 10_0000000; // 10 XLM

        // First buy
        let tokens_first = curve.calculate_buy(xlm_amount).unwrap();

        // Execute first buy
        let mut curve_after = curve.clone();
        curve_after.execute_buy(xlm_amount, tokens_first).unwrap();

        // Second buy (same amount)
        let tokens_second = curve_after.calculate_buy(xlm_amount).unwrap();

        // Price should increase (get fewer tokens for same XLM)
        assert!(tokens_second < tokens_first, "Second buy should get fewer tokens");
    }

    // ========== Sell Calculation Tests ==========

    #[test]
    fn test_calculate_sell_small_amount() {
        let mut curve = BondingCurve::new(BONDING_CURVE_SUPPLY).unwrap();

        // Buy some tokens first
        let xlm_in = 100_0000000;
        let tokens_bought = curve.calculate_buy(xlm_in).unwrap();
        curve.execute_buy(xlm_in, tokens_bought).unwrap();

        // Sell half
        let tokens_to_sell = tokens_bought / 2;
        let xlm_out = curve.calculate_sell(tokens_to_sell).unwrap();

        assert!(xlm_out > 0);
        assert!(xlm_out < xlm_in); // Should get less than bought due to price change
    }

    #[test]
    fn test_calculate_sell_zero_amount_fails() {
        let curve = BondingCurve::new(BONDING_CURVE_SUPPLY).unwrap();
        let result = curve.calculate_sell(0);

        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), Error::InvalidAmount);
    }

    #[test]
    fn test_calculate_sell_negative_amount_fails() {
        let curve = BondingCurve::new(BONDING_CURVE_SUPPLY).unwrap();
        let result = curve.calculate_sell(-100);

        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), Error::InvalidAmount);
    }

    // ========== Execute Buy Tests ==========

    #[test]
    fn test_execute_buy_updates_state() {
        let mut curve = BondingCurve::new(BONDING_CURVE_SUPPLY).unwrap();
        let xlm_in = 10_0000000;
        let tokens_out = curve.calculate_buy(xlm_in).unwrap();

        let initial_tokens_remaining = curve.tokens_remaining;
        let initial_xlm_reserve = curve.xlm_reserve;

        curve.execute_buy(xlm_in, tokens_out).unwrap();

        assert_eq!(curve.tokens_sold, tokens_out);
        assert_eq!(curve.tokens_remaining, initial_tokens_remaining - tokens_out);
        assert_eq!(curve.xlm_reserve, initial_xlm_reserve + xlm_in);
    }

    #[test]
    fn test_execute_buy_maintains_k_invariant() {
        let mut curve = BondingCurve::new(BONDING_CURVE_SUPPLY).unwrap();
        let k_initial = curve.k;

        let xlm_in = 100_0000000;
        let tokens_out = curve.calculate_buy(xlm_in).unwrap();
        curve.execute_buy(xlm_in, tokens_out).unwrap();

        // K should remain approximately constant (allow small rounding error)
        let k_after = curve.xlm_reserve * curve.tokens_remaining;
        let k_diff = if k_after > k_initial {
            k_after - k_initial
        } else {
            k_initial - k_after
        };

        // Allow 0.01% tolerance for rounding errors
        let tolerance = k_initial / 10000;
        assert!(k_diff < tolerance, "K invariant broken: diff {} exceeds tolerance {}", k_diff, tolerance);
    }

    // ========== Execute Sell Tests ==========

    #[test]
    fn test_execute_sell_updates_state() {
        let mut curve = BondingCurve::new(BONDING_CURVE_SUPPLY).unwrap();

        // Buy first
        let xlm_in = 100_0000000;
        let tokens_bought = curve.calculate_buy(xlm_in).unwrap();
        curve.execute_buy(xlm_in, tokens_bought).unwrap();

        // Now sell
        let tokens_to_sell = tokens_bought / 2;
        let xlm_out = curve.calculate_sell(tokens_to_sell).unwrap();

        let tokens_sold_before = curve.tokens_sold;
        let xlm_reserve_before = curve.xlm_reserve;

        // execute_sell(xlm_out, tokens_in) - correct parameter order
        curve.execute_sell(xlm_out, tokens_to_sell).unwrap();

        assert_eq!(curve.tokens_sold, tokens_sold_before - tokens_to_sell);
        assert_eq!(curve.xlm_reserve, xlm_reserve_before - xlm_out);
    }

    #[test]
    fn test_execute_sell_maintains_k_invariant() {
        let mut curve = BondingCurve::new(BONDING_CURVE_SUPPLY).unwrap();

        // Buy first
        let xlm_in = 100_0000000;
        let tokens_bought = curve.calculate_buy(xlm_in).unwrap();
        curve.execute_buy(xlm_in, tokens_bought).unwrap();

        let k_before_sell = curve.k;

        // Sell
        let tokens_to_sell = tokens_bought / 2;
        let xlm_out = curve.calculate_sell(tokens_to_sell).unwrap();
        curve.execute_sell(xlm_out, tokens_to_sell).unwrap(); // Fixed parameter order

        // K should remain approximately constant (allow small rounding error)
        let k_after = curve.xlm_reserve * curve.tokens_remaining;
        let k_diff = if k_after > k_before_sell {
            k_after - k_before_sell
        } else {
            k_before_sell - k_after
        };

        let tolerance = k_before_sell / 10000;
        assert!(k_diff < tolerance);
    }

    // ========== Price Tests ==========

    #[test]
    fn test_get_current_price() {
        let curve = BondingCurve::new(BONDING_CURVE_SUPPLY).unwrap();
        let price = curve.get_current_price();

        assert!(price > 0);
    }

    #[test]
    fn test_price_increases_after_buys() {
        let mut curve = BondingCurve::new(BONDING_CURVE_SUPPLY).unwrap();

        let price_initial = curve.get_current_price();

        // Execute buy
        let xlm_in = 1000_0000000;
        let tokens_out = curve.calculate_buy(xlm_in).unwrap();
        curve.execute_buy(xlm_in, tokens_out).unwrap();

        let price_after = curve.get_current_price();

        assert!(price_after > price_initial);
    }

    #[test]
    fn test_price_decreases_after_sells() {
        let mut curve = BondingCurve::new(BONDING_CURVE_SUPPLY).unwrap();

        // Buy first
        let xlm_in = 1000_0000000;
        let tokens_bought = curve.calculate_buy(xlm_in).unwrap();
        curve.execute_buy(xlm_in, tokens_bought).unwrap();

        let price_before_sell = curve.get_current_price();

        // Sell
        let tokens_to_sell = tokens_bought / 2;
        let xlm_out = curve.calculate_sell(tokens_to_sell).unwrap();
        curve.execute_sell(tokens_to_sell, xlm_out).unwrap();

        let price_after_sell = curve.get_current_price();

        assert!(price_after_sell < price_before_sell);
    }

    // ========== Edge Cases ==========

    #[test]
    fn test_multiple_buys_and_sells() {
        let mut curve = BondingCurve::new(BONDING_CURVE_SUPPLY).unwrap();
        let k_initial = curve.k;

        // Multiple buy/sell cycles
        for _ in 0..5 {
            // Buy
            let xlm_in = 50_0000000;
            let tokens_out = curve.calculate_buy(xlm_in).unwrap();
            curve.execute_buy(xlm_in, tokens_out).unwrap();

            // Sell half
            let tokens_to_sell = tokens_out / 2;
            let xlm_out = curve.calculate_sell(tokens_to_sell).unwrap();
            curve.execute_sell(xlm_out, tokens_to_sell).unwrap(); // Fixed parameter order
        }

        // K should still be approximately maintained (allow rounding errors)
        let k_final = curve.xlm_reserve * curve.tokens_remaining;
        let k_diff = if k_final > k_initial {
            k_final - k_initial
        } else {
            k_initial - k_final
        };

        // Allow 0.1% tolerance for accumulated rounding errors
        let tolerance = k_initial / 1000;
        assert!(k_diff < tolerance);
    }

    #[test]
    fn test_buy_sell_roundtrip_approximately_equal() {
        let mut curve = BondingCurve::new(BONDING_CURVE_SUPPLY).unwrap();

        let initial_xlm = 100_0000000;

        // Buy
        let tokens_bought = curve.calculate_buy(initial_xlm).unwrap();
        curve.execute_buy(initial_xlm, tokens_bought).unwrap();

        // Sell immediately
        let xlm_received = curve.calculate_sell(tokens_bought).unwrap();
        curve.execute_sell(xlm_received, tokens_bought).unwrap(); // Fixed parameter order

        // Due to rounding, value should be approximately equal (within 1%)
        // In some cases might be slightly more or less
        let diff = if xlm_received > initial_xlm {
            xlm_received - initial_xlm
        } else {
            initial_xlm - xlm_received
        };

        let tolerance = initial_xlm / 100; // 1% tolerance
        assert!(diff <= tolerance, "Roundtrip diff {} exceeds tolerance {}", diff, tolerance);
    }

    #[test]
    fn test_large_buy_high_slippage() {
        let curve = BondingCurve::new(BONDING_CURVE_SUPPLY).unwrap();

        // Small buy
        let small_xlm = 10_0000000;
        let small_tokens = curve.calculate_buy(small_xlm).unwrap();

        // Large buy (100x)
        let large_xlm = 1000_0000000;
        let large_tokens = curve.calculate_buy(large_xlm).unwrap();

        // Large buy should get proportionally fewer tokens (higher slippage)
        // If no slippage: large would get 100x tokens
        let expected_if_no_slippage = small_tokens * 100;
        assert!(large_tokens < expected_if_no_slippage, "Large buy should have slippage");
    }
}
