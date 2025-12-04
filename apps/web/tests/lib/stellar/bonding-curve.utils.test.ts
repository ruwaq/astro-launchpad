/**
 * Tests for Bonding Curve Utility Functions
 *
 * Comprehensive tests for:
 * - Constant product (x*y=k) calculations
 * - Fee calculations (protocol + LP fees)
 * - Precision handling with BigInt
 * - Edge cases (small amounts, large amounts, zero)
 */

import { describe, it, expect } from 'vitest';
import {
  calculateBuyOutput,
  calculateSellOutput,
  calculateBuyOutputWithFees,
  calculateSellOutputWithFees,
  calculateFeeBreakdown,
  formatFeeBps,
  applySlippageTolerance,
  getCurrentPrice,
  calculateGraduationProgress,
  validateTradeInvariant,
  calculateRequiredXlmForTokens,
  calculateRequiredTokensForXlm,
  DEFAULT_PROTOCOL_FEE_BPS,
  DEFAULT_LP_FEE_BPS,
  DEFAULT_TOTAL_FEE_BPS,
  BPS_PRECISION,
  type NormalizedBondingCurve,
} from '@/lib/stellar/utils/bonding-curve.utils';

// Test fixtures
const createCurve = (
  xlmReserve: bigint,
  tokenReserve: bigint
): NormalizedBondingCurve => ({
  xlm_reserve: xlmReserve.toString(),
  token_reserve: tokenReserve.toString(),
  k: (xlmReserve * tokenReserve).toString(),
});

// Standard bonding curve: 1000 XLM, 1,000,000 tokens
const STANDARD_CURVE = createCurve(
  1000_0000000n, // 1000 XLM in stroops
  1000000_0000000n // 1M tokens in smallest unit
);

// ============================================================================
// Constants Tests
// ============================================================================

describe('Bonding Curve Constants', () => {
  it('should have correct default protocol fee (0.05%)', () => {
    expect(DEFAULT_PROTOCOL_FEE_BPS).toBe(5n);
  });

  it('should have correct default LP fee (0.25%)', () => {
    expect(DEFAULT_LP_FEE_BPS).toBe(25n);
  });

  it('should have correct total fee (0.30%)', () => {
    expect(DEFAULT_TOTAL_FEE_BPS).toBe(30n);
    expect(DEFAULT_PROTOCOL_FEE_BPS + DEFAULT_LP_FEE_BPS).toBe(DEFAULT_TOTAL_FEE_BPS);
  });

  it('should have correct BPS precision (10000)', () => {
    expect(BPS_PRECISION).toBe(10000n);
  });
});

// ============================================================================
// Fee Calculation Tests
// ============================================================================

describe('calculateFeeBreakdown', () => {
  it('should calculate correct fee breakdown for standard amount', () => {
    const amount = 100_0000000n; // 100 XLM
    const breakdown = calculateFeeBreakdown(amount);

    // Protocol fee: 100 * 5 / 10000 = 0.05 XLM = 500000 stroops
    expect(breakdown.protocolFee).toBe(500000n);

    // LP fee: 100 * 25 / 10000 = 0.25 XLM = 2500000 stroops
    expect(breakdown.lpFee).toBe(2500000n);

    // Total fees: 0.30 XLM = 3000000 stroops
    expect(breakdown.totalFees).toBe(3000000n);

    // Net amount: 100 - 0.30 = 99.70 XLM
    expect(breakdown.netAmount).toBe(99_7000000n);

    // Verify gross amount preserved
    expect(breakdown.grossAmount).toBe(amount);
  });

  it('should handle small amounts without losing precision', () => {
    const amount = 10000n; // 0.001 XLM
    const breakdown = calculateFeeBreakdown(amount);

    // Protocol fee: 10000 * 5 / 10000 = 5
    expect(breakdown.protocolFee).toBe(5n);
    // LP fee: 10000 * 25 / 10000 = 25
    expect(breakdown.lpFee).toBe(25n);
    expect(breakdown.totalFees).toBe(30n);
    expect(breakdown.netAmount).toBe(9970n);
  });

  it('should handle large amounts', () => {
    const amount = 1000000_0000000n; // 1M XLM
    const breakdown = calculateFeeBreakdown(amount);

    // Protocol fee: 1M * 5 / 10000 = 500 XLM
    expect(breakdown.protocolFee).toBe(500_0000000n);

    // LP fee: 1M * 25 / 10000 = 2500 XLM
    expect(breakdown.lpFee).toBe(2500_0000000n);

    // Total: 3000 XLM
    expect(breakdown.totalFees).toBe(3000_0000000n);

    // Net: 997,000 XLM
    expect(breakdown.netAmount).toBe(997000_0000000n);
  });

  it('should handle zero amount', () => {
    const breakdown = calculateFeeBreakdown(0n);

    expect(breakdown.protocolFee).toBe(0n);
    expect(breakdown.lpFee).toBe(0n);
    expect(breakdown.totalFees).toBe(0n);
    expect(breakdown.netAmount).toBe(0n);
  });

  it('should use custom fee rates', () => {
    const amount = 100_0000000n; // 100 XLM
    const customProtocolFee = 10n; // 0.10%
    const customLpFee = 50n; // 0.50%

    const breakdown = calculateFeeBreakdown(amount, customProtocolFee, customLpFee);

    expect(breakdown.protocolFee).toBe(1_000000n); // 0.10 XLM
    expect(breakdown.lpFee).toBe(5_000000n); // 0.50 XLM
    expect(breakdown.totalFees).toBe(6_000000n); // 0.60 XLM
    expect(breakdown.netAmount).toBe(99_4000000n); // 99.40 XLM
  });
});

