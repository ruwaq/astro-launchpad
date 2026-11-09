#![no_std]

//! AstroGate Atomic Launchpad Contract.
//!
//! Provides a single-transaction, 100% Anti-Rug fair-launch pipeline on Stellar Soroban:
//! 1. Pulls initial XLM liquidity from creator.
//! 2. Deterministically deploys the SEP-41 token with initial supply.
//! 3. Sends the remaining share (up to 0.5%) to creator.
//! 4. Renounces token ownership on-chain (permanently disabling future minting).
//! 5. Creates / resolves the Soroswap AMM Pair with Native XLM SAC.
//! 6. Directly seeds 99.5% token supply and XLM into the Soroswap Pair.
//! 7. Mints 100% of the LP tokens directly to Stellar's dead address (`GAAAA...WHF`),
//!    making the liquidity mathematically locked forever.
//! 8. Publishes a typed `launch` event for indexers and bots.

mod contract;
#[cfg(test)]
mod test;
