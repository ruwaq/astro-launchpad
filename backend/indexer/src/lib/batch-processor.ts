/**
 * Batch Processor
 * Queues events and processes them in batches for efficiency
 */

import { PrismaClient } from '@prisma/client'
import PQueue from 'p-queue'
import { logger } from './logger.js'
import {
  recordEventProcessed,
  recordEventFailed,
  recordBatchProcessed,
  updateQueueSize,
  recordDatabaseWrite,
  recordDatabaseError,
} from './metrics.js'

export interface BatchEvent {
  id: string
  ledger: string
  contract: string
  eventType: string
  data: any
  timestamp: Date
}

export interface BatchProcessorConfig {
  // Maximum events in a single batch
  maxBatchSize: number
  // Maximum time to wait before processing batch (ms)
  maxBatchWaitMs: number
  // Maximum concurrent batches being processed
  maxConcurrency: number
  // Maximum queue size (backpressure)
  maxQueueSize: number
  // Enable automatic retry on batch failure
  retryEnabled: boolean
  // Maximum retry attempts
  maxRetries: number
}

export const DEFAULT_BATCH_CONFIG: BatchProcessorConfig = {
  maxBatchSize: 100,
  maxBatchWaitMs: 5000, // 5 seconds
  maxConcurrency: 3,
  maxQueueSize: 10000,
  retryEnabled: true,
  maxRetries: 3,
}

export class BatchProcessor {
  private queue: PQueue
  private eventBuffer: Map<string, BatchEvent[]> = new Map()
  private flushTimers: Map<string, NodeJS.Timeout> = new Map()
  private totalQueued: number = 0
  private isShuttingDown: boolean = false

  constructor(
    private prisma: PrismaClient,
    private config: BatchProcessorConfig = DEFAULT_BATCH_CONFIG
  ) {
    this.queue = new PQueue({
      concurrency: config.maxConcurrency,
      autoStart: true,
    })

    // Monitor queue size
    this.queue.on('active', () => {
      logger.debug(`Processing batch. Queue size: ${this.queue.size}`)
    })

    this.queue.on('idle', () => {
      logger.debug('Queue is idle')
    })
  }

  /**
   * Add event to processing queue
   * Returns false if queue is full (backpressure)
   */
  async addEvent(event: BatchEvent): Promise<boolean> {
    if (this.isShuttingDown) {
      logger.warn('Cannot add event: processor is shutting down')
      return false
    }

    // Check backpressure
    if (this.totalQueued >= this.config.maxQueueSize) {
      logger.warn(`Queue full (${this.totalQueued}/${this.config.maxQueueSize}). Applying backpressure.`)
      return false
    }

    // Add to buffer for this contract
    const key = event.contract
    if (!this.eventBuffer.has(key)) {
      this.eventBuffer.set(key, [])
    }

    const buffer = this.eventBuffer.get(key)!
    buffer.push(event)
    this.totalQueued++

    // Update metrics
    updateQueueSize(event.contract, this.totalQueued)

    // Check if we should flush this batch
    if (buffer.length >= this.config.maxBatchSize) {
      await this.flushBatch(key)
    } else {
      // Schedule flush if not already scheduled
      this.scheduleBatchFlush(key)
    }

    return true
  }

  /**
   * Schedule batch flush after maxBatchWaitMs
   */
  private scheduleBatchFlush(contract: string) {
    // Cancel existing timer if any
    const existingTimer = this.flushTimers.get(contract)
    if (existingTimer) {
      return // Already scheduled
    }

    const timer = setTimeout(() => {
      this.flushBatch(contract).catch((error) => {
        logger.error(`Error flushing batch for ${contract}:`, error)
      })
    }, this.config.maxBatchWaitMs)

    this.flushTimers.set(contract, timer)
  }

  /**
   * Flush batch for a specific contract
   */
  private async flushBatch(contract: string) {
    // Clear flush timer
    const timer = this.flushTimers.get(contract)
    if (timer) {
      clearTimeout(timer)
      this.flushTimers.delete(contract)
    }

    // Get events from buffer
    const buffer = this.eventBuffer.get(contract)
    if (!buffer || buffer.length === 0) {
      return
    }

    // Take up to maxBatchSize events
    const batch = buffer.splice(0, this.config.maxBatchSize)
    this.totalQueued -= batch.length

    // Update metrics
    updateQueueSize(contract, this.totalQueued)

    // Add batch to processing queue
    this.queue.add(() => this.processBatch(contract, batch)).catch((error) => {
      logger.error(`Error processing batch for ${contract}:`, error)
    })

    // If there are still events in buffer, schedule next flush
    if (buffer.length > 0) {
      this.scheduleBatchFlush(contract)
    }
  }