describe('formatFeeBps', () => {
  it('should format default fees correctly', () => {
    expect(formatFeeBps(DEFAULT_PROTOCOL_FEE_BPS)).toBe('0.05%');
    expect(formatFeeBps(DEFAULT_LP_FEE_BPS)).toBe('0.25%');
    expect(formatFeeBps(DEFAULT_TOTAL_FEE_BPS)).toBe('0.30%');
  });

  it('should format various fee values', () => {
    expect(formatFeeBps(100n)).toBe('1.00%');
    expect(formatFeeBps(50)).toBe('0.50%');
    expect(formatFeeBps(1)).toBe('0.01%');
  });
});

// ============================================================================
// Buy Output Tests
// ============================================================================

describe('calculateBuyOutput (without fees)', () => {
  it('should calculate correct tokens for XLM input', () => {
    // Buy with 10 XLM into standard curve
    const xlmInput = 10_0000000n; // 10 XLM
    const result = calculateBuyOutput(STANDARD_CURVE, xlmInput);

    // Formula: tokens_out = token_reserve - (k / (xlm_reserve + xlm_in))
    // tokens_out = 1M - (1000 * 1M / (1000 + 10))
    // tokens_out = 1M - (1B / 1010)
    // tokens_out = 1M - 990099.0099...
    // tokens_out ≈ 9900.99 tokens

    expect(result.amountOut).toBeGreaterThan(0n);
    expect(result.priceImpact).toBeGreaterThan(0);
    expect(result.priceImpact).toBeLessThan(100);
  });

  it('should return zero for zero input', () => {
    const result = calculateBuyOutput(STANDARD_CURVE, 0n);
    expect(result.amountOut).toBe(0n);
  });

  it('should handle invalid curve state', () => {
    const invalidCurve = { xlm_reserve: '0', token_reserve: '0', k: '0' };
    const result = calculateBuyOutput(invalidCurve, 100n);
    expect(result.amountOut).toBe(0n);
  });

  it('should calculate increasing tokens out for increasing input', () => {
    const result1 = calculateBuyOutput(STANDARD_CURVE, 10_0000000n);
    const result2 = calculateBuyOutput(STANDARD_CURVE, 20_0000000n);
    const result3 = calculateBuyOutput(STANDARD_CURVE, 50_0000000n);

    expect(result2.amountOut).toBeGreaterThan(result1.amountOut);
    expect(result3.amountOut).toBeGreaterThan(result2.amountOut);
  });

  it('should show diminishing returns (bonding curve property)', () => {
    // Due to constant product, doubling input should NOT double output
    const result1 = calculateBuyOutput(STANDARD_CURVE, 10_0000000n);
    const result2 = calculateBuyOutput(STANDARD_CURVE, 20_0000000n);

    // result2 should be less than 2x result1
    expect(result2.amountOut).toBeLessThan(result1.amountOut * 2n);
  });
});

