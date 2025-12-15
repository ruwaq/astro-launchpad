/**
 * Apollo GraphQL Server for Vercel
 * Production-ready implementation with Relay-style pagination
 *
 * Mantra: Escalable, Modular, Robusto
 */
import { ApolloServer } from '@apollo/server';
import { startServerAndCreateNextHandler } from '@as-integrations/next';
import { PrismaClient } from '@prisma/client';
import gql from 'graphql-tag';

// Stellar Configuration (lazy loaded)
// V7 Contract - Dec 3, 2024 - pump.fun style, 30k XLM graduation
const CONTRACT_ID = process.env.TOKEN_FACTORY_CONTRACT_ID || 'CBNQZ3NE5CUAZVDTI34FGMABOV26EOHGCVXU5F7KLRFSGMC33W7U225Z';
const RPC_URL = process.env.STELLAR_RPC_URL || 'https://soroban-testnet.stellar.org';
const NETWORK_PASSPHRASE = process.env.STELLAR_NETWORK_PASSPHRASE || 'Test SDF Network ; September 2015';

// Lazy load Stellar SDK to avoid serverless cold start issues
let stellarSdk = null;
let sorobanServer = null;
let factoryContract = null;

async function getStellarSDK() {
  if (!stellarSdk) {
    stellarSdk = await import('@stellar/stellar-sdk');
    sorobanServer = new stellarSdk.SorobanRpc.Server(RPC_URL);
    factoryContract = new stellarSdk.Contract(CONTRACT_ID);
  }
  return stellarSdk;
}

// Global Prisma instance for serverless (connection pooling)
const globalForPrisma = globalThis;
const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

const isProduction = process.env.NODE_ENV === 'production';

