//! Tests for ASTRO Token

#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    Address, Env, String,
};

fn setup_test() -> (Env, Address, AstroTokenClient<'static>) {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(AstroToken, ());
    let client = AstroTokenClient::new(&env, &contract_id);
    let admin = Address::generate(&env);

    (env, admin, client)
}

fn create_initialized_token() -> (Env, Address, Address, AstroTokenClient<'static>) {
    let (env, admin, client) = setup_test();
    let user = Address::generate(&env);
    let initial_supply = 100_000_0000000i128; // 100k tokens with 7 decimals

    client.initialize(&admin, &user, &initial_supply);

    (env, admin, user, client)
}

// ========== Initialization Tests ==========

#[test]
fn test_initialize() {
    let (env, admin, client) = setup_test();
    let user = Address::generate(&env);
    let initial_supply = 1_000_000_0000000i128; // 1M tokens

    client.initialize(&admin, &user, &initial_supply);

    assert_eq!(client.admin(), admin);
    assert_eq!(client.balance(&user), initial_supply);
    assert_eq!(client.total_supply(), initial_supply);
    assert_eq!(client.decimals(), 7u32);
    assert_eq!(client.name(), String::from_str(&env, "Astro Shiba"));
    assert_eq!(client.symbol(), String::from_str(&env, "ASTRO"));
}

#[test]
fn test_initialize_zero_supply() {
    let (env, admin, client) = setup_test();
    let user = Address::generate(&env);

    client.initialize(&admin, &user, &0);

    assert_eq!(client.balance(&user), 0);
    assert_eq!(client.total_supply(), 0);
}

#[test]
#[should_panic(expected = "Error(Contract, #1)")]
fn test_initialize_twice_fails() {
    let (env, admin, client) = setup_test();
    let user = Address::generate(&env);

    client.initialize(&admin, &user, &1000);
    client.initialize(&admin, &user, &1000); // Should fail
}

#[test]
#[should_panic(expected = "Error(Contract, #6)")]
fn test_initialize_negative_supply_fails() {
    let (env, admin, client) = setup_test();
    let user = Address::generate(&env);

    client.initialize(&admin, &user, &-1000);
}

#[test]
#[should_panic(expected = "Error(Contract, #6)")]
fn test_initialize_exceeds_max_supply_fails() {
    let (env, admin, client) = setup_test();
    let user = Address::generate(&env);
    let max_plus_one = 1_000_000_001_0000000i128; // More than max

    client.initialize(&admin, &user, &max_plus_one);
}

// ========== Transfer Tests ==========

#[test]
fn test_transfer() {
    let (env, _admin, user, client) = create_initialized_token();
    let recipient = Address::generate(&env);
    let amount = 1000_0000000i128;

    client.transfer(&user, &recipient, &amount);

    assert_eq!(client.balance(&recipient), amount);
    assert_eq!(client.balance(&user), 100_000_0000000i128 - amount);
}

#[test]
#[should_panic(expected = "Insufficient balance")]
fn test_transfer_insufficient_balance_fails() {
    let (env, _admin, user, client) = create_initialized_token();
    let recipient = Address::generate(&env);
    let too_much = 200_000_0000000i128; // More than balance

    client.transfer(&user, &recipient, &too_much);
}

#[test]
#[should_panic(expected = "Amount must be non-negative")]
fn test_transfer_negative_amount_fails() {
    let (env, _admin, user, client) = create_initialized_token();
    let recipient = Address::generate(&env);

    client.transfer(&user, &recipient, &-1000);
}

// ========== Allowance Tests ==========

#[test]
fn test_approve_and_allowance() {
    let (env, _admin, user, client) = create_initialized_token();
    let spender = Address::generate(&env);
    let amount = 5000_0000000i128;
    let expiration = env.ledger().sequence() + 1000;

    client.approve(&user, &spender, &amount, &expiration);

    assert_eq!(client.allowance(&user, &spender), amount);
}

