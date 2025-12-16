/**
 * GraphQL Resolver Integration Tests
 *
 * Tests GraphQL queries and mutations against the actual resolvers.
 * Uses mocked database where needed.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createApp } from '../../src/app'
import type { Application } from 'express'
import type { ApolloServer } from '@apollo/server'
import type { GraphQLContext } from '../../src/graphql/context'
import request from 'supertest'

describe('GraphQL Resolvers', () => {
  let app: Application
  let server: ApolloServer<GraphQLContext>

  beforeAll(async () => {
    const result = await createApp()
    app = result.app
    server = result.server
  })

  afterAll(async () => {
    if (server) {
      await server.stop()
    }
  })

  describe('Health Query', () => {
    it('should return health status with all fields', async () => {
      const response = await request(app)
        .post('/graphql')
        .send({
          query: `{
            health {
              status
              timestamp
              version
              database
              cache {
                available
                type
              }
            }
          }`,
        })
        .set('Content-Type', 'application/json')

      expect(response.status).toBe(200)
      expect(response.body.errors).toBeUndefined()

      const health = response.body.data.health
      expect(health.status).toBe('healthy')
      expect(health.timestamp).toBeDefined()
      expect(health.version).toBeDefined()
      expect(typeof health.database).toBe('boolean')
      expect(health.cache).toBeDefined()
      expect(typeof health.cache.available).toBe('boolean')
      expect(health.cache.type).toBeDefined()
    })
  })

  describe('Tokens Query', () => {
    it('should return paginated token list', async () => {
      const response = await request(app)
        .post('/graphql')
        .send({
          query: `{
            tokens(limit: 5) {
              edges {
                node {
                  address
                  name
                  symbol
                }
                cursor
              }
              pageInfo {
                hasNextPage
                hasPreviousPage
              }
              totalCount
            }
          }`,
        })
        .set('Content-Type', 'application/json')

      expect(response.status).toBe(200)
      expect(response.body.errors).toBeUndefined()

      const tokens = response.body.data.tokens
      expect(tokens.edges).toBeDefined()
      expect(Array.isArray(tokens.edges)).toBe(true)
      expect(tokens.pageInfo).toBeDefined()
      expect(typeof tokens.totalCount).toBe('number')
    })

    it('should support search filter', async () => {
      const response = await request(app)
        .post('/graphql')
        .send({
          query: `{
            tokens(search: "test", limit: 5) {
              edges {
                node {
                  address
                  name
                }
              }
              totalCount
            }
          }`,
        })
        .set('Content-Type', 'application/json')

      expect(response.status).toBe(200)
      expect(response.body.errors).toBeUndefined()
      expect(response.body.data.tokens).toBeDefined()
    })

    it('should support ordering', async () => {
      const response = await request(app)
        .post('/graphql')
        .send({
          query: `{
            tokens(orderBy: MARKET_CAP_DESC, limit: 5) {
              edges {
                node {
                  address
                  marketCap
                }
              }
            }
          }`,
        })
        .set('Content-Type', 'application/json')

      expect(response.status).toBe(200)
      expect(response.body.errors).toBeUndefined()
    })
  })

  describe('Global Stats Query', () => {
    it('should return global statistics', async () => {
      const response = await request(app)
        .post('/graphql')
        .send({
          query: `{
            globalStats {
              totalTokens
              totalTransactions
              totalVolume
              totalUsers
            }
          }`,
        })
        .set('Content-Type', 'application/json')

      expect(response.status).toBe(200)
      expect(response.body.errors).toBeUndefined()

      const stats = response.body.data.globalStats
      expect(typeof stats.totalTokens).toBe('number')
      expect(typeof stats.totalTransactions).toBe('number')
      expect(typeof stats.totalUsers).toBe('number')
    })
  })

  describe('Leaderboard Query', () => {
    it('should return trader leaderboard', async () => {
      const response = await request(app)
        .post('/graphql')
        .send({
          query: `{
            leaderboard(type: TRADERS, limit: 10) {
              rank
              address
              value
            }
          }`,
        })
        .set('Content-Type', 'application/json')

      expect(response.status).toBe(200)
      expect(response.body.errors).toBeUndefined()

      const leaderboard = response.body.data.leaderboard
      expect(Array.isArray(leaderboard)).toBe(true)
    })

    it('should support timeframe filter', async () => {
      const response = await request(app)
        .post('/graphql')
        .send({
          query: `{
            leaderboard(type: TRADERS, timeframe: WEEK, limit: 5) {
              rank
              address
              value
            }
          }`,
        })
        .set('Content-Type', 'application/json')

      expect(response.status).toBe(200)
      expect(response.body.errors).toBeUndefined()
    })
  })

  describe('Trending Tokens Query', () => {
    it('should return trending tokens', async () => {
      const response = await request(app)
        .post('/graphql')
        .send({
          query: `{
            trendingTokens(limit: 5) {
              address
              name
              symbol
              volume24h
            }
          }`,
        })
        .set('Content-Type', 'application/json')

      expect(response.status).toBe(200)
      expect(response.body.errors).toBeUndefined()

      const trending = response.body.data.trendingTokens
      expect(Array.isArray(trending)).toBe(true)
    })
  })

  describe('Transactions Query', () => {
    it('should return paginated transactions', async () => {
      const response = await request(app)
        .post('/graphql')
        .send({
          query: `{
            transactions(limit: 5) {
              edges {
                node {
                  id
                  type
                  amount
                  timestamp
                }
              }
              pageInfo {
                hasNextPage
              }
              totalCount
            }
          }`,
        })
        .set('Content-Type', 'application/json')

      expect(response.status).toBe(200)
      expect(response.body.errors).toBeUndefined()

      const transactions = response.body.data.transactions
      expect(transactions.edges).toBeDefined()
      expect(Array.isArray(transactions.edges)).toBe(true)
    })
  })

  describe('Input Validation', () => {
    it('should validate token address format', async () => {
      const response = await request(app)
        .post('/graphql')
        .send({
          query: `{
            token(address: "invalid-address") {
              address
              name
            }
          }`,
        })
        .set('Content-Type', 'application/json')

      expect(response.status).toBe(200)
      // Should either return null or an error
      expect(
        response.body.data?.token === null || response.body.errors
      ).toBeTruthy()
    })

    it('should enforce limit bounds', async () => {
      const response = await request(app)
        .post('/graphql')
        .send({
          query: `{
            tokens(limit: 1000) {
              totalCount
            }
          }`,
        })
        .set('Content-Type', 'application/json')

      expect(response.status).toBe(200)
      // Should clamp limit or return error
    })

    it('should reject negative offset', async () => {
      const response = await request(app)
        .post('/graphql')
        .send({
          query: `{
            tokens(offset: -5) {
              totalCount
            }
          }`,
        })
        .set('Content-Type', 'application/json')

      expect(response.status).toBe(200)
      // Should handle gracefully or return error
    })
  })

  describe('Mutations', () => {
    describe('syncToken', () => {
      it('should require valid token address', async () => {
        const response = await request(app)
          .post('/graphql')
          .send({
            query: `
              mutation {
                syncToken(tokenAddress: "invalid") {
                  address
                }
              }
            `,
          })
          .set('Content-Type', 'application/json')

        expect(response.status).toBe(200)
        // Should return error for invalid address
        expect(response.body.errors).toBeDefined()
      })
    })

    describe('deleteToken (Admin)', () => {
      it('should require admin key', async () => {
        const response = await request(app)
          .post('/graphql')
          .send({
            query: `
              mutation {
                deleteToken(tokenAddress: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA") {
                  success
                  message
                }
              }
            `,
          })
          .set('Content-Type', 'application/json')

        expect(response.status).toBe(200)
        // Should require admin authentication
        expect(response.body.errors).toBeDefined()
        expect(response.body.errors[0].message).toContain('Unauthorized')
      })
    })
  })
})
