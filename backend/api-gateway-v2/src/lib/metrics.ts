/**
 * Prometheus Metrics
 * Comprehensive metrics collection for monitoring and observability
 */

import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client'
import { logger } from './logger.js'

/**
 * Prometheus Registry
 * Singleton registry for all metrics
 */
export const registry = new Registry()

// Collect default Node.js metrics (CPU, memory, event loop, etc.)
collectDefaultMetrics({
  register: registry,
  prefix: 'astro_',
  gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5],
  eventLoopMonitoringPrecision: 10,
})

/**
 * HTTP Metrics
 */

// HTTP request counter
export const httpRequestsTotal = new Counter({
  name: 'astro_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [registry],
})

// HTTP request duration
export const httpRequestDuration = new Histogram({
  name: 'astro_http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
  registers: [registry],
})

// HTTP request size
export const httpRequestSize = new Histogram({
  name: 'astro_http_request_size_bytes',
  help: 'HTTP request size in bytes',
  labelNames: ['method', 'route'],
  buckets: [100, 1000, 10000, 100000, 1000000],
  registers: [registry],
})

// HTTP response size
export const httpResponseSize = new Histogram({
  name: 'astro_http_response_size_bytes',
  help: 'HTTP response size in bytes',
  labelNames: ['method', 'route'],
  buckets: [100, 1000, 10000, 100000, 1000000],
  registers: [registry],
})

/**
 * GraphQL Metrics
 */

// GraphQL operation counter
export const graphqlOperationsTotal = new Counter({
  name: 'astro_graphql_operations_total',
  help: 'Total number of GraphQL operations',
  labelNames: ['operation_name', 'operation_type', 'status'],
  registers: [registry],
})

