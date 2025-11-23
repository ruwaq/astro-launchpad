/**
 * Redis/KV Cache Layer
 * Unified interface for Vercel KV or standard Redis
 *
 * Features:
 * - Automatic fallback if Redis is unavailable
 * - Type-safe cache operations
 * - TTL support
 * - JSON serialization
 * - Cache warming strategies
 */
import { kv } from '@vercel/kv';
import { Redis as IORedis } from 'ioredis';
/**
 * Cache client type
 */
type CacheClient = typeof kv | IORedis | null;
/**
 * Get or initialize cache client
 */
export declare function getCacheClient(): CacheClient;
/**
 * Check if cache is available
 */
export declare function isCacheAvailable(): boolean;
/**
 * Cache key builder
 * Creates namespaced cache keys
 */
export declare function buildCacheKey(namespace: string, key: string): string;
/**
 * Cache TTL presets (in seconds)
 */
export declare const CACHE_TTL: {
    readonly SHORT: 60;
    readonly MEDIUM: 300;
    readonly LONG: 1800;
    readonly VERY_LONG: 3600;
    readonly DAY: 86400;
};
/**
 * Get value from cache
 * Returns null if not found or cache unavailable
 */
export declare function cacheGet<T>(key: string): Promise<T | null>;
/**
 * Set value in cache with TTL
 */
export declare function cacheSet<T>(key: string, value: T, ttl?: number): Promise<boolean>;
/**
 * Delete value from cache
 */
export declare function cacheDel(key: string): Promise<boolean>;
/**
 * Delete multiple keys matching a pattern
 */
export declare function cacheDelPattern(pattern: string): Promise<number>;
/**
 * Increment counter in cache
 */
export declare function cacheIncr(key: string, ttl?: number): Promise<number>;
/**
 * Get or set cache value (cache-aside pattern)
 * If value exists in cache, return it
 * Otherwise, fetch from source, cache it, and return
 */
export declare function cacheGetOrSet<T>(key: string, fetchFn: () => Promise<T>, ttl?: number): Promise<T>;
/**
 * Cache warming helper
 * Pre-populate cache with frequently accessed data
 */
export declare function warmCache<T>(key: string, fetchFn: () => Promise<T>, ttl?: number): Promise<void>;
/**
 * Multi-get from cache
 * Returns array of values in same order as keys
 */
export declare function cacheMultiGet<T>(keys: string[]): Promise<(T | null)[]>;
/**
 * Get TTL of a key
 */
export declare function cacheTTL(key: string): Promise<number>;
/**
 * Check if key exists
 */
export declare function cacheExists(key: string): Promise<boolean>;
/**
 * Graceful cache disconnect
 * Call on application shutdown
 */
export declare function disconnectCache(): Promise<void>;
/**
 * Cache statistics
 */
export declare function getCacheStats(): Promise<{
    available: boolean;
    type: 'vercel-kv' | 'redis' | 'none';
    keyCount?: number;
}>;
export {};
//# sourceMappingURL=cache.d.ts.map