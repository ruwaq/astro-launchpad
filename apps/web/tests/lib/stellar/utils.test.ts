/**
 * Tests for Stellar Utility Functions
 *
 * Tests pure functions without Stellar SDK dependencies.
 * SDK-dependent functions are tested separately with mocks.
 */

import { describe, it, expect } from 'vitest';
import {
  STELLAR_DECIMALS,
  STROOPS_PER_XLM,
  GRADUATION_THRESHOLD_XLM,
  GRADUATION_THRESHOLD_STROOPS,
  stroopsToXlm,
  xlmToStroops,
  formatXlmDisplay,
  formatStroopsDisplay,
  formatAmount,
  formatCurrency,
  formatCompactNumber,
  truncateAddress,
  getTimeAgo,
  getErrorMessage,
  applySlippage,
} from '@/lib/stellar/utils';

describe('Stellar Utils - Constants', () => {
  it('should have correct STELLAR_DECIMALS', () => {
    expect(STELLAR_DECIMALS).toBe(7);
  });

  it('should have correct STROOPS_PER_XLM', () => {
    expect(STROOPS_PER_XLM).toBe(10_000_000n);
  });

  it('should have correct GRADUATION_THRESHOLD_XLM', () => {
    expect(GRADUATION_THRESHOLD_XLM).toBe(30_000);
  });

  it('should have correct GRADUATION_THRESHOLD_STROOPS', () => {
    expect(GRADUATION_THRESHOLD_STROOPS).toBe(300_000_000_000n);
  });

  it('should have consistent graduation thresholds', () => {
    // 30,000 XLM * 10,000,000 stroops/XLM = 300,000,000,000 stroops
    expect(BigInt(GRADUATION_THRESHOLD_XLM) * STROOPS_PER_XLM).toBe(
      GRADUATION_THRESHOLD_STROOPS
    );
  });
});

describe('stroopsToXlm', () => {
  it('should convert whole XLM amounts correctly', () => {
    expect(stroopsToXlm(10_000_000n)).toBe('1');
    expect(stroopsToXlm(100_000_000n)).toBe('10');
    expect(stroopsToXlm(1_000_000_000n)).toBe('100');
  });

  it('should convert fractional amounts correctly', () => {
    expect(stroopsToXlm(5_000_000n)).toBe('0.5');
    expect(stroopsToXlm(1_000_000n)).toBe('0.1');
    expect(stroopsToXlm(100_000n)).toBe('0.01');
    expect(stroopsToXlm(1n)).toBe('0.0000001');
  });

  it('should handle mixed amounts', () => {
    expect(stroopsToXlm(12_345_678n)).toBe('1.2345678');
    expect(stroopsToXlm(99_999_999n)).toBe('9.9999999');
  });

  it('should handle string input', () => {
    expect(stroopsToXlm('10000000')).toBe('1');
    expect(stroopsToXlm('5000000')).toBe('0.5');
  });

  it('should handle number input', () => {
    expect(stroopsToXlm(10000000)).toBe('1');
    expect(stroopsToXlm(5000000)).toBe('0.5');
  });

  it('should handle negative amounts', () => {
    expect(stroopsToXlm(-10_000_000n)).toBe('-1');
    expect(stroopsToXlm(-5_000_000n)).toBe('-0.5');
  });

  it('should respect maxDecimals parameter', () => {
    expect(stroopsToXlm(12_345_678n, 2)).toBe('1.23');
    expect(stroopsToXlm(12_345_678n, 4)).toBe('1.2345');
  });

  it('should handle zero', () => {
    expect(stroopsToXlm(0n)).toBe('0');
    expect(stroopsToXlm(0)).toBe('0');
    expect(stroopsToXlm('0')).toBe('0');
  });

  it('should trim trailing zeros', () => {
    expect(stroopsToXlm(10_000_000n)).toBe('1');
    expect(stroopsToXlm(15_000_000n)).toBe('1.5');
  });
});

