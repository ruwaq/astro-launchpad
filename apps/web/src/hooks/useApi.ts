/**
 * Custom hooks for API Gateway V2
 * Provides clean interfaces for fetching data from the backend via GraphQL
 */

'use client';

import { useQuery, useLazyQuery } from '@apollo/client';
import type { QueryHookOptions } from '@apollo/client';
import {
  TOKENS_QUERY,
  TOKEN_QUERY,
  POOLS_QUERY,
  POOL_QUERY,
  TRANSACTIONS_QUERY,
  RECENT_TRANSACTIONS_QUERY,
  USER_TRANSACTIONS_QUERY,
  GLOBAL_STATS_QUERY,
  LEADERBOARD_QUERY,
  SEARCH_QUERY,
  TRENDING_TOKENS_QUERY,
  NEW_TOKENS_QUERY,
  TOP_GAINERS_QUERY,
  TOP_POOLS_QUERY,
  HEALTH_QUERY,
  type TokensQueryResponse,
  type TokenQueryResponse,
  type PoolsQueryResponse,
  type PoolQueryResponse,
  type TransactionsQueryResponse,
  type GlobalStatsQueryResponse,
  type LeaderboardQueryResponse,
  type SearchQueryResponse,
  type HealthQueryResponse,
  type OrderByInput,
  type TokenWhereInput,
  type PoolWhereInput,
  type TransactionWhereInput,
} from '@/lib/graphql';

// ============================================================================
// Configuration
// ============================================================================

const CACHE_DURATION = parseInt(process.env.NEXT_PUBLIC_CACHE_DURATION || '30000', 10);
const POLLING_INTERVAL = parseInt(process.env.NEXT_PUBLIC_POLLING_INTERVAL || '60000', 10);

// ============================================================================
// Health & Status
// ============================================================================

export function useHealth(options?: QueryHookOptions<HealthQueryResponse>) {
  return useQuery<HealthQueryResponse>(HEALTH_QUERY, {
    pollInterval: POLLING_INTERVAL,
    ...options,
  });
}

// ============================================================================
// Tokens
// ============================================================================

export interface UseTokensOptions {
  first?: number;
  after?: string;
  orderBy?: OrderByInput;
  where?: TokenWhereInput;
  pollInterval?: number;
}

export function useTokens(options?: UseTokensOptions) {
  return useQuery<TokensQueryResponse>(TOKENS_QUERY, {
    variables: {
      first: options?.first || 20,
      after: options?.after,
      orderBy: options?.orderBy || { field: 'CREATED_AT', direction: 'DESC' },
      where: options?.where,
    },
    pollInterval: options?.pollInterval,
  });
}

export function useToken(address: string, options?: QueryHookOptions<TokenQueryResponse>) {
  return useQuery<TokenQueryResponse>(TOKEN_QUERY, {
    variables: { address },
    skip: !address,
    ...options,
  });
}

export function useTrendingTokens(first = 10, options?: QueryHookOptions<TokensQueryResponse>) {
  return useQuery<TokensQueryResponse>(TRENDING_TOKENS_QUERY, {
    variables: { first },
    pollInterval: POLLING_INTERVAL,
    ...options,
  });
}

export function useNewTokens(first = 10, options?: QueryHookOptions<TokensQueryResponse>) {
  return useQuery<TokensQueryResponse>(NEW_TOKENS_QUERY, {
    variables: { first },
    pollInterval: POLLING_INTERVAL / 2,
    ...options,
  });
}

export function useTopGainers(first = 10, options?: QueryHookOptions<TokensQueryResponse>) {
  return useQuery<TokensQueryResponse>(TOP_GAINERS_QUERY, {
    variables: { first },
    pollInterval: POLLING_INTERVAL,
    ...options,
  });
}

// ============================================================================
// Pools
// ============================================================================

export interface UsePoolsOptions {
  first?: number;
  after?: string;
  orderBy?: OrderByInput;
  where?: PoolWhereInput;
  pollInterval?: number;
}

