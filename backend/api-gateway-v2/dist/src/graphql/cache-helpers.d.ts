/**
 * GraphQL-specific Cache Helpers
 * Optimized caching strategies for different query types
 */
import type { GraphQLContext } from './context.js';
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
 * Invalidate cache for a specific entity
 * Call this when entity is updated
 */
export declare function invalidateEntityCache(namespace: string, identifier: string): Promise<void>;
/**
 * Invalidate all caches for a namespace
 * Use sparingly - requires pattern matching
 */
export declare function invalidateNamespaceCache(namespace: string): Promise<void>;
/**
 * Cache invalidation helpers for specific events
 */
export declare const cacheInvalidators: {
    /**
     * Invalidate caches when a new token is created
     */
    onTokenCreated: () => Promise<void>;
    /**
     * Invalidate caches when token data changes (price, volume, etc.)
     */
    onTokenUpdated: (tokenAddress: string) => Promise<void>;
    /**
     * Invalidate caches when user data changes
     */
    onUserUpdated: (userAddress: string) => Promise<void>;
    /**
     * Invalidate caches when pool is created/updated
     */
    onPoolUpdated: (poolAddress: string) => Promise<void>;
    /**
     * Invalidate caches when transaction occurs
     */
    onTransaction: () => Promise<void>;
};
/**
 * Rate limiting using cache
 * More efficient than in-memory rate limiting in serverless
 */
export declare function checkRateLimit(identifier: string, maxRequests: number, windowSeconds: number): Promise<{
    allowed: boolean;
    remaining: number;
    resetAt: number;
}>;
/**
 * Cache warming for frequently accessed data
 * Call this on server startup or periodically
 */
export declare function warmFrequentCaches(context: GraphQLContext): Promise<void>;
/**
 * Cache statistics for monitoring
 */
export declare function getCacheMetrics(): Promise<{
    hits: number;
    misses: number;
    hitRate: number;
}>;
/**
 * Smart cache TTL based on data volatility
 * Returns appropriate TTL for different data types
 */
export declare function getSmartTTL(dataType: string): number;
/**
 * Batch cache get with fallback to database
 * Optimized for DataLoader-like batching
 */
export declare function cacheBatchGetOrFetch<T>(namespace: string, keys: string[], fetchFn: (missingKeys: string[]) => Promise<Map<string, T>>, ttl?: number): Promise<Map<string, T>>;
//# sourceMappingURL=cache-helpers.d.ts.map