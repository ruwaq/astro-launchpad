/**
 * GraphQL Resolvers
 * Handles all GraphQL queries and mutations
 */

import type { GraphQLContext } from '../context.js'
import { requireAuth, validateAdminKeyFromHeader } from '../context.js'
import { GraphQLError } from 'graphql'

// Type definition for GraphQL resolvers (replacing mercurius IResolvers)
type IResolvers = Record<string, any>
import {
  validateStellarAddress,
  validateLimit,
  validateOffset,
  validateSearchString,
  validateOrderBy,
  validateTimeframe,
  validateLeaderboardType,
  validateTransactionType,
} from '../../lib/validators.js'
import { checkDatabaseHealth } from '../../lib/prisma.js'
import {
  cacheLeaderboard,
  cacheGlobalStats,
  cacheTrendingTokens,
} from '../cache-helpers.js'
import { getCacheStats } from '../../lib/cache.js'
import { feeResolvers, feeTypeResolvers } from './fee-resolvers.js'
import { syncTokenToDatabase } from '../../lib/sync-service.js'
import { logger } from '../../lib/logger.js'
import {
  syncTokenRateLimiter,
  adminRateLimiter,
  trackFailedAdminAuth,
  getClientIP,
} from '../../lib/rate-limiter.js'
import crypto from 'crypto'

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
  // Health check - real implementation with token stats for debugging
  health: async (_parent: any, _args: any, context: GraphQLContext) => {
    const [dbHealth, cacheStats] = await Promise.all([
      checkDatabaseHealth().catch(() => false),
      getCacheStats().catch(() => ({ available: false, type: 'none' as const })),
    ])

    // Get token stats for debugging soft-delete
    let tokenStats = null
    try {
      const [totalResult, activeResult, deletedResult] = await Promise.all([
        context.prisma.$queryRaw`SELECT COUNT(*)::int as count FROM "Token"` as Promise<{count: number}[]>,
        context.prisma.$queryRaw`SELECT COUNT(*)::int as count FROM "Token" WHERE "deletedAt" IS NULL` as Promise<{count: number}[]>,
        context.prisma.$queryRaw`SELECT name FROM "Token" WHERE "deletedAt" IS NOT NULL` as Promise<{name: string}[]>,
      ])
      tokenStats = {
        totalTokens: totalResult[0]?.count || 0,
        activeTokens: activeResult[0]?.count || 0,
        deletedTokens: (totalResult[0]?.count || 0) - (activeResult[0]?.count || 0),
        deletedTokenNames: deletedResult.map(r => r.name),
      }
    } catch (error) {
      logger.error({ error }, '[Health] Failed to get token stats')
    }

    const isHealthy = dbHealth && cacheStats.available

    return {
      status: isHealthy ? 'healthy' : 'degraded',
      timestamp: new Date(),
      version: '2.0.0',
      database: dbHealth,
      cache: cacheStats,
      tokenStats,
    }
  },

  // Token queries
  token: async (_parent: any, args: { address: string }, context: GraphQLContext) => {
    // Validate token address
    const address = validateStellarAddress(args.address, 'token address');

    // PERFORMANCE: Select only fields needed by frontend
    // FIX: Added xlmRaised which is used by frontend for graduation progress
    return context.prisma.token.findUnique({
      where: { address },
      select: {
        id: true,
        address: true,
        name: true,
        symbol: true,
        description: true,
        imageUrl: true,
        decimals: true,
        totalSupply: true,
        circulatingSupply: true,
        currentPrice: true,
        priceChange24h: true,
        volume24h: true,
        marketCap: true,
        holders: true,
        xlmReserve: true,
        xlmRaised: true,  // FIX: Added for graduation progress display
        graduated: true,
        creator: true,
        website: true,
        twitter: true,
        telegram: true,
        discord: true,
        createdAt: true,
        updatedAt: true,
      },
    })
  },

  tokens: async (
    _parent: any,
    args: {
      limit?: number
      offset?: number
      after?: string
      orderBy?: string
      search?: string
      status?: string
    },
    context: GraphQLContext
  ) => {
    try {
      // Validate and sanitize inputs
      const limit = validateLimit(args.limit, 100, 20);
      const search = validateSearchString(args.search, 100);
      const orderByKey = validateOrderBy(
        args.orderBy,
        ['CREATED_AT_DESC', 'CREATED_AT_ASC', 'MARKET_CAP_DESC', 'VOLUME_DESC', 'HOLDERS_DESC', 'GRADUATION_DESC'],
        'CREATED_AT_DESC'
      );

      // Handle cursor-based pagination (after) or offset-based pagination
      let offset = 0;
      if (args.after) {
        try {
          // Decode cursor (base64 encoded offset)
          const decodedCursor = Buffer.from(args.after, 'base64').toString('utf-8');
          const cursorOffset = parseInt(decodedCursor, 10);
          if (!isNaN(cursorOffset)) {
            offset = cursorOffset + 1; // Start after the cursor position
          }
        } catch {
          // Invalid cursor, start from beginning
          offset = 0;
        }
      } else {
        offset = validateOffset(args.offset);
      }

      // Build ORDER BY clause
      const orderByMap: Record<string, string> = {
        CREATED_AT_DESC: '"createdAt" DESC',
        CREATED_AT_ASC: '"createdAt" ASC',
        MARKET_CAP_DESC: '"marketCap" DESC NULLS LAST',
        VOLUME_DESC: '"volume24h" DESC',
        HOLDERS_DESC: 'holders DESC',
        GRADUATION_DESC: '"xlmRaised" DESC',
      }
      const orderByClause = orderByMap[orderByKey] || '"createdAt" DESC'

      // Build WHERE conditions using raw SQL to guarantee soft-delete filtering
      // This bypasses any Prisma client generation issues
      const whereConditions: string[] = ['"deletedAt" IS NULL']
      const params: any[] = []
      let paramIndex = 1

      // Search filter
      if (search) {
        whereConditions.push(`(LOWER(name) LIKE $${paramIndex} OR LOWER(symbol) LIKE $${paramIndex})`)
        params.push(`%${search.toLowerCase()}%`)
        paramIndex++
      }

      // Status filter
      if (args.status && args.status !== 'ALL') {
        if (args.status === 'BONDING') {
          whereConditions.push('graduated = false')
        } else if (args.status === 'GRADUATED') {
          whereConditions.push('graduated = true')
        }
      }

      const whereClause = whereConditions.join(' AND ')
      params.push(limit, offset)

      // Execute raw SQL queries for guaranteed soft-delete filtering
      const tokensQuery = `
        SELECT id, address, name, symbol, "imageUrl", "currentPrice", "priceChange24h",
               "volume24h", "marketCap", holders, graduated, creator, "createdAt"
        FROM "Token"
        WHERE ${whereClause}
        ORDER BY ${orderByClause}
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `

      const countQuery = `
        SELECT COUNT(*)::int as count
        FROM "Token"
        WHERE ${whereClause}
      `

      logger.info({ whereClause, params: params.slice(0, -2) }, '[Tokens] Raw SQL query')

      // Execute queries in parallel
      const [tokensResult, countResult] = await Promise.all([
        context.prisma.$queryRawUnsafe(tokensQuery, ...params) as Promise<any[]>,
        context.prisma.$queryRawUnsafe(countQuery, ...params.slice(0, -2)) as Promise<{count: number}[]>,
      ])

      const edges = tokensResult || []
      const total = countResult[0]?.count || 0

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
      logger.error({ error }, '[Tokens] Query error')
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

        // PERFORMANCE: Select only fields needed for trending list
        const tokens = await context.prisma.token.findMany({
          where: {
            deletedAt: null,
            createdAt: { gte: sevenDaysAgo },
          },
          orderBy: [{ volume24h: 'desc' }, { holders: 'desc' }],
          take: limit,
          select: {
            id: true,
            address: true,
            name: true,
            symbol: true,
            imageUrl: true,
            currentPrice: true,
            priceChange24h: true,
            volume24h: true,
            marketCap: true,
            holders: true,
            graduated: true,
            creator: true,
            createdAt: true,
          },
        })

        return tokens || []
      })

      return result || []
    } catch (error) {
      logger.error({ error }, '[TrendingTokens] Query error')
      return []
    }
  },

  // Pool queries
  pool: async (_parent: any, args: { address: string }, context: GraphQLContext) => {
    try {
      // Validate pool address (contract addresses start with C)
      const address = validateStellarAddress(args.address, 'pool address')

      return context.prisma.pool.findUnique({
        where: { address },
        select: {
          id: true,
          address: true,
          token0Address: true,
          token1Address: true,
          reserve0: true,
          reserve1: true,
          totalSupply: true,
          tvl: true,
          volume24h: true,
          volume7d: true,
          apr: true,
          feeRate: true,
          createdAt: true,
          updatedAt: true,
        },
      })
    } catch (error: any) {
      logger.error({ error, args }, 'Pool query failed')
      throw new GraphQLError(`Failed to fetch pool: ${error.message}`, {
        extensions: { code: 'POOL_QUERY_ERROR' },
      })
    }
  },

  pools: async (
    _parent: any,
    args: { limit?: number; offset?: number },
    context: GraphQLContext
  ) => {
    try {
      const limit = args.limit || 20
      const offset = args.offset || 0

      // PERFORMANCE: Select only required fields to prevent N+1 queries
      const [edges, total] = await Promise.all([
        context.prisma.pool.findMany({
          take: limit,
          skip: offset,
          orderBy: { tvl: 'desc' },
          select: {
            id: true,
            address: true,
            token0Address: true,
            token1Address: true,
            reserve0: true,
            reserve1: true,
            totalSupply: true,
            tvl: true,
            volume24h: true,
            volume7d: true,
            apr: true,
            feeRate: true,
            createdAt: true,
            updatedAt: true,
          },
        }),
        context.prisma.pool.count(),
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
    } catch (error) {
      logger.error({ error }, '[Pools] Query error')
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

  // User queries
  user: async (_parent: any, args: { address: string }, context: GraphQLContext) => {
    // Validate user address
    const address = validateStellarAddress(args.address, 'user address');

    // PERFORMANCE: Select only fields needed for user profile
    return context.prisma.user.findUnique({
      where: { address },
      select: {
        id: true,
        address: true,
        points: true,
        level: true,
        referrals: true,
        tokensCreatedCount: true,
        totalVolumeTraded: true,
        totalLiquidityProvided: true,
        createdAt: true,
        updatedAt: true,
      },
    })
  },

  leaderboard: async (
    _parent: any,
    args: { type: string; limit?: number; timeframe?: string },
    context: GraphQLContext
  ) => {
    // Validate and sanitize inputs
    const limit = validateLimit(args.limit, 100, 100);
    const type = validateLeaderboardType(args.type, 'TRADERS');
    const timeframe = validateTimeframe(args.timeframe, 'DAY');

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
                updatedAt: now,
              },
              volume24h: (result.total_volume || 0).toString(),
              trades24h: Number(result.trades_count) || 0,
              profitLoss24h: (result.profit_loss || 0).toString(),
              // Would need UserActivitySnapshot to calculate volume/rank changes
              volumeChange24h: 0,
              rankChange24h: 0,
            }))
          } catch (err) {
            logger.error({ error: err }, '[Leaderboard] TRADERS query error')
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
                tokensCreatedCount: Number(result.tokens_created) || 0,
                totalVolumeTraded: '0',
                totalLiquidityProvided: '0',
                createdAt: now,
                updatedAt: now,
              },
              volume24h: '0',
              trades24h: 0,
              profitLoss24h: '0',
              tokensCreated: Number(result.tokens_created) || 0,
              totalVolumeGenerated: (result.total_volume_generated || 0).toString(),
              // Would need CreatorActivitySnapshot to calculate volume/rank changes
              volumeChange24h: 0,
              rankChange24h: 0,
            }))
          } catch (err) {
            logger.error({ error: err }, '[Leaderboard] CREATORS query error')
            return []
          }
        } else if (type === 'LIQUIDITY_PROVIDERS') {
          try {
            // Aggregate liquidity events by provider
            const results: any[] = await context.prisma.$queryRaw`
              SELECT
                le.provider as address,
                COUNT(*) as events_count,
                COALESCE(SUM(CAST(NULLIF(le.liquidity, '') AS DECIMAL)), 0) as total_liquidity,
                COALESCE(SUM(
                  CASE
                    WHEN le.type = 'ADD' THEN CAST(NULLIF(le.liquidity, '') AS DECIMAL)
                    WHEN le.type = 'REMOVE' THEN -CAST(NULLIF(le.liquidity, '') AS DECIMAL)
                    ELSE 0
                  END
                ), 0) as net_liquidity
              FROM "LiquidityEvent" le
              WHERE le.timestamp >= ${startTime}
              GROUP BY le.provider
              HAVING COALESCE(SUM(
                CASE
                  WHEN le.type = 'ADD' THEN CAST(NULLIF(le.liquidity, '') AS DECIMAL)
                  ELSE 0
                END
              ), 0) > 0
              ORDER BY total_liquidity DESC
              LIMIT ${limit}
            `

            if (!results || results.length === 0) {
              return []
            }

            const addresses = results.map((r: any) => r.address).filter(Boolean)

            // Fetch users and fees in parallel for efficiency
            const [users, feesResults] = await Promise.all([
              addresses.length > 0 ? context.prisma.user.findMany({
                where: { address: { in: addresses } },
              }) : Promise.resolve([]),
              // Calculate fees earned by each LP based on their share of pool liquidity
              // LP fees are distributed proportionally to liquidity providers
              //
              // NOTE: FeeCollection.tokenAddress is the TOKEN address, not pool address.
              // Pool has token0Address (usually XLM) and token1Address (the token).
              // We join on pool's token addresses to match fees correctly.
              context.prisma.$queryRaw<Array<{ provider: string; fees_earned: bigint | null }>>`
                WITH provider_pools AS (
                  -- Get each provider's current liquidity in each pool
                  SELECT
                    le.provider,
                    le."poolId",
                    COALESCE(SUM(
                      CASE
                        WHEN le.type = 'ADD' THEN CAST(NULLIF(le.liquidity, '') AS DECIMAL)
                        WHEN le.type = 'REMOVE' THEN -CAST(NULLIF(le.liquidity, '') AS DECIMAL)
                        ELSE 0
                      END
                    ), 0) as provider_liquidity
                  FROM "LiquidityEvent" le
                  WHERE le.provider = ANY(${addresses})
                  GROUP BY le.provider, le."poolId"
                  HAVING COALESCE(SUM(
                    CASE
                      WHEN le.type = 'ADD' THEN CAST(NULLIF(le.liquidity, '') AS DECIMAL)
                      WHEN le.type = 'REMOVE' THEN -CAST(NULLIF(le.liquidity, '') AS DECIMAL)
                      ELSE 0
                    END
                  ), 0) > 0
                ),
                pool_totals AS (
                  -- Get total liquidity and token addresses for each pool
                  SELECT
                    p.id as pool_id,
                    p."token0Address",
                    p."token1Address",
                    CAST(NULLIF(p."totalSupply", '') AS DECIMAL) as total_supply
                  FROM "Pool" p
                ),
                pool_fees_24h AS (
                  -- Get LP fees collected in last 24h for each token
                  SELECT
                    fc."tokenAddress",
                    COALESCE(SUM(CAST(NULLIF(fc."lpFee", '') AS DECIMAL)), 0) as lp_fees
                  FROM "FeeCollection" fc
                  WHERE fc.timestamp >= ${startTime}
                    AND fc."lpFee" IS NOT NULL
                    AND fc."lpFee" != ''
                  GROUP BY fc."tokenAddress"
                )
                SELECT
                  pp.provider,
                  COALESCE(SUM(
                    CASE
                      WHEN pt.total_supply > 0 THEN
                        (pp.provider_liquidity / pt.total_supply) * (
                          COALESCE(pf0.lp_fees, 0) + COALESCE(pf1.lp_fees, 0)
                        )
                      ELSE 0
                    END
                  ), 0)::BIGINT as fees_earned
                FROM provider_pools pp
                JOIN pool_totals pt ON pp."poolId" = pt.pool_id
                LEFT JOIN pool_fees_24h pf0 ON pt."token0Address" = pf0."tokenAddress"
                LEFT JOIN pool_fees_24h pf1 ON pt."token1Address" = pf1."tokenAddress"
                GROUP BY pp.provider
              `,
            ])

            const userMap = new Map(users.map(u => [u.address, u]))
            const feesMap = new Map(
              feesResults.map(f => [f.provider, (f.fees_earned || BigInt(0)).toString()])
            )

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
                totalLiquidityProvided: (result.net_liquidity || 0).toString(),
                createdAt: now,
                updatedAt: now,
              },
              volume24h: '0',
              trades24h: 0,
              profitLoss24h: '0',
              totalLiquidity: (result.net_liquidity || 0).toString(),
              // Real fees earned based on LP's proportional share of pool liquidity
              feesEarned24h: feesMap.get(result.address) || '0',
              // Would need PoolSnapshot table to calculate volume change
              volumeChange24h: 0,
              rankChange24h: 0,
            }))
          } catch (err) {
            logger.error({ error: err }, '[Leaderboard] LIQUIDITY_PROVIDERS query error')
            return []
          }
        } else {
          // Fallback for VIRAL_TOKENS (not yet implemented)
          return []
        }
      })

      // Ensure we always return an array
      return result || []
    } catch (error) {
      logger.error({ error }, '[Leaderboard] Error')
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
    // SECURITY: Validate all inputs to prevent injection and DoS
    const limit = validateLimit(args.limit, 100, 20)
    const offset = validateOffset(args.offset)

    const where: any = {}

    // Validate Stellar addresses if provided
    if (args.address) {
      const validatedAddress = validateStellarAddress(args.address, 'address')
      where.OR = [{ from: validatedAddress }, { to: validatedAddress }]
    }

    if (args.tokenAddress) {
      const validatedTokenAddress = validateStellarAddress(args.tokenAddress, 'tokenAddress')
      where.tokenAddress = validatedTokenAddress
    }

    // Validate transaction type against allowed enum values
    if (args.type) {
      const validatedType = validateTransactionType(args.type)
      where.type = validatedType
    }

    // PERFORMANCE: Select only fields needed for transaction list
    // FIX: Added grossAmount, netAmount, protocolFee, lpFee for frontend display
    const [edges, total] = await Promise.all([
      context.prisma.transaction.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { timestamp: 'desc' },
        select: {
          id: true,
          hash: true,
          type: true,
          from: true,
          to: true,
          amount: true,
          grossAmount: true,
          netAmount: true,
          protocolFee: true,
          lpFee: true,
          status: true,
          timestamp: true,
          tokenAddress: true,
          userId: true,
        },
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

  // Global stats - Optimized with SQL aggregation to avoid loading all records
  globalStats: async (_parent: any, _args: any, context: GraphQLContext) => {
    // Use Redis cache for global stats (expensive aggregation)
    return cacheGlobalStats(async () => {
      // Use SQL aggregation instead of loading all records into memory
      const [totalTokens, totalPools, totalUsers, volumeResult, tvlResult] = await Promise.all([
        context.prisma.token.count(),
        context.prisma.pool.count(),
        context.prisma.user.count(),
        // Aggregate volume24h using raw SQL for performance
        context.prisma.$queryRaw<[{ total: string | null }]>`
          SELECT COALESCE(SUM(CAST(NULLIF("volume24h", '') AS DECIMAL)), 0)::text as total
          FROM "Token"
        `,
        // Aggregate TVL using raw SQL for performance
        context.prisma.$queryRaw<[{ total: string | null }]>`
          SELECT COALESCE(SUM(CAST(NULLIF("tvl", '') AS DECIMAL)), 0)::text as total
          FROM "Pool"
        `,
      ])

      const totalVolume24h = volumeResult[0]?.total || '0'
      const totalTVL = tvlResult[0]?.total || '0'

      return {
        totalTokens,
        totalPools,
        totalUsers,
        totalVolume24h,
        totalTVL,
      }
    })
  },
}

// Admin key validation moved to context.ts - validateAdminKeyFromHeader()
// SECURITY: Admin key is now read from X-Admin-Key header instead of GraphQL arguments
// This prevents the key from being logged or visible in browser DevTools

/**
 * Mutation resolvers
 */
const mutationResolvers = {
  // Delete a single token from database (admin only)
  // SECURITY: Admin key must be sent via X-Admin-Key header (not in GraphQL arguments)
  deleteToken: async (
    _parent: any,
    args: { tokenAddress: string },
    context: GraphQLContext
  ) => {
    // Get client IP for rate limiting
    const clientIP = context.request?.headers?.['x-forwarded-for'] as string || 'unknown'

    // Rate limit admin operations
    const rateLimitResult = await adminRateLimiter.check(clientIP)
    if (!rateLimitResult.allowed) {
      logger.warn({ clientIP, tokenAddress: args.tokenAddress }, '[Admin] Rate limit exceeded for delete')
      return {
        success: false,
        address: args.tokenAddress,
        message: `Rate limit exceeded. Try again in ${rateLimitResult.retryAfter} seconds.`,
      }
    }

    // SECURITY: Validate admin key from X-Admin-Key header (timing-safe)
    const adminKeyResult = validateAdminKeyFromHeader(context)
    if (!adminKeyResult.valid) {
      // Track failed auth attempts
      const authResult = await trackFailedAdminAuth(clientIP)
      if (authResult.blocked) {
        logger.error({ clientIP }, '[Admin] Blocked due to too many failed auth attempts')
        return {
          success: false,
          address: args.tokenAddress,
          message: 'Too many failed attempts. Please try again later.',
        }
      }

      logger.warn({ tokenAddress: args.tokenAddress, clientIP, attemptsRemaining: authResult.attemptsRemaining, error: adminKeyResult.error }, '[Admin] Unauthorized delete attempt')
      return {
        success: false,
        address: args.tokenAddress,
        message: `Unauthorized: ${adminKeyResult.error}`,
      }
    }

    const tokenAddress = validateStellarAddress(args.tokenAddress, 'token address')

    try {
      // Check if token exists
      const existingToken = await context.prisma.token.findUnique({
        where: { address: tokenAddress },
        select: { id: true, name: true, symbol: true },
      })

      if (!existingToken) {
        return {
          success: false,
          address: tokenAddress,
          message: 'Token not found in database',
        }
      }

      // Delete related transactions first
      await context.prisma.transaction.deleteMany({
        where: { tokenAddress },
      })

      // Delete the token
      await context.prisma.token.delete({
        where: { address: tokenAddress },
      })

      logger.info(
        { tokenAddress, name: existingToken.name, symbol: existingToken.symbol },
        '[Admin] Token deleted successfully'
      )

      return {
        success: true,
        address: tokenAddress,
        message: `Token ${existingToken.symbol} (${existingToken.name}) deleted successfully`,
      }
    } catch (error: any) {
      logger.error({ error, tokenAddress }, '[Admin] Failed to delete token')
      return {
        success: false,
        address: tokenAddress,
        message: `Failed to delete token: ${error.message}`,
      }
    }
  },

  // Delete multiple tokens from database (admin only)
  // SECURITY: Admin key must be sent via X-Admin-Key header (not in GraphQL arguments)
  deleteTokensBatch: async (
    _parent: any,
    args: { tokenAddresses: string[] },
    context: GraphQLContext
  ) => {
    // Get client IP for rate limiting
    const clientIP = context.request?.headers?.['x-forwarded-for'] as string || 'unknown'

    // Rate limit admin operations
    const rateLimitResult = await adminRateLimiter.check(clientIP)
    if (!rateLimitResult.allowed) {
      logger.warn({ clientIP, count: args.tokenAddresses.length }, '[Admin] Rate limit exceeded for batch delete')
      return {
        success: false,
        deletedCount: 0,
        failedCount: args.tokenAddresses.length,
        results: args.tokenAddresses.map((address) => ({
          success: false,
          address,
          message: `Rate limit exceeded. Try again in ${rateLimitResult.retryAfter} seconds.`,
        })),
      }
    }

    // SECURITY: Validate admin key from X-Admin-Key header (timing-safe)
    const adminKeyResult = validateAdminKeyFromHeader(context)
    if (!adminKeyResult.valid) {
      // Track failed auth attempts
      const authResult = await trackFailedAdminAuth(clientIP)
      if (authResult.blocked) {
        logger.error({ clientIP }, '[Admin] Blocked due to too many failed auth attempts')
        return {
          success: false,
          deletedCount: 0,
          failedCount: args.tokenAddresses.length,
          results: args.tokenAddresses.map((address) => ({
            success: false,
            address,
            message: 'Too many failed attempts. Please try again later.',
          })),
        }
      }

      logger.warn({ count: args.tokenAddresses.length, clientIP, attemptsRemaining: authResult.attemptsRemaining, error: adminKeyResult.error }, '[Admin] Unauthorized batch delete attempt')
      return {
        success: false,
        deletedCount: 0,
        failedCount: args.tokenAddresses.length,
        results: args.tokenAddresses.map((address) => ({
          success: false,
          address,
          message: `Unauthorized: ${adminKeyResult.error}`,
        })),
      }
    }

    const results: Array<{ success: boolean; address: string; message?: string }> = []
    let deletedCount = 0
    let failedCount = 0

    for (const tokenAddress of args.tokenAddresses) {
      try {
        const validatedAddress = validateStellarAddress(tokenAddress, 'token address')

        // Check if token exists
        const existingToken = await context.prisma.token.findUnique({
          where: { address: validatedAddress },
          select: { id: true, name: true, symbol: true },
        })

        if (!existingToken) {
          results.push({
            success: false,
            address: validatedAddress,
            message: 'Token not found in database',
          })
          failedCount++
          continue
        }

        // Delete related transactions first
        await context.prisma.transaction.deleteMany({
          where: { tokenAddress: validatedAddress },
        })

        // Delete the token
        await context.prisma.token.delete({
          where: { address: validatedAddress },
        })

        results.push({
          success: true,
          address: validatedAddress,
          message: `Token ${existingToken.symbol} deleted`,
        })
        deletedCount++
      } catch (error: any) {
        results.push({
          success: false,
          address: tokenAddress,
          message: error.message,
        })
        failedCount++
      }
    }

    logger.info(
      { deletedCount, failedCount, total: args.tokenAddresses.length },
      '[Admin] Batch delete completed'
    )

    return {
      success: deletedCount > 0,
      deletedCount,
      failedCount,
      results,
    }
  },

  // Sync a token from blockchain to database
  // No auth required - data comes from blockchain and is validated
  // Rate limited to prevent DoS attacks on RPC
  syncToken: async (_parent: any, args: { tokenAddress: string }, context: GraphQLContext) => {
    const { tokenAddress } = args

    // Get client IP for rate limiting
    const clientIP = context.request?.headers?.['x-forwarded-for'] as string || 'unknown'

    // Rate limit syncToken operations (expensive RPC calls)
    const rateLimitResult = await syncTokenRateLimiter.check(clientIP)
    if (!rateLimitResult.allowed) {
      logger.warn({ clientIP, tokenAddress }, '[SyncToken] Rate limit exceeded')
      throw new GraphQLError(`Rate limit exceeded. Try again in ${rateLimitResult.retryAfter} seconds.`, {
        extensions: {
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter: rateLimitResult.retryAfter,
        },
      })
    }

    // Input validation: Stellar contract addresses are 56 chars starting with 'C'
    if (!tokenAddress || tokenAddress.length !== 56 || !tokenAddress.startsWith('C')) {
      throw new GraphQLError('Invalid token address format. Must be a valid Stellar contract address (C...)', {
        extensions: { code: 'INVALID_INPUT' },
      })
    }

    try {
      logger.info({ tokenAddress, clientIP, user: context.user?.address }, '[GraphQL] syncToken called')

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
      logger.error({ error, tokenAddress }, '[GraphQL] Failed to sync token')
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
    // Without a TokenSnapshot table, we can't calculate historical changes
    // For now, return 0. To implement: add TokenSnapshot model with daily snapshots
    holdersChange24h: (parent: any) => {
      // Would need: SELECT holders FROM TokenSnapshot WHERE tokenAddress = parent.address AND date = now - 24h
      return 0;
    },
    website: (parent: any) => parent.website || null,
    twitter: (parent: any) => parent.twitter || null,
    telegram: (parent: any) => parent.telegram || null,
    discord: (parent: any) => parent.discord || null,
    // Default values for potentially null fields
    circulatingSupply: (parent: any) => parent.circulatingSupply || parent.totalSupply || '0',
    totalSupply: (parent: any) => parent.totalSupply || '1000000000000000',
    currentPrice: (parent: any) => parent.currentPrice || '0',
    priceChange24h: (parent: any) => parent.priceChange24h ?? 0,
    volume24h: (parent: any) => parent.volume24h || '0',
    marketCap: (parent: any) => parent.marketCap || '0',
    holders: (parent: any) => parent.holders || 0,
    xlmReserve: (parent: any) => parent.xlmReserve || '0',
    xlmRaised: (parent: any) => parent.xlmRaised || parent.xlmReserve || '0',

    // Graduation fields (only for graduated tokens)
    ammPairAddress: async (parent: any, _args: any, context: GraphQLContext) => {
      if (!parent.graduated) return null
      // Use DataLoader to batch graduation event lookups
      return context.loaders.graduationEventLoader.load(parent.address)
    },

    graduationEvent: async (parent: any, _args: any, context: GraphQLContext) => {
      if (!parent.graduated) return null
      // Fetch full graduation event details
      const event = await context.prisma.graduationEvent.findFirst({
        where: {
          tokenAddress: parent.address,
          type: { in: ['GRADUATED', 'GRADUATION_DETAILED', 'GRADUATION_WITH_ASTRO'] },
        },
        orderBy: { timestamp: 'desc' },
      })
      return event
    },

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
    // Without a PoolSnapshot table, we can't calculate historical volume changes
    // For now, return 0. To implement: add PoolSnapshot model with daily volume snapshots
    volumeChange24h: (parent: any) => {
      // Would need: SELECT volume FROM PoolSnapshot WHERE poolAddress = parent.address AND date = now - 24h
      // Then calculate: ((current - previous) / previous) * 100
      return 0;
    },
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
