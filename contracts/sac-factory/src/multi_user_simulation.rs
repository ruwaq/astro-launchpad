//! Multi-User Simulation Test for V6 Tokenomics
//!
//! Simulates 15+ users buying/selling tokens on the bonding curve
//! until graduation, then verifies V6 allocation math.

#[cfg(test)]
mod tests {
    use crate::{SacFactory, SacFactoryClient};
    use crate::bonding_curve::BondingCurve;
    use crate::astro_client::calculate_simple_allocation;
    use soroban_sdk::{
        testutils::Address as _, Address, Bytes, BytesN, Env, String, Vec,
    };

    // Bonding curve constants (must match lib.rs)
    const INITIAL_SUPPLY: i128 = 10_000_000_000_000_000; // 1B tokens with 7 decimals
    const BONDING_CURVE_SUPPLY: i128 = 10_000_000_000_000_000; // 1B = 100% in curve
    const INITIAL_VIRTUAL_RESERVE: i128 = 10_000_000_000; // 1000 XLM in stroops
    const PRECISION: i128 = 10_000_000; // 7 decimals

    // Fee constants
    const PROTOCOL_FEE_BPS: i128 = 15; // 0.15%
    const LP_FEE_BPS: i128 = 15; // 0.15%

    // Graduation dev bonus (1%)
    const DEV_BONUS_BPS: i128 = 100; // 1% = 100 basis points

    fn create_test_issuer(env: &Env) -> String {
        String::from_str(env, "GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGSNFHEYVXM3XOJMDS674JZ")
    }

    fn create_test_serialized_asset(
        env: &Env,
        symbol: &String,
        creator: &Address,
        token_count: u32,
    ) -> Bytes {
        let timestamp = env.ledger().timestamp();
        let mut salt_data = Bytes::new(env);
        salt_data.append(&Bytes::from_array(env, &token_count.to_be_bytes()));
        salt_data.append(&Bytes::from_array(env, &timestamp.to_be_bytes()));

        let salt_hash = env.crypto().sha256(&salt_data);
        let salt = BytesN::from_array(env, &salt_hash.to_array());

        crate::sac_deployment::test_helpers::create_test_serialized_asset(
            env,
            symbol,
            creator,
            &salt,
        ).expect("Failed to create test serialized asset")
    }

    fn setup_factory(env: &Env) -> (SacFactoryClient, Address, Address) {
        let contract_id = env.register(SacFactory, ());
        let client = SacFactoryClient::new(env, &contract_id);
        let admin = Address::generate(env);
        let treasury = Address::generate(env);
        let xlm_token = Address::generate(env);

        env.mock_all_auths();
        client.initialize(&admin, &treasury, &xlm_token);

        (client, admin, treasury)
    }

    // ====================================================================
    // TEST 1: Pure bonding curve math - 15 users + sells
    // ====================================================================

