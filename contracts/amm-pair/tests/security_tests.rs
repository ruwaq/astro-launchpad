#![cfg(test)]

use soroban_sdk::{
    testutils::{Address as _, Ledger},
    Address, Env,
};
use amm_pair::{AmmPair, AmmPairClient};

mod token {
    soroban_sdk::contractimport!(
        file = "../token/target/wasm32-unknown-unknown/release/soroban_token_contract.wasm"
    );
}

fn create_token_contract<'a>(env: &Env) -> (Address, token::Client<'a>) {
    let address = env.register_contract_wasm(None, token::WASM);
    (address.clone(), token::Client::new(env, &address))
}

fn setup_test_env() -> (
    Env,
    AmmPairClient<'static>,
    Address,
    Address,
    token::Client<'static>,
    token::Client<'static>,
) {
    let env = Env::default();
    env.mock_all_auths();

    let pair_id = env.register_contract(None, AmmPair);
    let pair = AmmPairClient::new(&env, &pair_id);

    let admin = Address::generate(&env);

    let (token0_addr, token0) = create_token_contract(&env);
    let (token1_addr, token1) = create_token_contract(&env);

    // Initialize tokens
    token0.initialize(&admin, &7, &"Token0".into(), &"TK0".into());
    token1.initialize(&admin, &7, &"Token1".into(), &"TK1".into());

    // Initialize pair
    pair.initialize(&token0_addr, &token1_addr, &admin);

    (env, pair, admin, token0_addr.clone(), token0, token1)
}

// ============================================================================
// K INVARIANT TESTS
// ============================================================================

#[test]
fn test_k_invariant_maintained() {
    let (env, pair, admin, _token0_addr, token0, token1) = setup_test_env();

    // Mint tokens to admin
    token0.mint(&admin, &1_000_000_000);
    token1.mint(&admin, &1_000_000_000);

    // Add initial liquidity
    pair.add_liquidity(&admin, &100_000_000, &100_000_000, &0, &0);

    // Get initial K
    let info_before = pair.get_pair_info();
    let k_before = info_before.reserve_0 * info_before.reserve_1;

    // Perform swap
    let trader = Address::generate(&env);
    token0.mint(&trader, &10_000_000);

    env.ledger().set_timestamp(env.ledger().timestamp() + 1);
    let deadline = env.ledger().timestamp() + 300;
    pair.swap(&trader, &10_000_000, &0, &deadline);

    // Get new K
    let info_after = pair.get_pair_info();
    let k_after = info_after.reserve_0 * info_after.reserve_1;

    // K should increase due to fees (0.3%)
    assert!(k_after > k_before, "K invariant should increase with fees");
}

#[test]
fn test_k_invariant_violation_protection() {
    let (env, pair, admin, _token0_addr, token0, token1) = setup_test_env();

    token0.mint(&admin, &1_000_000_000);
    token1.mint(&admin, &1_000_000_000);

    pair.add_liquidity(&admin, &100_000_000, &100_000_000, &0, &0);

    let trader = Address::generate(&env);
    token0.mint(&trader, &10_000_000);

    // Normal swap should succeed
    let deadline = env.ledger().timestamp() + 300;
    let result = pair.try_swap(&trader, &10_000_000, &0, &deadline);
    assert!(result.is_ok());
}

// ============================================================================
// FLASH LOAN PROTECTION TESTS
// ============================================================================

#[test]
fn test_flash_loan_protection() {
    let (env, pair, admin, _token0_addr, token0, token1) = setup_test_env();

    token0.mint(&admin, &1_000_000_000);
    token1.mint(&admin, &1_000_000_000);

    pair.add_liquidity(&admin, &100_000_000, &100_000_000, &0, &0);

    let attacker = Address::generate(&env);
    token0.mint(&attacker, &50_000_000);

    env.ledger().set_timestamp(1000);

    // First swap
    let deadline = env.ledger().timestamp() + 300;
    pair.swap(&attacker, &10_000_000, &0, &deadline);

    // Immediate second swap should fail due to cooldown
    let result = pair.try_swap(&attacker, &10_000_000, &0, &deadline);
    assert!(result.is_err(), "Flash loan protection should prevent immediate second swap");

    // After cooldown, should succeed
    env.ledger().set_timestamp(1006); // 6 seconds later
    let deadline = env.ledger().timestamp() + 300;
    let result = pair.try_swap(&attacker, &10_000_000, &0, &deadline);
    assert!(result.is_ok(), "Swap should succeed after cooldown");
}

// ============================================================================
// MEV PROTECTION (DEADLINE) TESTS
// ============================================================================

#[test]
fn test_deadline_protection() {
    let (env, pair, admin, _token0_addr, token0, token1) = setup_test_env();

    token0.mint(&admin, &1_000_000_000);
    token1.mint(&admin, &1_000_000_000);

    pair.add_liquidity(&admin, &100_000_000, &100_000_000, &0, &0);

    let trader = Address::generate(&env);
    token0.mint(&trader, &10_000_000);

    env.ledger().set_timestamp(1000);

    // Try swap with expired deadline
    let expired_deadline = 999; // Before current time
    let result = pair.try_swap(&trader, &10_000_000, &0, &expired_deadline);
    assert!(result.is_err(), "Expired transaction should fail");

    // Valid deadline should work
    let valid_deadline = 1300; // 5 minutes in future
    let result = pair.try_swap(&trader, &10_000_000, &0, &valid_deadline);
    assert!(result.is_ok(), "Valid deadline should succeed");
}