export function usePools(options?: UsePoolsOptions) {
  return useQuery<PoolsQueryResponse>(POOLS_QUERY, {
    variables: {
      first: options?.first || 20,
      after: options?.after,
      orderBy: options?.orderBy || { field: 'LIQUIDITY', direction: 'DESC' },
      where: options?.where,
    },
    pollInterval: options?.pollInterval,
  });
}

export function usePool(address: string, options?: QueryHookOptions<PoolQueryResponse>) {
  return useQuery<PoolQueryResponse>(POOL_QUERY, {
    variables: { address },
    skip: !address,
    ...options,
  });
}

export function useTopPools(first = 10, options?: QueryHookOptions<PoolsQueryResponse>) {
  return useQuery<PoolsQueryResponse>(TOP_POOLS_QUERY, {
    variables: { first },
    pollInterval: POLLING_INTERVAL,
    ...options,
  });
}

// ============================================================================
// Transactions
// ============================================================================

export interface UseTransactionsOptions {
  first?: number;
  after?: string;
  orderBy?: OrderByInput;
  where?: TransactionWhereInput;
  pollInterval?: number;
}

export function useTransactions(options?: UseTransactionsOptions) {
  return useQuery<TransactionsQueryResponse>(TRANSACTIONS_QUERY, {
    variables: {
      first: options?.first || 20,
      after: options?.after,
      orderBy: options?.orderBy || { field: 'CREATED_AT', direction: 'DESC' },
      where: options?.where,
    },
    pollInterval: options?.pollInterval,
  });
}

export function useRecentTransactions(
  first = 20,
  options?: QueryHookOptions<TransactionsQueryResponse>
) {
  return useQuery<TransactionsQueryResponse>(RECENT_TRANSACTIONS_QUERY, {
    variables: { first },
    pollInterval: POLLING_INTERVAL / 2,
    ...options,
  });
}

export function useUserTransactions(
  user: string,
  first = 50,
  options?: QueryHookOptions<TransactionsQueryResponse>
) {
  return useQuery<TransactionsQueryResponse>(USER_TRANSACTIONS_QUERY, {
    variables: { user, first },
    skip: !user,
    ...options,
  });
}

// ============================================================================
// Global Stats
// ============================================================================

export function useGlobalStats(options?: QueryHookOptions<GlobalStatsQueryResponse>) {
  return useQuery<GlobalStatsQueryResponse>(GLOBAL_STATS_QUERY, {
    pollInterval: POLLING_INTERVAL,
    ...options,
  });
}

// ============================================================================
// Leaderboard
// ============================================================================

export function useLeaderboard(
  limit = 100,
  options?: QueryHookOptions<LeaderboardQueryResponse>
) {
  return useQuery<LeaderboardQueryResponse>(LEADERBOARD_QUERY, {
    variables: { limit },
    pollInterval: POLLING_INTERVAL * 2,
    ...options,
  });
}

// ============================================================================
// Search
// ============================================================================

export function useSearch() {
  const [search, { data, loading, error }] = useLazyQuery<SearchQueryResponse>(SEARCH_QUERY);

  const searchTokensAndPools = (query: string, limit = 10) => {
    if (!query || query.length < 2) {
      return;
    }
    search({ variables: { query, limit } });
  };

  return {
    search: searchTokensAndPools,
    data,
    loading,
    error,
  };
}

// ============================================================================
// Pagination Helper
// ============================================================================

export function usePagination<T>(
  initialData: { edges: any[]; pageInfo: any },
  fetchMore: (cursor: string) => void
) {
  const loadMore = () => {
    if (initialData?.pageInfo?.hasNextPage && initialData?.pageInfo?.endCursor) {
      fetchMore(initialData.pageInfo.endCursor);
    }
  };

  return {
    hasMore: initialData?.pageInfo?.hasNextPage || false,
    loadMore,
    cursor: initialData?.pageInfo?.endCursor,
  };
}
