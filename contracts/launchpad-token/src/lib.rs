//! Launchpad Token Contract
//!
//! A pure Soroban token (no SAC/classic asset) designed for the Astro Launchpad.
//! This token can be freely minted/burned by the admin (the factory contract).
//!
//! Key advantages over SAC:
//! - No trustlines required
//! - Factory can mint to any address
//! - Factory can burn from any address (with auth)
//! - Full control over token lifecycle
//!
//! Implements the standard Soroban Token Interface (SEP-41 compatible)

#![no_std]

mod admin;
mod allowance;
mod balance;
mod contract;
mod errors;
mod metadata;
mod storage_types;

pub use errors::Error;

#[cfg(test)]
mod test;

pub use crate::contract::TokenClient;
