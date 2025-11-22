/**
 * Prometheus Metrics for Indexer
 * Tracks performance and health of event indexing
 */

import { Registry, Counter, Histogram, Gauge } from 'prom-client'
import { logger } from './logger.js'

/**
 * Prometheus Registry
 */
export const registry = new Registry()

/**
 * Event Metrics
 */

// Events received
export const eventsReceived = new Counter({
  name: 'indexer_events_received_total',
  help: 'Total number of events received from Stellar',
  labelNames: ['contract', 'event_type'],
  registers: [registry],
})

// Events processed successfully
export const eventsProcessed = new Counter({
  name: 'indexer_events_processed_total',
  help: 'Total number of events processed successfully',
  labelNames: ['contract', 'event_type'],
  registers: [registry],
})

// Events failed
export const eventsFailed = new Counter({
  name: 'indexer_events_failed_total',
  help: 'Total number of events that failed processing',
  labelNames: ['contract', 'event_type', 'reason'],
  registers: [registry],
})

// Event processing duration
export const eventProcessingDuration = new Histogram({
  name: 'indexer_event_processing_duration_seconds',
  help: 'Time to process a single event',
  labelNames: ['contract', 'event_type'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  registers: [registry],
})

/**
 * Batch Processing Metrics
 */

// Batch size
export const batchSize = new Histogram({
  name: 'indexer_batch_size',
  help: 'Number of events in each batch',
  labelNames: ['contract'],
  buckets: [1, 5, 10, 25, 50, 100, 250],
  registers: [registry],
})

// Batch processing duration
export const batchProcessingDuration = new Histogram({
  name: 'indexer_batch_processing_duration_seconds',
  help: 'Time to process a batch of events',
  labelNames: ['contract'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
  registers: [registry],
})

// Queue size (current)
export const queueSize = new Gauge({
  name: 'indexer_queue_size',
  help: 'Current number of events in processing queue',
  labelNames: ['contract'],
  registers: [registry],
})

/**
 * Stream Metrics
 */

// Stream status (0 = down, 1 = up)
export const streamStatus = new Gauge({
  name: 'indexer_stream_status',
  help: 'Status of event stream (0 = down, 1 = up)',
  labelNames: ['contract'],
  registers: [registry],
})

// Stream reconnections
export const streamReconnections = new Counter({
  name: 'indexer_stream_reconnections_total',
  help: 'Total number of stream reconnections',
  labelNames: ['contract', 'reason'],
  registers: [registry],
})

// Stream errors
export const streamErrors = new Counter({
  name: 'indexer_stream_errors_total',
  help: 'Total number of stream errors',
  labelNames: ['contract', 'error_type'],
  registers: [registry],
})

/**
 * Database Metrics
 */

// Database writes
export const databaseWrites = new Counter({
  name: 'indexer_database_writes_total',
  help: 'Total number of database write operations',
  labelNames: ['operation', 'model'],
  registers: [registry],
})

// Database write duration
export const databaseWriteDuration = new Histogram({
  name: 'indexer_database_write_duration_seconds',
  help: 'Time to complete database write operation',
  labelNames: ['operation', 'model'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  registers: [registry],
})

// Database errors
export const databaseErrors = new Counter({
  name: 'indexer_database_errors_total',
  help: 'Total number of database errors',
  labelNames: ['operation', 'error_type'],
  registers: [registry],
})

/**
 * State Metrics
 */

// Last indexed ledger
export const lastIndexedLedger = new Gauge({
  name: 'indexer_last_indexed_ledger',
  help: 'Last ledger number indexed',
  labelNames: ['contract'],
  registers: [registry],
})

// Indexing lag (seconds)
export const indexingLag = new Gauge({
  name: 'indexer_lag_seconds',
  help: 'Lag between current time and last processed event',
  labelNames: ['contract'],
  registers: [registry],
})

/**
 * Circuit Breaker Metrics
 */

// Circuit breaker state (0 = closed, 1 = half-open, 2 = open)
export const circuitBreakerState = new Gauge({
  name: 'indexer_circuit_breaker_state',
  help: 'Circuit breaker state (0 = closed, 1 = half-open, 2 = open)',
  labelNames: ['contract'],
  registers: [registry],
})

// Circuit breaker trips
export const circuitBreakerTrips = new Counter({
  name: 'indexer_circuit_breaker_trips_total',
  help: 'Total number of circuit breaker trips',
  labelNames: ['contract'],
  registers: [registry],
})

/**
 * Memory Metrics
 */

// Memory usage
export const memoryUsage = new Gauge({
  name: 'indexer_memory_usage_bytes',
  help: 'Current memory usage in bytes',
  labelNames: ['type'], // 'heap_used', 'heap_total', 'rss'
  registers: [registry],
})

// Collect memory metrics periodically
let memoryMetricsInterval: NodeJS.Timeout | null = null

export function startMemoryMetrics(intervalMs: number = 10000) {
  if (memoryMetricsInterval) return

  memoryMetricsInterval = setInterval(() => {
    const mem = process.memoryUsage()
    memoryUsage.set({ type: 'heap_used' }, mem.heapUsed)
    memoryUsage.set({ type: 'heap_total' }, mem.heapTotal)
    memoryUsage.set({ type: 'rss' }, mem.rss)
  }, intervalMs)
}

export function stopMemoryMetrics() {
  if (memoryMetricsInterval) {
    clearInterval(memoryMetricsInterval)
    memoryMetricsInterval = null
  }
}

/**
 * Helper Functions
 */

export function recordEventReceived(contract: string, eventType: string) {
  eventsReceived.inc({ contract, event_type: eventType })
}

export function recordEventProcessed(contract: string, eventType: string, duration: number) {
  eventsProcessed.inc({ contract, event_type: eventType })
  eventProcessingDuration.observe({ contract, event_type: eventType }, duration)
}

export function recordEventFailed(contract: string, eventType: string, reason: string) {
  eventsFailed.inc({ contract, event_type: eventType, reason })
}

export function recordBatchProcessed(contract: string, size: number, duration: number) {
  batchSize.observe({ contract }, size)
  batchProcessingDuration.observe({ contract }, duration)
}

export function updateQueueSize(contract: string, size: number) {
  queueSize.set({ contract }, size)
}

export function setStreamStatus(contract: string, isUp: boolean) {
  streamStatus.set({ contract }, isUp ? 1 : 0)
}

export function recordStreamReconnection(contract: string, reason: string) {
  streamReconnections.inc({ contract, reason })
}

export function recordStreamError(contract: string, errorType: string) {
  streamErrors.inc({ contract, error_type: errorType })
}

export function recordDatabaseWrite(operation: string, model: string, duration: number) {
  databaseWrites.inc({ operation, model })
  databaseWriteDuration.observe({ operation, model }, duration)
}

export function recordDatabaseError(operation: string, errorType: string) {
  databaseErrors.inc({ operation, error_type: errorType })
}

export function updateLastIndexedLedger(contract: string, ledger: number) {
  lastIndexedLedger.set({ contract }, ledger)
}

export function updateIndexingLag(contract: string, lagSeconds: number) {
  indexingLag.set({ contract }, lagSeconds)
}

export function setCircuitBreakerState(contract: string, state: number) {
  circuitBreakerState.set({ contract }, state)
}

export function recordCircuitBreakerTrip(contract: string) {
  circuitBreakerTrips.inc({ contract })
}

/**
 * Get metrics as text (Prometheus format)
 */
export async function getMetricsText(): Promise<string> {
  return registry.metrics()
}

/**
 * Reset all metrics (useful for testing)
 */
export function resetMetrics() {
  registry.resetMetrics()
  logger.info('All indexer metrics have been reset')
}

logger.info('Indexer Prometheus metrics initialized')
