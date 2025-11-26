/**
 * GraphQL Context for Apollo Server
 * Generic HTTP types - no framework dependencies
 */
import { IncomingMessage } from 'http';
import type { PrismaClientWithAdapter } from '../lib/prisma.js';
import { type DataLoaders } from './loaders.js';
/**
 * GraphQL Context Interface
 * Available in all resolvers via the context parameter
 */
export interface GraphQLContext {
    prisma: PrismaClientWithAdapter;
    request: IncomingMessage;
    loaders: DataLoaders;
    user?: {
        address: string;
        authenticated: boolean;
        isAdmin?: boolean;
    };
}
/**
 * Create GraphQL context for each request
 * This runs once per GraphQL request
 *
 * @param request - HTTP request object
 * @returns Context object passed to all resolvers
 */
export declare function createContext(request?: IncomingMessage): Promise<GraphQLContext>;
/**
 * Extract client IP address from request
 * Handles proxies and forwarded headers
 */
export declare function getClientIP(request: IncomingMessage): string;
/**
 * Extract user agent from request
 */
export declare function getUserAgent(request: IncomingMessage): string | undefined;
/**
 * Check if request is authenticated
 */
export declare function isAuthenticated(context: GraphQLContext): boolean;
/**
 * Check if user is admin
 */
export declare function isAdmin(context: GraphQLContext): boolean;
/**
 * Require authentication - throws error if not authenticated
 */
export declare function requireAuth(context: GraphQLContext): void;
/**
 * Require admin privileges - throws error if not admin
 */
export declare function requireAdmin(context: GraphQLContext): void;
/**
 * Get user address from context - throws if not authenticated
 */
export declare function getUserAddress(context: GraphQLContext): string;
//# sourceMappingURL=context.d.ts.map