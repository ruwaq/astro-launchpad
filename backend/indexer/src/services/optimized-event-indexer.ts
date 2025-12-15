/**
 * Optimized Event Indexer
 * High-performance event indexing with batch processing and state management
 */

import { PrismaClient } from '@astroshibapop/shared/prisma'
import { SorobanRpc, scValToNative } from '@stellar/stellar-sdk'
import { logger } from '../lib/logger.js'
import { CircuitBreaker, createCircuitBreaker, CircuitState } from '../lib/circuit-breaker.js'
import { StateManager } from '../lib/state-manager.js'
import { BatchProcessor, BatchEvent, DEFAULT_BATCH_CONFIG } from '../lib/batch-processor.js'
import { TokenEventHandler } from './handlers/token-events.js'
import { PoolEventHandler } from './handlers/pool-events.js'
import { FeeEventHandler } from './handlers/fee-events.js'
import { AdminEventHandler } from './handlers/admin-events.js'
import { GraduationEventHandler } from './handlers/graduation-events.js'
import { AstroEventHandler } from './handlers/astro-events.js'
import { ConfigEventHandler } from './handlers/config-events.js'
import { DeadLetterQueue, DEFAULT_DLQ_CONFIG, type DLQStats } from './dead-letter-queue.js'
import {
  recordEventReceived,
  recordEventFailed,
  setStreamStatus,
  recordStreamReconnection,
  recordStreamError,
  setCircuitBreakerState,
  recordCircuitBreakerTrip,
  startMemoryMetrics,
  stopMemoryMetrics,
  getMetricsText,
} from '../lib/metrics.js'

// ============================================================================
// Async Mutex Implementation
// ============================================================================

/**
 * Simple async mutex to prevent race conditions in concurrent async operations
 * Unlike boolean flags, a mutex properly serializes access even during await gaps
 */
class AsyncMutex {
  private locked: boolean = false
  private waitQueue: Array<() => void> = []

  /**
   * Acquire the lock. If already locked, waits until released.
   * Returns a release function that MUST be called when done.
   */
  async acquire(): Promise<() => void> {
    // If not locked, acquire immediately
    if (!this.locked) {
      this.locked = true
      return () => this.release()
    }

    // Otherwise, wait in queue
    return new Promise((resolve) => {
      this.waitQueue.push(() => {
        resolve(() => this.release())
      })
    })
  }

  private release(): void {
    // If there are waiters, give lock to next in queue
    if (this.waitQueue.length > 0) {
      const next = this.waitQueue.shift()!
      // Use setImmediate to prevent stack overflow with many waiters
      setImmediate(next)
    } else {
      this.locked = false
    }
  }

  /**
   * Try to acquire the lock without waiting.
   * Returns null if lock is already held.
   */
  tryAcquire(): (() => void) | null {
    if (this.locked) {
      return null
    }
    this.locked = true
    return () => this.release()
  }

  get isLocked(): boolean {
    return this.locked
  }
}

export class OptimizedEventIndexer {
  private sorobanRpc: SorobanRpc.Server
  private tokenFactory: string
  private ammFactory: string | null
  private pollingIntervals: NodeJS.Timeout[] = []
  private circuitBreaker: CircuitBreaker
  private reconnectTimers: NodeJS.Timeout[] = []
  private isShuttingDown: boolean = false

  // CRITICAL: Use proper async mutexes instead of boolean flags
  // Boolean flags have race conditions during await gaps in async functions
  private tokenFactoryMutex: AsyncMutex = new AsyncMutex()
  private ammFactoryMutex: AsyncMutex = new AsyncMutex()

  // New components
  private stateManager: StateManager
  private batchProcessor: BatchProcessor
  private tokenHandler: TokenEventHandler
  private poolHandler: PoolEventHandler
  private feeHandler: FeeEventHandler
  private adminHandler: AdminEventHandler
  private graduationHandler: GraduationEventHandler
  private astroHandler: AstroEventHandler
  private configHandler: ConfigEventHandler

  // Dead Letter Queue for failed event handling
  private dlq: DeadLetterQueue
  private dlqRetryInterval: NodeJS.Timeout | null = null