describe('calculateBuyOutputWithFees', () => {
  it('should return less tokens than without fees', () => {
    const xlmInput = 100_0000000n; // 100 XLM

    const withoutFees = calculateBuyOutput(STANDARD_CURVE, xlmInput);
    const withFees = calculateBuyOutputWithFees(STANDARD_CURVE, xlmInput);

    expect(withFees.amountOut).toBeLessThan(withoutFees.amountOut);
    expect(withFees.feeBreakdown.totalFees).toBeGreaterThan(0n);
  });

  it('should match manual fee calculation', () => {
    const xlmInput = 100_0000000n; // 100 XLM

    // Manual calculation
    const feeBreakdown = calculateFeeBreakdown(xlmInput);
    const manualResult = calculateBuyOutput(STANDARD_CURVE, feeBreakdown.netAmount);

    // With fees calculation
    const withFees = calculateBuyOutputWithFees(STANDARD_CURVE, xlmInput);

    expect(withFees.amountOut).toBe(manualResult.amountOut);
    expect(withFees.feeBreakdown.netAmount).toBe(feeBreakdown.netAmount);
  });
});

// ============================================================================
// Sell Output Tests
// ============================================================================

describe('calculateSellOutput (without fees)', () => {
  it('should calculate correct XLM for token input', () => {
    const tokenInput = 10000_0000000n; // 10,000 tokens
    const result = calculateSellOutput(STANDARD_CURVE, tokenInput);

    expect(result.amountOut).toBeGreaterThan(0n);
    expect(result.priceImpact).toBeGreaterThan(0);
  });

  it('should return zero for zero input', () => {
    const result = calculateSellOutput(STANDARD_CURVE, 0n);
    expect(result.amountOut).toBe(0n);
  });

  it('should show correct inverse relationship with buy', () => {
    // If I buy X tokens for Y XLM, selling X tokens should give ~Y XLM back
    // (approximately, because price moves)
    // Note: Due to rounding in integer math, you might get slightly MORE back
    const xlmInput = 10_0000000n;
    const buyResult = calculateBuyOutput(STANDARD_CURVE, xlmInput);

    // Create curve state after buy
    const newXlmReserve = BigInt(STANDARD_CURVE.xlm_reserve) + xlmInput;
    const newTokenReserve = BigInt(STANDARD_CURVE.token_reserve) - buyResult.amountOut;
    const curveAfterBuy = createCurve(newXlmReserve, newTokenReserve);

    // Sell the tokens we bought
    const sellResult = calculateSellOutput(curveAfterBuy, buyResult.amountOut);

    // Should get back approximately the same (within 0.1% due to rounding)
    const diff = sellResult.amountOut > xlmInput
      ? sellResult.amountOut - xlmInput
      : xlmInput - sellResult.amountOut;
    const percentDiff = Number(diff * 10000n / xlmInput); // basis points
    expect(percentDiff).toBeLessThan(10); // Within 0.1%
  });
});

describe('calculateSellOutputWithFees', () => {
  it('should return less XLM than without fees', () => {
    const tokenInput = 10000_0000000n;

    const withoutFees = calculateSellOutput(STANDARD_CURVE, tokenInput);
    const withFees = calculateSellOutputWithFees(STANDARD_CURVE, tokenInput);

    expect(withFees.amountOut).toBeLessThan(withoutFees.amountOut);
    expect(withFees.feeBreakdown.totalFees).toBeGreaterThan(0n);
  });

  it('should deduct fees from output (not input)', () => {
    const tokenInput = 10000_0000000n;

    const grossResult = calculateSellOutput(STANDARD_CURVE, tokenInput);
    const withFees = calculateSellOutputWithFees(STANDARD_CURVE, tokenInput);

    // Fees should be calculated on gross XLM output
    expect(withFees.feeBreakdown.grossAmount).toBe(grossResult.amountOut);
    expect(withFees.amountOut).toBe(withFees.feeBreakdown.netAmount);
  });
});

// ============================================================================
// Price Calculation Tests
// ============================================================================

describe('getCurrentPrice', () => {
  it('should calculate correct spot price', () => {
    const price = getCurrentPrice(STANDARD_CURVE);

    // Price = xlm_reserve / token_reserve * 10^7
    // = 1000 * 10^7 / 1000000 * 10^7
    // = 1000 / 1000000 * 10^7 = 0.001 * 10^7 = 10000
    expect(price).toBe(10000n); // 0.001 XLM per token
  });

  it('should increase price when tokens are bought', () => {
    const priceBefore = getCurrentPrice(STANDARD_CURVE);

    // Simulate buy: more XLM, fewer tokens
    const curveAfterBuy = createCurve(
      1100_0000000n, // +100 XLM
      909090_0000000n // fewer tokens
    );

    const priceAfter = getCurrentPrice(curveAfterBuy);
    expect(priceAfter).toBeGreaterThan(priceBefore);
  });
});

// ============================================================================
// Slippage Tests
// ============================================================================

