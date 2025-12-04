/**
 * GraphQL Schema Definition
 * Defines all types, queries, mutations for the API
 */

export const schema = `#graphql
  scalar DateTime
  scalar BigInt

  type Query {
    # Health check
    health: HealthCheck!

    # Tokens
    token(address: String!): Token
    tokens(
      limit: Int = 20
      offset: Int = 0
      after: String
      orderBy: TokenOrderBy = CREATED_AT_DESC
      search: String
      status: TokenStatus
    ): TokenConnection!
    trendingTokens(limit: Int = 10): [Token!]!

    # Pools
    pool(address: String!): Pool
    pools(limit: Int = 20, offset: Int = 0): PoolConnection!

    # Users
    user(address: String!): User

    # Leaderboard (optimized with cache)
    leaderboard(
      type: LeaderboardType = TRADERS
      limit: Int = 100
      timeframe: LeaderboardTimeframe = DAY
    ): [LeaderboardEntry!]!

    # Transactions
    transactions(
      address: String
      tokenAddress: String
      type: TransactionType
      limit: Int = 20
      offset: Int = 0
    ): TransactionConnection!

    # Stats
    globalStats: GlobalStats!
  }

  type Mutation {
    # Sync a token from blockchain to database
    syncToken(tokenAddress: String!): Token!

    # Admin: Delete a token from database (requires admin key)
    deleteToken(tokenAddress: String!, adminKey: String!): DeleteTokenResult!

    # Admin: Delete multiple tokens from database (requires admin key)
    deleteTokensBatch(tokenAddresses: [String!]!, adminKey: String!): DeleteTokensBatchResult!
  }

  type DeleteTokenResult {
    success: Boolean!
    address: String!
    message: String
  }

  type DeleteTokensBatchResult {
    success: Boolean!
    deletedCount: Int!
    failedCount: Int!
    results: [DeleteTokenResult!]!
  }

  type HealthCheck {
    status: String!
    timestamp: DateTime!
    version: String!
    database: Boolean!
    cache: CacheStatus!
  }

  type CacheStatus {
    available: Boolean!
    type: String!
  }

  type Token {
    id: ID!
    address: String!
    creator: String!
    name: String!
    symbol: String!
    decimals: Int!
    totalSupply: String!
    metadataUri: String!
    imageUrl: String
    logoUrl: String # Alias for imageUrl (frontend compatibility)
    description: String

    # Bonding curve
    bondingCurve: String! # Alias for address (frontend compatibility)
    circulatingSupply: String!
    xlmReserve: String!
    graduated: Boolean!
    xlmRaised: String!
    initialPrice: String # Initial bonding curve price

    # Metrics
    marketCap: String
    currentPrice: String
    priceChange24h: Float
    volume24h: String!
    volume7d: String!
    holders: Int!
    holders24h: Int # Holders in last 24h
    holdersChange24h: Float # Percentage change in holders

    # Social links (optional)
    website: String
    twitter: String
    telegram: String
    discord: String

    # Timestamps
    createdAt: DateTime!
    updatedAt: DateTime!

    # Relations (will use DataLoaders)
    creatorUser: User
    pools: [Pool!]!
  }

  type Pool {
    id: ID!
    address: String!
    token0Address: String!
    token1Address: String!
    reserve0: String!
    reserve1: String!
    totalSupply: String!
    liquidity: String! # Alias for totalSupply (frontend compatibility)

    # Metrics
    tvl: String
    volume24h: String!
    volume7d: String!
    volumeChange24h: Float # Volume change percentage
    apr: Float
    apy: Float # Alias for apr (frontend compatibility)
    fee: String # Pool fee percentage

    createdAt: DateTime!
    updatedAt: DateTime!

    # Relations (will use DataLoaders)
    token0: Token!
    token1: Token!
  }

  type User {
    id: ID!
    address: String!

    # Gamification
    points: Int!
    level: Int!
    referrals: Int!

    # Stats
    tokensCreatedCount: Int!
    totalVolumeTraded: String!
    totalLiquidityProvided: String!

    # Relations
    tokensCreated: [Token!]!
    achievements: [Achievement!]!

    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type Achievement {
    id: ID!
    achievementId: String!
    name: String!
    description: String!
    imageUrl: String!
    progress: Int!
    maxProgress: Int!
    completed: Boolean!
    unlockedAt: DateTime
  }

  type Transaction {
    id: ID!
    hash: String!
    type: TransactionType!
    from: String!
    to: String
    tokenAddress: String
    amount: String
    status: TransactionStatus!
    timestamp: DateTime!

    # Relations
    token: Token
    user: User
  }

  type LeaderboardEntry {
    rank: Int!
    address: String!
    user: User!

    # Metrics (depende del tipo de leaderboard)
    volume24h: String!
    trades24h: Int!
    profitLoss24h: String!

    # Para CREATORS
    tokensCreated: Int
    totalVolumeGenerated: String

    # Para LIQUIDITY_PROVIDERS
    totalLiquidity: String
    feesEarned24h: String

    # Cambios
    volumeChange24h: Float
    rankChange24h: Int
  }

  type GlobalStats {
    totalTokens: Int!
    totalPools: Int!
    totalUsers: Int!
    totalVolume24h: String!
    totalTVL: String!
  }

  # Pagination types
  type TokenConnection {
    edges: [TokenEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type TokenEdge {
    cursor: String!
    node: Token!
  }

  type PoolConnection {
    edges: [PoolEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type PoolEdge {
    cursor: String!
    node: Pool!
  }

  type TransactionConnection {
    edges: [TransactionEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type TransactionEdge {
    cursor: String!
    node: Transaction!
  }

  type PageInfo {
    hasNextPage: Boolean!
    hasPreviousPage: Boolean!
    startCursor: String
    endCursor: String
    total: Int!
  }

  # Enums
  enum TokenOrderBy {
    CREATED_AT_DESC
    CREATED_AT_ASC
    MARKET_CAP_DESC
    VOLUME_DESC
    HOLDERS_DESC
    GRADUATION_DESC
  }

  enum TokenStatus {
    ALL
    BONDING
    GRADUATED
  }

  enum LeaderboardType {
    CREATORS
    TRADERS
    LIQUIDITY_PROVIDERS
    VIRAL_TOKENS
  }

  enum LeaderboardTimeframe {
    HOUR
    DAY
    WEEK
    MONTH
    ALL_TIME
  }

  enum TransactionType {
    TOKEN_CREATED
    TOKEN_BOUGHT
    TOKEN_SOLD
    LIQUIDITY_ADDED
    LIQUIDITY_REMOVED
    SWAP
  }

  enum TransactionStatus {
    PENDING
    SUCCESS
    FAILED
  }

# ============================================================
# FEE MANAGEMENT SCHEMA
# ============================================================

"""
Fee configuration from the smart contract
"""
type FeeConfig {
  """Protocol fee in basis points (5 = 0.05%)"""
  protocolFeeBps: Int!
  
  """LP fee in basis points (25 = 0.25%)"""
  lpFeeBps: Int!
  
  """Creation fee in stroops (100000000 = 10 XLM)"""
  creationFee: String!
  
  """Multi-sig treasury address"""
  treasuryAddress: String!
  
  """When this configuration became effective"""
  effectiveFrom: DateTime!
  
  """Who updated this configuration"""
  updatedBy: String
  
  """Last update timestamp"""
  updatedAt: DateTime!
}

"""
Comprehensive fee statistics
"""
type FeeStats {
  """Token address (null for global stats)"""
  tokenAddress: String
  
  # Protocol Fees (Revenue)
  """Total protocol fees collected (all time)"""
  totalProtocolFees: String!
  
  """Protocol fees in last 24 hours"""
  protocolFees24h: String!
  
  """Protocol fees in last 7 days"""
  protocolFees7d: String!
  
  """Protocol fees in last 30 days"""
  protocolFees30d: String!
  
  # LP Fees (Liquidity)
  """Total LP fees collected (all time)"""
  totalLpFees: String!
  
  """LP fees in last 24 hours"""
  lpFees24h: String!
  
  """LP fees in last 7 days"""
  lpFees7d: String!
  
  """LP fees in last 30 days"""
  lpFees30d: String!
  
  # Creation Fees
  """Total creation fees collected (all time)"""
  totalCreationFees: String!
  
  """Creation fees in last 24 hours"""
  creationFees24h: String!
  
  """Creation fees in last 7 days"""
  creationFees7d: String!
  
  """Creation fees in last 30 days"""
  creationFees30d: String!
  
  # Totals
  """Total fees (protocol + LP + creation)"""
  totalFees: String!
  
  """Total fees in last 24 hours"""
  totalFees24h: String!
  
  """Total fees in last 7 days"""
  totalFees7d: String!
  
  """Total fees in last 30 days"""
  totalFees30d: String!
  
  # Transaction Counts
  """Total number of fee-generating transactions"""
  totalTransactions: Int!
  
  """Transactions in last 24 hours"""
  transactions24h: Int!
  
  """Last update timestamp"""
  updatedAt: DateTime!
}

"""
Individual fee collection record
"""
type FeeCollection {
  """Unique identifier"""
  id: ID!
  
  """Transaction hash"""
  hash: String!
  
  """Fee type"""
  type: FeeType!
  
  """Token address"""
  tokenAddress: String!
  
  """Token details (resolved)"""
  token: Token
  
  """Fee amount in stroops"""
  amount: String!
  
  """Treasury address (for protocol fees)"""
  treasuryAddress: String
  
  """User who triggered the fee"""
  userAddress: String!
  
  """Transaction type (BUY/SELL/CREATE)"""
  transactionType: String!
  
  # Breakdown
  """Amount before fees"""
  grossAmount: String!
  
  """Protocol fee amount"""
  protocolFee: String
  
  """LP fee amount"""
  lpFee: String
  
  """Amount after fees"""
  netAmount: String!
  
  """Block timestamp"""
  timestamp: DateTime!
  
  """Block number"""
  blockNumber: String!
  
  """Created at"""
  createdAt: DateTime!
}

"""
Fee collection history with pagination
"""
type FeeCollectionHistory {
  """List of fee collections"""
  items: [FeeCollection!]!
  
  """Total count"""
  total: Int!
  
  """Has more items"""
  hasMore: Boolean!
  
  """Pagination info"""
  pageInfo: PageInfo!
}

"""
Revenue breakdown by category
"""
type RevenueCategory {
  """Total revenue (all time)"""
  total: String!
  
  """Revenue in last 24 hours"""
  day: String!
  
  """Revenue in last 7 days"""
  week: String!
  
  """Revenue in last 30 days"""
  month: String!
}

"""
Transaction count breakdown
"""
type TransactionCount {
  """Total transactions"""
  total: Int!
  
  """Transactions in last 24 hours"""
  day: Int!
  
  """Transactions in last 7 days"""
  week: Int!
  
  """Transactions in last 30 days"""
  month: Int!
}

"""
Comprehensive revenue breakdown
"""
type RevenueBreakdown {
  """Protocol fees (team revenue)"""
  protocolFees: RevenueCategory!
  
  """LP fees (liquidity provision)"""
  lpFees: RevenueCategory!
  
  """Creation fees (anti-spam + revenue)"""
  creationFees: RevenueCategory!
  
  """Total revenue (all categories)"""
  totalRevenue: RevenueCategory!
  
  """Transaction counts"""
  transactionCount: TransactionCount!
}

"""
Token fee performance metrics
"""
type TokenFeePerformance {
  """Token address"""
  tokenAddress: String!
  
  """Token details"""
  token: Token
  
  """Protocol fees generated"""
  protocolFees: String!
  
  """LP fees generated"""
  lpFees: String!
  
  """Total fees generated"""
  totalFees: String!
  
  """Number of transactions"""
  transactionCount: Int!
  
  """Average fee per transaction"""
  avgFeePerTransaction: String!
  
  """Rank in leaderboard"""
  rank: Int!
}

"""
Recent growth metrics
"""
type RecentGrowth {
  """Protocol fees today"""
  protocolFees: String!
  
  """LP fees today"""
  lpFees: String!
  
  """Total fees today"""
  totalFees: String!
  
  """Percentage change vs 7-day average"""
  percentageChange: Float!
}

"""
Fee dashboard summary
"""
type FeeDashboard {
  """Revenue breakdown"""
  revenue: RevenueBreakdown!
  
  """Top 5 tokens by fees"""
  topTokens: [TokenFeePerformance!]!
  
  """Recent growth metrics"""
  recentGrowth: RecentGrowth!
  
  """Timestamp of data"""
  timestamp: DateTime!
}

"""
Average fee per transaction
"""
type AverageFee {
  """Average protocol fee"""
  protocolFee: String!
  
  """Average LP fee"""
  lpFee: String!
  
  """Average total fee"""
  totalFee: String!
}

"""
Generic mutation response
"""
type MutationResponse {
  """Success flag"""
  success: Boolean!
  
  """Response message"""
  message: String!
  
  """Number of items updated (optional)"""
  updated: Int
}

# ============================================================
# ENUMS
# ============================================================

"""
Fee type enumeration
"""
enum FeeType {
  PROTOCOL_FEE
  LP_FEE
  CREATION_FEE
  PROTOCOL_FEE_BUY
  PROTOCOL_FEE_SELL
  LP_FEE_BUY
  LP_FEE_SELL
}

"""
Time window for statistics
"""
enum TimeWindow {
  DAY
  WEEK
  MONTH
  ALL
}

# ============================================================
# INPUT TYPES
# ============================================================

"""
Input for token-specific fee stats
"""
input FeeStatsInput {
  """Token address (required)"""
  tokenAddress: String!
}

"""
Input for top tokens query
"""
input TopTokensByFeesInput {
  """Number of tokens to return (max 100)"""
  limit: Int = 10
  
  """Time window for ranking"""
  timeWindow: TimeWindow = ALL
}

"""
Input for fee collection history
"""
input FeeHistoryInput {
  """Filter by token address"""
  tokenAddress: String
  
  """Filter by fee type"""
  type: FeeType
  
  """Number of items per page (max 100)"""
  limit: Int = 50
  
  """Offset for pagination"""
  offset: Int = 0
  
  """Start date filter (ISO 8601)"""
  startDate: DateTime
  
  """End date filter (ISO 8601)"""
  endDate: DateTime
}

"""
Input for recalculating fee stats
"""
input RecalculateFeeStatsInput {
  """Include token-specific stats"""
  includeTokenStats: Boolean = true
  
  """Include global stats"""
  includeGlobalStats: Boolean = true
}

# ============================================================
# QUERIES (EXTENSIONS)
# ============================================================

extend type Query {
  """
  Get global fee statistics (all tokens combined)
  Cache TTL: 30 seconds
  """
  globalFeeStats: FeeStats!
  
  """
  Get fee statistics for a specific token
  Cache TTL: 30 seconds
  """
  tokenFeeStats(input: FeeStatsInput!): FeeStats
  
  """
  Get comprehensive revenue breakdown
  Cache TTL: 60 seconds
  """
  revenueBreakdown: RevenueBreakdown!
  
  """
  Get top tokens ranked by fee generation
  Cache TTL: 120 seconds
  """
  topTokensByFees(input: TopTokensByFeesInput): [TokenFeePerformance!]!
  
  """
  Get fee collection history with pagination
  Cache TTL: 300 seconds
  """
  feeCollectionHistory(input: FeeHistoryInput): FeeCollectionHistory!
  
  """
  Get fee dashboard summary (revenue, top tokens, growth)
  Cache TTL: 30 seconds
  """
  feeDashboard: FeeDashboard!
  
  """
  Get average fee per transaction
  Cache TTL: 60 seconds
  """
  averageFeePerTransaction(input: FeeStatsInput): AverageFee!
  
  """
  Get current fee configuration from contract
  Cache TTL: 300 seconds
  """
  feeConfig: FeeConfig!
}

# ============================================================
# MUTATIONS (EXTENSIONS)
# ============================================================

extend type Mutation {
  """
  Recalculate fee statistics from source data
  Admin only - requires authentication
  """
  recalculateFeeStats(input: RecalculateFeeStatsInput): MutationResponse!
  
  """
  Reset expired time windows (daily maintenance)
  Admin only - requires authentication
  """
  resetExpiredTimeWindows: MutationResponse!
}
`