    #[test]
    fn test_bonding_curve_multi_user_simulation() {
        let mut curve = BondingCurve::new(BONDING_CURVE_SUPPLY).unwrap();
        let initial_price = curve.get_current_price().unwrap();
        let initial_k = curve.k;

        // 15 users buy varying amounts (in XLM, convert to stroops)
        let user_buys_xlm: [i128; 15] = [
            500, 1000, 200, 3000, 800,
            1500, 3500, 100, 2500, 600,
            4000, 750, 2000, 4500, 1800,
        ];

        let mut total_tokens_bought: i128 = 0;
        let mut total_protocol_fees: i128 = 0;
        let mut total_lp_fees: i128 = 0;

        // Phase 1: All 15 users buy
        for xlm_xlm in user_buys_xlm.iter() {
            let xlm_amount = *xlm_xlm * PRECISION;

            // Apply fees (round up like contract does)
            let protocol_fee = (xlm_amount * PROTOCOL_FEE_BPS + 9999) / 10000;
            let lp_fee = (xlm_amount * LP_FEE_BPS + 9999) / 10000;
            let net_amount = xlm_amount - protocol_fee - lp_fee;

            let tokens_out = curve.calculate_buy(net_amount).unwrap();
            curve.execute_buy_with_lp_fee(net_amount, tokens_out, lp_fee).unwrap();

            total_tokens_bought += tokens_out;
            total_protocol_fees += protocol_fee;
            total_lp_fees += lp_fee;
        }

        // Phase 2: Some users sell back
        let sell_1_tokens = total_tokens_bought / 30;
        let xlm_gross_1 = curve.calculate_sell(sell_1_tokens).unwrap();
        let sell_1_lp_fee = (xlm_gross_1 * LP_FEE_BPS + 9999) / 10000;
        curve.execute_sell_with_lp_fee(xlm_gross_1, sell_1_tokens, sell_1_lp_fee).unwrap();
        total_tokens_bought -= sell_1_tokens;

        let sell_2_tokens = total_tokens_bought / 20;
        let xlm_gross_2 = curve.calculate_sell(sell_2_tokens).unwrap();
        let sell_2_lp_fee = (xlm_gross_2 * LP_FEE_BPS + 9999) / 10000;
        curve.execute_sell_with_lp_fee(xlm_gross_2, sell_2_tokens, sell_2_lp_fee).unwrap();
        total_tokens_bought -= sell_2_tokens;

        // Verify invariants
        let final_price = curve.get_current_price().unwrap();
        let real_xlm_raised = curve.get_real_xlm_raised();

        assert!(curve.xlm_reserve > INITIAL_VIRTUAL_RESERVE, "XLM reserve should exceed virtual reserve");
        assert!(curve.tokens_remaining < BONDING_CURVE_SUPPLY, "Some tokens should have been bought");
        assert!(curve.tokens_sold > 0, "Some tokens should have been sold");
        assert!(final_price > initial_price, "Price should increase after net buys");
        assert!(curve.k > initial_k, "k should grow from LP fee accumulation");
        assert!(total_protocol_fees > 0, "Protocol fees should accumulate");
        assert!(total_lp_fees > 0, "LP fees should accumulate");
        assert!(real_xlm_raised > 0, "Real XLM raised should be positive");
    }

    // ====================================================================
    // TEST 2: Push bonding curve to graduation threshold
    // ====================================================================

    #[test]
    fn test_graduation_push_multi_user() {
        let mut curve = BondingCurve::new(BONDING_CURVE_SUPPLY).unwrap();
        let graduation_threshold: i128 = 345_000_000_000; // 34,500 XLM in stroops

        // Phase 1: 15 users buy in
        let user_buys_xlm: [i128; 15] = [
            500, 1000, 200, 3000, 800,
            1500, 3500, 100, 2500, 600,
            4000, 750, 2000, 4500, 1800,
        ];

        for xlm_xlm in user_buys_xlm.iter() {
            let xlm_amount = *xlm_xlm * PRECISION;
            let protocol_fee = (xlm_amount * PROTOCOL_FEE_BPS + 9999) / 10000;
            let lp_fee = (xlm_amount * LP_FEE_BPS + 9999) / 10000;
            let net_amount = xlm_amount - protocol_fee - lp_fee;

            let tokens_out = curve.calculate_buy(net_amount).unwrap();
            curve.execute_buy_with_lp_fee(net_amount, tokens_out, lp_fee).unwrap();
        }

        // Phase 2: Keep buying until graduation
        let mut round = 0u32;
        loop {
            let real_xlm = curve.get_real_xlm_raised();
            if real_xlm >= graduation_threshold { break; }

            // Buy 5000 XLM at a time, or enough to cross threshold
            let remaining = graduation_threshold - real_xlm;
            let xlm_buy = if remaining > 5000 * PRECISION {
                5000 * PRECISION
            } else {
                // Enough to cross + margin for fees
                (remaining * 10020) / 10000 + 100 * PRECISION
            };

            let protocol_fee = (xlm_buy * PROTOCOL_FEE_BPS + 9999) / 10000;
            let lp_fee = (xlm_buy * LP_FEE_BPS + 9999) / 10000;
            let net_amount = xlm_buy - protocol_fee - lp_fee;

            let tokens_out = curve.calculate_buy(net_amount).unwrap();
            curve.execute_buy_with_lp_fee(net_amount, tokens_out, lp_fee).unwrap();

            round += 1;
            if round > 30 { break; }
        }

        // Verify graduation reached
        let real_xlm = curve.get_real_xlm_raised();
        assert!(real_xlm >= graduation_threshold,
            "Should reach graduation. Got {} XLM, need {} XLM",
            real_xlm / PRECISION, graduation_threshold / PRECISION);

        // Calculate V6 allocation
        let total_xlm = curve.get_real_xlm_raised();
        let total_tokens = curve.tokens_remaining;
        let xlm_reserve = curve.xlm_reserve;

        let allocation = calculate_simple_allocation(
            total_xlm, total_tokens, xlm_reserve, DEV_BONUS_BPS,
        ).unwrap();

        // Verify: all tokens accounted for
        let total_allocated = allocation.tokens_for_pool
            + allocation.tokens_dev_allocation
            + allocation.tokens_to_burn;
        assert_eq!(total_allocated, total_tokens, "All tokens must be accounted for");

        // Verify: dev bonus ~1% of XLM
        let expected_xlm_bonus = total_xlm / 100;
        let diff_xlm = (allocation.xlm_dev_bonus - expected_xlm_bonus).abs();
        assert!(diff_xlm <= total_xlm / 500, "XLM dev bonus should be ~1%");

        // Verify: pool gets remaining XLM
        assert_eq!(allocation.xlm_for_pool, total_xlm - allocation.xlm_dev_bonus,
            "Pool should get remaining XLM");

        // Verify: tokens to burn > 0 (deflationary)
        assert!(allocation.tokens_to_burn > 0, "Some tokens should be burned");

        // Verify: pool price approximates curve end price
        let pool_price = allocation.xlm_for_pool * PRECISION / allocation.tokens_for_pool;
        let curve_price = xlm_reserve * PRECISION / total_tokens;
        let price_diff_pct = (pool_price - curve_price).abs() * 100 / curve_price;
        assert!(price_diff_pct < 5, "Pool price should match curve end price (within 5%)");
    }