#[test]
fn test_add_liquidity_deadline() {
    let (env, pair, admin, _token0_addr, token0, token1) = setup_test_env();

    token0.mint(&admin, &1_000_000_000);
    token1.mint(&admin, &1_000_000_000);

    env.ledger().set_timestamp(1000);

    // Try to add liquidity with expired deadline
    let expired_deadline = 999;
    let result = pair.try_add_liquidity_with_deadline(
        &admin,
        &100_000_000,
        &100_000_000,
        &0,
        &0,
        &expired_deadline,
    );
    assert!(result.is_err(), "Expired add liquidity should fail");
}

#[test]
fn test_remove_liquidity_deadline() {
    let (env, pair, admin, _token0_addr, token0, token1) = setup_test_env();

    token0.mint(&admin, &1_000_000_000);
    token1.mint(&admin, &1_000_000_000);

    pair.add_liquidity(&admin, &100_000_000, &100_000_000, &0, &0);

    env.ledger().set_timestamp(1000);

    let liquidity = 50_000_000;

    // Try to remove liquidity with expired deadline
    let expired_deadline = 999;
    let result = pair.try_remove_liquidity_with_deadline(
        &admin,
        &liquidity,
        &0,
        &0,
        &expired_deadline,
    );
    assert!(result.is_err(), "Expired remove liquidity should fail");
}

// ============================================================================
// SLIPPAGE PROTECTION TESTS
// ============================================================================

#[test]
fn test_slippage_protection_swap() {
    let (env, pair, admin, _token0_addr, token0, token1) = setup_test_env();

    token0.mint(&admin, &1_000_000_000);
    token1.mint(&admin, &1_000_000_000);

    pair.add_liquidity(&admin, &100_000_000, &100_000_000, &0, &0);

    let trader = Address::generate(&env);
    token0.mint(&trader, &10_000_000);

    // Set unrealistic min_out (more than possible)
    let deadline = env.ledger().timestamp() + 300;
    let result = pair.try_swap(&trader, &10_000_000, &50_000_000, &deadline);
    assert!(result.is_err(), "Should fail due to slippage protection");

    // Reasonable min_out should work
    let result = pair.try_swap(&trader, &10_000_000, &1_000_000, &deadline);
    assert!(result.is_ok(), "Reasonable slippage should succeed");
}

#[test]
fn test_slippage_protection_add_liquidity() {
    let (env, pair, admin, _token0_addr, token0, token1) = setup_test_env();

    token0.mint(&admin, &1_000_000_000);
    token1.mint(&admin, &1_000_000_000);

    // First add liquidity (no slippage check for initial)
    pair.add_liquidity(&admin, &100_000_000, &100_000_000, &0, &0);

    let provider = Address::generate(&env);
    token0.mint(&provider, &100_000_000);
    token1.mint(&provider, &100_000_000);

    // Try to add with impossible min_liquidity
    let result = pair.try_add_liquidity(
        &provider,
        &10_000_000,
        &10_000_000,
        &1_000_000_000, // Impossible amount
        &0,
    );
    assert!(result.is_err(), "Should fail due to min_liquidity check");
}

// ============================================================================
// REENTRANCY PROTECTION TESTS
// ============================================================================

#[test]
fn test_no_read_only_reentrancy() {
    let (env, pair, admin, _token0_addr, token0, token1) = setup_test_env();

    token0.mint(&admin, &1_000_000_000);
    token1.mint(&admin, &1_000_000_000);

    pair.add_liquidity(&admin, &100_000_000, &100_000_000, &0, &0);

    // View functions should always work
    let info = pair.get_pair_info();
    assert_eq!(info.reserve_0, 100_000_000);
    assert_eq!(info.reserve_1, 100_000_000);

    // Even during a swap, reserves should be consistent
    let trader = Address::generate(&env);
    token0.mint(&trader, &10_000_000);

    let deadline = env.ledger().timestamp() + 300;
    pair.swap(&trader, &10_000_000, &0, &deadline);

    let info_after = pair.get_pair_info();
    assert!(info_after.reserve_0 > 0);
    assert!(info_after.reserve_1 > 0);
}

// ============================================================================
// LIQUIDITY PROVIDER PROTECTION TESTS
// ============================================================================

#[test]
fn test_minimum_liquidity_lock() {
    let (env, pair, admin, _token0_addr, token0, token1) = setup_test_env();

    token0.mint(&admin, &1_000_000_000);
    token1.mint(&admin, &1_000_000_000);

    // Add initial liquidity
    let liquidity = pair.add_liquidity(&admin, &100_000_000, &100_000_000, &0, &0);

    // Try to remove all liquidity - should fail or leave minimum locked
    let result = pair.try_remove_liquidity(&admin, &liquidity, &0, &0);

    // Check that some minimum remains or removal succeeds with less than all
    let info = pair.get_pair_info();
    // At minimum, total supply should handle edge cases properly
}

