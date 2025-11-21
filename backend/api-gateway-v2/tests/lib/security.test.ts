/**
 * Security Module Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { FastifyRequest } from 'fastify'
import {
  getClientIP,
  isIPBlocked,
  blockIP,
  hasSuspiciousContent,
  validateQuery,
  isExpensiveOperation,
  SECURITY_CONFIG,
} from '../../src/lib/security'

describe('Security Module', () => {
  beforeEach(() => {
    // Clear blocked IPs before each test
    SECURITY_CONFIG.BLOCKED_IPS.clear()
  })

  describe('getClientIP', () => {
    it('should extract IP from X-Forwarded-For header', () => {
      const request = {
        headers: {
          'x-forwarded-for': '192.168.1.1, 10.0.0.1',
        },
        ip: '127.0.0.1',
      } as FastifyRequest

      expect(getClientIP(request)).toBe('192.168.1.1')
    })

    it('should extract IP from X-Real-IP header', () => {
      const request = {
        headers: {
          'x-real-ip': '192.168.1.2',
        },
        ip: '127.0.0.1',
      } as FastifyRequest

      expect(getClientIP(request)).toBe('192.168.1.2')
    })

    it('should fallback to request.ip', () => {
      const request = {
        headers: {},
        ip: '127.0.0.1',
      } as FastifyRequest

      expect(getClientIP(request)).toBe('127.0.0.1')
    })

    it('should handle array X-Forwarded-For', () => {
      const request = {
        headers: {
          'x-forwarded-for': ['192.168.1.3', '10.0.0.2'],
        },
        ip: '127.0.0.1',
      } as FastifyRequest

      expect(getClientIP(request)).toBe('192.168.1.3')
    })
  })

  describe('IP Blocking', () => {
    it('should block an IP address', () => {
      const ip = '192.168.1.100'

      expect(isIPBlocked(ip)).toBe(false)

      blockIP(ip, 'Test block')

      expect(isIPBlocked(ip)).toBe(true)
    })

    it('should check if IP is blocked', () => {
      SECURITY_CONFIG.BLOCKED_IPS.add('10.0.0.50')

      expect(isIPBlocked('10.0.0.50')).toBe(true)
      expect(isIPBlocked('10.0.0.51')).toBe(false)
    })
  })

  describe('hasSuspiciousContent', () => {
    it('should detect SQL injection patterns', () => {
      expect(hasSuspiciousContent("'; DROP TABLE users--")).toBe(true)
      expect(hasSuspiciousContent("SELECT * FROM tokens")).toBe(true)
      expect(hasSuspiciousContent("INSERT INTO pools")).toBe(true)
      expect(hasSuspiciousContent("UPDATE users SET")).toBe(true)
      expect(hasSuspiciousContent("DELETE FROM tokens")).toBe(true)
    })

    it('should detect XSS patterns', () => {
      expect(hasSuspiciousContent("<script>alert('xss')</script>")).toBe(true)
      expect(hasSuspiciousContent("<script src='evil.js'></script>")).toBe(true)
    })

    it('should detect path traversal', () => {
      expect(hasSuspiciousContent("../../etc/passwd")).toBe(true)
      expect(hasSuspiciousContent("../../../secret")).toBe(true)
    })

    it('should not flag normal content', () => {
      expect(hasSuspiciousContent("query { tokens { name } }")).toBe(false)
      expect(hasSuspiciousContent("Buy token XYZ")).toBe(false)
      expect(hasSuspiciousContent("User created successfully")).toBe(false)
    })
  })

  describe('validateQuery', () => {
    it('should accept valid queries', () => {
      const query = `
        query {
          tokens(limit: 10) {
            edges {
              name
              symbol
            }
          }
        }
      `

      const result = validateQuery(query)
      expect(result.valid).toBe(true)
      expect(result.reason).toBeUndefined()
    })

    it('should reject queries with suspicious content', () => {
      const query = "query { token(address: \"'; DROP TABLE tokens--\") { name } }"

      const result = validateQuery(query)
      expect(result.valid).toBe(false)
      expect(result.reason).toContain('suspicious patterns')
    })

    it('should reject queries exceeding size limit', () => {
      const query = 'a'.repeat(SECURITY_CONFIG.MAX_REQUEST_SIZE + 1)

      const result = validateQuery(query)
      expect(result.valid).toBe(false)
      expect(result.reason).toContain('exceeds maximum size')
    })

    it('should reject queries with too many aliases', () => {
      const aliases = Array.from({ length: SECURITY_CONFIG.MAX_ALIASES + 1 }, (_, i) =>
        `t${i}: token { name }`
      ).join('\n')
      const query = `query { ${aliases} }`

      const result = validateQuery(query)
      expect(result.valid).toBe(false)
      expect(result.reason).toContain('Too many aliases')
    })

    it('should count aliases correctly', () => {
      const query = `
        query {
          t1: token(address: "A") { name }
          t2: token(address: "B") { name }
          t3: token(address: "C") { name }
        }
      `

      const result = validateQuery(query)
      expect(result.valid).toBe(true) // 3 aliases is under limit
    })
  })

  describe('isExpensiveOperation', () => {
    it('should identify expensive operations', () => {
      expect(isExpensiveOperation('leaderboard')).toBe(true)
      expect(isExpensiveOperation('globalStats')).toBe(true)
      expect(isExpensiveOperation('transactions')).toBe(true)
      expect(isExpensiveOperation('searchTokens')).toBe(true)
      expect(isExpensiveOperation('GetLeaderboard')).toBe(true) // Case insensitive
      expect(isExpensiveOperation('fetchGlobalStats')).toBe(true)
    })

    it('should not flag normal operations', () => {
      expect(isExpensiveOperation('token')).toBe(false)
      expect(isExpensiveOperation('tokens')).toBe(false)
      expect(isExpensiveOperation('user')).toBe(false)
      expect(isExpensiveOperation('pool')).toBe(false)
      expect(isExpensiveOperation(undefined)).toBe(false)
    })
  })

  describe('Security Configuration', () => {
    it('should have correct default values', () => {
      expect(SECURITY_CONFIG.MAX_QUERY_DEPTH).toBe(10)
      expect(SECURITY_CONFIG.MAX_QUERY_COMPLEXITY).toBe(1000)
      expect(SECURITY_CONFIG.MAX_ALIASES).toBe(15)
      expect(SECURITY_CONFIG.MAX_REQUEST_SIZE).toBe(1024 * 1024) // 1MB
      expect(SECURITY_CONFIG.MAX_BATCH_SIZE).toBe(10)
    })

    it('should have rate limit tiers', () => {
      expect(SECURITY_CONFIG.RATE_LIMITS.ANONYMOUS).toEqual({
        requests: 50,
        window: 60,
      })
      expect(SECURITY_CONFIG.RATE_LIMITS.AUTHENTICATED).toEqual({
        requests: 200,
        window: 60,
      })
      expect(SECURITY_CONFIG.RATE_LIMITS.EXPENSIVE).toEqual({
        requests: 10,
        window: 60,
      })
    })

    it('should have suspicious patterns defined', () => {
      expect(SECURITY_CONFIG.SUSPICIOUS_PATTERNS).toHaveLength(3)
      expect(SECURITY_CONFIG.SUSPICIOUS_PATTERNS[0].test('SELECT * FROM users')).toBe(true)
      expect(SECURITY_CONFIG.SUSPICIOUS_PATTERNS[1].test('<script>alert(1)</script>')).toBe(true)
      expect(SECURITY_CONFIG.SUSPICIOUS_PATTERNS[2].test('../../etc/passwd')).toBe(true)
    })
  })
})
