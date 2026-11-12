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

/// Pre-built token contract WASM for integration testing.
/// PREREQUISITE: If running tests in a clean repository, run:
///   `cd contracts/token && stellar contract build`
/// before executing `cargo test -p astro-launchpad-contract`.
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
    let res_zero_xlm = client.try_launch_token(&LaunchParams {
        creator: creator.clone(),
        name: String::from_str(&e, "Test"),
        symbol: String::from_str(&e, "TST"),
        decimals: 7,
        initial_supply: 1_000_000_000,
        token_lp_amount: 995_000_000,
        xlm_lp_amount: 0, // invalid xlm amount
        salt: BytesN::from_array(&e, &[1u8; 32]),
    });
    assert_eq!(res_zero_xlm, Err(Ok(LaunchpadError::InvalidAmount)));

    // Just below MIN_XLM_LP_STROOPS (10^7 - 1 = 9_999_999 stroops = 0.9999999 XLM) should fail
    let res_sub_min_xlm = client.try_launch_token(&LaunchParams {
        creator: creator.clone(),
        name: String::from_str(&e, "Test"),
        symbol: String::from_str(&e, "TST"),
        decimals: 7,
        initial_supply: 1_000_000_000,
        token_lp_amount: 995_000_000,
        xlm_lp_amount: 9_999_999, // < MIN_XLM_LP_STROOPS
        salt: BytesN::from_array(&e, &[1u8; 32]),
    });
    assert_eq!(res_sub_min_xlm, Err(Ok(LaunchpadError::InvalidAmount)));

    // Less than 99.5% token LP allocation should fail
    let res_low_lp = client.try_launch_token(&LaunchParams {
        creator: creator.clone(),
        name: String::from_str(&e, "Test"),
        symbol: String::from_str(&e, "TST"),
        decimals: 7,
        initial_supply: 1_000_000_000,
        token_lp_amount: 990_000_000, // only 99.0%, fails fair launch 99.5% invariant
        xlm_lp_amount: 10_000_000,
        salt: BytesN::from_array(&e, &[2u8; 32]),
    });
    assert_eq!(res_low_lp, Err(Ok(LaunchpadError::InvalidAmount)));

    // Exceeding MAX_INITIAL_SUPPLY (10^19 + 1) should fail
    let res_max_supply = client.try_launch_token(&LaunchParams {
        creator: creator.clone(),
        name: String::from_str(&e, "Test"),
        symbol: String::from_str(&e, "TST"),
        decimals: 7,
        initial_supply: 10_000_000_000_000_000_001_i128,
        token_lp_amount: 9_950_000_000_000_000_000_i128,
        xlm_lp_amount: 10_000_000,
        salt: BytesN::from_array(&e, &[3u8; 32]),
    });
    assert_eq!(res_max_supply, Err(Ok(LaunchpadError::InvalidAmount)));

    // initial_supply <= 1_000 should fail
    let res_min_supply = client.try_launch_token(&LaunchParams {
        creator: creator.clone(),
        name: String::from_str(&e, "Test"),
        symbol: String::from_str(&e, "TST"),
        decimals: 7,
        initial_supply: 1_000,
        token_lp_amount: 995,
        xlm_lp_amount: 10_000_000,
        salt: BytesN::from_array(&e, &[4u8; 32]),
    });
    assert_eq!(res_min_supply, Err(Ok(LaunchpadError::InvalidAmount)));

    // token_lp_amount > initial_supply should fail
    let res_excess_lp = client.try_launch_token(&LaunchParams {
        creator: creator.clone(),
        name: String::from_str(&e, "Test"),
        symbol: String::from_str(&e, "TST"),
        decimals: 7,
        initial_supply: 1_000_000_000,
        token_lp_amount: 1_000_000_001,
        xlm_lp_amount: 10_000_000,
        salt: BytesN::from_array(&e, &[5u8; 32]),
    });
    assert_eq!(res_excess_lp, Err(Ok(LaunchpadError::InvalidAmount)));

    // token_lp_amount <= 0 should fail
    let res_zero_lp = client.try_launch_token(&LaunchParams {
        creator: creator.clone(),
        name: String::from_str(&e, "Test"),
        symbol: String::from_str(&e, "TST"),
        decimals: 7,
        initial_supply: 1_000_000_000,
        token_lp_amount: 0,
        xlm_lp_amount: 10_000_000,
        salt: BytesN::from_array(&e, &[6u8; 32]),
    });
    assert_eq!(res_zero_lp, Err(Ok(LaunchpadError::InvalidAmount)));

    // decimals > 18 should fail with InvalidMetadata
    let res_invalid_dec = client.try_launch_token(&LaunchParams {
        creator: creator.clone(),
        name: String::from_str(&e, "Test"),
        symbol: String::from_str(&e, "TST"),
        decimals: 19,
        initial_supply: 1_000_000_000,
        token_lp_amount: 995_000_000,
        xlm_lp_amount: 10_000_000,
        salt: BytesN::from_array(&e, &[7u8; 32]),
    });
    assert_eq!(res_invalid_dec, Err(Ok(LaunchpadError::InvalidMetadata)));

    // Empty name should fail with InvalidMetadata
    let res_empty_name = client.try_launch_token(&LaunchParams {
        creator: creator.clone(),
        name: String::from_str(&e, ""),
        symbol: String::from_str(&e, "TST"),
        decimals: 7,
        initial_supply: 1_000_000_000,
        token_lp_amount: 995_000_000,
        xlm_lp_amount: 10_000_000,
        salt: BytesN::from_array(&e, &[8u8; 32]),
    });
    assert_eq!(res_empty_name, Err(Ok(LaunchpadError::InvalidMetadata)));

    // Empty symbol should fail with InvalidMetadata
    let res_empty_symbol = client.try_launch_token(&LaunchParams {
        creator: creator.clone(),
        name: String::from_str(&e, "Test"),
        symbol: String::from_str(&e, ""),
        decimals: 7,
        initial_supply: 1_000_000_000,
        token_lp_amount: 995_000_000,
        xlm_lp_amount: 10_000_000,
        salt: BytesN::from_array(&e, &[9u8; 32]),
    });
    assert_eq!(res_empty_symbol, Err(Ok(LaunchpadError::InvalidMetadata)));

    // Name > 32 bytes should fail with InvalidMetadata
    let res_long_name = client.try_launch_token(&LaunchParams {
        creator: creator.clone(),
        name: String::from_str(&e, "123456789012345678901234567890123"),
        symbol: String::from_str(&e, "TST"),
        decimals: 7,
        initial_supply: 1_000_000_000,
        token_lp_amount: 995_000_000,
        xlm_lp_amount: 10_000_000,
        salt: BytesN::from_array(&e, &[10u8; 32]),
    });
    assert_eq!(res_long_name, Err(Ok(LaunchpadError::InvalidMetadata)));

    // Symbol > 32 bytes should fail with InvalidMetadata
    let res_long_symbol = client.try_launch_token(&LaunchParams {
        creator,
        name: String::from_str(&e, "Test"),
        symbol: String::from_str(&e, "123456789012345678901234567890123"),
        decimals: 7,
        initial_supply: 1_000_000_000,
        token_lp_amount: 995_000_000,
        xlm_lp_amount: 10_000_000,
        salt: BytesN::from_array(&e, &[11u8; 32]),
    });
    assert_eq!(res_long_symbol, Err(Ok(LaunchpadError::InvalidMetadata)));
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

    // Verify event was emitted by launch_token (must be queried immediately after the call)
    let events = e.events().all();
    assert!(!events.events().is_empty());

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
}

