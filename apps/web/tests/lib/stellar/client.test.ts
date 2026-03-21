/**
 * Tests for Stellar Client Error Handling
 *
 * Focus on error paths, timeouts, and retry logic to ensure robustness.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { stellarClient, withRetry, getNetworkDeadline, getClientDeadline } from '@/lib/stellar/client';
import * as StellarSdk from '@stellar/stellar-sdk';

describe('Stellar Client - Error Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  describe('withRetry', () => {
    it('should succeed on first attempt', async () => {
      const operation = vi.fn().mockResolvedValue('success');

      const result = await withRetry(operation, 'testOperation');

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should retry on retryable network errors', async () => {
      const operation = vi
        .fn()
        .mockRejectedValueOnce(new Error('ETIMEDOUT'))
        .mockResolvedValue('success');

      const result = await withRetry(operation, 'testOperation', 1);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should not retry on non-retryable errors', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Invalid input'));

      await expect(withRetry(operation, 'testOperation')).rejects.toThrow('Invalid input');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should throw after max retries exhausted', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('ETIMEDOUT'));

      await expect(withRetry(operation, 'testOperation', 2)).rejects.toThrow('ETIMEDOUT');
      expect(operation).toHaveBeenCalledTimes(3); // initial + 2 retries
    });

    it('should handle ECONNRESET errors', async () => {
      const operation = vi
        .fn()
        .mockRejectedValueOnce(new Error('ECONNRESET'))
        .mockResolvedValue('recovered');

      const result = await withRetry(operation, 'testOperation', 1);

      expect(result).toBe('recovered');
    });

    it('should handle 503 service unavailable errors', async () => {
      const operation = vi
        .fn()
        .mockRejectedValueOnce(new Error('503 Service Unavailable'))
        .mockResolvedValue('recovered');

      const result = await withRetry(operation, 'testOperation', 1);

      expect(result).toBe('recovered');
    });

    it('should handle rate limit errors', async () => {
      const operation = vi
        .fn()
        .mockRejectedValueOnce(new Error('Rate limit exceeded'))
        .mockResolvedValue('recovered');

      const result = await withRetry(operation, 'testOperation', 1);

      expect(result).toBe('recovered');
    });

    it('should handle socket hang up errors', async () => {
      const operation = vi
        .fn()
        .mockRejectedValueOnce(new Error('socket hang up'))
        .mockResolvedValue('recovered');

      const result = await withRetry(operation, 'testOperation', 1);

      expect(result).toBe('recovered');
    });
  });

  describe('getNetworkDeadline', () => {
    it('should return deadline in future', async () => {
      const deadline = await getNetworkDeadline(300);
      const currentTime = BigInt(Math.floor(Date.now() / 1000));

      expect(deadline).toBeGreaterThan(currentTime);
    });

    it('should handle ledger fetch errors gracefully', async () => {
      vi.spyOn(stellarClient.getSoroban(), 'getLatestLedger').mockRejectedValue(
        new Error('Network error')
      );

      // Should not throw, should fallback to client time
      const deadline = await getNetworkDeadline(300);

      expect(deadline).toBeGreaterThan(0n);
    });

    it('should add requested timeout to current time', async () => {
      const timeoutSeconds = 100;
      const deadline = await getNetworkDeadline(timeoutSeconds);
      const currentTime = BigInt(Math.floor(Date.now() / 1000));

      // Deadline should be roughly currentTime + timeoutSeconds (with some margin)
      expect(deadline).toBeGreaterThanOrEqual(currentTime + BigInt(timeoutSeconds));
      expect(deadline).toBeLessThan(currentTime + BigInt(timeoutSeconds + 100));
    });

    it('should handle zero timeout', async () => {
      const deadline = await getNetworkDeadline(0);
      const currentTime = BigInt(Math.floor(Date.now() / 1000));

      expect(deadline).toBeGreaterThanOrEqual(currentTime);
    });

    it('should handle large timeout values', async () => {
      const deadline = await getNetworkDeadline(86400); // 24 hours

      expect(deadline).toBeGreaterThan(0n);
    });
  });

  describe('getClientDeadline', () => {
    it('should return deadline in future', () => {
      const deadline = getClientDeadline(300);
      const currentTime = BigInt(Math.floor(Date.now() / 1000));

      expect(deadline).toBeGreaterThan(currentTime);
    });

    it('should be synchronous', () => {
      const deadline = getClientDeadline(300);

      expect(typeof deadline).toBe('bigint');
    });

    it('should handle zero timeout', () => {
      const deadline = getClientDeadline(0);
      const currentTime = BigInt(Math.floor(Date.now() / 1000));

      expect(deadline).toBeGreaterThanOrEqual(currentTime);
    });
  });

  describe('StellarClient instances', () => {
    it('should export stellarClient singleton', () => {
      expect(stellarClient).toBeDefined();
    });

    it('should have soroban client', () => {
      expect(stellarClient.getSoroban()).toBeDefined();
    });

    it('should have horizon client', () => {
      expect(stellarClient.getHorizon()).toBeDefined();
    });

    it('should return network passphrase', () => {
      const passphrase = stellarClient.getNetworkPassphrase();

      expect(passphrase).toBeDefined();
      expect(typeof passphrase).toBe('string');
    });

    it('should have valid Stellar network passphrase', () => {
      const passphrase = stellarClient.getNetworkPassphrase();
      const isValid =
        passphrase === StellarSdk.Networks.TESTNET ||
        passphrase === StellarSdk.Networks.PUBLIC;

      expect(isValid).toBe(true);
    });
  });

  describe('SorobanClient methods', () => {
    it('should have getServer method', () => {
      const server = stellarClient.getSoroban().getServer();

      expect(server).toBeDefined();
      expect(server).toBeInstanceOf(StellarSdk.rpc.Server);
    });

    it('should have getNetworkPassphrase method', () => {
      const passphrase = stellarClient.getSoroban().getNetworkPassphrase();

      expect(passphrase).toBeDefined();
      expect(typeof passphrase).toBe('string');
    });
  });

  describe('HorizonClient methods', () => {
    it('should have getServer method', () => {
      const server = stellarClient.getHorizon().getServer();

      expect(server).toBeDefined();
      expect(server).toBeInstanceOf(StellarSdk.Horizon.Server);
    });
  });

  describe('error object handling', () => {
    it('should handle Error instances', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Standard error'));

      await expect(withRetry(operation, 'test')).rejects.toThrow('Standard error');
    });

    it('should handle TypeError', async () => {
      const operation = vi.fn().mockRejectedValue(new TypeError('Type error'));

      await expect(withRetry(operation, 'test')).rejects.toThrow('Type error');
    });

    it('should handle string errors', async () => {
      const operation = vi.fn().mockRejectedValue('String error');

      await expect(withRetry(operation, 'test')).rejects.toBe('String error');
    });

    it('should handle null errors', async () => {
      const operation = vi.fn().mockRejectedValue(null);

      await expect(withRetry(operation, 'test')).rejects.toBeNull();
    });
  });
});
