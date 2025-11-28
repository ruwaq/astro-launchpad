//! Launchpad Token Client
//!
//! Client module for interacting with deployed Launchpad Token contracts.
//! These are pure Soroban tokens (not SAC) that the factory can freely mint/burn.

use soroban_sdk::{Address, Env, IntoVal, Symbol};

/// Initialize a newly deployed launchpad token
pub fn initialize_token(
    env: &Env,
    token_address: &Address,
    admin: &Address,
    decimal: u32,
    name: &soroban_sdk::String,
    symbol: &soroban_sdk::String,
) {
    let args = (admin, decimal, name, symbol);
    env.invoke_contract::<()>(
        token_address,
        &Symbol::new(env, "initialize"),
        args.into_val(env),
    );
}

/// Mint tokens to an address (admin only)
pub fn mint(env: &Env, token_address: &Address, to: &Address, amount: i128) {
    let args = (to, amount);
    env.invoke_contract::<()>(
        token_address,
        &Symbol::new(env, "mint"),
        args.into_val(env),
    );
}

/// Admin burn - burn tokens from any address (admin only)
pub fn admin_burn(env: &Env, token_address: &Address, from: &Address, amount: i128) {
    let args = (from, amount);
    env.invoke_contract::<()>(
        token_address,
        &Symbol::new(env, "admin_burn"),
        args.into_val(env),
    );
}

/// Get token balance
pub fn balance(env: &Env, token_address: &Address, id: &Address) -> i128 {
    let args = (id,);
    env.invoke_contract::<i128>(
        token_address,
        &Symbol::new(env, "balance"),
        args.into_val(env),
    )
}

/// Transfer tokens (requires auth from `from`)
pub fn transfer(env: &Env, token_address: &Address, from: &Address, to: &Address, amount: i128) {
    let args = (from, to, amount);
    env.invoke_contract::<()>(
        token_address,
        &Symbol::new(env, "transfer"),
        args.into_val(env),
    );
}

/// Get token admin
pub fn admin(env: &Env, token_address: &Address) -> Address {
    env.invoke_contract::<Address>(
        token_address,
        &Symbol::new(env, "admin"),
        ().into_val(env),
    )
}

/// Set new admin (current admin only)
pub fn set_admin(env: &Env, token_address: &Address, new_admin: &Address) {
    let args = (new_admin,);
    env.invoke_contract::<()>(
        token_address,
        &Symbol::new(env, "set_admin"),
        args.into_val(env),
    );
}
