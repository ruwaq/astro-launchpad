//! # Cross-Contract Interfaces
//!
//! Type-safe client wrappers for cross-contract calls.
//! These avoid the need to import WASM files directly.

use soroban_sdk::{Address, Env, Symbol, Vec, IntoVal};
use crate::types::{DistributionResult, UserStake, LockInfo, TokenMetadata, GraduationInfo};

// ════════════════════════════════════════════════════════════════════════════
// Fee Distributor Client
// ════════════════════════════════════════════════════════════════════════════

/// Client for Fee Distributor contract
pub struct FeeDistributorClient<'a> {
    env: &'a Env,
    contract_id: Address,
}

impl<'a> FeeDistributorClient<'a> {
    pub fn new(env: &'a Env, contract_id: &Address) -> Self {
        Self {
            env,
            contract_id: contract_id.clone(),
        }
    }

    /// Distribute fees for a token
    pub fn distribute(&self, token: &Address, amount: i128) -> DistributionResult {
        self.env.invoke_contract(
            &self.contract_id,
            &Symbol::new(self.env, "distribute"),
            Vec::from_array(self.env, [
                token.into_val(self.env),
                amount.into_val(self.env),
            ]),
        )
    }

    /// Get pending distribution for a token
    pub fn get_pending(&self, token: &Address) -> i128 {
        self.env.invoke_contract(
            &self.contract_id,
            &Symbol::new(self.env, "get_pending_distribution"),
            Vec::from_array(self.env, [token.into_val(self.env)]),
        )
    }
}

// ════════════════════════════════════════════════════════════════════════════
// Staking Pool Client
// ════════════════════════════════════════════════════════════════════════════

/// Client for Staking Pool contract
pub struct StakingPoolClient<'a> {
    env: &'a Env,
    contract_id: Address,
}

impl<'a> StakingPoolClient<'a> {
    pub fn new(env: &'a Env, contract_id: &Address) -> Self {
        Self {
            env,
            contract_id: contract_id.clone(),
        }
    }

    /// Stake tokens
    pub fn stake(&self, user: &Address, amount: i128) {
        self.env.invoke_contract::<()>(
            &self.contract_id,
            &Symbol::new(self.env, "stake"),
            Vec::from_array(self.env, [
                user.into_val(self.env),
                amount.into_val(self.env),
            ]),
        );
    }

    /// Unstake tokens
    pub fn unstake(&self, user: &Address, amount: i128) {
        self.env.invoke_contract::<()>(
            &self.contract_id,
            &Symbol::new(self.env, "unstake"),
            Vec::from_array(self.env, [
                user.into_val(self.env),
                amount.into_val(self.env),
            ]),
        );
    }

    /// Add rewards to pool (called by Fee Distributor)
    pub fn add_rewards(&self, token: &Address, amount: i128) {
        self.env.invoke_contract::<()>(
            &self.contract_id,
            &Symbol::new(self.env, "add_rewards"),
            Vec::from_array(self.env, [
                token.into_val(self.env),
                amount.into_val(self.env),
            ]),
        );
    }

    /// Get user stake info
    pub fn get_stake(&self, user: &Address) -> UserStake {
        self.env.invoke_contract(
            &self.contract_id,
            &Symbol::new(self.env, "get_stake"),
            Vec::from_array(self.env, [user.into_val(self.env)]),
        )
    }

    /// Get total staked
    pub fn total_staked(&self) -> i128 {
        self.env.invoke_contract(
            &self.contract_id,
            &Symbol::new(self.env, "total_staked"),
            Vec::new(self.env),
        )
    }
}

// ════════════════════════════════════════════════════════════════════════════
// Liquidity Locker Client
// ════════════════════════════════════════════════════════════════════════════

/// Client for Liquidity Locker contract
pub struct LiquidityLockerClient<'a> {
    env: &'a Env,
    contract_id: Address,
}

impl<'a> LiquidityLockerClient<'a> {
    pub fn new(env: &'a Env, contract_id: &Address) -> Self {
        Self {
            env,
            contract_id: contract_id.clone(),
        }
    }

    /// Lock LP tokens
    pub fn lock(
        &self,
        owner: &Address,
        lp_token: &Address,
        amount: i128,
        unlock_time: u64,
    ) -> u64 {
        self.env.invoke_contract(
            &self.contract_id,
            &Symbol::new(self.env, "lock"),
            Vec::from_array(self.env, [
                owner.into_val(self.env),
                lp_token.into_val(self.env),
                amount.into_val(self.env),
                unlock_time.into_val(self.env),
            ]),
        )
    }

    /// Unlock LP tokens
    pub fn unlock(&self, owner: &Address, lock_id: u64) -> i128 {
        self.env.invoke_contract(
            &self.contract_id,
            &Symbol::new(self.env, "unlock"),
            Vec::from_array(self.env, [
                owner.into_val(self.env),
                lock_id.into_val(self.env),
            ]),
        )
    }

    /// Get lock info
    pub fn get_lock(&self, lock_id: u64) -> Option<LockInfo> {
        self.env.invoke_contract(
            &self.contract_id,
            &Symbol::new(self.env, "get_lock"),
            Vec::from_array(self.env, [lock_id.into_val(self.env)]),
        )
    }
}

