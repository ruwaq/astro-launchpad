//! ASTRO Token Client
//!
//! Client module for interacting with the ASTRO protocol token
//! during graduation to execute buyback & burn mechanism.

#![allow(dead_code)] // ASTRO integration feature - not yet integrated
#![allow(unused_imports)] // vec used in future ASTRO buyback implementation

use soroban_sdk::{Address, Env, IntoVal, Symbol, token, vec};
use crate::errors::Error;
use crate::storage;

/// ASTRO Token client wrapper
pub struct AstroTokenClient<'a> {
    env: &'a Env,
    token_address: Address,
}

impl<'a> AstroTokenClient<'a> {
    /// Create new ASTRO token client
    pub fn new(env: &'a Env, token_address: Address) -> Self {
        Self { env, token_address }
    }

    /// Get token client for standard operations
    fn token_client(&self) -> token::Client<'a> {
        token::Client::new(self.env, &self.token_address)
    }

    /// Buy ASTRO tokens via XLM/ASTRO AMM and execute buyback_burn
    ///
    /// # Process
    /// 1. Swap XLM for ASTRO via pre-deployed AMM
    /// 2. Call buyback_burn on ASTRO token (burns from factory balance)
    ///
    /// # Arguments
    /// * `xlm_amount` - Amount of XLM to use for buyback
    /// * `xlm_address` - XLM token address
    /// * `astro_amm_address` - ASTRO/XLM AMM address
    ///
    /// # Returns
    /// Amount of ASTRO burned
    #[cfg(not(test))]
    pub fn execute_buyback_burn(
        &self,
        xlm_amount: i128,
        xlm_address: &Address,
        astro_amm_address: &Address,
    ) -> Result<i128, Error> {
        let factory_address = self.env.current_contract_address();

        // 1. Swap XLM for ASTRO via AMM
        // Transfer XLM to AMM first
        let xlm_client = token::Client::new(self.env, xlm_address);
        xlm_client.transfer(&factory_address, astro_amm_address, &xlm_amount);

        // Call AMM swap (XLM -> ASTRO)
        let amm_client = crate::amm_client::AmmPairClient::new(self.env, astro_amm_address.clone());
        let deadline = self.env.ledger().timestamp() + 300; // 5 minutes

        // Execute swap: XLM (token_0) -> ASTRO (token_1)
        let (_, astro_received) = amm_client.swap_exact_0_for_1(
            &factory_address,
            xlm_amount,
            0, // min_amount_out (accept any for buyback, can be improved with oracle)
            deadline,
        )?;

        // 2. Now factory holds ASTRO tokens - call buyback_burn
        // The ASTRO contract's buyback_burn function burns tokens from caller's balance
        self.call_buyback_burn(&factory_address, astro_received)?;

        Ok(astro_received)
    }

    /// Test version - returns mock amount
    #[cfg(test)]
    pub fn execute_buyback_burn(
        &self,
        xlm_amount: i128,
        _xlm_address: &Address,
        _astro_amm_address: &Address,
    ) -> Result<i128, Error> {
        // In tests, return mock value (simulated 1:1 swap ratio)
        Ok(xlm_amount)
    }

    /// Call buyback_burn on ASTRO token contract
    ///
    /// This invokes the ASTRO token's buyback_burn function which:
    /// - Requires auth from caller
    /// - Burns tokens from caller's balance
    /// - Updates total supply
    /// - Emits buyback_burn event
    #[cfg(not(test))]
    fn call_buyback_burn(&self, caller: &Address, amount: i128) -> Result<(), Error> {
        // Direct contract invocation for buyback_burn
        // The ASTRO contract has: pub fn buyback_burn(env: Env, caller: Address, amount: i128)
        self.env.invoke_contract::<()>(
            &self.token_address,
            &Symbol::new(self.env, "buyback_burn"),
            (caller.clone(), amount).into_val(self.env),
        );
        Ok(())
    }

    #[cfg(test)]
    fn call_buyback_burn(&self, _caller: &Address, _amount: i128) -> Result<(), Error> {
        Ok(())
    }

    /// Transfer ASTRO tokens
    pub fn transfer(&self, from: &Address, to: &Address, amount: i128) -> Result<(), Error> {
        #[cfg(not(test))]
        {
            self.token_client().transfer(from, to, &amount);
        }
        #[cfg(test)]
        {
            let _ = (from, to, amount);
        }
        Ok(())
    }

    /// Get ASTRO balance
    pub fn balance(&self, address: &Address) -> i128 {
        #[cfg(not(test))]
        {
            self.token_client().balance(address)
        }
        #[cfg(test)]
        {
            let _ = address;
            0
        }
    }

    /// Swap XLM for ASTRO (without burning)
    ///
    /// Used for acquiring ASTRO to create ASTRO/TOKEN liquidity pool
    ///
    /// # Arguments
    /// * `xlm_amount` - Amount of XLM to swap
    /// * `xlm_address` - XLM token address
    /// * `astro_amm_address` - ASTRO/XLM AMM address
    ///
    /// # Returns
    /// Amount of ASTRO received from swap
    #[cfg(not(test))]
    pub fn swap_xlm_for_astro(
        &self,
        xlm_amount: i128,
        xlm_address: &Address,
        astro_amm_address: &Address,
    ) -> Result<i128, Error> {
        let factory_address = self.env.current_contract_address();

        // Transfer XLM to AMM first
        let xlm_client = token::Client::new(self.env, xlm_address);
        xlm_client.transfer(&factory_address, astro_amm_address, &xlm_amount);

        // Call AMM swap (XLM -> ASTRO)
        let amm_client = crate::amm_client::AmmPairClient::new(self.env, astro_amm_address.clone());
        let deadline = self.env.ledger().timestamp() + 300; // 5 minutes

        // Execute swap: XLM (token_0) -> ASTRO (token_1)
        let (_, astro_received) = amm_client.swap_exact_0_for_1(
            &factory_address,
            xlm_amount,
            0, // min_amount_out (can be improved with oracle for slippage protection)
            deadline,
        )?;

        Ok(astro_received)
    }

    /// Test version - returns mock amount (1:1 ratio)
    #[cfg(test)]
    pub fn swap_xlm_for_astro(
        &self,
        xlm_amount: i128,
        _xlm_address: &Address,
        _astro_amm_address: &Address,
    ) -> Result<i128, Error> {
        // In tests, return mock value (simulated 1:1 swap ratio)
        Ok(xlm_amount)
    }
}

