/**
 * Prisma Module Exports
 * Exports Prisma client, types, and utilities
 */

// Re-export all generated types (User, Token, Prisma, Enums, etc.)
export * from '@prisma/client'

// Export our custom singleton and utilities
export { prisma, getPrismaClient, checkDatabaseHealth, CACHE_STRATEGIES, disconnectPrisma } from './client.js'
export type { PrismaClientWithAdapter, PrismaCacheStrategy } from './client.js'
