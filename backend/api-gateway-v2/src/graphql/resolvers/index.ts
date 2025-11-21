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
    args: { type: string; limit?: number },
    context: GraphQLContext
  ) => {
    const limit = args.limit || 100
    const type = args.type

    // Use Redis cache for leaderboard (expensive query)
    return cacheLeaderboard(type, limit, async () => {
      let orderBy: any
      let valueField: string

      switch (type) {
        case 'CREATORS':
          orderBy = { tokensCreatedCount: 'desc' }
          valueField = 'tokensCreatedCount'
          break
        case 'TRADERS':
          orderBy = { totalVolumeTraded: 'desc' }
          valueField = 'totalVolumeTraded'
          break
        case 'LIQUIDITY_PROVIDERS':
          orderBy = { totalLiquidityProvided: 'desc' }
          valueField = 'totalLiquidityProvided'
          break
        case 'VIRAL_TOKENS':
          orderBy = { points: 'desc' }
          valueField = 'points'
          break
        default:
          orderBy = { points: 'desc' }
          valueField = 'points'
      }

      const users = await context.prisma.user.findMany({
        orderBy,
        take: limit,
        cacheStrategy: CACHE_STRATEGIES.MEDIUM_TTL,
      })

      return users.map((user, index) => ({
        rank: index + 1,
        address: user.address,
        user,
        value: String((user as any)[valueField]),
        change24h: 0, // TODO: Calculate from history
      }))
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
  ...fieldResolvers,
} as any // Type assertion needed due to custom context type
