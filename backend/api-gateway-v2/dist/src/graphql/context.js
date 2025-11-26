/**
 * GraphQL Context for Apollo Server
 * Generic HTTP types - no framework dependencies
 */
import { prisma } from '../lib/prisma.js';
import { createLoaders } from './loaders.js';
import { StrKey } from '@stellar/stellar-base';
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
 * Supports two authentication methods:
 * 1. Bearer token with Stellar address
 * 2. X-Stellar-Address header (for wallet-based auth)
 */
function extractUser(request) {
    try {
        // Method 1: Bearer token authentication
        const authHeader = request.headers['authorization'];
        if (authHeader?.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            // For now, the token IS the Stellar address (simple auth)
            // In production, use JWT with signature verification
            if (isValidStellarAddress(token)) {
                const isAdmin = checkAdminStatus(token);
                return { address: token, authenticated: true, isAdmin };
            }
        }
        // Method 2: X-Stellar-Address header (wallet-signed requests)
        const stellarAddress = request.headers['x-stellar-address'];
        if (stellarAddress) {
            const address = Array.isArray(stellarAddress) ? stellarAddress[0] : stellarAddress;
            if (isValidStellarAddress(address)) {
                // Optionally verify signature from X-Stellar-Signature header
                const signature = request.headers['x-stellar-signature'];
                if (signature) {
                    // TODO: Verify signature against message (e.g., timestamp + address)
                    // For now, just validate the address format
                }
                const isAdmin = checkAdminStatus(address);
                return { address, authenticated: true, isAdmin };
            }
        }
        return undefined;
    }
    catch (error) {
        // Don't throw on auth failures, just return undefined
        return undefined;
    }
}
/**
 * Validate Stellar contract address format (C...)
 * Uses StrKey.decodeContract which throws if invalid
 */
function isValidContractAddress(address) {
    if (!address || address.length !== 56 || !address.startsWith('C')) {
        return false;
    }
    try {
        StrKey.decodeContract(address);
        return true;
    }
    catch {
        return false;
    }
}
/**
 * Validate Stellar address format
 * Supports both account addresses (G...) and contract addresses (C...)
 */
function isValidStellarAddress(address) {
    if (!address || address.length !== 56) {
        return false;
    }
    try {
        // Check if it's a valid public key (G...) or contract (C...)
        if (address.startsWith('G')) {
            return StrKey.isValidEd25519PublicKey(address);
        }
        else if (address.startsWith('C')) {
            return isValidContractAddress(address);
        }
        return false;
    }
    catch {
        return false;
    }
}
/**
 * Check if address is an admin
 * Admin addresses can be configured via environment variable
 */
function checkAdminStatus(address) {
    const adminAddresses = process.env.ADMIN_ADDRESSES?.split(',').map(a => a.trim()) || [];
    return adminAddresses.includes(address);
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
 * Check if user is admin
 */
export function isAdmin(context) {
    return context.user?.isAdmin ?? false;
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
 * Require admin privileges - throws error if not admin
 */
export function requireAdmin(context) {
    requireAuth(context);
    if (!isAdmin(context)) {
        throw new Error('Admin privileges required');
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