  /**
   * Process a batch of events
   * Uses database transaction for atomicity
   */
  private async processBatch(contract: string, batch: BatchEvent[]): Promise<void> {
    const startTime = process.hrtime.bigint()

    logger.info(`Processing batch of ${batch.length} events for ${contract}`)

    try {
      // Group events by type for more efficient processing
      const eventsByType = this.groupEventsByType(batch)

      // Process each event type in a transaction
      await this.prisma.$transaction(
        async (tx) => {
          for (const [eventType, events] of eventsByType.entries()) {
            await this.processEventGroup(tx, contract, eventType, events)
          }
        },
        {
          maxWait: 30000, // 30 seconds
          timeout: 60000, // 60 seconds
        }
      )

      // Record success metrics
      const duration = Number(process.hrtime.bigint() - startTime) / 1e9
      recordBatchProcessed(contract, batch.length, duration)

      for (const event of batch) {
        recordEventProcessed(event.contract, event.eventType, 0)
      }

      logger.info(`Successfully processed batch of ${batch.length} events for ${contract} in ${duration.toFixed(2)}s`)
    } catch (error) {
      logger.error(`Failed to process batch for ${contract}:`, error)

      // Record failure metrics
      for (const event of batch) {
        recordEventFailed(event.contract, event.eventType, 'batch_processing_error')
      }

      // Retry if enabled
      if (this.config.retryEnabled) {
        await this.retryBatch(contract, batch, 1)
      }
    }
  }

  /**
   * Retry failed batch with exponential backoff
   */
  private async retryBatch(contract: string, batch: BatchEvent[], attempt: number) {
    if (attempt > this.config.maxRetries) {
      logger.error(`Max retries (${this.config.maxRetries}) exceeded for batch`)
      return
    }

    const delay = Math.min(1000 * Math.pow(2, attempt - 1), 30000) // Max 30s
    logger.warn(`Retrying batch in ${delay}ms (attempt ${attempt}/${this.config.maxRetries})`)

    await new Promise((resolve) => setTimeout(resolve, delay))

    try {
      await this.processBatch(contract, batch)
    } catch (error) {
      logger.error(`Retry ${attempt} failed:`, error)
      await this.retryBatch(contract, batch, attempt + 1)
    }
  }

  /**
   * Group events by type for more efficient batch processing
   */
  private groupEventsByType(batch: BatchEvent[]): Map<string, BatchEvent[]> {
    const groups = new Map<string, BatchEvent[]>()

    for (const event of batch) {
      if (!groups.has(event.eventType)) {
        groups.set(event.eventType, [])
      }
      groups.get(event.eventType)!.push(event)
    }

    return groups
  }

  /**
   * Process a group of events of the same type
   * Override this method in subclasses for custom processing
   */
  private async processEventGroup(
    tx: any,
    contract: string,
    eventType: string,
    events: BatchEvent[]
  ): Promise<void> {
    const startTime = process.hrtime.bigint()

    logger.debug(`Processing ${events.length} events of type ${eventType}`)

    // Example: Batch upsert tokens
    if (eventType === 'token_created') {
      await this.batchUpsertTokens(tx, events)
    }
    // Add more event type handlers here

    const duration = Number(process.hrtime.bigint() - startTime) / 1e9
    recordDatabaseWrite(`batch_${eventType}`, 'various', duration)
  }

  /**
   * Example: Batch upsert tokens
   */
  private async batchUpsertTokens(tx: any, events: BatchEvent[]) {
    // Create many tokens at once
    // This is much faster than individual upserts
    const operations = events.map((event) => {
      return tx.token.upsert({
        where: { address: event.data.address },
        create: event.data,
        update: event.data,
      })
    })

    await Promise.all(operations)
  }

  /**
   * Flush all pending batches
   * Call before shutdown
   */
  async flushAll(): Promise<void> {
    logger.info('Flushing all pending batches...')

    const contracts = Array.from(this.eventBuffer.keys())

    for (const contract of contracts) {
      await this.flushBatch(contract)
    }

    // Wait for queue to finish
    await this.queue.onIdle()

    logger.info('All batches flushed')
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    if (this.isShuttingDown) {
      return
    }

    this.isShuttingDown = true
    logger.info('Shutting down batch processor...')

    // Clear all flush timers
    for (const timer of this.flushTimers.values()) {
      clearTimeout(timer)
    }
    this.flushTimers.clear()

    // Flush all pending batches
    await this.flushAll()

    logger.info('Batch processor shut down')
  }

  /**
   * Get processor statistics
   */
  getStats() {
    const bufferSizes: Record<string, number> = {}
    for (const [contract, buffer] of this.eventBuffer.entries()) {
      bufferSizes[contract] = buffer.length
    }

    return {
      totalQueued: this.totalQueued,
      queueSize: this.queue.size,
      pendingBatches: this.queue.pending,
      bufferSizes,
      isShuttingDown: this.isShuttingDown,
    }
  }
}
