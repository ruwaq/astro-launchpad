//! AMM Pair Client
//!
//! Client for cross-contract calls to deployed AMM pair contracts
//! Sprint 3 - Cross-Contract AMM Initialization

use soroban_sdk::{Address, Env, IntoVal, Symbol};

use crate::errors::Error;

/// Client for interacting with deployed AMM pair contracts
pub struct AmmPairClient<'a> {
    env: &'a Env,
    address: Address,
}

impl<'a> AmmPairClient<'a> {
    /// Create a new AMM pair client
    ///
    /// # Arguments
    /// * `env` - Contract environment
    /// * `address` - Address of deployed AMM pair contract
    pub fn new(env: &'a Env, address: Address) -> Self {
        Self { env, address }
    }

    /// Initialize the AMM pair contract
    ///
    /// # Arguments
    /// * `token_a` - Address of first token (XLM)
    /// * `token_b` - Address of second token (graduated token)
    /// * `factory` - Address of factory contract (this contract)
    /// * `fee_to` - Address to send protocol fees (treasury)
    ///
    /// # Returns
    /// Result indicating success or failure
    pub fn initialize(
        &self,
        token_a: &Address,
        token_b: &Address,
        factory: &Address,
        fee_to: &Address,
    ) -> Result<(), Error> {
        // Call AMM initialize method
        let result: Result<(), Error> = self.env.invoke_contract(
            &self.address,
            &Symbol::new(self.env, "initialize"),
            (
                token_a.clone(),
                token_b.clone(),
                factory.clone(),
                fee_to.clone(),
            )
                .into_val(self.env),
        );

        result.map_err(|_| Error::AmmInitializationFailed)
    }

    /// Add liquidity to the AMM pair
    ///
    /// # Arguments
    /// * `sender` - Address adding liquidity (factory)
    /// * `amount_0_desired` - Amount of token0 (XLM)
    /// * `amount_1_desired` - Amount of token1 (graduated token)
    /// * `amount_0_min` - Minimum amount of token0 (slippage = 0 for initial)
    /// * `amount_1_min` - Minimum amount of token1 (slippage = 0 for initial)
    /// * `deadline` - Transaction deadline
    ///
    /// # Returns
    /// Tuple of (amount0, amount1, liquidity_minted)
    pub fn add_liquidity(
        &self,
        sender: &Address,
        amount_0_desired: i128,
        amount_1_desired: i128,
        amount_0_min: i128,
        amount_1_min: i128,
        deadline: u64,
    ) -> Result<(i128, i128, i128), Error> {
        // Call AMM add_liquidity method
        let result: Result<(i128, i128, i128), Error> = self.env.invoke_contract(
            &self.address,
            &Symbol::new(self.env, "add_liquidity"),
            (
                sender.clone(),
                amount_0_desired,
                amount_1_desired,
                amount_0_min,
                amount_1_min,
                deadline,
            )
                .into_val(self.env),
        );

        result.map_err(|_| Error::AmmInitializationFailed)
    }

    /// Get AMM pair reserves
    ///
    /// # Returns
    /// Tuple of (reserve0, reserve1, block_timestamp_last)
    pub fn get_reserves(&self) -> Result<(i128, i128, u64), Error> {
        let result: Result<(i128, i128, u64), Error> = self.env.invoke_contract(
            &self.address,
            &Symbol::new(self.env, "get_reserves"),
            ().into_val(self.env),
        );

        result.map_err(|_| Error::AmmInitializationFailed)
    }
}
