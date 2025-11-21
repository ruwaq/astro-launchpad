//! Bonding Curve Implementation (Constant Product)
//!
//! Simplified bonding curve similar to Pump.fun:
//! - Constant product formula: x * y = k
//! - Starting price: very low (~$0.000001)
//! - Price increases as supply decreases
//! - Fair and predictable pricing

use soroban_sdk::contracttype;
use crate::errors::Error;

/// Precision for calculations
const PRECISION: i128 = 10_000_000; // 7 decimals (Stellar standard)

#[contracttype]
#[derive(Clone, Debug)]
pub struct BondingCurve {
    /// Total tokens available in bonding curve
    pub total_supply: i128,

    /// Tokens sold from curve
    pub tokens_sold: i128,

    /// Tokens remaining in curve
    pub tokens_remaining: i128,

    /// XLM reserve in the curve
    pub xlm_reserve: i128,

    /// Constant k (x * y = k)
    pub k: i128,
}

impl BondingCurve {
    /// Create new bonding curve
    ///
    /// # Arguments
    /// * `total_supply` - Total tokens allocated to bonding curve (800M)
    ///
    /// # Returns
    /// Result with BondingCurve or Error if overflow occurs
    pub fn new(total_supply: i128) -> Result<Self, Error> {
        if total_supply <= 0 {
            return Err(Error::InvalidAmount);
        }

        // Initial virtual XLM reserve (creates starting price)
        // Starting with 1000 XLM virtual liquidity
        let initial_xlm = 1000 * PRECISION;

        // Calculate k constant with proper error handling
        // k = x * y = xlm_reserve * tokens_remaining
        let k = initial_xlm
            .checked_mul(total_supply)
            .ok_or(Error::Overflow)?;

        Ok(Self {
            total_supply,
            tokens_sold: 0,
            tokens_remaining: total_supply,
            xlm_reserve: initial_xlm,
            k,
        })
    }

    /// Calculate tokens received for XLM input
    ///
    /// Formula: tokens_out = tokens_remaining - (k / (xlm_reserve + xlm_in))
    pub fn calculate_buy(&self, xlm_in: i128) -> Result<i128, Error> {
        if xlm_in <= 0 {
            return Err(Error::InvalidAmount);
        }

        // New XLM reserve after buy
        let new_xlm_reserve = self.xlm_reserve
            .checked_add(xlm_in)
            .ok_or(Error::Overflow)?;

        // New token reserve (from k = x * y)
        let new_token_reserve = self.k
            .checked_div(new_xlm_reserve)
            .ok_or(Error::DivisionByZero)?;

        // Tokens out = old_reserve - new_reserve
        let tokens_out = self.tokens_remaining
            .checked_sub(new_token_reserve)
            .ok_or(Error::Underflow)?;

        if tokens_out <= 0 {
            return Err(Error::InsufficientLiquidity);
        }

        Ok(tokens_out)
    }

    /// Calculate XLM received for token input
    ///
    /// Formula: xlm_out = xlm_reserve - (k / (tokens_remaining + tokens_in))
    pub fn calculate_sell(&self, tokens_in: i128) -> Result<i128, Error> {
        if tokens_in <= 0 {
            return Err(Error::InvalidAmount);
        }

        if tokens_in > self.tokens_sold {
            return Err(Error::InsufficientBalance);
        }

        // New token reserve after sell
        let new_token_reserve = self.tokens_remaining
            .checked_add(tokens_in)
            .ok_or(Error::Overflow)?;

        // New XLM reserve (from k = x * y)
        let new_xlm_reserve = self.k
            .checked_div(new_token_reserve)
            .ok_or(Error::DivisionByZero)?;

        // XLM out = old_reserve - new_reserve
        let xlm_out = self.xlm_reserve
            .checked_sub(new_xlm_reserve)
            .ok_or(Error::Underflow)?;

        if xlm_out <= 0 {
            return Err(Error::InsufficientLiquidity);
        }

        Ok(xlm_out)
    }

    /// Execute buy (update state)
    pub fn execute_buy(&mut self, xlm_in: i128, tokens_out: i128) -> Result<(), Error> {
        // Update reserves
        self.xlm_reserve = self.xlm_reserve
            .checked_add(xlm_in)
            .ok_or(Error::Overflow)?;

        self.tokens_remaining = self.tokens_remaining
            .checked_sub(tokens_out)
            .ok_or(Error::Underflow)?;

        self.tokens_sold = self.tokens_sold
            .checked_add(tokens_out)
            .ok_or(Error::Overflow)?;

        Ok(())
    }

    /// Execute sell (update state)
    pub fn execute_sell(&mut self, xlm_out: i128, tokens_in: i128) -> Result<(), Error> {
        // Update reserves
        self.xlm_reserve = self.xlm_reserve
            .checked_sub(xlm_out)
            .ok_or(Error::Underflow)?;

        self.tokens_remaining = self.tokens_remaining
            .checked_add(tokens_in)
            .ok_or(Error::Overflow)?;

        self.tokens_sold = self.tokens_sold
            .checked_sub(tokens_in)
            .ok_or(Error::Underflow)?;

        Ok(())
    }

    /// Get current price per token (in stroops)
    pub fn get_current_price(&self) -> i128 {
        if self.tokens_remaining == 0 {
            return i128::MAX;
        }

        // Price = xlm_reserve / tokens_remaining
        self.xlm_reserve
            .checked_mul(PRECISION)
            .unwrap_or(i128::MAX)
            .checked_div(self.tokens_remaining)
            .unwrap_or(i128::MAX)
    }

    /// Get market cap (total value)
    pub fn get_market_cap(&self) -> i128 {
        // Market cap = 2 * XLM reserve (for constant product)
        self.xlm_reserve
            .checked_mul(2)
            .unwrap_or(i128::MAX)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_new_bonding_curve() {
        let supply = 800_000_000 * PRECISION;
        let curve = BondingCurve::new(supply).unwrap();

        assert_eq!(curve.total_supply, supply);
        assert_eq!(curve.tokens_sold, 0);
        assert_eq!(curve.tokens_remaining, supply);
        assert!(curve.xlm_reserve > 0);
        assert!(curve.k > 0);
    }

    #[test]
    fn test_new_with_zero_supply_fails() {
        let result = BondingCurve::new(0);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), Error::InvalidAmount);
    }

    #[test]
    fn test_calculate_buy() {
        let supply = 1000 * PRECISION;
        let curve = BondingCurve::new(supply).unwrap();

        let xlm_in = 100 * PRECISION; // 100 XLM
        let tokens_out = curve.calculate_buy(xlm_in).unwrap();

        assert!(tokens_out > 0);
        assert!(tokens_out < supply);
    }

    #[test]
    fn test_price_increases_with_buys() {
        let supply = 1000 * PRECISION;
        let mut curve = BondingCurve::new(supply).unwrap();

        let price_initial = curve.get_current_price();

        // Execute buy
        let xlm_in = 100 * PRECISION;
        let tokens_out = curve.calculate_buy(xlm_in).unwrap();
        curve.execute_buy(xlm_in, tokens_out).unwrap();

        let price_after = curve.get_current_price();

        assert!(price_after > price_initial);
    }
}