  constructor(private prisma: PrismaClient) {
    const rpcUrl = process.env.STELLAR_RPC_URL!
    this.sorobanRpc = new SorobanRpc.Server(rpcUrl)
    this.tokenFactory = process.env.TOKEN_FACTORY_CONTRACT_ID!
    this.ammFactory = process.env.AMM_FACTORY_CONTRACT_ID || null

    // Initialize state manager
    this.stateManager = new StateManager(prisma)

    // Initialize batch processor with optimized config
    this.batchProcessor = new BatchProcessor(prisma, {
      ...DEFAULT_BATCH_CONFIG,
      maxBatchSize: 100, // Process 100 events at once
      maxBatchWaitMs: 5000, // Wait max 5 seconds
      maxConcurrency: 3, // Process 3 batches concurrently
      maxQueueSize: 10000, // Max 10k events in queue
    })

    // Initialize event handlers
    this.tokenHandler = new TokenEventHandler(prisma)
    this.poolHandler = new PoolEventHandler(prisma)
    this.feeHandler = new FeeEventHandler(prisma)
    this.adminHandler = new AdminEventHandler(prisma)
    this.graduationHandler = new GraduationEventHandler(prisma)
    this.astroHandler = new AstroEventHandler(prisma)
    this.configHandler = new ConfigEventHandler(prisma)

    // Initialize circuit breaker with extended config
    this.circuitBreaker = createCircuitBreaker({
      maxDelay: 600000, // Max 10 minutes backoff
      failureThreshold: 5,
    })

    // Initialize Dead Letter Queue for failed event handling
    this.dlq = new DeadLetterQueue(prisma, DEFAULT_DLQ_CONFIG)

    // Start memory metrics collection
    startMemoryMetrics(10000) // Every 10 seconds
  }

  async start() {
    logger.info('Starting optimized event indexer...')

    // Start DLQ retry worker
    await this.startDLQRetryWorker()

    // Index Token Factory events
    await this.indexTokenFactory()

    // Index AMM events (if deployed)
    if (this.ammFactory) {
      await this.indexAMMFactory()
    }

    logger.info('Optimized event indexer started')
  }

  /**
   * Start the DLQ retry worker that periodically processes failed events
   */
  private async startDLQRetryWorker() {
    logger.info('Starting DLQ retry worker...')

    // Process any pending retries immediately
    await this.processDLQRetries()

    // Run DLQ retry worker every 2 minutes
    this.dlqRetryInterval = setInterval(async () => {
      if (!this.isShuttingDown) {
        await this.processDLQRetries()
      }
    }, 120000) // 2 minutes

    logger.info('DLQ retry worker started')
  }

  /**
   * Process pending DLQ retries
   */
  private async processDLQRetries() {
    try {
      const retryableEvents = await this.dlq.getRetryableEvents(50)

      if (retryableEvents.length === 0) {
        return
      }

      logger.info({ count: retryableEvents.length }, 'Processing DLQ retries...')

      for (const failedEvent of retryableEvents) {
        try {
          // Mark as retrying
          await this.dlq.markRetrying(failedEvent.eventId)

          // Reconstruct event and process based on contract
          const eventData = failedEvent.eventData as Record<string, unknown>

          if (failedEvent.contract === 'token_factory') {
            // Route to appropriate token handler based on event type
            if (failedEvent.eventType === 'token_created') {
              await this.tokenHandler.handleTokenCreated(eventData)
            } else if (failedEvent.eventType === 'token_buy') {
              await this.tokenHandler.handleTokenBuy(eventData)
            } else if (failedEvent.eventType === 'token_sell') {
              await this.tokenHandler.handleTokenSell(eventData)
            } else if (failedEvent.eventType === 'token_graduated') {
              await this.tokenHandler.handleTokenGraduated(eventData)
            }
          }

          // Mark as resolved on success
          await this.dlq.markResolved(failedEvent.eventId, 'auto-retry')
          logger.info({ eventId: failedEvent.eventId }, 'Successfully replayed DLQ event')
        } catch (error: any) {
          logger.error(
            { eventId: failedEvent.eventId, error: error.message },
            'Failed to replay DLQ event'
          )

          // Re-add to DLQ with incremented retry count
          await this.dlq.addFailedEvent(
            {
              id: failedEvent.eventId,
              ledger: failedEvent.ledger,
              contract: failedEvent.contract,
              eventType: failedEvent.eventType,
              data: failedEvent.eventData as Record<string, unknown>,
              timestamp: new Date(),
            },
            error,
            'retry_failed',
            failedEvent.retryCount + 1
          )
        }
      }
    } catch (error) {
      logger.error({ error }, 'Error processing DLQ retries')
    }
  }

