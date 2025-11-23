/**
 * GraphQL Context for Apollo Server
 * Optimized for Vercel Serverless with proper typing
 */
import type { NextRequest } from 'next/server';
import type { PrismaClientWithAdapter } from '../lib/prisma.js';
import { type DataLoaders } from './loaders.js';
/**
 * GraphQL Context Interface
 * Available in all resolvers via the context parameter
 */
export interface GraphQLContext {
    prisma: PrismaClientWithAdapter;
    request: NextRequest;
    loaders: DataLoaders;
    user?: {
        address: string;
        authenticated: boolean;
    };
}
/**
 * Create GraphQL context for each request
 * This runs once per GraphQL request
 *
 * @param request - Next.js request object
 * @returns Context object passed to all resolvers
 */
export declare function createContext(request: NextRequest): Promise<GraphQLContext>;
/**
 * Extract client IP address from request
 * Handles proxies and forwarded headers
 */
export declare function getClientIP(request: NextRequest): string;
/**
 * Extract user agent from request
 */
export declare function getUserAgent(request: NextRequest): string | undefined;
/**
 * Check if request is authenticated
 */
export declare function isAuthenticated(context: GraphQLContext): boolean;
/**
 * Require authentication - throws error if not authenticated
 */
export declare function requireAuth(context: GraphQLContext): void;
/**
 * Get user address from context - throws if not authenticated
 */
export declare function getUserAddress(context: GraphQLContext): string;
//# sourceMappingURL=context.d.ts.map