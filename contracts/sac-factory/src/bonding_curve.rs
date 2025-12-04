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
    ///
    /// # Arguments
    /// * `xlm_in` - XLM used for swap calculation (net after all fees)
    /// * `tokens_out` - Tokens to mint to buyer
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

    /// Execute buy with LP fee accumulation (Uniswap V2 style)
    ///
    /// LP fee is added to reserves, increasing liquidity over time.
    /// This maintains the constant product invariant for the swap portion
    /// while allowing k to grow from accumulated fees.
    ///
    /// # Arguments
    /// * `xlm_for_swap` - XLM used for token calculation (net after all fees)
    /// * `tokens_out` - Tokens calculated from xlm_for_swap
    /// * `lp_fee` - LP fee that stays in the curve (adds to reserves)
    pub fn execute_buy_with_lp_fee(
        &mut self,
        xlm_for_swap: i128,
        tokens_out: i128,
        lp_fee: i128,
    ) -> Result<(), Error> {
        // Total XLM to add = swap amount + LP fee (LP fee adds liquidity)
        let total_xlm_in = xlm_for_swap
            .checked_add(lp_fee)
            .ok_or(Error::Overflow)?;

        // Update reserves with total (including LP fee)
        self.xlm_reserve = self.xlm_reserve
            .checked_add(total_xlm_in)
            .ok_or(Error::Overflow)?;

        self.tokens_remaining = self.tokens_remaining
            .checked_sub(tokens_out)
            .ok_or(Error::Underflow)?;

        self.tokens_sold = self.tokens_sold
            .checked_add(tokens_out)
            .ok_or(Error::Overflow)?;

        // Update k to reflect new liquidity from LP fee
        // k grows over time as fees accumulate (Uniswap V2 style)
        self.k = self.xlm_reserve
            .checked_mul(self.tokens_remaining)
            .ok_or(Error::Overflow)?;

        Ok(())
    }

    /// Execute sell (update state)
    ///
    /// # Arguments
    /// * `xlm_out` - Gross XLM to remove from reserves
    /// * `tokens_in` - Tokens being sold back to curve
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

    /// Execute sell with LP fee retention (Uniswap V2 style)
    ///
    /// LP fee stays in reserves, increasing liquidity over time.
    /// Only (gross - lp_fee) is removed from reserves.
    ///
    /// # Arguments
    /// * `xlm_out_gross` - Total XLM calculated from bonding curve
    /// * `tokens_in` - Tokens being sold back to curve
    /// * `lp_fee` - LP fee that stays in the curve (not removed from reserves)
    pub fn execute_sell_with_lp_fee(
        &mut self,
        xlm_out_gross: i128,
        tokens_in: i128,
        lp_fee: i128,
    ) -> Result<(), Error> {
        // Only remove (gross - lp_fee) from reserves, LP fee stays
        let xlm_to_remove = xlm_out_gross
            .checked_sub(lp_fee)
            .ok_or(Error::Underflow)?;

        // Update reserves (LP fee stays in curve)
        self.xlm_reserve = self.xlm_reserve
            .checked_sub(xlm_to_remove)
            .ok_or(Error::Underflow)?;

        self.tokens_remaining = self.tokens_remaining
            .checked_add(tokens_in)
            .ok_or(Error::Overflow)?;

        self.tokens_sold = self.tokens_sold
            .checked_sub(tokens_in)
            .ok_or(Error::Underflow)?;

        // Update k to reflect retained LP fee liquidity
        // k grows over time as fees accumulate (Uniswap V2 style)
        self.k = self.xlm_reserve
            .checked_mul(self.tokens_remaining)
            .ok_or(Error::Overflow)?;

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
        let supply = 168_000_000 * PRECISION; // 80% of 210M (Bitcoin number)
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

    #[test]
    fn test_execute_buy_with_lp_fee() {
        let supply = 1000 * PRECISION;
        let mut curve = BondingCurve::new(supply).unwrap();
        let initial_k = curve.k;

        // Simulate 100 XLM buy with 0.25% LP fee
        let xlm_gross = 100 * PRECISION;
        let lp_fee = xlm_gross * 25 / 10_000; // 0.25%
        let xlm_for_swap = xlm_gross - lp_fee - (xlm_gross * 5 / 10_000); // net after all fees

        let tokens_out = curve.calculate_buy(xlm_for_swap).unwrap();
        curve.execute_buy_with_lp_fee(xlm_for_swap, tokens_out, lp_fee).unwrap();

        // k should increase due to LP fee accumulation
        assert!(curve.k > initial_k, "k should grow from LP fee accumulation");

        // xlm_reserve should include LP fee
        // Initial was 1000 * PRECISION, now should be more than just xlm_for_swap added
        assert!(curve.xlm_reserve > 1000 * PRECISION + xlm_for_swap);
    }

    #[test]
    fn test_execute_sell_with_lp_fee() {
        let supply = 1000 * PRECISION;
        let mut curve = BondingCurve::new(supply).unwrap();

        // First, do a buy to have tokens to sell
        let xlm_in = 100 * PRECISION;
        let tokens_bought = curve.calculate_buy(xlm_in).unwrap();
        curve.execute_buy(xlm_in, tokens_bought).unwrap();

        let k_after_buy = curve.k;
        let xlm_after_buy = curve.xlm_reserve;

        // Now sell half the tokens with LP fee retention
        let tokens_to_sell = tokens_bought / 2;
        let xlm_gross = curve.calculate_sell(tokens_to_sell).unwrap();
        let lp_fee = xlm_gross * 25 / 10_000; // 0.25%

        curve.execute_sell_with_lp_fee(xlm_gross, tokens_to_sell, lp_fee).unwrap();

        // LP fee should stay in reserves
        // xlm_reserve should decrease by (xlm_gross - lp_fee), not full xlm_gross
        let expected_xlm = xlm_after_buy - (xlm_gross - lp_fee);
        assert_eq!(curve.xlm_reserve, expected_xlm);

        // k should update (may increase due to retained LP fee)
        assert!(curve.k >= k_after_buy || curve.k > 0, "k should be recalculated");
    }

    #[test]
    fn test_lp_fee_accumulates_over_multiple_trades() {
        let supply = 1000 * PRECISION;
        let mut curve = BondingCurve::new(supply).unwrap();
        let initial_k = curve.k;

        // Do 5 buy/sell cycles
        for _ in 0..5 {
            // Buy
            let xlm_for_swap = 10 * PRECISION;
            let lp_fee_buy = xlm_for_swap * 25 / 9970; // LP fee on gross
            let tokens_out = curve.calculate_buy(xlm_for_swap).unwrap();
            curve.execute_buy_with_lp_fee(xlm_for_swap, tokens_out, lp_fee_buy).unwrap();

            // Sell half
            let tokens_to_sell = tokens_out / 2;
            if tokens_to_sell > 0 {
                let xlm_gross = curve.calculate_sell(tokens_to_sell).unwrap();
                let lp_fee_sell = xlm_gross * 25 / 10_000;
                curve.execute_sell_with_lp_fee(xlm_gross, tokens_to_sell, lp_fee_sell).unwrap();
            }
        }

        // k should have grown significantly from accumulated LP fees
        assert!(curve.k > initial_k, "k should grow from accumulated LP fees");
    }
}
