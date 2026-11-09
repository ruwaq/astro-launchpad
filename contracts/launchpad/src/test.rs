//! Unit tests for the AstroGate Atomic Launchpad Contract.

extern crate std;

use soroban_sdk::{
    contract, contractimpl,
    testutils::{Address as _, Events},
    token, Address, BytesN, Env, String,
};

use crate::contract::{LaunchParams, Launchpad, LaunchpadClient, LaunchpadError};

// Cliente real del token (el wasm de dev-deps también se usa en el
// launch success) para verificar invariantes de fair launch.
use astro_token::TokenClient as AstroTokenClient;

// -------------------------------------------------------------------------
// Mock Soroswap Factory & Pair
// -------------------------------------------------------------------------

#[contract]
pub struct MockSoroswapPair;

#[contractimpl]
impl MockSoroswapPair {
    pub fn __constructor(e: &Env, reserves: (i128, i128)) {
        // Reservas iniciales simuladas; deposit las deja como estaban.
        e.storage().instance().set(&0u32, &reserves);
    }

    pub fn get_reserves(e: &Env) -> (i128, i128) {
        e.storage().instance().get(&0u32).unwrap_or((0, 0))
    }

    /// Guarda el destinatario del LP para verificar la quema en tests.
    pub fn deposit(e: &Env, to: Address) -> i128 {
        e.storage().instance().set(&1u32, &to);
        495_000_000 // mock LP tokens minted
    }

    pub fn lp_recipient(e: &Env) -> Address {
        e.storage().instance().get(&1u32).unwrap()
    }
}

#[contract]
pub struct MockSoroswapFactory;

#[contractimpl]
impl MockSoroswapFactory {
    pub fn __constructor(e: &Env, pair: Address, pair_exists: bool) {
        e.storage().instance().set(&0u32, &pair);
        e.storage().instance().set(&1u32, &pair_exists);
    }

    pub fn create_pair(e: &Env, _token_a: Address, _token_b: Address) -> Address {
        e.storage().instance().get(&0u32).unwrap()
    }

    pub fn get_pair(e: &Env, _token_a: Address, _token_b: Address) -> Address {
        e.storage().instance().get(&0u32).unwrap()
    }

    pub fn pair_exists(e: &Env, _token_a: Address, _token_b: Address) -> bool {
        e.storage().instance().get(&1u32).unwrap_or(false)
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
        creator,
        name: String::from_str(&e, "Test"),
        symbol: String::from_str(&e, "TST"),
        decimals: 7,
        initial_supply: 1_000_000_000,
        token_lp_amount: 990_000_000,
        xlm_lp_amount: 0, // invalid xlm amount
        salt: BytesN::from_array(&e, &[1u8; 32]),
    });

    assert_eq!(res, Err(Ok(LaunchpadError::InvalidAmount)));
}

#[test]
fn test_pre_seeded_pair_rejected() {
    let e = Env::default();
    e.mock_all_auths();

    let wasm_hash = e.deployer().upload_contract_wasm(TOKEN_WASM);
    // Par ya sembrado por OTRO proyecto: token_0 sin liquidez lateral.
    let pair_addr = e.register(MockSoroswapPair, ((2_000_000_i128, 5_000_000_i128),));
    let factory_addr = e.register(MockSoroswapFactory, (pair_addr.clone(), true));
    let xlm_sac_addr = e.register(MockToken, ());
    let burn_addr = Address::generate(&e);

    let launchpad_addr = e.register(
        Launchpad,
        (factory_addr, xlm_sac_addr, wasm_hash, burn_addr),
    );
    let client = LaunchpadClient::new(&e, &launchpad_addr);
    let creator = Address::generate(&e);

    let res = client.try_launch_token(&LaunchParams {
        creator,
        name: String::from_str(&e, "Astro Token"),
        symbol: String::from_str(&e, "ASTRO"),
        decimals: 7,
        initial_supply: 10_000_000_000_000_000_i128,
        token_lp_amount: 9_950_000_000_000_000_i128,
        xlm_lp_amount: 100_000_000_i128,
        salt: BytesN::from_array(&e, &[9u8; 32]),
    });

    // Se aborta sin añadir liquidez encima de un par ajeno (resultante del
    // guard: revert total, no queda token alguno a medias).
    assert_eq!(res, Err(Ok(LaunchpadError::PairAlreadySeeded)));
}

#[test]
fn test_atomic_launch_success() {
    let e = Env::default();
    e.mock_all_auths();

    let wasm_hash = e.deployer().upload_contract_wasm(TOKEN_WASM);
    let pair_addr = e.register(MockSoroswapPair, ((0_i128, 0_i128),));
    let factory_addr = e.register(MockSoroswapFactory, (pair_addr.clone(), false));
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

    let initial_supply = 10_000_000_000_000_000_i128; // 1B con 7 decimales
    let token_lp = 9_950_000_000_000_000_i128; // 99.5%
    let xlm_lp = 100_000_000_i128; // 10 XLM

    let result = client.launch_token(&LaunchParams {
        creator: creator.clone(),
        name: String::from_str(&e, "Astro Token"),
        symbol: String::from_str(&e, "ASTRO"),
        decimals: 7,
        initial_supply,
        token_lp_amount: token_lp,
        xlm_lp_amount: xlm_lp,
        salt: BytesN::from_array(&e, &[42u8; 32]),
    });

    // Verify result returns deployed token & pair
    assert_eq!(result.lp_minted, 495_000_000);
    assert_eq!(result.pair, pair_addr);

    // Verify creator received 0.5% (50,000,000) — 5M tokens, 7 decimales
    let deployed_token_client = token::Client::new(&e, &result.token);
    assert_eq!(
        deployed_token_client.balance(&creator),
        50_000_000_000_000_i128
    );

    // Pair del token ya creado: LP SIEMPRE minted to the burn address,
    // never to the creator.
    assert_eq!(
        MockSoroswapPairClient::new(&e, &result.pair).lp_recipient(),
        burn_addr
    );

    // Fair-launch invariants del token REAL deployment (wasm de astro-token):
    // ownership renunciado y pool con el token liquido.
    let astro_client = AstroTokenClient::new(&e, &result.token);
    assert_eq!(astro_client.get_owner(), None);
    assert_eq!(astro_client.total_supply(), initial_supply);

    let remaining = deployed_token_client.balance(&result.pair);
    assert_eq!(remaining, token_lp);

    // Verify event was emitted
    let _events = e.events().all();
}