/// Get ASTRO client if configured
pub fn get_astro_client(env: &Env) -> Option<AstroTokenClient<'_>> {
    let token_address = storage::get_astro_token_address(env)?;
    Some(AstroTokenClient::new(env, token_address))
}

/// Check if ASTRO integration is enabled
pub fn is_astro_enabled(env: &Env) -> bool {
    storage::get_astro_config(env).is_some()
}

/// Dual-pool graduation allocation
///
/// This struct holds the calculated allocations for both XLM and token
/// amounts to be distributed across pools during graduation.
pub struct DualPoolAllocation {
    /// XLM for the main XLM/TOKEN pool (75%)
    pub xlm_for_xlm_pool: i128,
    /// Tokens for the main XLM/TOKEN pool (75%)
    pub tokens_for_xlm_pool: i128,
    /// XLM to swap for ASTRO (23%)
    pub xlm_for_astro_swap: i128,
    /// Tokens for the ASTRO/TOKEN pool (23%)
    pub tokens_for_astro_pool: i128,
    /// XLM to swap for ASTRO burn (2%)
    pub xlm_for_burn: i128,
}

/// Calculate dual-pool allocation amounts for graduation
///
/// Distribution:
/// - 75% → XLM/TOKEN pool (main liquidity)
/// - 23% → ASTRO/TOKEN pool (ecosystem connectivity)
/// - 2%  → ASTRO burn (deflation)
///
/// # Arguments
/// * `env` - Environment
/// * `total_xlm` - Total XLM raised during bonding curve
/// * `total_tokens` - Total tokens remaining for liquidity
///
/// # Returns
/// DualPoolAllocation struct with all calculated amounts
pub fn calculate_dual_pool_allocation(
    env: &Env,
    total_xlm: i128,
    total_tokens: i128
) -> DualPoolAllocation {
    // If ASTRO not configured, all goes to main XLM pool
    if storage::get_astro_config(env).is_none() {
        return DualPoolAllocation {
            xlm_for_xlm_pool: total_xlm,
            tokens_for_xlm_pool: total_tokens,
            xlm_for_astro_swap: 0,
            tokens_for_astro_pool: 0,
            xlm_for_burn: 0,
        };
    }

    // Allocation percentages in basis points (100% = 10000 bps)
    const XLM_POOL_BPS: i128 = 7500;    // 75%
    const ASTRO_POOL_BPS: i128 = 2300;  // 23%
    const BURN_BPS: i128 = 200;          // 2%

    // Calculate XLM allocations
    let xlm_for_xlm_pool = total_xlm
        .checked_mul(XLM_POOL_BPS)
        .and_then(|v| v.checked_div(10_000))
        .unwrap_or(total_xlm);

    let xlm_for_astro_swap = total_xlm
        .checked_mul(ASTRO_POOL_BPS)
        .and_then(|v| v.checked_div(10_000))
        .unwrap_or(0);

    let xlm_for_burn = total_xlm
        .checked_mul(BURN_BPS)
        .and_then(|v| v.checked_div(10_000))
        .unwrap_or(0);

    // Calculate token allocations (same proportions)
    let tokens_for_xlm_pool = total_tokens
        .checked_mul(XLM_POOL_BPS)
        .and_then(|v| v.checked_div(10_000))
        .unwrap_or(total_tokens);

    let tokens_for_astro_pool = total_tokens
        .checked_mul(ASTRO_POOL_BPS)
        .and_then(|v| v.checked_div(10_000))
        .unwrap_or(0);

    DualPoolAllocation {
        xlm_for_xlm_pool,
        tokens_for_xlm_pool,
        xlm_for_astro_swap,
        tokens_for_astro_pool,
        xlm_for_burn,
    }
}

