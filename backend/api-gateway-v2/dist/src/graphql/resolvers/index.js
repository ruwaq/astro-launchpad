/**
 * GraphQL Resolvers
 * Handles all GraphQL queries and mutations
 */
import { GraphQLError } from 'graphql';
import { validateStellarAddress, validateLimit, validateOffset, validateSearchString, validateOrderBy, validateTimeframe, validateLeaderboardType, validateTransactionType, } from '../../lib/validators.js';
import { checkDatabaseHealth } from '../../lib/prisma.js';
import { cacheLeaderboard, cacheGlobalStats, cacheTrendingTokens, } from '../cache-helpers.js';
import { getCacheStats } from '../../lib/cache.js';
import { feeResolvers, feeTypeResolvers } from './fee-resolvers.js';
import { syncTokenToDatabase } from '../../lib/sync-service.js';
import { logger } from '../../lib/logger.js';
import { syncTokenRateLimiter, adminRateLimiter, trackFailedAdminAuth, } from '../../lib/rate-limiter.js';
import crypto from 'crypto';
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
    // Health check - real implementation
    health: async (_parent, _args, context) => {
        const [dbHealth, cacheStats] = await Promise.all([
            checkDatabaseHealth().catch(() => false),
            getCacheStats().catch(() => ({ available: false, type: 'none' })),
        ]);
        const isHealthy = dbHealth && cacheStats.available;
        return {
            status: isHealthy ? 'healthy' : 'degraded',
            timestamp: new Date(),
            version: '2.0.0',
            database: dbHealth,
            cache: cacheStats,
        };
    },
    // Token queries
    token: async (_parent, args, context) => {
        // Validate token address
        const address = validateStellarAddress(args.address, 'token address');
        // PERFORMANCE: Select only fields needed by frontend
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
                graduated: true,
                creator: true,
                website: true,
                twitter: true,
                telegram: true,
                discord: true,
                createdAt: true,
                updatedAt: true,
            },
        });
    },
    tokens: async (_parent, args, context) => {
        try {
            // Validate and sanitize inputs
            const limit = validateLimit(args.limit, 100, 20);
            const offset = validateOffset(args.offset);
            const search = validateSearchString(args.search, 100);
            const orderByKey = validateOrderBy(args.orderBy, ['CREATED_AT_DESC', 'CREATED_AT_ASC', 'MARKET_CAP_DESC', 'VOLUME_DESC', 'HOLDERS_DESC'], 'CREATED_AT_DESC');
            // Build where clause for search
            const where = search
                ? {
                    OR: [
                        { name: { contains: search, mode: 'insensitive' } },
                        { symbol: { contains: search, mode: 'insensitive' } },
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
            const orderBy = orderByMap[orderByKey];
            // PERFORMANCE: Select only fields needed for token list
            const tokenSelect = {
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
            };
            // Execute queries in parallel
            const [edges, total] = await Promise.all([
                context.prisma.token.findMany({
                    where,
                    take: limit,
                    skip: offset,
                    orderBy,
                    select: tokenSelect,
                }),
                context.prisma.token.count({
                    where,
                }),
            ]);
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
            };
        }
        catch (error) {
            logger.error({ error }, '[Tokens] Query error');
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
            };
        }
    },
    trendingTokens: async (_parent, args, context) => {
        try {
            const limit = args.limit || 10;
            // Use Redis cache for trending tokens (expensive query)
            const result = await cacheTrendingTokens(limit, async () => {
                const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
                // PERFORMANCE: Select only fields needed for trending list
                const tokens = await context.prisma.token.findMany({
                    where: {
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
                });
                return tokens || [];
            });
            return result || [];
        }
        catch (error) {
            logger.error({ error }, '[TrendingTokens] Query error');
            return [];
        }
    },
    // Pool queries
    pool: async (_parent, args, context) => {
        try {
            // Validate pool address (contract addresses start with C)
            const address = validateStellarAddress(args.address, 'pool address');
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
            });
        }
        catch (error) {
            logger.error({ error, args }, 'Pool query failed');
            throw new GraphQLError(`Failed to fetch pool: ${error.message}`, {
                extensions: { code: 'POOL_QUERY_ERROR' },
            });
        }
    },
    pools: async (_parent, args, context) => {
        try {
            const limit = args.limit || 20;
            const offset = args.offset || 0;
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
        }
        catch (error) {
            logger.error({ error }, '[Pools] Query error');
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
            };
        }
    },
    // User queries
    user: async (_parent, args, context) => {
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
        });
    },
    leaderboard: async (_parent, args, context) => {
        // Validate and sanitize inputs
        const limit = validateLimit(args.limit, 100, 100);
        const type = validateLeaderboardType(args.type, 'TRADERS');
        const timeframe = validateTimeframe(args.timeframe, 'DAY');
        try {
            // Use Redis cache for leaderboard (expensive aggregation query)
            const result = await cacheLeaderboard(type, limit, async () => {
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
                    try {
                        // Optimized SQL aggregation for traders
                        const results = await context.prisma.$queryRaw `
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
            `;
                        if (!results || results.length === 0) {
                            return [];
                        }
                        // Get user data for each address
                        const addresses = results.map((r) => r.address).filter(Boolean);
                        const users = addresses.length > 0 ? await context.prisma.user.findMany({
                            where: { address: { in: addresses } },
                        }) : [];
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
                                updatedAt: now,
                            },
                            volume24h: (result.total_volume || 0).toString(),
                            trades24h: Number(result.trades_count) || 0,
                            profitLoss24h: (result.profit_loss || 0).toString(),
                            volumeChange24h: 0,
                            rankChange24h: 0,
                        }));
                    }
                    catch (err) {
                        logger.error({ error: err }, '[Leaderboard] TRADERS query error');
                        return [];
                    }
                }
                else if (type === 'CREATORS') {
                    try {
                        // Optimized for creators
                        const results = await context.prisma.$queryRaw `
              SELECT
                t.creator as address,
                COUNT(*) as tokens_created,
                COALESCE(SUM(CAST(NULLIF(t."volume24h", '') AS DECIMAL)), 0) as total_volume_generated
              FROM "Token" t
              WHERE t."createdAt" >= ${startTime}
              GROUP BY t.creator
              ORDER BY tokens_created DESC, total_volume_generated DESC
              LIMIT ${limit}
            `;
                        if (!results || results.length === 0) {
                            return [];
                        }
                        const addresses = results.map((r) => r.address).filter(Boolean);
                        const users = addresses.length > 0 ? await context.prisma.user.findMany({
                            where: { address: { in: addresses } },
                        }) : [];
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
                            volumeChange24h: 0,
                            rankChange24h: 0,
                        }));
                    }
                    catch (err) {
                        logger.error({ error: err }, '[Leaderboard] CREATORS query error');
                        return [];
                    }
                }
                else if (type === 'LIQUIDITY_PROVIDERS') {
                    try {
                        // Aggregate liquidity events by provider
                        const results = await context.prisma.$queryRaw `
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
            `;
                        if (!results || results.length === 0) {
                            return [];
                        }
                        const addresses = results.map((r) => r.address).filter(Boolean);
                        const users = addresses.length > 0 ? await context.prisma.user.findMany({
                            where: { address: { in: addresses } },
                        }) : [];
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
                                totalLiquidityProvided: (result.net_liquidity || 0).toString(),
                                createdAt: now,
                                updatedAt: now,
                            },
                            volume24h: '0',
                            trades24h: 0,
                            profitLoss24h: '0',
                            totalLiquidity: (result.net_liquidity || 0).toString(),
                            feesEarned24h: '0', // TODO: Calculate from pool fees
                            volumeChange24h: 0,
                            rankChange24h: 0,
                        }));
                    }
                    catch (err) {
                        logger.error({ error: err }, '[Leaderboard] LIQUIDITY_PROVIDERS query error');
                        return [];
                    }
                }
                else {
                    // Fallback for VIRAL_TOKENS (not yet implemented)
                    return [];
                }
            });
            // Ensure we always return an array
            return result || [];
        }
        catch (error) {
            logger.error({ error }, '[Leaderboard] Error');
            // Return empty array on error to satisfy non-null schema requirement
            return [];
        }
    },
    // Transaction queries
    transactions: async (_parent, args, context) => {
        // SECURITY: Validate all inputs to prevent injection and DoS
        const limit = validateLimit(args.limit, 100, 20);
        const offset = validateOffset(args.offset);
        const where = {};
        // Validate Stellar addresses if provided
        if (args.address) {
            const validatedAddress = validateStellarAddress(args.address, 'address');
            where.OR = [{ from: validatedAddress }, { to: validatedAddress }];
        }
        if (args.tokenAddress) {
            const validatedTokenAddress = validateStellarAddress(args.tokenAddress, 'tokenAddress');
            where.tokenAddress = validatedTokenAddress;
        }
        // Validate transaction type against allowed enum values
        if (args.type) {
            const validatedType = validateTransactionType(args.type);
            where.type = validatedType;
        }
        // PERFORMANCE: Select only fields needed for transaction list
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
                    status: true,
                    timestamp: true,
                    tokenAddress: true,
                    userId: true,
                },
            }),
            context.prisma.transaction.count({
                where,
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
    // Global stats - Optimized with SQL aggregation to avoid loading all records
    globalStats: async (_parent, _args, context) => {
        // Use Redis cache for global stats (expensive aggregation)
        return cacheGlobalStats(async () => {
            // Use SQL aggregation instead of loading all records into memory
            const [totalTokens, totalPools, totalUsers, volumeResult, tvlResult] = await Promise.all([
                context.prisma.token.count(),
                context.prisma.pool.count(),
                context.prisma.user.count(),
                // Aggregate volume24h using raw SQL for performance
                context.prisma.$queryRaw `
          SELECT COALESCE(SUM(CAST(NULLIF("volume24h", '') AS DECIMAL)), 0)::text as total
          FROM "Token"
        `,
                // Aggregate TVL using raw SQL for performance
                context.prisma.$queryRaw `
          SELECT COALESCE(SUM(CAST(NULLIF("tvl", '') AS DECIMAL)), 0)::text as total
          FROM "Pool"
        `,
            ]);
            const totalVolume24h = volumeResult[0]?.total || '0';
            const totalTVL = tvlResult[0]?.total || '0';
            return {
                totalTokens,
                totalPools,
                totalUsers,
                totalVolume24h,
                totalTVL,
            };
        });
    },
};
// Admin key for delete operations (MUST be set in env vars in production)
const ADMIN_KEY = process.env.ADMIN_API_KEY;
if (!ADMIN_KEY && process.env.NODE_ENV === 'production') {
    throw new Error('ADMIN_API_KEY environment variable is required in production');
}
/**
 * Secure comparison to prevent timing attacks
 */
function secureCompare(a, b) {
    if (!a || !b)
        return false;
    try {
        return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
    }
    catch {
        return false;
    }
}
/**
 * Mutation resolvers
 */
const mutationResolvers = {
    // Delete a single token from database (admin only)
    deleteToken: async (_parent, args, context) => {
        // Get client IP for rate limiting
        const clientIP = context.request?.headers?.['x-forwarded-for'] || 'unknown';
        // Rate limit admin operations
        const rateLimitResult = await adminRateLimiter.check(clientIP);
        if (!rateLimitResult.allowed) {
            logger.warn({ clientIP, tokenAddress: args.tokenAddress }, '[Admin] Rate limit exceeded for delete');
            return {
                success: false,
                address: args.tokenAddress,
                message: `Rate limit exceeded. Try again in ${rateLimitResult.retryAfter} seconds.`,
            };
        }
        // Validate admin key with timing-safe comparison
        if (!ADMIN_KEY || !secureCompare(args.adminKey, ADMIN_KEY)) {
            // Track failed auth attempts
            const authResult = await trackFailedAdminAuth(clientIP);
            if (authResult.blocked) {
                logger.error({ clientIP }, '[Admin] Blocked due to too many failed auth attempts');
                return {
                    success: false,
                    address: args.tokenAddress,
                    message: 'Too many failed attempts. Please try again later.',
                };
            }
            logger.warn({ tokenAddress: args.tokenAddress, clientIP, attemptsRemaining: authResult.attemptsRemaining }, '[Admin] Unauthorized delete attempt');
            return {
                success: false,
                address: args.tokenAddress,
                message: 'Unauthorized: Invalid admin key',
            };
        }
        const tokenAddress = validateStellarAddress(args.tokenAddress, 'token address');
        try {
            // Check if token exists
            const existingToken = await context.prisma.token.findUnique({
                where: { address: tokenAddress },
                select: { id: true, name: true, symbol: true },
            });
            if (!existingToken) {
                return {
                    success: false,
                    address: tokenAddress,
                    message: 'Token not found in database',
                };
            }
            // Delete related transactions first
            await context.prisma.transaction.deleteMany({
                where: { tokenAddress },
            });
            // Delete the token
            await context.prisma.token.delete({
                where: { address: tokenAddress },
            });
            logger.info({ tokenAddress, name: existingToken.name, symbol: existingToken.symbol }, '[Admin] Token deleted successfully');
            return {
                success: true,
                address: tokenAddress,
                message: `Token ${existingToken.symbol} (${existingToken.name}) deleted successfully`,
            };
        }
        catch (error) {
            logger.error({ error, tokenAddress }, '[Admin] Failed to delete token');
            return {
                success: false,
                address: tokenAddress,
                message: `Failed to delete token: ${error.message}`,
            };
        }
    },
    // Delete multiple tokens from database (admin only)
    deleteTokensBatch: async (_parent, args, context) => {
        // Get client IP for rate limiting
        const clientIP = context.request?.headers?.['x-forwarded-for'] || 'unknown';
        // Rate limit admin operations
        const rateLimitResult = await adminRateLimiter.check(clientIP);
        if (!rateLimitResult.allowed) {
            logger.warn({ clientIP, count: args.tokenAddresses.length }, '[Admin] Rate limit exceeded for batch delete');
            return {
                success: false,
                deletedCount: 0,
                failedCount: args.tokenAddresses.length,
                results: args.tokenAddresses.map((address) => ({
                    success: false,
                    address,
                    message: `Rate limit exceeded. Try again in ${rateLimitResult.retryAfter} seconds.`,
                })),
            };
        }
        // Validate admin key with timing-safe comparison
        if (!ADMIN_KEY || !secureCompare(args.adminKey, ADMIN_KEY)) {
            // Track failed auth attempts
            const authResult = await trackFailedAdminAuth(clientIP);
            if (authResult.blocked) {
                logger.error({ clientIP }, '[Admin] Blocked due to too many failed auth attempts');
                return {
                    success: false,
                    deletedCount: 0,
                    failedCount: args.tokenAddresses.length,
                    results: args.tokenAddresses.map((address) => ({
                        success: false,
                        address,
                        message: 'Too many failed attempts. Please try again later.',
                    })),
                };
            }
            logger.warn({ count: args.tokenAddresses.length, clientIP, attemptsRemaining: authResult.attemptsRemaining }, '[Admin] Unauthorized batch delete attempt');
            return {
                success: false,
                deletedCount: 0,
                failedCount: args.tokenAddresses.length,
                results: args.tokenAddresses.map((address) => ({
                    success: false,
                    address,
                    message: 'Unauthorized: Invalid admin key',
                })),
            };
        }
        const results = [];
        let deletedCount = 0;
        let failedCount = 0;
        for (const tokenAddress of args.tokenAddresses) {
            try {
                const validatedAddress = validateStellarAddress(tokenAddress, 'token address');
                // Check if token exists
                const existingToken = await context.prisma.token.findUnique({
                    where: { address: validatedAddress },
                    select: { id: true, name: true, symbol: true },
                });
                if (!existingToken) {
                    results.push({
                        success: false,
                        address: validatedAddress,
                        message: 'Token not found in database',
                    });
                    failedCount++;
                    continue;
                }
                // Delete related transactions first
                await context.prisma.transaction.deleteMany({
                    where: { tokenAddress: validatedAddress },
                });
                // Delete the token
                await context.prisma.token.delete({
                    where: { address: validatedAddress },
                });
                results.push({
                    success: true,
                    address: validatedAddress,
                    message: `Token ${existingToken.symbol} deleted`,
                });
                deletedCount++;
            }
            catch (error) {
                results.push({
                    success: false,
                    address: tokenAddress,
                    message: error.message,
                });
                failedCount++;
            }
        }
        logger.info({ deletedCount, failedCount, total: args.tokenAddresses.length }, '[Admin] Batch delete completed');
        return {
            success: deletedCount > 0,
            deletedCount,
            failedCount,
            results,
        };
    },
    // Sync a token from blockchain to database
    // No auth required - data comes from blockchain and is validated
    // Rate limited to prevent DoS attacks on RPC
    syncToken: async (_parent, args, context) => {
        const { tokenAddress } = args;
        // Get client IP for rate limiting
        const clientIP = context.request?.headers?.['x-forwarded-for'] || 'unknown';
        // Rate limit syncToken operations (expensive RPC calls)
        const rateLimitResult = await syncTokenRateLimiter.check(clientIP);
        if (!rateLimitResult.allowed) {
            logger.warn({ clientIP, tokenAddress }, '[SyncToken] Rate limit exceeded');
            throw new GraphQLError(`Rate limit exceeded. Try again in ${rateLimitResult.retryAfter} seconds.`, {
                extensions: {
                    code: 'RATE_LIMIT_EXCEEDED',
                    retryAfter: rateLimitResult.retryAfter,
                },
            });
        }
        // Input validation: Stellar contract addresses are 56 chars starting with 'C'
        if (!tokenAddress || tokenAddress.length !== 56 || !tokenAddress.startsWith('C')) {
            throw new GraphQLError('Invalid token address format. Must be a valid Stellar contract address (C...)', {
                extensions: { code: 'INVALID_INPUT' },
            });
        }
        try {
            logger.info({ tokenAddress, clientIP, user: context.user?.address }, '[GraphQL] syncToken called');
            // Use the sync service to fetch from blockchain and store in DB
            const result = await syncTokenToDatabase(tokenAddress, context.prisma);
            if (!result.success) {
                // Even if sync failed, try to return existing token from DB
                const existingToken = await context.prisma.token.findUnique({
                    where: { address: tokenAddress },
                });
                if (existingToken) {
                    console.log(`[GraphQL] Returning existing token from DB`);
                    return existingToken;
                }
                throw new Error(result.message);
            }
            // Return the synced token
            if (result.token) {
                return result.token;
            }
            // Fallback: fetch from DB
            const token = await context.prisma.token.findUnique({
                where: { address: tokenAddress },
            });
            if (!token) {
                throw new Error(`Token ${tokenAddress} not found after sync`);
            }
            return token;
        }
        catch (error) {
            logger.error({ error, tokenAddress }, '[GraphQL] Failed to sync token');
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
        // Default values for potentially null fields
        circulatingSupply: (parent) => parent.circulatingSupply || parent.totalSupply || '0',
        totalSupply: (parent) => parent.totalSupply || '1000000000000000',
        currentPrice: (parent) => parent.currentPrice || '0',
        priceChange24h: (parent) => parent.priceChange24h ?? 0,
        volume24h: (parent) => parent.volume24h || '0',
        marketCap: (parent) => parent.marketCap || '0',
        holders: (parent) => parent.holders || 0,
        xlmReserve: (parent) => parent.xlmReserve || '0',
        xlmRaised: (parent) => parent.xlmRaised || parent.xlmReserve || '0',
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
 * IMPORTANT: Order matters - fieldResolvers and feeTypeResolvers contain
 * type-specific resolvers (Token, Pool, User, FeeCollection, etc.)
 * Query and Mutation must be explicitly combined, not spread from feeResolvers
 */
export const resolvers = {
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
}; // Type assertion needed due to custom context type
//# sourceMappingURL=index.js.map