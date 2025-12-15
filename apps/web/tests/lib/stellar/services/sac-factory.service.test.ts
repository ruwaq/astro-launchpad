/**
 * SAC Factory Service Tests
 *
 * Tests contract interaction methods, bonding curve calculations,
 * transaction building, and fee computations.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  SacFactoryService,
  toStroopsBigInt,
  TokenStatus,
  type TokenInfo,
  type BondingCurve,
} from '@/lib/stellar/services/sac-factory.service';

// Mock base contract service
vi.mock('@/lib/stellar/services/base-contract.service', () => ({
  BaseContractService: class {
    contractId: string;
    constructor(contractId: string) {
      this.contractId = contractId;
    }
    callReadOnly = vi.fn();
    buildOperation = vi.fn();
    prepareTransaction = vi.fn();
    submitSignedTransaction = vi.fn();
  },
}));

vi.mock('@/lib/stellar/config', () => ({
  CONTRACT_IDS: {
    tokenFactory: 'CTEST123',
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('SacFactoryService', () => {
  let service: SacFactoryService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SacFactoryService();
  });

  describe('toStroopsBigInt - Precision Utilities', () => {
    it('should convert integer to stroops', () => {
      expect(toStroopsBigInt(1)).toBe(BigInt(10_000_000));
      expect(toStroopsBigInt(100)).toBe(BigInt(1_000_000_000));
    });

    it('should convert decimal to stroops without precision loss', () => {
      expect(toStroopsBigInt(1.2345678)).toBe(BigInt(12_345_678));
      expect(toStroopsBigInt(0.1)).toBe(BigInt(1_000_000));
    });

    it('should handle string input', () => {
      expect(toStroopsBigInt('1.5')).toBe(BigInt(15_000_000));
      expect(toStroopsBigInt('100.25')).toBe(BigInt(1_002_500_000));
    });

    it('should truncate extra decimals', () => {
      expect(toStroopsBigInt(1.23456789)).toBe(BigInt(12_345_678)); // 8th decimal truncated
    });

    it('should pad missing decimals', () => {
      expect(toStroopsBigInt(1.5)).toBe(BigInt(15_000_000));
      expect(toStroopsBigInt(1)).toBe(BigInt(10_000_000));
    });

    it('should handle zero', () => {
      expect(toStroopsBigInt(0)).toBe(BigInt(0));
      expect(toStroopsBigInt('0')).toBe(BigInt(0));
    });

    it('should handle negative numbers', () => {
      expect(toStroopsBigInt(-1.5)).toBe(BigInt(-15_000_000));
      expect(toStroopsBigInt('-10.25')).toBe(BigInt(-102_500_000));
    });

    it('should handle very small amounts', () => {
      expect(toStroopsBigInt(0.0000001)).toBe(BigInt(1)); // 1 stroop
    });

    it('should handle very large amounts', () => {
      expect(toStroopsBigInt(999999999)).toBe(BigInt(9_999_999_990_000_000));
    });

    it('should handle custom decimals', () => {
      expect(toStroopsBigInt(1, 2)).toBe(BigInt(100));
      expect(toStroopsBigInt(1.5, 2)).toBe(BigInt(150));
    });

    it('should avoid floating-point precision errors', () => {
      // 0.1 + 0.2 = 0.30000000000000004 in JavaScript
      // Our implementation should handle this correctly
      const amount1 = 0.1;
      const amount2 = 0.2;
      const sum = amount1 + amount2;

      // Direct calculation would fail
      // toStroopsBigInt should handle it correctly
      expect(toStroopsBigInt(sum)).toBe(BigInt(3_000_000));
    });
  });

  describe('Bonding Curve Calculations', () => {
    const mockBondingCurve: BondingCurve = {
      xlm_reserve: '10000000000', // 1000 XLM
      token_reserve: '800000000000000', // 80M tokens
      k: '8000000000000000000000', // k = x * y
    };

    const mockTokenInfo: TokenInfo = {
      id: 1,
      creator: 'GXXX',
      token_address: 'CTEST',
      name: 'Test',
      symbol: 'TEST',
      issuer: 'GXXX',
      image_url: '',
      description: '',
      created_at: Date.now(),
      status: TokenStatus.Bonding,
      bonding_curve: mockBondingCurve,
      xlm_raised: '5000000000',
      market_cap: '15000000000',
      holders_count: 10,
    };

    describe('calculateBuyOutput', () => {
      it('should calculate tokens received for XLM input', () => {
        const xlmAmount = BigInt(1_000_000_000); // 100 XLM

        const result = service.calculateBuyOutput(mockTokenInfo, xlmAmount);

        expect(result).toBeGreaterThan(BigInt(0));
      });

      it('should return zero for zero input', () => {
        const result = service.calculateBuyOutput(mockTokenInfo, BigInt(0));

        expect(result).toBe(BigInt(0));
      });

      it('should handle small amounts', () => {
        const xlmAmount = BigInt(100_000); // 0.01 XLM

        const result = service.calculateBuyOutput(mockTokenInfo, xlmAmount);

        expect(result).toBeGreaterThan(BigInt(0));
      });
    });

    describe('calculateSellOutput', () => {
      it('should calculate XLM received for token input', () => {
        const tokenAmount = BigInt(10_000_000_000); // 1000 tokens

        const result = service.calculateSellOutput(mockTokenInfo, tokenAmount);

        expect(result).toBeGreaterThan(BigInt(0));
      });

      it('should return zero for zero input', () => {
        const result = service.calculateSellOutput(mockTokenInfo, BigInt(0));

        expect(result).toBe(BigInt(0));
      });
    });

    describe('calculateBuyOutputNet (with fees)', () => {
      it('should return net tokens after fees', () => {
        const xlmAmount = BigInt(1_000_000_000); // 100 XLM

        const { tokensOut, feeBreakdown } = service.calculateBuyOutputNet(mockTokenInfo, xlmAmount);

        expect(tokensOut).toBeGreaterThan(BigInt(0));
        expect(feeBreakdown.totalFees).toBeGreaterThan(BigInt(0));
        expect(feeBreakdown.protocolFee).toBeGreaterThan(BigInt(0));
        expect(feeBreakdown.lpFee).toBeGreaterThan(BigInt(0));
        expect(feeBreakdown.netAmount).toBeLessThan(feeBreakdown.grossAmount);
      });

      it('should have protocol fee (0.05%) less than LP fee (0.25%)', () => {
        const xlmAmount = BigInt(1_000_000_000);

        const { feeBreakdown } = service.calculateBuyOutputNet(mockTokenInfo, xlmAmount);

        expect(feeBreakdown.protocolFee).toBeLessThan(feeBreakdown.lpFee);
      });

      it('should have total fees equal to sum of protocol and LP fees', () => {
        const xlmAmount = BigInt(1_000_000_000);

        const { feeBreakdown } = service.calculateBuyOutputNet(mockTokenInfo, xlmAmount);

        expect(feeBreakdown.totalFees).toBe(feeBreakdown.protocolFee + feeBreakdown.lpFee);
      });
    });

    describe('calculateSellOutputNet (with fees)', () => {
      it('should return net XLM after fees', () => {
        const tokenAmount = BigInt(10_000_000_000);

        const { xlmOut, feeBreakdown } = service.calculateSellOutputNet(mockTokenInfo, tokenAmount);

        expect(xlmOut).toBeGreaterThan(BigInt(0));
        expect(feeBreakdown.totalFees).toBeGreaterThan(BigInt(0));
        expect(xlmOut).toBeLessThan(feeBreakdown.grossAmount);
      });
    });
  });

  describe('ASTRO Integration', () => {
    describe('calculateAstroAllocation', () => {
      it('should allocate XLM correctly for graduation', () => {
        const totalXlm = BigInt(30_000_000_000); // 3000 XLM
        const liquidityBps = 1000; // 10%
        const buybackBps = 500; // 5%

        const allocation = service.calculateAstroAllocation(totalXlm, liquidityBps, buybackBps);

        // Main pool: 85%
        expect(BigInt(allocation.xlm_for_main_pool)).toBe(BigInt(25_500_000_000));
        // ASTRO liquidity: 10%
        expect(BigInt(allocation.xlm_for_astro_liquidity)).toBe(BigInt(3_000_000_000));
        // Buyback: 5%
        expect(BigInt(allocation.xlm_for_buyback)).toBe(BigInt(1_500_000_000));
      });

      it('should use default BPS values', () => {
        const totalXlm = BigInt(10_000_000_000);

        const allocation = service.calculateAstroAllocation(totalXlm);

        const sum =
          BigInt(allocation.xlm_for_main_pool) +
          BigInt(allocation.xlm_for_astro_liquidity) +
          BigInt(allocation.xlm_for_buyback);

        expect(sum).toBe(totalXlm);
      });

      it('should handle zero XLM', () => {
        const allocation = service.calculateAstroAllocation(BigInt(0));

        expect(BigInt(allocation.xlm_for_main_pool)).toBe(BigInt(0));
        expect(BigInt(allocation.xlm_for_astro_liquidity)).toBe(BigInt(0));
        expect(BigInt(allocation.xlm_for_buyback)).toBe(BigInt(0));
      });
    });

    describe('getAstroAllocationPercentages', () => {
      it('should return percentage strings', () => {
        const percentages = service.getAstroAllocationPercentages(1000, 500);

        expect(percentages.mainPool).toBe('85%');
        expect(percentages.astroLiquidity).toBe('10%');
        expect(percentages.buyback).toBe('5%');
      });

      it('should sum to 100%', () => {
        const percentages = service.getAstroAllocationPercentages();

        const total =
          parseInt(percentages.mainPool) +
          parseInt(percentages.astroLiquidity) +
          parseInt(percentages.buyback);

        expect(total).toBe(100);
      });
    });
  });

  describe('Fee Calculations', () => {
    describe('applyTradingFee', () => {
      it('should apply 0.3% total fee by default', () => {
        const amount = BigInt(10_000_000_000); // 1000 XLM
        const afterFee = service.applyTradingFee(amount);

        // 0.3% of 1000 = 3 XLM
        expect(afterFee).toBe(BigInt(9_970_000_000)); // 997 XLM
      });

      it('should apply custom fee in basis points', () => {
        const amount = BigInt(10_000_000_000); // 1000 XLM
        const feeBps = BigInt(100); // 1%
        const afterFee = service.applyTradingFee(amount, feeBps);

        // 1% of 1000 = 10 XLM
        expect(afterFee).toBe(BigInt(9_900_000_000)); // 990 XLM
      });

      it('should handle zero amount', () => {
        const afterFee = service.applyTradingFee(BigInt(0));

        expect(afterFee).toBe(BigInt(0));
      });

      it('should handle zero fee', () => {
        const amount = BigInt(10_000_000_000);
        const afterFee = service.applyTradingFee(amount, BigInt(0));

        expect(afterFee).toBe(amount);
      });
    });

    describe('getFeeBreakdown', () => {
      it('should provide detailed fee breakdown', () => {
        const amount = BigInt(10_000_000_000); // 1000 XLM

        const breakdown = service.getFeeBreakdown(amount);

        expect(breakdown.grossAmount).toBe(amount);
        expect(breakdown.protocolFee).toBeGreaterThan(BigInt(0));
        expect(breakdown.lpFee).toBeGreaterThan(BigInt(0));
        expect(breakdown.totalFees).toBe(breakdown.protocolFee + breakdown.lpFee);
        expect(breakdown.netAmount).toBe(amount - breakdown.totalFees);
      });

      it('should have protocol fee (0.05%) less than LP fee (0.25%)', () => {
        const amount = BigInt(10_000_000_000);

        const breakdown = service.getFeeBreakdown(amount);

        expect(breakdown.protocolFee).toBeLessThan(breakdown.lpFee);
      });

      it('should have correct fee ratio (1:5 protocol:LP)', () => {
        const amount = BigInt(10_000_000_000);

        const breakdown = service.getFeeBreakdown(amount);

        // Protocol fee should be 1/5 of LP fee (5 bps vs 25 bps)
        expect(breakdown.lpFee).toBe(breakdown.protocolFee * BigInt(5));
      });
    });
  });

  describe('Operation Building', () => {
    describe('buildLaunchTokenV2Operation', () => {
      it('should build launch operation with valid params', () => {
        const params = {
          name: 'Test Token',
          symbol: 'TEST',
          imageUrl: 'https://example.com/image.png',
          description: 'Test description',
        };

        expect(() => {
          service.buildLaunchTokenV2Operation(params, 'GXXX');
        }).not.toThrow();
      });

      it('should throw for invalid name', () => {
        const params = {
          name: '', // Empty name
          symbol: 'TEST',
          imageUrl: 'https://example.com/image.png',
          description: 'Test',
        };

        expect(() => {
          service.buildLaunchTokenV2Operation(params, 'GXXX');
        }).toThrow('Name must be 1-32 characters');
      });

      it('should throw for invalid symbol', () => {
        const params = {
          name: 'Test Token',
          symbol: '', // Empty symbol
          imageUrl: 'https://example.com/image.png',
          description: 'Test',
        };

        expect(() => {
          service.buildLaunchTokenV2Operation(params, 'GXXX');
        }).toThrow('Symbol must be 1-12 alphanumeric characters (uppercase)');
      });

      it('should embed social links in metadata', () => {
        const params = {
          name: 'Test Token',
          symbol: 'TEST',
          imageUrl: 'https://example.com/image.png',
          description: 'Test',
          twitter: 'https://twitter.com/test',
          telegram: 'https://t.me/test',
        };

        expect(() => {
          service.buildLaunchTokenV2Operation(params, 'GXXX');
        }).not.toThrow();
      });
    });

    describe('buildBuyOperation', () => {
      it('should build buy operation', () => {
        expect(() => {
          service.buildBuyOperation(
            'GXXX',
            'CTEST',
            BigInt(100_000_000),
            BigInt(1_000_000),
            BigInt(Date.now() + 300000)
          );
        }).not.toThrow();
      });
    });

    describe('buildSellOperation', () => {
      it('should build sell operation', () => {
        expect(() => {
          service.buildSellOperation(
            'GXXX',
            'CTEST',
            BigInt(10_000_000),
            BigInt(90_000_000),
            BigInt(Date.now() + 300000)
          );
        }).not.toThrow();
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle very large numbers', () => {
      const largeAmount = BigInt('999999999999999999');

      const afterFee = service.applyTradingFee(largeAmount);

      expect(afterFee).toBeLessThan(largeAmount);
    });

    it('should handle very small numbers', () => {
      const smallAmount = BigInt(1);

      const afterFee = service.applyTradingFee(smallAmount);

      // Even with 0.3% fee, 1 stroop should result in 0 or 1
      expect(afterFee).toBeLessThanOrEqual(smallAmount);
    });

    it('should convert floating-point edge cases correctly', () => {
      // Test edge case: 0.1 + 0.2 = 0.30000000000000004
      const problematicSum = 0.1 + 0.2;
      const result = toStroopsBigInt(problematicSum);

      // Should be exactly 3M stroops (0.3 XLM)
      expect(result).toBe(BigInt(3_000_000));
    });

    it('should handle negative zero', () => {
      const result = toStroopsBigInt(-0);

      expect(result).toBe(BigInt(0));
    });

    it('should truncate, not round', () => {
      // 1.9999999 should become 1.999999 (7 decimals), not 2.0
      const result = toStroopsBigInt(1.9999999);

      expect(result).toBe(BigInt(19_999_999));
      expect(result).not.toBe(BigInt(20_000_000));
    });
  });

  describe('Type Safety', () => {
    it('should handle BigInt operations safely', () => {
      const amount = BigInt(10_000_000_000);
      const fee = service.applyTradingFee(amount);

      // Verify BigInt operations don't lose precision
      expect(typeof fee).toBe('bigint');
      expect(fee).toBeLessThan(amount);
    });

    it('should handle string to BigInt conversions', () => {
      const stringAmount = '10000000000';
      const bigIntAmount = BigInt(stringAmount);
      const fee = service.applyTradingFee(bigIntAmount);

      expect(fee).toBeLessThan(bigIntAmount);
    });
  });
});