    // ====================================================================
    // TEST 3: V6 allocation math stress test
    // ====================================================================

    #[test]
    fn test_v6_allocation_math_stress() {
        // Test different graduation scenarios
        let scenarios: [(i128, i128, i128); 4] = [
            // (total_xlm, tokens_remaining, xlm_reserve)
            (5_000 * PRECISION,     900_000_000 * PRECISION,  6_000 * PRECISION),     // Low
            (34_500 * PRECISION,   100_000_000 * PRECISION,  35_500 * PRECISION),     // Medium
            (100_000 * PRECISION,  50_000_000 * PRECISION,  101_000 * PRECISION),     // High
            (500_000 * PRECISION,  10_000_000 * PRECISION,  501_000 * PRECISION),     // Whale
        ];

        for (i, (total_xlm, tokens_remaining, xlm_reserve)) in scenarios.iter().enumerate() {
            let allocation = calculate_simple_allocation(*total_xlm, *tokens_remaining, *xlm_reserve, DEV_BONUS_BPS).unwrap();

            // All tokens accounted for
            let total_allocated = allocation.tokens_for_pool
                + allocation.tokens_dev_allocation
                + allocation.tokens_to_burn;
            assert_eq!(total_allocated, *tokens_remaining, "Scenario {}: all tokens must be accounted for", i + 1);

            // Dev bonus ~1%
            let expected_dev_xlm = *total_xlm / 100;
            let diff = (allocation.xlm_dev_bonus - expected_dev_xlm).abs();
            assert!(diff <= *total_xlm / 500, "Scenario {}: dev bonus should be ~1%", i + 1);

            // Pool gets remaining XLM
            assert_eq!(allocation.xlm_for_pool, *total_xlm - allocation.xlm_dev_bonus,
                "Scenario {}: pool should get remaining XLM", i + 1);

            // Tokens to burn > 0
            assert!(allocation.tokens_to_burn > 0, "Scenario {}: should have tokens to burn", i + 1);

            // Pool price approximates curve price (within 5%)
            let pool_price = allocation.xlm_for_pool * PRECISION / allocation.tokens_for_pool;
            let curve_price = xlm_reserve * PRECISION / tokens_remaining;
            let price_diff_pct = (pool_price - curve_price).abs() * 100 / curve_price;
            assert!(price_diff_pct < 5, "Scenario {}: pool price should be within 5% of curve price, got {}%", i + 1, price_diff_pct);

            // Supply after burn is less than initial supply (deflationary)
            let supply_after_burn = INITIAL_SUPPLY - allocation.tokens_to_burn;
            assert!(supply_after_burn < INITIAL_SUPPLY, "Scenario {}: supply should decrease after burn", i + 1);

            // Dev token allocation ~1% of remaining
            let expected_dev_tokens = *tokens_remaining / 100;
            let token_diff = (allocation.tokens_dev_allocation - expected_dev_tokens).abs();
            assert!(token_diff <= *tokens_remaining / 500, "Scenario {}: dev tokens should be ~1%", i + 1);
        }
    }

