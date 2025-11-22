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
      orderBy: TokenOrderBy = CREATED_AT_DESC
      search: String
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
    description: String

    # Bonding curve
    circulatingSupply: String!
    xlmReserve: String!
    graduated: Boolean!
    xlmRaised: String!

    # Metrics
    marketCap: String
    currentPrice: String
    priceChange24h: Float
    volume24h: String!
    volume7d: String!
    holders: Int!

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

    # Metrics
    tvl: String
    volume24h: String!
    volume7d: String!
    apr: Float

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
    edges: [Token!]!
    pageInfo: PageInfo!
  }

  type PoolConnection {
    edges: [Pool!]!
    pageInfo: PageInfo!
  }

  type TransactionConnection {
    edges: [Transaction!]!
    pageInfo: PageInfo!
  }

  type PageInfo {
    hasNextPage: Boolean!
    hasPreviousPage: Boolean!
    total: Int!
  }

  # Enums
  enum TokenOrderBy {
    CREATED_AT_DESC
    CREATED_AT_ASC
    MARKET_CAP_DESC
    VOLUME_DESC
    HOLDERS_DESC
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
`