// ============================================================================
// GraphQL Schema - Relay-style pagination compatible
// ============================================================================
const typeDefs = gql`
  type Query {
    # Health & Status
    health: HealthStatus!

    # Tokens
    tokens(
      limit: Int = 20
      offset: Int = 0
      after: String
      first: Int
      skip: Int
      orderBy: TokenOrderBy = CREATED_AT_DESC
      search: String
      status: TokenStatus
    ): TokenConnection!
    token(address: String!): Token
    trendingTokens(limit: Int = 10): [Token!]!

    # Pools
    pools(
      limit: Int = 20
      offset: Int = 0
    ): PoolConnection!
    pool(address: String!): Pool

    # Transactions
    transactions(
      address: String
      tokenAddress: String
      type: TransactionType
      limit: Int = 20
      offset: Int = 0
    ): TransactionConnection!

    # Global Stats
    globalStats: GlobalStats!

    # Leaderboard
    leaderboard(
      type: LeaderboardType = TRADERS
      limit: Int = 100
      timeframe: LeaderboardTimeframe = DAY
    ): [LeaderboardEntry!]!
  }

  type Mutation {
    # Sync a token from blockchain to database
    # Accepts optional token data for when contract lookup fails (newly created tokens)
    syncToken(
      tokenAddress: String!
      name: String
      symbol: String
      creator: String
      imageUrl: String
      description: String
      website: String
      telegram: String
    ): Token!

    # Delete a token (admin only - requires x-admin-key header)
    deleteToken(tokenAddress: String!): DeleteResult!
  }

  type DeleteResult {
    success: Boolean!
    message: String
  }

  # ============================================================================
  # Health
  # ============================================================================
  type HealthStatus {
    status: String!
    timestamp: String!
    version: String
    database: Boolean!
    cache: CacheStatus
  }

  type CacheStatus {
    available: Boolean!
    type: String
  }

  # ============================================================================
  # Token Types
  # ============================================================================
  type Token {
    id: ID!
    address: String!
    creator: String!
    name: String!
    symbol: String!
    decimals: Int!
    totalSupply: String!
    metadataUri: String
    imageUrl: String
    logoUrl: String
    description: String
    website: String
    twitter: String
    telegram: String
    discord: String
    bondingCurve: String
    circulatingSupply: String
    xlmReserve: String
    graduated: Boolean
    xlmRaised: String
    initialPrice: String
    marketCap: String
    currentPrice: String
    priceChange24h: Float
    volume24h: String
    volume7d: String
    holders: Int
    holders24h: Int
    holdersChange24h: Float
    createdAt: String!
    updatedAt: String

    # Relations
    creatorUser: User
    pools: [Pool!]
  }

  type TokenConnection {
    edges: [TokenEdge!]!
    nodes: [Token!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type TokenEdge {
    cursor: String!
    node: Token!
  }

  type PageInfo {
    hasNextPage: Boolean!
    hasPreviousPage: Boolean!
    startCursor: String
    endCursor: String
  }

  # ============================================================================
  # Pool Types
  # ============================================================================
  type Pool {
    id: ID!
    address: String!
    token0Address: String!
    token1Address: String!
    reserve0: String!
    reserve1: String!
    totalSupply: String!
    tvl: String
    volume24h: String
    volume7d: String
    apr: Float
    feeRate: Float
    createdAt: String!
    updatedAt: String
    token0: Token
    token1: Token
  }

  type PoolConnection {
    edges: [PoolEdge!]!
    nodes: [Pool!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type PoolEdge {
    cursor: String!
    node: Pool!
  }

  # ============================================================================
  # Transaction Types
  # ============================================================================
  type Transaction {
    id: ID!
    hash: String!
    type: TransactionType!
    from: String!
    to: String
    tokenAddress: String
    amount: String
    grossAmount: String
    netAmount: String
    totalFees: String
    status: String!
    timestamp: String!
    token: Token
    user: User
  }

  type TransactionConnection {
    edges: [TransactionEdge!]!
    nodes: [Transaction!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type TransactionEdge {
    cursor: String!
    node: Transaction!
  }

  # ============================================================================
  # User Types
  # ============================================================================
  type User {
    id: ID!
    address: String!
    points: Int
    level: Int
    referrals: Int
    tokensCreatedCount: Int
    totalVolumeTraded: String
    totalLiquidityProvided: String
    createdAt: String
  }

  # ============================================================================
  # Global Stats
  # ============================================================================
  type GlobalStats {
    totalTokens: Int!
    totalPools: Int
    totalUsers: Int!
    totalVolume: String
    totalVolume24h: String
    totalTVL: String
    totalTransactions: Int!
  }

  # ============================================================================
  # Leaderboard Types
  # ============================================================================
  type LeaderboardEntry {
    rank: Int!
    address: String!
    user: User
    volume24h: String!
    trades24h: Int!
    profitLoss24h: String!
    tokensCreated: Int
    totalVolumeGenerated: String
    totalLiquidity: String
    feesEarned24h: String
    volumeChange24h: Float
    rankChange24h: Int
  }

  # ============================================================================
  # Enums
  # ============================================================================
  enum TokenOrderBy {
    CREATED_AT_DESC
    CREATED_AT_ASC
    MARKET_CAP_DESC
    VOLUME_DESC
    VOLUME_24H_DESC
    HOLDERS_DESC
    GRADUATION_DESC
  }

  enum TokenStatus {
    ALL
    BONDING
    GRADUATED
  }

  enum TransactionType {
    TOKEN_CREATED
    TOKEN_BOUGHT
    TOKEN_SOLD
    LIQUIDITY_ADDED
    LIQUIDITY_REMOVED
    SWAP
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
`;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Call contract read-only method
 */
async function callContractMethod(method, ...params) {
  try {
    const sdk = await getStellarSDK();
    const { SorobanRpc, TransactionBuilder, Account, scValToNative } = sdk;

    const operation = factoryContract.call(method, ...params);
    const simulationResponse = await sorobanServer.simulateTransaction(
      new TransactionBuilder(
        new Account('GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF', '0'),
        { fee: '100', networkPassphrase: NETWORK_PASSPHRASE }
      )
        .addOperation(operation)
        .setTimeout(30)
        .build()
    );

    if (SorobanRpc.Api.isSimulationSuccess(simulationResponse)) {
      if (simulationResponse.result?.retval) {
        return scValToNative(simulationResponse.result.retval);
      }
    }
    return null;
  } catch (error) {
    console.error(`Contract call ${method} failed:`, error.message);
    return null;
  }
}

/**
 * Get token info from contract
 */
async function getTokenInfoFromContract(tokenAddress) {
  try {
    const sdk = await getStellarSDK();
    const { Address } = sdk;
    const address = Address.fromString(tokenAddress).toScVal();
    return await callContractMethod('get_token_info', address);
  } catch (error) {
    console.error('Failed to get token info:', error.message);
    return null;
  }
}

/**
 * Transform database token to GraphQL Token type
 */
