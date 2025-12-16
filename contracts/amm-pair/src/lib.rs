#![no_std]

//! # AMM Pair Contract
//!
//! Automated Market Maker using Constant Product formula (x * y = k)
//! Based on Uniswap V2 design principles
//!
//! Features:
//! - Constant product market maker (CPMM)
//! - 0.3% trading fee
//! - LP token minting for liquidity providers
//! - Minimum liquidity lock
//! - Flash swap support (future)

use soroban_sdk::{
    contract, contractimpl, contracttype, token, Address, Env, String, Symbol, symbol_short,
};

mod math;
mod storage;
mod events;
mod reentrancy;
mod errors;

use storage::{DataKey, PairInfo};
use errors::Error;

/// Minimum liquidity to lock permanently (prevents division by zero attacks)
const MINIMUM_LIQUIDITY: i128 = 1000;

// Note: Fee constants (FEE_BPS, FEE_DENOMINATOR) are defined in math.rs
// to avoid duplication and unused variable warnings

#[contract]
pub struct AMMPair;

#[contractimpl]
impl AMMPair {
    /// Initialize the pair contract
    ///
    /// # Arguments
    /// * `token_a` - Address of first token
    /// * `token_b` - Address of second token
    /// * `factory` - Address of factory contract
    /// * `fee_to` - Address to send protocol fees
    ///
    /// # Returns
    /// Result<(), Error> - Ok if initialization succeeds, Error if already initialized
    pub fn initialize(
        env: Env,
        token_a: Address,
        token_b: Address,
        factory: Address,
        fee_to: Address,
    ) -> Result<(), Error> {
        if storage::has_pair_info(&env) {
            return Err(Error::AlreadyInitialized);
        }

        // Ensure tokens are sorted (A < B)
        let (token_0, token_1) = if token_a < token_b {
            (token_a, token_b)
        } else {
            (token_b, token_a)
        };

        let pair_info = PairInfo {
            token_0: token_0.clone(),
            token_1: token_1.clone(),
            factory,
            fee_to,
            reserve_0: 0,
            reserve_1: 0,
            total_supply: 0,
            k_last: 0,
        };

        storage::set_pair_info(&env, &pair_info);
        Ok(())
    }

