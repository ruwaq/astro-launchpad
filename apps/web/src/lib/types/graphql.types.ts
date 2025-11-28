/**
 * GraphQL Types - Centralized type definitions for GraphQL queries
 *
 * This file contains type definitions that match our GraphQL schema,
 * providing type safety across the application.
 */

// ============================================================================
// Base Types
// ============================================================================

/** GraphQL Connection Edge wrapper */
export interface Edge<T> {
  node: T;
  cursor?: string;
}

/** GraphQL Connection response */
export interface Connection<T> {
  edges: Edge<T>[];
  pageInfo?: {
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    startCursor?: string;
    endCursor?: string;
  };
  totalCount?: number;
}

// ============================================================================
// Token Types
// ============================================================================

/** Token status from contract */
export type TokenStatus = 'Bonding' | 'Graduated';

/** Bonding curve state */
export interface BondingCurve {
  xlmReserve: string;
  tokenReserve: string;
  k: string;
}

/** Token data from GraphQL */
export interface TokenGraphQL {
  id?: string;
  address: string;
  name: string;
  symbol: string;
  description?: string | null;
  imageUrl?: string | null;
  logoUrl?: string | null;
  creator: string;
  issuer?: string;
  status?: TokenStatus;
  currentPrice?: string;
  priceChange24h?: string | number;
  volume24h?: string;
  marketCap?: string;
  circulatingSupply?: string;
  totalSupply?: string;
  xlmRaised?: string;
  xlmReserve?: string;
  holders?: number;
  holdersCount?: number;
  graduated?: boolean;
  graduatedAt?: string;
  createdAt: string;
  updatedAt?: string;
  bondingCurve?: BondingCurve;
}

/** Token edge type for GraphQL connections */
export type TokenEdge = Edge<TokenGraphQL>;

/** Token connection type */
export type TokenConnection = Connection<TokenGraphQL>;

// ============================================================================
// Transaction Types
// ============================================================================

/** Transaction type enum */
export type TransactionType = 'BUY' | 'SELL' | 'CREATE' | 'GRADUATE';

/** Transaction data from GraphQL */
export interface TransactionGraphQL {
  id: string;
  hash: string;
  type: TransactionType;
  tokenAddress: string;
  userAddress: string;
  xlmAmount: string;
  tokenAmount: string;
  price?: string;
  priceImpact?: string;
  fee?: string;
  timestamp: string;
  createdAt: string;
  token?: TokenGraphQL;
}

/** Transaction edge type */
export type TransactionEdge = Edge<TransactionGraphQL>;

/** Transaction connection type */
export type TransactionConnection = Connection<TransactionGraphQL>;

// ============================================================================
// Pool Types (AstroSwap DEX)
// ============================================================================

/** Pool data from GraphQL */
export interface PoolGraphQL {
  id: string;
  address: string;
  token0: string;
  token1: string;
  token0Symbol?: string;
  token1Symbol?: string;
  reserve0: string;
  reserve1: string;
  totalLiquidity: string;
  volume24h?: string;
  fees24h?: string;
  apr?: string;
  createdAt: string;
}

/** Pool edge type */
export type PoolEdge = Edge<PoolGraphQL>;

/** Pool connection type */
export type PoolConnection = Connection<PoolGraphQL>;

// ============================================================================
// Leaderboard Types
// ============================================================================

/** Leaderboard entry */
export interface LeaderboardEntry {
  rank: number;
  address: string;
  username?: string;
  avatar?: string;
  totalVolume: string;
  totalTrades: number;
  profitLoss?: string;
  winRate?: string;
  streak?: number;
  badges?: string[];
}

// ============================================================================
// User/Holder Types
// ============================================================================

/** Token holder data */
export interface HolderGraphQL {
  id: string;
  address: string;
  tokenAddress: string;
  balance: string;
  percentage?: string;
  firstBuyAt?: string;
  lastActivityAt?: string;
}

/** Holder edge type */
export type HolderEdge = Edge<HolderGraphQL>;

// ============================================================================
// Error Types
// ============================================================================

/** GraphQL error structure */
export interface GraphQLError {
  message: string;
  locations?: Array<{ line: number; column: number }>;
  path?: string[];
  extensions?: Record<string, unknown>;
}

/** API error response */
export interface APIError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

// ============================================================================
// Utility Types
// ============================================================================

/** Extract node type from edge */
export type NodeType<E> = E extends Edge<infer T> ? T : never;

/** Make specific properties optional */
export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/** Make specific properties required */
export type RequiredBy<T, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>;
