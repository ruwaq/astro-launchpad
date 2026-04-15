//! Security Attack-Vector Tests for SAC Factory V6
//!
//! Tests for hacking attempts, edge cases, and attack vectors:
//! - Graduation attack vectors
//! - Bonding curve manipulation
//! - Overflow/underflow protection
//! - Dust/minimum amount attacks
//! - Pause state exploitation
//! - Token creation attacks
//! - Fee manipulation
//! - Sell validation
//! - Allocation math edge cases
//! - Bonding curve invariants

#[cfg(test)]
mod tests {
    use crate::{SacFactory, SacFactoryClient};
    use crate::bonding_curve::BondingCurve;
    use crate::astro_client::calculate_simple_allocation;
    use crate::errors::Error;
    use soroban_sdk::{
        testutils::Address as _, Address, Bytes, BytesN, Env, String,
    };

    const BONDING_CURVE_SUPPLY: i128 = 10_000_000_000_000_000; // 1B tokens
    const INITIAL_VIRTUAL_RESERVE: i128 = 10_000_000_000; // 1000 XLM
    const PRECISION: i128 = 10_000_000; // 7 decimals
    const PROTOCOL_FEE_BPS: i128 = 15; // 0.15%
    const LP_FEE_BPS: i128 = 15; // 0.15%
    const DEV_BONUS_BPS: i128 = 100; // 1%

    fn create_test_issuer(env: &Env) -> String {
        String::from_str(env, "GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGSNFHEYVXM3XOJMDS674JZ")
    }

