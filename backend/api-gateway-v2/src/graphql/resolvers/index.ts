/**
 * GraphQL Resolvers
 * Handles all GraphQL queries and mutations
 *
 * NOTE: TypeScript errors on `cacheStrategy` are expected.
 * This property is added at runtime by Prisma Accelerate extension.
 */

import type { GraphQLContext } from '../context.js'
import type { IResolvers } from 'mercurius'
import { CACHE_STRATEGIES } from '@astroshibapop/shared/prisma'
import { checkDatabaseHealth } from '@astroshibapop/shared/prisma'
import {
  cacheLeaderboard,
  cacheGlobalStats,
  cacheTrendingTokens,
  cacheTransactions,
} from '../cache-helpers.js'
import { getCacheStats } from '../../lib/cache.js'

/**
 * Custom scalar resolvers
 */
const scalarResolvers = {
  DateTime: {
    serialize(value: Date | string | number) {
      if (value instanceof Date) {
        return value.toISOString()
      }
      return new Date(value).toISOString()
    },
    parseValue(value: string | number) {
      return new Date(value)
    },
  },
  BigInt: {
    serialize(value: bigint | string) {
      return value.toString()
    },
    parseValue(value: string) {
      return value
    },
  },
}

/**
 * Query resolvers
 */
const queryResolvers = {
  // Health check
  health: async (_parent: any, _args: any, context: GraphQLContext) => {
    const [dbHealthy, cacheStats] = await Promise.all([
      checkDatabaseHealth(),
      getCacheStats(),
    ])

    return {
      status: dbHealthy ? 'healthy' : 'degraded',
      timestamp: new Date(),
      version: '2.0.0',
      database: dbHealthy,
      cache: {
        available: cacheStats.available,
        type: cacheStats.type,
      },
    }
  },

  // Token queries
  token: async (_parent: any, args: { address: string }, context: GraphQLContext) => {
    return context.prisma.token.findUnique({
      where: { address: args.address },
      cacheStrategy: CACHE_STRATEGIES.MEDIUM_TTL,
    })
  },

  tokens: async (
    _parent: any,
    args: {
      limit?: number
      offset?: number
      orderBy?: string
      search?: string
    },
    context: GraphQLContext
  ) => {
    const limit = args.limit || 20
    const offset = args.offset || 0

    // Build where clause for search
    const where = args.search
      ? {
          OR: [
            { name: { contains: args.search, mode: 'insensitive' as const } },
            { symbol: { contains: args.search, mode: 'insensitive' as const } },
          ],
        }
      : {}

    // Build orderBy
    const orderByMap: Record<string, any> = {
      CREATED_AT_DESC: { createdAt: 'desc' },
      CREATED_AT_ASC: { createdAt: 'asc' },
      MARKET_CAP_DESC: { marketCap: 'desc' },
      VOLUME_DESC: { volume24h: 'desc' },
      HOLDERS_DESC: { holders: 'desc' },
    }
    const orderBy = orderByMap[args.orderBy || 'CREATED_AT_DESC'] || { createdAt: 'desc' }

    // Execute queries in parallel
    const [edges, total] = await Promise.all([
      context.prisma.token.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy,
        cacheStrategy: CACHE_STRATEGIES.SHORT_TTL,
      }),
      context.prisma.token.count({
        where,
        cacheStrategy: CACHE_STRATEGIES.SHORT_TTL,
      }),
    ])

    return {
      edges,
      pageInfo: {
        hasNextPage: offset + limit < total,
        hasPreviousPage: offset > 0,
        total,
      },
    }
  },

  trendingTokens: async (
    _parent: any,
    args: { limit?: number },
    context: GraphQLContext
  ) => {
    const limit = args.limit || 10

    // Use Redis cache for trending tokens (expensive query)
    return cacheTrendingTokens(limit, async () => {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

      return context.prisma.token.findMany({
        where: {
          createdAt: { gte: sevenDaysAgo },
        },
        orderBy: [{ volume24h: 'desc' }, { holders: 'desc' }],
        take: limit,
        cacheStrategy: CACHE_STRATEGIES.SHORT_TTL,
      })
    })
  },

  // Pool queries
  pool: async (_parent: any, args: { address: string }, context: GraphQLContext) => {
    return context.prisma.pool.findUnique({
      where: { address: args.address },
      cacheStrategy: CACHE_STRATEGIES.MEDIUM_TTL,
    })
  },

  pools: async (
    _parent: any,
    args: { limit?: number; offset?: number },
    context: GraphQLContext
  ) => {
    const limit = args.limit || 20
    const offset = args.offset || 0

    const [edges, total] = await Promise.all([
      context.prisma.pool.findMany({
        take: limit,
        skip: offset,
        orderBy: { tvl: 'desc' },
        cacheStrategy: CACHE_STRATEGIES.SHORT_TTL,
      }),
      context.prisma.pool.count({
        cacheStrategy: CACHE_STRATEGIES.SHORT_TTL,
      }),
    ])

    return {
      edges,
      pageInfo: {
        hasNextPage: offset + limit < total,
        hasPreviousPage: offset > 0,
        total,
      },
    }
  },

  // User queries
  user: async (_parent: any, args: { address: string }, context: GraphQLContext) => {
    return context.prisma.user.findUnique({
      where: { address: args.address },
      cacheStrategy: CACHE_STRATEGIES.MEDIUM_TTL,
    })
  },

  leaderboard: async (
    _parent: any,
    args: { type: string; limit?: number; timeframe?: string },
    context: GraphQLContext
  ) => {
    const limit = args.limit || 100
    const type = args.type || 'TRADERS'
    const timeframe = args.timeframe || 'DAY'

    // Use Redis cache for leaderboard (expensive aggregation query)
    return cacheLeaderboard(type, limit, async () => {
      // Calculate timeframe filter
      const now = new Date()
      let startTime: Date

      switch (timeframe) {
        case 'HOUR':
          startTime = new Date(now.getTime() - 60 * 60 * 1000)
          break
        case 'DAY':
          startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000)
          break
        case 'WEEK':
          startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          break
        case 'MONTH':
          startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
          break
        case 'ALL_TIME':
          startTime = new Date(0)
          break
        default:
          startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000)
      }

      if (type === 'TRADERS') {
        // Optimized SQL aggregation for traders
        // GROUP BY user address, calculate volume, trades, and P/L
        const results: any[] = await context.prisma.$queryRaw`
          SELECT
            t."from" as address,
            COUNT(*) as trades_count,
            SUM(CAST(t.amount AS DECIMAL)) as total_volume,
            SUM(
              CASE
                WHEN t.type = 'TOKEN_BOUGHT' THEN -CAST(t.amount AS DECIMAL)
                WHEN t.type = 'TOKEN_SOLD' THEN CAST(t.amount AS DECIMAL)
                ELSE 0
              END
            ) as profit_loss
          FROM "Transaction" t
          WHERE
            t.type IN ('TOKEN_BOUGHT', 'TOKEN_SOLD')
            AND t.status = 'SUCCESS'
            AND t.timestamp >= ${startTime}
          GROUP BY t."from"
          HAVING SUM(CAST(t.amount AS DECIMAL)) > 0
          ORDER BY total_volume DESC
          LIMIT ${limit}
        `

        // Get user data for each address
        const addresses = results.map((r: any) => r.address)
        const users = await context.prisma.user.findMany({
          where: { address: { in: addresses } },
          cacheStrategy: CACHE_STRATEGIES.SHORT_TTL,
        })

        const userMap = new Map(users.map(u => [u.address, u]))

        return results.map((result: any, index: number) => ({
          rank: index + 1,
          address: result.address,
          user: userMap.get(result.address) || {
            id: result.address,
            address: result.address,
            points: 0,
            level: 1,
            referrals: 0,
            tokensCreatedCount: 0,
            totalVolumeTraded: '0',
            totalLiquidityProvided: '0',
            createdAt: now,
          },
          volume24h: result.total_volume.toString(),
          trades24h: parseInt(result.trades_count),
          profitLoss24h: result.profit_loss.toString(),
          volumeChange24h: 0,
          rankChange24h: 0,
        }))
      } else if (type === 'CREATORS') {
        // Optimized for creators
        const results: any[] = await context.prisma.$queryRaw`
          SELECT
            t.creator as address,
            COUNT(*) as tokens_created,
            SUM(CAST(t."volume24h" AS DECIMAL)) as total_volume_generated
          FROM "Token" t
          WHERE t."createdAt" >= ${startTime}
          GROUP BY t.creator
          ORDER BY tokens_created DESC, total_volume_generated DESC
          LIMIT ${limit}
        `

        const addresses = results.map((r: any) => r.address)
        const users = await context.prisma.user.findMany({
          where: { address: { in: addresses } },
          cacheStrategy: CACHE_STRATEGIES.SHORT_TTL,
        })

        const userMap = new Map(users.map(u => [u.address, u]))

        return results.map((result: any, index: number) => ({
          rank: index + 1,
          address: result.address,
          user: userMap.get(result.address) || {
            id: result.address,
            address: result.address,
            points: 0,
            level: 1,
            referrals: 0,
            tokensCreatedCount: parseInt(result.tokens_created),
            totalVolumeTraded: '0',
            totalLiquidityProvided: '0',
            createdAt: now,
          },
          volume24h: '0',
          trades24h: 0,
          profitLoss24h: '0',
          tokensCreated: parseInt(result.tokens_created),
          totalVolumeGenerated: result.total_volume_generated.toString(),
          volumeChange24h: 0,
          rankChange24h: 0,
        }))
      } else {
        // Fallback para otros tipos
        return []
      }
    })
  },

  // Transaction queries
  transactions: async (
    _parent: any,
    args: {
      address?: string
      tokenAddress?: string
      type?: string
      limit?: number
      offset?: number
    },
    context: GraphQLContext
  ) => {
    const limit = args.limit || 20
    const offset = args.offset || 0

    const where: any = {}

    if (args.address) {
      where.OR = [{ from: args.address }, { to: args.address }]
    }

    if (args.tokenAddress) {
      where.tokenAddress = args.tokenAddress
    }

    if (args.type) {
      where.type = args.type
    }

    const [edges, total] = await Promise.all([
      context.prisma.transaction.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { timestamp: 'desc' },
        cacheStrategy: CACHE_STRATEGIES.SHORT_TTL,
      }),
      context.prisma.transaction.count({
        where,
        cacheStrategy: CACHE_STRATEGIES.SHORT_TTL,
      }),
    ])

    return {
      edges,
      pageInfo: {
        hasNextPage: offset + limit < total,
        hasPreviousPage: offset > 0,
        total,
      },
    }
  },

  // Global stats
  globalStats: async (_parent: any, _args: any, context: GraphQLContext) => {
    // Use Redis cache for global stats (expensive aggregation)
    return cacheGlobalStats(async () => {
      const [totalTokens, totalPools, totalUsers, tokens, pools] = await Promise.all([
        context.prisma.token.count({ cacheStrategy: CACHE_STRATEGIES.SHORT_TTL }),
        context.prisma.pool.count({ cacheStrategy: CACHE_STRATEGIES.SHORT_TTL }),
        context.prisma.user.count({ cacheStrategy: CACHE_STRATEGIES.SHORT_TTL }),
        context.prisma.token.findMany({
          select: { volume24h: true },
          cacheStrategy: CACHE_STRATEGIES.SHORT_TTL,
        }),
        context.prisma.pool.findMany({
          select: { tvl: true },
          cacheStrategy: CACHE_STRATEGIES.SHORT_TTL,
        }),
      ])

      const totalVolume24h = tokens.reduce(
        (sum, token) => sum + BigInt(token.volume24h),
        BigInt(0)
      )

      const totalTVL = pools.reduce((sum, pool) => sum + BigInt(pool.tvl || '0'), BigInt(0))

      return {
        totalTokens,
        totalPools,
        totalUsers,
        totalVolume24h: totalVolume24h.toString(),
        totalTVL: totalTVL.toString(),
      }
    })
  },
}

