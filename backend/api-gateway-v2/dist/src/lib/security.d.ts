/**
 * Security Utilities
 * Advanced security features for GraphQL API
 */
import type { FastifyRequest } from 'fastify';
/**
 * Security configuration
 */
export declare const SECURITY_CONFIG: {
    readonly MAX_QUERY_DEPTH: 10;
    readonly MAX_QUERY_COMPLEXITY: 1000;
    readonly MAX_ALIASES: 15;
    readonly MAX_REQUEST_SIZE: number;
    readonly MAX_BATCH_SIZE: 10;
    readonly RATE_LIMITS: {
        readonly ANONYMOUS: {
            readonly requests: 50;
            readonly window: 60;
        };
        readonly AUTHENTICATED: {
            readonly requests: 200;
            readonly window: 60;
        };
        readonly EXPENSIVE: {
            readonly requests: 10;
            readonly window: 60;
        };
    };
    readonly BLOCKED_IPS: Set<string>;
    readonly SUSPICIOUS_PATTERNS: readonly [RegExp, RegExp, RegExp];
};
/**
 * Extract client IP from request
 * Handles proxies and load balancers correctly
 */
export declare function getClientIP(request: FastifyRequest): string;
/**
 * Check if IP is blocked
 */
export declare function isIPBlocked(ip: string): boolean;
/**
 * Block an IP address
 */
export declare function blockIP(ip: string, reason: string): void;
/**
 * Check if request contains suspicious patterns
 */
export declare function hasSuspiciousContent(content: string): boolean;
/**
 * Validate query string for suspicious content
 */
export declare function validateQuery(query: string): {
    valid: boolean;
    reason?: string;
};
/**
 * Rate limit check with Redis
 */
export declare function checkRateLimitAdvanced(request: FastifyRequest, tier?: keyof typeof SECURITY_CONFIG.RATE_LIMITS): Promise<{
    allowed: boolean;
    remaining: number;
    resetAt: number;
    reason?: string;
}>;
/**
 * Check if operation is expensive
 * Expensive operations have stricter rate limits
 */
export declare function isExpensiveOperation(operationName?: string): boolean;
/**
 * Security middleware for requests
 */
export declare function securityCheck(request: FastifyRequest): Promise<{
    allowed: boolean;
    reason?: string;
}>;
/**
 * Log security event
 */
export declare function logSecurityEvent(event: string, request: FastifyRequest, details?: Record<string, any>): void;
/**
 * Calculate query complexity score
 * Used for rate limiting expensive queries
 */
export declare function calculateQueryComplexity(query: string): number;
/**
 * Detect potential abuse patterns
 */
export interface AbusePattern {
    type: 'high_frequency' | 'expensive_queries' | 'suspicious_content';
    severity: 'low' | 'medium' | 'high';
    action: 'log' | 'rate_limit' | 'block';
}
export declare function detectAbuse(request: FastifyRequest, query?: string): AbusePattern | null;
/**
 * Get security headers for responses
 */
export declare function getSecurityHeaders(): Record<string, string>;
/**
 * Sanitize error messages for production
 * Prevents information leakage
 */
export declare function sanitizeError(error: Error, isDevelopment: boolean): string;
//# sourceMappingURL=security.d.ts.map