#![cfg(test)]

//! Integration Tests for AMM Pair Contract

use soroban_sdk::{
    testutils::Address as _,
    Address, Env,
};
use amm_pair::{AMMPair, AMMPairClient};

fn setup_test() -> (Env, Address, Address, Address, Address, AMMPairClient<'static>) {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(AMMPair, ());
    let client = AMMPairClient::new(&env, &contract_id);

    let token_0 = Address::generate(&env);
    let token_1 = Address::generate(&env);
    let factory = Address::generate(&env);
    let fee_to = Address::generate(&env);

    // Initialize the pair
    client.initialize(&token_0, &token_1, &factory, &fee_to);

    (env, token_0, token_1, factory, fee_to, client)
}

// ========== Initialization Tests ==========

#[test]
fn test_initialize() {
    let (env, token_0, token_1, _factory, _fee_to, client) = setup_test();

    let pair_info = client.get_pair_info();
    // Tokens should be sorted (lower address = token_0)
    let sorted_0 = if token_0 < token_1 { token_0.clone() } else { token_1.clone() };
    let sorted_1 = if token_0 < token_1 { token_1.clone() } else { token_0.clone() };
    assert_eq!(pair_info.token_0, sorted_0);
    assert_eq!(pair_info.token_1, sorted_1);
    assert_eq!(pair_info.reserve_0, 0);
    assert_eq!(pair_info.reserve_1, 0);
    assert_eq!(pair_info.total_supply, 0);
}

#[test]
#[should_panic(expected = "Error(Contract, #1)")]
fn test_initialize_twice_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(AMMPair, ());
    let client = AMMPairClient::new(&env, &contract_id);

    let token_0 = Address::generate(&env);
    let token_1 = Address::generate(&env);
    let factory = Address::generate(&env);
    let fee_to = Address::generate(&env);

    client.initialize(&token_0, &token_1, &factory, &fee_to);
    // Second initialization should fail
    client.initialize(&token_0, &token_1, &factory, &fee_to);
}

// ========== Admin: set_fee_bps Tests ==========

#[test]
fn test_set_fee_bps_success() {
    let (_env, _token_0, _token_1, factory, _fee_to, client) = setup_test();

    // Default fee should be 30 bps (0.3%)
    assert_eq!(client.fee_bps(), 30u32);

    // Factory can set fee
    client.set_fee_bps(&factory, &50u32);
    assert_eq!(client.fee_bps(), 50u32);
}

#[test]
fn test_set_fee_bps_to_zero() {
    let (_env, _token_0, _token_1, factory, _fee_to, client) = setup_test();

    // Setting fee to 0 should be allowed (no trading fee)
    client.set_fee_bps(&factory, &0u32);
    assert_eq!(client.fee_bps(), 0u32);
}

#[test]
fn test_set_fee_bps_max_allowed() {
    let (_env, _token_0, _token_1, factory, _fee_to, client) = setup_test();

    // Max allowed fee is 1000 bps (10%)
    client.set_fee_bps(&factory, &1000u32);
    assert_eq!(client.fee_bps(), 1000u32);
}

#[test]
#[should_panic(expected = "Error(Contract, #91)")]
fn test_set_fee_bps_exceeds_max_fails() {
    let (_env, _token_0, _token_1, factory, _fee_to, client) = setup_test();

    // 1001 bps > 1000 should fail
    client.set_fee_bps(&factory, &1001u32);
}

#[test]
#[should_panic(expected = "Error(Contract, #53)")]
fn test_set_fee_bps_non_factory_fails() {
    let (_env, _token_0, _token_1, _factory, _fee_to, client) = setup_test();
    let random_user = Address::generate(&_env);

    // Non-factory caller should fail
    client.set_fee_bps(&random_user, &50u32);
}

// ========== Admin: set_minimum_liquidity Tests ==========

#[test]
fn test_set_minimum_liquidity_success() {
    let (_env, _token_0, _token_1, factory, _fee_to, client) = setup_test();

    // Default minimum liquidity should be 1000
    assert_eq!(client.minimum_liquidity(), 1000i128);

    // Factory can set minimum liquidity
    client.set_minimum_liquidity(&factory, &500i128);
    assert_eq!(client.minimum_liquidity(), 500i128);
}

#[test]
fn test_set_minimum_liquidity_to_zero() {
    let (_env, _token_0, _token_1, factory, _fee_to, client) = setup_test();

    // Setting to 0 should be allowed (no minimum lock)
    client.set_minimum_liquidity(&factory, &0i128);
    assert_eq!(client.minimum_liquidity(), 0i128);
}

#[test]
#[should_panic(expected = "Error(Contract, #42)")]
fn test_set_minimum_liquidity_negative_fails() {
    let (_env, _token_0, _token_1, factory, _fee_to, client) = setup_test();

    // Negative minimum liquidity should fail
    client.set_minimum_liquidity(&factory, &(-1i128));
}

#[test]
#[should_panic(expected = "Error(Contract, #53)")]
fn test_set_minimum_liquidity_non_factory_fails() {
    let (_env, _token_0, _token_1, _factory, _fee_to, client) = setup_test();
    let random_user = Address::generate(&_env);

    // Non-factory caller should fail
    client.set_minimum_liquidity(&random_user, &500i128);
}

// ========== Query Tests ==========

#[test]
fn test_get_reserves() {
    let (_env, _token_0, _token_1, _factory, _fee_to, client) = setup_test();

    let (reserve_0, reserve_1, _timestamp) = client.get_reserves();
    assert_eq!(reserve_0, 0);
    assert_eq!(reserve_1, 0);
}

#[test]
fn test_total_supply_initial() {
    let (_env, _token_0, _token_1, _factory, _fee_to, client) = setup_test();

    assert_eq!(client.total_supply(), 0);
}