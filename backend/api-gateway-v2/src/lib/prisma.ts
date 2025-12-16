/**
 * Prisma Client Singleton for AstroShiba API Gateway
 * Centralized Database Access Layer
 *
 * Features:
 * - Singleton pattern (prevents connection exhaustion in serverless/dev)
 * - Standard PostgreSQL connection
 * - Type exports for the API Gateway
 */

import { PrismaClient } from '@prisma/client'

// Re-export all types from Prisma Client
export * from '@prisma/client'

// Environment detection
const isDevelopment = process.env.NODE_ENV !== 'production'
const isTest = process.env.NODE_ENV === 'test'

// Logging configuration
const logConfig = isDevelopment
  ? ['query', 'error', 'warn']
  : ['error']

/**
 * Global singleton instance
 * In serverless, this prevents creating multiple connections
 * when the same function container is reused
 */
declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined
}

/**
 * Models that support soft-delete (have deletedAt field)
 */
const SOFT_DELETE_MODELS = ['Token', 'Pool']

/**
 * Create standard Prisma Client with soft-delete middleware
 *
 * Professional approach: Use $use middleware to automatically filter
 * soft-deleted records on findMany, findFirst, and count operations.
 *
 * @see https://www.prisma.io/docs/orm/prisma-client/client-extensions/middleware/soft-delete-middleware
 */
function createPrismaClient() {
  const client = new PrismaClient({
    log: logConfig as any,
    errorFormat: isDevelopment ? 'pretty' : 'minimal',
  })

  // Soft-delete middleware: automatically filter deleted records
  client.$use(async (params, next) => {
    // Only apply to soft-delete enabled models
    if (!params.model || !SOFT_DELETE_MODELS.includes(params.model)) {
      return next(params)
    }

    // For find operations, automatically filter out deleted records
    if (params.action === 'findMany' || params.action === 'findFirst' || params.action === 'count') {
      params.args = params.args || {}
      params.args.where = params.args.where || {}

      // Check if deletedAt is already specified anywhere in the where clause
      const hasDeletedAtFilter = (obj: any): boolean => {
        if (!obj || typeof obj !== 'object') return false
        if ('deletedAt' in obj) return true
        if (Array.isArray(obj.AND)) return obj.AND.some(hasDeletedAtFilter)
        if (Array.isArray(obj.OR)) return obj.OR.some(hasDeletedAtFilter)
        return false
      }

      if (hasDeletedAtFilter(params.args.where)) {
        return next(params)
      }

      // Add deletedAt IS NULL filter
      // Handle both simple where and AND conditions
      if (Array.isArray(params.args.where.AND)) {
        // If using AND array, add to the array
        params.args.where.AND.push({ deletedAt: null })
      } else if (Object.keys(params.args.where).length === 0) {
        // Empty where clause
        params.args.where.deletedAt = null
      } else {
        // Has other conditions but no AND - wrap in AND
        const existingConditions = { ...params.args.where }
        params.args.where = {
          AND: [existingConditions, { deletedAt: null }]
        }
      }
    }

    return next(params)
  })

  return client
}

/**
 * Get or create Prisma Client singleton
 */
export function getPrismaClient(): PrismaClient {
  if (isTest) {
    return createPrismaClient()
  }

  if (!global.__prisma) {
    global.__prisma = createPrismaClient()
  }

  return global.__prisma
}

/**
 * Default export: singleton instance
 */
export const prisma = getPrismaClient()

/**
 * Graceful shutdown helper
 */
export async function disconnectPrisma() {
  if (global.__prisma) {
    await global.__prisma.$disconnect()
    global.__prisma = undefined
  }
}

/**
 * Health check helper
 */
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    // Simple query to check connection
    await prisma.$queryRaw`SELECT 1`
    return true
  } catch (error) {
    console.error('Database health check failed:', error)
    return false
  }
}

// Export types for compatibility
export type PrismaClientWithAdapter = PrismaClient;

// Simple cache strategy stub (no-op without accelerate, but keeps types compatible)
export const CACHE_STRATEGIES = {
  SHORT_TTL: { ttl: 60, swr: 30 },
  MEDIUM_TTL: { ttl: 300, swr: 60 },
  LONG_TTL: { ttl: 1800, swr: 300 },
  NO_CACHE: { ttl: 0 },
} as const

export type PrismaCacheStrategy = typeof CACHE_STRATEGIES.SHORT_TTL;
// Build timestamp: 1765857143