/// Legacy function for backward compatibility
/// Calculate ASTRO allocation amounts for graduation
///
/// # Arguments
/// * `env` - Environment
/// * `total_xlm` - Total XLM raised during bonding curve
///
/// # Returns
/// Tuple of (xlm_for_main_pool, xlm_for_astro_liquidity, xlm_for_buyback)
pub fn calculate_astro_allocation(env: &Env, total_xlm: i128) -> (i128, i128, i128) {
    // If ASTRO not configured, all goes to main pool
    let astro_config = match storage::get_astro_config(env) {
        Some(config) => config,
        None => return (total_xlm, 0, 0),
    };

    // Calculate allocations based on basis points
    let liquidity_bps = astro_config.liquidity_bps;
    let buyback_bps = astro_config.buyback_bps;
    let total_astro_bps = liquidity_bps + buyback_bps;
    let main_pool_bps = 10_000 - total_astro_bps;

    // Calculate amounts (basis points / 10000)
    let xlm_for_main = total_xlm
        .checked_mul(main_pool_bps)
        .and_then(|v| v.checked_div(10_000))
        .unwrap_or(total_xlm);

    let xlm_for_liquidity = total_xlm
        .checked_mul(liquidity_bps)
        .and_then(|v| v.checked_div(10_000))
        .unwrap_or(0);

    let xlm_for_buyback = total_xlm
        .checked_mul(buyback_bps)
        .and_then(|v| v.checked_div(10_000))
        .unwrap_or(0);

    (xlm_for_main, xlm_for_liquidity, xlm_for_buyback)
}
