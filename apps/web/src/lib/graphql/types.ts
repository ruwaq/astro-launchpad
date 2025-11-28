/**
 * GraphQL Types
 * Auto-generated types matching the API Gateway V2 schema
 */

// ============================================================================
// Enums
// ============================================================================

export enum OrderDirection {
  ASC = 'ASC',
  DESC = 'DESC',
}

export enum TokenOrderByField {
  CREATED_AT = 'CREATED_AT',
  NAME = 'NAME',
  VOLUME_24H = 'VOLUME_24H',
  MARKET_CAP = 'MARKET_CAP',
  HOLDERS = 'HOLDERS',
}

export enum PoolOrderByField {
  CREATED_AT = 'CREATED_AT',
  LIQUIDITY = 'LIQUIDITY',
  VOLUME_24H = 'VOLUME_24H',
  APY = 'APY',
}

export enum TransactionOrderByField {
  CREATED_AT = 'CREATED_AT',
  AMOUNT = 'AMOUNT',
}

export enum TransactionType {
  TOKEN_CREATED = 'TOKEN_CREATED',
  TOKEN_BOUGHT = 'TOKEN_BOUGHT',
  TOKEN_SOLD = 'TOKEN_SOLD',
  LIQUIDITY_ADDED = 'LIQUIDITY_ADDED',
  LIQUIDITY_REMOVED = 'LIQUIDITY_REMOVED',
  SWAP = 'SWAP',
}

export enum BondingCurveType {
  LINEAR = 'LINEAR',
  EXPONENTIAL = 'EXPONENTIAL',
  SIGMOID = 'SIGMOID',
}

// ============================================================================
// Input Types
// ============================================================================

export interface OrderByInput {
  field: TokenOrderByField | PoolOrderByField | TransactionOrderByField;
  direction: OrderDirection;
}

export interface TokenWhereInput {
  address?: string;
  creator?: string;
  search?: string;
  bondingCurve?: BondingCurveType;
}

export interface PoolWhereInput {
  address?: string;
  token0?: string;
  token1?: string;
}

export interface TransactionWhereInput {
  token?: string;
  pool?: string;
  user?: string;
  type?: TransactionType;
}

// ============================================================================
// Object Types
// ============================================================================

export interface PageInfo {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startCursor?: string | null;
  endCursor?: string | null;
}

export interface Token {
  id?: string;
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: string;
  circulatingSupply?: string;
  creator: string;
  bondingCurve: BondingCurveType;
  initialPrice: string;
  currentPrice: string;
  marketCap: string;
  volume24h: string;
  priceChange24h: string;
  holders: number;
  logoUrl?: string | null;
  imageUrl?: string | null;
  description?: string | null;
  website?: string | null;
  twitter?: string | null;
  telegram?: string | null;
  discord?: string | null;
  createdAt: string;
  updatedAt: string;
  pools?: PoolConnection;
  transactions?: TransactionConnection;
  holders24h?: number;
  holdersChange24h?: string;
  // Additional fields for graduation tracking
  graduated?: boolean;
  graduatedAt?: string;
  xlmRaised?: string;
  xlmReserve?: string;
}

export interface TokenEdge {
  cursor: string;
  node: Token;
}

export interface TokenConnection {
  edges: TokenEdge[];
  pageInfo: PageInfo;
  totalCount: number;
}

export interface Pool {
  address: string;
  token0: Token;
  token1: Token;
  reserve0: string;
  reserve1: string;
  liquidity: string;
  volume24h: string;
  volumeChange24h: string;
  apy: string;
  fee: string;
  createdAt: string;
  updatedAt: string;
  transactions: TransactionConnection;
}

export interface PoolEdge {
  cursor: string;
  node: Pool;
}

export interface PoolConnection {
  edges: PoolEdge[];
  pageInfo: PageInfo;
  totalCount: number;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  user: string;
  token?: Token | null;
  pool?: Pool | null;
  amount0: string;
  amount1: string;
  amountUSD: string;
  txHash: string;
  timestamp: string;
  createdAt: string;
}

export interface TransactionEdge {
  cursor: string;
  node: Transaction;
}

export interface TransactionConnection {
  edges: TransactionEdge[];
  pageInfo: PageInfo;
  totalCount: number;
}

export interface GlobalStats {
  totalTokens: number;
  totalPools: number;
  totalUsers: number;
  totalVolume24h: string;
  totalTVL: string;
}

export interface LeaderboardUser {
  id: string;
  address: string;
  points: number;
  level: number;
  referrals: number;
  tokensCreatedCount: number;
  totalVolumeTraded: string;
  totalLiquidityProvided: string;
  createdAt: string;
}

export interface LeaderboardEntry {
  rank: number;
  address: string;
  user?: LeaderboardUser | null;
  volume24h: string;
  trades24h: number;
  profitLoss24h: string;
  tokensCreated?: number;
  totalVolumeGenerated?: string;
  totalLiquidity?: string;
  feesEarned24h?: string;
}

export interface SearchResult {
  tokens: Token[];
  pools: Pool[];
}

export interface CacheStatus {
  available: boolean;
  type: string;
}

export interface HealthStatus {
  status: string;
  timestamp: string;
  version: string;
  database: boolean;
  cache: CacheStatus;
}

// ============================================================================
// Query Response Types
// ============================================================================

export interface TokensQueryResponse {
  tokens: TokenConnection;
}

export interface TrendingTokensQueryResponse {
  trendingTokens: Token[];
}

export interface TokenQueryResponse {
  token: Token | null;
}

export interface PoolsQueryResponse {
  pools: PoolConnection;
}

export interface PoolQueryResponse {
  pool: Pool | null;
}

export interface TransactionsQueryResponse {
  transactions: TransactionConnection;
}

export interface GlobalStatsQueryResponse {
  globalStats: GlobalStats;
}

export interface LeaderboardQueryResponse {
  leaderboard: LeaderboardEntry[];
}

export interface SearchQueryResponse {
  search: SearchResult;
}

export interface HealthQueryResponse {
  health: HealthStatus;
}
