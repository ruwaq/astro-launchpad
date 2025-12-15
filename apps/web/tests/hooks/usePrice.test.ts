/**
 * usePrice Hook Tests
 *
 * Tests real-time price fetching from bonding curve with:
 * - Auto-refresh polling
 * - Price change tracking
 * - Error handling
 * - Memory safety
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { usePrice } from '@/hooks/usePrice';
import { sacFactoryService } from '@/lib/stellar/services/sac-factory.service';

// Mock SAC Factory Service
vi.mock('@/lib/stellar/services/sac-factory.service', () => ({
  sacFactoryService: {
    getPrice: vi.fn(),
  },
}));

describe('usePrice', () => {
  const mockTokenAddress = 'CTEST123';

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('Initial State', () => {
    it('should start with zero price and loading true', () => {
      (sacFactoryService.getPrice as any).mockResolvedValue(BigInt(0));

      const { result } = renderHook(() => usePrice(mockTokenAddress));

      expect(result.current.price).toBe(BigInt(0));
      expect(result.current.isLoading).toBe(true);
      expect(result.current.error).toBeNull();
    });

    it('should not fetch when address is null', () => {
      const { result } = renderHook(() => usePrice(null));

      expect(sacFactoryService.getPrice).not.toHaveBeenCalled();
      expect(result.current.price).toBe(BigInt(0));
    });

    it('should not fetch when address is undefined', () => {
      const { result } = renderHook(() => usePrice(undefined));

      expect(sacFactoryService.getPrice).not.toHaveBeenCalled();
      expect(result.current.price).toBe(BigInt(0));
    });
  });

  describe('Price Fetching', () => {
    it('should fetch price successfully', async () => {
      const mockPrice = BigInt(1000000); // 0.1 XLM in stroops
      (sacFactoryService.getPrice as any).mockResolvedValue(mockPrice);

      const { result } = renderHook(() => usePrice(mockTokenAddress));

      await waitFor(() => {
        expect(result.current.price).toBe(mockPrice);
        expect(result.current.isLoading).toBe(false);
        expect(result.current.error).toBeNull();
      });
    });

    it('should call getPrice with correct address', async () => {
      (sacFactoryService.getPrice as any).mockResolvedValue(BigInt(1000000));

      renderHook(() => usePrice(mockTokenAddress));

      await waitFor(() => {
        expect(sacFactoryService.getPrice).toHaveBeenCalledWith(mockTokenAddress);
      });
    });

    it('should handle zero price', async () => {
      (sacFactoryService.getPrice as any).mockResolvedValue(BigInt(0));

      const { result } = renderHook(() => usePrice(mockTokenAddress));

      await waitFor(() => {
        expect(result.current.price).toBe(BigInt(0));
        expect(result.current.isLoading).toBe(false);
      });
    });

    it('should handle very large prices', async () => {
      const largePrice = BigInt('999999999999999999');
      (sacFactoryService.getPrice as any).mockResolvedValue(largePrice);

      const { result } = renderHook(() => usePrice(mockTokenAddress));

      await waitFor(() => {
        expect(result.current.price).toBe(largePrice);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors', async () => {
      (sacFactoryService.getPrice as any).mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => usePrice(mockTokenAddress));

      await waitFor(() => {
        expect(result.current.error).toBe('Network error');
        expect(result.current.isLoading).toBe(false);
        expect(result.current.price).toBe(BigInt(0));
      });
    });

    it('should handle contract errors', async () => {
      (sacFactoryService.getPrice as any).mockRejectedValue(new Error('Contract not found'));

      const { result } = renderHook(() => usePrice(mockTokenAddress));

      await waitFor(() => {
        expect(result.current.error).toBe('Contract not found');
      });
    });

    it('should handle non-Error objects', async () => {
      (sacFactoryService.getPrice as any).mockRejectedValue('String error');

      const { result } = renderHook(() => usePrice(mockTokenAddress));

      await waitFor(() => {
        expect(result.current.error).toBe('Failed to fetch price');
      });
    });

    it('should clear error on successful fetch after error', async () => {
      (sacFactoryService.getPrice as any)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(BigInt(1000000));

      const { result } = renderHook(() => usePrice(mockTokenAddress));

      await waitFor(() => {
        expect(result.current.error).toBe('Network error');
      });

      await act(async () => {
        vi.advanceTimersByTime(30000);
      });

      await waitFor(() => {
        expect(result.current.error).toBeNull();
        expect(result.current.price).toBe(BigInt(1000000));
      });
    });
  });

  describe('Auto-refresh Polling', () => {
    it('should refresh at default interval (30 seconds)', async () => {
      (sacFactoryService.getPrice as any).mockResolvedValue(BigInt(1000000));

      renderHook(() => usePrice(mockTokenAddress));

      await waitFor(() => {
        expect(sacFactoryService.getPrice).toHaveBeenCalledTimes(1);
      });

      await act(async () => {
        vi.advanceTimersByTime(30000);
      });

      await waitFor(() => {
        expect(sacFactoryService.getPrice).toHaveBeenCalledTimes(2);
      });
    });

    it('should refresh at custom interval', async () => {
      (sacFactoryService.getPrice as any).mockResolvedValue(BigInt(1000000));

      renderHook(() => usePrice(mockTokenAddress, { interval: 15000 }));

      await waitFor(() => {
        expect(sacFactoryService.getPrice).toHaveBeenCalledTimes(1);
      });

      await act(async () => {
        vi.advanceTimersByTime(15000);
      });

      await waitFor(() => {
        expect(sacFactoryService.getPrice).toHaveBeenCalledTimes(2);
      });
    });

    it('should enforce minimum interval of 10 seconds', async () => {
      (sacFactoryService.getPrice as any).mockResolvedValue(BigInt(1000000));

      renderHook(() => usePrice(mockTokenAddress, { interval: 5000 }));

      await waitFor(() => {
        expect(sacFactoryService.getPrice).toHaveBeenCalledTimes(1);
      });

      // Should not refresh at 5 seconds
      await act(async () => {
        vi.advanceTimersByTime(5000);
      });

      expect(sacFactoryService.getPrice).toHaveBeenCalledTimes(1);

      // Should refresh at 10 seconds (minimum)
      await act(async () => {
        vi.advanceTimersByTime(5000);
      });

      await waitFor(() => {
        expect(sacFactoryService.getPrice).toHaveBeenCalledTimes(2);
      });
    });

    it('should not auto-refresh when autoStart is false', async () => {
      (sacFactoryService.getPrice as any).mockResolvedValue(BigInt(1000000));

      renderHook(() => usePrice(mockTokenAddress, { autoStart: false }));

      expect(sacFactoryService.getPrice).not.toHaveBeenCalled();

      await act(async () => {
        vi.advanceTimersByTime(30000);
      });

      expect(sacFactoryService.getPrice).not.toHaveBeenCalled();
    });

    it('should not auto-refresh when interval is 0', async () => {
      (sacFactoryService.getPrice as any).mockResolvedValue(BigInt(1000000));

      renderHook(() => usePrice(mockTokenAddress, { interval: 0 }));

      await waitFor(() => {
        expect(sacFactoryService.getPrice).toHaveBeenCalledTimes(1);
      });

      await act(async () => {
        vi.advanceTimersByTime(60000);
      });

      // Should not refresh
      expect(sacFactoryService.getPrice).toHaveBeenCalledTimes(1);
    });

    it('should clear interval on unmount', async () => {
      (sacFactoryService.getPrice as any).mockResolvedValue(BigInt(1000000));

      const { unmount } = renderHook(() => usePrice(mockTokenAddress));

      await waitFor(() => {
        expect(sacFactoryService.getPrice).toHaveBeenCalledTimes(1);
      });

      unmount();

      await act(async () => {
        vi.advanceTimersByTime(30000);
      });

      // Should not fetch after unmount
      expect(sacFactoryService.getPrice).toHaveBeenCalledTimes(1);
    });

    it('should update price on each refresh', async () => {
      (sacFactoryService.getPrice as any)
        .mockResolvedValueOnce(BigInt(1000000))
        .mockResolvedValueOnce(BigInt(1100000))
        .mockResolvedValueOnce(BigInt(1200000));

      const { result } = renderHook(() => usePrice(mockTokenAddress));

      await waitFor(() => {
        expect(result.current.price).toBe(BigInt(1000000));
      });

      await act(async () => {
        vi.advanceTimersByTime(30000);
      });

      await waitFor(() => {
        expect(result.current.price).toBe(BigInt(1100000));
      });

      await act(async () => {
        vi.advanceTimersByTime(30000);
      });

      await waitFor(() => {
        expect(result.current.price).toBe(BigInt(1200000));
      });
    });
  });

  describe('Price Change Tracking', () => {
    it('should track previous price', async () => {
      (sacFactoryService.getPrice as any)
        .mockResolvedValueOnce(BigInt(1000000))
        .mockResolvedValueOnce(BigInt(1100000));

      const { result } = renderHook(() => usePrice(mockTokenAddress));

      await waitFor(() => {
        expect(result.current.price).toBe(BigInt(1000000));
      });

      await act(async () => {
        vi.advanceTimersByTime(30000);
      });

      await waitFor(() => {
        expect(result.current.previousPrice).toBe(BigInt(1000000));
        expect(result.current.price).toBe(BigInt(1100000));
      });
    });

    it('should calculate positive price change percentage', async () => {
      (sacFactoryService.getPrice as any)
        .mockResolvedValueOnce(BigInt(1000000))
        .mockResolvedValueOnce(BigInt(1100000));

      const { result } = renderHook(() => usePrice(mockTokenAddress));

      await waitFor(() => {
        expect(result.current.price).toBe(BigInt(1000000));
      });

      await act(async () => {
        vi.advanceTimersByTime(30000);
      });

      await waitFor(() => {
        expect(result.current.priceChange24h).toBeCloseTo(10, 1); // 10% increase
      });
    });

    it('should calculate negative price change percentage', async () => {
      (sacFactoryService.getPrice as any)
        .mockResolvedValueOnce(BigInt(1000000))
        .mockResolvedValueOnce(BigInt(900000));

      const { result } = renderHook(() => usePrice(mockTokenAddress));

      await waitFor(() => {
        expect(result.current.price).toBe(BigInt(1000000));
      });

      await act(async () => {
        vi.advanceTimersByTime(30000);
      });

      await waitFor(() => {
        expect(result.current.priceChange24h).toBeCloseTo(-10, 1); // 10% decrease
      });
    });

    it('should show price direction as up', async () => {
      (sacFactoryService.getPrice as any)
        .mockResolvedValueOnce(BigInt(1000000))
        .mockResolvedValueOnce(BigInt(1100000));

      const { result } = renderHook(() => usePrice(mockTokenAddress));

      await waitFor(() => {
        expect(result.current.price).toBe(BigInt(1000000));
      });

      await act(async () => {
        vi.advanceTimersByTime(30000);
      });

      await waitFor(() => {
        expect(result.current.priceDirection).toBe('up');
      });
    });

    it('should show price direction as down', async () => {
      (sacFactoryService.getPrice as any)
        .mockResolvedValueOnce(BigInt(1000000))
        .mockResolvedValueOnce(BigInt(900000));

      const { result } = renderHook(() => usePrice(mockTokenAddress));

      await waitFor(() => {
        expect(result.current.price).toBe(BigInt(1000000));
      });

      await act(async () => {
        vi.advanceTimersByTime(30000);
      });

      await waitFor(() => {
        expect(result.current.priceDirection).toBe('down');
      });
    });

    it('should show price direction as stable when unchanged', async () => {
      (sacFactoryService.getPrice as any)
        .mockResolvedValueOnce(BigInt(1000000))
        .mockResolvedValueOnce(BigInt(1000000));

      const { result } = renderHook(() => usePrice(mockTokenAddress));

      await waitFor(() => {
        expect(result.current.price).toBe(BigInt(1000000));
      });

      await act(async () => {
        vi.advanceTimersByTime(30000);
      });

      await waitFor(() => {
        expect(result.current.priceDirection).toBe('stable');
      });
    });

    it('should not calculate change percentage on first fetch', async () => {
      (sacFactoryService.getPrice as any).mockResolvedValue(BigInt(1000000));

      const { result } = renderHook(() => usePrice(mockTokenAddress));

      await waitFor(() => {
        expect(result.current.priceChange24h).toBe(0);
      });
    });
  });

  describe('Manual Refresh', () => {
    it('should provide refresh function', async () => {
      (sacFactoryService.getPrice as any).mockResolvedValue(BigInt(1000000));

      const { result } = renderHook(() => usePrice(mockTokenAddress));

      await waitFor(() => {
        expect(sacFactoryService.getPrice).toHaveBeenCalledTimes(1);
      });

      await act(async () => {
        await result.current.refresh();
      });

      expect(sacFactoryService.getPrice).toHaveBeenCalledTimes(2);
    });

    it('should update price on manual refresh', async () => {
      (sacFactoryService.getPrice as any)
        .mockResolvedValueOnce(BigInt(1000000))
        .mockResolvedValueOnce(BigInt(1200000));

      const { result } = renderHook(() => usePrice(mockTokenAddress));

      await waitFor(() => {
        expect(result.current.price).toBe(BigInt(1000000));
      });

      await act(async () => {
        await result.current.refresh();
      });

      await waitFor(() => {
        expect(result.current.price).toBe(BigInt(1200000));
      });
    });
  });

  describe('Address Changes', () => {
    it('should reset state when address changes', async () => {
      (sacFactoryService.getPrice as any).mockResolvedValue(BigInt(1000000));

      const { result, rerender } = renderHook(
        ({ address }) => usePrice(address),
        { initialProps: { address: mockTokenAddress } }
      );

      await waitFor(() => {
        expect(result.current.price).toBe(BigInt(1000000));
      });

      rerender({ address: 'CTEST456' });

      // Should reset to loading state
      await waitFor(() => {
        expect(result.current.price).toBe(BigInt(0));
        expect(result.current.previousPrice).toBe(BigInt(0));
        expect(result.current.priceChange24h).toBe(0);
      });
    });

    it('should fetch new price when address changes', async () => {
      (sacFactoryService.getPrice as any)
        .mockResolvedValueOnce(BigInt(1000000))
        .mockResolvedValueOnce(BigInt(2000000));

      const { result, rerender } = renderHook(
        ({ address }) => usePrice(address),
        { initialProps: { address: mockTokenAddress } }
      );

      await waitFor(() => {
        expect(result.current.price).toBe(BigInt(1000000));
      });

      rerender({ address: 'CTEST456' });

      await waitFor(() => {
        expect(sacFactoryService.getPrice).toHaveBeenCalledWith('CTEST456');
        expect(result.current.price).toBe(BigInt(2000000));
      });
    });

    it('should stop polling old address when address changes', async () => {
      (sacFactoryService.getPrice as any).mockResolvedValue(BigInt(1000000));

      const { rerender } = renderHook(
        ({ address }) => usePrice(address),
        { initialProps: { address: mockTokenAddress } }
      );

      await waitFor(() => {
        expect(sacFactoryService.getPrice).toHaveBeenCalledTimes(1);
      });

      rerender({ address: 'CTEST456' });

      await waitFor(() => {
        expect(sacFactoryService.getPrice).toHaveBeenCalledTimes(2);
      });

      (sacFactoryService.getPrice as any).mockClear();

      await act(async () => {
        vi.advanceTimersByTime(30000);
      });

      // Should only be called once (for new address)
      expect(sacFactoryService.getPrice).toHaveBeenCalledTimes(1);
      expect(sacFactoryService.getPrice).toHaveBeenCalledWith('CTEST456');
    });
  });
});
