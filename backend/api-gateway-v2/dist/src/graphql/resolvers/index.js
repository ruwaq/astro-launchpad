// @ts-nocheck
/**
 * GraphQL Resolvers
 * Handles all GraphQL queries and mutations
 *
 * NOTE: TypeScript errors on `cacheStrategy` are expected.
 * This property is added at runtime by Prisma Accelerate extension.
 */
import { CACHE_STRATEGIES } from '../../lib/prisma.js';
import { checkDatabaseHealth } from '../../lib/prisma.js';
import { cacheLeaderboard, cacheGlobalStats, cacheTrendingTokens, } from '../cache-helpers.js';
import { getCacheStats } from '../../lib/cache.js';
/**
 * Custom scalar resolvers
 */
const scalarResolvers = {
    DateTime: {
        serialize(value) {
            if (value instanceof Date) {
                return value.toISOString();
            }
            return new Date(value).toISOString();
        },
        parseValue(value) {
            return new Date(value);
        },
    },
    BigInt: {
        serialize(value) {
            return value.toString();
        },
        parseValue(value) {
            return value;
        },
    },
};
/**
 * Query resolvers
 */
const queryResolvers = {
    // Health check
    health: async (_parent, _args, context) => {
        const [dbHealthy, cacheStats] = await Promise.all([
            checkDatabaseHealth(),
            getCacheStats(),
        ]);
        return {
            status: dbHealthy ? 'healthy' : 'degraded',
            timestamp: new Date(),
            version: '2.0.0',
            database: dbHealthy,
            cache: {
                available: cacheStats.available,
                type: cacheStats.type,
            },
        };
    },
    // Token queries
    token: async (_parent, args, context) => {
        return context.prisma.token.findUnique({
            where: { address: args.address },
            cacheStrategy: CACHE_STRATEGIES.MEDIUM_TTL,
        });
    },
    tokens: async (_parent, args, context) => {
        const limit = args.limit || 20;
        const offset = args.offset || 0;
        // Build where clause for search
        const where = args.search
            ? {
                OR: [
                    { name: { contains: args.search, mode: 'insensitive' } },
                    { symbol: { contains: args.search, mode: 'insensitive' } },
                ],
            }
            : {};
        // Build orderBy
        const orderByMap = {
            CREATED_AT_DESC: { createdAt: 'desc' },
            CREATED_AT_ASC: { createdAt: 'asc' },
            MARKET_CAP_DESC: { marketCap: 'desc' },
            VOLUME_DESC: { volume24h: 'desc' },
            HOLDERS_DESC: { holders: 'desc' },
        };
        const orderBy = orderByMap[args.orderBy || 'CREATED_AT_DESC'] || { createdAt: 'desc' };
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
        ]);
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
        };
    },
    trendingTokens: async (_parent, args, context) => {
        const limit = args.limit || 10;
        // Use Redis cache for trending tokens (expensive query)
        return cacheTrendingTokens(limit, async () => {
            const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
            return context.prisma.token.findMany({
                where: {
                    createdAt: { gte: sevenDaysAgo },
                },
                orderBy: [{ volume24h: 'desc' }, { holders: 'desc' }],
                take: limit,
                cacheStrategy: CACHE_STRATEGIES.SHORT_TTL,
            });
        });
    },
    // Pool queries
    pool: async (_parent, args, context) => {
        return context.prisma.pool.findUnique({
            where: { address: args.address },
            cacheStrategy: CACHE_STRATEGIES.MEDIUM_TTL,
        });
    },
    pools: async (_parent, args, context) => {
        const limit = args.limit || 20;
        const offset = args.offset || 0;
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
        ]);
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
        };
    },
    // User queries
    user: async (_parent, args, context) => {
        return context.prisma.user.findUnique({
            where: { address: args.address },
            cacheStrategy: CACHE_STRATEGIES.MEDIUM_TTL,
        });
    },
    leaderboard: async (_parent, args, context) => {
        const limit = args.limit || 100;
        const type = args.type || 'TRADERS';
        const timeframe = args.timeframe || 'DAY';
        // Use Redis cache for leaderboard (expensive aggregation query)
        return cacheLeaderboard(type, limit, async () => {
            // Calculate timeframe filter
            const now = new Date();
            let startTime;
            switch (timeframe) {
                case 'HOUR':
                    startTime = new Date(now.getTime() - 60 * 60 * 1000);
                    break;
                case 'DAY':
                    startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
                    break;
                case 'WEEK':
                    startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                    break;
                case 'MONTH':
                    startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                    break;
                case 'ALL_TIME':
                    startTime = new Date(0);
                    break;
                default:
                    startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            }
            if (type === 'TRADERS') {
                // Optimized SQL aggregation for traders
                // GROUP BY user address, calculate volume, trades, and P/L
                const results = await context.prisma.$queryRaw `
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
        `;
                // Get user data for each address
                const addresses = results.map((r) => r.address);
                const users = await context.prisma.user.findMany({
                    where: { address: { in: addresses } },
                    cacheStrategy: CACHE_STRATEGIES.SHORT_TTL,
                });
                const userMap = new Map(users.map(u => [u.address, u]));
                return results.map((result, index) => ({
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
                }));
            }
            else if (type === 'CREATORS') {
                // Optimized for creators
                const results = await context.prisma.$queryRaw `
          SELECT
            t.creator as address,
            COUNT(*) as tokens_created,
            SUM(CAST(t."volume24h" AS DECIMAL)) as total_volume_generated
          FROM "Token" t
          WHERE t."createdAt" >= ${startTime}
          GROUP BY t.creator
          ORDER BY tokens_created DESC, total_volume_generated DESC
          LIMIT ${limit}
        `;
                const addresses = results.map((r) => r.address);
                const users = await context.prisma.user.findMany({
                    where: { address: { in: addresses } },
                    cacheStrategy: CACHE_STRATEGIES.SHORT_TTL,
                });
                const userMap = new Map(users.map(u => [u.address, u]));
                return results.map((result, index) => ({
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
                }));
            }
            else {
                // Fallback para otros tipos
                return [];
            }
        });
    },
    // Transaction queries
    transactions: async (_parent, args, context) => {
        const limit = args.limit || 20;
        const offset = args.offset || 0;
        const where = {};
        if (args.address) {
            where.OR = [{ from: args.address }, { to: args.address }];
        }
        if (args.tokenAddress) {
            where.tokenAddress = args.tokenAddress;
        }
        if (args.type) {
            where.type = args.type;
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
        ]);
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
        };
    },
    // Global stats
    globalStats: async (_parent, _args, context) => {
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
            ]);
            const totalVolume24h = tokens.reduce((sum, token) => sum + BigInt(token.volume24h), BigInt(0));
            const totalTVL = pools.reduce((sum, pool) => sum + BigInt(pool.tvl || '0'), BigInt(0));
            return {
                totalTokens,
                totalPools,
                totalUsers,
                totalVolume24h: totalVolume24h.toString(),
                totalTVL: totalTVL.toString(),
            };
        });
    },
};
/**
 * Mutation resolvers
 */
