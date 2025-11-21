/**
 * Shared TypeScript types and interfaces
 * Used across api-gateway and indexer
 */

import type { PrismaClient } from '@prisma/client'

/**
 * GraphQL Context type
 * Available in all resolvers
 */
export interface GraphQLContext {
  prisma: PrismaClient
  request: {
    headers: Record<string, string>
    ip: string
  }
  loaders: DataLoaders
  user?: AuthenticatedUser
}

/**
 * Authenticated user information
 */
export interface AuthenticatedUser {
  address: string
  signature: string
  timestamp: number
}

/**
 * DataLoaders for batching and caching
 */
export interface DataLoaders {
  tokenLoader: DataLoader<string, Token>
  userLoader: DataLoader<string, User>
  poolLoader: DataLoader<string, Pool>
  tokensByCreatorLoader: DataLoader<string, Token[]>
  poolsByTokenLoader: DataLoader<string, Pool[]>
}

/**
 * Generic DataLoader interface
 */
export interface DataLoader<K, V> {
  load(key: K): Promise<V | null>
  loadMany(keys: readonly K[]): Promise<(V | null)[]>
  clear(key: K): void
  clearAll(): void
  prime(key: K, value: V): void
}

/**
 * Token entity from database
 */
export interface Token {
  id: string
  address: string
  creator: string
  name: string
  symbol: string
  decimals: number
  totalSupply: string
  metadataUri: string
  imageUrl: string | null
  description: string | null
  circulatingSupply: string
  xlmReserve: string
  graduated: boolean
  xlmRaised: string
  marketCap: string | null
  currentPrice: string | null
  priceChange24h: number | null
  volume24h: string
  volume7d: string
  holders: number
  createdAt: Date
  updatedAt: Date
}

/**
 * Pool entity from database
 */
export interface Pool {
  id: string
  address: string
  token0Address: string
  token1Address: string
  reserve0: string
  reserve1: string
  totalSupply: string
  tvl: string | null
  volume24h: string
  volume7d: string
  apr: number | null
  createdAt: Date
  updatedAt: Date
}

/**
 * User entity from database
 */
export interface User {
  id: string
  address: string
  points: number
  level: number
  referrals: number
  tokensCreatedCount: number
  totalVolumeTraded: string
  totalLiquidityProvided: string
  createdAt: Date
  updatedAt: Date
}

/**
 * Stellar event from Soroban
 */
export interface StellarEvent {
  type: string
  ledger: string
  ledgerClosedAt: string
  contractId: string
  id: string
  pagingToken: string
  topic: string[]
  value: {
    xdr: string
  }
  inSuccessfulContractCall: boolean
  txHash: string
}

/**
 * Parsed token created event
 */
export interface TokenCreatedEvent {
  tokenAddress: string
  creator: string
  name: string
  symbol: string
  curveType: number
  basePrice: string
  maxSupply: string
  timestamp: Date
}

/**
 * Parsed token trade event
 */
export interface TokenTradeEvent {
  tokenAddress: string
  trader: string
  xlmAmount: string
  tokenAmount: string
  isBuy: boolean
  timestamp: Date
}

/**
 * Cache entry with TTL
 */
export interface CacheEntry<T> {
  value: T
  expiresAt: number
}

/**
 * Cache strategy options
 */
export interface CacheStrategy {
  ttl: number // Time to live in seconds
  swr?: number // Stale-while-revalidate in seconds
  tags?: string[] // Cache tags for invalidation
}

/**
 * Rate limit information
 */
export interface RateLimitInfo {
  limit: number
  remaining: number
  reset: Date
}

/**
 * API Response wrapper
 */
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
    details?: any
  }
  meta?: {
    page?: number
    limit?: number
    total?: number
  }
}

/**
 * Pagination parameters
 */
export interface PaginationParams {
  page?: number
  limit?: number
  offset?: number
}

/**
 * Sort parameters
 */
export interface SortParams<T = string> {
  field: T
  direction: 'asc' | 'desc'
}

/**
 * Filter operators
 */
export type FilterOperator =
  | 'eq'
  | 'ne'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'in'
  | 'notIn'
  | 'contains'
  | 'startsWith'
  | 'endsWith'

/**
 * Generic filter condition
 */
export interface FilterCondition<T = any> {
  field: string
  operator: FilterOperator
  value: T
}

/**
 * Metrics data point
 */
export interface MetricDataPoint {
  timestamp: Date
  value: number
  labels?: Record<string, string>
}

/**
 * Health check result
 */
export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy'
  checks: {
    database: boolean
    redis?: boolean
    stellar?: boolean
  }
  timestamp: Date
  version: string
}

/**
 * Indexer state
 */
export interface IndexerState {
  contractName: string
  lastLedger: string
  lastEventId: string | null
  lastProcessedAt: Date
  isHealthy: boolean
}

/**
 * Utility type: Make all properties optional
 */
export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>

/**
 * Utility type: Make all properties required
 */
export type RequiredBy<T, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>

/**
 * Utility type: Extract promise type
 */
export type UnwrapPromise<T> = T extends Promise<infer U> ? U : T

/**
 * Utility type: Array element type
 */
export type ArrayElement<T> = T extends readonly (infer U)[] ? U : never