    /// Add liquidity to the pair
    ///
    /// # Arguments
    /// * `sender` - Address adding liquidity
    /// * `amount_0_desired` - Desired amount of token0
    /// * `amount_1_desired` - Desired amount of token1
    /// * `amount_0_min` - Minimum amount of token0 (slippage protection)
    /// * `amount_1_min` - Minimum amount of token1 (slippage protection)
    /// * `deadline` - Unix timestamp after which transaction expires (MEV protection)
    ///
    /// # Returns
    /// Result with tuple of (amount0, amount1, liquidity_minted) or Error
    pub fn add_liquidity(
        env: Env,
        sender: Address,
        amount_0_desired: i128,
        amount_1_desired: i128,
        amount_0_min: i128,
        amount_1_min: i128,
        deadline: u64,
    ) -> Result<(i128, i128, i128), Error> {
        sender.require_auth();

        // REENTRANCY PROTECTION: Acquire lock for entire function
        let _guard = reentrancy::ReentrancyGuard::new(&env)?;

        // Check deadline (MEV protection)
        if env.ledger().timestamp() > deadline {
            return Err(Error::TransactionExpired);
        }

        let mut pair_info = storage::get_pair_info(&env);

        // Calculate optimal amounts
        let (amount_0, amount_1) = if pair_info.total_supply == 0 {
            // First liquidity provision
            (amount_0_desired, amount_1_desired)
        } else {
            // Calculate optimal amounts based on current reserves
            let amount_1_optimal = math::quote(
                amount_0_desired,
                pair_info.reserve_0,
                pair_info.reserve_1,
            )?;

            if amount_1_optimal <= amount_1_desired {
                if amount_1_optimal < amount_1_min {
                    return Err(Error::InsufficientToken1Amount);
                }
                (amount_0_desired, amount_1_optimal)
            } else {
                let amount_0_optimal = math::quote(
                    amount_1_desired,
                    pair_info.reserve_1,
                    pair_info.reserve_0,
                )?;

                if amount_0_optimal > amount_0_desired || amount_0_optimal < amount_0_min {
                    return Err(Error::InsufficientToken0Amount);
                }
                (amount_0_optimal, amount_1_desired)
            }
        };

        // Calculate liquidity to mint
        let liquidity = if pair_info.total_supply == 0 {
            // First liquidity: sqrt(amount0 * amount1) - MINIMUM_LIQUIDITY
            let product = amount_0
                .checked_mul(amount_1)
                .ok_or(Error::Overflow)?;
            let initial_liquidity = math::sqrt(product);

            // Lock minimum liquidity permanently
            if initial_liquidity <= MINIMUM_LIQUIDITY {
                return Err(Error::InsufficientLiquidityMinted);
            }

            // Mint minimum liquidity to zero address (locked forever)
            pair_info.total_supply = MINIMUM_LIQUIDITY;

            initial_liquidity
                .checked_sub(MINIMUM_LIQUIDITY)
                .ok_or(Error::Underflow)?
        } else {
            // Subsequent liquidity: min(amount0/reserve0, amount1/reserve1) * totalSupply
            if pair_info.reserve_0 == 0 || pair_info.reserve_1 == 0 {
                return Err(Error::InsufficientReserve);
            }

            let liquidity_0 = amount_0
                .checked_mul(pair_info.total_supply)
                .and_then(|v| v.checked_div(pair_info.reserve_0))
                .ok_or(Error::Overflow)?;
            let liquidity_1 = amount_1
                .checked_mul(pair_info.total_supply)
                .and_then(|v| v.checked_div(pair_info.reserve_1))
                .ok_or(Error::Overflow)?;

            if liquidity_0 < liquidity_1 {
                liquidity_0
            } else {
                liquidity_1
            }
        };

        if liquidity <= 0 {
            return Err(Error::InsufficientLiquidityMinted);
        }

        // Transfer tokens from sender to this contract
        let token_0_client = token::Client::new(&env, &pair_info.token_0);
        let token_1_client = token::Client::new(&env, &pair_info.token_1);

        token_0_client.transfer(&sender, &env.current_contract_address(), &amount_0);
        token_1_client.transfer(&sender, &env.current_contract_address(), &amount_1);

        // Update reserves with checked arithmetic
        pair_info.reserve_0 = pair_info.reserve_0
            .checked_add(amount_0)
            .ok_or(Error::Overflow)?;
        pair_info.reserve_1 = pair_info.reserve_1
            .checked_add(amount_1)
            .ok_or(Error::Overflow)?;
        pair_info.total_supply = pair_info.total_supply
            .checked_add(liquidity)
            .ok_or(Error::Overflow)?;

        // Store LP balance for sender
        storage::increase_balance(&env, &sender, liquidity);

        storage::set_pair_info(&env, &pair_info);

        // Emit event
        events::liquidity_added(&env, &sender, amount_0, amount_1, liquidity);

        Ok((amount_0, amount_1, liquidity))
    }