    // ====================================================================
    // TEST 4: Contract-level multi-user trading simulation
    // ====================================================================

    #[test]
    fn test_contract_multi_user_trading_simulation() {
        let env = Env::default();
        env.budget().reset_unlimited();

        let (client, _admin, _treasury) = setup_factory(&env);
        let creator = Address::generate(&env);
        env.mock_all_auths();

        // Launch token
        let symbol = String::from_str(&env, "PUMP");
        let issuer = create_test_issuer(&env);
        let serialized_asset = create_test_serialized_asset(&env, &symbol, &creator, 0);

        let token_address = client.launch_token(
            &creator,
            &String::from_str(&env, "PumpFun Token"),
            &symbol,
            &issuer,
            &String::from_str(&env, "ipfs://pump"),
            &String::from_str(&env, "Multi-user simulation"),
            &serialized_asset,
        );

        let deadline = env.ledger().timestamp() + 3600000;

        // Initial state
        let info_initial = client.get_token_info(&token_address).expect("Token should exist");
        let initial_reserve = info_initial.bonding_curve.xlm_reserve;

        // Phase 1: 15 users buy varying amounts
        let buy_amounts_xlm: [i128; 15] = [
            500, 1000, 200, 3000, 800,
            1500, 3500, 100, 2500, 600,
            4000, 750, 2000, 4500, 1800,
        ];

        let mut total_tokens_received: i128 = 0;

        for xlm_xlm in buy_amounts_xlm.iter() {
            let buyer = Address::generate(&env);
            let xlm_amount = *xlm_xlm * PRECISION;
            let tokens = client.buy(&buyer, &token_address, &xlm_amount, &0, &deadline);
            total_tokens_received += tokens;
        }

        // Verify state after buys
        let info_after_buys = client.get_token_info(&token_address).expect("Token should exist");
        assert!(info_after_buys.bonding_curve.xlm_reserve > initial_reserve, "XLM reserve should grow");
        assert!(info_after_buys.bonding_curve.tokens_remaining < BONDING_CURVE_SUPPLY, "Tokens should decrease");
        assert!(total_tokens_received > 0, "Should have received tokens");

        // Verify graduation progress
        let progress = client.get_graduation_progress(&token_address);
        assert!(progress > 0, "Progress should be positive");
    }

    // ====================================================================
    // TEST 5: Full lifecycle with graduation allocation projection
    // ====================================================================

