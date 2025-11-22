/**
 * Application Integration Tests
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createApp } from '../src/app'
import type { FastifyInstance } from 'fastify'

describe('API Gateway Application', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = await createApp()
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  describe('Health Endpoints', () => {
    it('GET / should return API info', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/',
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.name).toBe('Astro Shiba Pop API Gateway V2')
      expect(body.version).toBeDefined()
      expect(body.graphql).toBe('/graphql')
      expect(body.health).toBe('/health')
      expect(body.metrics).toBe('/metrics')
    })

    it('GET /health should return health status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.status).toBe('ok')
      expect(body.timestamp).toBeDefined()
      expect(body.uptime).toBeGreaterThan(0)
    })

    it('GET /metrics should return Prometheus metrics', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/metrics',
      })

      expect(response.statusCode).toBe(200)
      expect(response.headers['content-type']).toContain('text/plain')
      expect(response.body).toContain('# HELP')
      expect(response.body).toContain('# TYPE')
      expect(response.body).toContain('astro_')
    })
  })

  describe('GraphQL Endpoint', () => {
    it('POST /graphql should accept queries', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/graphql',
        headers: {
          'content-type': 'application/json',
        },
        payload: {
          query: '{ health { status } }',
        },
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.data).toBeDefined()
      expect(body.data.health).toBeDefined()
    })

    it('should reject invalid GraphQL queries', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/graphql',
        headers: {
          'content-type': 'application/json',
        },
        payload: {
          query: 'invalid query syntax {{{',
        },
      })

      expect(response.statusCode).toBe(400)
    })

    it('should reject queries with suspicious content', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/graphql',
        headers: {
          'content-type': 'application/json',
        },
        payload: {
          query: `query { token(address: "'; DROP TABLE tokens--") { name } }`,
        },
      })

      expect(response.statusCode).toBe(400)
      const body = JSON.parse(response.body)
      expect(body.message).toContain('suspicious patterns')
    })

    it('should reject queries with too many aliases', async () => {
      const aliases = Array.from({ length: 20 }, (_, i) =>
        `t${i}: health { status }`
      ).join('\n')
      const query = `query { ${aliases} }`

      const response = await app.inject({
        method: 'POST',
        url: '/graphql',
        headers: {
          'content-type': 'application/json',
        },
        payload: { query },
      })

      expect(response.statusCode).toBe(400)
      const body = JSON.parse(response.body)
      expect(body.message).toContain('aliases')
    })
  })

  describe('CORS', () => {
    it('should handle CORS preflight requests', async () => {
      const response = await app.inject({
        method: 'OPTIONS',
        url: '/graphql',
        headers: {
          origin: 'http://localhost:3000',
          'access-control-request-method': 'POST',
        },
      })

      expect(response.statusCode).toBe(204)
      expect(response.headers['access-control-allow-methods']).toContain('POST')
    })

    it('should allow requests from allowed origins', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/graphql',
        headers: {
          origin: 'http://localhost:3000',
          'content-type': 'application/json',
        },
        payload: {
          query: '{ health { status } }',
        },
      })

      expect(response.headers['access-control-allow-origin']).toBeDefined()
    })
  })

  describe('Security Headers', () => {
    it('should include security headers', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
      })

      // Helmet headers
      expect(response.headers['x-content-type-options']).toBe('nosniff')
      expect(response.headers['x-frame-options']).toBe('DENY')
      expect(response.headers['x-xss-protection']).toBeDefined()
    })
  })

  describe('Rate Limiting', () => {
    it('should include rate limit headers', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/graphql',
        headers: {
          'content-type': 'application/json',
        },
        payload: {
          query: '{ health { status } }',
        },
      })

      expect(response.headers['x-ratelimit-limit']).toBeDefined()
      expect(response.headers['x-ratelimit-remaining']).toBeDefined()
      expect(response.headers['x-ratelimit-reset']).toBeDefined()
    })

    it('should enforce rate limits for expensive operations', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/graphql',
        headers: {
          'content-type': 'application/json',
        },
        payload: {
          query: '{ globalStats { totalTokens } }',
          operationName: 'globalStats',
        },
      })

      // Should have stricter rate limit for expensive operations
      expect(response.headers['x-ratelimit-limit']).toBe('10')
    })
  })

  describe('Error Handling', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/unknown-route',
      })

      expect(response.statusCode).toBe(404)
    })

    it('should handle malformed JSON gracefully', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/graphql',
        headers: {
          'content-type': 'application/json',
        },
        payload: 'invalid json {{{',
      })

      expect(response.statusCode).toBe(400)
    })

    it('should handle oversized requests', async () => {
      const largePayload = {
        query: 'a'.repeat(2 * 1024 * 1024), // 2MB
      }

      const response = await app.inject({
        method: 'POST',
        url: '/graphql',
        headers: {
          'content-type': 'application/json',
          'content-length': JSON.stringify(largePayload).length.toString(),
        },
        payload: largePayload,
      })

      expect(response.statusCode).toBe(403)
    })
  })

  describe('Metrics', () => {
    it('should record HTTP request metrics', async () => {
      // Make a request
      await app.inject({
        method: 'GET',
        url: '/health',
      })

      // Check metrics
      const metricsResponse = await app.inject({
        method: 'GET',
        url: '/metrics',
      })

      expect(metricsResponse.body).toContain('astro_http_requests_total')
      expect(metricsResponse.body).toContain('astro_http_request_duration_seconds')
    })

    it('should record GraphQL operation metrics', async () => {
      // Make a GraphQL request
      await app.inject({
        method: 'POST',
        url: '/graphql',
        headers: {
          'content-type': 'application/json',
        },
        payload: {
          query: '{ health { status } }',
        },
      })

      // Check metrics
      const metricsResponse = await app.inject({
        method: 'GET',
        url: '/metrics',
      })

      expect(metricsResponse.body).toContain('astro_graphql_operations_total')
    })
  })
})
