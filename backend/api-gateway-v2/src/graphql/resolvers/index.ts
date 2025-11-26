// @ts-nocheck
/**
 * GraphQL Resolvers
 * Handles all GraphQL queries and mutations
 */

import type { GraphQLContext } from '../context.js'
import type { IResolvers } from 'mercurius'
import { checkDatabaseHealth } from '../../lib/prisma.js'
import {
  cacheLeaderboard,
  cacheGlobalStats,
  cacheTrendingTokens,
} from '../cache-helpers.js'
import { getCacheStats } from '../../lib/cache.js'
import { feeResolvers, feeTypeResolvers } from './fee-resolvers.js'
import { syncTokenToDatabase } from '../../lib/sync-service.js'

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
  // Health check - real implementation
  health: async (_parent: any, _args: any, context: GraphQLContext) => {
    const [dbHealth, cacheStats] = await Promise.all([
      checkDatabaseHealth().catch(() => false),
      getCacheStats().catch(() => ({ available: false, type: 'none' as const })),
    ])

    const isHealthy = dbHealth && cacheStats.available

    return {
      status: isHealthy ? 'healthy' : 'degraded',
      timestamp: new Date(),
      version: '2.0.0',
      database: dbHealth,
      cache: cacheStats,
    }
  },

  // Token queries
  token: async (_parent: any, args: { address: string }, context: GraphQLContext) => {
    return context.prisma.token.findUnique({
      where: { address: args.address },
      
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
    try {
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
          
        }),
        context.prisma.token.count({
          where,
          
        }),
      ])

      return {
        edges: (edges || []).map((node, index) => ({
          cursor: Buffer.from(`${offset + index}`).toString('base64'),
          node,
        })),
        pageInfo: {
          hasNextPage: offset + limit < total,
          hasPreviousPage: offset > 0,
          startCursor: edges && edges.length > 0 ? Buffer.from(`${offset}`).toString('base64') : null,
          endCursor: edges && edges.length > 0 ? Buffer.from(`${offset + edges.length - 1}`).toString('base64') : null,
          total: total || 0,
        },
        totalCount: total || 0,
      }
    } catch (error) {
      console.error('[Tokens] Query error:', error)
      // Return empty result to satisfy non-null schema requirement
      return {
        edges: [],
        pageInfo: {
          hasNextPage: false,
          hasPreviousPage: false,
          startCursor: null,
          endCursor: null,
          total: 0,
        },
        totalCount: 0,
      }
    }
  },

  trendingTokens: async (
    _parent: any,
    args: { limit?: number },
    context: GraphQLContext
  ) => {
    try {
      const limit = args.limit || 10

      // Use Redis cache for trending tokens (expensive query)
      const result = await cacheTrendingTokens(limit, async () => {
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

        const tokens = await context.prisma.token.findMany({
          where: {
            createdAt: { gte: sevenDaysAgo },
          },
          orderBy: [{ volume24h: 'desc' }, { holders: 'desc' }],
          take: limit,
          
        })

        return tokens || []
      })

      return result || []
    } catch (error) {
      console.error('[TrendingTokens] Query error:', error)
      return []
    }
  },

  // Pool queries
  pool: async (_parent: any, args: { address: string }, context: GraphQLContext) => {
    return context.prisma.pool.findUnique({
      where: { address: args.address },
      
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
        
      }),
      context.prisma.pool.count({
        
      }),
    ])

    return {
      edges: edges.map((node, index) => ({
        cursor: Buffer.from(`${offset + index}`).toString('base64'),
        node,
      })),
      pageInfo: {
        hasNextPage: offset + limit < total,
        hasPreviousPage: offset > 0,
        startCursor: edges.length > 0 ? Buffer.from(`${offset}`).toString('base64') : null,
        endCursor: edges.length > 0 ? Buffer.from(`${offset + edges.length - 1}`).toString('base64') : null,
        total,
      },
      totalCount: total,
    }
  },

  // User queries
  user: async (_parent: any, args: { address: string }, context: GraphQLContext) => {
    return context.prisma.user.findUnique({
      where: { address: args.address },
      
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

    try {
      // Use Redis cache for leaderboard (expensive aggregation query)
      const result = await cacheLeaderboard(type, limit, async () => {
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
          try {
            // Optimized SQL aggregation for traders
            const results: any[] = await context.prisma.$queryRaw`
              SELECT
                t."from" as address,
                COUNT(*) as trades_count,
                COALESCE(SUM(CAST(NULLIF(t.amount, '') AS DECIMAL)), 0) as total_volume,
                COALESCE(SUM(
                  CASE
                    WHEN t.type = 'TOKEN_BOUGHT' THEN -CAST(NULLIF(t.amount, '') AS DECIMAL)
                    WHEN t.type = 'TOKEN_SOLD' THEN CAST(NULLIF(t.amount, '') AS DECIMAL)
                    ELSE 0
                  END
                ), 0) as profit_loss
              FROM "Transaction" t
              WHERE
                t.type IN ('TOKEN_BOUGHT', 'TOKEN_SOLD')
                AND t.status = 'SUCCESS'
                AND t.timestamp >= ${startTime}
              GROUP BY t."from"
              HAVING COALESCE(SUM(CAST(NULLIF(t.amount, '') AS DECIMAL)), 0) > 0
              ORDER BY total_volume DESC
              LIMIT ${limit}
            `

            if (!results || results.length === 0) {
              return []
            }

            // Get user data for each address
            const addresses = results.map((r: any) => r.address).filter(Boolean)
            const users = addresses.length > 0 ? await context.prisma.user.findMany({
              where: { address: { in: addresses } },
              
            }) : []

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
              volume24h: (result.total_volume || 0).toString(),
              trades24h: parseInt(result.trades_count) || 0,
              profitLoss24h: (result.profit_loss || 0).toString(),
              volumeChange24h: 0,
              rankChange24h: 0,
            }))
          } catch (err) {
            console.error('[Leaderboard] TRADERS query error:', err)
            return []
          }
        } else if (type === 'CREATORS') {
          try {
            // Optimized for creators
            const results: any[] = await context.prisma.$queryRaw`
              SELECT
                t.creator as address,
                COUNT(*) as tokens_created,
                COALESCE(SUM(CAST(NULLIF(t."volume24h", '') AS DECIMAL)), 0) as total_volume_generated
              FROM "Token" t
              WHERE t."createdAt" >= ${startTime}
              GROUP BY t.creator
              ORDER BY tokens_created DESC, total_volume_generated DESC
              LIMIT ${limit}
            `

            if (!results || results.length === 0) {
              return []
            }

            const addresses = results.map((r: any) => r.address).filter(Boolean)
            const users = addresses.length > 0 ? await context.prisma.user.findMany({
              where: { address: { in: addresses } },
              
            }) : []

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
                tokensCreatedCount: parseInt(result.tokens_created) || 0,
                totalVolumeTraded: '0',
                totalLiquidityProvided: '0',
                createdAt: now,
              },
              volume24h: '0',
              trades24h: 0,
              profitLoss24h: '0',
              tokensCreated: parseInt(result.tokens_created) || 0,
              totalVolumeGenerated: (result.total_volume_generated || 0).toString(),
              volumeChange24h: 0,
              rankChange24h: 0,
            }))
          } catch (err) {
            console.error('[Leaderboard] CREATORS query error:', err)
            return []
          }
        } else {
          // Fallback para otros tipos (LIQUIDITY_PROVIDERS, VIRAL_TOKENS)
          return []
        }
      })

      // Ensure we always return an array
      return result || []
    } catch (error) {
      console.error('[Leaderboard] Error:', error)
      // Return empty array on error to satisfy non-null schema requirement
      return []
    }
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
        
      }),
      context.prisma.transaction.count({
        where,
        
      }),
    ])

    return {
      edges: edges.map((node, index) => ({
        cursor: Buffer.from(`${offset + index}`).toString('base64'),
        node,
      })),
      pageInfo: {
        hasNextPage: offset + limit < total,
        hasPreviousPage: offset > 0,
        startCursor: edges.length > 0 ? Buffer.from(`${offset}`).toString('base64') : null,
        endCursor: edges.length > 0 ? Buffer.from(`${offset + edges.length - 1}`).toString('base64') : null,
        total,
      },
      totalCount: total,
    }
  },

  // Global stats
  globalStats: async (_parent: any, _args: any, context: GraphQLContext) => {
    // Use Redis cache for global stats (expensive aggregation)
    return cacheGlobalStats(async () => {
      const [totalTokens, totalPools, totalUsers, tokens, pools] = await Promise.all([
        context.prisma.token.count(),
        context.prisma.pool.count(),
        context.prisma.user.count(),
        context.prisma.token.findMany({
          select: { volume24h: true },
          
        }),
        context.prisma.pool.findMany({
          select: { tvl: true },
          
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
      console.log(`[GraphQL] syncToken called for: ${tokenAddress}`)

      // Use the sync service to fetch from blockchain and store in DB
      const result = await syncTokenToDatabase(tokenAddress, context.prisma)

      if (!result.success) {
        // Even if sync failed, try to return existing token from DB
        const existingToken = await context.prisma.token.findUnique({
          where: { address: tokenAddress },
          
        })

        if (existingToken) {
          console.log(`[GraphQL] Returning existing token from DB`)
          return existingToken
        }

        throw new Error(result.message)
      }

      // Return the synced token
      if (result.token) {
        return result.token
      }

      // Fallback: fetch from DB
      const token = await context.prisma.token.findUnique({
        where: { address: tokenAddress },
        
      })

      if (!token) {
        throw new Error(`Token ${tokenAddress} not found after sync`)
      }

      return token
    } catch (error: any) {
      console.error(`[GraphQL] Failed to sync token ${tokenAddress}:`, error)
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
    // Alias fields for frontend compatibility
    logoUrl: (parent: any) => parent.imageUrl,
    bondingCurve: (parent: any) => parent.address,
    initialPrice: (parent: any) => parent.currentPrice || '0',
    holders24h: (parent: any) => parent.holders || 0,
    holdersChange24h: (parent: any) => 0, // TODO: Calculate from historical data
    website: (parent: any) => parent.website || null,
    twitter: (parent: any) => parent.twitter || null,
    telegram: (parent: any) => parent.telegram || null,
    discord: (parent: any) => parent.discord || null,

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
    // Alias fields for frontend compatibility
    liquidity: (parent: any) => parent.totalSupply || parent.tvl || '0',
    volumeChange24h: (parent: any) => 0, // TODO: Calculate from historical data
    apy: (parent: any) => parent.apr || 0,
    fee: (parent: any) => '0.3', // Default 0.3% fee

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
 * IMPORTANT: Order matters - fieldResolvers and feeTypeResolvers contain
 * type-specific resolvers (Token, Pool, User, FeeCollection, etc.)
 * Query and Mutation must be explicitly combined, not spread from feeResolvers
 */
export const resolvers: IResolvers = {
  ...scalarResolvers,
  Query: {
    ...queryResolvers,
    ...feeResolvers.Query,
  },
  Mutation: {
    ...mutationResolvers,
    ...feeResolvers.Mutation,
  },
  ...fieldResolvers,
  ...feeTypeResolvers, // Only type resolvers (FeeCollection, TokenFeePerformance), NOT Query/Mutation
} as any // Type assertion needed due to custom context type