/**
 * Mutation resolvers
 */
const mutationResolvers = {
  // Sync a token from blockchain to database
  syncToken: async (_parent: any, args: { tokenAddress: string }, context: GraphQLContext) => {
    const { tokenAddress } = args

    try {
      // Import and call processToken from sync script
      const { processToken } = await import('../../../shared/scripts/sync-tokens.js')
      await processToken(tokenAddress)

      // Return synced token from database
      const token = await context.prisma.token.findUnique({
        where: { address: tokenAddress },
        cacheStrategy: CACHE_STRATEGIES.SHORT_TTL,
      })

      if (!token) {
        throw new Error(`Token ${tokenAddress} not found after sync`)
      }

      return token
    } catch (error: any) {
      console.error(`Failed to sync token ${tokenAddress}:`, error)
      throw new Error(`Failed to sync token: ${error.message}`)
    }
  },
}

/**
 * Field resolvers
 * These resolve nested fields in types
 * Optimized with DataLoaders to prevent N+1 queries
 */
const fieldResolvers = {
  Token: {
    // Creator user relationship
    creatorUser: async (parent: any, _args: any, context: GraphQLContext) => {
      // Use DataLoader to batch user lookups
      return context.loaders.userLoader.load(parent.creator)
    },

    // Pools relationship
    pools: async (parent: any, _args: any, context: GraphQLContext) => {
      // Use DataLoader to batch pool lookups by token
      return context.loaders.poolsByTokenLoader.load(parent.address)
    },
  },

  Pool: {
    // Token0 relationship
    token0: async (parent: any, _args: any, context: GraphQLContext) => {
      // Use DataLoader to batch token lookups
      return context.loaders.tokenLoader.load(parent.token0Address)
    },

    // Token1 relationship
    token1: async (parent: any, _args: any, context: GraphQLContext) => {
      // Use DataLoader to batch token lookups
      return context.loaders.tokenLoader.load(parent.token1Address)
    },
  },

  User: {
    // Tokens created relationship
    tokensCreated: async (parent: any, _args: any, context: GraphQLContext) => {
      // Use DataLoader to batch tokens-by-creator lookups
      return context.loaders.tokensByCreatorLoader.load(parent.address)
    },

    // Achievements relationship
    achievements: async (parent: any, _args: any, context: GraphQLContext) => {
      // Use DataLoader to batch achievements-by-user lookups
      return context.loaders.achievementsByUserIdLoader.load(parent.id)
    },
  },

  Transaction: {
    // Token relationship
    token: async (parent: any, _args: any, context: GraphQLContext) => {
      if (!parent.tokenAddress) return null
      // Use DataLoader to batch token lookups
      return context.loaders.tokenLoader.load(parent.tokenAddress)
    },

    // User relationship
    user: async (parent: any, _args: any, context: GraphQLContext) => {
      if (!parent.userId) return null
      // Use DataLoader to batch user lookups by ID
      return context.loaders.userByIdLoader.load(parent.userId)
    },
  },
}

/**
 * Combine all resolvers
 */
export const resolvers: IResolvers = {
  ...scalarResolvers,
  Query: queryResolvers,
  Mutation: mutationResolvers,
  ...fieldResolvers,
} as any // Type assertion needed due to custom context type