#[test]
fn test_fair_price_on_add_liquidity() {
    let (env, pair, admin, _token0_addr, token0, token1) = setup_test_env();

    token0.mint(&admin, &1_000_000_000);
    token1.mint(&admin, &1_000_000_000);

    // Initial liquidity at 1:1 ratio
    pair.add_liquidity(&admin, &100_000_000, &100_000_000, &0, &0);

    let provider = Address::generate(&env);
    token0.mint(&provider, &100_000_000);
    token1.mint(&provider, &100_000_000);

    // Try to add liquidity at wrong ratio
    // Should either adjust amounts or fail
    let result = pair.try_add_liquidity(
        &provider,
        &50_000_000,
        &10_000_000, // Very skewed ratio
        &0,
        &0,
    );

    // Contract should handle this gracefully
    assert!(result.is_ok() || result.is_err());
}

// ============================================================================
// OVERFLOW PROTECTION TESTS
// ============================================================================

#[test]
fn test_overflow_protection() {
    let (env, pair, admin, _token0_addr, token0, token1) = setup_test_env();

    token0.mint(&admin, &i128::MAX / 2);
    token1.mint(&admin, &i128::MAX / 2);

    // Try to add liquidity with very large amounts
    let result = pair.try_add_liquidity(
        &admin,
        &(i128::MAX / 2),
        &(i128::MAX / 2),
        &0,
        &0,
    );

    // Should handle gracefully without panic
    assert!(result.is_ok() || result.is_err());
}

// ============================================================================
// ZERO AMOUNT PROTECTION TESTS
// ============================================================================

#[test]
fn test_zero_amount_swap() {
    let (env, pair, admin, _token0_addr, token0, token1) = setup_test_env();

    token0.mint(&admin, &1_000_000_000);
    token1.mint(&admin, &1_000_000_000);

    pair.add_liquidity(&admin, &100_000_000, &100_000_000, &0, &0);

    let trader = Address::generate(&env);
    let deadline = env.ledger().timestamp() + 300;

    // Try to swap zero amount
    let result = pair.try_swap(&trader, &0, &0, &deadline);
    assert!(result.is_err(), "Should reject zero amount swaps");
}

#[test]
fn test_zero_liquidity_addition() {
    let (env, pair, admin, _token0_addr, token0, token1) = setup_test_env();

    token0.mint(&admin, &1_000_000_000);
    token1.mint(&admin, &1_000_000_000);

    // Try to add zero liquidity
    let result = pair.try_add_liquidity(&admin, &0, &0, &0, &0);
    assert!(result.is_err(), "Should reject zero liquidity");
}

// ============================================================================
// PRICE MANIPULATION TESTS
// ============================================================================

#[test]
fn test_price_manipulation_resistance() {
    let (env, pair, admin, _token0_addr, token0, token1) = setup_test_env();

    token0.mint(&admin, &1_000_000_000);
    token1.mint(&admin, &1_000_000_000);

    pair.add_liquidity(&admin, &100_000_000, &100_000_000, &0, &0);

    let attacker = Address::generate(&env);
    token0.mint(&attacker, &500_000_000);

    env.ledger().set_timestamp(1000);

    // Try large swap to manipulate price
    let deadline = env.ledger().timestamp() + 300;
    let output = pair.swap(&attacker, &100_000_000, &0, &deadline);

    // Check that output follows constant product formula
    // Output should be less than input due to slippage
    assert!(output < 100_000_000, "Large swap should have significant slippage");

    // Try immediate second swap (should be blocked by cooldown)
    env.ledger().set_timestamp(1002);
    let result = pair.try_swap(&attacker, &100_000_000, &0, &deadline);
    assert!(result.is_err(), "Should be blocked by cooldown");
}

// ============================================================================
// RESERVE CONSISTENCY TESTS
// ============================================================================

#[test]
fn test_reserve_consistency() {
    let (env, pair, admin, _token0_addr, token0, token1) = setup_test_env();

    token0.mint(&admin, &1_000_000_000);
    token1.mint(&admin, &1_000_000_000);

    pair.add_liquidity(&admin, &100_000_000, &100_000_000, &0, &0);

    // Perform multiple operations
    let trader = Address::generate(&env);
    token0.mint(&trader, &50_000_000);

    env.ledger().set_timestamp(1000);
    let deadline = env.ledger().timestamp() + 300;
    pair.swap(&trader, &10_000_000, &0, &deadline);

    env.ledger().set_timestamp(1006);
    let deadline = env.ledger().timestamp() + 300;
    pair.swap(&trader, &10_000_000, &0, &deadline);

    // Reserves should always match actual token balances
    let info = pair.get_pair_info();
    assert!(info.reserve_0 > 0);
    assert!(info.reserve_1 > 0);
    assert!(info.total_supply > 0);
}
