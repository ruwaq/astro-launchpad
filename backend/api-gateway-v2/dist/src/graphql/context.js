/**
 * GraphQL Context
 * Created for each request, contains Prisma client and DataLoaders
 */
import { prisma } from '../lib/prisma.js';
import { createLoaders } from './loaders.js';
/**
 * Create GraphQL context for each request
 * This runs once per GraphQL request
 *
 * @param request - Fastify request object
 * @param reply - Fastify reply object
 * @returns Context object passed to all resolvers
 */
export async function createContext(request, reply) {
    // Create context with Prisma client and DataLoaders
    // DataLoaders are created fresh for each request to ensure proper batching
    return {
        prisma,
        request,
        reply,
        app: request.server,
        loaders: createLoaders(prisma),
    };
}
/**
 * Extract IP address from request
 * Handles proxies and forwarded headers
 */
export function getClientIP(request) {
    const forwarded = request.headers['x-forwarded-for'];
    if (forwarded) {
        return Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0];
    }
    return request.ip;
}
/**
 * Extract user agent from request
 */
export function getUserAgent(request) {
    return request.headers['user-agent'];
}
/**
 * Check if request is authenticated
 * (Authentication will be implemented later if needed)
 */
export function isAuthenticated(context) {
    // TODO: Implement authentication check
    // For now, all requests are allowed
    return true;
}
//# sourceMappingURL=context.js.map