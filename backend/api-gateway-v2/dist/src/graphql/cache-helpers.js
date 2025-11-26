/**
 * GraphQL-specific Cache Helpers
 * Optimized caching strategies for different query types
 */
import { cacheGetOrSet, buildCacheKey, CACHE_TTL, } from '../lib/cache.js';
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
//# sourceMappingURL=cache-helpers.js.map