  async stop() {
    logger.info('Stopping optimized event indexer...')
    this.isShuttingDown = true

    // Stop memory metrics
    stopMemoryMetrics()

    // Stop DLQ retry worker
    if (this.dlqRetryInterval) {
      clearInterval(this.dlqRetryInterval)
      this.dlqRetryInterval = null
    }

    // Clear all reconnect timers
    for (const timer of this.reconnectTimers) {
      clearTimeout(timer)
    }
    this.reconnectTimers = []

    // Stop all polling intervals
    for (const interval of this.pollingIntervals) {
      clearInterval(interval)
    }
    this.pollingIntervals = []

    // Update stream status
    setStreamStatus('token_factory', false)
    if (this.ammFactory) {
      setStreamStatus('amm_factory', false)
    }

    // Flush all pending batches
    await this.batchProcessor.shutdown()

    logger.info('Optimized event indexer stopped')
  }

  getStatus() {
    const cbStats = this.circuitBreaker.getStats()
    const batchStats = this.batchProcessor.getStats()
    const stateCache = this.stateManager.getCacheStats()

    return {
      isRunning: !this.isShuttingDown,
      activePollers: this.pollingIntervals.length,
      circuitBreaker: cbStats,
      batchProcessor: batchStats,
      stateCache,
      health: cbStats.state === CircuitState.CLOSED ? 'healthy' : 'degraded',
    }
  }

  /**
   * Get DLQ statistics for monitoring
   */
  async getDLQStats(): Promise<DLQStats> {
    return this.dlq.getStats()
  }

  /**
   * Access to DLQ for admin operations
   */
  getDLQ(): DeadLetterQueue {
    return this.dlq
  }

  /**
   * Get Prometheus metrics
   */
  async getMetrics(): Promise<string> {
    return getMetricsText()
  }

  private async indexTokenFactory() {
    if (this.isShuttingDown) {
      logger.info('Shutdown in progress, not starting Token Factory poller')
      return
    }

    // Initial poll
    await this.pollTokenFactoryEvents()

    // Setup polling interval (every 30 seconds)
    const interval = setInterval(async () => {
      if (!this.isShuttingDown) {
        await this.pollTokenFactoryEvents()
      }
    }, 30000) // 30 seconds

    this.pollingIntervals.push(interval)
    setStreamStatus('token_factory', true)
    logger.info('Token Factory event poller started (30s interval)')
  }

