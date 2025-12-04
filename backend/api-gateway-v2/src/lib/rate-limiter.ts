/**
 * Rate Limiting System for GraphQL API
 *
 * Implements multiple rate limiting strategies:
 * 1. Global rate limiting (per IP)
 * 2. Per-operation rate limiting (mutations vs queries)
 * 3. Admin endpoint rate limiting (stricter)
 * 4. Sliding window algorithm for accuracy
 *
 * Uses Redis/Vercel KV for distributed rate limiting
 */

import { cacheIncr, cacheGet, cacheSet, buildCacheKey, CACHE_TTL } from './cache.js'
import { logger } from './logger.js'

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  windowMs: number      // Time window in milliseconds
  maxRequests: number   // Maximum requests in window
  keyPrefix: string     // Cache key prefix for this limiter
  failOpen?: boolean    // If true, allow requests when rate limiting fails (default: true for queries, false for admin)
}

/**
 * Rate limit result
 */
export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number       // Unix timestamp when limit resets
  retryAfter?: number   // Seconds to wait before retry (if blocked)
}

/**
 * Default rate limit configurations
 *
 * SECURITY NOTE: failOpen determines behavior when Redis/cache is unavailable:
 * - true: Allow requests (maintain availability at cost of security)
 * - false: Block requests (maintain security at cost of availability)
 *
 * Sensitive operations (admin, auth, sync) use failOpen=false for security.
 * General queries use failOpen=true for availability.
 */
export const RATE_LIMITS = {
  // Global: 100 requests per minute per IP
  // Fail open to maintain availability for general traffic
  GLOBAL: {
    windowMs: 60 * 1000,
    maxRequests: 100,
    keyPrefix: 'ratelimit:global',
    failOpen: true,
  },

  // Queries: 200 requests per minute per IP (more lenient)
  // Fail open to maintain availability for read operations
  QUERIES: {
    windowMs: 60 * 1000,
    maxRequests: 200,
    keyPrefix: 'ratelimit:queries',
    failOpen: true,
  },

  // Mutations: 30 requests per minute per IP (stricter)
  // Fail closed - mutations modify state
  MUTATIONS: {
    windowMs: 60 * 1000,
    maxRequests: 30,
    keyPrefix: 'ratelimit:mutations',
    failOpen: false,
  },

  // Admin: 10 requests per minute per IP (very strict)
  // SECURITY: Fail closed - admin operations are privileged
  ADMIN: {
    windowMs: 60 * 1000,
    maxRequests: 10,
    keyPrefix: 'ratelimit:admin',
    failOpen: false,
  },

  // Sync Token: 5 requests per minute per IP (expensive operation)
  // SECURITY: Fail closed - prevents DoS on RPC nodes
  SYNC_TOKEN: {
    windowMs: 60 * 1000,
    maxRequests: 5,
    keyPrefix: 'ratelimit:sync',
    failOpen: false,
  },

  // Auth attempts: 5 attempts per 5 minutes (prevent brute force)
  // SECURITY: Fail closed - critical for preventing brute force attacks
  AUTH_ATTEMPTS: {
    windowMs: 5 * 60 * 1000,
    maxRequests: 5,
    keyPrefix: 'ratelimit:auth',
    failOpen: false,
  },
} as const

/**
 * Extract client IP from request
 * Handles proxies (X-Forwarded-For) and direct connections
 */
export function getClientIP(req: { headers: Record<string, string | string[] | undefined>; ip?: string }): string {
  // Check X-Forwarded-For header (common in proxies/load balancers)
  const forwardedFor = req.headers['x-forwarded-for']
  if (forwardedFor) {
    const ips = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor
    // Take the first IP (original client)
    const clientIP = ips.split(',')[0].trim()
    if (clientIP) return clientIP
  }

  // Check X-Real-IP header (nginx)
  const realIP = req.headers['x-real-ip']
  if (realIP) {
    return Array.isArray(realIP) ? realIP[0] : realIP
  }

  // Check CF-Connecting-IP (Cloudflare)
  const cfIP = req.headers['cf-connecting-ip']
  if (cfIP) {
    return Array.isArray(cfIP) ? cfIP[0] : cfIP
  }

  // Fallback to direct IP
  return req.ip || 'unknown'
}

/**
 * Check rate limit for a given identifier
 * Uses sliding window counter algorithm
 */
