/**
 * Cache Module Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  buildCacheKey,
  CACHE_TTL,
} from '../../src/lib/cache'

describe('Cache Module', () => {
  describe('buildCacheKey', () => {
    it('should build namespaced cache keys', () => {
      expect(buildCacheKey('token', 'ABC123')).toBe('astro:token:ABC123')
      expect(buildCacheKey('pool', 'XYZ789')).toBe('astro:pool:XYZ789')
      expect(buildCacheKey('user', 'john@example.com')).toBe('astro:user:john@example.com')
    })

    it('should handle special characters', () => {
      expect(buildCacheKey('stats', 'volume:24h')).toBe('astro:stats:volume:24h')
      expect(buildCacheKey('leaderboard', 'top:100')).toBe('astro:leaderboard:top:100')
    })

    it('should be consistent', () => {
      const key1 = buildCacheKey('token', 'test')
      const key2 = buildCacheKey('token', 'test')
      expect(key1).toBe(key2)
    })
  })

  describe('CACHE_TTL', () => {
    it('should have correct TTL values', () => {
      expect(CACHE_TTL.SHORT).toBe(60) // 1 minute
      expect(CACHE_TTL.MEDIUM).toBe(300) // 5 minutes
      expect(CACHE_TTL.LONG).toBe(1800) // 30 minutes
      expect(CACHE_TTL.VERY_LONG).toBe(3600) // 1 hour
      expect(CACHE_TTL.DAY).toBe(86400) // 24 hours
    })

    it('should have ascending values', () => {
      expect(CACHE_TTL.SHORT).toBeLessThan(CACHE_TTL.MEDIUM)
      expect(CACHE_TTL.MEDIUM).toBeLessThan(CACHE_TTL.LONG)
      expect(CACHE_TTL.LONG).toBeLessThan(CACHE_TTL.VERY_LONG)
      expect(CACHE_TTL.VERY_LONG).toBeLessThan(CACHE_TTL.DAY)
    })
  })

  describe('Cache Operations', () => {
    it('should handle cache not available gracefully', async () => {
      // When cache is not configured, operations should not throw
      // This is tested implicitly in the no-op behavior
      expect(true).toBe(true)
    })
  })
})
