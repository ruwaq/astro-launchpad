/**
 * Prisma Client Singleton for Serverless Environments
 * Optimized for Vercel with Prisma Accelerate
 *
 * Key features:
 * - Global connection pooling via Prisma Accelerate
 * - Single instance pattern for serverless
 * - Query result caching with configurable TTL
 * - Connection management optimized for cold starts
 */

import { PrismaClient } from '@prisma/client'
import type { Prisma } from '@prisma/client'
import { withAccelerate } from '@prisma/extension-accelerate'

// Environment detection
const isDevelopment = process.env.NODE_ENV !== 'production'
const isTest = process.env.NODE_ENV === 'test'

// Logging configuration
const logConfig: Prisma.LogLevel[] = isDevelopment
  ? ['query', 'error', 'warn']
  : ['error']

/**
 * Extended Prisma Client with Accelerate
 */
export type PrismaClientWithAccelerate = ReturnType<typeof createPrismaClient>

/**
 * Cache strategy type for Prisma Accelerate
 */
export type PrismaCacheStrategy = {
  ttl: number
  swr?: number
}

/**
 * Create Prisma Client with Accelerate extension
 * - Uses Accelerate for global connection pooling
 * - Enables query result caching
 * - Optimized for serverless cold starts
 */
function createPrismaClient() {
  const client = new PrismaClient({
    log: logConfig,
    // Disable error formatting in production for smaller bundle
    errorFormat: isDevelopment ? 'pretty' : 'minimal',
  })

  // Extend with Accelerate for connection pooling and caching
  return client.$extends(withAccelerate())
}

/**
 * Global singleton instance
 * In serverless, this prevents creating multiple connections
 * when the same function container is reused
 */
declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClientWithAccelerate | undefined
}

/**
 * Get or create Prisma Client singleton
 *
 * Pattern for serverless:
 * 1. Check if client exists in global scope (container reuse)
 * 2. If not, create new client
 * 3. Store in global scope for next invocation
 *
 * @returns Prisma Client with Accelerate extension
 */
export function getPrismaClient(): PrismaClientWithAccelerate {
  // In test environment, always create new instance
  if (isTest) {
    return createPrismaClient()
  }

  // In production/dev, use singleton pattern
  if (!global.__prisma) {
    global.__prisma = createPrismaClient()
  }

  return global.__prisma
}

/**
 * Default export: singleton instance
 * Import this in your application code
 */
export const prisma = getPrismaClient()

/**
 * Graceful shutdown helper
 * Call this when your application is shutting down
 *
 * Note: In serverless, you typically DON'T want to disconnect
 * as the container may be reused. Only use this for:
 * - Tests
 * - Long-running processes (like indexer)
 * - Graceful shutdown scenarios
 */
export async function disconnectPrisma() {
  if (global.__prisma) {
    await global.__prisma.$disconnect()
    global.__prisma = undefined
  }
}

/**
 * Health check helper
 * Verifies database connectivity
 */
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`
    return true
  } catch (error) {
    console.error('Database health check failed:', error)
    return false
  }
}

/**
 * Cache strategies for Accelerate
 * Use these with your queries for optimal performance
 *
 * Example:
 * ```ts
 * const tokens = await prisma.token.findMany({
 *   cacheStrategy: CACHE_STRATEGIES.SHORT_TTL
 * })
 * ```
 */
export const CACHE_STRATEGIES = {
  /**
   * Short TTL (60 seconds)
   * Use for: Frequently changing data like prices, volumes
   */
  SHORT_TTL: {
    ttl: 60,
    swr: 30, // Stale-while-revalidate
  },

  /**
   * Medium TTL (5 minutes)
   * Use for: Semi-static data like token info, user profiles
   */
  MEDIUM_TTL: {
    ttl: 300,
    swr: 60,
  },

  /**
   * Long TTL (30 minutes)
   * Use for: Static data like achievements, configurations
   */
  LONG_TTL: {
    ttl: 1800,
    swr: 300,
  },

  /**
   * No cache
   * Use for: Real-time critical data, writes
   */
  NO_CACHE: {
    ttl: 0,
  },
} as const

/**
 * Example usage:
 *
 * ```typescript
 * import { prisma, CACHE_STRATEGIES } from '@/shared/prisma/client'
 *
 * // Query with caching
 * const tokens = await prisma.token.findMany({
 *   cacheStrategy: CACHE_STRATEGIES.MEDIUM_TTL,
 *   where: { graduated: false }
 * })
 *
 * // Query without caching (for writes or real-time data)
 * const newToken = await prisma.token.create({
 *   data: { ... }
 * })
 * ```
 */
