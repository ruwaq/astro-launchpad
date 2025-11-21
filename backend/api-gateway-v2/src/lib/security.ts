/**
 * Security Utilities
 * Advanced security features for GraphQL API
 */

import type { FastifyRequest } from 'fastify'
import { checkRateLimit } from '../graphql/cache-helpers.js'
import { logger } from './logger.js'
import {
  recordRateLimit,
  recordSecurityEvent,
  recordBlockedRequest,
  recordSuspiciousPattern,
  updateBlockedIPs,
} from './metrics.js'

/**
 * Security configuration
 */
export const SECURITY_CONFIG = {
  // Query limits
  MAX_QUERY_DEPTH: 10,
  MAX_QUERY_COMPLEXITY: 1000,
  MAX_ALIASES: 15,

  // Request limits
  MAX_REQUEST_SIZE: 1024 * 1024, // 1MB
  MAX_BATCH_SIZE: 10,

  // Rate limiting tiers
  RATE_LIMITS: {
    // Anonymous users (by IP)
    ANONYMOUS: {
      requests: 50,
      window: 60, // 1 minute
    },
    // Authenticated users (by API key/token)
    AUTHENTICATED: {
      requests: 200,
      window: 60,
    },
    // Expensive operations
    EXPENSIVE: {
      requests: 10,
      window: 60,
    },
  },

  // IP blocking
  BLOCKED_IPS: new Set<string>([
    // Add malicious IPs here
  ]),

  // Suspicious patterns
  SUSPICIOUS_PATTERNS: [
    /\b(union|select|insert|update|delete|drop|create)\b/i, // SQL injection
    /<script[^>]*>.*?<\/script>/gi, // XSS
    /\.\.\//g, // Path traversal
  ],
} as const

/**
 * Extract client IP from request
 * Handles proxies and load balancers correctly
 */
export function getClientIP(request: FastifyRequest): string {
  // Check X-Forwarded-For (most common)
  const forwardedFor = request.headers['x-forwarded-for']
  if (forwardedFor) {
    const ips = Array.isArray(forwardedFor)
      ? forwardedFor[0]
      : forwardedFor
    return ips.split(',')[0].trim()
  }

  // Check X-Real-IP (nginx)
  const realIP = request.headers['x-real-ip']
  if (realIP) {
    return Array.isArray(realIP) ? realIP[0] : realIP
  }

  // Fallback to request.ip
  return request.ip
}

/**
 * Check if IP is blocked
 */
export function isIPBlocked(ip: string): boolean {
  return SECURITY_CONFIG.BLOCKED_IPS.has(ip)
}

/**
 * Block an IP address
 */
export function blockIP(ip: string, reason: string): void {
  SECURITY_CONFIG.BLOCKED_IPS.add(ip)
  updateBlockedIPs(SECURITY_CONFIG.BLOCKED_IPS.size)
  recordSecurityEvent('ip_blocked', 'high')
  logger.warn({ ip, reason }, 'IP address blocked')
}

/**
 * Check if request contains suspicious patterns
 */
export function hasSuspiciousContent(content: string): boolean {
  return SECURITY_CONFIG.SUSPICIOUS_PATTERNS.some((pattern) =>
    pattern.test(content)
  )
}

/**
 * Validate query string for suspicious content
 */
export function validateQuery(query: string): {
  valid: boolean
  reason?: string
} {
  // Check for suspicious patterns
  if (hasSuspiciousContent(query)) {
    recordSuspiciousPattern('malicious_code')
    recordSecurityEvent('suspicious_query', 'high')
    return {
      valid: false,
      reason: 'Query contains suspicious patterns',
    }
  }

  // Check query length
  if (query.length > SECURITY_CONFIG.MAX_REQUEST_SIZE) {
    recordSecurityEvent('oversized_query', 'medium')
    return {
      valid: false,
      reason: 'Query exceeds maximum size',
    }
  }

  // Check for excessive aliases
  const aliasCount = (query.match(/\w+\s*:/g) || []).length
  if (aliasCount > SECURITY_CONFIG.MAX_ALIASES) {
    recordSuspiciousPattern('alias_abuse')
    recordSecurityEvent('alias_abuse', 'medium')
    return {
      valid: false,
      reason: `Too many aliases (${aliasCount} > ${SECURITY_CONFIG.MAX_ALIASES})`,
    }
  }

  return { valid: true }
}

/**
 * Rate limit check with Redis
 */
export async function checkRateLimitAdvanced(
  request: FastifyRequest,
  tier: keyof typeof SECURITY_CONFIG.RATE_LIMITS = 'ANONYMOUS'
): Promise<{
  allowed: boolean
  remaining: number
  resetAt: number
  reason?: string
}> {
  const ip = getClientIP(request)

  // Check if IP is blocked
  if (isIPBlocked(ip)) {
    recordBlockedRequest('ip_blocked')
    return {
      allowed: false,
      remaining: 0,
      resetAt: Date.now(),
      reason: 'IP address is blocked',
    }
  }

  // Get rate limit config for tier
  const config = SECURITY_CONFIG.RATE_LIMITS[tier]

  // Check rate limit
  const result = await checkRateLimit(
    `${tier.toLowerCase()}:${ip}`,
    config.requests,
    config.window
  )

  // Record rate limit metrics
  const status = result.allowed ? 'allowed' : 'exceeded'
  recordRateLimit(tier, status, ip)

  if (!result.allowed) {
    recordSecurityEvent('rate_limit_exceeded', 'medium')
  }

  return {
    allowed: result.allowed,
    remaining: result.remaining,
    resetAt: result.resetAt,
  }
}