  private async pollTokenFactoryEvents() {
    // CRITICAL: Use mutex.tryAcquire() for non-blocking lock acquisition
    // If lock is held, another poll is in progress - skip this one
    const releaseLock = this.tokenFactoryMutex.tryAcquire()
    if (!releaseLock) {
      logger.debug('Token Factory polling already in progress (mutex held), skipping')
      return
    }

    try {
      // Get last indexed ledger from state manager
      const lastLedgerStr = await this.stateManager.getLastLedger('token_factory')
      let startLedger: number | undefined = lastLedgerStr ? parseInt(lastLedgerStr) + 1 : undefined

      // If no previous state, get the latest ledger or use configured start ledger
      if (!startLedger) {
        const configuredStart = process.env.INDEXER_START_LEDGER || 'latest'

        if (configuredStart === 'latest') {
          // Get latest ledger from network
          const latestLedger = await this.sorobanRpc.getLatestLedger()
          startLedger = latestLedger.sequence
          logger.info(`First run: Starting from latest ledger: ${startLedger}`)
        } else {
          startLedger = parseInt(configuredStart, 10)
          logger.info(`First run: Starting from configured ledger: ${startLedger}`)
        }
      }

      logger.info(`Polling Token Factory events from ledger: ${startLedger}`)

      // Query events using Soroban RPC
      const requestParams: any = {
        filters: [
          {
            type: 'contract',
            contractIds: [this.tokenFactory],
          },
        ],
        startLedger,
      }

      const response = await this.sorobanRpc.getEvents(requestParams)

      if (response.events && response.events.length > 0) {
        logger.info(`Found ${response.events.length} Token Factory events`)

        for (const event of response.events) {
          try {
            await this.handleTokenFactoryEvent(event as any)
          } catch (error) {
            logger.error('Error handling Token Factory event:', error)
            recordEventFailed('token_factory', 'unknown', 'handler_error')
          }
        }
      }

      // Always update last indexed ledger (even if no events found)
      // This ensures we continue from where we left off on next poll
      await this.stateManager.updateLastLedger(
        'token_factory',
        response.latestLedger.toString(),
        `ledger_${response.latestLedger}`
      )
    } catch (error) {
      logger.error('Error polling Token Factory events:')
      console.error(error)
      recordStreamError('token_factory', 'polling_error')
    } finally {
      // CRITICAL: Always release the mutex, even on error
      releaseLock()
    }
  }

  private async indexAMMFactory() {
    if (!this.ammFactory) return
    if (this.isShuttingDown) {
      logger.info('Shutdown in progress, not starting AMM Factory poller')
      return
    }

    // Initial poll
    await this.pollAMMEvents()

    // Setup polling interval (every 30 seconds)
    const interval = setInterval(async () => {
      if (!this.isShuttingDown) {
        await this.pollAMMEvents()
      }
    }, 30000)

    this.pollingIntervals.push(interval)
    setStreamStatus('amm_factory', true)
    logger.info('AMM Factory event poller started (30s interval)')
  }

  private async pollAMMEvents() {
    // CRITICAL: Use mutex.tryAcquire() for non-blocking lock acquisition
    const releaseLock = this.ammFactoryMutex.tryAcquire()
    if (!releaseLock) {
      logger.debug('AMM Factory polling already in progress (mutex held), skipping')
      return
    }

    try {
      const lastLedgerStr = await this.stateManager.getLastLedger('amm_factory')
      let startLedger: number | undefined = lastLedgerStr ? parseInt(lastLedgerStr) + 1 : undefined

      // If no previous state, get the latest ledger or use configured start ledger
      if (!startLedger) {
        const configuredStart = process.env.INDEXER_START_LEDGER || 'latest'

        if (configuredStart === 'latest') {
          const latestLedger = await this.sorobanRpc.getLatestLedger()
          startLedger = latestLedger.sequence
          logger.info(`First run: Starting AMM indexing from latest ledger: ${startLedger}`)
        } else {
          startLedger = parseInt(configuredStart, 10)
          logger.info(`First run: Starting AMM indexing from configured ledger: ${startLedger}`)
        }
      }

      logger.info(`Polling AMM Factory events from ledger: ${startLedger}`)

      const requestParams: any = {
        filters: [
          {
            type: 'contract',
            contractIds: [this.ammFactory!],
          },
        ],
        startLedger,
      }

      const response = await this.sorobanRpc.getEvents(requestParams)

      if (response.events && response.events.length > 0) {
        logger.info(`Found ${response.events.length} AMM Factory events`)

        for (const event of response.events) {
          try {
            await this.handleAMMEvent(event as any)
          } catch (error) {
            logger.error('Error handling AMM event:', error)
            recordEventFailed('amm_factory', 'unknown', 'handler_error')
          }
        }
      }

      // Always update last indexed ledger (even if no events found)
      await this.stateManager.updateLastLedger(
        'amm_factory',
        response.latestLedger.toString(),
        `ledger_${response.latestLedger}`
      )
    } catch (error) {
      logger.error('Error polling AMM events:')
      console.error(error)
      recordStreamError('amm_factory', 'polling_error')
    } finally {
      // CRITICAL: Always release the mutex, even on error
      releaseLock()
    }
  }