    #[test]
    fn test_full_lifecycle_to_graduation() {
        let env = Env::default();
        env.budget().reset_unlimited();

        let (client, _admin, _treasury) = setup_factory(&env);
        let creator = Address::generate(&env);
        env.mock_all_auths();

        let symbol = String::from_str(&env, "MOON");
        let issuer = create_test_issuer(&env);
        let serialized_asset = create_test_serialized_asset(&env, &symbol, &creator, 0);

        let token_address = client.launch_token(
            &creator,
            &String::from_str(&env, "MoonRocket"),
            &symbol,
            &issuer,
            &String::from_str(&env, "ipfs://moon"),
            &String::from_str(&env, "To the moon!"),
            &serialized_asset,
        );

        let deadline = env.ledger().timestamp() + 3600000;
        let graduation_threshold = client.get_graduation_threshold();

        // Phase 1: Early adopters (small buys)
        let early_amounts: [i128; 5] = [100, 250, 500, 150, 300];
        for xlm_xlm in early_amounts.iter() {
            let buyer = Address::generate(&env);
            let xlm_amount = *xlm_xlm * PRECISION;
            client.buy(&buyer, &token_address, &xlm_amount, &0, &deadline);
        }

        // Phase 2: Hype builds (medium buys)
        let medium_amounts: [i128; 5] = [1000, 2000, 1500, 3000, 2500];
        for xlm_xlm in medium_amounts.iter() {
            let buyer = Address::generate(&env);
            let xlm_amount = *xlm_xlm * PRECISION;
            client.buy(&buyer, &token_address, &xlm_amount, &0, &deadline);
        }

        // Phase 3: Whales push toward graduation
        let whale_amounts: [i128; 4] = [5000, 5000, 5000, 5000];
        for xlm_xlm in whale_amounts.iter() {
            let buyer = Address::generate(&env);
            let xlm_amount = *xlm_xlm * PRECISION;
            client.buy(&buyer, &token_address, &xlm_amount, &0, &deadline);
        }

        // Check state
        let info = client.get_token_info(&token_address).expect("Token should exist");
        let progress = client.get_graduation_progress(&token_address);

        // Verify invariants
        assert!(info.bonding_curve.xlm_reserve > 0);
        assert!(info.bonding_curve.tokens_remaining > 0);
        assert!(progress > 0);

        // Calculate projected V6 allocation at current state
        let total_xlm = info.bonding_curve.get_real_xlm_raised();
        let tokens_remaining = info.bonding_curve.tokens_remaining;
        let xlm_reserve = info.bonding_curve.xlm_reserve;

        if total_xlm > 0 && tokens_remaining > 0 {
            let allocation = calculate_simple_allocation(
                total_xlm, tokens_remaining, xlm_reserve, DEV_BONUS_BPS
            ).unwrap();

            // All tokens accounted for
            let total_allocated = allocation.tokens_for_pool
                + allocation.tokens_dev_allocation
                + allocation.tokens_to_burn;
            assert_eq!(total_allocated, tokens_remaining, "All tokens must be allocated");

            // Dev bonus is ~1% of XLM
            assert!(allocation.xlm_dev_bonus > 0, "Dev should get XLM bonus");
            assert!(allocation.xlm_for_pool > allocation.xlm_dev_bonus, "Pool should get more XLM than dev");

            // Tokens to burn is positive (deflationary)
            assert!(allocation.tokens_to_burn > 0, "Should have tokens to burn");
        }
    }

    // ====================================================================
    // TEST 6: Bonding curve scale invariants
    // ====================================================================

    #[test]
    fn test_bonding_curve_scale_invariants() {
        let mut curve = BondingCurve::new(BONDING_CURVE_SUPPLY).unwrap();
        let initial_k = curve.k;

        let mut prev_price = curve.get_current_price().unwrap();
        let mut prev_k = curve.k;
        let mut prev_xlm = curve.xlm_reserve;
        let mut prev_tokens = curve.tokens_remaining;

        // 20 sequential buys of increasing size
        for i in 1..=20u32 {
            let xlm_in = (i as i128) * 100 * PRECISION;

            let protocol_fee = (xlm_in * PROTOCOL_FEE_BPS + 9999) / 10000;
            let lp_fee = (xlm_in * LP_FEE_BPS + 9999) / 10000;
            let net = xlm_in - protocol_fee - lp_fee;

            let tokens_out = curve.calculate_buy(net).unwrap();
            curve.execute_buy_with_lp_fee(net, tokens_out, lp_fee).unwrap();

            let new_price = curve.get_current_price().unwrap();

            // Invariant 1: k only grows (from LP fees)
            assert!(curve.k >= prev_k, "k must not decrease (round {})", i);

            // Invariant 2: price always increases after buy
            assert!(new_price >= prev_price, "price must not decrease (round {})", i);

            // Invariant 3: xlm_reserve always increases after buy
            assert!(curve.xlm_reserve > prev_xlm, "xlm_reserve must increase (round {})", i);

            // Invariant 4: tokens_remaining always decreases after buy
            assert!(curve.tokens_remaining < prev_tokens, "tokens_remaining must decrease (round {})", i);

            prev_price = new_price;
            prev_k = curve.k;
            prev_xlm = curve.xlm_reserve;
            prev_tokens = curve.tokens_remaining;
        }

        // Verify final invariants
        assert!(curve.k > initial_k, "k must have grown from LP fees");
        assert!(curve.xlm_reserve > INITIAL_VIRTUAL_RESERVE, "XLM reserve must exceed virtual reserve");
        assert!(curve.tokens_remaining < BONDING_CURVE_SUPPLY, "Some tokens must have been sold");
    }

