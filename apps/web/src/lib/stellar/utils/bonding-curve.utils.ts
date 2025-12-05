/**
 * Bonding Curve Utilities
 *
 * Centralized calculations for constant product bonding curves.
 * Formula: x * y = k (where x = xlm_reserve, y = token_reserve)
 *
 * Fee Model (Uniswap V2 style):
 * - Protocol fee: 0.05% (5 bps) → Treasury
 * - LP fee: 0.25% (25 bps) → Bonding curve
 * - Total: 0.30% (30 bps)
 *
 * Fee Application:
 * - BUY: Fee deducted from XLM INPUT before swap calculation
 * - SELL: Fee deducted from XLM OUTPUT after swap calculation
 *
 * Pattern: Pure functions for mathematical operations (DRY principle)
 * All functions handle BigInt for precision and overflow safety
 */

import type { NormalizedBondingCurve } from '../adapters/contract-adapter';

/**
 * Default fee configuration (matches contract defaults)
 */
export const DEFAULT_PROTOCOL_FEE_BPS = 5n;   // 0.05%
export const DEFAULT_LP_FEE_BPS = 25n;        // 0.25%
export const DEFAULT_TOTAL_FEE_BPS = 30n;     // 0.30%
export const BPS_PRECISION = 10000n;

/**
 * Bonding curve calculation result
 *
 * NOTE: priceChange is the expected price movement from the trade.
 * For bonding curves this is deterministic, NOT "slippage" or "price impact" like DEX swaps.
 */
export interface BondingCurveOutput {
  amountOut: bigint;
  /** Expected price change percentage (0-100). This is deterministic for bonding curves. */
  priceChange: number;
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
  // SAFETY: Validate curve state before calculations
  if (!curve || !curve.xlm_reserve || !curve.token_reserve || !curve.k) {
    return { amountOut: 0n, priceChange: 0, effectivePrice: 0n };
  }

  const xlmReserve = BigInt(curve.xlm_reserve);
  const tokenReserve = BigInt(curve.token_reserve);
  const k = BigInt(curve.k);

  // SAFETY: Validate reserves are positive to prevent division by zero
  if (xlmReserve <= 0n || tokenReserve <= 0n || k <= 0n) {
    return { amountOut: 0n, priceChange: 0, effectivePrice: 0n };
  }

  // SAFETY: Validate input amount
  if (xlmAmount <= 0n) {
    return { amountOut: 0n, priceChange: 0, effectivePrice: 0n };
  }

  // New reserves after trade
  const newXlmReserve = xlmReserve + xlmAmount;
  const newTokenReserve = k / newXlmReserve;
  const tokensOut = tokenReserve - newTokenReserve;

  // Calculate expected price change (deterministic for bonding curves)
  const priceChange = calculatePriceChangePercent(tokenReserve, newTokenReserve);

  // Effective price: XLM spent / tokens received
  const effectivePrice = tokensOut > 0n ? (xlmAmount * BigInt(10_000_000)) / tokensOut : 0n;

