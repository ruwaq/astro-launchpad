/**
 * useBalance Hook Tests
 *
 * Tests XLM balance fetching with auto-refresh and error handling.
 * Verifies proper cleanup and memory safety.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useBalance } from '@/hooks/useBalance';
import { stellarClient } from '@/lib/stellar/client';

// Mock stellar client
vi.mock('@/lib/stellar/client', () => ({
  stellarClient: {
    getHorizon: vi.fn(),
  },
}));

// Mock error logging
vi.mock('@/lib/utils/errors', () => ({
  logWarning: vi.fn(),
  logError: vi.fn(),
}));

describe('useBalance', () => {
  const mockAddress = 'GBXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
  const mockLoadAccount = vi.fn();
  const mockHorizonClient = {
    loadAccount: mockLoadAccount,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    (stellarClient.getHorizon as any).mockReturnValue(mockHorizonClient);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('Initial State', () => {
    it('should start with zero balance and not loading', () => {
      const { result } = renderHook(() => useBalance(null));

      expect(result.current.balance).toBe('0');
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should return zero balance when address is null', () => {
      const { result } = renderHook(() => useBalance(null));

      expect(result.current.balance).toBe('0');
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });
  });

  describe('Balance Fetching', () => {
    it('should fetch balance successfully', async () => {
      mockLoadAccount.mockResolvedValue({
        balances: [
          {
            asset_type: 'native',
            balance: '1234.5678900',
          },
        ],
      });

      const { result } = renderHook(() => useBalance(mockAddress));

      await waitFor(() => {
        expect(result.current.balance).toBe('1234.57');
        expect(result.current.isLoading).toBe(false);
        expect(result.current.error).toBeNull();
      });
    });

    it('should format balance to 2 decimal places', async () => {
      mockLoadAccount.mockResolvedValue({
        balances: [
          {
            asset_type: 'native',
            balance: '999.999',
          },
        ],
      });

      const { result } = renderHook(() => useBalance(mockAddress));

      await waitFor(() => {
        expect(result.current.balance).toBe('1000.00');
      });
    });

    it('should set loading state while fetching', async () => {
      let resolveAccount: (value: any) => void;
      const accountPromise = new Promise((resolve) => {
        resolveAccount = resolve;
      });

      mockLoadAccount.mockReturnValue(accountPromise);

      const { result } = renderHook(() => useBalance(mockAddress));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(true);
      });

      await act(async () => {
        resolveAccount!({
          balances: [{ asset_type: 'native', balance: '100.00' }],
        });
        await accountPromise;
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });

    it('should call Horizon API with correct address', async () => {
      mockLoadAccount.mockResolvedValue({
        balances: [{ asset_type: 'native', balance: '100.00' }],
      });

      renderHook(() => useBalance(mockAddress));

      await waitFor(() => {
        expect(mockLoadAccount).toHaveBeenCalledWith(mockAddress);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors', async () => {
      mockLoadAccount.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useBalance(mockAddress));

      await waitFor(() => {
        expect(result.current.balance).toBe('0');
        expect(result.current.error).toBe('Network error');
        expect(result.current.isLoading).toBe(false);
      });
    });

    it('should handle account not found', async () => {
      mockLoadAccount.mockRejectedValue(new Error('Account not found'));

      const { result } = renderHook(() => useBalance(mockAddress));

      await waitFor(() => {
        expect(result.current.balance).toBe('0');
        expect(result.current.error).toBe('Account not found');
      });
    });

    it('should handle missing balances array', async () => {
      mockLoadAccount.mockResolvedValue({
        balances: null,
      });

      const { result } = renderHook(() => useBalance(mockAddress));

      await waitFor(() => {
        expect(result.current.balance).toBe('0');
        expect(result.current.isLoading).toBe(false);
      });
    });

    it('should handle invalid balances array', async () => {
      mockLoadAccount.mockResolvedValue({
        balances: 'not-an-array',
      });

      const { result } = renderHook(() => useBalance(mockAddress));

      await waitFor(() => {
        expect(result.current.balance).toBe('0');
        expect(result.current.isLoading).toBe(false);
      });
    });

    it('should handle missing native balance', async () => {
      mockLoadAccount.mockResolvedValue({
        balances: [
          {
            asset_type: 'credit_alphanum4',
            asset_code: 'USDC',
            balance: '1000.00',
          },
        ],
      });

      const { result } = renderHook(() => useBalance(mockAddress));

      await waitFor(() => {
        expect(result.current.balance).toBe('0');
        expect(result.current.isLoading).toBe(false);
      });
    });

    it('should handle non-Error objects', async () => {
      mockLoadAccount.mockRejectedValue('String error');

      const { result } = renderHook(() => useBalance(mockAddress));

      await waitFor(() => {
        expect(result.current.error).toBe('Failed to fetch balance');
      });
    });
  });

  describe('Auto-refresh', () => {
    it('should refresh balance every 60 seconds', async () => {
      mockLoadAccount.mockResolvedValue({
        balances: [{ asset_type: 'native', balance: '100.00' }],
      });

      renderHook(() => useBalance(mockAddress));

      await waitFor(() => {
        expect(mockLoadAccount).toHaveBeenCalledTimes(1);
      });

      await act(async () => {
        vi.advanceTimersByTime(60000);
      });

      await waitFor(() => {
        expect(mockLoadAccount).toHaveBeenCalledTimes(2);
      });

      await act(async () => {
        vi.advanceTimersByTime(60000);
      });

      await waitFor(() => {
        expect(mockLoadAccount).toHaveBeenCalledTimes(3);
      });
    });

    it('should update balance on refresh', async () => {
      mockLoadAccount
        .mockResolvedValueOnce({
          balances: [{ asset_type: 'native', balance: '100.00' }],
        })
        .mockResolvedValueOnce({
          balances: [{ asset_type: 'native', balance: '200.00' }],
        });

      const { result } = renderHook(() => useBalance(mockAddress));

      await waitFor(() => {
        expect(result.current.balance).toBe('100.00');
      });

      await act(async () => {
        vi.advanceTimersByTime(60000);
      });

      await waitFor(() => {
        expect(result.current.balance).toBe('200.00');
      });
    });

    it('should clear interval on unmount', async () => {
      mockLoadAccount.mockResolvedValue({
        balances: [{ asset_type: 'native', balance: '100.00' }],
      });

      const { unmount } = renderHook(() => useBalance(mockAddress));

      await waitFor(() => {
        expect(mockLoadAccount).toHaveBeenCalledTimes(1);
      });

      unmount();

      await act(async () => {
        vi.advanceTimersByTime(60000);
      });

      // Should not fetch after unmount
      expect(mockLoadAccount).toHaveBeenCalledTimes(1);
    });
  });

  describe('Address Changes', () => {
    it('should reset balance when address changes to null', async () => {
      mockLoadAccount.mockResolvedValue({
        balances: [{ asset_type: 'native', balance: '100.00' }],
      });

      const { result, rerender } = renderHook(
        ({ address }) => useBalance(address),
        { initialProps: { address: mockAddress } }
      );

      await waitFor(() => {
        expect(result.current.balance).toBe('100.00');
      });

      rerender({ address: null });

      expect(result.current.balance).toBe('0');
      expect(result.current.error).toBeNull();
      expect(result.current.isLoading).toBe(false);
    });

    it('should fetch new balance when address changes', async () => {
      const mockAddress2 = 'GCXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';

      mockLoadAccount
        .mockResolvedValueOnce({
          balances: [{ asset_type: 'native', balance: '100.00' }],
        })
        .mockResolvedValueOnce({
          balances: [{ asset_type: 'native', balance: '200.00' }],
        });

      const { result, rerender } = renderHook(
        ({ address }) => useBalance(address),
        { initialProps: { address: mockAddress } }
      );

      await waitFor(() => {
        expect(result.current.balance).toBe('100.00');
      });

      rerender({ address: mockAddress2 });

      await waitFor(() => {
        expect(mockLoadAccount).toHaveBeenCalledWith(mockAddress2);
        expect(result.current.balance).toBe('200.00');
      });
    });

    it('should clear old interval when address changes', async () => {
      mockLoadAccount.mockResolvedValue({
        balances: [{ asset_type: 'native', balance: '100.00' }],
      });

      const { rerender } = renderHook(
        ({ address }) => useBalance(address),
        { initialProps: { address: mockAddress } }
      );

      await waitFor(() => {
        expect(mockLoadAccount).toHaveBeenCalledTimes(1);
      });

      rerender({ address: 'GCXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX' });

      await waitFor(() => {
        expect(mockLoadAccount).toHaveBeenCalledTimes(2);
      });

      // Fast-forward and verify old interval is not running
      mockLoadAccount.mockClear();

      await act(async () => {
        vi.advanceTimersByTime(60000);
      });

      // Should only be called once (for new address), not twice (if old interval was still running)
      expect(mockLoadAccount).toHaveBeenCalledTimes(1);
    });
  });

  describe('Memory Safety', () => {
    it('should not update state after unmount', async () => {
      let resolveAccount: (value: any) => void;
      const accountPromise = new Promise((resolve) => {
        resolveAccount = resolve;
      });

      mockLoadAccount.mockReturnValue(accountPromise);

      const { result, unmount } = renderHook(() => useBalance(mockAddress));

      // Unmount before promise resolves
      unmount();

      await act(async () => {
        resolveAccount!({
          balances: [{ asset_type: 'native', balance: '100.00' }],
        });
        await accountPromise;
      });

      // Balance should remain at initial value
      expect(result.current.balance).toBe('0');
    });

    it('should not fetch after unmount during error', async () => {
      let rejectAccount: (error: Error) => void;
      const accountPromise = new Promise((_, reject) => {
        rejectAccount = reject;
      });

      mockLoadAccount.mockReturnValue(accountPromise);

      const { result, unmount } = renderHook(() => useBalance(mockAddress));

      unmount();

      await act(async () => {
        rejectAccount!(new Error('Network error'));
        try {
          await accountPromise;
        } catch {
          // Expected error
        }
      });

      // Error should not be set after unmount
      expect(result.current.error).toBeNull();
    });

    it('should handle rapid unmount/remount', async () => {
      mockLoadAccount.mockResolvedValue({
        balances: [{ asset_type: 'native', balance: '100.00' }],
      });

      const { unmount, rerender } = renderHook(() => useBalance(mockAddress));

      await waitFor(() => {
        expect(mockLoadAccount).toHaveBeenCalledTimes(1);
      });

      unmount();
      rerender();

      await waitFor(() => {
        expect(mockLoadAccount).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero balance', async () => {
      mockLoadAccount.mockResolvedValue({
        balances: [{ asset_type: 'native', balance: '0.0000000' }],
      });

      const { result } = renderHook(() => useBalance(mockAddress));

      await waitFor(() => {
        expect(result.current.balance).toBe('0.00');
      });
    });

    it('should handle very large balances', async () => {
      mockLoadAccount.mockResolvedValue({
        balances: [{ asset_type: 'native', balance: '999999999.9999999' }],
      });

      const { result } = renderHook(() => useBalance(mockAddress));

      await waitFor(() => {
        expect(result.current.balance).toBe('1000000000.00');
      });
    });

    it('should handle very small balances', async () => {
      mockLoadAccount.mockResolvedValue({
        balances: [{ asset_type: 'native', balance: '0.0000001' }],
      });

      const { result } = renderHook(() => useBalance(mockAddress));

      await waitFor(() => {
        expect(result.current.balance).toBe('0.00');
      });
    });

    it('should handle balance with extra decimals', async () => {
      mockLoadAccount.mockResolvedValue({
        balances: [{ asset_type: 'native', balance: '123.4567890123' }],
      });

      const { result } = renderHook(() => useBalance(mockAddress));

      await waitFor(() => {
        expect(result.current.balance).toBe('123.46');
      });
    });
  });
});