// ════════════════════════════════════════════════════════════════════════════
// Treasury Vault Client
// ════════════════════════════════════════════════════════════════════════════

/// Client for Treasury Vault contract
pub struct TreasuryVaultClient<'a> {
    env: &'a Env,
    contract_id: Address,
}

impl<'a> TreasuryVaultClient<'a> {
    pub fn new(env: &'a Env, contract_id: &Address) -> Self {
        Self {
            env,
            contract_id: contract_id.clone(),
        }
    }

    /// Notify deposit (for tracking)
    pub fn notify_deposit(&self, token: &Address, from: &Address, amount: i128) {
        self.env.invoke_contract::<()>(
            &self.contract_id,
            &Symbol::new(self.env, "notify_deposit"),
            Vec::from_array(self.env, [
                token.into_val(self.env),
                from.into_val(self.env),
                amount.into_val(self.env),
            ]),
        );
    }

    /// Get balance of a token
    pub fn balance(&self, token: &Address) -> i128 {
        self.env.invoke_contract(
            &self.contract_id,
            &Symbol::new(self.env, "balance"),
            Vec::from_array(self.env, [token.into_val(self.env)]),
        )
    }
}

// ════════════════════════════════════════════════════════════════════════════
// AstroSwap Bridge Client
// ════════════════════════════════════════════════════════════════════════════

/// Client for AstroSwap Bridge contract
pub struct BridgeClient<'a> {
    env: &'a Env,
    contract_id: Address,
}

impl<'a> BridgeClient<'a> {
    pub fn new(env: &'a Env, contract_id: &Address) -> Self {
        Self {
            env,
            contract_id: contract_id.clone(),
        }
    }

    /// Graduate a token from launchpad to DEX
    pub fn graduate_token(
        &self,
        token: &Address,
        token_amount: i128,
        quote_amount: i128,
        metadata: &TokenMetadata,
    ) -> GraduationInfo {
        self.env.invoke_contract(
            &self.contract_id,
            &Symbol::new(self.env, "graduate_token"),
            Vec::from_array(self.env, [
                token.into_val(self.env),
                token_amount.into_val(self.env),
                quote_amount.into_val(self.env),
                metadata.into_val(self.env),
            ]),
        )
    }

    /// Check if token is graduated
    pub fn is_graduated(&self, token: &Address) -> bool {
        self.env.invoke_contract(
            &self.contract_id,
            &Symbol::new(self.env, "is_graduated"),
            Vec::from_array(self.env, [token.into_val(self.env)]),
        )
    }
}

// ════════════════════════════════════════════════════════════════════════════
// AMM Pair Client (generic for both internal and AstroSwap)
// ════════════════════════════════════════════════════════════════════════════

/// Client for AMM Pair contract
pub struct AmmPairClient<'a> {
    env: &'a Env,
    contract_id: Address,
}

impl<'a> AmmPairClient<'a> {
    pub fn new(env: &'a Env, contract_id: &Address) -> Self {
        Self {
            env,
            contract_id: contract_id.clone(),
        }
    }

    /// Initialize pair
    pub fn initialize(
        &self,
        token_0: &Address,
        token_1: &Address,
        factory: &Address,
        fee_to: &Address,
    ) {
        self.env.invoke_contract::<()>(
            &self.contract_id,
            &Symbol::new(self.env, "initialize"),
            Vec::from_array(self.env, [
                token_0.into_val(self.env),
                token_1.into_val(self.env),
                factory.into_val(self.env),
                fee_to.into_val(self.env),
            ]),
        );
    }

    /// Get reserves
    pub fn get_reserves(&self) -> (i128, i128) {
        self.env.invoke_contract(
            &self.contract_id,
            &Symbol::new(self.env, "get_reserves"),
            Vec::new(self.env),
        )
    }

    /// Add liquidity
    pub fn add_liquidity(
        &self,
        sender: &Address,
        amount_0: i128,
        amount_1: i128,
        min_0: i128,
        min_1: i128,
        deadline: u64,
    ) -> (i128, i128, i128) {
        self.env.invoke_contract(
            &self.contract_id,
            &Symbol::new(self.env, "add_liquidity"),
            Vec::from_array(self.env, [
                sender.into_val(self.env),
                amount_0.into_val(self.env),
                amount_1.into_val(self.env),
                min_0.into_val(self.env),
                min_1.into_val(self.env),
                deadline.into_val(self.env),
            ]),
        )
    }

    /// Swap tokens
    pub fn swap(
        &self,
        user: &Address,
        token_in: &Address,
        amount_in: i128,
        min_out: i128,
    ) -> i128 {
        self.env.invoke_contract(
            &self.contract_id,
            &Symbol::new(self.env, "swap"),
            Vec::from_array(self.env, [
                user.into_val(self.env),
                token_in.into_val(self.env),
                amount_in.into_val(self.env),
                min_out.into_val(self.env),
            ]),
        )
    }

    /// Get token 0 address
    pub fn token_0(&self) -> Address {
        self.env.invoke_contract(
            &self.contract_id,
            &Symbol::new(self.env, "token_0"),
            Vec::new(self.env),
        )
    }

    /// Get token 1 address
    pub fn token_1(&self) -> Address {
        self.env.invoke_contract(
            &self.contract_id,
            &Symbol::new(self.env, "token_1"),
            Vec::new(self.env),
        )
    }
}