function transformToken(token) {
  if (!token) return null;

  return {
    id: token.id,
    address: token.address,
    creator: token.creator,
    name: token.name,
    symbol: token.symbol,
    decimals: token.decimals || 7,
    totalSupply: token.totalSupply?.toString() || '0',
    metadataUri: token.metadataUri,
    imageUrl: token.imageUrl,
    logoUrl: token.imageUrl, // Alias for compatibility
    description: token.description,
    website: token.website,
    twitter: token.twitter,
    telegram: token.telegram,
    discord: token.discord,
    bondingCurve: null,
    circulatingSupply: token.circulatingSupply?.toString() || '0',
    xlmReserve: token.xlmReserve?.toString() || '0',
    graduated: token.graduated || false,
    xlmRaised: token.xlmRaised?.toString() || '0',
    initialPrice: null,
    marketCap: token.marketCap?.toString() || '0',
    currentPrice: token.currentPrice?.toString() || '0',
    priceChange24h: token.priceChange24h || 0,
    volume24h: token.volume24h?.toString() || '0',
    volume7d: token.volume7d?.toString() || '0',
    holders: token.holders || 0,
    holders24h: null,
    holdersChange24h: null,
    createdAt: token.createdAt?.toISOString() || new Date().toISOString(),
    updatedAt: token.updatedAt?.toISOString(),
  };
}

/**
 * Create cursor from offset
 */
function createCursor(offset) {
  return Buffer.from(`cursor:${offset}`).toString('base64');
}

/**
 * Parse cursor to offset
 */
