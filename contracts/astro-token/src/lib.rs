#![no_std]

//! # ASTRO Token - Protocol Token for Astro Shiba
//!
//! SEP-41 Compliant Fungible Token with:
//! - Full SEP-41 Token Interface
//! - Admin controls (mint, burn, transfer_admin)
//! - Buyback & Burn integration ready
//! - Staking rewards support
//!
//! ## Tokenomics
//! - Symbol: ASTRO
//! - Decimals: 7 (Stellar standard)
//! - Initial Supply: 1,000,000,000 (1 billion)
//! - Max Supply: Capped at 1 billion (deflationary)
//!
//! ## Features
//! - Mint (admin only, capped)
//! - Burn (any holder can burn their tokens)
//! - Buyback integration (factory can burn tokens)
//! - Staking rewards (future integration)

use soroban_sdk::{contract, contractimpl, contracterror, Address, Env, String};

mod admin;
mod allowance;
mod balance;
mod metadata;
mod storage;
mod events;

pub use storage::{DataKey, INSTANCE_BUMP_AMOUNT, INSTANCE_LIFETIME_THRESHOLD};

/// Maximum supply: 1 billion tokens with 7 decimals
const MAX_SUPPLY: i128 = 1_000_000_000_0000000;

/// Token errors
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum TokenError {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    Unauthorized = 3,
    InsufficientBalance = 4,
    InsufficientAllowance = 5,
    InvalidAmount = 6,
    MaxSupplyExceeded = 7,
    AllowanceExpired = 8,
}

/// ASTRO Token Contract
#[contract]
pub struct AstroToken;

#[contractimpl]
impl AstroToken {
    /// Initialize the ASTRO token
    ///
    /// # Arguments
    /// * `admin` - Initial admin address (can mint, transfer admin)
    /// * `initial_mint_to` - Address to receive initial supply
    /// * `initial_supply` - Initial token supply to mint
    ///
    /// # Returns
    /// Ok(()) on success
    pub fn initialize(
        env: Env,
        admin: Address,
        initial_mint_to: Address,
        initial_supply: i128,
    ) -> Result<(), TokenError> {
        if storage::has_admin(&env) {
            return Err(TokenError::AlreadyInitialized);
        }

        if initial_supply < 0 || initial_supply > MAX_SUPPLY {
            return Err(TokenError::InvalidAmount);
        }

        // Set admin
        admin::write_administrator(&env, &admin);

        // Set metadata
        metadata::write_metadata(
            &env,
            7, // Stellar standard decimals
            String::from_str(&env, "Astro Shiba"),
            String::from_str(&env, "ASTRO"),
        );

        // Initialize total supply
        storage::set_total_supply(&env, 0);

        // Mint initial supply
        if initial_supply > 0 {
            balance::receive_balance(&env, &initial_mint_to, initial_supply);
            storage::set_total_supply(&env, initial_supply);
            events::mint(&env, &admin, &initial_mint_to, initial_supply);
        }

        // Extend instance TTL
        storage::extend_instance_ttl(&env);

        Ok(())
    }

    // ========== SEP-41 Token Interface ==========

    /// Get token balance for an address
    pub fn balance(env: Env, id: Address) -> i128 {
        storage::extend_instance_ttl(&env);
        balance::read_balance(&env, &id)
    }

    /// Transfer tokens
    pub fn transfer(env: Env, from: Address, to: Address, amount: i128) {
        from.require_auth();
        storage::extend_instance_ttl(&env);

        if amount < 0 {
            panic!("Error::InvalidAmount");
        }

        balance::spend_balance(&env, &from, amount).unwrap();
        balance::receive_balance(&env, &to, amount);

        events::transfer(&env, &from, &to, amount);
    }

    /// Transfer tokens using allowance
    pub fn transfer_from(env: Env, spender: Address, from: Address, to: Address, amount: i128) {
        spender.require_auth();
        storage::extend_instance_ttl(&env);

        if amount < 0 {
            panic!("Error::InvalidAmount");
        }

        allowance::spend_allowance(&env, &from, &spender, amount).unwrap();
        balance::spend_balance(&env, &from, amount).unwrap();
        balance::receive_balance(&env, &to, amount);

        events::transfer(&env, &from, &to, amount);
    }

    /// Approve spender to spend tokens
    pub fn approve(env: Env, from: Address, spender: Address, amount: i128, expiration_ledger: u32) {
        from.require_auth();
        storage::extend_instance_ttl(&env);

        if amount < 0 {
            panic!("Error::InvalidAmount");
        }

        allowance::write_allowance(&env, &from, &spender, amount, expiration_ledger);

        events::approve(&env, &from, &spender, amount, expiration_ledger);
    }

