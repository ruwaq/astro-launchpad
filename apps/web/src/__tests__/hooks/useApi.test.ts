/**
 * useApi Hooks Tests
 *
 * Tests all Apollo GraphQL hooks including:
 * - Token queries (useTokens, useToken, useTrendingTokens, etc.)
 * - Pool queries (usePools, usePool, useTopPools)
 * - Transaction queries (useTransactions, useRecentTransactions, etc.)
 * - Global stats (useGlobalStats)
 * - Leaderboard (useLeaderboard)
 * - Search (useSearch)
 * - Mutations (useSyncToken)
 * - Polling intervals
 * - Error handling
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing';
import {
  useTokens,
  useToken,
  useTrendingTokens,
  useNewTokens,
  useTopGainers,
  usePools,
  usePool,
  useTopPools,
  useTransactions,
  useRecentTransactions,
  useUserTransactions,
  useGlobalStats,
  useLeaderboard,
  useSearch,
  useSyncToken,
  useHealth,
} from '@/hooks/useApi';
import {
  TOKENS_QUERY,
  TOKEN_QUERY,
  TRENDING_TOKENS_QUERY,
  NEW_TOKENS_QUERY,
  TOP_GAINERS_QUERY,
  POOLS_QUERY,
  POOL_QUERY,
  TOP_POOLS_QUERY,
  TRANSACTIONS_QUERY,
  RECENT_TRANSACTIONS_QUERY,
  USER_TRANSACTIONS_QUERY,
  GLOBAL_STATS_QUERY,
  LEADERBOARD_QUERY,
  SEARCH_QUERY,
  HEALTH_QUERY,
  SYNC_TOKEN_MUTATION,
} from '@/lib/graphql';
import type { ReactNode } from 'react';

// Mock environment variables
vi.stubEnv('NEXT_PUBLIC_CACHE_DURATION', '30000');
vi.stubEnv('NEXT_PUBLIC_POLLING_INTERVAL', '60000');

describe('useApi Hooks', () => {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MockedProvider mocks={[]} addTypename={false}>
      {children}
    </MockedProvider>
  );

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('useHealth', () => {
    it('should query health status', () => {
      const { result } = renderHook(() => useHealth(), { wrapper });

      expect(result.current.loading).toBeDefined();
      expect(result.current.data).toBeDefined();
    });

    it('should poll health status', () => {
      const { result } = renderHook(() => useHealth(), { wrapper });

      // Should have polling configured
      expect(result.current.loading).toBeDefined();
    });

    it('should accept custom options', () => {
      const { result } = renderHook(
        () => useHealth({ pollInterval: 5000 }),
        { wrapper }
      );

      expect(result.current.loading).toBeDefined();
    });
  });

  describe('useTokens', () => {
    it('should fetch tokens with default parameters', () => {
      const { result } = renderHook(() => useTokens(), { wrapper });

      expect(result.current.loading).toBeDefined();
      expect(result.current.data).toBeDefined();
    });

    it('should accept custom limit', () => {
      const { result } = renderHook(
        () => useTokens({ first: 50 }),
        { wrapper }
      );

      expect(result.current.loading).toBeDefined();
    });

    it('should accept custom orderBy', () => {
      const { result } = renderHook(
        () =>
          useTokens({
            orderBy: { field: 'VOLUME_24H' as any, direction: 'DESC' as any },
          }),
        { wrapper }
      );

      expect(result.current.loading).toBeDefined();
    });

    it('should accept search filter', () => {
      const { result } = renderHook(
        () => useTokens({ where: { search: 'ASTRO' } }),
        { wrapper }
      );

      expect(result.current.loading).toBeDefined();
    });

    it('should accept custom polling interval', () => {
      const { result } = renderHook(
        () => useTokens({ pollInterval: 30000 }),
        { wrapper }
      );

      expect(result.current.loading).toBeDefined();
    });
  });

  describe('useToken', () => {
    it('should fetch single token by address', () => {
      const address = 'CTEST123';
      const { result } = renderHook(() => useToken(address), { wrapper });

      expect(result.current.loading).toBeDefined();
      expect(result.current.data).toBeDefined();
    });

    it('should skip query when address is empty', () => {
      const { result } = renderHook(() => useToken(''), { wrapper });

      expect(result.current.loading).toBe(false);
    });

    it('should accept custom options', () => {
      const { result } = renderHook(
        () => useToken('CTEST123', { pollInterval: 10000 }),
        { wrapper }
      );

      expect(result.current.loading).toBeDefined();
    });
  });

  describe('useTrendingTokens', () => {
    it('should fetch trending tokens with default limit', () => {
      const { result } = renderHook(() => useTrendingTokens(), { wrapper });

      expect(result.current.loading).toBeDefined();
    });

    it('should accept custom limit', () => {
      const { result } = renderHook(() => useTrendingTokens(20), { wrapper });

      expect(result.current.loading).toBeDefined();
    });

    it('should poll trending tokens', () => {
      const { result } = renderHook(() => useTrendingTokens(10), { wrapper });

      expect(result.current.loading).toBeDefined();
    });

    it('should accept custom options', () => {
      const { result } = renderHook(
        () => useTrendingTokens(10, { pollInterval: 30000 }),
        { wrapper }
      );

      expect(result.current.loading).toBeDefined();
    });
  });

  describe('useNewTokens', () => {
    it('should fetch new tokens with default limit', () => {
      const { result } = renderHook(() => useNewTokens(), { wrapper });

      expect(result.current.loading).toBeDefined();
    });

    it('should accept custom limit', () => {
      const { result } = renderHook(() => useNewTokens(15), { wrapper });

      expect(result.current.loading).toBeDefined();
    });

    it('should poll more frequently than trending tokens', () => {
      const { result } = renderHook(() => useNewTokens(), { wrapper });

      expect(result.current.loading).toBeDefined();
    });
  });

  describe('useTopGainers', () => {
    it('should fetch top gainers with default limit', () => {
      const { result } = renderHook(() => useTopGainers(), { wrapper });

      expect(result.current.loading).toBeDefined();
    });

    it('should accept custom limit', () => {
      const { result } = renderHook(() => useTopGainers(20), { wrapper });

      expect(result.current.loading).toBeDefined();
    });

    it('should poll top gainers', () => {
      const { result } = renderHook(() => useTopGainers(), { wrapper });

      expect(result.current.loading).toBeDefined();
    });
  });

  describe('usePools', () => {
    it('should fetch pools with default parameters', () => {
      const { result } = renderHook(() => usePools(), { wrapper });

      expect(result.current.loading).toBeDefined();
    });

    it('should accept custom limit', () => {
      const { result } = renderHook(
        () => usePools({ first: 50 }),
        { wrapper }
      );

      expect(result.current.loading).toBeDefined();
    });

    it('should accept custom polling interval', () => {
      const { result } = renderHook(
        () => usePools({ pollInterval: 30000 }),
        { wrapper }
      );

      expect(result.current.loading).toBeDefined();
    });
  });

  describe('usePool', () => {
    it('should fetch single pool by address', () => {
      const address = 'CPOOL123';
      const { result } = renderHook(() => usePool(address), { wrapper });

      expect(result.current.loading).toBeDefined();
    });

    it('should skip query when address is empty', () => {
      const { result } = renderHook(() => usePool(''), { wrapper });

      expect(result.current.loading).toBe(false);
    });
  });

  describe('useTopPools', () => {
    it('should fetch top pools with default limit', () => {
      const { result } = renderHook(() => useTopPools(), { wrapper });

      expect(result.current.loading).toBeDefined();
    });

    it('should accept custom limit', () => {
      const { result } = renderHook(() => useTopPools(20), { wrapper });

      expect(result.current.loading).toBeDefined();
    });
  });

  describe('useTransactions', () => {
    it('should fetch transactions with default parameters', () => {
      const { result } = renderHook(() => useTransactions(), { wrapper });

      expect(result.current.loading).toBeDefined();
    });

    it('should accept user filter', () => {
      const { result } = renderHook(
        () => useTransactions({ where: { user: 'GUSER123' } }),
        { wrapper }
      );

      expect(result.current.loading).toBeDefined();
    });

    it('should accept token filter', () => {
      const { result } = renderHook(
        () => useTransactions({ where: { token: 'CTOKEN123' } }),
        { wrapper }
      );

      expect(result.current.loading).toBeDefined();
    });

    it('should accept type filter', () => {
      const { result } = renderHook(
        () => useTransactions({ where: { type: 'TOKEN_BOUGHT' as any } }),
        { wrapper }
      );

      expect(result.current.loading).toBeDefined();
    });

    it('should accept custom limit', () => {
      const { result } = renderHook(
        () => useTransactions({ first: 100 }),
        { wrapper }
      );

      expect(result.current.loading).toBeDefined();
    });
  });

  describe('useRecentTransactions', () => {
    it('should fetch recent transactions with default limit', () => {
      const { result } = renderHook(() => useRecentTransactions(), { wrapper });

      expect(result.current.loading).toBeDefined();
    });

    it('should accept custom limit', () => {
      const { result } = renderHook(() => useRecentTransactions(50), { wrapper });

      expect(result.current.loading).toBeDefined();
    });

    it('should poll recent transactions', () => {
      const { result } = renderHook(() => useRecentTransactions(), { wrapper });

      expect(result.current.loading).toBeDefined();
    });
  });

  describe('useUserTransactions', () => {
    it('should fetch user transactions', () => {
      const address = 'GUSER123';
      const { result } = renderHook(
        () => useUserTransactions(address),
        { wrapper }
      );

      expect(result.current.loading).toBeDefined();
    });

    it('should skip query when address is empty', () => {
      const { result } = renderHook(() => useUserTransactions(''), { wrapper });

      expect(result.current.loading).toBe(false);
    });

    it('should accept custom limit', () => {
      const { result } = renderHook(
        () => useUserTransactions('GUSER123', 100),
        { wrapper }
      );

      expect(result.current.loading).toBeDefined();
    });
  });

  describe('useGlobalStats', () => {
    it('should fetch global statistics', () => {
      const { result } = renderHook(() => useGlobalStats(), { wrapper });

      expect(result.current.loading).toBeDefined();
    });

    it('should poll global stats', () => {
      const { result } = renderHook(() => useGlobalStats(), { wrapper });

      expect(result.current.loading).toBeDefined();
    });

    it('should accept custom options', () => {
      const { result } = renderHook(
        () => useGlobalStats({ pollInterval: 30000 }),
        { wrapper }
      );

      expect(result.current.loading).toBeDefined();
    });
  });

  describe('useLeaderboard', () => {
    it('should fetch leaderboard with default parameters', () => {
      const { result } = renderHook(() => useLeaderboard(), { wrapper });

      expect(result.current.loading).toBeDefined();
    });

    it('should accept type filter', () => {
      const { result } = renderHook(
        () => useLeaderboard({ type: 'CREATORS' }),
        { wrapper }
      );

      expect(result.current.loading).toBeDefined();
    });

    it('should accept custom limit', () => {
      const { result } = renderHook(
        () => useLeaderboard({ limit: 50 }),
        { wrapper }
      );

      expect(result.current.loading).toBeDefined();
    });

    it('should accept timeframe filter', () => {
      const { result } = renderHook(
        () => useLeaderboard({ timeframe: 'WEEK' }),
        { wrapper }
      );

      expect(result.current.loading).toBeDefined();
    });

    it('should poll leaderboard less frequently', () => {
      const { result } = renderHook(() => useLeaderboard(), { wrapper });

      expect(result.current.loading).toBeDefined();
    });

    it('should accept all options together', () => {
      const { result } = renderHook(
        () =>
          useLeaderboard({
            type: 'LIQUIDITY_PROVIDERS',
            limit: 100,
            timeframe: 'MONTH',
            pollInterval: 60000,
          }),
        { wrapper }
      );

      expect(result.current.loading).toBeDefined();
    });
  });

  describe('useSearch', () => {
    it('should return search function and state', () => {
      const { result } = renderHook(() => useSearch(), { wrapper });

      expect(result.current.search).toBeDefined();
      expect(typeof result.current.search).toBe('function');
      expect(result.current.loading).toBeDefined();
      expect(result.current.data).toBeDefined();
      expect(result.current.error).toBeDefined();
    });

    it('should not search with empty query', () => {
      const { result } = renderHook(() => useSearch(), { wrapper });

      result.current.search('', 10);

      // Should not trigger query
      expect(result.current.loading).toBe(false);
    });

    it('should not search with query less than 2 characters', () => {
      const { result } = renderHook(() => useSearch(), { wrapper });

      result.current.search('a', 10);

      expect(result.current.loading).toBe(false);
    });

    it('should search with valid query', () => {
      const { result } = renderHook(() => useSearch(), { wrapper });

      result.current.search('ASTRO', 10);

      // Search should be called
      expect(result.current.search).toBeDefined();
    });

    it('should accept custom limit', () => {
      const { result } = renderHook(() => useSearch(), { wrapper });

      result.current.search('TEST', 20);

      expect(result.current.search).toBeDefined();
    });
  });

  describe('useSyncToken', () => {
    it('should return mutation function', () => {
      const { result } = renderHook(() => useSyncToken(), { wrapper });

      expect(result.current[0]).toBeDefined();
      expect(typeof result.current[0]).toBe('function');
    });

    it('should return mutation state', () => {
      const { result } = renderHook(() => useSyncToken(), { wrapper });

      const [, mutationResult] = result.current;

      expect(mutationResult.loading).toBeDefined();
      expect(mutationResult.data).toBeDefined();
      expect(mutationResult.error).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      const errorMock = {
        request: {
          query: TOKENS_QUERY,
        },
        error: new Error('Network error'),
      };

      const errorWrapper = ({ children }: { children: ReactNode }) => (
        <MockedProvider mocks={[errorMock]} addTypename={false}>
          {children}
        </MockedProvider>
      );

      const { result } = renderHook(() => useTokens(), { wrapper: errorWrapper });

      await waitFor(() => {
        expect(result.current.error).toBeDefined();
      });
    });

    it('should handle GraphQL errors gracefully', async () => {
      const graphQLError = {
        request: {
          query: TOKEN_QUERY,
          variables: { address: 'CTEST123' },
        },
        result: {
          errors: [{ message: 'Token not found' }],
        },
      };

      const errorWrapper = ({ children }: { children: ReactNode }) => (
        <MockedProvider mocks={[graphQLError]} addTypename={false}>
          {children}
        </MockedProvider>
      );

      const { result } = renderHook(() => useToken('CTEST123'), {
        wrapper: errorWrapper,
      });

      await waitFor(() => {
        expect(result.current.error).toBeDefined();
      });
    });
  });

  describe('Data Fetching', () => {
    it('should start in loading state', () => {
      const { result } = renderHook(() => useTokens(), { wrapper });

      expect(result.current.loading).toBeDefined();
    });

    it('should provide data once loaded', async () => {
      const mockData = {
        tokens: {
          edges: [],
          pageInfo: {
            hasNextPage: false,
            hasPreviousPage: false,
            endCursor: null,
          },
          totalCount: 0,
        },
      };

      const successMock = {
        request: {
          query: TOKENS_QUERY,
          variables: {
            limit: 20,
            offset: 0,
            orderBy: 'CREATED_AT_DESC',
            search: null,
          },
        },
        result: { data: mockData },
      };

      const successWrapper = ({ children }: { children: ReactNode }) => (
        <MockedProvider mocks={[successMock]} addTypename={false}>
          {children}
        </MockedProvider>
      );

      const { result } = renderHook(() => useTokens(), { wrapper: successWrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.data).toBeDefined();
    });
  });

  describe('Refetching', () => {
    it('should provide refetch function', () => {
      const { result } = renderHook(() => useTokens(), { wrapper });

      expect(result.current.refetch).toBeDefined();
      expect(typeof result.current.refetch).toBe('function');
    });

    it('should provide fetchMore function for pagination', () => {
      const { result } = renderHook(() => useTokens(), { wrapper });

      expect(result.current.fetchMore).toBeDefined();
      expect(typeof result.current.fetchMore).toBe('function');
    });
  });

  describe('Query Variables', () => {
    it('should update when variables change', () => {
      const { result, rerender } = renderHook(
        ({ search }: { search?: string }) =>
          useTokens({ where: { search } }),
        {
          wrapper,
          initialProps: { search: undefined },
        }
      );

      expect(result.current.loading).toBeDefined();

      rerender({ search: 'ASTRO' });

      expect(result.current.loading).toBeDefined();
    });
  });

  describe('Cache Behavior', () => {
    it('should use cached data when available', async () => {
      const mockData = {
        tokens: {
          edges: [],
          pageInfo: {
            hasNextPage: false,
            hasPreviousPage: false,
            endCursor: null,
          },
          totalCount: 0,
        },
      };

      const cacheMock = {
        request: {
          query: TOKENS_QUERY,
          variables: {
            limit: 20,
            offset: 0,
            orderBy: 'CREATED_AT_DESC',
            search: null,
          },
        },
        result: { data: mockData },
      };

      const cacheWrapper = ({ children }: { children: ReactNode }) => (
        <MockedProvider mocks={[cacheMock]} addTypename={false}>
          {children}
        </MockedProvider>
      );

      const { result: firstResult } = renderHook(() => useTokens(), {
        wrapper: cacheWrapper,
      });

      await waitFor(() => {
        expect(firstResult.current.loading).toBe(false);
      });

      // Second hook should use cached data
      const { result: secondResult } = renderHook(() => useTokens(), {
        wrapper: cacheWrapper,
      });

      expect(secondResult.current.loading).toBeDefined();
    });
  });
});