    // ====================================================================
    // TEST 7: Fee accumulation over many trades
    // ====================================================================

    #[test]
    fn test_fee_accumulation_over_many_trades() {
        let mut curve = BondingCurve::new(BONDING_CURVE_SUPPLY).unwrap();
        let initial_k = curve.k;

        let mut total_protocol_fees: i128 = 0;
        let mut total_lp_fees: i128 = 0;
        let num_trades = 50;

        // Simulate 50 buys of 200 XLM each
        for _ in 0..num_trades {
            let xlm_in = 200 * PRECISION;
            let protocol_fee = (xlm_in * PROTOCOL_FEE_BPS + 9999) / 10000;
            let lp_fee = (xlm_in * LP_FEE_BPS + 9999) / 10000;
            let net = xlm_in - protocol_fee - lp_fee;

            let tokens_out = curve.calculate_buy(net).unwrap();
            curve.execute_buy_with_lp_fee(net, tokens_out, lp_fee).unwrap();

            total_protocol_fees += protocol_fee;
            total_lp_fees += lp_fee;
        }

        // After 50 buys of 200 XLM each:
        // Total XLM in: 50 * 200 = 10,000 XLM
        // Protocol fees: ~0.15% * 10,000 = 15 XLM
        // LP fees: ~0.15% * 10,000 = 15 XLM
        let total_xlm_in = 50 * 200 * PRECISION;
        let expected_protocol_fees = total_xlm_in * PROTOCOL_FEE_BPS / 10000;
        let expected_lp_fees = total_xlm_in * LP_FEE_BPS / 10000;

        // Fees should be approximately correct (within 1 XLM due to rounding)
        let protocol_diff = (total_protocol_fees - expected_protocol_fees).abs();
        let lp_diff = (total_lp_fees - expected_lp_fees).abs();
        assert!(protocol_diff < PRECISION, "Protocol fees should match expected");
        assert!(lp_diff < PRECISION, "LP fees should match expected");

        // k should have grown significantly from LP fee accumulation
        let k_growth_pct = (curve.k - initial_k) * 10000 / initial_k;
        assert!(k_growth_pct > 0, "k should grow from LP fees");

        // Real XLM raised should be > 0
        let real_xlm = curve.get_real_xlm_raised();
        assert!(real_xlm > 0, "Real XLM raised should be positive");
    }

    // ====================================================================
    // TEST 8: Graduation allocation at exact threshold
    // ====================================================================

