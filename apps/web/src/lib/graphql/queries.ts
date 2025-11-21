/**
 * GraphQL Queries
 * All queries for fetching data from the API Gateway V2
 */

import { gql } from '@apollo/client';
import {
  TOKEN_BASIC_FRAGMENT,
  TOKEN_FULL_FRAGMENT,
  POOL_BASIC_FRAGMENT,
  POOL_FULL_FRAGMENT,
  TRANSACTION_BASIC_FRAGMENT,
  TRANSACTION_FULL_FRAGMENT,
  GLOBAL_STATS_FRAGMENT,
  LEADERBOARD_ENTRY_FRAGMENT,
  PAGE_INFO_FRAGMENT,
} from './fragments';

// ============================================================================
// Health & Status
// ============================================================================

export const HEALTH_QUERY = gql`
  query Health {
    health {
      status
      timestamp
      uptime
      database
      cache
    }
  }
`;

// ============================================================================
// Tokens
// ============================================================================

export const TOKENS_QUERY = gql`
  ${TOKEN_BASIC_FRAGMENT}
  ${PAGE_INFO_FRAGMENT}
  query Tokens(
    $first: Int
    $after: String
    $orderBy: TokenOrderByInput
    $where: TokenWhereInput
  ) {
    tokens(
      first: $first
      after: $after
      orderBy: $orderBy
      where: $where
    ) {
      edges {
        cursor
        node {
          ...TokenBasicFragment
        }
      }
      pageInfo {
        ...PageInfoFragment
      }
      totalCount
    }
  }
`;

export const TOKEN_QUERY = gql`
  ${TOKEN_FULL_FRAGMENT}
  ${POOL_BASIC_FRAGMENT}
  ${TRANSACTION_BASIC_FRAGMENT}
  ${PAGE_INFO_FRAGMENT}
  query Token($address: String!) {
    token(address: $address) {
      ...TokenFullFragment
      pools(first: 10, orderBy: { field: LIQUIDITY, direction: DESC }) {
        edges {
          cursor
          node {
            ...PoolBasicFragment
            token0 {
              address
              symbol
            }
            token1 {
              address
              symbol
            }
          }
        }
        pageInfo {
          ...PageInfoFragment
        }
      }
      transactions(first: 20, orderBy: { field: CREATED_AT, direction: DESC }) {
        edges {
          cursor
          node {
            ...TransactionBasicFragment
          }
        }
        pageInfo {
          ...PageInfoFragment
        }
      }
    }
  }
`;

export const TRENDING_TOKENS_QUERY = gql`
  ${TOKEN_BASIC_FRAGMENT}
  ${PAGE_INFO_FRAGMENT}
  query TrendingTokens($first: Int = 10) {
    tokens(
      first: $first
      orderBy: { field: VOLUME_24H, direction: DESC }
    ) {
      edges {
        cursor
        node {
          ...TokenBasicFragment
        }
      }
      pageInfo {
        ...PageInfoFragment
      }
      totalCount
    }
  }
`;

export const NEW_TOKENS_QUERY = gql`
  ${TOKEN_BASIC_FRAGMENT}
  ${PAGE_INFO_FRAGMENT}
  query NewTokens($first: Int = 10) {
    tokens(
      first: $first
      orderBy: { field: CREATED_AT, direction: DESC }
    ) {
      edges {
        cursor
        node {
          ...TokenBasicFragment
        }
      }
      pageInfo {
        ...PageInfoFragment
      }
      totalCount
    }
  }
`;

export const TOP_GAINERS_QUERY = gql`
  ${TOKEN_BASIC_FRAGMENT}
  ${PAGE_INFO_FRAGMENT}
  query TopGainers($first: Int = 10) {
    tokens(
      first: $first
      orderBy: { field: VOLUME_24H, direction: DESC }
    ) {
      edges {
        cursor
        node {
          ...TokenBasicFragment
        }
      }
      pageInfo {
        ...PageInfoFragment
      }
      totalCount
    }
  }
`;

// ============================================================================
// Pools
// ============================================================================

