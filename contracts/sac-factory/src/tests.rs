//! Comprehensive Tests for SAC Factory - Updated for Client-Side Serialization

#[cfg(test)]
mod tests {
    use crate::{SacFactory, SacFactoryClient};
    use soroban_sdk::{
        testutils::Address as _,
        Address, Bytes, BytesN, Env, String,
    };

    // Test helpers
    fn create_factory_contract(env: &Env) -> (SacFactoryClient, Address, Address) {
        let contract_id = env.register(SacFactory, ());
        let client = SacFactoryClient::new(env, &contract_id);

        let admin = Address::generate(env);
        let treasury = Address::generate(env);

        (client, admin, treasury)
    }

    /// Get a deadline far in the future (1 year from now)
    fn get_test_deadline(env: &Env) -> u64 {
        env.ledger().timestamp() + 31_536_000 // 1 year in seconds
    }

    fn setup_initialized_factory(env: &Env) -> (SacFactoryClient, Address, Address) {
        let (client, admin, treasury) = create_factory_contract(env);

        env.mock_all_auths();
        client.initialize(&admin, &treasury);

        (client, admin, treasury)
    }

    /// Helper to create serialized asset for tests
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

    // ========== Initialization Tests ==========

    #[test]
    fn test_initialize_success() {
        let env = Env::default();
        let (client, admin, treasury) = create_factory_contract(&env);

        env.mock_all_auths();
        client.initialize(&admin, &treasury);

        assert_eq!(client.get_token_count(), 0);
    }

    #[test]
    #[should_panic(expected = "Error(Contract, #1)")]
    fn test_initialize_twice_fails() {
        let env = Env::default();
        let (client, admin, treasury) = create_factory_contract(&env);

        env.mock_all_auths();
        client.initialize(&admin, &treasury);
        client.initialize(&admin, &treasury);
    }

    // ========== Token Launch Tests ==========

    #[test]
    fn test_launch_token_success() {
        let env = Env::default();
        let (client, _admin, _treasury) = setup_initialized_factory(&env);

        let creator = Address::generate(&env);
        let symbol = String::from_str(&env, "TEST");
        env.mock_all_auths();

        let serialized_asset = create_test_serialized_asset(&env, &symbol, &creator, 0);

        let token_addr = client.launch_token(
            &creator,
            &String::from_str(&env, "Test Token"),
            &symbol,
            &String::from_str(&env, "ipfs://test"),
            &String::from_str(&env, "A test token"),
            &serialized_asset,
        );

        let token_info = client.get_token_info(&token_addr);
        assert!(token_info.is_some());

        let info = token_info.unwrap();
        assert_eq!(info.creator, creator);
        assert_eq!(info.name, String::from_str(&env, "Test Token"));
        assert_eq!(client.get_token_count(), 1);
    }

    #[test]
    #[should_panic(expected = "Error(Contract, #20)")]
    fn test_launch_token_empty_name_fails() {
        let env = Env::default();
        let (client, _admin, _treasury) = setup_initialized_factory(&env);

        let creator = Address::generate(&env);
        let symbol = String::from_str(&env, "TEST");
        env.mock_all_auths();

        let serialized_asset = create_test_serialized_asset(&env, &symbol, &creator, 0);

        client.launch_token(
            &creator,
            &String::from_str(&env, ""),
            &symbol,
            &String::from_str(&env, "ipfs://test"),
            &String::from_str(&env, "Description"),
            &serialized_asset,
        );
    }

    #[test]
    #[should_panic(expected = "Error(Contract, #21)")]
    fn test_launch_token_long_symbol_fails() {
        let env = Env::default();
        let (client, _admin, _treasury) = setup_initialized_factory(&env);

        let creator = Address::generate(&env);
        // Use a valid symbol for asset creation, but provide long symbol to contract
        let valid_symbol = String::from_str(&env, "TEST");
        let long_symbol = String::from_str(&env, "VERYLONGSYMBOL");
        env.mock_all_auths();

        let serialized_asset = create_test_serialized_asset(&env, &valid_symbol, &creator, 0);

        // Contract will reject the long symbol even though asset is valid
        client.launch_token(
            &creator,
            &String::from_str(&env, "Test"),
            &long_symbol,  // This will fail validation
            &String::from_str(&env, "ipfs://test"),
            &String::from_str(&env, "Description"),
            &serialized_asset,
        );
    }

