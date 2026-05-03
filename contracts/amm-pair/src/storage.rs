use soroban_sdk::{contracttype, Address, Env};

/// Storage keys
#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    /// Pair configuration and state
    PairInfo,
    /// LP token balance for an address
    Balance(Address),
    /// Configurable fee in basis points (default: 30 = 0.3%)
    FeeBps,
    /// Configurable minimum liquidity (default: 1000)
    MinimumLiquidity,
}

/// Pair information and state
#[contracttype]
#[derive(Clone, Debug)]
pub struct PairInfo {
    /// First token (always sorted A < B)
    pub token_0: Address,
    /// Second token
    pub token_1: Address,
    /// Factory that created this pair
    pub factory: Address,
    /// Address to receive protocol fees
    pub fee_to: Address,
    /// Reserve of token 0
    pub reserve_0: i128,
    /// Reserve of token 1
    pub reserve_1: i128,
    /// Total LP token supply
    pub total_supply: i128,
    /// Last K value (for protocol fee calculation)
    pub k_last: i128,
}

// Pair info functions
pub fn set_pair_info(env: &Env, info: &PairInfo) {
    env.storage().instance().set(&DataKey::PairInfo, info);
}

pub fn get_pair_info(env: &Env) -> PairInfo {
    env.storage()
        .instance()
        .get(&DataKey::PairInfo)
        .expect("pair not initialized")
}

pub fn has_pair_info(env: &Env) -> bool {
    env.storage().instance().has(&DataKey::PairInfo)
}

// Balance functions (LP tokens)
pub fn get_balance(env: &Env, address: &Address) -> i128 {
    let key = DataKey::Balance(address.clone());
    env.storage().persistent().get(&key).unwrap_or(0)
}

pub fn set_balance(env: &Env, address: &Address, balance: i128) {
    let key = DataKey::Balance(address.clone());
    env.storage().persistent().set(&key, &balance);
}

pub fn increase_balance(env: &Env, address: &Address, amount: i128) {
    let balance = get_balance(env, address);
    set_balance(env, address, balance + amount);
}

pub fn decrease_balance(env: &Env, address: &Address, amount: i128) -> Result<(), crate::errors::Error> {
    let balance = get_balance(env, address);
    if balance < amount {
        return Err(crate::errors::Error::InsufficientLPBalance);
    }
    set_balance(env, address, balance - amount);
    Ok(())
}

// ========== Configurable Parameters ==========

/// Default fee: 30 basis points (0.3%)
const DEFAULT_FEE_BPS: u32 = 30;

/// Default minimum liquidity: 1000
const DEFAULT_MINIMUM_LIQUIDITY: i128 = 1000;

/// Get fee in basis points (configurable by factory)
pub fn get_fee_bps(env: &Env) -> u32 {
    env.storage().instance().get(&DataKey::FeeBps).unwrap_or(DEFAULT_FEE_BPS)
}

/// Set fee in basis points (admin only via factory)
pub fn set_fee_bps(env: &Env, fee_bps: u32) {
    env.storage().instance().set(&DataKey::FeeBps, &fee_bps);
}

/// Get minimum liquidity (configurable by factory)
pub fn get_minimum_liquidity(env: &Env) -> i128 {
    env.storage().instance().get(&DataKey::MinimumLiquidity).unwrap_or(DEFAULT_MINIMUM_LIQUIDITY)
}

/// Set minimum liquidity (admin only via factory)
pub fn set_minimum_liquidity(env: &Env, min_liquidity: i128) {
    env.storage().instance().set(&DataKey::MinimumLiquidity, &min_liquidity);
}