describe('applySlippageTolerance', () => {
  it('should calculate minimum output correctly', () => {
    const amount = 1000n;
    const slippage = 1; // 1%

    const minOut = applySlippageTolerance(amount, slippage, true);
    expect(minOut).toBe(990n); // 1000 * 0.99
  });

  it('should calculate maximum input correctly', () => {
    const amount = 1000n;
    const slippage = 1; // 1%

    const maxIn = applySlippageTolerance(amount, slippage, false);
    expect(maxIn).toBe(1010n); // 1000 * 1.01
  });

  it('should handle fractional slippage', () => {
    const amount = 10000n;
    const slippage = 0.5; // 0.5%

    const minOut = applySlippageTolerance(amount, slippage, true);
    expect(minOut).toBe(9950n); // 10000 * 0.995
  });

  it('should handle zero slippage', () => {
    const amount = 1000n;
    const result = applySlippageTolerance(amount, 0, true);
    expect(result).toBe(amount);
  });
});

// ============================================================================
// Graduation Progress Tests
// ============================================================================

describe('calculateGraduationProgress', () => {
  it('should return 0 for no XLM raised', () => {
    const progress = calculateGraduationProgress(0n);
    expect(progress).toBe(0);
  });

  it('should return 10000 (100%) at threshold', () => {
    const threshold = 100_000_000_000n; // 10,000 XLM default
    const progress = calculateGraduationProgress(threshold);
    expect(progress).toBe(10000);
  });

  it('should cap at 10000 above threshold', () => {
    const threshold = 100_000_000_000n;
    const progress = calculateGraduationProgress(threshold * 2n);
    expect(progress).toBe(10000);
  });

  it('should calculate partial progress correctly', () => {
    const threshold = 100_000_000_000n; // 10,000 XLM
    const raised = 50_000_000_000n; // 5,000 XLM = 50%

    const progress = calculateGraduationProgress(raised, threshold);
    expect(progress).toBe(5000); // 50% = 5000 bps
  });
});

// ============================================================================
// Trade Invariant Validation Tests
// ============================================================================

describe('validateTradeInvariant', () => {
  it('should validate correct buy trade', () => {
    const xlmIn = 10_0000000n;
    const buyResult = calculateBuyOutput(STANDARD_CURVE, xlmIn);

    const isValid = validateTradeInvariant(
      STANDARD_CURVE,
      xlmIn, // XLM increases
      -buyResult.amountOut // Tokens decrease
    );

    expect(isValid).toBe(true);
  });

  it('should validate correct sell trade', () => {
    const tokensIn = 10000_0000000n;
    const sellResult = calculateSellOutput(STANDARD_CURVE, tokensIn);

    const isValid = validateTradeInvariant(
      STANDARD_CURVE,
      -sellResult.amountOut, // XLM decreases
      tokensIn // Tokens increase
    );

    expect(isValid).toBe(true);
  });

  it('should reject invalid trade that breaks invariant', () => {
    // Try to get tokens without providing enough XLM
    const isValid = validateTradeInvariant(
      STANDARD_CURVE,
      1_0000000n, // Only 1 XLM
      -100000_0000000n // But want 100k tokens
    );

    expect(isValid).toBe(false);
  });
});

// ============================================================================
// Inverse Calculation Tests
// ============================================================================

describe('calculateRequiredXlmForTokens', () => {
  it('should calculate correct XLM for desired tokens', () => {
    const desiredTokens = 10000_0000000n;
    const requiredXlm = calculateRequiredXlmForTokens(STANDARD_CURVE, desiredTokens);

    // Verify by doing a buy with the required XLM
    const buyResult = calculateBuyOutput(STANDARD_CURVE, requiredXlm);

    // Should get approximately the desired tokens (within small rounding tolerance)
    const diff = buyResult.amountOut > desiredTokens
      ? buyResult.amountOut - desiredTokens
      : desiredTokens - buyResult.amountOut;
    // Allow up to 0.01% tolerance due to integer rounding
    const tolerance = desiredTokens / 10000n;
    expect(diff).toBeLessThanOrEqual(tolerance);
  });

  it('should throw for tokens exceeding reserve', () => {
    const tooManyTokens = BigInt(STANDARD_CURVE.token_reserve) + 1n;

    expect(() => calculateRequiredXlmForTokens(STANDARD_CURVE, tooManyTokens)).toThrow();
  });
});