// GraphQL operation duration
export const graphqlOperationDuration = new Histogram({
  name: 'astro_graphql_operation_duration_seconds',
  help: 'GraphQL operation duration in seconds',
  labelNames: ['operation_name', 'operation_type'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
  registers: [registry],
})

// GraphQL query depth
export const graphqlQueryDepth = new Histogram({
  name: 'astro_graphql_query_depth',
  help: 'GraphQL query depth',
  labelNames: ['operation_name'],
  buckets: [1, 2, 3, 5, 7, 10, 15],
  registers: [registry],
})

// GraphQL query complexity
export const graphqlQueryComplexity = new Histogram({
  name: 'astro_graphql_query_complexity',
  help: 'GraphQL query complexity score',
  labelNames: ['operation_name'],
  buckets: [1, 10, 50, 100, 500, 1000, 5000],
  registers: [registry],
})

// GraphQL errors
export const graphqlErrorsTotal = new Counter({
  name: 'astro_graphql_errors_total',
  help: 'Total number of GraphQL errors',
  labelNames: ['operation_name', 'error_type'],
  registers: [registry],
})

/**
 * Cache Metrics
 */

// Cache operations counter
export const cacheOperationsTotal = new Counter({
  name: 'astro_cache_operations_total',
  help: 'Total number of cache operations',
  labelNames: ['operation', 'status', 'namespace'],
  registers: [registry],
})

// Cache hit rate
export const cacheHits = new Counter({
  name: 'astro_cache_hits_total',
  help: 'Total number of cache hits',
  labelNames: ['namespace'],
  registers: [registry],
})

export const cacheMisses = new Counter({
  name: 'astro_cache_misses_total',
  help: 'Total number of cache misses',
  labelNames: ['namespace'],
  registers: [registry],
})

// Cache operation duration
export const cacheOperationDuration = new Histogram({
  name: 'astro_cache_operation_duration_seconds',
  help: 'Cache operation duration in seconds',
  labelNames: ['operation', 'namespace'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
  registers: [registry],
})

// Cache size (active keys)
export const cacheSize = new Gauge({
  name: 'astro_cache_size_keys',
  help: 'Number of keys in cache',
  labelNames: ['namespace'],
  registers: [registry],
})

/**
 * Database Metrics
 */

// Database query counter
export const databaseQueriesTotal = new Counter({
  name: 'astro_database_queries_total',
  help: 'Total number of database queries',
  labelNames: ['operation', 'model', 'status'],
  registers: [registry],
})

// Database query duration
export const databaseQueryDuration = new Histogram({
  name: 'astro_database_query_duration_seconds',
  help: 'Database query duration in seconds',
  labelNames: ['operation', 'model'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  registers: [registry],
})

// DataLoader batch size
export const dataLoaderBatchSize = new Histogram({
  name: 'astro_dataloader_batch_size',
  help: 'DataLoader batch size',
  labelNames: ['loader'],
  buckets: [1, 5, 10, 20, 50, 100],
  registers: [registry],
})

// DataLoader cache hits
export const dataLoaderCacheHits = new Counter({
  name: 'astro_dataloader_cache_hits_total',
  help: 'Total number of DataLoader cache hits',
  labelNames: ['loader'],
  registers: [registry],
})

/**
 * Rate Limiting Metrics
 */

// Rate limit counter
export const rateLimitTotal = new Counter({
  name: 'astro_rate_limit_total',
  help: 'Total number of rate limit checks',
  labelNames: ['tier', 'status'],
  registers: [registry],
})

// Rate limit exceeded counter
export const rateLimitExceeded = new Counter({
  name: 'astro_rate_limit_exceeded_total',
  help: 'Total number of rate limit exceeded events',
  labelNames: ['tier', 'ip'],
  registers: [registry],
})

// Current rate limit usage
export const rateLimitUsage = new Gauge({
  name: 'astro_rate_limit_usage',
  help: 'Current rate limit usage',
  labelNames: ['tier', 'ip'],
  registers: [registry],
})

/**
 * Security Metrics
 */

// Security events counter
export const securityEventsTotal = new Counter({
  name: 'astro_security_events_total',
  help: 'Total number of security events',
  labelNames: ['event_type', 'severity'],
  registers: [registry],
})

// Blocked requests counter
export const blockedRequestsTotal = new Counter({
  name: 'astro_blocked_requests_total',
  help: 'Total number of blocked requests',
  labelNames: ['reason'],
  registers: [registry],
})

// Suspicious patterns detected
export const suspiciousPatternsTotal = new Counter({
  name: 'astro_suspicious_patterns_total',
  help: 'Total number of suspicious patterns detected',
  labelNames: ['pattern_type'],
  registers: [registry],
})

// Blocked IPs gauge
export const blockedIPs = new Gauge({
  name: 'astro_blocked_ips',
  help: 'Number of currently blocked IPs',
  registers: [registry],
})

/**
 * Business Metrics
 */

// Tokens created
export const tokensCreated = new Counter({
  name: 'astro_tokens_created_total',
  help: 'Total number of tokens created',
  registers: [registry],
})

// Pools created
export const poolsCreated = new Counter({
  name: 'astro_pools_created_total',
  help: 'Total number of pools created',
  registers: [registry],
})

// Users registered
export const usersRegistered = new Counter({
  name: 'astro_users_registered_total',
  help: 'Total number of users registered',
  registers: [registry],
})

// Transactions processed
export const transactionsProcessed = new Counter({
  name: 'astro_transactions_processed_total',
  help: 'Total number of transactions processed',
  labelNames: ['type'],
  registers: [registry],
})

// Active tokens gauge
export const activeTokens = new Gauge({
  name: 'astro_active_tokens',
  help: 'Number of active tokens',
  registers: [registry],
})

// Active pools gauge
export const activePools = new Gauge({
  name: 'astro_active_pools',
  help: 'Number of active pools',
  registers: [registry],
})

// Active users gauge
export const activeUsers = new Gauge({
  name: 'astro_active_users',
  help: 'Number of active users',
  registers: [registry],
})

/**
 * Helper Functions
 */

/**
 * Record HTTP request metrics
 */
export function recordHttpRequest(
  method: string,
  route: string,
  statusCode: number,
  duration: number,
  requestSize?: number,
  responseSize?: number
) {
  httpRequestsTotal.inc({ method, route, status_code: statusCode })
  httpRequestDuration.observe({ method, route, status_code: statusCode }, duration)

  if (requestSize) {
    httpRequestSize.observe({ method, route }, requestSize)
  }

  if (responseSize) {
    httpResponseSize.observe({ method, route }, responseSize)
  }
}

/**
 * Record GraphQL operation metrics
 */
export function recordGraphQLOperation(
  operationName: string,
  operationType: string,
  status: 'success' | 'error',
  duration: number,
  depth?: number,
  complexity?: number
) {
  graphqlOperationsTotal.inc({ operation_name: operationName, operation_type: operationType, status })
  graphqlOperationDuration.observe({ operation_name: operationName, operation_type: operationType }, duration)

  if (depth) {
    graphqlQueryDepth.observe({ operation_name: operationName }, depth)
  }

  if (complexity) {
    graphqlQueryComplexity.observe({ operation_name: operationName }, complexity)
  }
}

/**
 * Record GraphQL error
 */
export function recordGraphQLError(operationName: string, errorType: string) {
  graphqlErrorsTotal.inc({ operation_name: operationName, error_type: errorType })
}

/**
 * Record cache operation
 */
export function recordCacheOperation(
  operation: 'get' | 'set' | 'del' | 'getOrSet',
  namespace: string,
  status: 'hit' | 'miss' | 'set' | 'deleted' | 'error',
  duration: number
) {
  cacheOperationsTotal.inc({ operation, status, namespace })
  cacheOperationDuration.observe({ operation, namespace }, duration)

  if (status === 'hit') {
    cacheHits.inc({ namespace })
  } else if (status === 'miss') {
    cacheMisses.inc({ namespace })
  }
}

/**
 * Record database query
 */
export function recordDatabaseQuery(
  operation: string,
  model: string,
  status: 'success' | 'error',
  duration: number
) {
  databaseQueriesTotal.inc({ operation, model, status })
  databaseQueryDuration.observe({ operation, model }, duration)
}

/**
 * Record DataLoader batch
 */
export function recordDataLoaderBatch(loader: string, batchSize: number) {
  dataLoaderBatchSize.observe({ loader }, batchSize)
}

/**
 * Record DataLoader cache hit
 */
export function recordDataLoaderCacheHit(loader: string) {
  dataLoaderCacheHits.inc({ loader })
}

/**
 * Record rate limit check
 */
export function recordRateLimit(tier: string, status: 'allowed' | 'exceeded', ip?: string) {
  rateLimitTotal.inc({ tier, status })

  if (status === 'exceeded' && ip) {
    rateLimitExceeded.inc({ tier, ip })
  }
}

/**
 * Update rate limit usage
 */
export function updateRateLimitUsage(tier: string, ip: string, usage: number) {
  rateLimitUsage.set({ tier, ip }, usage)
}

/**
 * Record security event
 */
export function recordSecurityEvent(eventType: string, severity: 'low' | 'medium' | 'high') {
  securityEventsTotal.inc({ event_type: eventType, severity })
}

/**
 * Record blocked request
 */
export function recordBlockedRequest(reason: string) {
  blockedRequestsTotal.inc({ reason })
}

/**
 * Record suspicious pattern
 */
export function recordSuspiciousPattern(patternType: string) {
  suspiciousPatternsTotal.inc({ pattern_type: patternType })
}

/**
 * Update blocked IPs count
 */
export function updateBlockedIPs(count: number) {
  blockedIPs.set(count)
}

/**
 * Get metrics as text (Prometheus format)
 */
export async function getMetricsText(): Promise<string> {
  return registry.metrics()
}

/**
 * Get metrics as JSON
 */
export async function getMetricsJSON(): Promise<any> {
  const metrics = await registry.getMetricsAsJSON()
  return metrics
}

/**
 * Reset all metrics (useful for testing)
 */
export function resetMetrics() {
  registry.resetMetrics()
  logger.info('All metrics have been reset')
}

logger.info('Prometheus metrics initialized')