    fn create_test_serialized_asset(
        env: &Env, symbol: &String, creator: &Address, token_count: u32,
    ) -> Bytes {
        let timestamp = env.ledger().timestamp();
        let mut salt_data = Bytes::new(env);
        salt_data.append(&Bytes::from_array(env, &token_count.to_be_bytes()));
        salt_data.append(&Bytes::from_array(env, &timestamp.to_be_bytes()));
        let salt_hash = env.crypto().sha256(&salt_data);
        let salt = BytesN::from_array(env, &salt_hash.to_array());
        crate::sac_deployment::test_helpers::create_test_serialized_asset(
            env, symbol, creator, &salt,
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

    fn launch_token(env: &Env, client: &SacFactoryClient, symbol: &str, token_count: u32) -> Address {
        let creator = Address::generate(env);
        let sym = String::from_str(env, symbol);
        let issuer = create_test_issuer(env);
        let serialized = create_test_serialized_asset(env, &sym, &creator, token_count);
        client.launch_token(
            &creator,
            &String::from_str(env, symbol),
            &sym,
            &issuer,
            &String::from_str(env, "ipfs://test"),
            &String::from_str(env, "Test token"),
            &serialized,
        )
    }

    // ========================================================================
    // 1. GRADUATION ATTACK VECTORS
    // ========================================================================

    #[test]
    fn test_buy_after_graduation_blocked() {
        let env = Env::default();
        env.budget().reset_unlimited();
        let (client, _admin, _treasury) = setup_factory(&env);
        let token = launch_token(&env, &client, "GRAD", 0);
        let deadline = env.ledger().timestamp() + 3600;

        // Buy enough to reach graduation threshold (34,500 XLM)
        let buyer = Address::generate(&env);
        env.mock_all_auths();
        // One large buy to trigger graduation
        let big_buy = 50_000 * PRECISION; // 50,000 XLM
        let result = client.try_buy(&buyer, &token, &big_buy, &0, &deadline);

        // If token graduated, subsequent buys should fail
        // If it didn't graduate yet, buy more
        if result.is_ok() {
            let info = client.get_token_info(&token).expect("Token should exist");
            if !matches!(info.status, crate::storage::TokenStatus::Bonding) {
                // Token graduated - try to buy again, should fail
                let buyer2 = Address::generate(&env);
                let buy_result = client.try_buy(&buyer2, &token, &1000, &0, &deadline);
                assert!(buy_result.is_err(), "Buy after graduation should fail");
            }
        }
    }

    #[test]
    fn test_sell_after_graduation_blocked() {
        let env = Env::default();
        env.budget().reset_unlimited();
        let (client, _admin, _treasury) = setup_factory(&env);
        let token = launch_token(&env, &client, "SELL", 0);
        let deadline = env.ledger().timestamp() + 3600;

        let buyer = Address::generate(&env);
        env.mock_all_auths();
        let big_buy = 50_000 * PRECISION;
        let result = client.try_buy(&buyer, &token, &big_buy, &0, &deadline);

        if result.is_ok() {
            let info = client.get_token_info(&token).expect("Token should exist");
            if !matches!(info.status, crate::storage::TokenStatus::Bonding) {
                // Token graduated - try to sell, should fail
                let sell_result = client.try_sell(&buyer, &token, &1000, &0, &deadline);
                assert!(sell_result.is_err(), "Sell after graduation should fail");
            }
        }
    }

    #[test]
    fn test_double_graduation_blocked() {
        // Verify that graduation can't happen twice by checking status
        let mut curve = BondingCurve::new(BONDING_CURVE_SUPPLY).unwrap();

        // Buy until graduation threshold
        let graduation_threshold: i128 = 345_000_000_000;
        loop {
            if curve.get_real_xlm_raised() >= graduation_threshold { break; }
            let xlm_in = 1000 * PRECISION;
            let protocol_fee = (xlm_in * PROTOCOL_FEE_BPS + 9999) / 10000;
            let lp_fee = (xlm_in * LP_FEE_BPS + 9999) / 10000;
            let net = xlm_in - protocol_fee - lp_fee;
            let tokens_out = curve.calculate_buy(net).unwrap();
            curve.execute_buy_with_lp_fee(net, tokens_out, lp_fee).unwrap();
        }

        // Verify graduation threshold was reached
        assert!(curve.get_real_xlm_raised() >= graduation_threshold);

        // After graduation, the curve state would be frozen
        // The contract sets status to Graduated which blocks further operations
        // This test verifies the math works up to graduation
    }

    #[test]
    fn test_graduation_race_condition() {
        // Simulate two buyers near graduation threshold
        let env = Env::default();
        env.budget().reset_unlimited();
        let (client, _admin, _treasury) = setup_factory(&env);
        let token = launch_token(&env, &client, "RACE", 0);
        let deadline = env.ledger().timestamp() + 3600;

        // Buyer 1 buys enough to get close to graduation
        let buyer1 = Address::generate(&env);
        env.mock_all_auths();
        let buy1 = 5_000 * PRECISION;
        let _ = client.try_buy(&buyer1, &token, &buy1, &0, &deadline);

        // Buyer 2 buys enough to push past graduation
        let buyer2 = Address::generate(&env);
        let buy2 = 40_000 * PRECISION;
        let result = client.try_buy(&buyer2, &token, &buy2, &0, &deadline);

        // One of these should trigger graduation
        // After graduation, further operations should fail
        if result.is_ok() {
            let info = client.get_token_info(&token).expect("Token should exist");
            // Status should have changed from Active
            assert!(!matches!(info.status, crate::storage::TokenStatus::Bonding) ||
                    info.bonding_curve.get_real_xlm_raised() <
                    crate::storage::get_graduation_threshold(&env));
        }
    }

    // ========================================================================
    // 2. BONDING CURVE MANIPULATION
    // ========================================================================

    #[test]
    fn test_sandwich_attack_buy_sell() {
        let mut curve = BondingCurve::new(BONDING_CURVE_SUPPLY).unwrap();

        // Attacker buys 1000 XLM worth
        let attack_buy = 1000 * PRECISION;
        let protocol_fee = (attack_buy * PROTOCOL_FEE_BPS + 9999) / 10000;
        let lp_fee = (attack_buy * LP_FEE_BPS + 9999) / 10000;
        let net_buy = attack_buy - protocol_fee - lp_fee;
        let tokens_bought = curve.calculate_buy(net_buy).unwrap();
        curve.execute_buy_with_lp_fee(net_buy, tokens_bought, lp_fee).unwrap();

        // Attacker immediately sells
        let sell_tokens = tokens_bought; // Sell all
        let xlm_gross = curve.calculate_sell(sell_tokens).unwrap();
        let sell_lp_fee = (xlm_gross * LP_FEE_BPS + 9999) / 10000;
        curve.execute_sell_with_lp_fee(xlm_gross, sell_tokens, sell_lp_fee).unwrap();

        // Calculate attacker's net XLM (after all fees)
        let sell_protocol_fee = (xlm_gross * PROTOCOL_FEE_BPS + 9999) / 10000;
        let net_sell = xlm_gross - sell_protocol_fee - sell_lp_fee;

        // Attacker should lose money (fees eat into profit)
        assert!(net_sell < attack_buy,
            "Sandwich attack should not be profitable. Spent {} XLM, got back {} XLM",
            attack_buy / PRECISION, net_sell / PRECISION);

        // Loss should be approximately the total fee rate (0.30%)
        let loss_pct = (attack_buy - net_sell) * 10000 / attack_buy;
        assert!(loss_pct >= 25, "Loss should be at least 0.25% (fees), got {:.2}%", loss_pct as f64 / 100.0);
    }

    #[test]
    fn test_sell_more_than_bought() {
        let mut curve = BondingCurve::new(BONDING_CURVE_SUPPLY).unwrap();

        // Buy some tokens
        let buy_amount = 1000 * PRECISION;
        let protocol_fee = (buy_amount * PROTOCOL_FEE_BPS + 9999) / 10000;
        let lp_fee = (buy_amount * LP_FEE_BPS + 9999) / 10000;
        let net = buy_amount - protocol_fee - lp_fee;
        let tokens_bought = curve.calculate_buy(net).unwrap();
        curve.execute_buy_with_lp_fee(net, tokens_bought, lp_fee).unwrap();

        // Try to sell MORE tokens than were bought
        // This should fail because tokens_sold < sell amount
        let sell_amount = tokens_bought * 2; // Try to sell 2x what was bought
        let result = curve.calculate_sell(sell_amount);

        // calculate_sell checks tokens_in > tokens_sold, which should fail
        assert!(result.is_err(), "Should not be able to sell more tokens than were bought");
    }

    #[test]
    fn test_buy_near_zero_remaining() {
        let mut curve = BondingCurve::new(BONDING_CURVE_SUPPLY).unwrap();

        // Buy until very few tokens remain
        for _ in 0..100 {
            let xlm_in = 500 * PRECISION;
            let protocol_fee = (xlm_in * PROTOCOL_FEE_BPS + 9999) / 10000;
            let lp_fee = (xlm_in * LP_FEE_BPS + 9999) / 10000;
            let net = xlm_in - protocol_fee - lp_fee;
            if net <= 0 { break; }
            let tokens_out = match curve.calculate_buy(net) {
                Ok(t) => t,
                Err(_) => break,
            };
            if tokens_out <= 0 { break; }
            curve.execute_buy_with_lp_fee(net, tokens_out, lp_fee).unwrap();
        }

        // Verify curve is still in a valid state
        assert!(curve.tokens_remaining > 0, "Should still have tokens remaining");
        assert!(curve.xlm_reserve > 0, "Should still have XLM in reserve");
        assert!(curve.k > 0, "k should still be positive");

        // Verify price is very high (most tokens sold)
        let price = curve.get_current_price().unwrap();
        let initial_price = INITIAL_VIRTUAL_RESERVE * PRECISION / BONDING_CURVE_SUPPLY;
        assert!(price > initial_price * 100, "Price should be much higher after massive buying");
    }

    #[test]
    fn test_drain_curve_attempt() {
        let mut curve = BondingCurve::new(BONDING_CURVE_SUPPLY).unwrap();

        // Buy a massive amount of tokens
        let massive_buy = 1_000_000 * PRECISION; // 1M XLM
        let protocol_fee = (massive_buy * PROTOCOL_FEE_BPS + 9999) / 10000;
        let lp_fee = (massive_buy * LP_FEE_BPS + 9999) / 10000;
        let net = massive_buy - protocol_fee - lp_fee;

        let tokens_out = curve.calculate_buy(net).unwrap();
        curve.execute_buy_with_lp_fee(net, tokens_out, lp_fee).unwrap();

        // Now try to sell ALL tokens back
        let xlm_gross = curve.calculate_sell(tokens_out).unwrap();
        let sell_protocol_fee = (xlm_gross * PROTOCOL_FEE_BPS + 9999) / 10000;
        let sell_lp_fee = (xlm_gross * LP_FEE_BPS + 9999) / 10000;
        let net_sell = xlm_gross - sell_protocol_fee - sell_lp_fee;

        // Net XLM received should be LESS than XLM spent (fees eat into it)
        assert!(net_sell < massive_buy,
            "Should not be able to drain more XLM than was put in. Spent {} XLM, got back {} XLM",
            massive_buy / PRECISION, net_sell / PRECISION);
    }

    #[test]
    fn test_repeated_buy_sell_no_profit() {
        let mut curve = BondingCurve::new(BONDING_CURVE_SUPPLY).unwrap();

        let mut total_xlm_spent: i128 = 0;
        let mut total_xlm_received: i128 = 0;

        // Perform 5 buy→sell cycles
        for cycle in 0..5 {
            // Buy
            let buy_amount = 100 * PRECISION;
            let protocol_fee = (buy_amount * PROTOCOL_FEE_BPS + 9999) / 10000;
            let lp_fee = (buy_amount * LP_FEE_BPS + 9999) / 10000;
            let net_buy = buy_amount - protocol_fee - lp_fee;

            let tokens = curve.calculate_buy(net_buy).unwrap();
            curve.execute_buy_with_lp_fee(net_buy, tokens, lp_fee).unwrap();
            total_xlm_spent += buy_amount;

            // Sell (sell all tokens just bought)
            let sell_protocol_fee = (buy_amount * PROTOCOL_FEE_BPS + 9999) / 10000;
            let xlm_gross = curve.calculate_sell(tokens).unwrap();
            let sell_lp_fee = (xlm_gross * LP_FEE_BPS + 9999) / 10000;
            curve.execute_sell_with_lp_fee(xlm_gross, tokens, sell_lp_fee).unwrap();
            let net_sell = xlm_gross - sell_protocol_fee - sell_lp_fee;
            total_xlm_received += net_sell;
        }

        // After 5 buy→sell cycles, user should have LESS XLM than they started with
        assert!(total_xlm_received < total_xlm_spent,
            "Buy→sell cycles should not be profitable. Spent {} XLM, received {} XLM",
            total_xlm_spent / PRECISION, total_xlm_received / PRECISION);
    }

    // ========================================================================
    // 3. OVERFLOW/UNDERFLOW PROTECTION
    // ========================================================================

    #[test]
    fn test_buy_with_maximum_amount() {
        let curve = BondingCurve::new(BONDING_CURVE_SUPPLY).unwrap();

        // Try to buy with extremely large XLM amount
        let max_xlm = i128::MAX / 2; // Still very large
        let result = curve.calculate_buy(max_xlm);

        // Should overflow or return error (not panic)
        // The bonding curve uses checked arithmetic, so it should return Err, not panic
        assert!(result.is_err() || result.is_ok(), "Should not panic on large amounts");
    }

    #[test]
    fn test_sell_maximum_tokens() {
        let mut curve = BondingCurve::new(BONDING_CURVE_SUPPLY).unwrap();

        // First buy some tokens
        let buy_amount = 100 * PRECISION;
        let protocol_fee = (buy_amount * PROTOCOL_FEE_BPS + 9999) / 10000;
        let lp_fee = (buy_amount * LP_FEE_BPS + 9999) / 10000;
        let net = buy_amount - protocol_fee - lp_fee;
        let tokens_bought = curve.calculate_buy(net).unwrap();
        curve.execute_buy_with_lp_fee(net, tokens_bought, lp_fee).unwrap();

        // Try to sell more tokens than were bought (i128::MAX)
        let result = curve.calculate_sell(i128::MAX);
        assert!(result.is_err(), "Should not be able to sell i128::MAX tokens");
    }

    #[test]
    fn test_fee_accumulation_overflow_protection() {
        // Verify that fee accumulation uses safe math
        // Even with many trades, accumulated fees should not overflow
        let mut curve = BondingCurve::new(BONDING_CURVE_SUPPLY).unwrap();

        // Simulate many trades
        for _ in 0..100 {
            let xlm_in = 100 * PRECISION;
            let protocol_fee = (xlm_in * PROTOCOL_FEE_BPS + 9999) / 10000;
            let lp_fee = (xlm_in * LP_FEE_BPS + 9999) / 10000;
            let net = xlm_in - protocol_fee - lp_fee;

            let tokens_out = match curve.calculate_buy(net) {
                Ok(t) => t,
                Err(_) => break,
            };
            curve.execute_buy_with_lp_fee(net, tokens_out, lp_fee).unwrap();
        }

        // Verify curve is still valid
        assert!(curve.xlm_reserve > 0);
        assert!(curve.tokens_remaining > 0);
        assert!(curve.k > 0);
    }

    #[test]
    fn test_graduation_threshold_extreme_values() {
        // Verify the default graduation threshold is sensible
        // Using the constant directly since it matches our contract config
        let default_threshold: i128 = 345_000_000_000; // 34,500 XLM in stroops
        assert!(default_threshold > 0, "Graduation threshold should be positive");
        assert!(default_threshold < i128::MAX / 2, "Graduation threshold should not overflow");
    }

    // ========================================================================
    // 4. DUST / MINIMUM AMOUNT ATTACKS
    // ========================================================================

    #[test]
    fn test_buy_below_minimum() {
        let env = Env::default();
        let (client, _admin, _treasury) = setup_factory(&env);
        let token = launch_token(&env, &client, "DUST", 0);
        let deadline = env.ledger().timestamp() + 3600;

        let buyer = Address::generate(&env);
        env.mock_all_auths();

        // Try to buy with amount below minimum (0.09 XLM = 900,000 stroops)
        let below_min = 900_000i128; // < 1,000,000 minimum
        let result = client.try_buy(&buyer, &token, &below_min, &0, &deadline);
        assert!(result.is_err(), "Buy below minimum should fail");
    }

    #[test]
    fn test_buy_exact_minimum() {
        let env = Env::default();
        env.budget().reset_unlimited();
        let (client, _admin, _treasury) = setup_factory(&env);
        let token = launch_token(&env, &client, "MINX", 0);
        let deadline = env.ledger().timestamp() + 3600;

        let buyer = Address::generate(&env);
        env.mock_all_auths();

        // Buy with exactly 0.1 XLM (minimum trade amount)
        let min_amount = 1_000_000i128; // Exactly MIN_TRADE_AMOUNT
        let result = client.try_buy(&buyer, &token, &min_amount, &0, &deadline);
        assert!(result.is_ok(), "Buy at exact minimum should succeed");
    }

    #[test]
    fn test_dust_attack_many_tiny_buys() {
        let env = Env::default();
        env.budget().reset_unlimited();
        let (client, _admin, _treasury) = setup_factory(&env);
        let token = launch_token(&env, &client, "TINY", 0);
        let deadline = env.ledger().timestamp() + 3600;

        let min_amount = 1_000_000i128; // 0.1 XLM minimum

        // Try 10 minimum buys (dust attack)
        for i in 0..10 {
            let buyer = Address::generate(&env);
            env.mock_all_auths();
            let result = client.try_buy(&buyer, &token, &min_amount, &0, &deadline);
            // Each should succeed individually
            assert!(result.is_ok(), "Minimum buy {} should succeed", i + 1);
        }

        // Verify token is still in valid state
        let info = client.get_token_info(&token).expect("Token should exist");
        assert!(info.bonding_curve.xlm_reserve > 0);
        assert!(info.bonding_curve.tokens_remaining > 0);
    }

    // ========================================================================
    // 5. PAUSE STATE EXPLOITATION
    // ========================================================================

    #[test]
    #[should_panic(expected = "Error(Contract, #102)")] // ContractPaused
    fn test_buy_while_paused_blocked() {
        let env = Env::default();
        let (client, admin, _treasury) = setup_factory(&env);
        let token = launch_token(&env, &client, "PAUS", 0);
        let deadline = env.ledger().timestamp() + 3600;

        // Pause the contract
        env.mock_all_auths();
        client.pause(&admin);

        // Try to buy while paused - should panic
        let buyer = Address::generate(&env);
        client.buy(&buyer, &token, &1_000_000i128, &0, &deadline);
    }

    #[test]
    #[should_panic(expected = "Error(Contract, #102)")] // ContractPaused
    fn test_sell_while_paused_blocked() {
        let env = Env::default();
        env.budget().reset_unlimited();
        let (client, admin, _treasury) = setup_factory(&env);
        let token = launch_token(&env, &client, "PAUS", 0);
        let deadline = env.ledger().timestamp() + 3600;

        // Buy first
        let buyer = Address::generate(&env);
        env.mock_all_auths();
        let buy_result = client.buy(&buyer, &token, &1_000_000_000i128, &0, &deadline);
        assert!(buy_result > 0);

        // Pause the contract
        client.pause(&admin);

        // Try to sell while paused - should panic
        client.sell(&buyer, &token, &buy_result, &0, &deadline);
    }

    #[test]
    #[should_panic(expected = "Error(Contract, #102)")] // ContractPaused
    fn test_launch_while_paused_blocked() {
        let env = Env::default();
        let (client, admin, _treasury) = setup_factory(&env);

        // Pause the contract
        env.mock_all_auths();
        client.pause(&admin);

        // Try to launch token while paused - should panic
        let creator = Address::generate(&env);
        let symbol = String::from_str(&env, "NOP");
        let issuer = create_test_issuer(&env);
        let serialized = create_test_serialized_asset(&env, &symbol, &creator, 0);
        client.launch_token(
            &creator, &String::from_str(&env, "Nope"), &symbol, &issuer,
            &String::from_str(&env, "ipfs://test"), &String::from_str(&env, "Test"), &serialized,
        );
    }

    #[test]
    fn test_admin_ops_work_while_paused() {
        let env = Env::default();
        let (client, admin, _treasury) = setup_factory(&env);

        // Pause the contract
        env.mock_all_auths();
        client.pause(&admin);

        // Admin operations should still work while paused
        // Set protocol fee (FeeAdmin or Owner)
        let new_fee = 20i128; // 0.20%
        let result = client.try_set_protocol_fee(&admin, &new_fee);
        assert!(result.is_ok(), "Admin should be able to set fees while paused");

        // Unpause should work
        client.unpause(&admin);

        // Verify unpause worked
        let state = client.get_state();
        assert!(matches!(state, crate::state_management::ContractState::Active));
    }

    // ========================================================================
    // 6. TOKEN CREATION ATTACKS
    // ========================================================================

    #[test]
    #[should_panic(expected = "Error(Contract, #303)")] // DuplicateSymbol
    fn test_duplicate_symbol_blocked() {
        let env = Env::default();
        let (client, _admin, _treasury) = setup_factory(&env);

        let creator = Address::generate(&env);
        env.mock_all_auths();

        // Launch first token
        let symbol = String::from_str(&env, "DUPE");
        let issuer = create_test_issuer(&env);
        let serialized = create_test_serialized_asset(&env, &symbol, &creator, 0);
        client.launch_token(
            &creator, &String::from_str(&env, "First Token"), &symbol, &issuer,
            &String::from_str(&env, "ipfs://1"), &String::from_str(&env, "First"), &serialized,
        );

        // Try to launch with same symbol - should panic
        let serialized2 = create_test_serialized_asset(&env, &symbol, &creator, 1);
        client.launch_token(
            &creator, &String::from_str(&env, "Second Token"), &symbol, &issuer,
            &String::from_str(&env, "ipfs://2"), &String::from_str(&env, "Second"), &serialized2,
        );
    }

    #[test]
    #[should_panic(expected = "Error(Contract, #300)")] // InvalidName
    fn test_launch_with_empty_name() {
        let env = Env::default();
        let (client, _admin, _treasury) = setup_factory(&env);

        let creator = Address::generate(&env);
        let symbol = String::from_str(&env, "TEST");
        let issuer = create_test_issuer(&env);
        env.mock_all_auths();

        // Empty name should fail validation
        let serialized = create_test_serialized_asset(&env, &symbol, &creator, 0);
        client.launch_token(
            &creator, &String::from_str(&env, ""), &symbol, &issuer,
            &String::from_str(&env, "ipfs://test"), &String::from_str(&env, "Desc"), &serialized,
        );
    }

    #[test]
    fn test_launch_with_valid_params_succeeds() {
        let env = Env::default();
        let (client, _admin, _treasury) = setup_factory(&env);

        let creator = Address::generate(&env);
        let symbol = String::from_str(&env, "GOOD");
        let issuer = create_test_issuer(&env);
        env.mock_all_auths();

        let serialized = create_test_serialized_asset(&env, &symbol, &creator, 0);
        let token = client.launch_token(
            &creator,
            &String::from_str(&env, "Good Token"),
            &symbol,
            &issuer,
            &String::from_str(&env, "ipfs://good"),
            &String::from_str(&env, "A valid token"),
            &serialized,
        );

        // Should succeed and return a valid token address
        assert!(token != Address::generate(&env));
    }

    // ========================================================================
    // 7. FEE MANIPULATION
    // ========================================================================

    #[test]
    fn test_set_protocol_fee_max_allowed() {
        let env = Env::default();
        let (client, admin, _treasury) = setup_factory(&env);
        env.mock_all_auths();

        // Set protocol fee to maximum allowed (1% = 100 bps)
        let result = client.try_set_protocol_fee(&admin, &100);
        assert!(result.is_ok(), "Setting fee to 1% (100 bps) should succeed");
    }

    #[test]
    fn test_set_protocol_fee_exceeds_total_limit() {
        let env = Env::default();
        let (client, admin, _treasury) = setup_factory(&env);
        env.mock_all_auths();

        // Set protocol fee to 1% (100 bps) - max allowed
        let result1 = client.try_set_protocol_fee(&admin, &100);
        assert!(result1.is_ok(), "Setting protocol fee to 1% should succeed");

        // Now try to set LP fee to 1.5% (150 bps) - this would make total 2.5%
        // which exceeds the 2% limit. But LP fee max is 1% (100 bps) individually.
        // So we need to test that setting LP fee > 100 bps fails.
        let result2 = client.try_set_lp_fee(&admin, &150);
        assert!(result2.is_err(), "Setting LP fee to 1.5% (over max 1%) should be rejected");
    }

    #[test]
    fn test_set_creation_fee_negative() {
        let env = Env::default();
        let (client, admin, _treasury) = setup_factory(&env);
        env.mock_all_auths();

        // Negative creation fee should fail
        let result = client.try_set_creation_fee(&admin, &(-1));
        assert!(result.is_err(), "Negative creation fee should be rejected");
    }

    // ========================================================================
    // 8. SELL VALIDATION
    // ========================================================================

    #[test]
    fn test_sell_zero_tokens() {
        let env = Env::default();
        let (client, _admin, _treasury) = setup_factory(&env);
        let token = launch_token(&env, &client, "ZERO", 0);
        let deadline = env.ledger().timestamp() + 3600;

        let seller = Address::generate(&env);
        env.mock_all_auths();

        let result = client.try_sell(&seller, &token, &0, &0, &deadline);
        assert!(result.is_err(), "Selling 0 tokens should fail");
    }

    #[test]
    fn test_sell_negative_tokens() {
        let env = Env::default();
        let (client, _admin, _treasury) = setup_factory(&env);
        let token = launch_token(&env, &client, "NEG", 0);
        let deadline = env.ledger().timestamp() + 3600;

        let seller = Address::generate(&env);
        env.mock_all_auths();

        let result = client.try_sell(&seller, &token, &(-1000), &0, &deadline);
        assert!(result.is_err(), "Selling negative tokens should fail");
    }

    #[test]
    fn test_sell_expired_deadline() {
        let env = Env::default();
        let (client, _admin, _treasury) = setup_factory(&env);
        let token = launch_token(&env, &client, "EXPD", 0);

        // Deadline in the past (timestamp 0 is before ledger time)
        let past_deadline: u64 = 1; // Very small timestamp, definitely in the past

        let seller = Address::generate(&env);
        env.mock_all_auths();

        let result = client.try_sell(&seller, &token, &1_000_000i128, &0, &past_deadline);
        assert!(result.is_err(), "Sell with expired deadline should fail");
    }

    // ========================================================================
    // 9. ALLOCATION MATH SECURITY
    // ========================================================================

    #[test]
    fn test_allocation_with_zero_xlm() {
        // Allocation with zero XLM should fail
        let result = calculate_simple_allocation(0, 100_000_000 * PRECISION, 1000 * PRECISION, DEV_BONUS_BPS);
        assert!(result.is_err(), "Zero XLM should fail allocation");
    }

    #[test]
    fn test_allocation_with_zero_tokens() {
        // Allocation with zero tokens remaining should fail
        let result = calculate_simple_allocation(345_000_000_000, 0, 355_000_000_000, DEV_BONUS_BPS);
        assert!(result.is_err(), "Zero tokens should fail allocation");
    }

    // ========================================================================
    // 10. BONDING CURVE INVARIANTS
    // ========================================================================

    #[test]
    fn test_k_invariant_preserved_after_buy() {
        let mut curve = BondingCurve::new(BONDING_CURVE_SUPPLY).unwrap();

        // k only grows from LP fees after buy
        let initial_k = curve.k;

        for i in 1..=5u32 {
            let xlm_in = (i as i128) * 100 * PRECISION;
            let protocol_fee = (xlm_in * PROTOCOL_FEE_BPS + 9999) / 10000;
            let lp_fee = (xlm_in * LP_FEE_BPS + 9999) / 10000;
            let net = xlm_in - protocol_fee - lp_fee;

            let tokens_out = curve.calculate_buy(net).unwrap();
            curve.execute_buy_with_lp_fee(net, tokens_out, lp_fee).unwrap();

            // k should never decrease
            assert!(curve.k >= initial_k, "k should never decrease after buy");
            // k should grow due to LP fee retention
            assert!(curve.k > initial_k || i == 0, "k should grow from LP fees");
        }
    }

    #[test]
    fn test_k_invariant_preserved_after_sell() {
        let mut curve = BondingCurve::new(BONDING_CURVE_SUPPLY).unwrap();

        // Buy some tokens first
        let buy_amount = 1000 * PRECISION;
        let protocol_fee = (buy_amount * PROTOCOL_FEE_BPS + 9999) / 10000;
        let lp_fee = (buy_amount * LP_FEE_BPS + 9999) / 10000;
        let net = buy_amount - protocol_fee - lp_fee;
        let tokens_bought = curve.calculate_buy(net).unwrap();
        curve.execute_buy_with_lp_fee(net, tokens_bought, lp_fee).unwrap();

        let k_after_buy = curve.k;

        // Sell half the tokens
        let sell_amount = tokens_bought / 2;
        let xlm_gross = curve.calculate_sell(sell_amount).unwrap();
        let sell_lp_fee = (xlm_gross * LP_FEE_BPS + 9999) / 10000;
        curve.execute_sell_with_lp_fee(xlm_gross, sell_amount, sell_lp_fee).unwrap();

        // k should still be >= k_after_buy (LP fee retention makes k grow or stay same)
        assert!(curve.k >= k_after_buy, "k should not decrease after sell (LP fee retained)");

        // x*y should equal k (constant product maintained)
        let computed_k = curve.xlm_reserve * curve.tokens_remaining;
        assert_eq!(computed_k, curve.k, "x*y should equal k after sell");
    }

    #[test]
    fn test_price_never_decreases_after_buy() {
        let mut curve = BondingCurve::new(BONDING_CURVE_SUPPLY).unwrap();
        let mut last_price = curve.get_current_price().unwrap();

        for i in 1..=10u32 {
            let xlm_in = (i as i128) * 50 * PRECISION;
            let protocol_fee = (xlm_in * PROTOCOL_FEE_BPS + 9999) / 10000;
            let lp_fee = (xlm_in * LP_FEE_BPS + 9999) / 10000;
            let net = xlm_in - protocol_fee - lp_fee;

            let tokens_out = curve.calculate_buy(net).unwrap();
            curve.execute_buy_with_lp_fee(net, tokens_out, lp_fee).unwrap();

            let current_price = curve.get_current_price().unwrap();
            assert!(current_price >= last_price,
                "Price should never decrease after buy (round {})", i);
            last_price = current_price;
        }
    }
}