function parseCursor(cursor) {
  if (!cursor) return 0;
  try {
    const decoded = Buffer.from(cursor, 'base64').toString('utf-8');
    const match = decoded.match(/cursor:(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  } catch {
    return 0;
  }
}

// ============================================================================
// Resolvers
// ============================================================================
const resolvers = {
  Query: {
    health: async () => {
      let dbHealthy = false;
      try {
        await prisma.$queryRaw`SELECT 1`;
        dbHealthy = true;
      } catch (e) {
        console.error('DB health check failed:', e);
      }
      return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '2.0.0',
        database: dbHealthy,
        cache: {
          available: false,
          type: 'none',
        },
      };
    },

    tokens: async (_, args) => {
      // Support both limit/offset and first/skip naming
      const limit = args.limit || args.first || 20;
      let offset = args.offset || args.skip || 0;
      const { orderBy = 'CREATED_AT_DESC', search, status } = args;

      // Handle cursor-based pagination (after parameter)
      if (args.after) {
        const cursorOffset = parseCursor(args.after);
        offset = cursorOffset + 1;
      }

      const orderByMap = {
        CREATED_AT_DESC: { createdAt: 'desc' },
        CREATED_AT_ASC: { createdAt: 'asc' },
        MARKET_CAP_DESC: { marketCap: 'desc' },
        VOLUME_DESC: { volume24h: 'desc' },
        VOLUME_24H_DESC: { volume24h: 'desc' },
        HOLDERS_DESC: { holders: 'desc' },
        GRADUATION_DESC: { xlmRaised: 'desc' },
      };

      // Build where clause for search and status
      const whereConditions = [];

      // Search filter
      if (search) {
        whereConditions.push({
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { symbol: { contains: search, mode: 'insensitive' } },
            { address: { contains: search, mode: 'insensitive' } },
          ],
        });
      }

      // Status filter (bonding = not graduated, graduated = graduated)
      if (status && status !== 'ALL') {
        if (status === 'BONDING') {
          whereConditions.push({ graduated: false });
        } else if (status === 'GRADUATED') {
          whereConditions.push({ graduated: true });
        }
      }

      const where = whereConditions.length > 0 ? { AND: whereConditions } : {};

      const [tokens, totalCount] = await Promise.all([
        prisma.token.findMany({
          where,
          take: limit,
          skip: offset,
          orderBy: orderByMap[orderBy] || { createdAt: 'desc' },
        }),
        prisma.token.count({ where }),
      ]);

      const transformedTokens = tokens.map(transformToken);

      // Create edges with cursors
      const edges = transformedTokens.map((token, index) => ({
        cursor: createCursor(offset + index),
        node: token,
      }));

      return {
        edges,
        nodes: transformedTokens,
        totalCount,
        pageInfo: {
          hasNextPage: offset + limit < totalCount,
          hasPreviousPage: offset > 0,
          startCursor: edges.length > 0 ? edges[0].cursor : null,
          endCursor: edges.length > 0 ? edges[edges.length - 1].cursor : null,
        },
      };
    },

    token: async (_, { address }) => {
      const token = await prisma.token.findUnique({
        where: { address },
        include: {
          poolsToken0: true,
          poolsToken1: true,
        },
      });

      if (!token) return null;

      const transformed = transformToken(token);

      // Add pools relation
      transformed.pools = [
        ...(token.poolsToken0 || []),
        ...(token.poolsToken1 || []),
      ].map(pool => ({
        id: pool.id,
        address: pool.address,
        token0Address: pool.token0Address,
        token1Address: pool.token1Address,
        reserve0: pool.reserve0?.toString() || '0',
        reserve1: pool.reserve1?.toString() || '0',
        totalSupply: pool.totalSupply?.toString() || '0',
        tvl: pool.tvl?.toString(),
        volume24h: pool.volume24h?.toString() || '0',
        createdAt: pool.createdAt?.toISOString(),
      }));

      return transformed;
    },

    trendingTokens: async (_, { limit = 10 }) => {
      const tokens = await prisma.token.findMany({
        take: limit,
        orderBy: { volume24h: 'desc' },
      });
      return tokens.map(transformToken);
    },

    // ========================================================================
    // Pools
    // ========================================================================
    pools: async (_, args) => {
      const limit = args.limit || 20;
      const offset = args.offset || 0;

      const [pools, totalCount] = await Promise.all([
        prisma.pool.findMany({
          take: limit,
          skip: offset,
          orderBy: { tvl: 'desc' },
          include: {
            token0: true,
            token1: true,
          },
        }),
        prisma.pool.count(),
      ]);

      const transformedPools = pools.map(pool => ({
        id: pool.id,
        address: pool.address,
        token0Address: pool.token0Address,
        token1Address: pool.token1Address,
        reserve0: pool.reserve0?.toString() || '0',
        reserve1: pool.reserve1?.toString() || '0',
        totalSupply: pool.totalSupply?.toString() || '0',
        tvl: pool.tvl?.toString(),
        volume24h: pool.volume24h?.toString() || '0',
        volume7d: pool.volume7d?.toString(),
        apr: pool.apr,
        feeRate: pool.feeRate || 0.003,
        createdAt: pool.createdAt?.toISOString(),
        updatedAt: pool.updatedAt?.toISOString(),
        token0: pool.token0 ? transformToken(pool.token0) : null,
        token1: pool.token1 ? transformToken(pool.token1) : null,
      }));

      const edges = transformedPools.map((pool, index) => ({
        cursor: createCursor(offset + index),
        node: pool,
      }));

      return {
        edges,
        nodes: transformedPools,
        totalCount,
        pageInfo: {
          hasNextPage: offset + limit < totalCount,
          hasPreviousPage: offset > 0,
          startCursor: edges.length > 0 ? edges[0].cursor : null,
          endCursor: edges.length > 0 ? edges[edges.length - 1].cursor : null,
        },
      };
    },

    pool: async (_, { address }) => {
      const pool = await prisma.pool.findUnique({
        where: { address },
        include: {
          token0: true,
          token1: true,
        },
      });

      if (!pool) return null;

      return {
        id: pool.id,
        address: pool.address,
        token0Address: pool.token0Address,
        token1Address: pool.token1Address,
        reserve0: pool.reserve0?.toString() || '0',
        reserve1: pool.reserve1?.toString() || '0',
        totalSupply: pool.totalSupply?.toString() || '0',
        tvl: pool.tvl?.toString(),
        volume24h: pool.volume24h?.toString() || '0',
        volume7d: pool.volume7d?.toString(),
        apr: pool.apr,
        feeRate: pool.feeRate || 0.003,
        createdAt: pool.createdAt?.toISOString(),
        updatedAt: pool.updatedAt?.toISOString(),
        token0: pool.token0 ? transformToken(pool.token0) : null,
        token1: pool.token1 ? transformToken(pool.token1) : null,
      };
    },

    // ========================================================================
    // Transactions
    // ========================================================================
    transactions: async (_, args) => {
      const limit = args.limit || 20;
      const offset = args.offset || 0;
      const { address, tokenAddress, type } = args;

      // Build where clause
      const where = {};
      if (address) where.from = address;
      if (tokenAddress) where.tokenAddress = tokenAddress;
      if (type) where.type = type;

      const [transactions, totalCount] = await Promise.all([
        prisma.transaction.findMany({
          where,
          take: limit,
          skip: offset,
          orderBy: { timestamp: 'desc' },
          include: {
            token: true,
            user: true,
          },
        }),
        prisma.transaction.count({ where }),
      ]);

      const transformedTransactions = transactions.map(tx => ({
        id: tx.id,
        hash: tx.hash || tx.id,
        type: tx.type || 'TOKEN_BOUGHT',
        from: tx.from || '',
        to: tx.to,
        tokenAddress: tx.tokenAddress || null,
        amount: tx.amount || null,
        grossAmount: tx.grossAmount || null,
        netAmount: tx.netAmount || null,
        totalFees: tx.totalFees || null,
        status: tx.status || 'PENDING',
        timestamp: tx.timestamp?.toISOString() || new Date().toISOString(),
        token: tx.token ? transformToken(tx.token) : null,
        user: tx.user ? {
          id: tx.user.id,
          address: tx.user.address,
          points: tx.user.points || 0,
          level: tx.user.level || 1,
          referrals: tx.user.referrals || 0,
          tokensCreatedCount: tx.user.tokensCreatedCount || 0,
          totalVolumeTraded: tx.user.totalVolumeTraded?.toString() || '0',
          totalLiquidityProvided: tx.user.totalLiquidityProvided?.toString() || '0',
          createdAt: tx.user.createdAt?.toISOString(),
        } : null,
      }));

      const edges = transformedTransactions.map((tx, index) => ({
        cursor: createCursor(offset + index),
        node: tx,
      }));

      return {
        edges,
        nodes: transformedTransactions,
        totalCount,
        pageInfo: {
          hasNextPage: offset + limit < totalCount,
          hasPreviousPage: offset > 0,
          startCursor: edges.length > 0 ? edges[0].cursor : null,
          endCursor: edges.length > 0 ? edges[edges.length - 1].cursor : null,
        },
      };
    },

    globalStats: async () => {
      const [totalTokens, totalUsers, totalTransactions, totalPools] = await Promise.all([
        prisma.token.count(),
        prisma.user.count(),
        prisma.transaction.count(),
        prisma.pool.count(),
      ]);

      // Calculate total volume from tokens
      let totalVolume = '0';
      try {
        const volumeResult = await prisma.$queryRaw`
          SELECT COALESCE(SUM(CAST(NULLIF("volume24h", '') AS DECIMAL)), 0)::text as total
          FROM "Token"
        `;
        totalVolume = volumeResult[0]?.total || '0';
      } catch (e) {
        console.error('Error calculating volume:', e);
      }

      // Calculate TVL from pools
      let totalTVL = '0';
      try {
        const tvlResult = await prisma.$queryRaw`
          SELECT COALESCE(SUM(CAST(NULLIF("tvl", '') AS DECIMAL)), 0)::text as total
          FROM "Pool"
        `;
        totalTVL = tvlResult[0]?.total || '0';
      } catch (e) {
        console.error('Error calculating TVL:', e);
      }

      return {
        totalTokens,
        totalPools,
        totalUsers,
        totalVolume,
        totalVolume24h: totalVolume,
        totalTVL,
        totalTransactions,
      };
    },

    // ========================================================================
    // Leaderboard
    // ========================================================================
    leaderboard: async (_, args) => {
      const { type = 'TRADERS', limit = 100, timeframe = 'DAY' } = args;

      // Calculate date range based on timeframe
      const now = new Date();
      let startDate;
      switch (timeframe) {
        case 'HOUR':
          startDate = new Date(now.getTime() - 60 * 60 * 1000);
          break;
        case 'DAY':
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case 'WEEK':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'MONTH':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = new Date(0); // ALL_TIME
      }

      try {
        let users = [];

        if (type === 'CREATORS') {
          // Top token creators
          users = await prisma.user.findMany({
            where: {
              tokensCreatedCount: { gt: 0 },
            },
            orderBy: { tokensCreatedCount: 'desc' },
            take: limit,
          });
        } else if (type === 'TRADERS') {
          // Top traders by volume
          users = await prisma.user.findMany({
            where: {
              totalVolumeTraded: { not: null },
            },
            orderBy: { totalVolumeTraded: 'desc' },
            take: limit,
          });
        } else if (type === 'LIQUIDITY_PROVIDERS') {
          // Top liquidity providers
          users = await prisma.user.findMany({
            where: {
              totalLiquidityProvided: { not: null },
            },
            orderBy: { totalLiquidityProvided: 'desc' },
            take: limit,
          });
        }

        return users.map((user, index) => ({
          rank: index + 1,
          address: user.address,
          user: {
            id: user.id,
            address: user.address,
            points: user.points || 0,
            level: user.level || 1,
            referrals: user.referrals || 0,
            tokensCreatedCount: user.tokensCreatedCount || 0,
            totalVolumeTraded: user.totalVolumeTraded?.toString() || '0',
            totalLiquidityProvided: user.totalLiquidityProvided?.toString() || '0',
            createdAt: user.createdAt?.toISOString(),
          },
          volume24h: user.totalVolumeTraded?.toString() || '0',
          trades24h: 0, // Would need transaction count
          profitLoss24h: '0',
          tokensCreated: user.tokensCreatedCount || 0,
          totalVolumeGenerated: user.totalVolumeTraded?.toString() || '0',
          totalLiquidity: user.totalLiquidityProvided?.toString() || '0',
          feesEarned24h: '0',
          volumeChange24h: 0,
          rankChange24h: 0,
        }));
      } catch (error) {
        console.error('Leaderboard error:', error);
        return [];
      }
    },
  },

  // Mutations
  Mutation: {
    deleteToken: async (_, { tokenAddress }, context) => {
      const adminKey = context.req?.headers?.['x-admin-key'];
      const expectedKey = process.env.ADMIN_SECRET_KEY;

      // SECURITY: Require admin key for deletion
      if (!expectedKey || adminKey !== expectedKey) {
        console.log('[DeleteToken] Unauthorized deletion attempt');
        return {
          success: false,
          message: 'Unauthorized - admin key required',
        };
      }

      console.log(`[DeleteToken] Deleting token: ${tokenAddress}`);

      try {
        // Delete token from database
        await prisma.token.delete({
          where: { address: tokenAddress },
        });

        console.log(`[DeleteToken] Successfully deleted: ${tokenAddress}`);
        return {
          success: true,
          message: `Token ${tokenAddress} deleted successfully`,
        };
      } catch (error) {
        console.error('[DeleteToken] Error:', error);
        return {
          success: false,
          message: `Failed to delete token: ${error.message}`,
        };
      }
    },

    syncToken: async (_, args) => {
      const { tokenAddress, name, symbol, creator, imageUrl, description, website, telegram } = args;
      console.log(`[SyncToken] Syncing token: ${tokenAddress}`);

      try {
        // Check if token already exists in database
        const existingToken = await prisma.token.findUnique({
          where: { address: tokenAddress }
        });

        // Try to get token info from contract
        let tokenInfo = null;
        try {
          tokenInfo = await getTokenInfoFromContract(tokenAddress);
        } catch (contractError) {
          console.log(`[SyncToken] Contract lookup failed: ${contractError.message}`);
        }

        // If no contract info and no provided data, check for existing or fail
        if (!tokenInfo && !name && !symbol) {
          if (existingToken) {
            console.log(`[SyncToken] Returning existing token: ${existingToken.name}`);
            return transformToken(existingToken);
          }
          throw new Error('Token not found in contract and no fallback data provided');
        }

        // Use contract info if available, otherwise use provided args
        const tokenName = tokenInfo?.name || name || 'Unknown Token';
        const tokenSymbol = tokenInfo?.symbol || symbol || 'UNK';
        const tokenCreator = tokenInfo?.creator || creator || 'Unknown';
        const tokenImageUrl = tokenInfo?.image_url || imageUrl || null;
        const tokenDescription = tokenInfo?.description || description || `${tokenName} token on Stellar`;

        console.log(`[SyncToken] Token info: ${tokenName} (${tokenSymbol}) - source: ${tokenInfo ? 'contract' : 'provided'}`);

        // Prepare token data
        const tokenData = {
          address: tokenAddress,
          creator: tokenCreator,
          name: tokenName,
          symbol: tokenSymbol,
          decimals: 7,
          totalSupply: tokenInfo?.total_supply?.toString() || '1000000000000000',
          metadataUri: tokenImageUrl || '',
          imageUrl: tokenImageUrl,
          description: tokenDescription,
          website: website || null,
          telegram: telegram || null,
          circulatingSupply: tokenInfo?.circulating_supply?.toString() || '0',
          xlmReserve: tokenInfo?.xlm_reserve?.toString() || '0',
          graduated: tokenInfo?.graduated || false,
          xlmRaised: tokenInfo?.xlm_raised?.toString() || '0',
          marketCap: tokenInfo?.market_cap?.toString() || '0',
          currentPrice: tokenInfo?.current_price?.toString() || '0',
          priceChange24h: 0,
          volume24h: '0',
          volume7d: '0',
          holders: 1,
          createdAt: tokenInfo?.created_at ? new Date(Number(tokenInfo.created_at) * 1000) : new Date(),
          updatedAt: new Date(),
        };

        // Upsert token
        const token = await prisma.token.upsert({
          where: { address: tokenAddress },
          update: tokenData,
          create: tokenData,
        });

        // Upsert creator as user
        if (tokenCreator && tokenCreator !== 'Unknown') {
          await prisma.user.upsert({
            where: { address: tokenCreator },
            update: {
              updatedAt: new Date(),
              tokensCreatedCount: { increment: existingToken ? 0 : 1 }
            },
            create: {
              address: tokenCreator,
              points: 0,
              level: 1,
              referrals: 0,
              tokensCreatedCount: 1,
              totalVolumeTraded: '0',
              totalLiquidityProvided: '0',
            },
          });
        }

        console.log(`[SyncToken] Token synced successfully: ${tokenName}`);
        return transformToken(token);
      } catch (error) {
        console.error('[SyncToken] Error:', error);
        throw new Error(`Failed to sync token: ${error.message}`);
      }
    },
  },

  // Field resolvers for relations
  Token: {
    creatorUser: async (parent) => {
      if (!parent.creator) return null;
      try {
        const user = await prisma.user.findUnique({
          where: { address: parent.creator },
        });
        if (!user) return null;
        return {
          id: user.id,
          address: user.address,
          points: user.points || 0,
          level: user.level || 1,
          referrals: user.referrals || 0,
          tokensCreatedCount: user.tokensCreatedCount || 0,
          totalVolumeTraded: user.totalVolumeTraded?.toString() || '0',
          totalLiquidityProvided: user.totalLiquidityProvided?.toString() || '0',
          createdAt: user.createdAt?.toISOString(),
        };
      } catch {
        return null;
      }
    },
  },
};