    #[test]
    fn test_multiple_tokens_same_creator() {
        let env = Env::default();
        let (client, _admin, _treasury) = setup_initialized_factory(&env);

        let creator = Address::generate(&env);
        env.mock_all_auths();

        for i in 0..3 {
            let symbol = String::from_str(&env, if i == 0 { "TK0" } else if i == 1 { "TK1" } else { "TK2" });
            let name = String::from_str(&env, if i == 0 { "Token 0" } else if i == 1 { "Token 1" } else { "Token 2" });
            let serialized_asset = create_test_serialized_asset(&env, &symbol, &creator, i);
            
            client.launch_token(
                &creator,
                &name,
                &symbol,
                &String::from_str(&env, "ipfs://test"),
                &String::from_str(&env, "Description"),
                &serialized_asset,
            );
        }

        assert_eq!(client.get_token_count(), 3);
        let creator_tokens = client.get_creator_tokens(&creator);
        assert_eq!(creator_tokens.len(), 3);
    }

    // ========== Buy/Sell Tests ==========

    #[test]
    fn test_buy_tokens_success() {
        let env = Env::default();
        let (client, _admin, _treasury) = setup_initialized_factory(&env);

        let creator = Address::generate(&env);
        let buyer = Address::generate(&env);
        let symbol = String::from_str(&env, "TEST");
        env.mock_all_auths();

        let serialized_asset = create_test_serialized_asset(&env, &symbol, &creator, 0);

        let token_addr = client.launch_token(
            &creator,
            &String::from_str(&env, "Test Token"),
            &symbol,
            &String::from_str(&env, "ipfs://test"),
            &String::from_str(&env, "Description"),
            &serialized_asset,
        );

        let xlm_amount = 1000_0000000;
        let min_tokens = 0;
        let deadline = get_test_deadline(&env);

        let tokens_received = client.buy(&buyer, &token_addr, &xlm_amount, &min_tokens, &deadline);
        assert!(tokens_received > 0);
    }

    #[test]
    #[should_panic(expected = "Error(Contract, #30)")]
    fn test_buy_nonexistent_token_fails() {
        let env = Env::default();
        let (client, _admin, _treasury) = setup_initialized_factory(&env);

        let buyer = Address::generate(&env);
        let fake_token = Address::generate(&env);
        let deadline = get_test_deadline(&env);
        env.mock_all_auths();

        client.buy(&buyer, &fake_token, &1000_0000000, &0, &deadline);
    }

    #[test]
    #[should_panic(expected = "Error(Contract, #40)")]
    fn test_buy_with_slippage_protection() {
        let env = Env::default();
        let (client, _admin, _treasury) = setup_initialized_factory(&env);

        let creator = Address::generate(&env);
        let buyer = Address::generate(&env);
        let symbol = String::from_str(&env, "TEST");
        env.mock_all_auths();

        let serialized_asset = create_test_serialized_asset(&env, &symbol, &creator, 0);

        let token_addr = client.launch_token(
            &creator,
            &String::from_str(&env, "Test"),
            &symbol,
            &String::from_str(&env, "ipfs://test"),
            &String::from_str(&env, "Desc"),
            &serialized_asset,
        );

        let xlm_amount = 100_0000000;
        let min_tokens = 1_000_000_000_0000000;
        let deadline = get_test_deadline(&env);

        client.buy(&buyer, &token_addr, &xlm_amount, &min_tokens, &deadline);
    }

    #[test]
    fn test_sell_tokens_success() {
        let env = Env::default();
        let (client, _admin, _treasury) = setup_initialized_factory(&env);

        let creator = Address::generate(&env);
        let buyer = Address::generate(&env);
        let symbol = String::from_str(&env, "TEST");
        env.mock_all_auths();

        let serialized_asset = create_test_serialized_asset(&env, &symbol, &creator, 0);

        let token_addr = client.launch_token(
            &creator,
            &String::from_str(&env, "Test"),
            &symbol,
            &String::from_str(&env, "ipfs://test"),
            &String::from_str(&env, "Desc"),
            &serialized_asset,
        );

        let xlm_amount = 1000_0000000;
        let deadline = get_test_deadline(&env);
        let tokens_received = client.buy(&buyer, &token_addr, &xlm_amount, &0, &deadline);

        let tokens_to_sell = tokens_received / 2;
        let xlm_received = client.sell(&buyer, &token_addr, &tokens_to_sell, &0, &deadline);

        assert!(xlm_received > 0);
    }

    // ========== Price Tests ==========

    #[test]
    fn test_price_increases_with_buys() {
        let env = Env::default();
        let (client, _admin, _treasury) = setup_initialized_factory(&env);

        let creator = Address::generate(&env);
        let buyer1 = Address::generate(&env);
        let buyer2 = Address::generate(&env);
        let symbol = String::from_str(&env, "TEST");
        env.mock_all_auths();

        let serialized_asset = create_test_serialized_asset(&env, &symbol, &creator, 0);

        let token_addr = client.launch_token(
            &creator,
            &String::from_str(&env, "Test"),
            &symbol,
            &String::from_str(&env, "ipfs://test"),
            &String::from_str(&env, "Desc"),
            &serialized_asset,
        );

        let price_initial = client.get_price(&token_addr);
        let deadline = get_test_deadline(&env);

        client.buy(&buyer1, &token_addr, &1000_0000000, &0, &deadline);
        let price_after_buy1 = client.get_price(&token_addr);

        client.buy(&buyer2, &token_addr, &1000_0000000, &0, &deadline);
        let price_after_buy2 = client.get_price(&token_addr);

        assert!(price_after_buy1 > price_initial);
        assert!(price_after_buy2 > price_after_buy1);
    }

