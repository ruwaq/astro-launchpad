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

import { kv } from '@vercel/kv'
import { Redis as IORedis } from 'ioredis'
import { env, isDevelopment } from '@astroshibapop/shared/config'
import { logger } from './logger.js'
import { recordCacheOperation } from './metrics.js'

/**
 * Cache client type
 */
type CacheClient = typeof kv | IORedis | null

/**
 * Cache client singleton
 */
let cacheClient: CacheClient = null
let isVercelKV = false

/**
 * Initialize cache client
 * Detects Vercel KV or standard Redis based on environment
 */
function initializeCacheClient(): CacheClient {
  // Skip in test environment
  if (process.env.NODE_ENV === 'test') {
    logger.info('Cache disabled in test environment')
    return null
  }

  try {
    // Option 1: Vercel KV (REST API)
    if (env.KV_REST_API_URL && env.KV_REST_API_TOKEN) {
      logger.info('Initializing Vercel KV cache')
      isVercelKV = true
      return kv
    }

    // Option 2: Standard Redis / Upstash
    if (env.REDIS_URL) {
      logger.info('Initializing Redis cache')
      isVercelKV = false
      return new IORedis(env.REDIS_URL, {
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        lazyConnect: true,
      })
    }

    // No cache configured
    logger.warn('No cache configured - Redis operations will be no-ops')
    return null
  } catch (error) {
    logger.error({ error }, 'Failed to initialize cache client')
    return null
  }
}

/**
 * Get or initialize cache client
 */
export function getCacheClient(): CacheClient {
  if (!cacheClient) {
    cacheClient = initializeCacheClient()
  }
  return cacheClient
}

/**
 * Check if cache is available
 */
export function isCacheAvailable(): boolean {
  return getCacheClient() !== null
}

/**
 * Cache key builder
 * Creates namespaced cache keys
 */
export function buildCacheKey(namespace: string, key: string): string {
  return `astro:${namespace}:${key}`
}

/**
 * Cache TTL presets (in seconds)
 */
export const CACHE_TTL = {
  SHORT: 60, // 1 minute
  MEDIUM: 300, // 5 minutes
  LONG: 1800, // 30 minutes
  VERY_LONG: 3600, // 1 hour
  DAY: 86400, // 24 hours
} as const

/**
 * Get value from cache
 * Returns null if not found or cache unavailable
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  const client = getCacheClient()
  if (!client) return null

  const startTime = process.hrtime.bigint()
  const namespace = key.split(':')[1] || 'unknown'

  try {
    const value = await client.get(key)
    const duration = Number(process.hrtime.bigint() - startTime) / 1e9

    if (!value) {
      recordCacheOperation('get', namespace, 'miss', duration)
      return null
    }

    recordCacheOperation('get', namespace, 'hit', duration)

    // Parse JSON if it's a string
    if (typeof value === 'string') {
      try {
        return JSON.parse(value) as T
      } catch {
        return value as T
      }
    }

    return value as T
  } catch (error) {
    const duration = Number(process.hrtime.bigint() - startTime) / 1e9
    recordCacheOperation('get', namespace, 'error', duration)
    logger.error({ error, key }, 'Cache get failed')
    return null
  }
}

/**
 * Set value in cache with TTL
 */
export async function cacheSet<T>(
  key: string,
  value: T,
  ttl?: number
): Promise<boolean> {
  const client = getCacheClient()
  if (!client) return false

  const startTime = process.hrtime.bigint()
  const namespace = key.split(':')[1] || 'unknown'

  try {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value)

    if (ttl) {
      await client.set(key, serialized, 'EX', ttl)
    } else {
      await client.set(key, serialized)
    }

    const duration = Number(process.hrtime.bigint() - startTime) / 1e9
    recordCacheOperation('set', namespace, 'set', duration)

    return true
  } catch (error) {
    const duration = Number(process.hrtime.bigint() - startTime) / 1e9
    recordCacheOperation('set', namespace, 'error', duration)
    logger.error({ error, key }, 'Cache set failed')
    return false
  }
}

/**
 * Delete value from cache
 */
export async function cacheDel(key: string): Promise<boolean> {
  const client = getCacheClient()
  if (!client) return false

  const startTime = process.hrtime.bigint()
  const namespace = key.split(':')[1] || 'unknown'

  try {
    await client.del(key)
    const duration = Number(process.hrtime.bigint() - startTime) / 1e9
    recordCacheOperation('del', namespace, 'deleted', duration)
    return true
  } catch (error) {
    const duration = Number(process.hrtime.bigint() - startTime) / 1e9
    recordCacheOperation('del', namespace, 'error', duration)
    logger.error({ error, key }, 'Cache delete failed')
    return false
  }
}

/**
 * Delete multiple keys matching a pattern
 */
