//! Implementation of the AstroGate Atomic Launchpad Contract (v2).
//!
//! Guarantees 100% atomic fair launches on Soroban + on-chain discovery registry
//! + Burn-to-Chat community engagement with unified 90-day TTL preservation.

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, token, xdr::ToXdr, Address,
    Bytes, BytesN, ContractExecutable, Env, String, Vec,
};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum LaunchpadError {
    /// Instance configuration missing from contract storage.
    NotInitialized = 1,
    /// Invalid supply, LP seed amount, or burn shout amount.
    InvalidAmount = 2,
    /// The token/XLM pair already existed with non-zero reserves: liquidity will
    /// not be added on top of an external pair.
    PairAlreadySeeded = 3,
    /// Token metadata, shout message, or off-chain JSON metadata violates bounds.
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
}

/// Minimalist fair-launch parameters: supply (1B), decimals (7), and 99.5% LP
/// allocation are enforced on-chain, reducing user input to identity + seed XLM.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct FairLaunchParams {
    pub creator: Address,
    pub name: String,
    pub symbol: String,
    pub xlm_lp_amount: i128,
    pub meta: String,
    pub salt: BytesN<32>,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct LaunchRecord {
    pub index: u32,
    pub creator: Address,
    pub token: Address,
    pub pair: Address,
    pub name: String,
    pub symbol: String,
    pub decimals: u32,
    pub initial_supply: i128,
    pub token_lp_amount: i128,
    pub xlm_lp_amount: i128,
    pub lp_minted: i128,
    pub meta: String,
    pub ledger: u32,
    pub timestamp: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ShoutRecord {
    pub sender: Address,
    pub amount: i128,
    pub message: String,
    pub ledger: u32,
    pub timestamp: u64,
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

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ShoutEvent {
    #[topic]
    pub token: Address,
    pub sender: Address,
    pub amount: i128,
    pub message: String,
    pub ledger: u32,
}

#[contracttype]
#[derive(Clone)]
enum DataKey {
    Factory,
    XlmSac,
    TokenWasmHash,
    BurnAddress,
    LaunchCount,
    LaunchByIndex(u32),
    TokenIndex(Address),
    TokenShouts(Address),
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

/// 1 day ≈ 17,280 ledgers (~5s per ledger on Stellar).
const DAY_IN_LEDGERS: u32 = 17_280;
/// Unified 90-day TTL across instance and persistent registry entries.
const TTL_BUMP_AMOUNT: u32 = 90 * DAY_IN_LEDGERS;
const TTL_THRESHOLD: u32 = TTL_BUMP_AMOUNT - (7 * DAY_IN_LEDGERS);

/// Minimum initial supply (1,000 stroops) to prevent Soroswap MINIMUM_LIQUIDITY (1000) underflow.
const MIN_INITIAL_SUPPLY: i128 = 1_000;
/// Minimum 1 XLM (10^7 stroops) initial liquidity to prevent Soroswap MINIMUM_LIQUIDITY (1000) trap.
const MIN_XLM_LP_STROOPS: i128 = 10_000_000;
/// Maximum initial supply (1 trillion tokens with 7 decimals = 10^19 stroops) to prevent AMM overflow.
const MAX_INITIAL_SUPPLY: i128 = 10_000_000_000_000_000_000;
/// Minimum fair launch pool allocation: 99.5% (9,950 bps).
const MIN_LP_ALLOCATION_BPS: i128 = 9_950;
/// Basis points denominator (100% = 10,000 bps).
const BPS_DENOMINATOR: i128 = 10_000;

/// Fixed fair-launch defaults used by `launch_fair`: 1B supply, 7 decimals, 99.5% LP.
const FAIR_DECIMALS: u32 = 7;
const FAIR_INITIAL_SUPPLY: i128 = 10_000_000_000_000_000;
const FAIR_TOKEN_LP_AMOUNT: i128 = 9_950_000_000_000_000;

const MAX_OFFCHAIN_META_BYTES: u32 = 512;
const MAX_SHOUT_BYTES: u32 = 160;
const MAX_SHOUTS_PER_TOKEN: u32 = 15;
/// Bounded pagination size to stay safely within Soroban default read footprint (~40 entries).
const MAX_LAUNCH_PAGE_SIZE: u32 = 20;

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
        e.storage().instance().set(&DataKey::LaunchCount, &0u32);
        Self::extend_ttl(e);
    }

    /// Minimalist fair launch: enforces fixed 1B supply (7 decimals) and 99.5%
    /// burned LP while storing optional compact metadata on-chain for discovery.
    pub fn launch_fair(e: &Env, params: FairLaunchParams) -> Result<LaunchResult, LaunchpadError> {
        params.creator.require_auth();

        if params.name.is_empty()
            || params.name.len() > 32
            || params.symbol.is_empty()
            || params.symbol.len() > 32
            || params.meta.len() > MAX_OFFCHAIN_META_BYTES
        {
            return Err(LaunchpadError::InvalidMetadata);
        }

        if params.xlm_lp_amount < MIN_XLM_LP_STROOPS {
            return Err(LaunchpadError::InvalidAmount);
        }

        Self::execute_launch(
            e,
            params.creator,
            params.name,
            params.symbol,
            FAIR_DECIMALS,
            FAIR_INITIAL_SUPPLY,
            FAIR_TOKEN_LP_AMOUNT,
            params.xlm_lp_amount,
            params.meta,
            params.salt,
        )
    }

    /// Legacy-compatible single-transaction atomic fair launch with explicit supply/decimals.
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

        Self::execute_launch(
            e,
            params.creator,
            params.name,
            params.symbol,
            params.decimals,
            params.initial_supply,
            params.token_lp_amount,
            params.xlm_lp_amount,
            String::from_str(e, ""),
            params.salt,
        )
    }

    /// Real on-chain Burn-to-Chat: permanently burns holder tokens via SEP-41
    /// and records the message in bounded persistent storage + emits `ShoutEvent`.
    pub fn burn_shout(
        e: &Env,
        sender: Address,
        token: Address,
        amount: i128,
        message: String,
    ) -> Result<(), LaunchpadError> {
        sender.require_auth();

        if amount <= 0 {
            return Err(LaunchpadError::InvalidAmount);
        }
        if message.is_empty() || message.len() > MAX_SHOUT_BYTES {
            return Err(LaunchpadError::InvalidMetadata);
        }

        token::Client::new(e, &token).burn(&sender, &amount);

        let key = DataKey::TokenShouts(token.clone());
        let existing: Vec<ShoutRecord> = e.storage().persistent().get(&key).unwrap_or(Vec::new(e));
        let mut updated = Vec::new(e);
        let len = existing.len();
        let start = if len >= MAX_SHOUTS_PER_TOKEN {
            len + 1 - MAX_SHOUTS_PER_TOKEN
        } else {
            0
        };
        for i in start..len {
            if let Some(item) = existing.get(i) {
                updated.push_back(item);
            }
        }

        let ledger = e.ledger().sequence();
        updated.push_back(ShoutRecord {
            sender: sender.clone(),
            amount,
            message: message.clone(),
            ledger,
            timestamp: e.ledger().timestamp(),
        });

        e.storage().persistent().set(&key, &updated);
        Self::bump_persistent(e, &key);
        Self::extend_launch_ttl(e, token.clone());

        ShoutEvent {
            token,
            sender,
            amount,
            message,
            ledger,
        }
        .publish(e);

        Ok(())
    }

    /// Returns newest-first launches from the persistent on-chain registry.
    pub fn get_launches(e: &Env, offset: u32, limit: u32) -> Vec<LaunchRecord> {
        let total = Self::get_launch_count(e);
        if offset >= total || limit == 0 {
            return Vec::new(e);
        }

        let count = limit.min(MAX_LAUNCH_PAGE_SIZE).min(total - offset);
        let mut out = Vec::new(e);
        for i in 0..count {
            let idx = total - 1 - offset - i;
            let key = DataKey::LaunchByIndex(idx);
            if let Some(record) = e.storage().persistent().get::<DataKey, LaunchRecord>(&key) {
                Self::bump_persistent(e, &key);
                out.push_back(record);
            }
        }
        out
    }

    /// Looks up a launch record by token contract address.
    pub fn get_launch(e: &Env, token: Address) -> Option<LaunchRecord> {
        let idx_key = DataKey::TokenIndex(token);
        let idx: u32 = e.storage().persistent().get(&idx_key)?;
        Self::bump_persistent(e, &idx_key);

        let rec_key = DataKey::LaunchByIndex(idx);
        let record: LaunchRecord = e.storage().persistent().get(&rec_key)?;
        Self::bump_persistent(e, &rec_key);
        Some(record)
    }

    /// Returns total number of tokens launched and indexed through this launchpad.
    pub fn get_launch_count(e: &Env) -> u32 {
        e.storage()
            .instance()
            .get(&DataKey::LaunchCount)
            .unwrap_or(0)
    }

    /// Returns recent on-chain Burn-to-Chat shouts for a token (oldest to newest, max 15).
    pub fn get_shouts(e: &Env, token: Address) -> Vec<ShoutRecord> {
        let key = DataKey::TokenShouts(token);
        if let Some(shouts) = e.storage().persistent().get(&key) {
            Self::bump_persistent(e, &key);
            shouts
        } else {
            Vec::new(e)
        }
    }

    /// Permissionlessly refreshes the launchpad instance TTL for 90 days.
    pub fn extend_ttl(e: &Env) {
        e.storage()
            .instance()
            .extend_ttl(TTL_THRESHOLD, TTL_BUMP_AMOUNT);
    }

    /// Permissionlessly refreshes TTL for a specific token's registry & shouts entries.
    pub fn extend_launch_ttl(e: &Env, token: Address) {
        Self::extend_ttl(e);

        let idx_key = DataKey::TokenIndex(token.clone());
        if let Some(idx) = e.storage().persistent().get::<DataKey, u32>(&idx_key) {
            Self::bump_persistent(e, &idx_key);
            let rec_key = DataKey::LaunchByIndex(idx);
            if e.storage().persistent().has(&rec_key) {
                Self::bump_persistent(e, &rec_key);
            }
        }

        let shout_key = DataKey::TokenShouts(token);
        if e.storage().persistent().has(&shout_key) {
            Self::bump_persistent(e, &shout_key);
        }
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

impl Launchpad {
    #[allow(clippy::too_many_arguments)]
    fn execute_launch(
        e: &Env,
        creator: Address,
        name: String,
        symbol: String,
        decimals: u32,
        initial_supply: i128,
        token_lp_amount: i128,
        xlm_lp_amount: i128,
        meta: String,
        salt: BytesN<32>,
    ) -> Result<LaunchResult, LaunchpadError> {
        Self::extend_ttl(e);

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
        token::Client::new(e, &xlm_sac).transfer(&creator, &this, &xlm_lp_amount);

        // 2. Deterministically bind salt to creator to prevent front-running
        let mut salt_payload = Bytes::new(e);
        salt_payload.append(&creator.clone().to_xdr(e));
        salt_payload.append(&salt.into());
        let derived_salt = e.crypto().sha256(&salt_payload);

        let ctor_args = (
            name.clone(),
            symbol.clone(),
            decimals,
            this.clone(),
            initial_supply,
        );
        let token_addr = e
            .deployer()
            .with_current_contract(derived_salt)
            .deploy_contract(ContractExecutable::Wasm(wasm_hash), ctor_args);

        let token_client = token::Client::new(e, &token_addr);

        // 3. Send creator share if initial_supply > token_lp_amount
        let creator_tokens = initial_supply - token_lp_amount;
        if creator_tokens > 0 {
            token_client.transfer(&this, &creator, &creator_tokens);
        }

        // 4. Invariante de fair launch: renuncia SIEMPRE (mint bloqueado).
        OwnableClient::new(e, &token_addr).renounce_ownership();

        // 5. Create or retrieve EMPTY Soroswap Pair
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
        token_client.transfer(&this, &pair_addr, &token_lp_amount);
        token::Client::new(e, &xlm_sac).transfer(&this, &pair_addr, &xlm_lp_amount);

        // 7. Invariante de fair launch: 100% de los LP NUNCA salen de la burn address
        let pair_client = SoroswapPairClient::new(e, &pair_addr);
        let lp_minted = pair_client.deposit(&burn_address);

        // 8. Index token in persistent on-chain registry
        let index: u32 = Self::get_launch_count(e);
        let record = LaunchRecord {
            index,
            creator: creator.clone(),
            token: token_addr.clone(),
            pair: pair_addr.clone(),
            name,
            symbol,
            decimals,
            initial_supply,
            token_lp_amount,
            xlm_lp_amount,
            lp_minted,
            meta,
            ledger: e.ledger().sequence(),
            timestamp: e.ledger().timestamp(),
        };

        e.storage()
            .instance()
            .set(&DataKey::LaunchCount, &(index + 1));
        let idx_rec_key = DataKey::LaunchByIndex(index);
        let tok_idx_key = DataKey::TokenIndex(token_addr.clone());
        e.storage().persistent().set(&idx_rec_key, &record);
        Self::bump_persistent(e, &idx_rec_key);
        e.storage().persistent().set(&tok_idx_key, &index);
        Self::bump_persistent(e, &tok_idx_key);

        // 9. Publish typed event for real-time indexers
        TokenLaunchedEvent {
            creator,
            token: token_addr.clone(),
            pair: pair_addr.clone(),
            initial_supply,
            token_lp_amount,
            xlm_lp_amount,
            lp_minted,
        }
        .publish(e);

        Ok(LaunchResult {
            token: token_addr,
            pair: pair_addr,
            lp_minted,
        })
    }

    fn bump_persistent(e: &Env, key: &DataKey) {
        e.storage()
            .persistent()
            .extend_ttl(key, TTL_THRESHOLD, TTL_BUMP_AMOUNT);
    }
}