    /// Remove liquidity from the pair
    ///
    /// # Arguments
    /// * `sender` - Address removing liquidity
    /// * `liquidity` - Amount of LP tokens to burn
    /// * `amount_0_min` - Minimum amount of token0 to receive
    /// * `amount_1_min` - Minimum amount of token1 to receive
    /// * `deadline` - Unix timestamp after which transaction expires (MEV protection)
    ///
    /// # Returns
    /// Result with tuple of (amount0, amount1) or Error
    pub fn remove_liquidity(
        env: Env,
        sender: Address,
        liquidity: i128,
        amount_0_min: i128,
        amount_1_min: i128,
        deadline: u64,
    ) -> Result<(i128, i128), Error> {
        sender.require_auth();

        // REENTRANCY PROTECTION: Acquire lock for entire function
        let _guard = reentrancy::ReentrancyGuard::new(&env)?;

        // Check deadline (MEV protection)
        if env.ledger().timestamp() > deadline {
            return Err(Error::TransactionExpired);
        }

        let mut pair_info = storage::get_pair_info(&env);

        // Check sender has enough LP tokens
        let sender_balance = storage::get_balance(&env, &sender);
        if sender_balance < liquidity {
            return Err(Error::InsufficientLPBalance);
        }

        // Check total supply to avoid division by zero
        if pair_info.total_supply == 0 {
            return Err(Error::InsufficientLiquidity);
        }

        // Calculate amounts to return with checked arithmetic
        let amount_0 = liquidity
            .checked_mul(pair_info.reserve_0)
            .and_then(|v| v.checked_div(pair_info.total_supply))
            .ok_or(Error::Overflow)?;
        let amount_1 = liquidity
            .checked_mul(pair_info.reserve_1)
            .and_then(|v| v.checked_div(pair_info.total_supply))
            .ok_or(Error::Overflow)?;

        // Check slippage
        if amount_0 < amount_0_min {
            return Err(Error::InsufficientToken0Amount);
        }
        if amount_1 < amount_1_min {
            return Err(Error::InsufficientToken1Amount);
        }

        // Burn LP tokens
        storage::decrease_balance(&env, &sender, liquidity);
        pair_info.total_supply = pair_info.total_supply
            .checked_sub(liquidity)
            .ok_or(Error::Underflow)?;

        // Update reserves with checked arithmetic
        pair_info.reserve_0 = pair_info.reserve_0
            .checked_sub(amount_0)
            .ok_or(Error::Underflow)?;
        pair_info.reserve_1 = pair_info.reserve_1
            .checked_sub(amount_1)
            .ok_or(Error::Underflow)?;

        // Transfer tokens to sender
        let token_0_client = token::Client::new(&env, &pair_info.token_0);
        let token_1_client = token::Client::new(&env, &pair_info.token_1);

        token_0_client.transfer(&env.current_contract_address(), &sender, &amount_0);
        token_1_client.transfer(&env.current_contract_address(), &sender, &amount_1);

        storage::set_pair_info(&env, &pair_info);

        // Emit event
        events::liquidity_removed(&env, &sender, amount_0, amount_1, liquidity);

        Ok((amount_0, amount_1))
    }

