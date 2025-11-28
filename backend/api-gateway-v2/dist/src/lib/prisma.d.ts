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
export * from '@prisma/client';
/**
 * Global singleton instance
 * In serverless, this prevents creating multiple connections
 * when the same function container is reused
 */
declare global {
    var __prisma: PrismaClient | undefined;
}
/**
 * Get or create Prisma Client singleton
 */
export declare function getPrismaClient(): PrismaClient;
/**
 * Default export: singleton instance
 */
export declare const prisma: PrismaClient<import("@prisma/client").Prisma.PrismaClientOptions, never, import("@prisma/client/runtime/library").DefaultArgs>;
/**
 * Graceful shutdown helper
 */
export declare function disconnectPrisma(): Promise<void>;
/**
 * Health check helper
 */
export declare function checkDatabaseHealth(): Promise<boolean>;
export type PrismaClientWithAdapter = PrismaClient;
export declare const CACHE_STRATEGIES: {
    readonly SHORT_TTL: {
        readonly ttl: 60;
        readonly swr: 30;
    };
    readonly MEDIUM_TTL: {
        readonly ttl: 300;
        readonly swr: 60;
    };
    readonly LONG_TTL: {
        readonly ttl: 1800;
        readonly swr: 300;
    };
    readonly NO_CACHE: {
        readonly ttl: 0;
    };
};
export type PrismaCacheStrategy = typeof CACHE_STRATEGIES.SHORT_TTL;
//# sourceMappingURL=prisma.d.ts.map