describe('xlmToStroops', () => {
  it('should convert whole XLM amounts', () => {
    expect(xlmToStroops('1')).toBe('10000000');
    expect(xlmToStroops('10')).toBe('100000000');
    expect(xlmToStroops('100')).toBe('1000000000');
  });

  it('should convert fractional amounts', () => {
    expect(xlmToStroops('0.5')).toBe('5000000');
    expect(xlmToStroops('0.1')).toBe('1000000');
    expect(xlmToStroops('0.0000001')).toBe('1');
  });

  it('should handle mixed amounts', () => {
    expect(xlmToStroops('1.5')).toBe('15000000');
    expect(xlmToStroops('1.2345678')).toBe('12345678');
  });

  it('should handle number input', () => {
    expect(xlmToStroops(1)).toBe('10000000');
    expect(xlmToStroops(1.5)).toBe('15000000');
  });

  it('should handle zero', () => {
    expect(xlmToStroops('0')).toBe('0');
    expect(xlmToStroops(0)).toBe('0');
  });

  it('should truncate beyond 7 decimals', () => {
    expect(xlmToStroops('1.12345678')).toBe('11234567');
  });

  it('should round trip correctly', () => {
    const original = '123.4567890';
    const stroops = xlmToStroops(original);
    const backToXlm = stroopsToXlm(BigInt(stroops));
    expect(backToXlm).toBe('123.456789');
  });
});

describe('formatXlmDisplay', () => {
  it('should format with default options', () => {
    expect(formatXlmDisplay('1234.567')).toBe('1,234.567');
  });

  it('should respect maxDecimals', () => {
    expect(formatXlmDisplay('1.2345678', { maxDecimals: 2 })).toBe('1.23');
    expect(formatXlmDisplay('1.2345678', { maxDecimals: 4 })).toBe('1.2346');
  });

  it('should handle NaN input', () => {
    expect(formatXlmDisplay('not-a-number')).toBe('0');
  });

  it('should handle number input', () => {
    expect(formatXlmDisplay(1234.567)).toBe('1,234.567');
  });

  it('should add thousands separators', () => {
    expect(formatXlmDisplay('1000000')).toBe('1,000,000');
  });
});

describe('formatStroopsDisplay', () => {
  it('should convert and format stroops', () => {
    expect(formatStroopsDisplay(10_000_000n)).toBe('1');
  });

  it('should handle compact mode', () => {
    // 10B stroops = 1000 XLM, formatCompactNumber uses .toFixed(1) for K
    expect(formatStroopsDisplay(10_000_000_000n, { compact: true })).toBe('1.0K');
  });
});

describe('formatAmount', () => {
  it('should format with default decimals', () => {
    expect(formatAmount('123.4567890')).toBe('123.456789');
  });

  it('should respect custom decimals', () => {
    expect(formatAmount('123.456', 2)).toBe('123.46');
  });

  it('should handle NaN', () => {
    expect(formatAmount('invalid')).toBe('0');
  });

  it('should trim trailing zeros', () => {
    expect(formatAmount('123.4000000')).toBe('123.4');
  });
});

describe('formatCurrency', () => {
  it('should format with thousands separators', () => {
    expect(formatCurrency('1234567.89')).toBe('1,234,567.89');
  });

  it('should respect custom decimals', () => {
    expect(formatCurrency('1234.5', 4)).toBe('1,234.5000');
  });

  it('should handle NaN', () => {
    expect(formatCurrency('invalid')).toBe('0');
  });
});