#[test]
fn test_transfer_from() {
    let (env, _admin, user, client) = create_initialized_token();
    let spender = Address::generate(&env);
    let recipient = Address::generate(&env);
    let approve_amount = 5000_0000000i128;
    let transfer_amount = 3000_0000000i128;
    let expiration = env.ledger().sequence() + 1000;

    client.approve(&user, &spender, &approve_amount, &expiration);
    client.transfer_from(&spender, &user, &recipient, &transfer_amount);

    assert_eq!(client.balance(&recipient), transfer_amount);
    assert_eq!(client.allowance(&user, &spender), approve_amount - transfer_amount);
}

#[test]
#[should_panic(expected = "Insufficient allowance")]
fn test_transfer_from_exceeds_allowance_fails() {
    let (env, _admin, user, client) = create_initialized_token();
    let spender = Address::generate(&env);
    let recipient = Address::generate(&env);
    let approve_amount = 1000_0000000i128;
    let transfer_amount = 2000_0000000i128;
    let expiration = env.ledger().sequence() + 1000;

    client.approve(&user, &spender, &approve_amount, &expiration);
    client.transfer_from(&spender, &user, &recipient, &transfer_amount);
}

#[test]
fn test_allowance_expiration() {
    let (env, _admin, user, client) = create_initialized_token();
    let spender = Address::generate(&env);
    let amount = 5000_0000000i128;
    let current = env.ledger().sequence();
    let expiration = current + 10;

    client.approve(&user, &spender, &amount, &expiration);

    // Before expiration
    assert_eq!(client.allowance(&user, &spender), amount);

    // Advance past expiration
    env.ledger().set_sequence_number(current + 20);
    assert_eq!(client.allowance(&user, &spender), 0);
}

// ========== Burn Tests ==========

#[test]
fn test_burn() {
    let (_env, _admin, user, client) = create_initialized_token();
    let burn_amount = 1000_0000000i128;
    let initial_balance = 100_000_0000000i128;

    client.burn(&user, &burn_amount);

    assert_eq!(client.balance(&user), initial_balance - burn_amount);
    assert_eq!(client.total_supply(), initial_balance - burn_amount);
}

#[test]
fn test_burn_from() {
    let (env, _admin, user, client) = create_initialized_token();
    let spender = Address::generate(&env);
    let burn_amount = 1000_0000000i128;
    let approve_amount = 5000_0000000i128;
    let initial_balance = 100_000_0000000i128;
    let expiration = env.ledger().sequence() + 1000;

    client.approve(&user, &spender, &approve_amount, &expiration);
    client.burn_from(&spender, &user, &burn_amount);

    assert_eq!(client.balance(&user), initial_balance - burn_amount);
    assert_eq!(client.total_supply(), initial_balance - burn_amount);
    assert_eq!(client.allowance(&user, &spender), approve_amount - burn_amount);
}

#[test]
#[should_panic(expected = "Insufficient balance")]
fn test_burn_exceeds_balance_fails() {
    let (_env, _admin, user, client) = create_initialized_token();
    let too_much = 200_000_0000000i128;

    client.burn(&user, &too_much);
}

// ========== Admin Tests ==========

#[test]
fn test_mint() {
    let (env, admin, user, client) = create_initialized_token();
    let mint_amount = 50_000_0000000i128;
    let initial_balance = 100_000_0000000i128;

    client.mint(&admin, &user, &mint_amount);

    assert_eq!(client.balance(&user), initial_balance + mint_amount);
    assert_eq!(client.total_supply(), initial_balance + mint_amount);
}

#[test]
#[should_panic(expected = "Unauthorized")]
fn test_mint_non_admin_fails() {
    let (env, _admin, user, client) = create_initialized_token();
    let not_admin = Address::generate(&env);
    let mint_amount = 1000_0000000i128;

    client.mint(&not_admin, &user, &mint_amount);
}

#[test]
#[should_panic(expected = "Max supply exceeded")]
fn test_mint_exceeds_max_supply_fails() {
    let (_env, admin, user, client) = create_initialized_token();
    let max_supply = 1_000_000_000_0000000i128;
    let current_supply = 100_000_0000000i128;
    let mint_amount = max_supply - current_supply + 1; // Just over max

    client.mint(&admin, &user, &mint_amount);
}

#[test]
fn test_set_admin() {
    let (env, admin, _user, client) = create_initialized_token();
    let new_admin = Address::generate(&env);

    client.set_admin(&admin, &new_admin);

    assert_eq!(client.admin(), new_admin);
}

