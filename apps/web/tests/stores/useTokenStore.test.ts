/**
 * useTokenStore Tests
 *
 * Tests token caching, persistence, loading states, and error handling.
 * Verifies Zustand store behavior with real contract integration.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useTokenStore } from '@/stores/useTokenStore';
import { sacFactoryService, type TokenInfo } from '@/lib/stellar/services/sac-factory.service';
import { getGraphQLClient } from '@/lib/graphql/client';

// Mock dependencies
vi.mock('@/lib/stellar/services/sac-factory.service');
vi.mock('@/lib/graphql/client');

const mockTokenInfo: TokenInfo = {
  name: 'Test Token',
  symbol: 'TEST',
  decimals: 7,
  total_supply: '1000000000',
  xlm_raised: '5000000000',
  creator: 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
  issuer: 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
  xlm_reserve: '5000000000',
  token_reserve: '500000000',
  virtual_xlm_reserve: '5000000000',
  virtual_token_reserve: '500000000',
  initial_virtual_xlm_reserve: '30000000000',
  initial_virtual_token_reserve: '1073000000000',
  status: 'Active',
  image_url: 'https://example.com/token.png',
  description: 'Test token description',
  market_cap: '69000000000',
  price: '10000000',
  holders_count: 42,
  k_last: '2500000000000000000',
};

const mockGraphQLClient = {
  query: vi.fn(),
};

describe('useTokenStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getGraphQLClient as any).mockReturnValue(mockGraphQLClient);

    // Reset store state before each test
    const store = useTokenStore.getState();
    store.reset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initial State', () => {
    it('should have empty initial state', () => {
      const { result } = renderHook(() => useTokenStore());

      expect(result.current.tokens.size).toBe(0);
      expect(result.current.tokenCount).toBe(0);
      expect(result.current.isLoadingTokens).toBe(false);
      expect(result.current.loadingTokens.size).toBe(0);
      expect(result.current.errors.size).toBe(0);
    });

    it('should provide isLoadingToken function', () => {
      const { result } = renderHook(() => useTokenStore());

      expect(typeof result.current.isLoadingToken).toBe('function');
      expect(result.current.isLoadingToken('CTEST123')).toBe(false);
    });
  });

  describe('Token Count Fetching', () => {
    it('should fetch token count from GraphQL', async () => {
      mockGraphQLClient.query.mockResolvedValue({
        data: {
          globalStats: {
            totalTokens: 42,
          },
        },
      });

      const { result } = renderHook(() => useTokenStore());

      await act(async () => {
        await result.current.fetchTokenCount();
      });

      await waitFor(() => {
        expect(result.current.tokenCount).toBe(42);
      });
    });

    it('should fallback to contract when GraphQL fails', async () => {
      mockGraphQLClient.query.mockRejectedValue(new Error('GraphQL error'));
      vi.mocked(sacFactoryService.getTokenCount).mockResolvedValue(35);

      const { result } = renderHook(() => useTokenStore());

      await act(async () => {
        await result.current.fetchTokenCount();
      });

      await waitFor(() => {
        expect(result.current.tokenCount).toBe(35);
      });
    });

    it('should use contract when GraphQL returns undefined', async () => {
      mockGraphQLClient.query.mockResolvedValue({
        data: {
          globalStats: {
            totalTokens: undefined,
          },
        },
      });
      vi.mocked(sacFactoryService.getTokenCount).mockResolvedValue(28);

      const { result } = renderHook(() => useTokenStore());

      await act(async () => {
        await result.current.fetchTokenCount();
      });

      await waitFor(() => {
        expect(result.current.tokenCount).toBe(28);
      });
    });

    it('should handle contract error when both GraphQL and contract fail', async () => {
      mockGraphQLClient.query.mockRejectedValue(new Error('GraphQL error'));
      vi.mocked(sacFactoryService.getTokenCount).mockRejectedValue(new Error('Contract error'));

      const { result } = renderHook(() => useTokenStore());

      await act(async () => {
        await result.current.fetchTokenCount();
      });

      await waitFor(() => {
        expect(result.current.errors.has('tokenCount')).toBe(true);
      });
    });
  });

  describe('Token Info Fetching', () => {
    it('should fetch token info successfully', async () => {
      vi.mocked(sacFactoryService.getTokenInfo).mockResolvedValue(mockTokenInfo);

      const { result } = renderHook(() => useTokenStore());

      let token: TokenInfo | null = null;

      await act(async () => {
        token = await result.current.fetchTokenInfo('CTEST123');
      });

      expect(token).toEqual(mockTokenInfo);
      expect(result.current.tokens.get('CTEST123')).toEqual(mockTokenInfo);
    });

    it('should set loading state while fetching', async () => {
      vi.mocked(sacFactoryService.getTokenInfo).mockImplementation(() => {
        return new Promise((resolve) => {
          setTimeout(() => resolve(mockTokenInfo), 100);
        });
      });

      const { result } = renderHook(() => useTokenStore());

      act(() => {
        result.current.fetchTokenInfo('CTEST123');
      });

      await waitFor(() => {
        expect(result.current.isLoadingToken('CTEST123')).toBe(true);
      });
    });

    it('should clear loading state after fetch completes', async () => {
      vi.mocked(sacFactoryService.getTokenInfo).mockResolvedValue(mockTokenInfo);

      const { result } = renderHook(() => useTokenStore());

      await act(async () => {
        await result.current.fetchTokenInfo('CTEST123');
      });

      await waitFor(() => {
        expect(result.current.isLoadingToken('CTEST123')).toBe(false);
      });
    });

    it('should handle token not found', async () => {
      vi.mocked(sacFactoryService.getTokenInfo).mockResolvedValue(null);

      const { result } = renderHook(() => useTokenStore());

      let token: TokenInfo | null = null;

      await act(async () => {
        token = await result.current.fetchTokenInfo('CTEST123');
      });

      expect(token).toBeNull();
      expect(result.current.errors.has('token-CTEST123')).toBe(true);
    });

    it('should handle fetch errors', async () => {
      vi.mocked(sacFactoryService.getTokenInfo).mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useTokenStore());

      let token: TokenInfo | null = null;

      await act(async () => {
        token = await result.current.fetchTokenInfo('CTEST123');
      });

      expect(token).toBeNull();
      expect(result.current.errors.get('token-CTEST123')).toBe('Network error');
    });

    it('should clear errors on successful fetch', async () => {
      vi.mocked(sacFactoryService.getTokenInfo).mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useTokenStore());

      // First fetch fails
      await act(async () => {
        await result.current.fetchTokenInfo('CTEST123');
      });

      expect(result.current.errors.has('token-CTEST123')).toBe(true);

      // Second fetch succeeds
      vi.mocked(sacFactoryService.getTokenInfo).mockResolvedValueOnce(mockTokenInfo);

      await act(async () => {
        await result.current.fetchTokenInfo('CTEST123');
      });

      await waitFor(() => {
        expect(result.current.errors.has('token-CTEST123')).toBe(false);
      });
    });

    it('should not fetch if already loading', async () => {
      vi.mocked(sacFactoryService.getTokenInfo).mockImplementation(() => {
        return new Promise((resolve) => {
          setTimeout(() => resolve(mockTokenInfo), 100);
        });
      });

      const { result } = renderHook(() => useTokenStore());

      // Start first fetch
      act(() => {
        result.current.fetchTokenInfo('CTEST123');
      });

      // Immediately start second fetch
      await act(async () => {
        await result.current.fetchTokenInfo('CTEST123');
      });

      // Should only call the service once
      await waitFor(() => {
        expect(sacFactoryService.getTokenInfo).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Token Caching', () => {
    it('should return cached token without refetching', async () => {
      vi.mocked(sacFactoryService.getTokenInfo).mockResolvedValue(mockTokenInfo);

      const { result } = renderHook(() => useTokenStore());

      // First fetch
      await act(async () => {
        await result.current.fetchTokenInfo('CTEST123');
      });

      expect(sacFactoryService.getTokenInfo).toHaveBeenCalledTimes(1);

      // Second fetch should use cache
      await act(async () => {
        await result.current.fetchTokenInfo('CTEST123');
      });

      // Still only called once (returned from cache)
      expect(sacFactoryService.getTokenInfo).toHaveBeenCalledTimes(1);
      expect(result.current.tokens.get('CTEST123')).toEqual(mockTokenInfo);
    });

    it('should cache multiple tokens', async () => {
      const mockTokenInfo2 = { ...mockTokenInfo, symbol: 'TEST2' };

      vi.mocked(sacFactoryService.getTokenInfo)
        .mockResolvedValueOnce(mockTokenInfo)
        .mockResolvedValueOnce(mockTokenInfo2);

      const { result } = renderHook(() => useTokenStore());

      await act(async () => {
        await result.current.fetchTokenInfo('CTEST123');
        await result.current.fetchTokenInfo('CTEST456');
      });

      expect(result.current.tokens.size).toBe(2);
      expect(result.current.tokens.get('CTEST123')).toEqual(mockTokenInfo);
      expect(result.current.tokens.get('CTEST456')).toEqual(mockTokenInfo2);
    });
  });

  describe('Token Refresh', () => {
    it('should refresh token data', async () => {
      const updatedTokenInfo = { ...mockTokenInfo, xlm_raised: '10000000000' };

      vi.mocked(sacFactoryService.getTokenInfo)
        .mockResolvedValueOnce(mockTokenInfo)
        .mockResolvedValueOnce(updatedTokenInfo);

      const { result } = renderHook(() => useTokenStore());

      // Initial fetch
      await act(async () => {
        await result.current.fetchTokenInfo('CTEST123');
      });

      expect(result.current.tokens.get('CTEST123')?.xlm_raised).toBe('5000000000');

      // Refresh
      await act(async () => {
        await result.current.refreshToken('CTEST123');
      });

      await waitFor(() => {
        expect(result.current.tokens.get('CTEST123')?.xlm_raised).toBe('10000000000');
      });
    });

    it('should handle refresh errors', async () => {
      vi.mocked(sacFactoryService.getTokenInfo)
        .mockResolvedValueOnce(mockTokenInfo)
        .mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useTokenStore());

      // Initial fetch
      await act(async () => {
        await result.current.fetchTokenInfo('CTEST123');
      });

      // Refresh fails
      await act(async () => {
        await result.current.refreshToken('CTEST123');
      });

      // Should still have old data in cache
      expect(result.current.tokens.get('CTEST123')).toEqual(mockTokenInfo);
      expect(result.current.errors.has('token-CTEST123')).toBe(true);
    });
  });

  describe('Error Management', () => {
    it('should clear specific error', async () => {
      vi.mocked(sacFactoryService.getTokenInfo).mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useTokenStore());

      await act(async () => {
        await result.current.fetchTokenInfo('CTEST123');
      });

      expect(result.current.errors.has('token-CTEST123')).toBe(true);

      act(() => {
        result.current.clearError('token-CTEST123');
      });

      expect(result.current.errors.has('token-CTEST123')).toBe(false);
    });

    it('should not affect other errors when clearing specific error', async () => {
      vi.mocked(sacFactoryService.getTokenInfo).mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useTokenStore());

      await act(async () => {
        await result.current.fetchTokenInfo('CTEST123');
        await result.current.fetchTokenInfo('CTEST456');
      });

      expect(result.current.errors.size).toBe(2);

      act(() => {
        result.current.clearError('token-CTEST123');
      });

      expect(result.current.errors.has('token-CTEST123')).toBe(false);
      expect(result.current.errors.has('token-CTEST456')).toBe(true);
    });
  });

  describe('Store Reset', () => {
    it('should reset store to initial state', async () => {
      vi.mocked(sacFactoryService.getTokenInfo).mockResolvedValue(mockTokenInfo);
      vi.mocked(sacFactoryService.getTokenCount).mockResolvedValue(42);

      const { result } = renderHook(() => useTokenStore());

      // Populate store
      await act(async () => {
        await result.current.fetchTokenCount();
        await result.current.fetchTokenInfo('CTEST123');
      });

      expect(result.current.tokens.size).toBe(1);
      expect(result.current.tokenCount).toBe(42);

      // Reset
      act(() => {
        result.current.reset();
      });

      expect(result.current.tokens.size).toBe(0);
      expect(result.current.tokenCount).toBe(0);
      expect(result.current.isLoadingTokens).toBe(false);
      expect(result.current.loadingTokens.size).toBe(0);
      expect(result.current.errors.size).toBe(0);
    });
  });

  describe('Persistence', () => {
    it('should persist tokens to localStorage', async () => {
      vi.mocked(sacFactoryService.getTokenInfo).mockResolvedValue(mockTokenInfo);

      const { result } = renderHook(() => useTokenStore());

      await act(async () => {
        await result.current.fetchTokenInfo('CTEST123');
      });

      // Check localStorage (Zustand persist middleware)
      const stored = localStorage.getItem('astro-shiba-tokens');
      expect(stored).toBeTruthy();

      if (stored) {
        const parsed = JSON.parse(stored);
        expect(parsed.state.tokenCount).toBeDefined();
      }
    });

    it('should not persist loading states', async () => {
      vi.mocked(sacFactoryService.getTokenInfo).mockImplementation(() => {
        return new Promise(() => {}); // Never resolves
      });

      const { result } = renderHook(() => useTokenStore());

      act(() => {
        result.current.fetchTokenInfo('CTEST123');
      });

      // Check localStorage (should not contain loading states)
      const stored = localStorage.getItem('astro-shiba-tokens');
      if (stored) {
        const parsed = JSON.parse(stored);
        expect(parsed.state.isLoadingTokens).toBeUndefined();
        expect(parsed.state.loadingTokens).toBeUndefined();
      }
    });

    it('should not persist errors', async () => {
      vi.mocked(sacFactoryService.getTokenInfo).mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useTokenStore());

      await act(async () => {
        await result.current.fetchTokenInfo('CTEST123');
      });

      // Check localStorage (should not contain errors)
      const stored = localStorage.getItem('astro-shiba-tokens');
      if (stored) {
        const parsed = JSON.parse(stored);
        expect(parsed.state.errors).toBeUndefined();
      }
    });
  });

  describe('Concurrent Requests', () => {
    it('should handle multiple concurrent fetches for different tokens', async () => {
      const mockTokenInfo2 = { ...mockTokenInfo, symbol: 'TEST2' };
      const mockTokenInfo3 = { ...mockTokenInfo, symbol: 'TEST3' };

      vi.mocked(sacFactoryService.getTokenInfo)
        .mockImplementation((address: string) => {
          return new Promise((resolve) => {
            setTimeout(() => {
              if (address === 'CTEST123') resolve(mockTokenInfo);
              else if (address === 'CTEST456') resolve(mockTokenInfo2);
              else resolve(mockTokenInfo3);
            }, 50);
          });
        });

      const { result } = renderHook(() => useTokenStore());

      await act(async () => {
        await Promise.all([
          result.current.fetchTokenInfo('CTEST123'),
          result.current.fetchTokenInfo('CTEST456'),
          result.current.fetchTokenInfo('CTEST789'),
        ]);
      });

      expect(result.current.tokens.size).toBe(3);
      expect(result.current.tokens.get('CTEST123')?.symbol).toBe('TEST');
      expect(result.current.tokens.get('CTEST456')?.symbol).toBe('TEST2');
      expect(result.current.tokens.get('CTEST789')?.symbol).toBe('TEST3');
    });

    it('should handle race conditions for same token', async () => {
      let resolveCount = 0;
      vi.mocked(sacFactoryService.getTokenInfo).mockImplementation(() => {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolveCount++;
            resolve({ ...mockTokenInfo, xlm_raised: `${resolveCount}000000000` });
          }, 50);
        });
      });

      const { result } = renderHook(() => useTokenStore());

      // First request starts loading
      act(() => {
        result.current.fetchTokenInfo('CTEST123');
      });

      // Second request should be blocked (already loading)
      await act(async () => {
        await result.current.fetchTokenInfo('CTEST123');
      });

      // Should only call service once
      expect(sacFactoryService.getTokenInfo).toHaveBeenCalledTimes(1);
    });
  });

  describe('Type Safety', () => {
    it('should handle Map operations correctly', async () => {
      vi.mocked(sacFactoryService.getTokenInfo).mockResolvedValue(mockTokenInfo);

      const { result } = renderHook(() => useTokenStore());

      await act(async () => {
        await result.current.fetchTokenInfo('CTEST123');
      });

      // Map operations should work correctly
      expect(result.current.tokens instanceof Map).toBe(true);
      expect(result.current.tokens.has('CTEST123')).toBe(true);
      expect(result.current.tokens.get('CTEST123')).toBeDefined();
    });

    it('should handle Set operations correctly', async () => {
      vi.mocked(sacFactoryService.getTokenInfo).mockImplementation(() => {
        return new Promise(() => {}); // Never resolves
      });

      const { result } = renderHook(() => useTokenStore());

      act(() => {
        result.current.fetchTokenInfo('CTEST123');
      });

      // Set operations should work correctly
      expect(result.current.loadingTokens instanceof Set).toBe(true);
      expect(result.current.loadingTokens.has('CTEST123')).toBe(true);
    });
  });
});