export const POOLS_QUERY = gql`
  ${POOL_FULL_FRAGMENT}
  ${PAGE_INFO_FRAGMENT}
  query Pools(
    $first: Int
    $after: String
    $orderBy: PoolOrderByInput
    $where: PoolWhereInput
  ) {
    pools(
      first: $first
      after: $after
      orderBy: $orderBy
      where: $where
    ) {
      edges {
        cursor
        node {
          ...PoolFullFragment
        }
      }
      pageInfo {
        ...PageInfoFragment
      }
      totalCount
    }
  }
`;

export const POOL_QUERY = gql`
  ${POOL_FULL_FRAGMENT}
  ${TRANSACTION_FULL_FRAGMENT}
  ${PAGE_INFO_FRAGMENT}
  query Pool($address: String!) {
    pool(address: $address) {
      ...PoolFullFragment
      transactions(first: 50, orderBy: { field: CREATED_AT, direction: DESC }) {
        edges {
          cursor
          node {
            ...TransactionFullFragment
          }
        }
        pageInfo {
          ...PageInfoFragment
        }
      }
    }
  }
`;

export const TOP_POOLS_QUERY = gql`
  ${POOL_FULL_FRAGMENT}
  ${PAGE_INFO_FRAGMENT}
  query TopPools($first: Int = 10) {
    pools(
      first: $first
      orderBy: { field: LIQUIDITY, direction: DESC }
    ) {
      edges {
        cursor
        node {
          ...PoolFullFragment
        }
      }
      pageInfo {
        ...PageInfoFragment
      }
      totalCount
    }
  }
`;

// ============================================================================
// Transactions
// ============================================================================

export const TRANSACTIONS_QUERY = gql`
  ${TRANSACTION_FULL_FRAGMENT}
  ${PAGE_INFO_FRAGMENT}
  query Transactions(
    $first: Int
    $after: String
    $orderBy: TransactionOrderByInput
    $where: TransactionWhereInput
  ) {
    transactions(
      first: $first
      after: $after
      orderBy: $orderBy
      where: $where
    ) {
      edges {
        cursor
        node {
          ...TransactionFullFragment
        }
      }
      pageInfo {
        ...PageInfoFragment
      }
      totalCount
    }
  }
`;

export const RECENT_TRANSACTIONS_QUERY = gql`
  ${TRANSACTION_BASIC_FRAGMENT}
  ${PAGE_INFO_FRAGMENT}
  query RecentTransactions($first: Int = 20) {
    transactions(
      first: $first
      orderBy: { field: CREATED_AT, direction: DESC }
    ) {
      edges {
        cursor
        node {
          ...TransactionBasicFragment
          token {
            address
            symbol
            logoUrl
          }
        }
      }
      pageInfo {
        ...PageInfoFragment
      }
      totalCount
    }
  }
`;

export const USER_TRANSACTIONS_QUERY = gql`
  ${TRANSACTION_FULL_FRAGMENT}
  ${PAGE_INFO_FRAGMENT}
  query UserTransactions($user: String!, $first: Int = 50) {
    transactions(
      where: { user: $user }
      first: $first
      orderBy: { field: CREATED_AT, direction: DESC }
    ) {
      edges {
        cursor
        node {
          ...TransactionFullFragment
        }
      }
      pageInfo {
        ...PageInfoFragment
      }
      totalCount
    }
  }
`;

// ============================================================================
// Global Stats
// ============================================================================

export const GLOBAL_STATS_QUERY = gql`
  ${GLOBAL_STATS_FRAGMENT}
  query GlobalStats {
    globalStats {
      ...GlobalStatsFragment
    }
  }
`;

// ============================================================================
// Leaderboard
// ============================================================================

export const LEADERBOARD_QUERY = gql`
  ${LEADERBOARD_ENTRY_FRAGMENT}
  query Leaderboard($limit: Int = 100) {
    leaderboard(limit: $limit) {
      ...LeaderboardEntryFragment
    }
  }
`;

// ============================================================================
// Search
// ============================================================================

export const SEARCH_QUERY = gql`
  ${TOKEN_BASIC_FRAGMENT}
  ${POOL_BASIC_FRAGMENT}
  query Search($query: String!, $limit: Int = 10) {
    search(query: $query, limit: $limit) {
      tokens {
        ...TokenBasicFragment
      }
      pools {
        ...PoolBasicFragment
        token0 {
          address
          symbol
        }
        token1 {
          address
          symbol
        }
      }
    }
  }
`;
