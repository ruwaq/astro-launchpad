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
      version
      database
      cache {
        available
        type
      }
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
    $limit: Int = 20
    $offset: Int = 0
    $orderBy: TokenOrderBy = CREATED_AT_DESC
    $search: String
  ) {
    tokens(
      limit: $limit
      offset: $offset
      orderBy: $orderBy
      search: $search
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
  query Token($address: String!) {
    token(address: $address) {
      ...TokenFullFragment
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

export const TRENDING_TOKENS_QUERY = gql`
  query TrendingTokens($limit: Int = 10) {
    trendingTokens(limit: $limit) {
      address
      name
      symbol
      imageUrl
      logoUrl
      currentPrice
      priceChange24h
      volume24h
      marketCap
      circulatingSupply
      xlmRaised
      xlmReserve
      graduated
      createdAt
    }
  }
`;

export const NEW_TOKENS_QUERY = gql`
  ${TOKEN_BASIC_FRAGMENT}
  ${PAGE_INFO_FRAGMENT}
  query NewTokens($limit: Int = 10) {
    tokens(
      limit: $limit
      orderBy: CREATED_AT_DESC
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
  query TopGainers($limit: Int = 10) {
    tokens(
      limit: $limit
      orderBy: VOLUME_DESC
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
    $limit: Int = 20
    $offset: Int = 0
  ) {
    pools(
      limit: $limit
      offset: $offset
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
  query Pool($address: String!) {
    pool(address: $address) {
      ...PoolFullFragment
    }
  }
`;

export const TOP_POOLS_QUERY = gql`
  ${POOL_FULL_FRAGMENT}
  ${PAGE_INFO_FRAGMENT}
  query TopPools($limit: Int = 10) {
    pools(
      limit: $limit
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
    $address: String
    $tokenAddress: String
    $type: TransactionType
    $limit: Int = 20
    $offset: Int = 0
  ) {
    transactions(
      address: $address
      tokenAddress: $tokenAddress
      type: $type
      limit: $limit
      offset: $offset
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
  query RecentTransactions($limit: Int = 20) {
    transactions(
      limit: $limit
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
  query UserTransactions($address: String!, $limit: Int = 50) {
    transactions(
      address: $address
      limit: $limit
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
  query Leaderboard(
    $type: LeaderboardType = TRADERS
    $limit: Int = 100
    $timeframe: LeaderboardTimeframe = DAY
  ) {
    leaderboard(type: $type, limit: $limit, timeframe: $timeframe) {
      ...LeaderboardEntryFragment
    }
  }
`;

// ============================================================================
// Search
// ============================================================================

export const SEARCH_QUERY = gql`
  ${TOKEN_BASIC_FRAGMENT}
  ${PAGE_INFO_FRAGMENT}
  query Search($query: String!, $limit: Int = 10) {
    tokens(search: $query, limit: $limit) {
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
// Token Details (for trading page)
// ============================================================================

export const GET_TOKEN_DETAILS = gql`
  ${TOKEN_FULL_FRAGMENT}
  query GetTokenDetails($address: String!) {
    token(address: $address) {
      ...TokenFullFragment
      circulatingSupply
      xlmReserve
      xlmRaised
      graduated
    }
  }
`;
