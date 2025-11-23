/**
 * GraphQL-specific Cache Helpers
 * Optimized caching strategies for different query types
 */
import { cacheSet, cacheGetOrSet, cacheDel, buildCacheKey, CACHE_TTL, } from '../lib/cache.js';
/**
 * Cache namespaces for different data types
 */
export const CACHE_NAMESPACES = {
    TOKEN: 'token',
    POOL: 'pool',
    USER: 'user',
    LEADERBOARD: 'leaderboard',
    GLOBAL_STATS: 'stats',
    TRENDING: 'trending',
    TRANSACTIONS: 'transactions',
};
/**
 * Build cache key for GraphQL queries
 */
function buildQueryCacheKey(namespace, args) {
    // Create deterministic key from args
    const argsKey = Object.keys(args)
        .sort()
        .map((key) => `${key}:${JSON.stringify(args[key])}`)
        .join('|');
    return buildCacheKey(namespace, argsKey || 'default');
}
/**
 * Cache wrapper for leaderboard queries
 * Leaderboards change infrequently and are expensive to compute
 * TTL: 1 minute (60s) for near real-time rankings
 */
export async function cacheLeaderboard(type, limit, fetchFn) {
    const key = buildCacheKey(CACHE_NAMESPACES.LEADERBOARD, `${type}:${limit}`);
    // Use SHORT TTL (1 minute) for leaderboard to balance freshness and performance
    return cacheGetOrSet(key, fetchFn, CACHE_TTL.SHORT);
}
/**
 * Cache wrapper for global stats
 * Stats are aggregations that don't need to be real-time
 */
export async function cacheGlobalStats(fetchFn) {
    const key = buildCacheKey(CACHE_NAMESPACES.GLOBAL_STATS, 'all');
    return cacheGetOrSet(key, fetchFn, CACHE_TTL.SHORT);
}
/**
 * Cache wrapper for trending tokens
 * Trending calculations are complex and change slowly
 */
export async function cacheTrendingTokens(limit, fetchFn) {
    const key = buildCacheKey(CACHE_NAMESPACES.TRENDING, `limit:${limit}`);
    return cacheGetOrSet(key, fetchFn, CACHE_TTL.SHORT);
}
/**
 * Cache wrapper for transaction lists
 * Transactions are immutable once created
 */
export async function cacheTransactions(args, fetchFn) {
    const key = buildQueryCacheKey(CACHE_NAMESPACES.TRANSACTIONS, args);
    return cacheGetOrSet(key, fetchFn, CACHE_TTL.SHORT);
}
/**
 * Invalidate cache for a specific entity
 * Call this when entity is updated
 */
export async function invalidateEntityCache(namespace, identifier) {
    const key = buildCacheKey(namespace, identifier);
    await cacheDel(key);
}
/**
 * Invalidate all caches for a namespace
 * Use sparingly - requires pattern matching
 */
export async function invalidateNamespaceCache(namespace) {
    const pattern = buildCacheKey(namespace, '*');
    // Note: Pattern deletion doesn't work with Vercel KV
    // Alternative: Track keys in a set and delete individually
    await cacheDel(pattern);
}
/**
 * Cache invalidation helpers for specific events
 */
export const cacheInvalidators = {
    /**
     * Invalidate caches when a new token is created
     */
    onTokenCreated: async () => {
        await Promise.all([
            invalidateNamespaceCache(CACHE_NAMESPACES.GLOBAL_STATS),
            invalidateNamespaceCache(CACHE_NAMESPACES.TRENDING),
            // Don't invalidate individual tokens - they're not cached yet
        ]);
    },
    /**
     * Invalidate caches when token data changes (price, volume, etc.)
     */
    onTokenUpdated: async (tokenAddress) => {
        await Promise.all([
            invalidateEntityCache(CACHE_NAMESPACES.TOKEN, tokenAddress),
            invalidateNamespaceCache(CACHE_NAMESPACES.GLOBAL_STATS),
            invalidateNamespaceCache(CACHE_NAMESPACES.TRENDING),
        ]);
    },
    /**
     * Invalidate caches when user data changes
     */
    onUserUpdated: async (userAddress) => {
        await Promise.all([
            invalidateEntityCache(CACHE_NAMESPACES.USER, userAddress),
            invalidateNamespaceCache(CACHE_NAMESPACES.LEADERBOARD),
        ]);
    },
    /**
     * Invalidate caches when pool is created/updated
     */
    onPoolUpdated: async (poolAddress) => {
        await Promise.all([
            invalidateEntityCache(CACHE_NAMESPACES.POOL, poolAddress),
            invalidateNamespaceCache(CACHE_NAMESPACES.GLOBAL_STATS),
        ]);
    },
    /**
     * Invalidate caches when transaction occurs
     */
    onTransaction: async () => {
        await Promise.all([
            invalidateNamespaceCache(CACHE_NAMESPACES.GLOBAL_STATS),
            invalidateNamespaceCache(CACHE_NAMESPACES.TRENDING),
            // Transactions are append-only, so we don't invalidate transaction caches
        ]);
    },
};
/**
 * Rate limiting using cache
 * More efficient than in-memory rate limiting in serverless
 */