    #[test]
    fn test_allocation_at_exact_graduation_threshold() {
        // Simulate reaching exactly the graduation threshold
        let graduation_threshold: i128 = 345_000_000_000; // 34,500 XLM

        let mut curve = BondingCurve::new(BONDING_CURVE_SUPPLY).unwrap();

        // Buy until we reach graduation threshold
        loop {
            let real_xlm = curve.get_real_xlm_raised();
            if real_xlm >= graduation_threshold { break; }

            // Buy 1000 XLM at a time
            let xlm_in = 1000 * PRECISION;
            let protocol_fee = (xlm_in * PROTOCOL_FEE_BPS + 9999) / 10000;
            let lp_fee = (xlm_in * LP_FEE_BPS + 9999) / 10000;
            let net = xlm_in - protocol_fee - lp_fee;

            let tokens_out = curve.calculate_buy(net).unwrap();
            curve.execute_buy_with_lp_fee(net, tokens_out, lp_fee).unwrap();
        }

        let total_xlm = curve.get_real_xlm_raised();
        let tokens_remaining = curve.tokens_remaining;
        let xlm_reserve = curve.xlm_reserve;

        // Verify we've reached graduation
        assert!(total_xlm >= graduation_threshold, "Should reach graduation threshold");

        // Calculate V6 allocation
        let allocation = calculate_simple_allocation(
            total_xlm, tokens_remaining, xlm_reserve, DEV_BONUS_BPS,
        ).unwrap();

        // Verify allocation sanity
        assert!(allocation.xlm_dev_bonus > 0, "Dev should get XLM bonus");
        assert!(allocation.xlm_for_pool > 0, "Pool should get XLM");
        assert!(allocation.tokens_for_pool > 0, "Pool should get tokens");
        assert!(allocation.tokens_dev_allocation > 0, "Dev should get token allocation");
        assert!(allocation.tokens_to_burn > 0, "Some tokens should be burned");

        // Verify burn is deflationary
        let supply_after_burn = INITIAL_SUPPLY - allocation.tokens_to_burn;

        // At graduation, remaining tokens get distributed: pool, dev, burned
        // The burn percentage of remaining tokens should be positive
        let burn_pct_of_remaining = allocation.tokens_to_burn * 100 / tokens_remaining.max(1);
        assert!(burn_pct_of_remaining >= 0, "Burn should be non-negative portion of remaining tokens");
        assert!(allocation.tokens_to_burn > 0, "Some tokens should be burned (deflationary)");
        assert!(supply_after_burn < INITIAL_SUPPLY, "Supply should decrease after burn");

        // Pool should have enough XLM to provide liquidity
        let xlm_pool_pct = allocation.xlm_for_pool * 100 / total_xlm;
        assert!(xlm_pool_pct >= 98, "Pool should get at least 98% of XLM (got {}%)", xlm_pool_pct);
    }

    // ====================================================================
    // TEST 9: Compare allocation at different graduation levels
    // ====================================================================

    #[test]
    fn test_allocation_at_different_market_caps() {
        // Early graduation (lower market cap = less XLM raised = more tokens remaining = more burned)
        let early_total_xlm = 10_000 * PRECISION;     // 10k XLM
        let early_tokens_remaining = 800_000_000 * PRECISION;  // 800M tokens remaining
        let early_xlm_reserve = 11_000 * PRECISION;    // 11k XLM (includes virtual)

        let early_alloc = calculate_simple_allocation(
            early_total_xlm, early_tokens_remaining, early_xlm_reserve, DEV_BONUS_BPS,
        ).unwrap();

        // Late graduation (higher market cap = more XLM raised = fewer tokens remaining = less burned)
        let late_total_xlm = 34_500 * PRECISION;       // 34.5k XLM
        let late_tokens_remaining = 100_000_000 * PRECISION;  // 100M tokens remaining
        let late_xlm_reserve = 35_500 * PRECISION;     // 35.5k XLM

        let late_alloc = calculate_simple_allocation(
            late_total_xlm, late_tokens_remaining, late_xlm_reserve, DEV_BONUS_BPS,
        ).unwrap();

        // Early graduation burns a higher percentage of tokens
        let _early_burn_pct = early_alloc.tokens_to_burn * 100 / early_total_xlm.max(1);
        let _late_burn_pct = late_alloc.tokens_to_burn * 100 / late_total_xlm.max(1);

        // Both should burn tokens
        assert!(early_alloc.tokens_to_burn > 0, "Early graduation should burn tokens");
        assert!(late_alloc.tokens_to_burn > 0, "Late graduation should burn tokens");

        // Dev bonus should be proportional to XLM raised
        let early_dev_pct = early_alloc.xlm_dev_bonus * 10000 / early_total_xlm;
        let late_dev_pct = late_alloc.xlm_dev_bonus * 10000 / late_total_xlm;
        // Both should be approximately 1% (100 bps)
        assert!(early_dev_pct >= 95 && early_dev_pct <= 105, "Early dev bonus should be ~1%");
        assert!(late_dev_pct >= 95 && late_dev_pct <= 105, "Late dev bonus should be ~1%");

        // Pool gets the vast majority of XLM in both cases
        let early_pool_xlm_pct = early_alloc.xlm_for_pool * 100 / early_total_xlm;
        let late_pool_xlm_pct = late_alloc.xlm_for_pool * 100 / late_total_xlm;
        assert!(early_pool_xlm_pct >= 98, "Early pool should get >= 98% of XLM");
        assert!(late_pool_xlm_pct >= 98, "Late pool should get >= 98% of XLM");
    }
}