describe('calculateRequiredTokensForXlm', () => {
  it('should calculate correct tokens for desired XLM', () => {
    const desiredXlm = 10_0000000n;
    const requiredTokens = calculateRequiredTokensForXlm(STANDARD_CURVE, desiredXlm);

    // Verify by doing a sell with the required tokens
    const sellResult = calculateSellOutput(STANDARD_CURVE, requiredTokens);

    // Should get at least the desired XLM
    expect(sellResult.amountOut).toBeGreaterThanOrEqual(desiredXlm - 1n);
  });

  it('should throw for XLM exceeding reserve', () => {
    const tooMuchXlm = BigInt(STANDARD_CURVE.xlm_reserve) + 1n;

    expect(() => calculateRequiredTokensForXlm(STANDARD_CURVE, tooMuchXlm)).toThrow();
  });
});

// ============================================================================
// Edge Cases and Precision Tests
// ============================================================================

describe('Precision Edge Cases', () => {
  it('should handle very small amounts (dust)', () => {
    const dustAmount = 1n; // 1 stroop

    // Even 1 stroop can still calculate token output (though tiny)
    const buyResult = calculateBuyOutput(STANDARD_CURVE, dustAmount);
    // In a standard curve with 1000 XLM : 1M tokens, 1 stroop gets ~1000 tokens
    expect(buyResult.amountOut).toBeGreaterThanOrEqual(0n);

    // Fee breakdown: 1 * 5 / 10000 = 0, 1 * 25 / 10000 = 0
    const feeBreakdown = calculateFeeBreakdown(dustAmount);
    expect(feeBreakdown.protocolFee).toBe(0n);
    expect(feeBreakdown.lpFee).toBe(0n);
    expect(feeBreakdown.netAmount).toBe(dustAmount); // No fees deducted
  });

  it('should handle maximum precision (7 decimals)', () => {
    // 1.2345678 XLM = 12345678 stroops
    const preciseAmount = 12345678n;
    const breakdown = calculateFeeBreakdown(preciseAmount);

    // Total should equal parts
    expect(breakdown.protocolFee + breakdown.lpFee).toBe(breakdown.totalFees);
    expect(breakdown.grossAmount - breakdown.totalFees).toBe(breakdown.netAmount);
  });

  it('should handle very large amounts without overflow', () => {
    // 1 billion XLM (larger than total XLM supply)
    const hugeAmount = 1_000_000_000_0000000n;
    const breakdown = calculateFeeBreakdown(hugeAmount);

    expect(breakdown.netAmount).toBeLessThan(breakdown.grossAmount);
    expect(breakdown.totalFees).toBeGreaterThan(0n);
  });

  it('should maintain fee ratio regardless of amount size', () => {
    const small = calculateFeeBreakdown(100_0000000n); // 100 XLM
    const large = calculateFeeBreakdown(10000_0000000n); // 10,000 XLM

    // Fee ratio should be consistent (within rounding error)
    const smallRatio = Number(small.totalFees * 10000n / small.grossAmount);
    const largeRatio = Number(large.totalFees * 10000n / large.grossAmount);

    expect(Math.abs(smallRatio - largeRatio)).toBeLessThan(1); // Within 1 bps
  });
});

describe('K Invariant Preservation', () => {
  it('should maintain k = x * y after buy', () => {
    const xlmIn = 50_0000000n;
    const buyResult = calculateBuyOutput(STANDARD_CURVE, xlmIn);

    const newXlm = BigInt(STANDARD_CURVE.xlm_reserve) + xlmIn;
    const newTokens = BigInt(STANDARD_CURVE.token_reserve) - buyResult.amountOut;
    const newK = newXlm * newTokens;
    const originalK = BigInt(STANDARD_CURVE.k);

    // K should be preserved (within small rounding tolerance)
    const tolerance = originalK / 10000n; // 0.01% tolerance
    expect(newK).toBeGreaterThanOrEqual(originalK - tolerance);
    expect(newK).toBeLessThanOrEqual(originalK + tolerance);
  });

  it('should maintain k = x * y after sell', () => {
    const tokensIn = 50000_0000000n;
    const sellResult = calculateSellOutput(STANDARD_CURVE, tokensIn);

    const newXlm = BigInt(STANDARD_CURVE.xlm_reserve) - sellResult.amountOut;
    const newTokens = BigInt(STANDARD_CURVE.token_reserve) + tokensIn;
    const newK = newXlm * newTokens;
    const originalK = BigInt(STANDARD_CURVE.k);

    // K should be preserved
    const tolerance = originalK / 10000n;
    expect(newK).toBeGreaterThanOrEqual(originalK - tolerance);
    expect(newK).toBeLessThanOrEqual(originalK + tolerance);
  });
});