    /// Get allowance
    pub fn allowance(env: Env, from: Address, spender: Address) -> i128 {
        storage::extend_instance_ttl(&env);
        allowance::read_allowance(&env, &from, &spender).amount
    }

    /// Burn tokens (holder burns their own)
    pub fn burn(env: Env, from: Address, amount: i128) {
        from.require_auth();
        storage::extend_instance_ttl(&env);

        if amount < 0 {
            panic!("Error::InvalidAmount");
        }

        balance::spend_balance(&env, &from, amount).unwrap();

        // Update total supply
        let total = storage::get_total_supply(&env);
        storage::set_total_supply(&env, total - amount);

        events::burn(&env, &from, amount);
    }

    /// Burn tokens using allowance
    pub fn burn_from(env: Env, spender: Address, from: Address, amount: i128) {
        spender.require_auth();
        storage::extend_instance_ttl(&env);

        if amount < 0 {
            panic!("Error::InvalidAmount");
        }

        allowance::spend_allowance(&env, &from, &spender, amount).unwrap();
        balance::spend_balance(&env, &from, amount).unwrap();

        // Update total supply
        let total = storage::get_total_supply(&env);
        storage::set_total_supply(&env, total - amount);

        events::burn(&env, &from, amount);
    }

    /// Get decimals
    pub fn decimals(env: Env) -> u32 {
        metadata::read_decimal(&env)
    }

    /// Get token name
    pub fn name(env: Env) -> String {
        metadata::read_name(&env)
    }

    /// Get token symbol
    pub fn symbol(env: Env) -> String {
        metadata::read_symbol(&env)
    }

    // ========== Admin Functions ==========

    /// Mint new tokens (admin only, respects max supply)
    ///
    /// # Arguments
    /// * `admin` - Admin address (must be current admin)
    /// * `to` - Recipient address
    /// * `amount` - Amount to mint
    pub fn mint(env: Env, admin: Address, to: Address, amount: i128) {
        admin.require_auth();
        storage::extend_instance_ttl(&env);

        // Verify admin
        let current_admin = admin::read_administrator(&env);
        if admin != current_admin {
            panic!("Error::Unauthorized");
        }

        if amount < 0 {
            panic!("Error::InvalidAmount");
        }

        // Check max supply
        let total = storage::get_total_supply(&env);
        if total + amount > MAX_SUPPLY {
            panic!("Error::MaxSupplyExceeded");
        }

        // Mint tokens
        balance::receive_balance(&env, &to, amount);
        storage::set_total_supply(&env, total + amount);

        events::mint(&env, &admin, &to, amount);
    }

    /// Set new admin (admin only)
    pub fn set_admin(env: Env, current_admin: Address, new_admin: Address) {
        current_admin.require_auth();
        storage::extend_instance_ttl(&env);

        let admin = admin::read_administrator(&env);
        if current_admin != admin {
            panic!("Error::Unauthorized");
        }

        admin::write_administrator(&env, &new_admin);

        events::set_admin(&env, &current_admin, &new_admin);
    }

    /// Get current admin
    pub fn admin(env: Env) -> Address {
        admin::read_administrator(&env)
    }

    // ========== Extended Functions ==========

    /// Get total supply
    pub fn total_supply(env: Env) -> i128 {
        storage::get_total_supply(&env)
    }

    /// Get max supply
    pub fn max_supply(_env: Env) -> i128 {
        MAX_SUPPLY
    }

    /// Check if address is admin
    pub fn is_admin(env: Env, address: Address) -> bool {
        if !storage::has_admin(&env) {
            return false;
        }
        admin::read_administrator(&env) == address
    }

    // ========== Buyback Integration ==========

    /// Buyback and burn tokens (authorized caller only)
    ///
    /// This function is called by the SAC Factory during graduation
    /// to execute buyback & burn mechanism.
    ///
    /// # Arguments
    /// * `caller` - The authorized buyback caller (SAC Factory)
    /// * `amount` - Amount to burn from the caller's balance
    ///
    /// # Note
    /// The caller must have already purchased ASTRO tokens.
    /// This function burns tokens from the caller's balance.
    pub fn buyback_burn(env: Env, caller: Address, amount: i128) {
        caller.require_auth();
        storage::extend_instance_ttl(&env);

        if amount <= 0 {
            panic!("Error::InvalidAmount");
        }

        // Burn tokens from caller's balance
        balance::spend_balance(&env, &caller, amount).unwrap();

        // Update total supply
        let total = storage::get_total_supply(&env);
        storage::set_total_supply(&env, total - amount);

        // Emit buyback burn event
        events::buyback_burn(&env, &caller, amount);
    }
}

// Note: This contract implements the SEP-41 interface through the public functions above.
// All standard token operations (balance, transfer, approve, allowance, burn) are available.

#[cfg(test)]
mod tests;
