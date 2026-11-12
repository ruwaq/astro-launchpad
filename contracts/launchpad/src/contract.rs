//! Implementation of the AstroGate Atomic Launchpad Contract.

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, token, xdr::ToXdr, Address,
    Bytes, BytesN, ContractExecutable, Env, String,
};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum LaunchpadError {
    /// Instance configuration missing from contract storage.
    /// Note: Unreachable on valid deployments as `__constructor` enforces and sets
    /// all keys at deployment time; retained for ABI stability and defensive handling.
    NotInitialized = 1,
    InvalidAmount = 2,
    /// The token/XLM pair already existed with non-zero reserves: liquidity will
    /// not be added on top of an external pair (minted LP would back a position
    /// not controlled by this launchpad).
    PairAlreadySeeded = 3,
    /// Token metadata validation failure: decimals > 18, or empty/oversized (>32 bytes) name/symbol.
    InvalidMetadata = 4,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct LaunchResult {
    pub token: Address,
    pub pair: Address,
    pub lp_minted: i128,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct LaunchParams {
    pub creator: Address,
    pub name: String,
    pub symbol: String,
    pub decimals: u32,
    pub initial_supply: i128,
    pub token_lp_amount: i128,
    pub xlm_lp_amount: i128,
    pub salt: BytesN<32>,
    // NOTA: renounce y burn_lp se QUITARON del ABI a propósito. Son
    // invariantes de fair launch, no opciones: el launchpad SIEMPRE quema
    // 100% de los LP en la burn address y SIEMPRE renuncia a ownership
    // (ver pasos 4 y 7). Un parámetro opcional permitiría inventar un
    // "fair launch" con LP retirables o capacidad de mint encubierta.
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TokenLaunchedEvent {
    #[topic]
    pub creator: Address,
    pub token: Address,
    pub pair: Address,
    pub initial_supply: i128,
    pub token_lp_amount: i128,
    pub xlm_lp_amount: i128,
    pub lp_minted: i128,
}

#[contracttype]
#[derive(Clone)]
enum DataKey {
    Factory,
    XlmSac,
    TokenWasmHash,
    BurnAddress,
}

#[allow(dead_code)]
#[soroban_sdk::contractclient(name = "SoroswapFactoryClient")]
pub trait SoroswapFactoryInterface {
    fn create_pair(e: &Env, token_a: Address, token_b: Address) -> Address;
    fn get_pair(e: &Env, token_a: Address, token_b: Address) -> Address;
    fn pair_exists(e: &Env, token_a: Address, token_b: Address) -> bool;
}

#[allow(dead_code)]
#[soroban_sdk::contractclient(name = "SoroswapPairClient")]
pub trait SoroswapPairInterface {
    fn get_reserves(e: &Env) -> (i128, i128);
    fn deposit(e: &Env, to: Address) -> i128;
}

#[allow(dead_code)]
#[soroban_sdk::contractclient(name = "OwnableClient")]
pub trait OwnableInterface {
    fn renounce_ownership(e: &Env);
}

const INSTANCE_LIFETIME_THRESHOLD: u32 = 100_000;
const INSTANCE_BUMP_AMOUNT: u32 = 200_000;
/// Minimum initial supply (1,000 stroops) to prevent Soroswap MINIMUM_LIQUIDITY (1000) underflow
const MIN_INITIAL_SUPPLY: i128 = 1_000;
/// Minimum 1 XLM (10^7 stroops) initial liquidity to prevent Soroswap MINIMUM_LIQUIDITY (1000) trap
const MIN_XLM_LP_STROOPS: i128 = 10_000_000;
/// Maximum initial supply (1 trillion tokens with 7 decimals = 10^19 stroops) to prevent AMM reserve overflow
const MAX_INITIAL_SUPPLY: i128 = 10_000_000_000_000_000_000;
/// Minimum fair launch pool allocation: 99.5% (9,950 bps)
const MIN_LP_ALLOCATION_BPS: i128 = 9_950;
/// Basis points denominator (100% = 10,000 bps)
const BPS_DENOMINATOR: i128 = 10_000;

#[contract]
pub struct Launchpad;

#[contractimpl]
impl Launchpad {
    /// Initializes the launchpad configuration with network contract addresses and token WASM.
    pub fn __constructor(
        e: &Env,
        factory: Address,
        xlm_sac: Address,
        token_wasm_hash: BytesN<32>,
        burn_address: Address,
    ) {
        e.storage().instance().set(&DataKey::Factory, &factory);
        e.storage().instance().set(&DataKey::XlmSac, &xlm_sac);
        e.storage()
            .instance()
            .set(&DataKey::TokenWasmHash, &token_wasm_hash);
        e.storage()
            .instance()
            .set(&DataKey::BurnAddress, &burn_address);
        e.storage()
            .instance()
            .extend_ttl(INSTANCE_LIFETIME_THRESHOLD, INSTANCE_BUMP_AMOUNT);
    }

    /// Single-transaction atomic fair launch:
    /// 1. Pulls XLM from creator.
    /// 2. Deploys token contract and mints initial supply to launchpad.
    /// 3. Sends remaining creator share (`initial_supply - token_lp_amount`).
    /// 4. ALWAYS renounces token ownership (minting locked forever).
    /// 5. Creates pair on Soroswap (or reuses an EMPTY existing pair).
    /// 6. Deposits liquidity directly into pair.
    /// 7. ALWAYS mints 100% of LP tokens to the burn address.
    pub fn launch_token(e: &Env, params: LaunchParams) -> Result<LaunchResult, LaunchpadError> {
        params.creator.require_auth();

        if params.decimals > 18
            || params.name.is_empty()
            || params.name.len() > 32
            || params.symbol.is_empty()
            || params.symbol.len() > 32
        {
            return Err(LaunchpadError::InvalidMetadata);
        }

        if params.initial_supply <= MIN_INITIAL_SUPPLY
            || params.initial_supply > MAX_INITIAL_SUPPLY
            || params.token_lp_amount <= 0
            || params.xlm_lp_amount < MIN_XLM_LP_STROOPS
            || params.token_lp_amount > params.initial_supply
        {
            return Err(LaunchpadError::InvalidAmount);
        }

        // Invariante de fair launch: al menos 99.5% (9,950 bps) del supply al pool
        if params
            .token_lp_amount
            .checked_mul(BPS_DENOMINATOR)
            .unwrap_or(0)
            < params
                .initial_supply
                .checked_mul(MIN_LP_ALLOCATION_BPS)
                .unwrap_or(i128::MAX)
        {
            return Err(LaunchpadError::InvalidAmount);
        }

        e.storage()
            .instance()
            .extend_ttl(INSTANCE_LIFETIME_THRESHOLD, INSTANCE_BUMP_AMOUNT);

        let this = e.current_contract_address();
        let factory = e
            .storage()
            .instance()
            .get::<DataKey, Address>(&DataKey::Factory)
            .ok_or(LaunchpadError::NotInitialized)?;
        let xlm_sac = e
            .storage()
            .instance()
            .get::<DataKey, Address>(&DataKey::XlmSac)
            .ok_or(LaunchpadError::NotInitialized)?;
        let wasm_hash = e
            .storage()
            .instance()
            .get::<DataKey, BytesN<32>>(&DataKey::TokenWasmHash)
            .ok_or(LaunchpadError::NotInitialized)?;
        let burn_address = e
            .storage()
            .instance()
            .get::<DataKey, Address>(&DataKey::BurnAddress)
            .ok_or(LaunchpadError::NotInitialized)?;

        // 1. Pull XLM from creator to launchpad contract
        token::Client::new(e, &xlm_sac).transfer(&params.creator, &this, &params.xlm_lp_amount);

        // 2. Determinísticamente deriva el salt vinculando creator para evitar front-running global
        let mut salt_payload = Bytes::new(e);
        salt_payload.append(&params.creator.clone().to_xdr(e));
        salt_payload.append(&params.salt.clone().into());
        let derived_salt = e.crypto().sha256(&salt_payload);

        let ctor_args = (
            params.name,
            params.symbol,
            params.decimals,
            this.clone(),
            params.initial_supply,
        );
        let token_addr = e
            .deployer()
            .with_current_contract(derived_salt)
            .deploy_contract(ContractExecutable::Wasm(wasm_hash), ctor_args);

        let token_client = token::Client::new(e, &token_addr);

        // 3. Send creator share if initial_supply > token_lp_amount
        let creator_tokens = params.initial_supply - params.token_lp_amount;
        if creator_tokens > 0 {
            token_client.transfer(&this, &params.creator, &creator_tokens);
        }

        // 4. Invariante de fair launch: renuncia SIEMPRE (mint bloqueado).
        OwnableClient::new(e, &token_addr).renounce_ownership();

        // 5. Create or retrieve Soroswap Pair. Un par pre-existente solo se
        // puede reutilizar si está VACÍO: si otro usuario lo hubiera sembrado
        // con una ratio arbitraria, los LP acuñados por `deposit` serían
        // colateral de una posición ajena (y la quema "integrada" sería
        // estafaria). Con reservas > 0 se aborta sin tocar nada; el error
        // revierte la tx completa (XLM incluido).
        let factory_client = SoroswapFactoryClient::new(e, &factory);
        let pair_addr = if factory_client.pair_exists(&token_addr, &xlm_sac) {
            let existing = factory_client.get_pair(&token_addr, &xlm_sac);
            let (reserve_a, reserve_b) = SoroswapPairClient::new(e, &existing).get_reserves();
            if reserve_a > 0 || reserve_b > 0 {
                return Err(LaunchpadError::PairAlreadySeeded);
            }
            existing
        } else {
            factory_client.create_pair(&token_addr, &xlm_sac)
        };

        // 6. Transfer tokens & XLM to Pair
        token_client.transfer(&this, &pair_addr, &params.token_lp_amount);
        token::Client::new(e, &xlm_sac).transfer(&this, &pair_addr, &params.xlm_lp_amount);

        // 7. Invariante de fair launch: 100% de los LP NUNCA salen de la burn
        // address (liquidez no retirable).
        let pair_client = SoroswapPairClient::new(e, &pair_addr);
        let lp_minted = pair_client.deposit(&burn_address);

        // 8. Publish event
        TokenLaunchedEvent {
            creator: params.creator,
            token: token_addr.clone(),
            pair: pair_addr.clone(),
            initial_supply: params.initial_supply,
            token_lp_amount: params.token_lp_amount,
            xlm_lp_amount: params.xlm_lp_amount,
            lp_minted,
        }
        .publish(e);

        Ok(LaunchResult {
            token: token_addr,
            pair: pair_addr,
            lp_minted,
        })
    }

    /// Read configuration methods
    pub fn get_factory(e: &Env) -> Option<Address> {
        e.storage().instance().get(&DataKey::Factory)
    }

    pub fn get_xlm_sac(e: &Env) -> Option<Address> {
        e.storage().instance().get(&DataKey::XlmSac)
    }

    pub fn get_burn_address(e: &Env) -> Option<Address> {
        e.storage().instance().get(&DataKey::BurnAddress)
    }

    pub fn get_token_wasm_hash(e: &Env) -> Option<BytesN<32>> {
        e.storage().instance().get(&DataKey::TokenWasmHash)
    }
}
