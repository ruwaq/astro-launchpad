// Shared TypeScript types for AstroShibaPop

export interface Token {
  address: string;
  creator: string;
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: string;
  imageUrl?: string;
  description?: string;
  metadataUri: string;
  createdAt: Date;

  // Bonding curve state
  bondingCurve?: BondingCurve;
  graduated: boolean;
  xlmRaised: string;

  // Calculated fields
  marketCap?: string;
  price?: string;
  priceChange24h?: number;
  volume24h?: string;
  holders?: number;
}

export interface BondingCurve {
  circulatingSupply: string;
  totalSupply: string;
  basePrice: string;
  k: string;
  xlmReserve: string;
}

export interface Pool {
  address: string;
  token0: Token;
  token1: Token;
  reserve0: string;
  reserve1: string;
  totalSupply: string;
  createdAt: Date;

  // Calculated fields
  tvl?: string;
  volume24h?: string;
  volume7d?: string;
  apr?: number;
}

export interface User {
  address: string;
  tokensCreated: Token[];
  points: number;
  level: number;
  achievements: Achievement[];
  referrals: number;

  // Stats
  totalVolumeTraded?: string;
  totalLiquidityProvided?: string;
  tokensCreatedCount?: number;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  unlockedAt?: Date;
  progress?: number;
  maxProgress?: number;
}

export interface Transaction {
  hash: string;
  type: TransactionType;
  from: string;
  to?: string;
  token?: string;
  amount?: string;
  timestamp: Date;
  status: TransactionStatus;
}

export enum TransactionType {
  TOKEN_CREATED = 'TOKEN_CREATED',
  TOKEN_BOUGHT = 'TOKEN_BOUGHT',
  TOKEN_SOLD = 'TOKEN_SOLD',
  LIQUIDITY_ADDED = 'LIQUIDITY_ADDED',
  LIQUIDITY_REMOVED = 'LIQUIDITY_REMOVED',
  SWAP = 'SWAP',
}

export enum TransactionStatus {
  PENDING = 'PENDING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
}

export interface SwapQuote {
  amountIn: string;
  amountOut: string;
  priceImpact: number;
  fee: string;
  route: string[];
}

export interface LiquidityPosition {
  pool: Pool;
  liquidity: string;
  share: number;
  amount0: string;
  amount1: string;
}

// API Response types
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface ApiError {
  message: string;
  code: string;
  details?: unknown;
}

// Leaderboard types
export enum LeaderboardType {
  CREATORS = 'CREATORS',
  TRADERS = 'TRADERS',
  LIQUIDITY_PROVIDERS = 'LIQUIDITY_PROVIDERS',
  VIRAL_TOKENS = 'VIRAL_TOKENS',
}

export interface LeaderboardEntry {
  rank: number;
  address: string;
  value: string;
  change24h?: number;
}

// Contract event types
export interface TokenCreatedEvent {
  creator: string;
  tokenAddress: string;
  name: string;
  symbol: string;
  timestamp: Date;
}

export interface TokenTradeEvent {
  trader: string;
  tokenAddress: string;
  xlmAmount: string;
  tokenAmount: string;
  type: 'buy' | 'sell';
  timestamp: Date;
}

export interface LiquidityEvent {
  provider: string;
  poolAddress: string;
  amount0: string;
  amount1: string;
  liquidity: string;
  type: 'add' | 'remove';
  timestamp: Date;
}

export interface SwapEvent {
  sender: string;
  poolAddress: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  amountOut: string;
  timestamp: Date;
}

// ============================================================================
// ASTRO Token Integration Types
// ============================================================================

/**
 * ASTRO Protocol Configuration
 * Defines how XLM is allocated during token graduation
 */
export interface AstroConfig {
  /** ASTRO token contract address */
  tokenAddress: string;
  /** ASTRO/XLM AMM address for swaps */
  ammAddress: string;
  /** Basis points for ASTRO liquidity pool (default: 1000 = 10%) */
  liquidityBps: number;
  /** Basis points for buyback & burn (default: 500 = 5%) */
  buybackBps: number;
  /** Whether ASTRO integration is enabled */
  enabled: boolean;
}

/**
 * ASTRO Allocation breakdown during graduation
 */
export interface AstroAllocation {
  /** XLM allocated to main token/XLM pool (85% default) */
  xlmForMainPool: string;
  /** XLM allocated to ASTRO liquidity (10% default) */
  xlmForAstroLiquidity: string;
  /** XLM used for buyback & burn (5% default) */
  xlmForBuyback: string;
  /** Amount of ASTRO burned (if buyback executed) */
  astroBurned?: string;
}

/**
 * ASTRO Buyback Event
 */
export interface AstroBuybackEvent {
  /** Graduated token that triggered the buyback */
  graduatedToken: string;
  /** XLM used for the buyback */
  xlmUsed: string;
  /** ASTRO tokens burned */
  astroBurned: string;
  /** Transaction timestamp */
  timestamp: Date;
}

/**
 * Graduation event with ASTRO allocation details
 */
export interface GraduationWithAstroEvent extends TokenCreatedEvent {
  /** Total XLM raised during bonding curve */
  xlmRaised: string;
  /** XLM allocated to main liquidity pool */
  xlmMainPool: string;
  /** XLM allocated to ASTRO liquidity */
  xlmAstroLiquidity: string;
  /** XLM used for buyback */
  xlmBuyback: string;
  /** ASTRO tokens burned */
  astroBurned: string;
  /** AMM pair address for the graduated token */
  ammPairAddress: string;
}
