/**
 * Prisma Client Singleton for AstroShiba API Gateway
 * Centralized Database Access Layer
 *
 * Features:
 * - Singleton pattern (prevents connection exhaustion in serverless/dev)
 * - Standard PostgreSQL connection
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
    : ['error'];
/**
 * Create standard Prisma Client
 */
function createPrismaClient() {
    return new PrismaClient({
        log: logConfig,
        errorFormat: isDevelopment ? 'pretty' : 'minimal',
    });
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
//# sourceMappingURL=prisma.js.map