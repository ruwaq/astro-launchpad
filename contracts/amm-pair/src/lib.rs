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

use storage::{DataKey, PairInfo};

/// Minimum liquidity to lock permanently (prevents division by zero attacks)
const MINIMUM_LIQUIDITY: i128 = 1000;

/// Fee in basis points (30 = 0.3%)
const FEE_BPS: i128 = 30;
const FEE_DENOMINATOR: i128 = 10000;

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
    pub fn initialize(
        env: Env,
        token_a: Address,
        token_b: Address,
        factory: Address,
        fee_to: Address,
    ) {
        if storage::has_pair_info(&env) {
            panic!("already initialized");
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
    /// Tuple of (amount0, amount1, liquidity_minted)
    pub fn add_liquidity(
        env: Env,
        sender: Address,
        amount_0_desired: i128,
        amount_1_desired: i128,
        amount_0_min: i128,
        amount_1_min: i128,
        deadline: u64,
    ) -> (i128, i128, i128) {
        sender.require_auth();

        // Check deadline (MEV protection)
        if env.ledger().timestamp() > deadline {
            panic!("transaction expired");
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
            );

            if amount_1_optimal <= amount_1_desired {
                if amount_1_optimal < amount_1_min {
                    panic!("insufficient token1 amount");
                }
                (amount_0_desired, amount_1_optimal)
            } else {
                let amount_0_optimal = math::quote(
                    amount_1_desired,
                    pair_info.reserve_1,
                    pair_info.reserve_0,
                );

                if amount_0_optimal > amount_0_desired || amount_0_optimal < amount_0_min {
                    panic!("insufficient token0 amount");
                }
                (amount_0_optimal, amount_1_desired)
            }
        };

        // Calculate liquidity to mint
        let liquidity = if pair_info.total_supply == 0 {
            // First liquidity: sqrt(amount0 * amount1) - MINIMUM_LIQUIDITY
            let initial_liquidity = math::sqrt(amount_0 * amount_1);

            // Lock minimum liquidity permanently
            if initial_liquidity <= MINIMUM_LIQUIDITY {
                panic!("insufficient liquidity minted");
            }

            // Mint minimum liquidity to zero address (locked forever)
            pair_info.total_supply = MINIMUM_LIQUIDITY;

            initial_liquidity - MINIMUM_LIQUIDITY
        } else {
            // Subsequent liquidity: min(amount0/reserve0, amount1/reserve1) * totalSupply
            let liquidity_0 = (amount_0 * pair_info.total_supply) / pair_info.reserve_0;
            let liquidity_1 = (amount_1 * pair_info.total_supply) / pair_info.reserve_1;

            if liquidity_0 < liquidity_1 {
                liquidity_0
            } else {
                liquidity_1
            }
        };

        if liquidity <= 0 {
            panic!("insufficient liquidity minted");
        }

        // Transfer tokens from sender to this contract
        let token_0_client = token::Client::new(&env, &pair_info.token_0);
        let token_1_client = token::Client::new(&env, &pair_info.token_1);

        token_0_client.transfer(&sender, &env.current_contract_address(), &amount_0);
        token_1_client.transfer(&sender, &env.current_contract_address(), &amount_1);

        // Update reserves
        pair_info.reserve_0 += amount_0;
        pair_info.reserve_1 += amount_1;
        pair_info.total_supply += liquidity;

        // Store LP balance for sender
        storage::increase_balance(&env, &sender, liquidity);

        storage::set_pair_info(&env, &pair_info);

        // Emit event
        events::liquidity_added(&env, &sender, amount_0, amount_1, liquidity);

        (amount_0, amount_1, liquidity)
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
    /// Tuple of (amount0, amount1)
    pub fn remove_liquidity(
        env: Env,
        sender: Address,
        liquidity: i128,
        amount_0_min: i128,
        amount_1_min: i128,
        deadline: u64,
    ) -> (i128, i128) {
        sender.require_auth();

        // Check deadline (MEV protection)
        if env.ledger().timestamp() > deadline {
            panic!("transaction expired");
        }

        let mut pair_info = storage::get_pair_info(&env);

        // Check sender has enough LP tokens
        let sender_balance = storage::get_balance(&env, &sender);
        if sender_balance < liquidity {
            panic!("insufficient liquidity");
        }

        // Calculate amounts to return
        let amount_0 = (liquidity * pair_info.reserve_0) / pair_info.total_supply;
        let amount_1 = (liquidity * pair_info.reserve_1) / pair_info.total_supply;

        // Check slippage
        if amount_0 < amount_0_min {
            panic!("insufficient token0 amount");
        }
        if amount_1 < amount_1_min {
            panic!("insufficient token1 amount");
        }

        // Burn LP tokens
        storage::decrease_balance(&env, &sender, liquidity);
        pair_info.total_supply -= liquidity;

        // Update reserves
        pair_info.reserve_0 -= amount_0;
        pair_info.reserve_1 -= amount_1;

        // Transfer tokens to sender
        let token_0_client = token::Client::new(&env, &pair_info.token_0);
        let token_1_client = token::Client::new(&env, &pair_info.token_1);

        token_0_client.transfer(&env.current_contract_address(), &sender, &amount_0);
        token_1_client.transfer(&env.current_contract_address(), &sender, &amount_1);

        storage::set_pair_info(&env, &pair_info);

        // Emit event
        events::liquidity_removed(&env, &sender, amount_0, amount_1, liquidity);

        (amount_0, amount_1)
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
    /// Amount of output tokens received
    pub fn swap(
        env: Env,
        sender: Address,
        amount_in: i128,
        amount_out_min: i128,
        token_in: Address,
        deadline: u64,
    ) -> i128 {
        sender.require_auth();

        // Check deadline (MEV protection)
        if env.ledger().timestamp() > deadline {
            panic!("transaction expired");
        }

        if amount_in <= 0 {
            panic!("insufficient input amount");
        }

        let mut pair_info = storage::get_pair_info(&env);

        // Determine which token is input and which is output
        let (reserve_in, reserve_out, token_out) = if token_in == pair_info.token_0 {
            (pair_info.reserve_0, pair_info.reserve_1, pair_info.token_1.clone())
        } else if token_in == pair_info.token_1 {
            (pair_info.reserve_1, pair_info.reserve_0, pair_info.token_0.clone())
        } else {
            panic!("invalid token");
        };

        // CRITICAL FIX: Calculate K BEFORE any state changes
        let k_old = reserve_in * reserve_out;

        // Calculate output amount with fee
        let amount_out = math::get_amount_out(amount_in, reserve_in, reserve_out);

        if amount_out < amount_out_min {
            panic!("insufficient output amount");
        }

        // Transfer input tokens from sender to this contract
        let token_in_client = token::Client::new(&env, &token_in);
        token_in_client.transfer(&sender, &env.current_contract_address(), &amount_in);

        // Transfer output tokens to sender
        let token_out_client = token::Client::new(&env, &token_out);
        token_out_client.transfer(&env.current_contract_address(), &sender, &amount_out);

        // Update reserves
        if token_in == pair_info.token_0 {
            pair_info.reserve_0 += amount_in;
            pair_info.reserve_1 -= amount_out;
        } else {
            pair_info.reserve_1 += amount_in;
            pair_info.reserve_0 -= amount_out;
        }

        // CRITICAL FIX: Verify K invariant - K should INCREASE due to fees
        let k_new = pair_info.reserve_0 * pair_info.reserve_1;

        // K must be greater than or equal to k_old (fees ensure K increases)
        if k_new <= k_old {
            panic!("K invariant violated - new K must be > old K due to fees");
        }

        storage::set_pair_info(&env, &pair_info);

        // Emit event
        events::swap(&env, &sender, &token_in, &token_out, amount_in, amount_out);

        amount_out
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
    pub fn get_amount_out(env: Env, amount_in: i128, token_in: Address) -> i128 {
        let pair_info = storage::get_pair_info(&env);

        let (reserve_in, reserve_out) = if token_in == pair_info.token_0 {
            (pair_info.reserve_0, pair_info.reserve_1)
        } else if token_in == pair_info.token_1 {
            (pair_info.reserve_1, pair_info.reserve_0)
        } else {
            panic!("invalid token");
        };

        math::get_amount_out(amount_in, reserve_in, reserve_out)
    }

    /// Calculate input amount needed for a desired output (without executing swap)
    pub fn get_amount_in(env: Env, amount_out: i128, token_out: Address) -> i128 {
        let pair_info = storage::get_pair_info(&env);

        let (reserve_in, reserve_out) = if token_out == pair_info.token_0 {
            (pair_info.reserve_1, pair_info.reserve_0)
        } else if token_out == pair_info.token_1 {
            (pair_info.reserve_0, pair_info.reserve_1)
        } else {
            panic!("invalid token");
        };

        math::get_amount_in(amount_out, reserve_in, reserve_out)
    }
}
