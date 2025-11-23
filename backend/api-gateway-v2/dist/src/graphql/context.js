/**
 * GraphQL Context for Apollo Server
 * Generic HTTP types - no framework dependencies
 */
import { prisma } from '../lib/prisma.js';
import { createLoaders } from './loaders.js';
/**
 * Create GraphQL context for each request
 * This runs once per GraphQL request
 *
 * @param request - HTTP request object
 * @returns Context object passed to all resolvers
 */
export async function createContext(request) {
    // Extract authentication if present
    const user = request ? extractUser(request) : undefined;
    // Create context with Prisma client and DataLoaders
    // DataLoaders are created fresh for each request to ensure proper batching
    return {
        prisma,
        request: request || {},
        loaders: createLoaders(prisma),
        user,
    };
}
/**
 * Extract user information from request
 * Currently returns undefined - implement authentication as needed
 */
function extractUser(request) {
    // TODO: Implement authentication
    // Example:
    // const authHeader = request.headers['authorization'];
    // if (authHeader?.startsWith('Bearer ')) {
    //   const token = authHeader.substring(7);
    //   const decoded = verifyToken(token);
    //   return { address: decoded.address, authenticated: true };
    // }
    return undefined;
}
/**
 * Extract client IP address from request
 * Handles proxies and forwarded headers
 */
export function getClientIP(request) {
    const forwarded = request.headers['x-forwarded-for'];
    if (forwarded) {
        const forwardedStr = Array.isArray(forwarded) ? forwarded[0] : forwarded;
        return forwardedStr.split(',')[0].trim();
    }
    const realIP = request.headers['x-real-ip'];
    if (realIP) {
        return Array.isArray(realIP) ? realIP[0] : realIP;
    }
    return request.socket.remoteAddress || 'unknown';
}
/**
 * Extract user agent from request
 */
export function getUserAgent(request) {
    const ua = request.headers['user-agent'];
    return Array.isArray(ua) ? ua[0] : ua;
}
/**
 * Check if request is authenticated
 */
export function isAuthenticated(context) {
    return context.user?.authenticated ?? false;
}
/**
 * Require authentication - throws error if not authenticated
 */
export function requireAuth(context) {
    if (!isAuthenticated(context)) {
        throw new Error('Authentication required');
    }
}
/**
 * Get user address from context - throws if not authenticated
 */
export function getUserAddress(context) {
    requireAuth(context);
    return context.user.address;
}
//# sourceMappingURL=context.js.map