    // ========== Pagination Tests ==========

    #[test]
    fn test_get_creator_tokens_paginated() {
        let env = Env::default();
        let (client, _admin, _treasury) = setup_initialized_factory(&env);

        let creator = Address::generate(&env);
        env.mock_all_auths();

        for i in 0..10 {
            let name = if i < 5 {
                String::from_str(&env, "TokenA")
            } else {
                String::from_str(&env, "TokenB")
            };
            let symbol_str = if i % 2 == 0 { "TA" } else { "TB" };
            let symbol = String::from_str(&env, symbol_str);
            
            let serialized_asset = create_test_serialized_asset(&env, &symbol, &creator, i);

            client.launch_token(
                &creator,
                &name,
                &symbol,
                &String::from_str(&env, "ipfs://test"),
                &String::from_str(&env, "Desc"),
                &serialized_asset,
            );
        }

        let page1 = client.get_creator_tokens_paginated(&creator, &0, &5);
        assert_eq!(page1.len(), 5);

        let page2 = client.get_creator_tokens_paginated(&creator, &5, &5);
        assert_eq!(page2.len(), 5);

        let page3 = client.get_creator_tokens_paginated(&creator, &10, &5);
        assert_eq!(page3.len(), 0);
    }

    // ========== Graduation Tests ==========

    #[test]
    fn test_graduation_progress() {
        let env = Env::default();
        let (client, _admin, _treasury) = setup_initialized_factory(&env);

        let creator = Address::generate(&env);
        let buyer = Address::generate(&env);
        let symbol = String::from_str(&env, "TEST");
        env.mock_all_auths();

        let serialized_asset = create_test_serialized_asset(&env, &symbol, &creator, 0);

        let token_addr = client.launch_token(
            &creator,
            &String::from_str(&env, "Test"),
            &symbol,
            &String::from_str(&env, "ipfs://test"),
            &String::from_str(&env, "Desc"),
            &serialized_asset,
        );

        let progress_initial = client.get_graduation_progress(&token_addr);
        assert_eq!(progress_initial, 0);

        let deadline = get_test_deadline(&env);
        client.buy(&buyer, &token_addr, &1000_0000000, &0, &deadline);

        let progress_after = client.get_graduation_progress(&token_addr);
        assert!(progress_after > 0);
        assert!(progress_after < 10_000);
    }

    // ========== Access Control Tests ==========

    #[test]
    fn test_pause_unpause() {
        let env = Env::default();
        let (client, admin, _treasury) = setup_initialized_factory(&env);

        env.mock_all_auths();

        client.grant_role(&admin, &admin, &crate::access_control::Role::PauseAdmin);
        client.pause(&admin);
        client.unpause(&admin);
    }

    #[test]
    fn test_grant_revoke_role() {
        let env = Env::default();
        let (client, admin, _treasury) = setup_initialized_factory(&env);

        let user = Address::generate(&env);
        env.mock_all_auths();

        client.grant_role(&admin, &user, &crate::access_control::Role::FeeAdmin);
        assert!(client.has_role(&user, &crate::access_control::Role::FeeAdmin));

        client.revoke_role(&admin, &user, &crate::access_control::Role::FeeAdmin);
        assert!(!client.has_role(&user, &crate::access_control::Role::FeeAdmin));
    }

    // ========== Fee Management Tests ==========

    #[test]
    fn test_update_fees() {
        let env = Env::default();
        let (client, admin, _treasury) = setup_initialized_factory(&env);

        env.mock_all_auths();

        client.grant_role(&admin, &admin, &crate::access_control::Role::FeeAdmin);

        let new_creation_fee = 200_000i128;
        let new_trading_fee = 200i128;

        client.update_fees(&admin, &new_creation_fee, &new_trading_fee);

        let fee_config = client.get_fee_config();
        assert_eq!(fee_config.creation_fee, new_creation_fee);
        assert_eq!(fee_config.trading_fee_bps, new_trading_fee);
    }

    #[test]
    fn test_update_treasury() {
        let env = Env::default();
        let (client, admin, _treasury) = setup_initialized_factory(&env);

        let new_treasury = Address::generate(&env);
        env.mock_all_auths();

        client.grant_role(&admin, &admin, &crate::access_control::Role::TreasuryAdmin);
        client.update_treasury(&admin, &new_treasury);

        let fee_config = client.get_fee_config();
        assert_eq!(fee_config.treasury, new_treasury);
    }
}
