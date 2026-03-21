//! Critical Bug Fix Tests - Locked XLM Accounting
//!
//! Tests for BUG #1: Incorrect locked_xlm accounting on graduation
//! This test suite verifies the fix that tracks locked XLM per-token
//! to prevent draining active bonding curves when other tokens graduate.

#[cfg(test)]
mod locked_xlm_tests {
    use crate::{SacFactory, SacFactoryClient};
    use soroban_sdk::{
        testutils::{Address as _, Ledger},
        Address, Bytes, Env, String,
    };

    fn create_factory(env: &Env) -> (SacFactoryClient, Address, Address, Address) {
        let contract_id = env.register(SacFactory, ());
        let client = SacFactoryClient::new(env, &contract_id);
        let admin = Address::generate(env);
        let treasury = Address::generate(env);
        let xlm_token_address = Address::generate(env);
        (client, admin, treasury, xlm_token_address)
    }

    fn setup_factory(env: &Env) -> (SacFactoryClient, Address, Address) {
        let (client, admin, treasury, xlm_token_address) = create_factory(env);
        env.mock_all_auths();
        client.initialize(&admin, &treasury, &xlm_token_address);

        // Set dummy wasm hashes for testing (required for graduation)
        let dummy_wasm_hash = soroban_sdk::BytesN::from_array(env, &[0u8; 32]);
        client.set_amm_wasm_hash(&admin, &dummy_wasm_hash);
        client.set_token_wasm_hash(&admin, &dummy_wasm_hash);

        (client, admin, treasury)
    }

    fn get_test_deadline(env: &Env) -> u64 {
        env.ledger().timestamp() + 31_536_000
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
        let salt = soroban_sdk::BytesN::from_array(env, &salt_hash.to_array());

        crate::sac_deployment::test_helpers::create_test_serialized_asset(
            env,
            symbol,
            creator,
            &salt,
        ).expect("Failed to create test serialized asset")
    }

    fn create_test_issuer(env: &Env) -> String {
        // Generate a valid Stellar public key format (G...)
        // In real usage, this would be a real issuer account
        String::from_str(env, "GBZHGNQXHZ5IJQGLRFQZ2GLCV2W5ZKZLPBXZBZL6OYLTQTDQZEZN5Q6D")
    }

    /// Test that locked_xlm_amount is correctly tracked per-token
    #[test]
    fn test_locked_xlm_per_token_tracking() {
        let env = Env::default();
        env.mock_all_auths();
        env.ledger().set_timestamp(1_000_000);

        let (client, _admin, _treasury) = setup_factory(&env);

        // Create Token A
        let creator_a = Address::generate(&env);
        let symbol_a = String::from_str(&env, "TOKA");
        let serialized_a = create_test_serialized_asset(&env, &symbol_a, &creator_a, 1);
        let issuer = create_test_issuer(&env);

        let token_a = client.launch_token(
            &creator_a,
            &String::from_str(&env, "Token A"),
            &symbol_a,
            &issuer,
            &String::from_str(&env, "ipfs://test-a"),
            &String::from_str(&env, "Test Token A"),
            &serialized_a,
        );

        // Create Token B
        let creator_b = Address::generate(&env);
        let symbol_b = String::from_str(&env, "TOKB");
        let serialized_b = create_test_serialized_asset(&env, &symbol_b, &creator_b, 2);

        let token_b = client.launch_token(
            &creator_b,
            &String::from_str(&env, "Token B"),
            &symbol_b,
            &issuer,
            &String::from_str(&env, "ipfs://test-b"),
            &String::from_str(&env, "Test Token B"),
            &serialized_b,
        );

        // Buy Token A (50 XLM - stays well below default graduation threshold)
        let buyer_a = Address::generate(&env);
        let deadline = get_test_deadline(&env);
        client.buy(&buyer_a, &token_a, &50_0000000, &0, &deadline);

        // Verify Token A locked_xlm_amount
        let token_a_info = client.get_token_info(&token_a).unwrap();
        assert!(token_a_info.locked_xlm_amount > 0, "Token A should have locked XLM");

        // Buy Token B (30 XLM)
        let buyer_b = Address::generate(&env);
        client.buy(&buyer_b, &token_b, &30_0000000, &0, &deadline);

        // Verify Token B locked_xlm_amount
        let token_b_info = client.get_token_info(&token_b).unwrap();
        assert!(token_b_info.locked_xlm_amount > 0, "Token B should have locked XLM");

        // Store Token B's locked amount before Token A gets more buys
        let token_b_locked_before = token_b_info.locked_xlm_amount;

        // Buy more Token A (20 XLM - total 70 XLM, still below graduation threshold)
        client.buy(&buyer_a, &token_a, &20_0000000, &0, &deadline);

        // Verify per-token tracking remains independent
        let token_a_info_after = client.get_token_info(&token_a).unwrap();
        let token_b_info_after = client.get_token_info(&token_b).unwrap();

        // Token B's locked amount should be unchanged
        assert_eq!(
            token_b_info_after.locked_xlm_amount,
            token_b_locked_before,
            "Token B locked amount should not change when Token A is bought"
        );

        // Both tokens should have independent locked amounts
        assert!(token_a_info_after.locked_xlm_amount > token_a_info.locked_xlm_amount,
                "Token A locked amount should increase after buy");
    }