  /**
   * Handle stream errors with circuit breaker
   */
  private handleStreamError(streamName: string, reconnectFn: () => Promise<void>) {
    if (this.isShuttingDown) {
      logger.info(`Shutdown in progress, not reconnecting ${streamName}`)
      return
    }

    const cbStats = this.circuitBreaker.getStats()

    logger.warn(`Stream ${streamName} disconnected. Circuit breaker state: ${cbStats.state}`)

    // Update circuit breaker metrics
    setCircuitBreakerState(streamName, cbStats.state === CircuitState.CLOSED ? 0 : cbStats.state === CircuitState.HALF_OPEN ? 1 : 2)

    if (cbStats.state === CircuitState.OPEN) {
      recordCircuitBreakerTrip(streamName)
      logger.error(
        `Circuit breaker is OPEN. Will attempt reconnect in ${cbStats.currentDelay / 1000}s`
      )
    }

    // Record reconnection attempt
    recordStreamReconnection(streamName, 'stream_error')

    // Schedule reconnection
    const timer = setTimeout(async () => {
      if (!this.isShuttingDown) {
        logger.info(`Attempting to reconnect ${streamName}...`)
        try {
          await reconnectFn()
        } catch (error) {
          logger.error(`Reconnection attempt for ${streamName} failed:`, error)
        }
      }
    }, cbStats.currentDelay)

    this.reconnectTimers.push(timer)
  }

  /**
   * Handle Token Factory event
   * Adds event to batch processor queue
   */
  private async handleTokenFactoryEvent(event: any) {
    const eventType = this.getEventType(event)

    // Record event received
    recordEventReceived('token_factory', eventType)

    // Create batch event
    const batchEvent: BatchEvent = {
      id: event.id,
      ledger: event.ledger,
      contract: 'token_factory',
      eventType,
      data: event,
      timestamp: new Date(event.ledger_close_time),
    }

    // Add to batch processor
    const added = await this.batchProcessor.addEvent(batchEvent)

    if (!added) {
      logger.warn('Failed to add event to batch processor (backpressure)')
      recordEventFailed('token_factory', eventType, 'queue_full')
      return
    }

    // Update state (sync, blocking to ensure consistency)
    try {
      await this.stateManager.updateLastLedger('token_factory', String(event.ledger), event.id)
    } catch (error) {
      logger.error('Failed to update last ledger:', error)
    }

    // Process event immediately with handler (for real-time updates)
    // Map contract event names to handlers:
    // Contract emits: TokenLaunched, TokensBought, TokensSold, TokenGraduated
    try {
      const normalizedType = eventType.toLowerCase()

      switch (true) {
        // Token creation events
        case normalizedType === 'tokenlaunched':
        case normalizedType === 'tokenlauncheddetailed':
        case normalizedType === 'created':
          logger.info(`📥 Processing TokenCreated event...`)
          await this.tokenHandler.handleTokenCreated(event)
          break

        // Token buy events
        case normalizedType === 'tokensbought':
        case normalizedType === 'tokensboughtdetailed':
        case normalizedType === 'buy':
          await this.tokenHandler.handleTokenBuy(event)
          break

        // Token sell events
        case normalizedType === 'tokenssold':
        case normalizedType === 'sell':
          await this.tokenHandler.handleTokenSell(event)
          break

        // Graduation events (basic)
        case normalizedType === 'tokengraduated':
          await this.tokenHandler.handleTokenGraduated(event)
          break

        // Graduation events (detailed) - use dedicated handler
        case normalizedType === 'graduationdetailed':
        case normalizedType === 'graduationfailed':
        case normalizedType === 'tokenrecovered':
        case normalizedType === 'graduationretried':
        case normalizedType === 'bridgegraduation':
        case normalizedType === 'graduationwithastro':
        case normalizedType === 'liquiditylocked':
          await this.graduationHandler.handleEvent(event)
          break

        // Fee-related events (collection)
        case normalizedType === 'feebreakdownevent':
        case normalizedType === 'protocolfeecollected':
        case normalizedType === 'lpfeecollected':
          await this.feeHandler.handleEvent(event)
          break

        // Config update events
        case normalizedType === 'protocolfeeupdated':
        case normalizedType === 'lpfeeupdated':
        case normalizedType === 'creationfeeupdated':
        case normalizedType === 'treasuryupdated':
        case normalizedType === 'feeconfigpdated':
        case normalizedType === 'graduationthresholdupdated':
        case normalizedType === 'xlmaddressupdated':
        case normalizedType === 'oracleaddressupdated':
        case normalizedType === 'ammwasmhashupdated':
        case normalizedType === 'antiwhaleconfigpdated':
        case normalizedType === 'minmarketcapupdated':
        case normalizedType === 'oraclepricemaxageupdated':
        case normalizedType === 'bridgeconfigpdated':
          await this.configHandler.handleEvent(event)
          break

        // Admin events (access control)
        case normalizedType === 'rolegranted':
        case normalizedType === 'rolerevoked':
        case normalizedType === 'ownershiptransferred':
        case normalizedType === 'contractpaused':
        case normalizedType === 'contractunpaused':
          await this.adminHandler.handleEvent(event)
          break

        // ASTRO token events
        case normalizedType === 'astroconfigpdated':
        case normalizedType === 'astrobuybackexecuted':
        case normalizedType === 'astroliquidityadded':
          await this.astroHandler.handleEvent(event)
          break

        default:
          logger.debug(`Unhandled Token Factory event type: ${eventType}`)
      }
    } catch (error) {
      logger.error(`Error processing ${eventType} event:`, error)
      // Event is still in batch processor queue, will be retried
    }
  }