export async function checkRateLimit(identifier, maxRequests, windowSeconds) {
    const { cacheIncr, cacheTTL } = await import('../lib/cache.js');
    const key = buildCacheKey('ratelimit', identifier);
    const count = await cacheIncr(key, windowSeconds);
    const ttl = await cacheTTL(key);
    const resetAt = Date.now() + ttl * 1000;
    return {
        allowed: count <= maxRequests,
        remaining: Math.max(0, maxRequests - count),
        resetAt,
    };
}
/**
 * Cache warming for frequently accessed data
 * Call this on server startup or periodically
 */
export async function warmFrequentCaches(context) {
    const { logger } = await import('../lib/logger.js');
    try {
        logger.info('Warming frequently accessed caches');
        // Warm global stats
        await cacheGlobalStats(async () => {
            const [totalTokens, totalPools, totalUsers] = await Promise.all([
                context.prisma.token.count(),
                context.prisma.pool.count(),
                context.prisma.user.count(),
            ]);
            return { totalTokens, totalPools, totalUsers };
        });
        // Warm trending tokens
        await cacheTrendingTokens(10, async () => {
            const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
            return context.prisma.token.findMany({
                where: { createdAt: { gte: sevenDaysAgo } },
                orderBy: [{ volume24h: 'desc' }, { holders: 'desc' }],
                take: 10,
            });
        });
        logger.info('Cache warming completed');
    }
    catch (error) {
        logger.error({ error }, 'Cache warming failed');
    }
}
/**
 * Cache statistics for monitoring
 */
export async function getCacheMetrics() {
    // TODO: Implement cache hit/miss tracking
    // This would require middleware to track cache operations
    return {
        hits: 0,
        misses: 0,
        hitRate: 0,
    };
}
/**
 * Smart cache TTL based on data volatility
 * Returns appropriate TTL for different data types
 */
export function getSmartTTL(dataType) {
    switch (dataType) {
        // Real-time data
        case 'price':
        case 'volume':
            return CACHE_TTL.SHORT; // 1 minute
        // Semi-static data
        case 'token':
        case 'pool':
        case 'user':
            return CACHE_TTL.MEDIUM; // 5 minutes
        // Slow-changing data
        case 'leaderboard':
        case 'stats':
            return CACHE_TTL.MEDIUM; // 5 minutes
        // Static data
        case 'achievements':
        case 'metadata':
            return CACHE_TTL.LONG; // 30 minutes
        // Very static data
        case 'contracts':
        case 'config':
            return CACHE_TTL.VERY_LONG; // 1 hour
        default:
            return CACHE_TTL.SHORT; // Default to 1 minute
    }
}
/**
 * Batch cache get with fallback to database
 * Optimized for DataLoader-like batching
 */
export async function cacheBatchGetOrFetch(namespace, keys, fetchFn, ttl) {
    const { cacheMultiGet } = await import('../lib/cache.js');
    // Build cache keys
    const cacheKeys = keys.map((key) => buildCacheKey(namespace, key));
    // Try to get from cache
    const cached = await cacheMultiGet(cacheKeys);
    // Separate hits and misses
    const results = new Map();
    const missingKeys = [];
    keys.forEach((key, index) => {
        const value = cached[index];
        if (value !== null) {
            results.set(key, value);
        }
        else {
            missingKeys.push(key);
        }
    });
    // Fetch missing keys from database
    if (missingKeys.length > 0) {
        const fetched = await fetchFn(missingKeys);
        // Store fetched values in cache
        fetched.forEach((value, key) => {
            results.set(key, value);
            const cacheKey = buildCacheKey(namespace, key);
            cacheSet(cacheKey, value, ttl).catch(() => { }); // Fire and forget
        });
    }
    return results;
}
//# sourceMappingURL=cache-helpers.js.map