/**
 * Bonding Curve Utilities
 *
 * Centralized calculations for constant product bonding curves.
 * Formula: x * y = k (where x = xlm_reserve, y = token_reserve)
 *
 * Pattern: Pure functions for mathematical operations (DRY principle)
 * All functions handle BigInt for precision and overflow safety
 */

import type { NormalizedBondingCurve } from '../adapters/contract-adapter';

/**
 * Bonding curve calculation result
 */
export interface BondingCurveOutput {
  amountOut: bigint;
  priceImpact: number; // Percentage (0-100)
  effectivePrice: bigint; // Price per token in stroops
}

/**
 * Re-export NormalizedBondingCurve type for convenience
 */
export type { NormalizedBondingCurve } from '../adapters/contract-adapter';

/**
 * Calculate buy output (tokens received for XLM input)
 *
 * Formula: tokens_out = token_reserve - (k / (xlm_reserve + xlm_in))
 *
 * @param curve - Current bonding curve state
 * @param xlmAmount - Amount of XLM to spend (in stroops)
 * @returns Tokens to receive
 *
 * @example
 * const curve = { xlm_reserve: "1000", token_reserve: "10000", k: "10000000" };
 * const output = calculateBuyOutput(curve, 100n);
 * // Returns tokens received for 100 stroops
 */
export function calculateBuyOutput(
  curve: NormalizedBondingCurve,
  xlmAmount: bigint
): BondingCurveOutput {
  const xlmReserve = BigInt(curve.xlm_reserve);
  const tokenReserve = BigInt(curve.token_reserve);
  const k = BigInt(curve.k);

  // New reserves after trade
  const newXlmReserve = xlmReserve + xlmAmount;
  const newTokenReserve = k / newXlmReserve;
  const tokensOut = tokenReserve - newTokenReserve;

  // Calculate price impact
  const priceImpact = calculatePriceImpact(tokenReserve, newTokenReserve);

  // Effective price: XLM spent / tokens received
  const effectivePrice = tokensOut > 0n ? (xlmAmount * BigInt(10_000_000)) / tokensOut : 0n;

  return {
    amountOut: tokensOut,
    priceImpact,
    effectivePrice,
  };
}

/**
 * Calculate sell output (XLM received for token input)
 *
 * Formula: xlm_out = xlm_reserve - (k / (token_reserve + tokens_in))
 *
 * @param curve - Current bonding curve state
 * @param tokenAmount - Amount of tokens to sell
 * @returns XLM to receive (in stroops)
 *
 * @example
 * const curve = { xlm_reserve: "1000", token_reserve: "10000", k: "10000000" };
 * const output = calculateSellOutput(curve, 100n);
 * // Returns XLM received for 100 tokens
 */
export function calculateSellOutput(
  curve: NormalizedBondingCurve,
  tokenAmount: bigint
): BondingCurveOutput {
  const xlmReserve = BigInt(curve.xlm_reserve);
  const tokenReserve = BigInt(curve.token_reserve);
  const k = BigInt(curve.k);

  // New reserves after trade
  const newTokenReserve = tokenReserve + tokenAmount;
  const newXlmReserve = k / newTokenReserve;
  const xlmOut = xlmReserve - newXlmReserve;

  // Calculate price impact
  const priceImpact = calculatePriceImpact(xlmReserve, newXlmReserve);

  // Effective price: XLM received / tokens sold
  const effectivePrice = tokenAmount > 0n ? (xlmOut * BigInt(10_000_000)) / tokenAmount : 0n;

  return {
    amountOut: xlmOut,
    priceImpact,
    effectivePrice,
  };
}

/**
 * Calculate current price (price of 1 token in XLM)
 *
 * Formula: price = xlm_reserve / token_reserve
 *
 * @param curve - Current bonding curve state
 * @returns Price of 1 token in stroops (with 7 decimals)
 */
export function getCurrentPrice(curve: NormalizedBondingCurve): bigint {
  const xlmReserve = BigInt(curve.xlm_reserve);
  const tokenReserve = BigInt(curve.token_reserve);

  if (tokenReserve === 0n) return 0n;

  // Price = (xlm_reserve / token_reserve) * 10^7 (for precision)
  return (xlmReserve * BigInt(10_000_000)) / tokenReserve;
}

/**
 * Calculate price impact percentage
 *
 * @param reserveBefore - Reserve before trade
 * @param reserveAfter - Reserve after trade
 * @returns Price impact as percentage (0-100)
 */
function calculatePriceImpact(reserveBefore: bigint, reserveAfter: bigint): number {
  if (reserveBefore === 0n) return 0;

  const difference = reserveBefore > reserveAfter
    ? reserveBefore - reserveAfter
    : reserveAfter - reserveBefore;

  // Impact = (difference / reserveBefore) * 100
  const impact = Number((difference * BigInt(10000)) / reserveBefore) / 100;

  return Math.min(impact, 100); // Cap at 100%
}