  return {
    amountOut: tokensOut,
    priceChange,
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
  // SAFETY: Validate curve state before calculations
  if (!curve || !curve.xlm_reserve || !curve.token_reserve || !curve.k) {
    return { amountOut: 0n, priceChange: 0, effectivePrice: 0n };
  }

  const xlmReserve = BigInt(curve.xlm_reserve);
  const tokenReserve = BigInt(curve.token_reserve);
  const k = BigInt(curve.k);

  // SAFETY: Validate reserves are positive to prevent division by zero
  if (xlmReserve <= 0n || tokenReserve <= 0n || k <= 0n) {
    return { amountOut: 0n, priceChange: 0, effectivePrice: 0n };
  }

  // SAFETY: Validate input amount
  if (tokenAmount <= 0n) {
    return { amountOut: 0n, priceChange: 0, effectivePrice: 0n };
  }

  // New reserves after trade
  const newTokenReserve = tokenReserve + tokenAmount;
  const newXlmReserve = k / newTokenReserve;
  const xlmOut = xlmReserve - newXlmReserve;

  // Calculate expected price change (deterministic for bonding curves)
  const priceChange = calculatePriceChangePercent(xlmReserve, newXlmReserve);

  // Effective price: XLM received / tokens sold
  const effectivePrice = tokenAmount > 0n ? (xlmOut * BigInt(10_000_000)) / tokenAmount : 0n;

  return {
    amountOut: xlmOut,
    priceChange,
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
 * Calculate expected price change percentage
 *
 * NOTE: For bonding curves this is deterministic - it's the expected change,
 * not uncertain "impact" like DEX swaps.
 *
 * @param reserveBefore - Reserve before trade
 * @param reserveAfter - Reserve after trade
 * @returns Price change as percentage (0-100)
 */
function calculatePriceChangePercent(reserveBefore: bigint, reserveAfter: bigint): number {
  if (reserveBefore === 0n) return 0;

  const difference = reserveBefore > reserveAfter
    ? reserveBefore - reserveAfter
    : reserveAfter - reserveBefore;

  // Impact = (difference / reserveBefore) * 100
  const impact = Number((difference * BigInt(10000)) / reserveBefore) / 100;

  return Math.min(impact, 100); // Cap at 100%
}

/**
 * Apply output tolerance to amount
 *
 * NOTE: For bonding curves, this is NOT slippage tolerance.
 * This tolerance protects against race conditions where another transaction
 * changes the reserves between price calculation and transaction execution.
 *
 * @param amount - Amount before tolerance adjustment
 * @param tolerancePercent - Tolerance percentage (0-100), typically 0.5% for bonding curves
 * @param isMinimum - If true, calculates minimum out; if false, calculates maximum in
 * @returns Amount after tolerance adjustment
 *
 * @example
 * const minOut = applyOutputTolerance(1000n, 0.5, true);  // 995n (0.5% tolerance)
 * const maxIn = applyOutputTolerance(1000n, 0.5, false); // 1005n (0.5% tolerance)
 */
export function applyOutputTolerance(
  amount: bigint,
  tolerancePercent: number,
  isMinimum: boolean = true
): bigint {
  const toleranceBps = BigInt(Math.floor(tolerancePercent * 100)); // Convert to basis points
  const bpsBase = BigInt(10000);

  if (isMinimum) {
    // Minimum out: amount * (10000 - tolerance_bps) / 10000
    return (amount * (bpsBase - toleranceBps)) / bpsBase;
  } else {
    // Maximum in: amount * (10000 + tolerance_bps) / 10000
    return (amount * (bpsBase + toleranceBps)) / bpsBase;
  }
}

/**
 * @deprecated Use applyOutputTolerance instead. Kept for backwards compatibility.
 */
export const applySlippageTolerance = applyOutputTolerance;

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

// ============================================================================
// Fee-Aware Calculations (for accurate user-facing estimates)
// ============================================================================

/**
 * Fee breakdown result
 */
export interface FeeBreakdown {
  grossAmount: bigint;
  protocolFee: bigint;
  lpFee: bigint;
  totalFees: bigint;
  netAmount: bigint;
}

/**
 * Calculate fee breakdown for a given amount
 *
 * @param amount - Gross amount (XLM in stroops)
 * @param protocolFeeBps - Protocol fee in basis points (default 5)
 * @param lpFeeBps - LP fee in basis points (default 25)
 * @returns Detailed fee breakdown
 */
export function calculateFeeBreakdown(
  amount: bigint,
  protocolFeeBps: bigint = DEFAULT_PROTOCOL_FEE_BPS,
  lpFeeBps: bigint = DEFAULT_LP_FEE_BPS
): FeeBreakdown {
  const protocolFee = (amount * protocolFeeBps) / BPS_PRECISION;
  const lpFee = (amount * lpFeeBps) / BPS_PRECISION;
  const totalFees = protocolFee + lpFee;
  const netAmount = amount - totalFees;

  return {
    grossAmount: amount,
    protocolFee,
    lpFee,
    totalFees,
    netAmount,
  };
}

/**
 * Calculate buy output WITH fees applied (user-facing estimate)
 *
 * This shows what the user will ACTUALLY receive after fees.
 * Fee is deducted from XLM INPUT before bonding curve calculation.
 *
 * @param curve - Current bonding curve state
 * @param xlmAmount - Gross XLM amount to spend (in stroops)
 * @param protocolFeeBps - Protocol fee in basis points (default 5)
 * @param lpFeeBps - LP fee in basis points (default 25)
 * @returns Tokens to receive (after fees applied to input)
 */
export function calculateBuyOutputWithFees(
  curve: NormalizedBondingCurve,
  xlmAmount: bigint,
  protocolFeeBps: bigint = DEFAULT_PROTOCOL_FEE_BPS,
  lpFeeBps: bigint = DEFAULT_LP_FEE_BPS
): BondingCurveOutput & { feeBreakdown: FeeBreakdown } {
  // Step 1: Calculate fee breakdown on XLM input
  const feeBreakdown = calculateFeeBreakdown(xlmAmount, protocolFeeBps, lpFeeBps);

  // Step 2: Calculate tokens using NET XLM (after fees)
  const result = calculateBuyOutput(curve, feeBreakdown.netAmount);

  return {
    ...result,
    feeBreakdown,
  };
}

/**
 * Calculate sell output WITH fees applied (user-facing estimate)
 *
 * This shows what the user will ACTUALLY receive after fees.
 * Fee is deducted from XLM OUTPUT after bonding curve calculation.
 *
 * @param curve - Current bonding curve state
 * @param tokenAmount - Token amount to sell
 * @param protocolFeeBps - Protocol fee in basis points (default 5)
 * @param lpFeeBps - LP fee in basis points (default 25)
 * @returns XLM to receive (after fees applied to output)
 */
export function calculateSellOutputWithFees(
  curve: NormalizedBondingCurve,
  tokenAmount: bigint,
  protocolFeeBps: bigint = DEFAULT_PROTOCOL_FEE_BPS,
  lpFeeBps: bigint = DEFAULT_LP_FEE_BPS
): BondingCurveOutput & { feeBreakdown: FeeBreakdown } {
  // Step 1: Calculate gross XLM from bonding curve
  const result = calculateSellOutput(curve, tokenAmount);

  // Step 2: Calculate fee breakdown on XLM output
  const feeBreakdown = calculateFeeBreakdown(result.amountOut, protocolFeeBps, lpFeeBps);

  return {
    amountOut: feeBreakdown.netAmount,
    priceChange: result.priceChange,
    effectivePrice: tokenAmount > 0n
      ? (feeBreakdown.netAmount * BigInt(10_000_000)) / tokenAmount
      : 0n,
    feeBreakdown,
  };
}

/**
 * Format fee for display (human readable)
 *
 * @param feeBps - Fee in basis points
 * @returns Formatted string (e.g., "0.30%")
 */
export function formatFeeBps(feeBps: bigint | number): string {
  const bps = typeof feeBps === 'bigint' ? Number(feeBps) : feeBps;
  return `${(bps / 100).toFixed(2)}%`;
}
