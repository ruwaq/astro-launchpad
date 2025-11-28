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
    id
    address
    creator
    name
    symbol
    decimals
    totalSupply
    metadataUri
    imageUrl
    logoUrl
    description
    bondingCurve
    circulatingSupply
    xlmReserve
    graduated
    xlmRaised
    initialPrice
    marketCap
    currentPrice
    priceChange24h
    volume24h
    volume7d
    holders
    holders24h
    holdersChange24h
    website
    twitter
    telegram
    discord
    createdAt
    updatedAt
  }
`;

export const TOKEN_FULL_FRAGMENT = gql`
  ${TOKEN_BASIC_FRAGMENT}
  fragment TokenFullFragment on Token {
    ...TokenBasicFragment
    creatorUser {
      id
      address
      points
      level
    }
    pools {
      address
      token0Address
      token1Address
    }
  }
`;

// ============================================================================
// Pool Fragments
// ============================================================================

export const POOL_BASIC_FRAGMENT = gql`
  fragment PoolBasicFragment on Pool {
    id
    address
    token0Address
    token1Address
    reserve0
    reserve1
    totalSupply
    liquidity
    tvl
    volume24h
    volume7d
    volumeChange24h
    apr
    apy
    fee
    createdAt
    updatedAt
  }
`;

export const POOL_FULL_FRAGMENT = gql`
  ${POOL_BASIC_FRAGMENT}
  fragment PoolFullFragment on Pool {
    ...PoolBasicFragment
    token0 {
      id
      address
      name
      symbol
      logoUrl
      currentPrice
    }
    token1 {
      id
      address
      name
      symbol
      logoUrl
      currentPrice
    }
  }
`;

// ============================================================================
// Transaction Fragments
// ============================================================================

export const TRANSACTION_BASIC_FRAGMENT = gql`
  fragment TransactionBasicFragment on Transaction {
    id
    hash
    type
    from
    to
    tokenAddress
    amount
    status
    timestamp
  }
`;

export const TRANSACTION_FULL_FRAGMENT = gql`
  ${TRANSACTION_BASIC_FRAGMENT}
  fragment TransactionFullFragment on Transaction {
    ...TransactionBasicFragment
    token {
      id
      address
      name
      symbol
      logoUrl
      currentPrice
    }
    user {
      id
      address
      points
      level
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
    totalUsers
    totalVolume24h
    totalTVL
  }
`;

// ============================================================================
// Leaderboard Fragment
// ============================================================================

export const LEADERBOARD_ENTRY_FRAGMENT = gql`
  fragment LeaderboardEntryFragment on LeaderboardEntry {
    rank
    address
    user {
      id
      address
      points
      level
      referrals
      tokensCreatedCount
      totalVolumeTraded
      totalLiquidityProvided
      createdAt
    }
    volume24h
    trades24h
    profitLoss24h
    tokensCreated
    totalVolumeGenerated
    totalLiquidity
    feesEarned24h
  }
`;
