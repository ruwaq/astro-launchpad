/**
 * Prisma Client Singleton for AstroShiba API Gateway
 * Centralized Database Access Layer
 *
 * Features:
 * - Singleton pattern (prevents connection exhaustion in serverless/dev)
 * - Standard PostgreSQL connection
 * - Soft-delete via Prisma Client Extensions (Prisma 5.x+)
 * - Type exports for the API Gateway
 */
import { PrismaClient } from '@prisma/client';
// Re-export all types from Prisma Client
export * from '@prisma/client';
// Environment detection
const isDevelopment = process.env.NODE_ENV !== 'production';
const isTest = process.env.NODE_ENV === 'test';
// Logging configuration
const logConfig = isDevelopment
    ? ['query', 'error', 'warn']
    : ['error', 'warn'];
/**
 * Create Prisma Client with soft-delete extension (Prisma 5.x+)
 *
 * Uses Prisma Client Extensions to automatically filter soft-deleted records.
 * This replaces the deprecated $use middleware.
 *
 * @see https://www.prisma.io/docs/orm/prisma-client/client-extensions
 */
function createPrismaClient() {
    const baseClient = new PrismaClient({
        log: logConfig,
        errorFormat: isDevelopment ? 'pretty' : 'minimal',
    });
    // Extend client with soft-delete filtering
    const client = baseClient.$extends({
        name: 'softDelete',
        query: {
            token: {
                async findMany({ args, query }) {
                    // Only add deletedAt filter if not already specified
                    if (!hasDeletedAtFilter(args.where)) {
                        args.where = addDeletedAtFilter(args.where);
                    }
                    return query(args);
                },
                async findFirst({ args, query }) {
                    if (!hasDeletedAtFilter(args.where)) {
                        args.where = addDeletedAtFilter(args.where);
                    }
                    return query(args);
                },
                async findUnique({ args, query }) {
                    // For findUnique, we need to check after query if soft-deleted
                    const result = await query(args);
                    if (result && 'deletedAt' in result && result.deletedAt !== null) {
                        return null;
                    }
                    return result;
                },
                async count({ args, query }) {
                    if (!hasDeletedAtFilter(args.where)) {
                        args.where = addDeletedAtFilter(args.where);
                    }
                    return query(args);
                },
            },
            pool: {
                async findMany({ args, query }) {
                    if (!hasDeletedAtFilter(args.where)) {
                        args.where = addDeletedAtFilter(args.where);
                    }
                    return query(args);
                },
                async findFirst({ args, query }) {
                    if (!hasDeletedAtFilter(args.where)) {
                        args.where = addDeletedAtFilter(args.where);
                    }
                    return query(args);
                },
                async findUnique({ args, query }) {
                    const result = await query(args);
                    if (result && 'deletedAt' in result && result.deletedAt !== null) {
                        return null;
                    }
                    return result;
                },
                async count({ args, query }) {
                    if (!hasDeletedAtFilter(args.where)) {
                        args.where = addDeletedAtFilter(args.where);
                    }
                    return query(args);
                },
            },
        },
    });
    return client;
}
/**
 * Check if where clause already has a deletedAt filter
 */
function hasDeletedAtFilter(where) {
    if (!where || typeof where !== 'object')
        return false;
    if ('deletedAt' in where)
        return true;
    if (Array.isArray(where.AND))
        return where.AND.some(hasDeletedAtFilter);
    if (Array.isArray(where.OR))
        return where.OR.some(hasDeletedAtFilter);
    return false;
}
/**
 * Add deletedAt IS NULL filter to where clause
 */
function addDeletedAtFilter(where) {
    if (!where || Object.keys(where).length === 0) {
        return { deletedAt: null };
    }
    if (Array.isArray(where.AND)) {
        return { ...where, AND: [...where.AND, { deletedAt: null }] };
    }
    return { AND: [where, { deletedAt: null }] };
}
/**
 * Get or create Prisma Client singleton
 */
export function getPrismaClient() {
    if (isTest) {
        return createPrismaClient();
    }
    if (!global.__prisma) {
        global.__prisma = createPrismaClient();
    }
    return global.__prisma;
}
/**
 * Default export: singleton instance
 */
export const prisma = getPrismaClient();
/**
 * Graceful shutdown helper
 */
export async function disconnectPrisma() {
    if (global.__prisma) {
        await global.__prisma.$disconnect();
        global.__prisma = undefined;
    }
}
/**
 * Health check helper
 */
export async function checkDatabaseHealth() {
    try {
        // Simple query to check connection
        await prisma.$queryRaw `SELECT 1`;
        return true;
    }
    catch (error) {
        console.error('Database health check failed:', error);
        return false;
    }
}
// Simple cache strategy stub (no-op without accelerate, but keeps types compatible)
export const CACHE_STRATEGIES = {
    SHORT_TTL: { ttl: 60, swr: 30 },
    MEDIUM_TTL: { ttl: 300, swr: 60 },
    LONG_TTL: { ttl: 1800, swr: 300 },
    NO_CACHE: { ttl: 0 },
};
// Build timestamp: 1765857143
//# sourceMappingURL=prisma.js.map