// ============================================================================
// Apollo Server Setup
// ============================================================================
const server = new ApolloServer({
  typeDefs,
  resolvers,
  introspection: !isProduction || process.env.GRAPHQL_INTROSPECTION === 'true',
  formatError: (error) => {
    console.error('GraphQL Error:', error);
    return {
      message: error.message,
      locations: error.locations,
      path: error.path,
    };
  },
});

const handler = startServerAndCreateNextHandler(server, {
  context: async (req) => ({
    prisma,
    req,  // Pass request for header access in mutations
  }),
});

// ============================================================================
// CORS Configuration - Allowed Origins
// ============================================================================
const ALLOWED_ORIGINS = [
  'https://astroshiba.io',
  'https://app.astroshiba.io',
  'https://www.astroshiba.io',
  'https://staging.astroshiba.io',
  'https://astro-launchpad-topaz.vercel.app',
  // Development origins only in non-production
  ...(process.env.NODE_ENV !== 'production' ? [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3000',
  ] : []),
];

/**
 * Validates if the origin is allowed
 * SECURITY: Only allows origins in the whitelist
 */
function isOriginAllowed(origin) {
  if (!origin) return false;
  return ALLOWED_ORIGINS.some(allowed =>
    origin === allowed || origin.endsWith('.vercel.app')
  );
}

// ============================================================================
// Request Handler with Secure CORS
// ============================================================================
export default async function graphqlHandler(req, res) {
  const requestOrigin = req.headers.origin;

  // SECURITY: Only set CORS headers for allowed origins
  if (requestOrigin && isOriginAllowed(requestOrigin)) {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', requestOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Request-ID, X-Stellar-Address, X-Admin-Key');
    res.setHeader('Vary', 'Origin');
  }

  if (req.method === 'OPTIONS') {
    // SECURITY: Return 204 for preflight, 403 for disallowed origins
    if (requestOrigin && isOriginAllowed(requestOrigin)) {
      res.status(204).end();
    } else {
      res.status(403).json({ error: 'CORS origin not allowed' });
    }
    return;
  }

  return handler(req, res);
}

export const config = {
  api: {
    bodyParser: false,
  },
};
// Env: ADMIN_SECRET_KEY for token deletion
