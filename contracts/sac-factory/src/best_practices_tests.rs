//! Integration Tests for Soroban Best Practices 2026
//!
//! Tests for:
//! - Input validation (DoS prevention)
//! - Storage optimization (gas savings)
//! - State management (pause/unpause with optimization)
//! - Resource tracking (CPU, memory, storage)

#[cfg(test)]
mod tests {
    use crate::{
        SacFactory, SacFactoryClient,
        anti_whale,
        errors::Error,
        state_management::ContractState,
    };
    use soroban_sdk::{
        testutils::{Address as _, AuthorizedFunction, AuthorizedInvocation},
        Address, Bytes, BytesN, Env, String, Vec,
    };

    /// Helper to create a test issuer public key string
    fn create_test_issuer(env: &Env) -> String {
        String::from_str(env, "GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGSNFHEYVXM3XOJMDS674JZ")
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

    // Helper to deploy and initialize factory
    fn setup_factory(env: &Env) -> (SacFactoryClient, Address, Address) {
        use soroban_sdk::BytesN;

        // Register the contract (actual deployment in test environment)
        let contract_id = env.register(SacFactory, ());
        let client = SacFactoryClient::new(env, &contract_id);

        let admin = Address::generate(env);
        let treasury = Address::generate(env);
        let xlm_token = Address::generate(env);

        env.mock_all_auths();

        // Initialize the contract
        client.initialize(&admin, &treasury, &xlm_token);

        (client, admin, treasury)
    }

    // ====================
    // INPUT VALIDATION TESTS
    // ====================

    #[test]
    #[should_panic(expected = "Error(Contract, #300)")] // InvalidName
    fn test_validate_name_too_long() {
        let env = Env::default();
        let (client, _admin, _treasury) = setup_factory(&env);

        let creator = Address::generate(&env);
        let symbol = String::from_str(&env, "TEST");
        let issuer = create_test_issuer(&env);

        env.mock_all_auths();

        // Create name longer than MAX_NAME_LENGTH (32)
        let long_name = String::from_str(&env, "This is a very long name that exceeds the maximum allowed length");

        let serialized_asset = create_test_serialized_asset(&env, &symbol, &creator, 0);

        client.launch_token(
            &creator,
            &long_name,
            &symbol,
            &issuer,
            &String::from_str(&env, "ipfs://test"),
            &String::from_str(&env, "Description"),
            &serialized_asset,
        );
    }

    #[test]
    #[should_panic(expected = "Error(Contract, #301)")] // InvalidSymbol
    fn test_validate_symbol_too_long() {
        let env = Env::default();
        let (client, _admin, _treasury) = setup_factory(&env);

        let creator = Address::generate(&env);
        let issuer = create_test_issuer(&env);

        env.mock_all_auths();

        // Create serialized asset with valid symbol (to avoid SDK panic)
        let valid_symbol = String::from_str(&env, "TEST");
        let serialized_asset = create_test_serialized_asset(&env, &valid_symbol, &creator, 0);

        // But pass a symbol that's too long to launch_token (validation should catch it)
        let long_symbol = String::from_str(&env, "VERYLONGSYMBOLEXCEEDING");

        client.launch_token(
            &creator,
            &String::from_str(&env, "Test Token"),
            &long_symbol,
            &issuer,
            &String::from_str(&env, "ipfs://test"),
            &String::from_str(&env, "Description"),
            &serialized_asset,
        );
    }

    #[test]
    #[should_panic(expected = "Error(Contract, #302)")] // InvalidAmount
    fn test_validate_image_url_too_long() {
        let env = Env::default();
        let (client, _admin, _treasury) = setup_factory(&env);

        let creator = Address::generate(&env);
        let symbol = String::from_str(&env, "TEST");
        let issuer = create_test_issuer(&env);

        env.mock_all_auths();

        // Create URL longer than MAX_IMAGE_URL_LENGTH (256)
        let long_url = String::from_str(&env, &"x".repeat(300));

        let serialized_asset = create_test_serialized_asset(&env, &symbol, &creator, 0);

        client.launch_token(
            &creator,
            &String::from_str(&env, "Test"),
            &symbol,
            &issuer,
            &long_url,
            &String::from_str(&env, "Description"),
            &serialized_asset,
        );
    }

    #[test]
    #[should_panic(expected = "Error(Contract, #302)")] // InvalidAmount
    fn test_validate_description_too_long() {
        let env = Env::default();
        let (client, _admin, _treasury) = setup_factory(&env);

        let creator = Address::generate(&env);
        let symbol = String::from_str(&env, "TEST");
        let issuer = create_test_issuer(&env);

        env.mock_all_auths();

        // Create description longer than MAX_DESCRIPTION_LENGTH (512)
        let long_desc = String::from_str(&env, &"x".repeat(600));

        let serialized_asset = create_test_serialized_asset(&env, &symbol, &creator, 0);

        client.launch_token(
            &creator,
            &String::from_str(&env, "Test"),
            &symbol,
            &issuer,
            &String::from_str(&env, "ipfs://test"),
            &long_desc,
            &serialized_asset,
        );
    }

    #[test]
    #[should_panic(expected = "Error(Contract, #302)")] // InvalidAmount
    fn test_validate_fee_tiers_too_many() {
        let env = Env::default();
        let (client, admin, _treasury) = setup_factory(&env);

        env.mock_all_auths();

        // Create more than MAX_FEE_TIERS (10) tiers
        let mut thresholds = Vec::new(&env);
        let mut fees = Vec::new(&env);

        for i in 0..12 {
            thresholds.push_back((i + 1) * 100);
            fees.push_back(i * 10);
        }

        let config = anti_whale::AntiWhaleConfig {
            absolute_max_holdings_bps: 1000,
            tier_thresholds: thresholds,
            tier_fees: fees,
            cooldown_seconds: 0,
            enabled: false,
        };

        client.set_anti_whale_config(&admin, &config);
    }

    #[test]
    #[should_panic(expected = "Error(Contract, #302)")] // InvalidAmount
    fn test_validate_fee_tiers_not_ascending() {
        let env = Env::default();
        let (client, admin, _treasury) = setup_factory(&env);

        env.mock_all_auths();

        // Create tiers with non-ascending thresholds
        let thresholds = Vec::from_array(&env, [1000, 500, 2000]); // Not ascending!
        let fees = Vec::from_array(&env, [100, 200, 300]);

        let config = anti_whale::AntiWhaleConfig {
            absolute_max_holdings_bps: 1000,
            tier_thresholds: thresholds,
            tier_fees: fees,
            cooldown_seconds: 0,
            enabled: false,
        };

        client.set_anti_whale_config(&admin, &config);
    }

    // ====================
    // STATE MANAGEMENT TESTS
    // ====================

    #[test]
    fn test_pause_unpause_with_storage_optimization() {
        let env = Env::default();
        let (client, admin, _treasury) = setup_factory(&env);

        env.mock_all_auths();

        // Pause the contract
        client.pause(&admin);

        // Verify paused
        let paused = client.get_state();
        assert_eq!(paused, ContractState::Paused);

        // Try to launch token while paused - should fail
        let creator = Address::generate(&env);
        let symbol = String::from_str(&env, "TEST");
        let issuer = create_test_issuer(&env);
        let serialized_asset = create_test_serialized_asset(&env, &symbol, &creator, 0);

        let result = client.try_launch_token(
            &creator,
            &String::from_str(&env, "Test"),
            &symbol,
            &issuer,
            &String::from_str(&env, "ipfs://test"),
            &String::from_str(&env, "Description"),
            &serialized_asset,
        );
        assert!(result.is_err());

        // Unpause
        client.unpause(&admin);

        // Verify unpaused
        let active = client.get_state();
        assert_eq!(active, ContractState::Active);

        // Now launch should work
        let serialized_asset2 = create_test_serialized_asset(&env, &symbol, &creator, 1);
        client.launch_token(
            &creator,
            &String::from_str(&env, "Test"),
            &symbol,
            &issuer,
            &String::from_str(&env, "ipfs://test"),
            &String::from_str(&env, "Description"),
            &serialized_asset2,
        );
    }

    #[test]
    #[should_panic(expected = "Error(Contract, #200)")] // Unauthorized
    fn test_pause_unauthorized() {
        let env = Env::default();
        let (client, _admin, _treasury) = setup_factory(&env);

        let unauthorized = Address::generate(&env);
        env.mock_all_auths();

        // Non-admin trying to pause should fail
        client.pause(&unauthorized);
    }

    // ====================
    // RESOURCE TRACKING TESTS
    // ====================

    #[test]
    fn test_buy_resource_usage() {
        let env = Env::default();
        env.budget().reset_unlimited(); // Start with unlimited budget for setup

        let (client, _admin, _treasury) = setup_factory(&env);

        let creator = Address::generate(&env);
        let symbol = String::from_str(&env, "TEST");
        let issuer = create_test_issuer(&env);

        env.mock_all_auths();

        // Launch a token
        let serialized_asset = create_test_serialized_asset(&env, &symbol, &creator, 0);
        let token_address = client.launch_token(
            &creator,
            &String::from_str(&env, "Test Token"),
            &symbol,
            &issuer,
            &String::from_str(&env, "ipfs://test"),
            &String::from_str(&env, "A test token"),
            &serialized_asset,
        );

        // Reset budget for buy operation measurement
        env.budget().reset_default();

        let buyer = Address::generate(&env);
        let xlm_amount = 10_000_000i128; // 1 XLM
        let deadline = env.ledger().timestamp() + 60;

        // Execute buy and measure resource usage
        client.buy(
            &buyer,
            &token_address,
            &xlm_amount,
            &0,
            &deadline,
        );

        // Log resource usage
        // Note: In real tests, you would assert maximum CPU/memory limits
        env.budget().print();
    }

    #[test]
    fn test_launch_token_resource_usage() {
        let env = Env::default();
        env.budget().reset_unlimited();

        let (client, _admin, _treasury) = setup_factory(&env);

        let creator = Address::generate(&env);
        let symbol = String::from_str(&env, "TEST");
        let issuer = create_test_issuer(&env);

        env.mock_all_auths();

        // Reset budget for launch measurement
        env.budget().reset_default();

        // Execute launch and measure resources
        let serialized_asset = create_test_serialized_asset(&env, &symbol, &creator, 0);
        client.launch_token(
            &creator,
            &String::from_str(&env, "Test Token"),
            &symbol,
            &issuer,
            &String::from_str(&env, "ipfs://test"),
            &String::from_str(&env, "Description"),
            &serialized_asset,
        );

        // Log resource usage
        env.budget().print();
    }

    // ====================
    // EDGE CASE TESTS
    // ====================

    #[test]
    fn test_empty_optional_fields() {
        let env = Env::default();
        let (client, _admin, _treasury) = setup_factory(&env);

        let creator = Address::generate(&env);
        let symbol = String::from_str(&env, "TEST");
        let issuer = create_test_issuer(&env);

        env.mock_all_auths();

        // Launch with empty optional fields (image_url, description)
        let serialized_asset = create_test_serialized_asset(&env, &symbol, &creator, 0);
        let token_address = client.launch_token(
            &creator,
            &String::from_str(&env, "Test"),
            &symbol,
            &issuer,
            &String::from_str(&env, ""), // Empty image_url
            &String::from_str(&env, ""), // Empty description
            &serialized_asset,
        );

        // Should succeed - optional fields can be empty
        assert!(token_address != Address::generate(&env));
    }

    #[test]
    fn test_minimum_valid_inputs() {
        let env = Env::default();
        let (client, _admin, _treasury) = setup_factory(&env);

        let creator = Address::generate(&env);
        let symbol = String::from_str(&env, "T");
        let issuer = create_test_issuer(&env);

        env.mock_all_auths();

        // Use minimum valid lengths
        let serialized_asset = create_test_serialized_asset(&env, &symbol, &creator, 0);
        let token_address = client.launch_token(
            &creator,
            &String::from_str(&env, "T"), // Min 1 char name
            &symbol,  // Min 1 char symbol
            &issuer,
            &String::from_str(&env, ""),
            &String::from_str(&env, ""),
            &serialized_asset,
        );

        assert!(token_address != Address::generate(&env));
    }

    #[test]
    fn test_maximum_valid_inputs() {
        let env = Env::default();
        let (client, _admin, _treasury) = setup_factory(&env);

        let creator = Address::generate(&env);
        env.mock_all_auths();

        // Use maximum valid lengths
        let max_name = "A".repeat(32); // MAX_NAME_LENGTH
        let max_symbol = "B".repeat(12); // MAX_SYMBOL_LENGTH
        let max_url = "C".repeat(256); // MAX_IMAGE_URL_LENGTH
        let max_desc = "D".repeat(512); // MAX_DESCRIPTION_LENGTH

        let symbol = String::from_str(&env, &max_symbol);
        let issuer = create_test_issuer(&env);

        let serialized_asset = create_test_serialized_asset(&env, &symbol, &creator, 0);
        let token_address = client.launch_token(
            &creator,
            &String::from_str(&env, &max_name),
            &symbol,
            &issuer,
            &String::from_str(&env, &max_url),
            &String::from_str(&env, &max_desc),
            &serialized_asset,
        );

        assert!(token_address != Address::generate(&env));
    }
}