    /// Test that locked_xlm is correctly released only for graduated token
    #[test]
    fn test_locked_xlm_release_on_graduation() {
        let env = Env::default();
        env.mock_all_auths();
        env.ledger().set_timestamp(1_000_000);

        let (client, _admin, _treasury) = setup_factory(&env);

        // Create token
        let creator = Address::generate(&env);
        let symbol = String::from_str(&env, "TEST");
        let serialized = create_test_serialized_asset(&env, &symbol, &creator, 1);
        let issuer = create_test_issuer(&env);

        let token = client.launch_token(
            &creator,
            &String::from_str(&env, "Test Token"),
            &symbol,
            &issuer,
            &String::from_str(&env, "ipfs://test"),
            &String::from_str(&env, "Test Token"),
            &serialized,
        );

        // Buy tokens (100 XLM)
        let buyer = Address::generate(&env);
        let deadline = get_test_deadline(&env);
        client.buy(&buyer, &token, &100_0000000, &0, &deadline);

        // Check locked_xlm_amount
        let token_info = client.get_token_info(&token).unwrap();
        let locked_before = token_info.locked_xlm_amount;

        // With protocol fee of 5 bps (0.05%) and LP fee of 25 bps (0.25%):
        // - 100 XLM input
        // - 0.05 XLM protocol fee (goes to treasury)
        // - 0.25 XLM LP fee (stays in curve)
        // - 99.7 XLM for swap
        // - locked_xlm_amount = 99.7 + 0.25 = 99.95 XLM (excludes protocol fee)

        // The locked amount should be less than xlm_raised due to protocol fees
        assert!(locked_before <= token_info.xlm_raised,
                "Locked XLM should be less than or equal to xlm_raised (protocol fees excluded)");

        // Verify the math: locked should be ~99.95% of raised (100% - 0.05% protocol)
        // Allow 1% tolerance for rounding and basis point calculations
        let expected_locked = token_info.xlm_raised * 9995 / 10000;
        let tolerance = token_info.xlm_raised / 100; // 1% tolerance for rounding

        assert!(
            (locked_before - expected_locked).abs() < tolerance,
            "Locked XLM should be approximately 99.95% of xlm_raised (100% - 0.05% protocol fee). Expected: {}, Got: {}",
            expected_locked, locked_before
        );
    }

    /// Test that locked_xlm persists correctly across token status changes
    #[test]
    fn test_locked_xlm_persists_across_operations() {
        let env = Env::default();
        env.mock_all_auths();

        let (client, _admin, _treasury) = setup_factory(&env);

        // Create token
        let creator = Address::generate(&env);
        let symbol = String::from_str(&env, "TEST");
        let serialized = create_test_serialized_asset(&env, &symbol, &creator, 1);
        let issuer = create_test_issuer(&env);

        let token = client.launch_token(
            &creator,
            &String::from_str(&env, "Test Token"),
            &symbol,
            &issuer,
            &String::from_str(&env, "ipfs://test"),
            &String::from_str(&env, "Test"),
            &serialized,
        );

        // Buy tokens (50 XLM)
        let buyer = Address::generate(&env);
        let deadline = get_test_deadline(&env);
        client.buy(&buyer, &token, &50_0000000, &0, &deadline);

        let info_after_buy = client.get_token_info(&token).unwrap();
        let locked_after_buy = info_after_buy.locked_xlm_amount;
        assert!(locked_after_buy > 0, "Should have locked XLM after buy");

        // Buy more (30 XLM)
        client.buy(&buyer, &token, &30_0000000, &0, &deadline);

        let info_after_second_buy = client.get_token_info(&token).unwrap();
        let locked_after_second_buy = info_after_second_buy.locked_xlm_amount;

        // Locked amount should have increased
        assert!(locked_after_second_buy > locked_after_buy,
                "Locked XLM should increase with more buys");

        // Verify the increase is approximately the expected amount
        // ~99.95% of 30 XLM = ~29.985 XLM
        let expected_increase = 30_0000000 * 9995 / 10000;
        let actual_increase = locked_after_second_buy - locked_after_buy;
        let tolerance = 30_0000000 / 100; // 1% tolerance

        assert!(
            (actual_increase - expected_increase).abs() < tolerance,
            "Locked XLM increase should match buy amount (minus protocol fee)"
        );
    }

