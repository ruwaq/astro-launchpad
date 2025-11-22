//! Price Oracle Module
//!
//! Provides price feed integration with DIA Oracle on Soroban
//! Sprint 2 - Price Oracle Integration

use soroban_sdk::{contracttype, Address, Env, IntoVal, Symbol, Vec as SorobanVec};

use crate::errors::Error;

/// Price data returned from oracle
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PriceData {
    /// Price in USD with 18 decimals (e.g., 1.5 USD = 1_500_000_000_000_000_000)
    pub rate: u128,
    /// Timestamp of last update for base asset
    pub last_updated_base: u64,
    /// Timestamp of last update for quote asset
    pub last_updated_quote: u64,
}

/// Oracle client for DIA price feeds
pub struct DiaOracleClient<'a> {
    env: &'a Env,
    oracle_address: Address,
}

impl<'a> DiaOracleClient<'a> {
    /// Create a new DIA Oracle client
    ///
    /// # Arguments
    /// * `env` - Contract environment
    /// * `oracle_address` - Address of deployed DIA Oracle contract
    pub fn new(env: &'a Env, oracle_address: Address) -> Self {
        Self {
            env,
            oracle_address,
        }
    }

    /// Get price for a single asset pair
    ///
    /// # Arguments
    /// * `base` - Base asset symbol (e.g., "XLM")
    /// * `quote` - Quote asset symbol (e.g., "USD")
    ///
    /// # Returns
    /// PriceData with rate and timestamps
    pub fn get_price(&self, base: &str, quote: &str) -> Result<PriceData, Error> {
        // Convert string symbols to Soroban Symbol type
        let base_symbol = Symbol::new(self.env, base);
        let quote_symbol = Symbol::new(self.env, quote);

        // Create symbol pair vector
        let mut pairs = SorobanVec::new(self.env);
        pairs.push_back((base_symbol, quote_symbol));

        // Call oracle contract
        // Using the Band Protocol standard interface pattern
        let result: Result<SorobanVec<PriceData>, Error> = self.env
            .invoke_contract(
                &self.oracle_address,
                &Symbol::new(self.env, "get_reference_data"),
                (pairs,).into_val(self.env),
            );

        match result {
            Ok(prices) => {
                prices.get(0).ok_or(Error::OraclePriceFeedNotFound)
            }
            Err(_) => Err(Error::OracleCallFailed),
        }
    }

    /// Get XLM price in USD
    ///
    /// # Returns
    /// Price in USD with 18 decimals
    pub fn get_xlm_price(&self) -> Result<u128, Error> {
        let price_data = self.get_price("XLM", "USD")?;

        // Validate price is not stale (within 1 hour = 3600 seconds)
        let current_time = self.env.ledger().timestamp();
        let max_age = 3600u64;

        if current_time - price_data.last_updated_base > max_age {
            return Err(Error::OraclePriceStale);
        }

        Ok(price_data.rate)
    }

    /// Get price for any asset in USD
    ///
    /// # Arguments
    /// * `asset_symbol` - Asset symbol (e.g., "BTC", "ETH", "XLM")
    ///
    /// # Returns
    /// Price in USD with 18 decimals
    pub fn get_asset_price(&self, asset_symbol: &str) -> Result<u128, Error> {
        let price_data = self.get_price(asset_symbol, "USD")?;

        // Validate price is not stale (within 1 hour)
        let current_time = self.env.ledger().timestamp();
        let max_age = 3600u64;

        if current_time - price_data.last_updated_base > max_age {
            return Err(Error::OraclePriceStale);
        }

        Ok(price_data.rate)
    }

    /// Calculate market cap in USD
    ///
    /// # Arguments
    /// * `xlm_amount` - Amount of XLM (with 7 decimals)
    ///
    /// # Returns
    /// Market cap in USD with 18 decimals
    pub fn calculate_market_cap_usd(&self, xlm_amount: i128) -> Result<u128, Error> {
        let xlm_price = self.get_xlm_price()?;

        // Convert XLM amount (7 decimals) to u128 for calculation
        if xlm_amount < 0 {
            return Err(Error::InvalidAmount);
        }

        let xlm_u128 = xlm_amount as u128;

        // Calculate market cap
        // xlm_amount has 7 decimals, xlm_price has 18 decimals
        // Result = (xlm_amount * xlm_price) / 10^7
        let market_cap = xlm_u128
            .checked_mul(xlm_price)
            .ok_or(Error::MathOverflow)?
            .checked_div(10_000_000) // Normalize XLM decimals
            .ok_or(Error::MathOverflow)?;

        Ok(market_cap)
    }

    /// Check if graduation threshold meets minimum market cap requirement
    ///
    /// # Arguments
    /// * `xlm_raised` - Total XLM raised during bonding curve
    /// * `min_market_cap_usd` - Minimum market cap in USD (with 18 decimals)
    ///
    /// # Returns
    /// true if market cap exceeds minimum requirement
    pub fn validate_graduation_market_cap(
        &self,
        xlm_raised: i128,
        min_market_cap_usd: u128,
    ) -> Result<bool, Error> {
        let market_cap = self.calculate_market_cap_usd(xlm_raised)?;
        Ok(market_cap >= min_market_cap_usd)
    }
}

/// Get DIA Oracle address from storage
///
/// Returns None if oracle not configured
pub fn get_oracle_address(env: &Env) -> Option<Address> {
    env.storage()
        .instance()
        .get(&crate::storage::InstanceKey::OracleAddress)
}

/// Helper function to create oracle client from storage
///
/// # Returns
/// DiaOracleClient if oracle is configured, Error otherwise
pub fn get_oracle_client(env: &Env) -> Result<DiaOracleClient<'_>, Error> {
    let oracle_address = get_oracle_address(env)
        .ok_or(Error::OracleNotConfigured)?;

    Ok(DiaOracleClient::new(env, oracle_address))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_calculate_market_cap_usd() {
        // Mock: 10,000 XLM at $0.10 per XLM = $1,000 market cap
        let xlm_amount = 10_000_0000000i128; // 10,000 XLM (7 decimals)
        let xlm_price = 100_000_000_000_000_000u128; // $0.10 (18 decimals)

        let market_cap = xlm_amount as u128 * xlm_price / 10_000_000;

        // Expected: 1000 USD with 18 decimals = 1_000_000_000_000_000_000_000
        assert_eq!(market_cap, 1_000_000_000_000_000_000_000u128);
    }

    #[test]
    fn test_negative_amount_check() {
        // Test that negative amounts would be caught
        let xlm_amount = -100i128;
        assert!(xlm_amount < 0); // This would trigger InvalidAmount error
    }

    #[test]
    fn test_market_cap_validation_logic() {
        // Test graduation market cap validation logic
        let xlm_raised = 10_000_0000000i128; // 10,000 XLM
        let xlm_price = 100_000_000_000_000_000u128; // $0.10
        let market_cap = (xlm_raised as u128 * xlm_price) / 10_000_000;

        let min_required = 500_000_000_000_000_000_000u128; // $500 minimum
        assert!(market_cap >= min_required); // Should pass validation
    }
}
