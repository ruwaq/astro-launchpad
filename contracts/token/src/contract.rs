//! Contrato del token fungible del launchpad (SEP-41, OpenZeppelin Stellar).
//!
//! Garantías de fair launch:
//! - Supply fijo: el cap se fija en el constructor al `initial_supply`, y el
//!   OZ `Capped` rechaza cualquier mint que lo supere (incluso ANTES de
//!   renunciar ownership).
//! - Metadata saneada: decimals 0..18, name/symbol no vacíos y ≤ 32 bytes.

use soroban_sdk::{contract, contractimpl, Address, Env, MuxedAddress, String};
use stellar_access::ownable::{self as ownable, Ownable};
use stellar_macros::only_owner;
use stellar_tokens::fungible::{
    burnable::FungibleBurnable,
    capped::{Capped, FungibleCapped},
    total_supply::{FungibleTotalSupply, TotalSupply},
    Base, Compose, FungibleToken,
};

// MuxedAddress se importa aunque no se use directamente: la expansión de
// `#[contractimpl(contracttrait)]` lo requiere en scope (los defaults de los
// traits de OZ lo referencian). Sin él el macro no compila.

/// Límite razonable de decimales (native Stellar usa 7; EPS-41 no impone tope).
const MAX_DECIMALS: u32 = 18;

/// Límite de tamaño de name/symbol: evita inflar metadata en storage.
const MAX_STRING_BYTES: u32 = 32;

#[contract]
pub struct Token;

#[contractimpl]
impl Token {
    /// Crea el token: fija metadata, acuña `initial_supply` al owner y fija el
    /// cap del supply a `initial_supply` (supply finito desde el deploy).
    pub fn __constructor(
        e: &Env,
        name: String,
        symbol: String,
        decimals: u32,
        owner: Address,
        initial_supply: i128,
    ) {
        if decimals > MAX_DECIMALS {
            panic!("decimals exceeds the maximum allowed");
        }
        if name.is_empty() || name.len() > MAX_STRING_BYTES {
            panic!("name must be 1..32 bytes");
        }
        if symbol.is_empty() || symbol.len() > MAX_STRING_BYTES {
            panic!("symbol must be 1..32 bytes");
        }
        if initial_supply <= 0 {
            panic!("initial supply must be positive");
        }

        Base::set_metadata(e, decimals, name, symbol);
        // El cap fija el techo TOTAL del supply; el mint del constructor lo
        // respeta y ya no queda margen para inflación posterior.
        Capped::set_cap(e, initial_supply);
        // Ruta por el ContractType para que el supply quede trackeado y el
        // cap se aplique (Compose<(Capped, TotalSupply)> → mint con cap).
        <Self as FungibleToken>::ContractType::mint(e, &owner, initial_supply);
        ownable::set_owner(e, &owner);
    }

    /// Mint solo para el owner (inyección de supply del launchpad).
    ///
    /// El cap impone un techo absoluto: con supply == cap, esta vía está
    /// cerrada incluso estando el owner activo (más fácil que confiar solo
    /// en la renuncia de ownership).
    #[only_owner]
    pub fn mint(e: &Env, to: Address, amount: i128) {
        <Self as FungibleToken>::ContractType::mint(e, &to, amount);
    }
}

/// SEP-41 completo, generado por el macro (`ContractType = Capped`).
#[contractimpl(contracttrait)]
impl FungibleToken for Token {
    type ContractType = Compose<(Capped, TotalSupply)>;
}

/// Burn/transfer-from estándar para el holder.
#[contractimpl(contracttrait)]
impl FungibleBurnable for Token {}

/// Supply total legible on-chain (para prerender UI y Soroswap).
#[contractimpl(contracttrait)]
impl FungibleTotalSupply for Token {}

/// Cap del supply legible on-chain (prueba de supply fijo).
#[contractimpl(contracttrait)]
impl FungibleCapped for Token {}

/// Proxy de ownable (transfer de ownership incluido).
#[contractimpl(contracttrait)]
impl Ownable for Token {}