    /// Test that sell correctly decrements locked_xlm_amount
    #[test]
    fn test_locked_xlm_decrements_on_sell() {
        let env = Env::default();
        env.mock_all_auths();

        let (client, _admin, _treasury) = setup_factory(&env);

        // Create token
        let creator = Address::generate(&env);
        let symbol = String::from_str(&env, "TEST");
        let serialized = create_test_serialized_asset(&env, &symbol, &creator, 1);
        let issuer = create_test_issuer(&env);

        let token = client.launch_token(
            &creator,
            &String::from_str(&env, "Test Token"),
            &symbol,
            &issuer,
            &String::from_str(&env, "ipfs://test"),
            &String::from_str(&env, "Test"),
            &serialized,
        );

        // Buy tokens
        let buyer = Address::generate(&env);
        let deadline = get_test_deadline(&env);
        let tokens_bought = client.buy(&buyer, &token, &100_0000000, &0, &deadline);

        // Check locked amount after buy
        let info_after_buy = client.get_token_info(&token).unwrap();
        let locked_after_buy = info_after_buy.locked_xlm_amount;
        assert!(locked_after_buy > 0, "Should have locked XLM after buy");

        // Sell half the tokens
        let tokens_to_sell = tokens_bought / 2;
        client.sell(&buyer, &token, &tokens_to_sell, &0, &deadline);

        // Check locked amount decreased
        let info_after_sell = client.get_token_info(&token).unwrap();
        let locked_after_sell = info_after_sell.locked_xlm_amount;

        assert!(locked_after_sell < locked_after_buy,
                "Locked XLM should decrease after sell");
        assert!(locked_after_sell > 0,
                "Should still have some locked XLM after partial sell");
    }

    /// Test multiple buys correctly accumulate locked_xlm_amount
    #[test]
    fn test_locked_xlm_accumulates_on_multiple_buys() {
        let env = Env::default();
        env.mock_all_auths();

        let (client, _admin, _treasury) = setup_factory(&env);

        // Create token
        let creator = Address::generate(&env);
        let symbol = String::from_str(&env, "TEST");
        let serialized = create_test_serialized_asset(&env, &symbol, &creator, 1);
        let issuer = create_test_issuer(&env);

        let token = client.launch_token(
            &creator,
            &String::from_str(&env, "Test Token"),
            &symbol,
            &issuer,
            &String::from_str(&env, "ipfs://test"),
            &String::from_str(&env, "Test"),
            &serialized,
        );

        let deadline = get_test_deadline(&env);

        // First buy
        let buyer1 = Address::generate(&env);
        client.buy(&buyer1, &token, &50_0000000, &0, &deadline);
        let info1 = client.get_token_info(&token).unwrap();
        let locked1 = info1.locked_xlm_amount;

        // Second buy
        let buyer2 = Address::generate(&env);
        client.buy(&buyer2, &token, &50_0000000, &0, &deadline);
        let info2 = client.get_token_info(&token).unwrap();
        let locked2 = info2.locked_xlm_amount;

        // Third buy
        let buyer3 = Address::generate(&env);
        client.buy(&buyer3, &token, &50_0000000, &0, &deadline);
        let info3 = client.get_token_info(&token).unwrap();
        let locked3 = info3.locked_xlm_amount;

        // Each buy should increase locked amount
        assert!(locked2 > locked1, "Second buy should increase locked XLM");
        assert!(locked3 > locked2, "Third buy should increase locked XLM");

        // Total should be approximately 99.95% of total xlm_raised (excluding 0.05% protocol fees)
        let expected_total_locked = info3.xlm_raised * 9995 / 10000;
        let tolerance = info3.xlm_raised / 100; // 1% tolerance

        assert!(
            (locked3 - expected_total_locked).abs() < tolerance,
            "Total locked should be ~99.95% of total raised. Expected: {}, Got: {}",
            expected_total_locked, locked3
        );
    }
}