    /// Swap exact tokens for tokens
    ///
    /// # Arguments
    /// * `sender` - Address performing the swap
    /// * `amount_in` - Exact amount of input token
    /// * `amount_out_min` - Minimum amount of output token (slippage protection)
    /// * `token_in` - Address of input token
    /// * `deadline` - Unix timestamp after which transaction expires (MEV protection)
    ///
    /// # Returns
    /// Result with amount of output tokens received or Error
    pub fn swap(
        env: Env,
        sender: Address,
        amount_in: i128,
        amount_out_min: i128,
        token_in: Address,
        deadline: u64,
    ) -> Result<i128, Error> {
        sender.require_auth();

        // REENTRANCY PROTECTION: Acquire lock for entire function
        let _guard = reentrancy::ReentrancyGuard::new(&env)?;

        // Check deadline (MEV protection)
        if env.ledger().timestamp() > deadline {
            return Err(Error::TransactionExpired);
        }

        if amount_in <= 0 {
            return Err(Error::InsufficientInputAmount);
        }

        let mut pair_info = storage::get_pair_info(&env);

        // Determine which token is input and which is output
        let (reserve_in, reserve_out, token_out) = if token_in == pair_info.token_0 {
            (pair_info.reserve_0, pair_info.reserve_1, pair_info.token_1.clone())
        } else if token_in == pair_info.token_1 {
            (pair_info.reserve_1, pair_info.reserve_0, pair_info.token_0.clone())
        } else {
            return Err(Error::InvalidToken);
        };

        // CRITICAL FIX: Calculate K BEFORE any state changes
        let k_old = reserve_in
            .checked_mul(reserve_out)
            .ok_or(Error::Overflow)?;

        // Calculate output amount with fee
        let amount_out = math::get_amount_out(amount_in, reserve_in, reserve_out)?;

        if amount_out < amount_out_min {
            return Err(Error::InsufficientOutputAmount);
        }

        // Transfer input tokens from sender to this contract
        let token_in_client = token::Client::new(&env, &token_in);
        token_in_client.transfer(&sender, &env.current_contract_address(), &amount_in);

        // Transfer output tokens to sender
        let token_out_client = token::Client::new(&env, &token_out);
        token_out_client.transfer(&env.current_contract_address(), &sender, &amount_out);

        // Update reserves with checked arithmetic
        if token_in == pair_info.token_0 {
            pair_info.reserve_0 = pair_info.reserve_0
                .checked_add(amount_in)
                .ok_or(Error::Overflow)?;
            pair_info.reserve_1 = pair_info.reserve_1
                .checked_sub(amount_out)
                .ok_or(Error::Underflow)?;
        } else {
            pair_info.reserve_1 = pair_info.reserve_1
                .checked_add(amount_in)
                .ok_or(Error::Overflow)?;
            pair_info.reserve_0 = pair_info.reserve_0
                .checked_sub(amount_out)
                .ok_or(Error::Underflow)?;
        }

        // CRITICAL FIX: Verify K invariant - K should INCREASE due to fees
        let k_new = pair_info.reserve_0
            .checked_mul(pair_info.reserve_1)
            .ok_or(Error::Overflow)?;

        // K must be greater than or equal to k_old (fees ensure K increases)
        if k_new <= k_old {
            return Err(Error::KInvariantViolated);
        }

        storage::set_pair_info(&env, &pair_info);

        // Emit event
        events::swap(&env, &sender, &token_in, &token_out, amount_in, amount_out);

        Ok(amount_out)
    }

    /// Get current reserves
    ///
    /// # Returns
    /// Tuple of (reserve0, reserve1, timestamp)
    pub fn get_reserves(env: Env) -> (i128, i128, u64) {
        let pair_info = storage::get_pair_info(&env);
        let timestamp = env.ledger().timestamp();

        (pair_info.reserve_0, pair_info.reserve_1, timestamp)
    }

    /// Get pair information
    pub fn get_pair_info(env: Env) -> PairInfo {
        storage::get_pair_info(&env)
    }

    /// Get LP token balance for an address
    pub fn balance_of(env: Env, address: Address) -> i128 {
        storage::get_balance(&env, &address)
    }

    /// Get total LP token supply
    pub fn total_supply(env: Env) -> i128 {
        let pair_info = storage::get_pair_info(&env);
        pair_info.total_supply
    }

    /// Calculate output amount for a given input (without executing swap)
    pub fn get_amount_out(env: Env, amount_in: i128, token_in: Address) -> Result<i128, Error> {
        let pair_info = storage::get_pair_info(&env);

        let (reserve_in, reserve_out) = if token_in == pair_info.token_0 {
            (pair_info.reserve_0, pair_info.reserve_1)
        } else if token_in == pair_info.token_1 {
            (pair_info.reserve_1, pair_info.reserve_0)
        } else {
            return Err(Error::InvalidToken);
        };

        math::get_amount_out(amount_in, reserve_in, reserve_out)
    }

    /// Calculate input amount needed for a desired output (without executing swap)
    pub fn get_amount_in(env: Env, amount_out: i128, token_out: Address) -> Result<i128, Error> {
        let pair_info = storage::get_pair_info(&env);

        let (reserve_in, reserve_out) = if token_out == pair_info.token_0 {
            (pair_info.reserve_1, pair_info.reserve_0)
        } else if token_out == pair_info.token_1 {
            (pair_info.reserve_0, pair_info.reserve_1)
        } else {
            return Err(Error::InvalidToken);
        };

        math::get_amount_in(amount_out, reserve_in, reserve_out)
    }
}
