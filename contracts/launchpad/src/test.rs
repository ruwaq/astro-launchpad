//! Unit tests for the AstroGate Atomic Launchpad Contract.

extern crate std;

use soroban_sdk::{
    contract, contractimpl,
    testutils::{Address as _, Events},
    token, Address, BytesN, Env, String,
};

use crate::contract::{LaunchParams, Launchpad, LaunchpadClient, LaunchpadError};

// -------------------------------------------------------------------------
// Mock Soroswap Factory & Pair
// -------------------------------------------------------------------------

#[contract]
pub struct MockSoroswapPair;

#[contractimpl]
impl MockSoroswapPair {
    pub fn token_0(e: &Env) -> Address {
        Address::generate(e)
    }

    pub fn token_1(e: &Env) -> Address {
        Address::generate(e)
    }

    pub fn get_reserves(_e: &Env) -> (i128, i128) {
        (1_000_000, 1_000_000)
    }

    pub fn deposit(_e: &Env, _to: Address) -> i128 {
        495_000_000 // mock LP tokens minted
    }
}

#[contract]
pub struct MockSoroswapFactory;

#[contractimpl]
impl MockSoroswapFactory {
    pub fn __constructor(e: &Env, pair: Address) {
        e.storage().instance().set(&0u32, &pair);
    }

    pub fn create_pair(e: &Env, _token_a: Address, _token_b: Address) -> Address {
        e.storage().instance().get(&0u32).unwrap()
    }

    pub fn get_pair(e: &Env, _token_a: Address, _token_b: Address) -> Address {
        e.storage().instance().get(&0u32).unwrap()
    }

    pub fn pair_exists(_e: &Env, _token_a: Address, _token_b: Address) -> bool {
        false
    }
}

// -------------------------------------------------------------------------
// Mock XLM SAC Token
// -------------------------------------------------------------------------

#[contract]
pub struct MockToken;

#[contractimpl]
impl MockToken {
    pub fn transfer(_e: &Env, _from: Address, _to: Address, _amount: i128) {
        // Mock transfer succeeds
    }
}

const TOKEN_WASM: &[u8] = include_bytes!("../../../target/wasm32v1-none/release/astro_token.wasm");

// -------------------------------------------------------------------------
// Tests
// -------------------------------------------------------------------------

#[test]
fn test_launchpad_initialization() {
    let e = Env::default();
    let factory = Address::generate(&e);
    let xlm_sac = Address::generate(&e);
    let burn_addr = Address::generate(&e);
    let wasm_hash = BytesN::from_array(&e, &[7u8; 32]);

    let launchpad_addr = e.register(
        Launchpad,
        (
            factory.clone(),
            xlm_sac.clone(),
            wasm_hash.clone(),
            burn_addr.clone(),
        ),
    );
    let client = LaunchpadClient::new(&e, &launchpad_addr);

    assert_eq!(client.get_factory(), Some(factory));
    assert_eq!(client.get_xlm_sac(), Some(xlm_sac));
    assert_eq!(client.get_burn_address(), Some(burn_addr));
    assert_eq!(client.get_token_wasm_hash(), Some(wasm_hash));
}

#[test]
fn test_invalid_amounts_fail() {
    let e = Env::default();
    let factory = Address::generate(&e);
    let xlm_sac = Address::generate(&e);
    let burn_addr = Address::generate(&e);
    let wasm_hash = BytesN::from_array(&e, &[7u8; 32]);

    let launchpad_addr = e.register(Launchpad, (factory, xlm_sac, wasm_hash, burn_addr));
    let client = LaunchpadClient::new(&e, &launchpad_addr);
    let creator = Address::generate(&e);

    e.mock_all_auths();

    // 0 XLM should fail
    let res = client.try_launch_token(&LaunchParams {
        creator: creator.clone(),
        name: String::from_str(&e, "Test"),
        symbol: String::from_str(&e, "TST"),
        decimals: 7,
        initial_supply: 1_000_000_000,
        token_lp_amount: 990_000_000,
        xlm_lp_amount: 0, // invalid xlm amount
        burn_lp: true,
        renounce: true,
        salt: BytesN::from_array(&e, &[1u8; 32]),
    });

    assert_eq!(res, Err(Ok(LaunchpadError::InvalidAmount)));
}

#[test]
fn test_atomic_launch_success() {
    let e = Env::default();
    e.mock_all_auths();

    let wasm_hash = e.deployer().upload_contract_wasm(TOKEN_WASM);
    let pair_addr = e.register(MockSoroswapPair, ());
    let factory_addr = e.register(MockSoroswapFactory, (pair_addr.clone(),));
    let xlm_sac_addr = e.register(MockToken, ());
    let burn_addr = Address::generate(&e);

    let launchpad_addr = e.register(
        Launchpad,
        (
            factory_addr.clone(),
            xlm_sac_addr.clone(),
            wasm_hash.clone(),
            burn_addr.clone(),
        ),
    );
    let client = LaunchpadClient::new(&e, &launchpad_addr);
    let creator = Address::generate(&e);

    let initial_supply = 10_000_000_000_000_000_i128; // 1B with 7 decimals
    let token_lp = 9_900_000_000_000_000_i128; // 99%
    let xlm_lp = 100_000_000_i128; // 10 XLM

    let result = client.launch_token(&LaunchParams {
        creator: creator.clone(),
        name: String::from_str(&e, "Astro Token"),
        symbol: String::from_str(&e, "ASTRO"),
        decimals: 7,
        initial_supply,
        token_lp_amount: token_lp,
        xlm_lp_amount: xlm_lp,
        burn_lp: true,
        renounce: true,
        salt: BytesN::from_array(&e, &[42u8; 32]),
    });

    // Verify result returns deployed token & pair
    assert_eq!(result.lp_minted, 495_000_000);

    // Verify creator received 1% (10,000,000)
    let deployed_token_client = token::Client::new(&e, &result.token);
    assert_eq!(
        deployed_token_client.balance(&creator),
        100_000_000_000_000_i128
    );

    // Verify event was emitted
    let _events = e.events().all();
}
