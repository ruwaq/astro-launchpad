//! Contrato del token fungible del launchpad (SEP-41, OpenZeppelin Stellar).

use soroban_sdk::{contract, contractimpl, Address, Env, MuxedAddress, String};
use stellar_access::ownable::{self as ownable, Ownable};
use stellar_macros::only_owner;
use stellar_tokens::fungible::{
    burnable::FungibleBurnable,
    total_supply::{FungibleTotalSupply, TotalSupply},
    Base, Compose, FungibleToken,
};

#[contract]
pub struct Token;

#[contractimpl]
impl Token {
    /// Crea el token: fija metadata y acuña `initial_supply` al owner.
    ///
    /// Ej.: con un constructor de (name, symbol, decimals, owner, supply).
    pub fn __constructor(
        e: &Env,
        name: String,
        symbol: String,
        decimals: u32,
        owner: Address,
        initial_supply: i128,
    ) {
        Base::set_metadata(e, decimals, name, symbol);
        // Ruta por el ContractType para que el supply quede trackeado.
        <Self as FungibleToken>::ContractType::mint(e, &owner, initial_supply);
        ownable::set_owner(e, &owner);
    }

    /// Mint solo para el owner (inyección de supply del launchpad).
    #[only_owner]
    pub fn mint(e: &Env, to: Address, amount: i128) {
        <Self as FungibleToken>::ContractType::mint(e, &to, amount);
    }
}

/// SEP-41 completo, generado por el macro (`ContractType = Base`).
#[contractimpl(contracttrait)]
impl FungibleToken for Token {
    type ContractType = Compose<(TotalSupply,)>;
}

/// Burn/transfer-from estándar para el holder.
#[contractimpl(contracttrait)]
impl FungibleBurnable for Token {}

/// Supply total legible on-chain (para prerender UI y Soroswap).
#[contractimpl(contracttrait)]
impl FungibleTotalSupply for Token {}

/// Proxy de ownable (transfer de ownership incluido).
#[contractimpl(contracttrait)]
impl Ownable for Token {}