#[test]
fn test_pre_seeded_pair_asymmetric_reserves() {
    let e = Env::default();
    e.mock_all_auths();

    let wasm_hash = e.deployer().upload_contract_wasm(TOKEN_WASM);
    let xlm_sac_addr = e.register(MockToken, ());
    let burn_addr = Address::generate(&e);
    let creator = Address::generate(&e);

    // Case 1: reserve_a > 0, reserve_b == 0
    let pair_addr_1 = e.register(MockSoroswapPair, ((1_000_000_i128, 0_i128),));
    let factory_addr_1 = e.register(MockSoroswapFactory, (pair_addr_1, true));
    let launchpad_1 = e.register(
        Launchpad,
        (
            factory_addr_1,
            xlm_sac_addr.clone(),
            wasm_hash.clone(),
            burn_addr.clone(),
        ),
    );
    let client_1 = LaunchpadClient::new(&e, &launchpad_1);

    let res_1 = client_1.try_launch_token(&LaunchParams {
        creator: creator.clone(),
        name: String::from_str(&e, "Astro Token"),
        symbol: String::from_str(&e, "ASTRO"),
        decimals: 7,
        initial_supply: 10_000_000_000_000_000_i128,
        token_lp_amount: 9_950_000_000_000_000_i128,
        xlm_lp_amount: 100_000_000_i128,
        salt: BytesN::from_array(&e, &[12u8; 32]),
    });
    assert_eq!(res_1, Err(Ok(LaunchpadError::PairAlreadySeeded)));

    // Case 2: reserve_a == 0, reserve_b > 0
    let pair_addr_2 = e.register(MockSoroswapPair, ((0_i128, 5_000_000_i128),));
    let factory_addr_2 = e.register(MockSoroswapFactory, (pair_addr_2, true));
    let launchpad_2 = e.register(
        Launchpad,
        (factory_addr_2, xlm_sac_addr, wasm_hash, burn_addr),
    );
    let client_2 = LaunchpadClient::new(&e, &launchpad_2);

    let res_2 = client_2.try_launch_token(&LaunchParams {
        creator,
        name: String::from_str(&e, "Astro Token"),
        symbol: String::from_str(&e, "ASTRO"),
        decimals: 7,
        initial_supply: 10_000_000_000_000_000_i128,
        token_lp_amount: 9_950_000_000_000_000_i128,
        xlm_lp_amount: 100_000_000_i128,
        salt: BytesN::from_array(&e, &[13u8; 32]),
    });
    assert_eq!(res_2, Err(Ok(LaunchpadError::PairAlreadySeeded)));
}