  /**
   * Handle AMM event
   */
  private async handleAMMEvent(event: any) {
    const eventType = this.getEventType(event)

    recordEventReceived('amm_factory', eventType)

    const batchEvent: BatchEvent = {
      id: event.id,
      ledger: event.ledger,
      contract: 'amm_factory',
      eventType,
      data: event,
      timestamp: new Date(event.ledger_close_time),
    }

    const added = await this.batchProcessor.addEvent(batchEvent)

    if (!added) {
      logger.warn('Failed to add AMM event to batch processor (backpressure)')
      recordEventFailed('amm_factory', eventType, 'queue_full')
      return
    }

    try {
      await this.stateManager.updateLastLedger('amm_factory', String(event.ledger), event.id)
    } catch (error) {
      logger.error('Failed to update last ledger:', error)
    }

    // Process event immediately
    try {
      switch (eventType) {
        case 'liq_add':
          await this.poolHandler.handleLiquidityAdded(event)
          break
        case 'liq_rm':
          await this.poolHandler.handleLiquidityRemoved(event)
          break
        case 'swap':
          await this.poolHandler.handleSwap(event)
          break
        default:
          logger.warn(`Unknown AMM event type: ${eventType}`)
      }
    } catch (error) {
      logger.error(`Error processing ${eventType} event:`, error)
    }
  }

  /**
   * Extract event type from Soroban event topics
   * Topics are XDR-encoded, need scValToNative to decode
   */
  private getEventType(event: any): string {
    try {
      if (!event.topic || !Array.isArray(event.topic) || event.topic.length === 0) {
        return 'unknown'
      }

      const firstTopic = event.topic[0]

      // If it's already a string, return it
      if (typeof firstTopic === 'string') {
        return firstTopic
      }

      // Try to decode XDR topic
      try {
        const decoded = scValToNative(firstTopic)
        if (typeof decoded === 'string') {
          return decoded
        }
        // Handle Symbol type from Soroban
        if (decoded && typeof decoded === 'object' && decoded.toString) {
          return decoded.toString()
        }
        return String(decoded)
      } catch {
        // Fallback to toString
        return firstTopic?.toString?.() || 'unknown'
      }
    } catch (error) {
      logger.error('Error extracting event type:', error)
      return 'unknown'
    }
  }
}
