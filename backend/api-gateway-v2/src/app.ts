/**
 * Fastify Application Factory
 * Creates and configures the Fastify server with Mercurius GraphQL
 */

import Fastify, { FastifyInstance } from 'fastify'
import mercurius from 'mercurius'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import sensible from '@fastify/sensible'
import { schema } from './graphql/schema.js'
import { resolvers } from './graphql/resolvers/index.js'
import { createContext } from './graphql/context.js'
import { env, isDevelopment } from '@astroshibapop/shared/config'
import {
  recordHttpRequest,
  recordGraphQLOperation,
  recordGraphQLError,
  getMetricsText,
} from './lib/metrics.js'

/**
 * Create Fastify application with all plugins
 */
export async function createApp(): Promise<FastifyInstance> {
  // Create Fastify instance with logger
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
      transport: env.LOG_PRETTY
        ? {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'HH:MM:ss.l',
              ignore: 'pid,hostname',
            },
          }
        : undefined,
    },
    trustProxy: true, // Required for Vercel
    disableRequestLogging: false,
    requestIdLogLabel: 'reqId',
  })

  // Register sensible (useful utilities)
  await app.register(sensible)

  // Register CORS
  await app.register(cors, {
    origin: isDevelopment
      ? true // Allow all origins in development
      : [
          'https://astro-shiba-pop.vercel.app',
          'https://www.astroshibapop.com',
          /\.vercel\.app$/, // Allow all Vercel preview deployments
        ],
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
  })

  // Register Helmet (security headers)
  await app.register(helmet, {
    contentSecurityPolicy: isDevelopment
      ? false // Disable in development for GraphQL Playground
      : {
          directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", 'data:', 'https:'],
            connectSrc: ["'self'", 'https:'],
            fontSrc: ["'self'", 'data:'],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"],
          },
        },
    crossOriginEmbedderPolicy: false, // Required for GraphQL Playground
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    dnsPrefetchControl: { allow: false },
    frameguard: { action: 'deny' },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    ieNoOpen: true,
    noSniff: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    xssFilter: true,
  })

  // Register rate limiting
  // Try to use Redis for distributed rate limiting, fallback to in-memory
  const { getCacheClient, isCacheAvailable } = await import('./lib/cache.js')
  const redisClient = getCacheClient()
  const hasRedis = isCacheAvailable() && redisClient && 'incr' in redisClient

  await app.register(rateLimit, {
    max: isDevelopment ? 1000 : 100, // Higher limit in development
    timeWindow: '1 minute',
    cache: 10000,
    allowList: isDevelopment ? ['127.0.0.1'] : [],
    redis: hasRedis ? redisClient : undefined, // Use Redis if it's a proper Redis client
    addHeaders: {
      'x-ratelimit-limit': true,
      'x-ratelimit-remaining': true,
      'x-ratelimit-reset': true,
    },
  })

  if (hasRedis) {
    app.log.info('Rate limiting using Redis')
  } else {
    app.log.info('Rate limiting using in-memory cache')
  }

  // Metrics middleware - track request start time
  app.addHook('onRequest', async (request, reply) => {
    // Store request start time for duration calculation
    ;(request as any).startTime = process.hrtime.bigint()
  })

  // Security middleware - runs before all routes
  app.addHook('onRequest', async (request, reply) => {
    const { securityCheck, getClientIP, logSecurityEvent } = await import(
      './lib/security.js'
    )

    // Run security checks
    const result = await securityCheck(request)

    if (!result.allowed) {
      logSecurityEvent('request_blocked', request, { reason: result.reason })
      reply.code(403).send({
        error: 'Forbidden',
        message: result.reason || 'Access denied',
      })
      return
    }
  })

  // Metrics middleware - record request metrics after response
  app.addHook('onResponse', async (request, reply) => {
    // Calculate request duration
    const startTime = (request as any).startTime
    if (!startTime) return

    const duration = Number(process.hrtime.bigint() - startTime) / 1e9 // Convert to seconds

    // Get request/response size
    const requestSize = Number(request.headers['content-length']) || 0
    const responseSize = Number(reply.getHeader('content-length')) || 0

    // Record metrics
    recordHttpRequest(
      request.method,
      request.routeOptions?.url || request.url,
      reply.statusCode,
      duration,
      requestSize,
      responseSize
    )
  })

  // GraphQL-specific security middleware
  app.addHook('preValidation', async (request, reply) => {
    // Only for GraphQL requests
    if (!request.url.startsWith('/graphql')) return

    const {
      validateQuery,
      checkRateLimitAdvanced,
      isExpensiveOperation,
      logSecurityEvent,
    } = await import('./lib/security.js')

    // Get query from body
    const body = request.body as any
    const query = body?.query
    const operationName = body?.operationName

    // Validate query
    if (query) {
      const validation = validateQuery(query)
      if (!validation.valid) {
        logSecurityEvent('invalid_query', request, { reason: validation.reason })
        reply.code(400).send({
          error: 'Bad Request',
          message: validation.reason,
        })
        return
      }
    }

    // Rate limit check (stricter for expensive operations)
    const tier = isExpensiveOperation(operationName) ? 'EXPENSIVE' : 'ANONYMOUS'
    const rateLimit = await checkRateLimitAdvanced(request, tier)

    // Add rate limit headers
    reply.header('X-RateLimit-Limit', tier === 'EXPENSIVE' ? '10' : '50')
    reply.header('X-RateLimit-Remaining', rateLimit.remaining.toString())
    reply.header('X-RateLimit-Reset', new Date(rateLimit.resetAt).toISOString())

    if (!rateLimit.allowed) {
      logSecurityEvent('rate_limit_exceeded', request, {
        tier,
        operationName,
      })
      reply.code(429).send({
        error: 'Too Many Requests',
        message: rateLimit.reason || 'Rate limit exceeded',
        retryAfter: Math.ceil((rateLimit.resetAt - Date.now()) / 1000),
      })
      return
    }
  })

  // Register Mercurius (GraphQL)
  await app.register(mercurius, {
    schema,
    resolvers,
    context: createContext,
    graphiql: isDevelopment, // Enable GraphiQL in development only
    ide: false,
    jit: 1, // Enable JIT compilation for better performance
    queryDepth: 10, // Prevent deeply nested queries
    errorFormatter: (execution, context) => {
      // Record GraphQL metrics
      const operationName = (context as any).reply?.request?.body?.operationName || 'unknown'
      const operationType = execution.data ? 'query' : 'mutation'
      const status = execution.errors ? 'error' : 'success'

      // Calculate duration from request start time
      const startTime = (context as any).reply?.request?.startTime
      if (startTime) {
        const duration = Number(process.hrtime.bigint() - startTime) / 1e9
        recordGraphQLOperation(operationName, operationType, status, duration)
      }

      // Log errors with context
      if (execution.errors) {
        execution.errors.forEach((error) => {
          app.log.error(
            {
              error: error.message,
              path: error.path,
              locations: error.locations,
            },
            'GraphQL execution error'
          )

          // Record error metrics
          const errorCode = typeof error.extensions?.code === 'string'
            ? error.extensions.code
            : 'UNKNOWN'
          recordGraphQLError(operationName, errorCode)
        })
      }

      // Return sanitized errors in production
      if (!isDevelopment && execution.errors) {
        return {
          statusCode: 200,
          response: {
            data: execution.data,
            errors: execution.errors.map((error) => ({
              message: 'Internal server error',
              path: error.path,
            })),
          },
        }
      }

      return {
        statusCode: 200,
        response: execution,
      }
    },
  })

  // Health check endpoint (REST)
  app.get('/health', async (request, reply) => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    }
  })

  // Metrics endpoint (Prometheus format)
  app.get('/metrics', async (request, reply) => {
    try {
      const metrics = await getMetricsText()
      reply.header('Content-Type', 'text/plain; version=0.0.4')
      return metrics
    } catch (error) {
      app.log.error(error, 'Failed to get metrics')
      reply.code(500).send({ error: 'Failed to get metrics' })
    }
  })

  // Root endpoint
  app.get('/', async (request, reply) => {
    return {
      name: 'Astro Shiba Pop API Gateway V2',
      version: '0.2.0',
      graphql: '/graphql',
      health: '/health',
      metrics: '/metrics',
    }
  })

  return app
}
