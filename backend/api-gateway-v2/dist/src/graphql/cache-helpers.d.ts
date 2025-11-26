/**
 * GraphQL-specific Cache Helpers
 * Optimized caching strategies for different query types
 */
/**
 * Cache namespaces for different data types
 */
export declare const CACHE_NAMESPACES: {
    readonly TOKEN: "token";
    readonly POOL: "pool";
    readonly USER: "user";
    readonly LEADERBOARD: "leaderboard";
    readonly GLOBAL_STATS: "stats";
    readonly TRENDING: "trending";
    readonly TRANSACTIONS: "transactions";
};
/**
 * Cache wrapper for leaderboard queries
 * Leaderboards change infrequently and are expensive to compute
 * TTL: 1 minute (60s) for near real-time rankings
 */
export declare function cacheLeaderboard<T>(type: string, limit: number, fetchFn: () => Promise<T>): Promise<T>;
/**
 * Cache wrapper for global stats
 * Stats are aggregations that don't need to be real-time
 */
export declare function cacheGlobalStats<T>(fetchFn: () => Promise<T>): Promise<T>;
/**
 * Cache wrapper for trending tokens
 * Trending calculations are complex and change slowly
 */
export declare function cacheTrendingTokens<T>(limit: number, fetchFn: () => Promise<T>): Promise<T>;
/**
 * Cache wrapper for transaction lists
 * Transactions are immutable once created
 */
export declare function cacheTransactions<T>(args: {
    address?: string;
    tokenAddress?: string;
    type?: string;
    limit?: number;
    offset?: number;
}, fetchFn: () => Promise<T>): Promise<T>;
/**
 * Rate limiting using cache
 * More efficient than in-memory rate limiting in serverless
 */
export declare function checkRateLimit(identifier: string, maxRequests: number, windowSeconds: number): Promise<{
    allowed: boolean;
    remaining: number;
    resetAt: number;
}>;
//# sourceMappingURL=cache-helpers.d.ts.map