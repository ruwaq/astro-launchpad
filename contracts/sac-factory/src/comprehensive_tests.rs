//! Comprehensive Test Suite for 80%+ Coverage
//! Sprint 2 - Additional test coverage

#[cfg(test)]
mod comprehensive_tests {
    use crate::{SacFactory, SacFactoryClient};
    use soroban_sdk::{
        testutils::{Address as _, Ledger},
        Address, BytesN, Env, String,
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

    fn get_test_deadline(env: &Env) -> u64 {
        env.ledger().timestamp() + 31_536_000
    }

    // ========== Initialization Edge Cases ==========

    #[test]
    #[should_panic(expected = "Error(Contract, #1)")]
    fn test_cannot_initialize_twice() {
        let env = Env::default();
        let (client, admin, treasury) = create_factory(&env);
        env.mock_all_auths();

        client.initialize(&admin, &treasury);
        client.initialize(&admin, &treasury); // Should panic
    }

    // ========== Transfer Ownership Tests ==========

    #[test]
    fn test_transfer_ownership() {
        let env = Env::default();
        let (client, admin, _treasury) = setup_factory(&env);

        let new_owner = Address::generate(&env);
        env.mock_all_auths();

        // Grant owner role to admin first
        client.grant_role(&admin, &admin, &crate::access_control::Role::Owner);

        // Transfer ownership
        client.transfer_ownership(&admin, &new_owner);

        // New owner should have role
        assert!(client.has_role(&new_owner, &crate::access_control::Role::Owner));
    }

    // ========== Get State Tests ==========

    #[test]
    fn test_get_state_active() {
        let env = Env::default();
        let (client, _admin, _treasury) = setup_factory(&env);

        let state = client.get_state();
        assert_eq!(state, crate::state_management::ContractState::Active);
    }

    #[test]
    fn test_get_state_paused() {
        let env = Env::default();
        let (client, admin, _treasury) = setup_factory(&env);
        env.mock_all_auths();

        // Grant pause admin role
        client.grant_role(&admin, &admin, &crate::access_control::Role::PauseAdmin);

        // Pause contract
        client.pause(&admin);

        let state = client.get_state();
        assert_eq!(state, crate::state_management::ContractState::Paused);
    }

    // ========== AMM WASM Hash Tests ==========

    #[test]
    fn test_set_amm_wasm_hash() {
        let env = Env::default();
        let (client, admin, _treasury) = setup_factory(&env);
        env.mock_all_auths();

        // Grant owner role
        client.grant_role(&admin, &admin, &crate::access_control::Role::Owner);

        // Set AMM WASM hash
        let wasm_hash = BytesN::from_array(&env, &[1u8; 32]);
        client.set_amm_wasm_hash(&admin, &wasm_hash);
    }

    #[test]
    #[should_panic]
    fn test_set_amm_wasm_hash_unauthorized() {
        let env = Env::default();
        let (client, _admin, _treasury) = setup_factory(&env);

        let unauthorized = Address::generate(&env);
        let wasm_hash = BytesN::from_array(&env, &[1u8; 32]);
        env.mock_all_auths();

        // Should panic - unauthorized user
        client.set_amm_wasm_hash(&unauthorized, &wasm_hash);
    }

    // ========== Get AMM Pair Tests ==========

    #[test]
    fn test_get_amm_pair_none_for_non_graduated() {
        let env = Env::default();
        let (client, _admin, _treasury) = setup_factory(&env);

        let token = Address::generate(&env);
        let result = client.get_amm_pair(&token);

        assert!(result.is_none());
    }

    // ========== Input Validation Tests ==========

    #[test]
    #[should_panic(expected = "Error(Contract, #22)")]
    fn test_buy_zero_amount() {
        let env = Env::default();
        let (client, _admin, _treasury) = setup_factory(&env);

        let buyer = Address::generate(&env);
        let token = Address::generate(&env);
        let deadline = get_test_deadline(&env);
        env.mock_all_auths();

        // Should panic - zero amount
        client.buy(&buyer, &token, &0, &0, &deadline);
    }

    #[test]
    #[should_panic(expected = "Error(Contract, #22)")]
    fn test_buy_negative_min_tokens() {
        let env = Env::default();
        let (client, _admin, _treasury) = setup_factory(&env);

        let buyer = Address::generate(&env);
        let token = Address::generate(&env);
        let deadline = get_test_deadline(&env);
        env.mock_all_auths();

        // Should panic - negative min_tokens
        client.buy(&buyer, &token, &1000, &-1, &deadline);
    }

    #[test]
    #[should_panic(expected = "Error(Contract, #22)")]
    fn test_sell_zero_amount() {
        let env = Env::default();
        let (client, _admin, _treasury) = setup_factory(&env);

        let seller = Address::generate(&env);
        let token = Address::generate(&env);
        let deadline = get_test_deadline(&env);
        env.mock_all_auths();

        // Should panic - zero amount
        client.sell(&seller, &token, &0, &0, &deadline);
    }

    #[test]
    #[should_panic(expected = "Error(Contract, #22)")]
    fn test_sell_negative_min_xlm() {
        let env = Env::default();
        let (client, _admin, _treasury) = setup_factory(&env);

        let seller = Address::generate(&env);
        let token = Address::generate(&env);
        let deadline = get_test_deadline(&env);
        env.mock_all_auths();

        // Should panic - negative min_xlm
        client.sell(&seller, &token, &1000, &-1, &deadline);
    }

    // ========== MEV Protection (Deadline) Tests ==========

    #[test]
    #[should_panic(expected = "Error(Contract, #100)")]
    fn test_buy_expired_deadline() {
        let env = Env::default();
        let (client, _admin, _treasury) = setup_factory(&env);

        let buyer = Address::generate(&env);
        let token = Address::generate(&env);
        env.mock_all_auths();

        // Set current time to 1000
        env.ledger().set_timestamp(1000);

        // Expired deadline (in the past)
        let expired_deadline = 999;

        // Should panic - expired deadline
        client.buy(&buyer, &token, &1000, &0, &expired_deadline);
    }

    #[test]
    #[should_panic(expected = "Error(Contract, #100)")]
    fn test_sell_expired_deadline() {
        let env = Env::default();
        let (client, _admin, _treasury) = setup_factory(&env);

        let seller = Address::generate(&env);
        let token = Address::generate(&env);
        env.mock_all_auths();

        env.ledger().set_timestamp(1000);
        let expired_deadline = 999;

        // Should panic - expired deadline
        client.sell(&seller, &token, &1000, &0, &expired_deadline);
    }

    // ========== Fee Management Edge Cases ==========

    #[test]
    fn test_update_fees_valid() {
        let env = Env::default();
        let (client, admin, _treasury) = setup_factory(&env);
        env.mock_all_auths();

        // Grant fee admin role
        client.grant_role(&admin, &admin, &crate::access_control::Role::FeeAdmin);

        // Update fees
        let new_creation_fee = 200_000i128;
        let new_trading_fee = 200i128;
        client.update_fees(&admin, &new_creation_fee, &new_trading_fee);

        // Verify
        let fee_config = client.get_fee_config();
        assert_eq!(fee_config.creation_fee, new_creation_fee);
        assert_eq!(fee_config.trading_fee_bps, new_trading_fee);
    }

    #[test]
    fn test_update_treasury_valid() {
        let env = Env::default();
        let (client, admin, _treasury) = setup_factory(&env);

        let new_treasury = Address::generate(&env);
        env.mock_all_auths();

        // Grant treasury admin role
        client.grant_role(&admin, &admin, &crate::access_control::Role::TreasuryAdmin);

        // Update treasury
        client.update_treasury(&admin, &new_treasury);

        // Verify
        let fee_config = client.get_fee_config();
        assert_eq!(fee_config.treasury, new_treasury);
    }

    // ========== Access Control Edge Cases ==========

    #[test]
    fn test_grant_multiple_roles() {
        let env = Env::default();
        let (client, admin, _treasury) = setup_factory(&env);
        env.mock_all_auths();

        // Grant owner role to admin
        client.grant_role(&admin, &admin, &crate::access_control::Role::Owner);

        let user = Address::generate(&env);

        // Grant multiple roles to user
        client.grant_role(&admin, &user, &crate::access_control::Role::FeeAdmin);
        client.grant_role(&admin, &user, &crate::access_control::Role::TreasuryAdmin);
        client.grant_role(&admin, &user, &crate::access_control::Role::PauseAdmin);

        // Verify all roles
        assert!(client.has_role(&user, &crate::access_control::Role::FeeAdmin));
        assert!(client.has_role(&user, &crate::access_control::Role::TreasuryAdmin));
        assert!(client.has_role(&user, &crate::access_control::Role::PauseAdmin));
    }

    #[test]
    fn test_revoke_role_works() {
        let env = Env::default();
        let (client, admin, _treasury) = setup_factory(&env);
        env.mock_all_auths();

        client.grant_role(&admin, &admin, &crate::access_control::Role::Owner);

        let user = Address::generate(&env);

        // Grant role
        client.grant_role(&admin, &user, &crate::access_control::Role::FeeAdmin);
        assert!(client.has_role(&user, &crate::access_control::Role::FeeAdmin));

        // Revoke role
        client.revoke_role(&admin, &user, &crate::access_control::Role::FeeAdmin);
        assert!(!client.has_role(&user, &crate::access_control::Role::FeeAdmin));
    }

    // ========== Pause/Unpause Edge Cases ==========

    #[test]
    #[should_panic]
    fn test_unpause_when_not_paused() {
        let env = Env::default();
        let (client, admin, _treasury) = setup_factory(&env);
        env.mock_all_auths();

        client.grant_role(&admin, &admin, &crate::access_control::Role::PauseAdmin);

        // Try to unpause when not paused - should panic
        client.unpause(&admin);
    }

    #[test]
    #[should_panic]
    fn test_pause_when_already_paused() {
        let env = Env::default();
        let (client, admin, _treasury) = setup_factory(&env);
        env.mock_all_auths();

        client.grant_role(&admin, &admin, &crate::access_control::Role::PauseAdmin);

        // Pause
        client.pause(&admin);

        // Try to pause again - should panic
        client.pause(&admin);
    }

    // ========== Pagination Edge Cases ==========

    #[test]
    fn test_pagination_offset_beyond_count() {
        let env = Env::default();
        let (client, _admin, _treasury) = setup_factory(&env);

        let creator = Address::generate(&env);

        // Get tokens with offset beyond count
        let result = client.get_creator_tokens_paginated(&creator, &100, &10);
        assert_eq!(result.len(), 0);
    }

    #[test]
    fn test_pagination_zero_limit() {
        let env = Env::default();
        let (client, _admin, _treasury) = setup_factory(&env);

        let creator = Address::generate(&env);

        // Get tokens with zero limit
        let result = client.get_creator_tokens_paginated(&creator, &0, &0);
        assert_eq!(result.len(), 0);
    }
}
