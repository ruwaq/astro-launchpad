/**
 * GraphQL Context for Apollo Server
 * Generic HTTP types - no framework dependencies
 */
import { prisma } from '../lib/prisma.js';
import { createLoaders } from './loaders.js';
import { StrKey, Keypair } from '@stellar/stellar-base';
import { checkAndUseNonce } from '../lib/nonce-store.js';
// Configuration for signature verification
// SECURITY: Reduced from 5 minutes to 30 seconds to minimize replay attack window
const SIGNATURE_MAX_AGE_MS = 30 * 1000; // 30 seconds - production-secure
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
        // Method 1: X-Stellar-Address header with signature verification
        // SECURITY: Always requires signature to prevent spoofing
        const stellarAddress = request.headers['x-stellar-address'];
        if (stellarAddress) {
            const address = Array.isArray(stellarAddress) ? stellarAddress[0] : stellarAddress;
            if (isValidStellarAddress(address)) {
                const signature = request.headers['x-stellar-signature'];
                const timestamp = request.headers['x-stellar-timestamp'];
                // SECURITY: Signature is REQUIRED for authentication
                if (signature && timestamp) {
                    const signatureStr = Array.isArray(signature) ? signature[0] : signature;
                    const timestampStr = Array.isArray(timestamp) ? timestamp[0] : timestamp;
                    // SECURITY: Nonce is required to prevent replay attacks
                    const nonce = request.headers['x-stellar-nonce'];
                    const nonceStr = nonce ? (Array.isArray(nonce) ? nonce[0] : nonce) : undefined;
                    const verificationResult = verifyStellarSignature(address, signatureStr, timestampStr, nonceStr);
                    if (verificationResult.valid) {
                        const isAdmin = checkAdminStatus(address);
                        return { address, authenticated: true, isAdmin };
                    }
                    // Invalid signature - log and reject completely
                    console.warn(`[Auth] Invalid signature for address ${address}: ${verificationResult.error}`);
                    return undefined;
                }
                // SECURITY: No signature provided - reject authentication entirely
                // User must sign to prove ownership of address
                // This prevents address spoofing attacks
                return undefined;
            }
        }
        // Method 2: Bearer token (legacy - for read-only access indication only)
        // SECURITY: NOT AUTHENTICATED - only used for UX hints, not for actual auth
        const authHeader = request.headers['authorization'];
        if (authHeader?.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            // WARNING: This does NOT prove ownership - only for UI display
            // Mutations MUST check requireAuth() which will fail without signature
            if (isValidStellarAddress(token)) {
                return { address: token, authenticated: false, isAdmin: false };
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
 * Verify Stellar signature for authentication
 * The message format is: "stellar:auth:{address}:{timestamp}:{nonce}"
 *
 * SECURITY: Nonce is REQUIRED to prevent replay attacks within the 30-second window.
 * Without nonce, an attacker could capture a valid signature and replay it.
 *
 * @param address - The claimed Stellar address (G...)
 * @param signature - Base64-encoded Ed25519 signature
 * @param timestamp - Unix timestamp in milliseconds as string
 * @param nonce - Unique random string (8-64 chars) - REQUIRED for production
 * @returns Verification result with valid flag and optional error
 */
function verifyStellarSignature(address, signature, timestamp, nonce) {
    try {
        // 1. Validate timestamp is recent (prevent replay attacks)
        const timestampMs = parseInt(timestamp, 10);
        if (isNaN(timestampMs)) {
            return { valid: false, error: 'Invalid timestamp format' };
        }
        const now = Date.now();
        const age = now - timestampMs;
        if (age < 0) {
            return { valid: false, error: 'Timestamp is in the future' };
        }
        if (age > SIGNATURE_MAX_AGE_MS) {
            return { valid: false, error: `Signature expired (age: ${Math.round(age / 1000)}s)` };
        }
        // 2. SECURITY: Validate nonce to prevent replay attacks
        // In production, nonce is REQUIRED. In development, we allow without nonce for testing.
        const isProduction = process.env.NODE_ENV === 'production';
        if (nonce) {
            // Check and mark nonce as used (atomic operation)
            const nonceResult = checkAndUseNonce(nonce);
            if (!nonceResult.valid) {
                return { valid: false, error: nonceResult.error };
            }
        }
        else if (isProduction) {
            // SECURITY: In production, nonce is mandatory
            return { valid: false, error: 'Missing X-Stellar-Nonce header (required for authentication)' };
        }
        else {
            // Development: warn but allow
            console.warn('[Auth] Missing nonce in signature verification - this would fail in production');
        }
        // 3. Construct the message that was signed
        // Format WITH nonce: "stellar:auth:{address}:{timestamp}:{nonce}"
        // Format WITHOUT nonce (dev only): "stellar:auth:{address}:{timestamp}"
        const message = nonce
            ? `stellar:auth:${address}:${timestamp}:${nonce}`
            : `stellar:auth:${address}:${timestamp}`;
        const messageBuffer = Buffer.from(message, 'utf8');
        // 4. Decode the signature from base64
        let signatureBuffer;
        try {
            signatureBuffer = Buffer.from(signature, 'base64');
        }
        catch {
            return { valid: false, error: 'Invalid signature encoding (expected base64)' };
        }
        // Ed25519 signatures are 64 bytes
        if (signatureBuffer.length !== 64) {
            return { valid: false, error: `Invalid signature length: ${signatureBuffer.length} (expected 64)` };
        }
        // 5. Get the public key from the address and verify
        // Stellar G... addresses encode Ed25519 public keys
        if (!address.startsWith('G')) {
            return { valid: false, error: 'Only G... addresses support signature verification' };
        }
        const keypair = Keypair.fromPublicKey(address);
        const isValid = keypair.verify(messageBuffer, signatureBuffer);
        if (!isValid) {
            return { valid: false, error: 'Signature verification failed' };
        }
        return { valid: true };
    }
    catch (error) {
        return { valid: false, error: `Verification error: ${error.message}` };
    }
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
/**
 * Validate admin API key from X-Admin-Key header
 * Uses timing-safe comparison to prevent timing attacks
 *
 * SECURITY: Admin key must be sent via header, NOT in GraphQL arguments
 * This prevents the key from being logged or visible in browser DevTools
 *
 * @param context - GraphQL context with request headers
 * @returns Object with valid flag and optional error message
 */
export function validateAdminKeyFromHeader(context) {
    const ADMIN_KEY = process.env.ADMIN_API_KEY;
    const isProduction = process.env.NODE_ENV === 'production';
    if (!ADMIN_KEY) {
        // In production, this is a critical security issue
        if (isProduction) {
            console.error('[CRITICAL SECURITY] ADMIN_API_KEY environment variable not configured in production');
        }
        else {
            console.warn('[Security] ADMIN_API_KEY not configured - admin operations disabled');
        }
        return { valid: false, error: 'Admin API key not configured on server' };
    }
    // SECURITY: Runtime validation of key length (defense in depth)
    if (ADMIN_KEY.length < 32) {
        console.error('[CRITICAL SECURITY] ADMIN_API_KEY is too short - must be at least 32 characters');
        return { valid: false, error: 'Admin API key configuration error' };
    }
    // Extract admin key from X-Admin-Key header
    const headerKey = context.request?.headers?.['x-admin-key'];
    if (!headerKey) {
        return { valid: false, error: 'Missing X-Admin-Key header' };
    }
    const adminKeyStr = Array.isArray(headerKey) ? headerKey[0] : headerKey;
    // Validate key length matches before comparison (prevents timing leaks on length)
    if (adminKeyStr.length !== ADMIN_KEY.length) {
        return { valid: false, error: 'Invalid admin key' };
    }
    // Timing-safe comparison to prevent timing attacks
    try {
        const crypto = require('crypto');
        const isValid = crypto.timingSafeEqual(Buffer.from(ADMIN_KEY, 'utf8'), Buffer.from(adminKeyStr, 'utf8'));
        if (!isValid) {
            return { valid: false, error: 'Invalid admin key' };
        }
        return { valid: true, adminKey: adminKeyStr };
    }
    catch (error) {
        // Handle buffer length mismatch (shouldn't happen due to length check above)
        return { valid: false, error: 'Invalid admin key' };
    }
}
/**
 * Require valid admin API key from X-Admin-Key header
 * Throws an error if the key is missing or invalid
 *
 * @param context - GraphQL context with request headers
 * @throws Error if admin key is invalid
 */
export function requireAdminApiKey(context) {
    const result = validateAdminKeyFromHeader(context);
    if (!result.valid) {
        throw new Error(`Unauthorized: ${result.error}`);
    }
}
//# sourceMappingURL=context.js.map