#[test]
#[should_panic(expected = "Unauthorized")]
fn test_set_admin_non_admin_fails() {
    let (env, _admin, _user, client) = create_initialized_token();
    let not_admin = Address::generate(&env);
    let new_admin = Address::generate(&env);

    client.set_admin(&not_admin, &new_admin);
}

#[test]
fn test_is_admin() {
    let (env, admin, _user, client) = create_initialized_token();
    let not_admin = Address::generate(&env);

    assert!(client.is_admin(&admin));
    assert!(!client.is_admin(&not_admin));
}

// ========== Buyback & Burn Tests ==========

#[test]
fn test_buyback_burn() {
    let (env, _admin, user, client) = create_initialized_token();
    let burn_amount = 1000_0000000i128;
    let initial_balance = 100_000_0000000i128;

    // User calls buyback_burn (anyone can burn their own tokens)
    client.buyback_burn(&user, &burn_amount);

    assert_eq!(client.balance(&user), initial_balance - burn_amount);
    assert_eq!(client.total_supply(), initial_balance - burn_amount);
}

#[test]
#[should_panic(expected = "Amount must be positive")]
fn test_buyback_burn_zero_fails() {
    let (_env, _admin, user, client) = create_initialized_token();

    client.buyback_burn(&user, &0);
}

#[test]
#[should_panic(expected = "Insufficient balance")]
fn test_buyback_burn_exceeds_balance_fails() {
    let (_env, _admin, user, client) = create_initialized_token();
    let too_much = 200_000_0000000i128;

    client.buyback_burn(&user, &too_much);
}

// ========== Extended Functions Tests ==========

#[test]
fn test_total_supply() {
    let (_env, _admin, _user, client) = create_initialized_token();

    assert_eq!(client.total_supply(), 100_000_0000000i128);
}

#[test]
fn test_max_supply() {
    let (_env, _admin, _user, client) = create_initialized_token();

    assert_eq!(client.max_supply(), 1_000_000_000_0000000i128);
}

#[test]
fn test_metadata() {
    let (env, _admin, _user, client) = create_initialized_token();

    assert_eq!(client.decimals(), 7u32);
    assert_eq!(client.name(), String::from_str(&env, "Astro Shiba"));
    assert_eq!(client.symbol(), String::from_str(&env, "ASTRO"));
}

// ========== Complex Scenario Tests ==========

#[test]
fn test_multiple_transfers() {
    let (env, _admin, user, client) = create_initialized_token();
    let user2 = Address::generate(&env);
    let user3 = Address::generate(&env);

    // User -> User2
    client.transfer(&user, &user2, &1000_0000000i128);

    // User -> User3
    client.transfer(&user, &user3, &2000_0000000i128);

    // User2 -> User3
    client.transfer(&user2, &user3, &500_0000000i128);

    assert_eq!(client.balance(&user), 100_000_0000000i128 - 3000_0000000i128);
    assert_eq!(client.balance(&user2), 500_0000000i128);
    assert_eq!(client.balance(&user3), 2500_0000000i128);
}

#[test]
fn test_mint_burn_supply_tracking() {
    let (env, admin, user, client) = create_initialized_token();
    let initial_supply = 100_000_0000000i128;

    // Mint some tokens
    client.mint(&admin, &user, &50_000_0000000i128);
    assert_eq!(client.total_supply(), initial_supply + 50_000_0000000i128);

    // Burn some tokens
    client.burn(&user, &30_000_0000000i128);
    assert_eq!(client.total_supply(), initial_supply + 50_000_0000000i128 - 30_000_0000000i128);
}

#[test]
fn test_deflationary_burn_cycle() {
    let (_env, _admin, user, client) = create_initialized_token();
    let initial_supply = 100_000_0000000i128;

    // Simulate multiple burn cycles (like buyback & burn)
    for _ in 0..5 {
        client.buyback_burn(&user, &1000_0000000i128);
    }

    assert_eq!(client.total_supply(), initial_supply - 5000_0000000i128);
    assert_eq!(client.balance(&user), initial_supply - 5000_0000000i128);
}