/**
 * Apply slippage tolerance to amount
 *
 * @param amount - Amount before slippage
 * @param slippagePercent - Slippage tolerance (0-100)
 * @param isMinimum - If true, calculates minimum out; if false, calculates maximum in
 * @returns Amount after slippage adjustment
 *
 * @example
 * const minOut = applySlippageTolerance(1000n, 1, true);  // 990n (1% slippage)
 * const maxIn = applySlippageTolerance(1000n, 1, false); // 1010n (1% slippage)
 */
export function applySlippageTolerance(
  amount: bigint,
  slippagePercent: number,
  isMinimum: boolean = true
): bigint {
  const slippageBps = BigInt(Math.floor(slippagePercent * 100)); // Convert to basis points
  const bpsBase = BigInt(10000);

  if (isMinimum) {
    // Minimum out: amount * (10000 - slippage_bps) / 10000
    return (amount * (bpsBase - slippageBps)) / bpsBase;
  } else {
    // Maximum in: amount * (10000 + slippage_bps) / 10000
    return (amount * (bpsBase + slippageBps)) / bpsBase;
  }
}

/**
 * Calculate market cap in XLM
 *
 * Market Cap = Current Price * Circulating Supply
 *
 * @param curve - Current bonding curve state
 * @param circulatingSupply - Tokens in circulation (sold tokens)
 * @returns Market cap in stroops
 */
export function calculateMarketCap(
  curve: NormalizedBondingCurve,
  circulatingSupply: bigint
): bigint {
  const price = getCurrentPrice(curve);
  return (price * circulatingSupply) / BigInt(10_000_000); // Normalize decimals
}

/**
 * Calculate graduation progress (0-10000 = 0%-100% in basis points)
 *
 * @param xlmRaised - Total XLM raised in bonding curve
 * @param graduationThreshold - Threshold for graduation (default 10,000 XLM)
 * @returns Progress in basis points (0-10000)
 */
export function calculateGraduationProgress(
  xlmRaised: bigint,
  graduationThreshold: bigint = BigInt(100_000_000_000) // 10,000 XLM in stroops
): number {
  if (graduationThreshold === 0n) return 0;

  const progress = Number((xlmRaised * BigInt(10000)) / graduationThreshold);
  return Math.min(progress, 10000); // Cap at 100%
}

/**
 * Validate if a trade would violate bonding curve invariant
 *
 * Ensures the trade maintains k = xlm_reserve * token_reserve
 *
 * @param curve - Current bonding curve state
 * @param xlmDelta - Change in XLM reserve (positive for buy, negative for sell)
 * @param tokenDelta - Change in token reserve (negative for buy, positive for sell)
 * @returns true if trade is valid
 */
export function validateTradeInvariant(
  curve: NormalizedBondingCurve,
  xlmDelta: bigint,
  tokenDelta: bigint
): boolean {
  const xlmReserve = BigInt(curve.xlm_reserve);
  const tokenReserve = BigInt(curve.token_reserve);
  const k = BigInt(curve.k);

  const newXlmReserve = xlmReserve + xlmDelta;
  const newTokenReserve = tokenReserve + tokenDelta;

  if (newXlmReserve <= 0n || newTokenReserve <= 0n) {
    return false;
  }

  const newK = newXlmReserve * newTokenReserve;

  // Allow small rounding errors (0.01% tolerance)
  const tolerance = k / BigInt(10000);
  const difference = newK > k ? newK - k : k - newK;

  return difference <= tolerance;
}

/**
 * Calculate required XLM input for desired token output
 *
 * Inverse of calculateBuyOutput
 * Formula: xlm_in = (k / (token_reserve - tokens_out)) - xlm_reserve
 *
 * @param curve - Current bonding curve state
 * @param desiredTokens - Desired tokens to receive
 * @returns Required XLM input in stroops
 */
export function calculateRequiredXlmForTokens(
  curve: NormalizedBondingCurve,
  desiredTokens: bigint
): bigint {
  const xlmReserve = BigInt(curve.xlm_reserve);
  const tokenReserve = BigInt(curve.token_reserve);
  const k = BigInt(curve.k);

  if (desiredTokens >= tokenReserve) {
    throw new Error('Desired tokens exceed available reserve');
  }

  const newTokenReserve = tokenReserve - desiredTokens;
  const newXlmReserve = k / newTokenReserve;
  return newXlmReserve - xlmReserve;
}

/**
 * Calculate required token input for desired XLM output
 *
 * Inverse of calculateSellOutput
 * Formula: tokens_in = (k / (xlm_reserve - xlm_out)) - token_reserve
 *
 * @param curve - Current bonding curve state
 * @param desiredXlm - Desired XLM to receive (in stroops)
 * @returns Required token input
 */
export function calculateRequiredTokensForXlm(
  curve: NormalizedBondingCurve,
  desiredXlm: bigint
): bigint {
  const xlmReserve = BigInt(curve.xlm_reserve);
  const tokenReserve = BigInt(curve.token_reserve);
  const k = BigInt(curve.k);

  if (desiredXlm >= xlmReserve) {
    throw new Error('Desired XLM exceeds available reserve');
  }

  const newXlmReserve = xlmReserve - desiredXlm;
  const newTokenReserve = k / newXlmReserve;
  return newTokenReserve - tokenReserve;
}
