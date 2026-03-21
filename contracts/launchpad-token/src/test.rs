#![cfg(test)]

use crate::contract::{Token, TokenClient};
use soroban_sdk::{testutils::Address as _, Address, Env, String};

fn create_token<'a>(e: &Env, admin: &Address) -> TokenClient<'a> {
    let contract_id = e.register(Token, ());
    let client = TokenClient::new(e, &contract_id);
    client.initialize(
        admin,
        &7,
        &String::from_str(e, "Test Token"),
        &String::from_str(e, "TEST"),
    );
    client
}

#[test]
fn test_initialize() {
    let e = Env::default();
    let admin = Address::generate(&e);
    let token = create_token(&e, &admin);

    assert_eq!(token.decimals(), 7);
    assert_eq!(token.name(), String::from_str(&e, "Test Token"));
    assert_eq!(token.symbol(), String::from_str(&e, "TEST"));
    assert_eq!(token.admin(), admin);
}

#[test]
fn test_mint() {
    let e = Env::default();
    e.mock_all_auths();

    let admin = Address::generate(&e);
    let user = Address::generate(&e);
    let token = create_token(&e, &admin);

    assert_eq!(token.balance(&user), 0);

    token.mint(&user, &1000);
    assert_eq!(token.balance(&user), 1000);

    token.mint(&user, &500);
    assert_eq!(token.balance(&user), 1500);
}

#[test]
fn test_admin_burn() {
    let e = Env::default();
    e.mock_all_auths();

    let admin = Address::generate(&e);
    let user = Address::generate(&e);
    let token = create_token(&e, &admin);

    token.mint(&user, &1000);
    assert_eq!(token.balance(&user), 1000);

    // Admin can burn tokens from user
    token.admin_burn(&user, &300);
    assert_eq!(token.balance(&user), 700);
}

#[test]
fn test_transfer() {
    let e = Env::default();
    e.mock_all_auths();

    let admin = Address::generate(&e);
    let user1 = Address::generate(&e);
    let user2 = Address::generate(&e);
    let token = create_token(&e, &admin);

    token.mint(&user1, &1000);

    token.transfer(&user1, &user2, &400);

    assert_eq!(token.balance(&user1), 600);
    assert_eq!(token.balance(&user2), 400);
}

#[test]
fn test_burn() {
    let e = Env::default();
    e.mock_all_auths();

    let admin = Address::generate(&e);
    let user = Address::generate(&e);
    let token = create_token(&e, &admin);

    token.mint(&user, &1000);
    token.burn(&user, &300);

    assert_eq!(token.balance(&user), 700);
}

#[test]
fn test_allowance_and_transfer_from() {
    let e = Env::default();
    e.mock_all_auths();

    let admin = Address::generate(&e);
    let user1 = Address::generate(&e);
    let user2 = Address::generate(&e);
    let spender = Address::generate(&e);
    let token = create_token(&e, &admin);

    token.mint(&user1, &1000);

    // Approve spender
    token.approve(&user1, &spender, &500, &1000);
    assert_eq!(token.allowance(&user1, &spender), 500);

    // Transfer from user1 to user2 via spender
    token.transfer_from(&spender, &user1, &user2, &200);

    assert_eq!(token.balance(&user1), 800);
    assert_eq!(token.balance(&user2), 200);
    assert_eq!(token.allowance(&user1, &spender), 300);
}

#[test]
fn test_set_admin() {
    let e = Env::default();
    e.mock_all_auths();

    let admin = Address::generate(&e);
    let new_admin = Address::generate(&e);
    let token = create_token(&e, &admin);

    assert_eq!(token.admin(), admin);

    token.set_admin(&new_admin);

    assert_eq!(token.admin(), new_admin);
}

#[test]
#[should_panic(expected = "already initialized")]
fn test_double_initialize() {
    let e = Env::default();
    let admin = Address::generate(&e);
    let token = create_token(&e, &admin);

    // Try to initialize again - should panic
    token.initialize(
        &admin,
        &7,
        &String::from_str(&e, "Another Token"),
        &String::from_str(&e, "ANOTHER"),
    );
}

#[test]
#[should_panic(expected = "InsufficientBalance")]
fn test_burn_insufficient() {
    let e = Env::default();
    e.mock_all_auths();

    let admin = Address::generate(&e);
    let user = Address::generate(&e);
    let token = create_token(&e, &admin);

    token.mint(&user, &100);
    token.burn(&user, &200); // Should panic
}