/**
 * Check if operation is expensive
 * Expensive operations have stricter rate limits
 */
export function isExpensiveOperation(operationName?: string): boolean {
  if (!operationName) return false

  const expensiveOps = [
    'leaderboard',
    'globalStats',
    'transactions',
    'searchTokens',
  ]

  return expensiveOps.some((op) =>
    operationName.toLowerCase().includes(op.toLowerCase())
  )
}

/**
 * Security middleware for requests
 */
export async function securityCheck(
  request: FastifyRequest
): Promise<{ allowed: boolean; reason?: string }> {
  const ip = getClientIP(request)

  // 1. Check if IP is blocked
  if (isIPBlocked(ip)) {
    logger.warn({ ip }, 'Blocked IP attempted request')
    recordBlockedRequest('ip_blocked')
    recordSecurityEvent('blocked_ip_attempt', 'high')
    return {
      allowed: false,
      reason: 'Access denied',
    }
  }

  // 2. Check request size
  const contentLength = request.headers['content-length']
  if (contentLength && parseInt(contentLength) > SECURITY_CONFIG.MAX_REQUEST_SIZE) {
    logger.warn({ ip, contentLength }, 'Request exceeds size limit')
    recordBlockedRequest('oversized_request')
    recordSecurityEvent('oversized_request', 'medium')
    return {
      allowed: false,
      reason: 'Request too large',
    }
  }

  // 3. Check for suspicious headers
  const userAgent = request.headers['user-agent']
  if (!userAgent || userAgent.length < 10) {
    logger.warn({ ip, userAgent }, 'Suspicious user agent')
    recordSecurityEvent('suspicious_user_agent', 'low')
    // Don't block, but log for monitoring
  }

  return { allowed: true }
}

/**
 * Log security event
 */
export function logSecurityEvent(
  event: string,
  request: FastifyRequest,
  details?: Record<string, any>
): void {
  const ip = getClientIP(request)
  logger.warn(
    {
      event,
      ip,
      userAgent: request.headers['user-agent'],
      origin: request.headers['origin'],
      ...details,
    },
    'Security event'
  )
}

/**
 * Calculate query complexity score
 * Used for rate limiting expensive queries
 */
export function calculateQueryComplexity(query: string): number {
  let complexity = 0

  // Base complexity
  complexity += 1

  // Add complexity for nested fields
  const depth = (query.match(/{/g) || []).length
  complexity += depth * 2

  // Add complexity for lists
  const lists = (query.match(/\[\w+!\]!/g) || []).length
  complexity += lists * 5

  // Add complexity for connections (pagination)
  if (query.includes('Connection')) {
    complexity += 10
  }

  // Add complexity for aggregations
  if (query.match(/\b(count|sum|avg|min|max)\b/i)) {
    complexity += 20
  }

  return complexity
}

/**
 * Detect potential abuse patterns
 */
export interface AbusePattern {
  type: 'high_frequency' | 'expensive_queries' | 'suspicious_content'
  severity: 'low' | 'medium' | 'high'
  action: 'log' | 'rate_limit' | 'block'
}

export function detectAbuse(
  request: FastifyRequest,
  query?: string
): AbusePattern | null {
  // Check for suspicious query content
  if (query && hasSuspiciousContent(query)) {
    return {
      type: 'suspicious_content',
      severity: 'high',
      action: 'block',
    }
  }

  // Check for extremely complex queries
  if (query && calculateQueryComplexity(query) > SECURITY_CONFIG.MAX_QUERY_COMPLEXITY) {
    return {
      type: 'expensive_queries',
      severity: 'medium',
      action: 'rate_limit',
    }
  }

  return null
}

/**
 * Get security headers for responses
 */
export function getSecurityHeaders(): Record<string, string> {
  return {
    // Prevent MIME type sniffing
    'X-Content-Type-Options': 'nosniff',

    // Enable XSS protection
    'X-XSS-Protection': '1; mode=block',

    // Prevent clickjacking
    'X-Frame-Options': 'DENY',

    // Strict transport security
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',

    // Referrer policy
    'Referrer-Policy': 'strict-origin-when-cross-origin',

    // Permissions policy
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
  }
}

/**
 * Sanitize error messages for production
 * Prevents information leakage
 */
export function sanitizeError(error: Error, isDevelopment: boolean): string {
  if (isDevelopment) {
    return error.message
  }

  // Generic error messages for production
  if (error.message.includes('database')) {
    return 'Database error occurred'
  }

  if (error.message.includes('authentication')) {
    return 'Authentication failed'
  }

  if (error.message.includes('authorization')) {
    return 'Access denied'
  }

  return 'An error occurred processing your request'
}
