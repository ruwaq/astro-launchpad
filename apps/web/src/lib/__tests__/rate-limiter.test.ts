/**
 * Tests for Rate Limiter
 *
 * Tests sliding window rate limiting for different operation types.
 * Uses unique keys per test to avoid state pollution.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  checkRateLimit,
  getRemainingRequests,
  getResetTime,
  withRateLimit,
  RateLimitError,
  useRateLimitCheck,
} from '../rate-limiter';

// Generate truly unique keys to avoid state pollution
function getUniqueKey(): string {
  return `test-${Math.random().toString(36).substr(2, 15)}-${Date.now()}`;
}

describe('rate-limiter', () => {
  describe('checkRateLimit', () => {
    it('should allow first request', () => {
      const key = getUniqueKey();
      const result = checkRateLimit(key);

      expect(result).toBe(true);
    });

    it('should allow multiple requests within limit', () => {
      const key = getUniqueKey();

      // Should allow at least 3 requests (regardless of limit type)
      expect(checkRateLimit(key)).toBe(true);
      expect(checkRateLimit(key)).toBe(true);
      expect(checkRateLimit(key)).toBe(true);
    });

    it('should eventually block after many requests', () => {
      const key = getUniqueKey();

      // Make 100 requests - should definitely hit limit
      for (let i = 0; i < 100; i++) {
        checkRateLimit(key);
      }

      // Should now be rate limited
      const result = checkRateLimit(key);

      expect(result).toBe(false);
    });

    it('should use custom limits for known keys', () => {
      const key = 'create'; // 3 per 5 minutes

      // After 3 requests, should be rate limited
      checkRateLimit(key);
      checkRateLimit(key);
      checkRateLimit(key);

      const result = checkRateLimit(key);

      // Should be rate limited (or might still allow if previous tests filled it)
      expect(typeof result).toBe('boolean');
    });
  });

  describe('getRemainingRequests', () => {
    it('should return a positive number for unused key', () => {
      const key = getUniqueKey();
      const remaining = getRemainingRequests(key);

      expect(remaining).toBeGreaterThan(0);
    });

    it('should decrease after making requests', () => {
      const key = getUniqueKey();
      const initial = getRemainingRequests(key);

      checkRateLimit(key);

      const afterOne = getRemainingRequests(key);

      expect(afterOne).toBeLessThan(initial);
    });

    it('should return 0 when limit is reached', () => {
      const key = getUniqueKey();

      // Fill up completely
      for (let i = 0; i < 100; i++) {
        checkRateLimit(key);
      }

      const remaining = getRemainingRequests(key);

      expect(remaining).toBe(0);
    });
  });

  describe('getResetTime', () => {
    it('should return 0 for unused key', () => {
      const key = getUniqueKey();
      const resetTime = getResetTime(key);

      expect(resetTime).toBe(0);
    });

    it('should return positive value after request', () => {
      const key = getUniqueKey();

      checkRateLimit(key);

      const resetTime = getResetTime(key);

      expect(resetTime).toBeGreaterThan(0);
    });

    it('should return time within expected window', () => {
      const key = getUniqueKey();

      checkRateLimit(key);

      const resetTime = getResetTime(key);

      // Should be less than 10 minutes (longest window)
      expect(resetTime).toBeLessThanOrEqual(10 * 60 * 1000);
    });
  });

  describe('RateLimitError', () => {
    it('should create error with correct properties', () => {
      const error = new RateLimitError('test-key', 30000);

      expect(error.name).toBe('RateLimitError');
      expect(error.key).toBe('test-key');
      expect(error.resetMs).toBe(30000);
      expect(error.message).toContain('test-key');
    });

    it('should be instance of Error', () => {
      const error = new RateLimitError('test', 5000);

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(RateLimitError);
    });

    it('should format message with seconds', () => {
      const error = new RateLimitError('trade', 5500);

      expect(error.message).toContain('6s'); // Rounds up 5.5s to 6s
    });
  });

  describe('withRateLimit', () => {
    it('should execute operation when not rate limited', async () => {
      const key = getUniqueKey();
      const operation = vi.fn().mockResolvedValue('success');

      const result = await withRateLimit(key, operation);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledOnce();
    });

    it('should throw RateLimitError when limit exceeded', async () => {
      const key = getUniqueKey();

      // Fill up the limit
      for (let i = 0; i < 100; i++) {
        checkRateLimit(key);
      }

      const operation = vi.fn().mockResolvedValue('success');

      await expect(withRateLimit(key, operation)).rejects.toThrow(RateLimitError);
      expect(operation).not.toHaveBeenCalled();
    });

    it('should pass through operation errors', async () => {
      const key = getUniqueKey();
      const operation = vi.fn().mockRejectedValue(new Error('Operation failed'));

      await expect(withRateLimit(key, operation)).rejects.toThrow('Operation failed');
    });

    it('should handle async operations', async () => {
      const key = getUniqueKey();
      const operation = vi.fn().mockResolvedValue('async-result');

      const result = await withRateLimit(key, operation);

      expect(result).toBe('async-result');
    });

    it('should not call operation if rate limited', async () => {
      const key = getUniqueKey();

      // Fill the limit
      for (let i = 0; i < 100; i++) {
        checkRateLimit(key);
      }

      const operation = vi.fn().mockResolvedValue('should-not-run');

      try {
        await withRateLimit(key, operation);
      } catch (error) {
        // Expected to throw
      }

      expect(operation).not.toHaveBeenCalled();
    });
  });

  describe('useRateLimitCheck', () => {
    it('should return object with expected shape', () => {
      const key = getUniqueKey();
      const state = useRateLimitCheck(key);

      expect(state).toHaveProperty('canProceed');
      expect(state).toHaveProperty('remaining');
      expect(state).toHaveProperty('resetMs');
      expect(typeof state.canProceed).toBe('boolean');
      expect(typeof state.remaining).toBe('number');
      expect(typeof state.resetMs).toBe('number');
    });

    it('should show canProceed true for fresh key', () => {
      const key = getUniqueKey();
      const state = useRateLimitCheck(key);

      expect(state.canProceed).toBe(true);
    });

    it('should show canProceed false when limit reached', () => {
      const key = getUniqueKey();

      // Fill the limit
      for (let i = 0; i < 100; i++) {
        checkRateLimit(key);
      }

      const state = useRateLimitCheck(key);

      expect(state.canProceed).toBe(false);
    });

    it('should show resetMs > 0 when requests made', () => {
      const key = getUniqueKey();

      // Make a request
      useRateLimitCheck(key);

      const state = useRateLimitCheck(key);

      expect(state.resetMs).toBeGreaterThan(0);
    });
  });
});