export async function cacheDelPattern(pattern: string): Promise<number> {
  const client = getCacheClient()
  if (!client) return 0

  try {
    // Vercel KV doesn't support pattern deletion easily
    if (isVercelKV) {
      logger.warn({ pattern }, 'Pattern deletion not supported in Vercel KV')
      return 0
    }

    // Standard Redis
    const redis = client as IORedis
    const keys = await redis.keys(pattern)
    if (keys.length === 0) return 0

    await redis.del(...keys)
    return keys.length
  } catch (error) {
    logger.error({ error, pattern }, 'Cache pattern delete failed')
    return 0
  }
}

/**
 * Increment counter in cache
 */
export async function cacheIncr(key: string, ttl?: number): Promise<number> {
  const client = getCacheClient()
  if (!client) return 0

  try {
    const result = await client.incr(key)

    // Set TTL if provided and this is the first increment
    if (ttl && result === 1) {
      await client.expire(key, ttl)
    }

    return result
  } catch (error) {
    logger.error({ error, key }, 'Cache incr failed')
    return 0
  }
}

/**
 * Get or set cache value (cache-aside pattern)
 * If value exists in cache, return it
 * Otherwise, fetch from source, cache it, and return
 */
export async function cacheGetOrSet<T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttl?: number
): Promise<T> {
  const startTime = process.hrtime.bigint()
  const namespace = key.split(':')[1] || 'unknown'

  // Try to get from cache
  const cached = await cacheGet<T>(key)
  if (cached !== null) {
    // Already recorded as 'hit' in cacheGet
    return cached
  }

  // Fetch from source (cache miss was recorded in cacheGet)
  const value = await fetchFn()

  // Store in cache (fire and forget)
  cacheSet(key, value, ttl).catch((error) => {
    logger.error({ error, key }, 'Background cache set failed')
  })

  const duration = Number(process.hrtime.bigint() - startTime) / 1e9
  recordCacheOperation('getOrSet', namespace, 'miss', duration)

  return value
}

/**
 * Cache warming helper
 * Pre-populate cache with frequently accessed data
 */
export async function warmCache<T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttl?: number
): Promise<void> {
  try {
    const value = await fetchFn()
    await cacheSet(key, value, ttl)
    logger.info({ key }, 'Cache warmed')
  } catch (error) {
    logger.error({ error, key }, 'Cache warming failed')
  }
}

/**
 * Multi-get from cache
 * Returns array of values in same order as keys
 */
export async function cacheMultiGet<T>(keys: string[]): Promise<(T | null)[]> {
  const client = getCacheClient()
  if (!client || keys.length === 0) {
    return keys.map(() => null)
  }

  try {
    if (isVercelKV) {
      // Vercel KV doesn't have mget, fetch individually
      return Promise.all(keys.map((key) => cacheGet<T>(key)))
    }

    // Standard Redis with mget
    const redis = client as IORedis
    const values = await redis.mget(...keys)

    return values.map((value) => {
      if (!value) return null
      try {
        return JSON.parse(value) as T
      } catch {
        return value as T
      }
    })
  } catch (error) {
    logger.error({ error, keys }, 'Cache multi-get failed')
    return keys.map(() => null)
  }
}

/**
 * Get TTL of a key
 */
export async function cacheTTL(key: string): Promise<number> {
  const client = getCacheClient()
  if (!client) return -1

  try {
    return await client.ttl(key)
  } catch (error) {
    logger.error({ error, key }, 'Cache TTL check failed')
    return -1
  }
}

/**
 * Check if key exists
 */
export async function cacheExists(key: string): Promise<boolean> {
  const client = getCacheClient()
  if (!client) return false

  try {
    const result = await client.exists(key)
    return result > 0
  } catch (error) {
    logger.error({ error, key }, 'Cache exists check failed')
    return false
  }
}

/**
 * Graceful cache disconnect
 * Call on application shutdown
 */
export async function disconnectCache(): Promise<void> {
  if (!cacheClient || isVercelKV) return

  try {
    const redis = cacheClient as IORedis
    await redis.quit()
    cacheClient = null
    logger.info('Cache disconnected')
  } catch (error) {
    logger.error({ error }, 'Cache disconnect failed')
  }
}

/**
 * Cache statistics
 */
export async function getCacheStats(): Promise<{
  available: boolean
  type: 'vercel-kv' | 'redis' | 'none'
  keyCount?: number
}> {
  const client = getCacheClient()

  if (!client) {
    return { available: false, type: 'none' }
  }

  try {
    let keyCount: number | undefined

    if (!isVercelKV) {
      const redis = client as IORedis
      keyCount = await redis.dbsize()
    }

    return {
      available: true,
      type: isVercelKV ? 'vercel-kv' : 'redis',
      keyCount,
    }
  } catch (error) {
    logger.error({ error }, 'Failed to get cache stats')
    return {
      available: false,
      type: isVercelKV ? 'vercel-kv' : 'redis',
    }
  }
}
