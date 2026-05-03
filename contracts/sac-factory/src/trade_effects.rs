//! Trade Effects Helpers
//!
//! Extracts shared logic between buy() and sell() to reduce duplication
//! and improve readability in lib.rs.

use soroban_sdk::{Address, Env};

#[cfg(not(test))]
use soroban_sdk::token;

use crate::errors::Error;
use crate::fee_management::{self, FeeBreakdown, FeeConfig};
use crate::launchpad_token_client;
use crate::state_management;
use crate::storage::{self, TokenInfo, TokenStatus};
use astro_core_shared::math as core_math;

/// Validates common inputs between buy and sell operations.
///
/// Checks:
/// - Trader authorization
/// - Positive trade amount
/// - Non-negative minimum output
/// - Deadline not expired
/// - Contract is active (not paused)
/// - Token is in Bonding status
#[allow(dead_code)]
fn validate_trade_inputs(
    env: &Env,
    trader: &Address,
    _token: &Address,
    amount: i128,
    min_out: i128,
    deadline: u64,
    token_info: &TokenInfo,
    _is_buy: bool,
) -> Result<(), Error> {
    trader.require_auth();

    if amount <= 0 {
        return Err(Error::InvalidAmount);
    }
    if min_out < 0 {
        return Err(Error::InvalidAmount);
    }

    if env.ledger().timestamp() > deadline {
        return Err(Error::TransactionExpired);
    }

    state_management::require_active(env)?;

    if token_info.status != TokenStatus::Bonding {
        return Err(Error::AlreadyGraduated);
    }

    Ok(())
}

/// Calculates fee breakdown and trade output (tokens out for buy, XLM net for sell).
///
/// For buy:
/// - `amount` = gross XLM sent by buyer
/// - Returns (FeeBreakdown, tokens_out)
///
/// For sell:
/// - `amount` = tokens sold by seller
/// - Returns (FeeBreakdown, net XLM after fees)
#[allow(dead_code)]
fn calculate_trade_effects(
    token_info: &mut TokenInfo,
    amount: i128,
    is_buy: bool,
    fee_config: &FeeConfig,
) -> Result<(FeeBreakdown, i128), Error> {
    if is_buy {
        let fee_breakdown = fee_management::calculate_fee_breakdown(
            amount,
            fee_config.protocol_fee_bps,
            fee_config.lp_fee_bps,
        )?;
        let tokens_out = token_info
            .bonding_curve
            .calculate_buy(fee_breakdown.net_amount)?;
        Ok((fee_breakdown, tokens_out))
    } else {
        let xlm_gross = token_info.bonding_curve.calculate_sell(amount)?;
        let fee_breakdown = fee_management::calculate_fee_breakdown(
            xlm_gross,
            fee_config.protocol_fee_bps,
            fee_config.lp_fee_bps,
        )?;
        Ok((fee_breakdown, fee_breakdown.net_amount))
    }
}

/// Applies trade effects to bonding curve state and token accounting.
///
/// Updates:
/// - Bonding curve reserves (via execute_buy_with_lp_fee / execute_sell_with_lp_fee)
/// - Locked XLM tracking
/// - Total XLM raised
/// - Market cap
///
/// `locked_xlm` should be:
/// - Buy: xlm_for_swap + lp_fee (added)
/// - Sell: xlm_gross - lp_fee (subtracted)
#[allow(dead_code)]
fn apply_trade_effects(
    env: &Env,
    token_info: &mut TokenInfo,
    fee_breakdown: &FeeBreakdown,
    tokens_out: i128,
    locked_xlm: i128,
    is_buy: bool,
) -> Result<(), Error> {
    if is_buy {
        let xlm_for_swap = fee_breakdown.net_amount;
        token_info.bonding_curve.execute_buy_with_lp_fee(
            xlm_for_swap,
            tokens_out,
            fee_breakdown.lp_fee,
        )?;
        storage::add_locked_xlm(env, locked_xlm);
        token_info.locked_xlm_amount =
            core_math::safe_add(token_info.locked_xlm_amount, locked_xlm)?;
        token_info.xlm_raised =
            core_math::safe_add(token_info.xlm_raised, fee_breakdown.gross_amount)?;
    } else {
        let xlm_gross = fee_breakdown.gross_amount;
        token_info.bonding_curve.execute_sell_with_lp_fee(
            xlm_gross,
            tokens_out,
            fee_breakdown.lp_fee,
        )?;
        storage::sub_locked_xlm(env, locked_xlm);
        token_info.locked_xlm_amount =
            core_math::safe_sub(token_info.locked_xlm_amount, locked_xlm)?;
        token_info.xlm_raised =
            core_math::safe_sub(token_info.xlm_raised, xlm_gross)?;
    }

    token_info.market_cap = token_info.bonding_curve.get_market_cap()?;

    Ok(())
}

/// Mints tokens to buyer.
///
/// For V2 (pure Soroban tokens with empty issuer): uses launchpad_token_client::mint
/// For V1 (SAC tokens with issuer): uses StellarAssetClient::mint
#[allow(dead_code)]
fn verify_and_mint_tokens(
    env: &Env,
    token: &Address,
    buyer: &Address,
    tokens_out: i128,
    token_info: &TokenInfo,
) {
    #[cfg(not(test))]
    {
        if token_info.issuer.is_empty() {
            launchpad_token_client::mint(env, token, buyer, tokens_out);
        } else {
            let token_client = token::StellarAssetClient::new(env, token);
            token_client.mint(buyer, &tokens_out);
        }
    }
}