#[test]
fn test_empty_existing_pair_reused_successfully() {
    let e = Env::default();
    e.mock_all_auths();

    let wasm_hash = e.deployer().upload_contract_wasm(TOKEN_WASM);
    // Existing pair registered in factory with (0, 0) reserves
    let pair_addr = e.register(MockSoroswapPair, ((0_i128, 0_i128),));
    let factory_addr = e.register(MockSoroswapFactory, (pair_addr.clone(), true)); // pair_exists = true
    let xlm_sac_addr = e.register(MockToken, ());
    let burn_addr = Address::generate(&e);

    let launchpad_addr = e.register(
        Launchpad,
        (factory_addr, xlm_sac_addr, wasm_hash, burn_addr.clone()),
    );
    let client = LaunchpadClient::new(&e, &launchpad_addr);
    let creator = Address::generate(&e);

    let res = client.launch_token(&LaunchParams {
        creator: creator.clone(),
        name: String::from_str(&e, "Astro Token"),
        symbol: String::from_str(&e, "ASTRO"),
        decimals: 7,
        initial_supply: 1_000_000_000_000_000_i128,
        token_lp_amount: 995_000_000_000_000_i128,
        xlm_lp_amount: 50_000_000_i128,
        salt: BytesN::from_array(&e, &[14u8; 32]),
    });

    assert_eq!(res.pair, pair_addr);
    assert_eq!(
        MockSoroswapPairClient::new(&e, &res.pair).lp_recipient(),
        burn_addr
    );
}

#[test]
fn test_full_100_percent_lp_launch() {
    let e = Env::default();
    e.mock_all_auths();

    let wasm_hash = e.deployer().upload_contract_wasm(TOKEN_WASM);
    let pair_addr = e.register(MockSoroswapPair, ((0_i128, 0_i128),));
    let factory_addr = e.register(MockSoroswapFactory, (pair_addr.clone(), false));
    let xlm_sac_addr = e.register(MockToken, ());
    let burn_addr = Address::generate(&e);

    let launchpad_addr = e.register(
        Launchpad,
        (factory_addr, xlm_sac_addr, wasm_hash, burn_addr),
    );
    let client = LaunchpadClient::new(&e, &launchpad_addr);
    let creator = Address::generate(&e);

    let supply = 1_000_000_000_000_000_i128;
    // 100% supply to LP, 0 creator share
    let result = client.launch_token(&LaunchParams {
        creator: creator.clone(),
        name: String::from_str(&e, "Full LP"),
        symbol: String::from_str(&e, "FLP"),
        decimals: 7,
        initial_supply: supply,
        token_lp_amount: supply,
        xlm_lp_amount: 10_000_000_i128,
        salt: BytesN::from_array(&e, &[15u8; 32]),
    });

    let deployed_token_client = token::Client::new(&e, &result.token);
    // Creator gets 0 tokens
    assert_eq!(deployed_token_client.balance(&creator), 0);
    // Pair receives 100% of tokens
    assert_eq!(deployed_token_client.balance(&result.pair), supply);
}