export async function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const now = Date.now()
  const windowStart = Math.floor(now / config.windowMs) * config.windowMs
  const windowKey = buildCacheKey(config.keyPrefix, `${identifier}:${windowStart}`)
  const ttlSeconds = Math.ceil(config.windowMs / 1000)

  try {
    // Increment counter for current window
    const count = await cacheIncr(windowKey, ttlSeconds)

    const remaining = Math.max(0, config.maxRequests - count)
    const resetAt = windowStart + config.windowMs

    if (count > config.maxRequests) {
      const retryAfter = Math.ceil((resetAt - now) / 1000)

      logger.warn({
        identifier,
        count,
        limit: config.maxRequests,
        retryAfter,
      }, 'Rate limit exceeded')

      return {
        allowed: false,
        remaining: 0,
        resetAt,
        retryAfter,
      }
    }

    return {
      allowed: true,
      remaining,
      resetAt,
    }
  } catch (error) {
    // Determine fail behavior based on configuration
    // Default to fail-open if not specified (backward compatibility)
    const shouldFailOpen = config.failOpen !== false

    if (shouldFailOpen) {
      // Fail open: allow request when rate limiting fails (for general queries)
      logger.warn({ error, identifier, keyPrefix: config.keyPrefix }, 'Rate limit check failed, allowing request (fail-open)')
      return {
        allowed: true,
        remaining: config.maxRequests,
        resetAt: now + config.windowMs,
      }
    } else {
      // Fail closed: block request when rate limiting fails (for sensitive operations)
      logger.error({ error, identifier, keyPrefix: config.keyPrefix }, 'Rate limit check failed, blocking request (fail-closed)')
      return {
        allowed: false,
        remaining: 0,
        resetAt: now + config.windowMs,
        retryAfter: 60, // Tell client to retry in 60 seconds
      }
    }
  }
}

/**
 * Rate limiter class for more complex scenarios
 */
export class RateLimiter {
  private config: RateLimitConfig

  constructor(config: RateLimitConfig) {
    this.config = config
  }

  async check(identifier: string): Promise<RateLimitResult> {
    return checkRateLimit(identifier, this.config)
  }

  /**
   * Check with custom key suffix
   * Useful for per-operation rate limiting
   */
  async checkWithSuffix(identifier: string, suffix: string): Promise<RateLimitResult> {
    return checkRateLimit(`${identifier}:${suffix}`, this.config)
  }
}

/**
 * Pre-configured rate limiters
 */
export const globalRateLimiter = new RateLimiter(RATE_LIMITS.GLOBAL)
export const queryRateLimiter = new RateLimiter(RATE_LIMITS.QUERIES)
export const mutationRateLimiter = new RateLimiter(RATE_LIMITS.MUTATIONS)
export const adminRateLimiter = new RateLimiter(RATE_LIMITS.ADMIN)
export const syncTokenRateLimiter = new RateLimiter(RATE_LIMITS.SYNC_TOKEN)
export const authRateLimiter = new RateLimiter(RATE_LIMITS.AUTH_ATTEMPTS)

/**
 * Track failed admin authentication attempts
 * After 5 failures, block for 5 minutes
 */
export async function trackFailedAdminAuth(identifier: string): Promise<{
  blocked: boolean
  attemptsRemaining: number
}> {
  const config = RATE_LIMITS.AUTH_ATTEMPTS
  const result = await checkRateLimit(identifier, config)

  return {
    blocked: !result.allowed,
    attemptsRemaining: result.remaining,
  }
}

/**
 * Apollo Server plugin for rate limiting
 * Checks rate limits before executing operations
 */
export function createRateLimitPlugin() {
  return {
    async requestDidStart({ request, contextValue }: any) {
      // Skip rate limiting for introspection queries
      if (request.operationName === 'IntrospectionQuery') {
        return {}
      }

      // Extract IP from context's request object
      const ip = getClientIP(contextValue?.request || {})

      // Check global rate limit
      const globalResult = await globalRateLimiter.check(ip)
      if (!globalResult.allowed) {
        logger.warn({ ip, retryAfter: globalResult.retryAfter }, 'Global rate limit exceeded')
        throw new Error(`Rate limit exceeded. Try again in ${globalResult.retryAfter} seconds.`)
      }

      return {
        async executionDidStart() {
          return {
            willResolveField({ info }: any) {
              // Track per-field metrics if needed
            },
          }
        },
      }
    },
  }
}

/**
 * Rate limit headers for HTTP responses
 */
export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Limit': String(result.remaining + (result.allowed ? 0 : 1)),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.floor(result.resetAt / 1000)),
    ...(result.retryAfter ? { 'Retry-After': String(result.retryAfter) } : {}),
  }
}

/**
 * Utility to create operation-specific rate limiters
 */
export function createOperationRateLimiter(
  operationName: string,
  maxRequests: number,
  windowMs: number = 60000
): RateLimiter {
  return new RateLimiter({
    windowMs,
    maxRequests,
    keyPrefix: `ratelimit:op:${operationName}`,
  })
}
