/**
 * Prometheus Metrics
 * Comprehensive metrics collection for monitoring and observability
 */
import { Registry, Counter, Histogram, Gauge } from 'prom-client';
/**
 * Prometheus Registry
 * Singleton registry for all metrics
 */
export declare const registry: Registry<"text/plain; version=0.0.4; charset=utf-8">;
/**
 * HTTP Metrics
 */
export declare const httpRequestsTotal: Counter<"method" | "route" | "status_code">;
export declare const httpRequestDuration: Histogram<"method" | "route" | "status_code">;
export declare const httpRequestSize: Histogram<"method" | "route">;
export declare const httpResponseSize: Histogram<"method" | "route">;
/**
 * GraphQL Metrics
 */
export declare const graphqlOperationsTotal: Counter<"status" | "operation_name" | "operation_type">;
export declare const graphqlOperationDuration: Histogram<"operation_name" | "operation_type">;
export declare const graphqlQueryDepth: Histogram<"operation_name">;
export declare const graphqlQueryComplexity: Histogram<"operation_name">;
export declare const graphqlErrorsTotal: Counter<"operation_name" | "error_type">;
/**
 * Cache Metrics
 */
export declare const cacheOperationsTotal: Counter<"status" | "operation" | "namespace">;
export declare const cacheHits: Counter<"namespace">;
export declare const cacheMisses: Counter<"namespace">;
export declare const cacheOperationDuration: Histogram<"operation" | "namespace">;
export declare const cacheSize: Gauge<"namespace">;
/**
 * Database Metrics
 */
export declare const databaseQueriesTotal: Counter<"status" | "model" | "operation">;
export declare const databaseQueryDuration: Histogram<"model" | "operation">;
export declare const dataLoaderBatchSize: Histogram<"loader">;
export declare const dataLoaderCacheHits: Counter<"loader">;
/**
 * Rate Limiting Metrics
 */
export declare const rateLimitTotal: Counter<"status" | "tier">;
export declare const rateLimitExceeded: Counter<"tier" | "ip">;
export declare const rateLimitUsage: Gauge<"tier" | "ip">;
/**
 * Security Metrics
 */
export declare const securityEventsTotal: Counter<"event_type" | "severity">;
export declare const blockedRequestsTotal: Counter<"reason">;
export declare const suspiciousPatternsTotal: Counter<"pattern_type">;
export declare const blockedIPs: Gauge<string>;
/**
 * Business Metrics
 */
export declare const tokensCreated: Counter<string>;
export declare const poolsCreated: Counter<string>;
export declare const usersRegistered: Counter<string>;
export declare const transactionsProcessed: Counter<"type">;
export declare const activeTokens: Gauge<string>;
export declare const activePools: Gauge<string>;
export declare const activeUsers: Gauge<string>;
/**
 * Helper Functions
 */
/**
 * Record HTTP request metrics
 */
export declare function recordHttpRequest(method: string, route: string, statusCode: number, duration: number, requestSize?: number, responseSize?: number): void;
/**
 * Record GraphQL operation metrics
 */
export declare function recordGraphQLOperation(operationName: string, operationType: string, status: 'success' | 'error', duration: number, depth?: number, complexity?: number): void;
/**
 * Record GraphQL error
 */
export declare function recordGraphQLError(operationName: string, errorType: string): void;
/**
 * Record cache operation
 */
export declare function recordCacheOperation(operation: 'get' | 'set' | 'del' | 'getOrSet', namespace: string, status: 'hit' | 'miss' | 'set' | 'deleted' | 'error', duration: number): void;
/**
 * Record database query
 */
export declare function recordDatabaseQuery(operation: string, model: string, status: 'success' | 'error', duration: number): void;
/**
 * Record DataLoader batch
 */
export declare function recordDataLoaderBatch(loader: string, batchSize: number): void;
/**
 * Record DataLoader cache hit
 */
export declare function recordDataLoaderCacheHit(loader: string): void;
/**
 * Record rate limit check
 */
export declare function recordRateLimit(tier: string, status: 'allowed' | 'exceeded', ip?: string): void;
/**
 * Update rate limit usage
 */
export declare function updateRateLimitUsage(tier: string, ip: string, usage: number): void;
/**
 * Record security event
 */
export declare function recordSecurityEvent(eventType: string, severity: 'low' | 'medium' | 'high'): void;
/**
 * Record blocked request
 */
export declare function recordBlockedRequest(reason: string): void;
/**
 * Record suspicious pattern
 */
export declare function recordSuspiciousPattern(patternType: string): void;
/**
 * Update blocked IPs count
 */
export declare function updateBlockedIPs(count: number): void;
/**
 * Get metrics as text (Prometheus format)
 */
export declare function getMetricsText(): Promise<string>;
/**
 * Get metrics as JSON
 */
export declare function getMetricsJSON(): Promise<any>;
/**
 * Reset all metrics (useful for testing)
 */
export declare function resetMetrics(): void;
//# sourceMappingURL=metrics.d.ts.map