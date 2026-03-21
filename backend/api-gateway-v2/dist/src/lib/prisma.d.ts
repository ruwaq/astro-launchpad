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
import { Prisma } from '@prisma/client';
export * from '@prisma/client';
/**
 * Global singleton instance
 * In serverless, this prevents creating multiple connections
 * when the same function container is reused
 */
declare global {
    var __prisma: ReturnType<typeof createPrismaClient> | undefined;
}
/**
 * Create Prisma Client with soft-delete extension (Prisma 5.x+)
 *
 * Uses Prisma Client Extensions to automatically filter soft-deleted records.
 * This replaces the deprecated $use middleware.
 *
 * @see https://www.prisma.io/docs/orm/prisma-client/client-extensions
 */
declare function createPrismaClient(): import("@prisma/client/runtime/library").DynamicClientExtensionThis<Prisma.TypeMap<import("@prisma/client/runtime/library").InternalArgs & {
    result: {};
    model: {};
    query: {};
    client: {};
}, Prisma.PrismaClientOptions>, Prisma.TypeMapCb, {
    result: {};
    model: {};
    query: {};
    client: {};
}, {}>;
/**
 * Extended Prisma Client type with soft-delete extension
 */
export type ExtendedPrismaClient = ReturnType<typeof createPrismaClient>;
/**
 * Get or create Prisma Client singleton
 */
export declare function getPrismaClient(): ExtendedPrismaClient;
/**
 * Default export: singleton instance
 */
export declare const prisma: import("@prisma/client/runtime/library").DynamicClientExtensionThis<Prisma.TypeMap<import("@prisma/client/runtime/library").InternalArgs & {
    result: {};
    model: {};
    query: {};
    client: {};
}, Prisma.PrismaClientOptions>, Prisma.TypeMapCb, {
    result: {};
    model: {};
    query: {};
    client: {};
}, {}>;
/**
 * Graceful shutdown helper
 */
export declare function disconnectPrisma(): Promise<void>;
/**
 * Health check helper
 */
export declare function checkDatabaseHealth(): Promise<boolean>;
export type PrismaClientWithAdapter = ExtendedPrismaClient;
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