describe('formatCompactNumber', () => {
  it('should format numbers under 1000', () => {
    expect(formatCompactNumber(999)).toBe('999.00');
    expect(formatCompactNumber(0)).toBe('0.00');
    expect(formatCompactNumber(123.456)).toBe('123.46');
  });

  it('should format thousands', () => {
    expect(formatCompactNumber(1000)).toBe('1.0K');
    expect(formatCompactNumber(1500)).toBe('1.5K');
    expect(formatCompactNumber(999999)).toBe('1000.0K');
  });

  it('should format millions', () => {
    expect(formatCompactNumber(1000000)).toBe('1.00M');
    expect(formatCompactNumber(1500000)).toBe('1.50M');
    expect(formatCompactNumber(999999999)).toBe('1000.00M');
  });

  it('should format billions', () => {
    expect(formatCompactNumber(1000000000)).toBe('1.00B');
    expect(formatCompactNumber(1500000000)).toBe('1.50B');
  });

  it('should handle negative numbers', () => {
    expect(formatCompactNumber(-1000)).toBe('-1.0K');
    expect(formatCompactNumber(-1000000)).toBe('-1.00M');
  });
});

describe('truncateAddress', () => {
  it('should truncate long addresses', () => {
    const address = 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
    expect(truncateAddress(address)).toBe('GXXX...XXXX');
  });

  it('should respect custom char count', () => {
    // 17 chars: GABCDEFGHIJKLMNOP → first 6 + ... + last 6
    const address = 'GABCDEFGHIJKLMNOP';
    expect(truncateAddress(address, 6)).toBe('GABCDE...KLMNOP');
  });

  it('should handle empty string', () => {
    expect(truncateAddress('')).toBe('');
  });

  it('should not truncate short addresses', () => {
    expect(truncateAddress('GABCD', 4)).toBe('GABCD');
  });
});

describe('getTimeAgo', () => {
  const NOW = Math.floor(Date.now() / 1000);

  it('should return "just now" for recent times', () => {
    expect(getTimeAgo(NOW - 30)).toBe('just now');
  });

  it('should return minutes for under an hour', () => {
    expect(getTimeAgo(NOW - 120)).toBe('2m ago');
    expect(getTimeAgo(NOW - 3000)).toBe('50m ago');
  });

  it('should return hours for under a day', () => {
    expect(getTimeAgo(NOW - 7200)).toBe('2h ago');
    expect(getTimeAgo(NOW - 43200)).toBe('12h ago');
  });

  it('should return days for under a month', () => {
    expect(getTimeAgo(NOW - 172800)).toBe('2d ago');
    expect(getTimeAgo(NOW - 604800)).toBe('7d ago');
  });

  it('should return months for under a year', () => {
    expect(getTimeAgo(NOW - 5184000)).toBe('2mo ago');
  });

  it('should return years for over a year', () => {
    expect(getTimeAgo(NOW - 63072000)).toBe('2y ago');
  });
});

describe('getErrorMessage', () => {
  it('should return string errors directly', () => {
    expect(getErrorMessage('Test error')).toBe('Test error');
  });

  it('should extract Error message', () => {
    expect(getErrorMessage(new Error('Test error'))).toBe('Test error');
  });

  it('should handle objects with message property', () => {
    expect(getErrorMessage({ message: 'Object error' })).toBe('Object error');
  });

  it('should handle unknown errors', () => {
    expect(getErrorMessage(null)).toBe('An unknown error occurred');
    expect(getErrorMessage(undefined)).toBe('An unknown error occurred');
    expect(getErrorMessage(42)).toBe('An unknown error occurred');
  });
});

describe('applySlippage', () => {
  it('should calculate minimum amount with slippage', () => {
    expect(applySlippage(100, 1, true)).toBe(99);
    expect(applySlippage(100, 5, true)).toBe(95);
  });

  it('should calculate maximum amount with slippage', () => {
    expect(applySlippage(100, 1, false)).toBe(101);
    expect(applySlippage(100, 5, false)).toBe(105);
  });

  it('should handle zero slippage', () => {
    expect(applySlippage(100, 0, true)).toBe(100);
    expect(applySlippage(100, 0, false)).toBe(100);
  });

  it('should handle fractional amounts', () => {
    expect(applySlippage(99.5, 1, true)).toBe(98.505);
  });
});
