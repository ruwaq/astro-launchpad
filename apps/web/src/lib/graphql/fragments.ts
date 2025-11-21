/**
 * GraphQL Fragments
 * Reusable query fragments for consistent data fetching
 */

import { gql } from '@apollo/client';

// ============================================================================
// PageInfo Fragment
// ============================================================================

export const PAGE_INFO_FRAGMENT = gql`
  fragment PageInfoFragment on PageInfo {
    hasNextPage
    hasPreviousPage
    startCursor
    endCursor
  }
`;

// ============================================================================
// Token Fragments
// ============================================================================

export const TOKEN_BASIC_FRAGMENT = gql`
  fragment TokenBasicFragment on Token {
    address
    name
    symbol
    decimals
    totalSupply
    creator
    bondingCurve
    currentPrice
    marketCap
    volume24h
    priceChange24h
    holders
    logoUrl
    createdAt
  }
`;

export const TOKEN_FULL_FRAGMENT = gql`
  ${TOKEN_BASIC_FRAGMENT}
  fragment TokenFullFragment on Token {
    ...TokenBasicFragment
    initialPrice
    description
    website
    twitter
    telegram
    discord
    updatedAt
    holders24h
    holdersChange24h
  }
`;

// ============================================================================
// Pool Fragments
// ============================================================================

export const POOL_BASIC_FRAGMENT = gql`
  fragment PoolBasicFragment on Pool {
    address
    reserve0
    reserve1
    liquidity
    volume24h
    volumeChange24h
    apy
    fee
    createdAt
  }
`;

export const POOL_FULL_FRAGMENT = gql`
  ${POOL_BASIC_FRAGMENT}
  ${TOKEN_BASIC_FRAGMENT}
  fragment PoolFullFragment on Pool {
    ...PoolBasicFragment
    token0 {
      ...TokenBasicFragment
    }
    token1 {
      ...TokenBasicFragment
    }
    updatedAt
  }
`;

// ============================================================================
// Transaction Fragments
// ============================================================================

export const TRANSACTION_BASIC_FRAGMENT = gql`
  fragment TransactionBasicFragment on Transaction {
    id
    type
    user
    amount0
    amount1
    amountUSD
    txHash
    timestamp
    createdAt
  }
`;

export const TRANSACTION_FULL_FRAGMENT = gql`
  ${TRANSACTION_BASIC_FRAGMENT}
  ${TOKEN_BASIC_FRAGMENT}
  ${POOL_BASIC_FRAGMENT}
  fragment TransactionFullFragment on Transaction {
    ...TransactionBasicFragment
    token {
      ...TokenBasicFragment
    }
    pool {
      ...PoolBasicFragment
    }
  }
`;

// ============================================================================
// Global Stats Fragment
// ============================================================================

export const GLOBAL_STATS_FRAGMENT = gql`
  fragment GlobalStatsFragment on GlobalStats {
    totalTokens
    totalPools
    totalVolume24h
    totalVolumeChange24h
    totalLiquidity
    totalLiquidityChange24h
    totalTransactions
    totalUsers
  }
`;

// ============================================================================
// Leaderboard Fragment
// ============================================================================

export const LEADERBOARD_ENTRY_FRAGMENT = gql`
  fragment LeaderboardEntryFragment on LeaderboardEntry {
    address
    volume24h
    trades24h
    profitLoss24h
    rank
  }
`;
