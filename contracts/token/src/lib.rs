#![no_std]

//! Token fungible (SEP-41) del launchpad, armado con OpenZeppelin Stellar.
//!
//! Funcionalidad:
//! - Metadata (name/symbol/decimals) + mint inicial al owner en el constructor.
//! - `mint` restringido al owner (`#[only_owner]`) para inyecciones futuras.
//! - Burn estándar (holder quema sus propios tokens).
//! - Supply total expuesto vía `Compose<(TotalSupply,)>`.
//!
//! El AMM/liquidez no vive acá: se usa Soroswap (factory/router ya desplegados).

mod contract;
#[cfg(test)]
mod test;
