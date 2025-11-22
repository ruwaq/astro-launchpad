/**
 * Prisma Module Exports
 * Exports Prisma client, types, and utilities
 */

export { prisma, getPrismaClient, checkDatabaseHealth, CACHE_STRATEGIES } from './client.js'
export type { PrismaClientWithAccelerate, PrismaCacheStrategy } from './client.js'