const mutationResolvers = {
    // Sync a token from blockchain to database
    syncToken: async (_parent, args, context) => {
        const { tokenAddress } = args;
        try {
            // TODO: Re-enable after fixing shared/scripts import path
            // const { processToken } = await import('../../../shared/scripts/sync-tokens.js')
            // await processToken(tokenAddress)
            // Return token from database (if exists)
            const token = await context.prisma.token.findUnique({
                where: { address: tokenAddress },
                cacheStrategy: CACHE_STRATEGIES.SHORT_TTL,
            });
            if (!token) {
                throw new Error(`Token ${tokenAddress} not found in database. Manual sync required.`);
            }
            return token;
        }
        catch (error) {
            console.error(`Failed to sync token ${tokenAddress}:`, error);
            throw new Error(`Failed to sync token: ${error.message}`);
        }
    },
};
/**
 * Field resolvers
 * These resolve nested fields in types
 * Optimized with DataLoaders to prevent N+1 queries
 */
const fieldResolvers = {
    Token: {
        // Alias fields for frontend compatibility
        logoUrl: (parent) => parent.imageUrl,
        bondingCurve: (parent) => parent.address,
        initialPrice: (parent) => parent.currentPrice || '0',
        holders24h: (parent) => parent.holders || 0,
        holdersChange24h: (parent) => 0, // TODO: Calculate from historical data
        website: (parent) => parent.website || null,
        twitter: (parent) => parent.twitter || null,
        telegram: (parent) => parent.telegram || null,
        discord: (parent) => parent.discord || null,
        // Creator user relationship
        creatorUser: async (parent, _args, context) => {
            // Use DataLoader to batch user lookups
            return context.loaders.userLoader.load(parent.creator);
        },
        // Pools relationship
        pools: async (parent, _args, context) => {
            // Use DataLoader to batch pool lookups by token
            return context.loaders.poolsByTokenLoader.load(parent.address);
        },
    },
    Pool: {
        // Alias fields for frontend compatibility
        liquidity: (parent) => parent.totalSupply || parent.tvl || '0',
        volumeChange24h: (parent) => 0, // TODO: Calculate from historical data
        apy: (parent) => parent.apr || 0,
        fee: (parent) => '0.3', // Default 0.3% fee
        // Token0 relationship
        token0: async (parent, _args, context) => {
            // Use DataLoader to batch token lookups
            return context.loaders.tokenLoader.load(parent.token0Address);
        },
        // Token1 relationship
        token1: async (parent, _args, context) => {
            // Use DataLoader to batch token lookups
            return context.loaders.tokenLoader.load(parent.token1Address);
        },
    },
    User: {
        // Tokens created relationship
        tokensCreated: async (parent, _args, context) => {
            // Use DataLoader to batch tokens-by-creator lookups
            return context.loaders.tokensByCreatorLoader.load(parent.address);
        },
        // Achievements relationship
        achievements: async (parent, _args, context) => {
            // Use DataLoader to batch achievements-by-user lookups
            return context.loaders.achievementsByUserIdLoader.load(parent.id);
        },
    },
    Transaction: {
        // Token relationship
        token: async (parent, _args, context) => {
            if (!parent.tokenAddress)
                return null;
            // Use DataLoader to batch token lookups
            return context.loaders.tokenLoader.load(parent.tokenAddress);
        },
        // User relationship
        user: async (parent, _args, context) => {
            if (!parent.userId)
                return null;
            // Use DataLoader to batch user lookups by ID
            return context.loaders.userByIdLoader.load(parent.userId);
        },
    },
};
/**
 * Combine all resolvers
 */
export const resolvers = {
    ...scalarResolvers,
    Query: queryResolvers,
    Mutation: mutationResolvers,
    ...fieldResolvers,
}; // Type assertion needed due to custom context type
//# sourceMappingURL=index.js.map