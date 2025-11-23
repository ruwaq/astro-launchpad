/**
 * GraphQL Context
 * Created for each request, contains Prisma client and DataLoaders
 */
import type { FastifyRequest, FastifyReply } from 'fastify';
import type { MercuriusContext } from 'mercurius';
import type { PrismaClientWithAccelerate } from '@astroshibapop/shared/prisma';
import { type DataLoaders } from './loaders.js';
/**
 * GraphQL Context interface
 * Available in all resolvers via the context parameter
 */
export interface GraphQLContext extends MercuriusContext {
    prisma: PrismaClientWithAccelerate;
    request: FastifyRequest;
    reply: FastifyReply;
    loaders: DataLoaders;
}
/**
 * Create GraphQL context for each request
 * This runs once per GraphQL request
 *
 * @param request - Fastify request object
 * @param reply - Fastify reply object
 * @returns Context object passed to all resolvers
 */
export declare function createContext(request: FastifyRequest, reply: FastifyReply): Promise<GraphQLContext>;
/**
 * Extract IP address from request
 * Handles proxies and forwarded headers
 */
export declare function getClientIP(request: FastifyRequest): string;
/**
 * Extract user agent from request
 */
export declare function getUserAgent(request: FastifyRequest): string | undefined;
/**
 * Check if request is authenticated
 * (Authentication will be implemented later if needed)
 */
export declare function isAuthenticated(context: GraphQLContext): boolean;
//# sourceMappingURL=context.d.ts.map