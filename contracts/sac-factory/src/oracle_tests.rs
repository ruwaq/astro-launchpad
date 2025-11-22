//! Oracle Integration Tests
//! Sprint 2 - Price Oracle Integration

#[cfg(test)]
mod oracle_tests {
    use crate::{SacFactory, SacFactoryClient};
    use soroban_sdk::{
        testutils::Address as _,
        Address, BytesN, Env,
    };

    fn create_factory(env: &Env) -> (SacFactoryClient, Address, Address) {
        let contract_id = env.register(SacFactory, ());
        let client = SacFactoryClient::new(env, &contract_id);
        let admin = Address::generate(env);
        let treasury = Address::generate(env);
        (client, admin, treasury)
    }

    fn setup_factory(env: &Env) -> (SacFactoryClient, Address, Address) {
        let (client, admin, treasury) = create_factory(env);
        env.mock_all_auths();
        client.initialize(&admin, &treasury);
        (client, admin, treasury)
    }

    // ========== Oracle Configuration Tests ==========

    #[test]
    fn test_set_oracle_address() {
        let env = Env::default();
        let (client, admin, _treasury) = setup_factory(&env);
        env.mock_all_auths();

        // Grant owner role
        client.grant_role(&admin, &admin, &crate::access_control::Role::Owner);

        // Set oracle address
        let oracle_address = Address::generate(&env);
        client.set_oracle_address(&admin, &oracle_address);

        // Verify oracle configuration
        let (configured_oracle, _min_cap) = client.get_oracle_config();
        assert!(configured_oracle.is_some());
        assert_eq!(configured_oracle.unwrap(), oracle_address);
    }

    #[test]
    #[should_panic]
    fn test_set_oracle_address_unauthorized() {
        let env = Env::default();
        let (client, _admin, _treasury) = setup_factory(&env);

        let unauthorized = Address::generate(&env);
        let oracle_address = Address::generate(&env);
        env.mock_all_auths();

        // Should panic - unauthorized
        client.set_oracle_address(&unauthorized, &oracle_address);
    }

    #[test]
    fn test_set_min_market_cap_usd() {
        let env = Env::default();
        let (client, admin, _treasury) = setup_factory(&env);
        env.mock_all_auths();

        // Grant owner role
        client.grant_role(&admin, &admin, &crate::access_control::Role::Owner);

        // Set minimum market cap: $100,000 USD
        let min_market_cap = 100_000_000_000_000_000_000_000u128; // $100k with 18 decimals
        client.set_min_market_cap_usd(&admin, &min_market_cap);

        // Verify configuration
        let (_oracle, configured_min_cap) = client.get_oracle_config();
        assert_eq!(configured_min_cap, min_market_cap);
    }

    #[test]
    #[should_panic]
    fn test_set_min_market_cap_unauthorized() {
        let env = Env::default();
        let (client, _admin, _treasury) = setup_factory(&env);

        let unauthorized = Address::generate(&env);
        env.mock_all_auths();

        let min = 1000u128;
        // Should panic - unauthorized
        client.set_min_market_cap_usd(&unauthorized, &min);
    }

    #[test]
    fn test_get_oracle_config_not_configured() {
        let env = Env::default();
        let (client, _admin, _treasury) = setup_factory(&env);

        // Check default configuration
        let (oracle, min_cap) = client.get_oracle_config();
        assert!(oracle.is_none());
        assert_eq!(min_cap, 0u128); // Default: no minimum
    }

    #[test]
    fn test_oracle_configuration_complete() {
        let env = Env::default();
        let (client, admin, _treasury) = setup_factory(&env);
        env.mock_all_auths();

        // Grant owner role
        client.grant_role(&admin, &admin, &crate::access_control::Role::Owner);

        // Configure both oracle address and min market cap
        let oracle_address = Address::generate(&env);
        let min_market_cap = 50_000_000_000_000_000_000_000u128; // $50k

        client.set_oracle_address(&admin, &oracle_address);
        client.set_min_market_cap_usd(&admin, &min_market_cap);

        // Verify both are configured
        let (configured_oracle, configured_min_cap) = client.get_oracle_config();
        assert!(configured_oracle.is_some());
        assert_eq!(configured_oracle.unwrap(), oracle_address);
        assert_eq!(configured_min_cap, min_market_cap);
    }

    // ========== AMM Configuration with Oracle Tests ==========

    #[test]
    fn test_amm_and_oracle_configuration() {
        let env = Env::default();
        let (client, admin, _treasury) = setup_factory(&env);
        env.mock_all_auths();

        // Grant owner role
        client.grant_role(&admin, &admin, &crate::access_control::Role::Owner);

        // Configure AMM WASM hash
        let amm_wasm_hash = BytesN::from_array(&env, &[1u8; 32]);
        client.set_amm_wasm_hash(&admin, &amm_wasm_hash);

        // Configure Oracle
        let oracle_address = Address::generate(&env);
        client.set_oracle_address(&admin, &oracle_address);

        // Both should be configured for production graduation
        let (oracle, _) = client.get_oracle_config();
        assert!(oracle.is_some());
    }

    #[test]
    fn test_update_oracle_address() {
        let env = Env::default();
        let (client, admin, _treasury) = setup_factory(&env);
        env.mock_all_auths();

        // Grant owner role
        client.grant_role(&admin, &admin, &crate::access_control::Role::Owner);

        // Set initial oracle
        let oracle_v1 = Address::generate(&env);
        client.set_oracle_address(&admin, &oracle_v1);

        // Update to new oracle
        let oracle_v2 = Address::generate(&env);
        client.set_oracle_address(&admin, &oracle_v2);

        // Verify updated
        let (configured_oracle, _) = client.get_oracle_config();
        assert_eq!(configured_oracle.unwrap(), oracle_v2);
    }

    #[test]
    fn test_update_min_market_cap() {
        let env = Env::default();
        let (client, admin, _treasury) = setup_factory(&env);
        env.mock_all_auths();

        // Grant owner role
        client.grant_role(&admin, &admin, &crate::access_control::Role::Owner);

        // Set initial minimum
        let min_v1 = 50_000_000_000_000_000_000_000u128; // $50k
        client.set_min_market_cap_usd(&admin, &min_v1);

        // Update to higher minimum
        let min_v2 = 100_000_000_000_000_000_000_000u128; // $100k
        client.set_min_market_cap_usd(&admin, &min_v2);

        // Verify updated
        let (_, configured_min_cap) = client.get_oracle_config();
        assert_eq!(configured_min_cap, min_v2);
    }

    #[test]
    fn test_disable_min_market_cap() {
        let env = Env::default();
        let (client, admin, _treasury) = setup_factory(&env);
        env.mock_all_auths();

        // Grant owner role
        client.grant_role(&admin, &admin, &crate::access_control::Role::Owner);

        // Set minimum
        let min_cap = 100_000_000_000_000_000_000_000u128;
        client.set_min_market_cap_usd(&admin, &min_cap);

        // Disable by setting to 0
        let zero = 0u128;
        client.set_min_market_cap_usd(&admin, &zero);

        // Verify disabled
        let (_, configured_min_cap) = client.get_oracle_config();
        assert_eq!(configured_min_cap, 0u128);
    }
}
