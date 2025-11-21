/**
 * Optimized Event Indexer
 * High-performance event indexing with batch processing and state management
 */

import { PrismaClient } from '@prisma/client'
import { Server, Horizon } from '@stellar/stellar-sdk'
import { logger } from '../lib/logger.js'
import { CircuitBreaker, DEFAULT_CIRCUIT_BREAKER_CONFIG, CircuitState } from '../lib/circuit-breaker.js'
import { StateManager } from '../lib/state-manager.js'
import { BatchProcessor, BatchEvent, DEFAULT_BATCH_CONFIG } from '../lib/batch-processor.js'
import { TokenEventHandler } from './handlers/token-events.js'
import { PoolEventHandler } from './handlers/pool-events.js'
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

export class OptimizedEventIndexer {
  private server: Server
  private tokenFactory: string
  private ammFactory: string | null
  private eventStreams: any[] = []
  private circuitBreaker: CircuitBreaker
  private reconnectTimers: NodeJS.Timeout[] = []
  private isShuttingDown: boolean = false

  // New components
  private stateManager: StateManager
  private batchProcessor: BatchProcessor
  private tokenHandler: TokenEventHandler
  private poolHandler: PoolEventHandler

  constructor(private prisma: PrismaClient) {
    const rpcUrl = process.env.STELLAR_RPC_URL!
    this.server = new Server(rpcUrl)
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

    // Initialize circuit breaker
    this.circuitBreaker = new CircuitBreaker({
      ...DEFAULT_CIRCUIT_BREAKER_CONFIG,
      maxRetries: 10,
      maxDelay: 600000, // Max 10 minutes backoff
    })

    // Start memory metrics collection
    startMemoryMetrics(10000) // Every 10 seconds
  }

  async start() {
    logger.info('Starting optimized event indexer...')

    // Index Token Factory events
    await this.indexTokenFactory()

    // Index AMM events (if deployed)
    if (this.ammFactory) {
      await this.indexAMMFactory()
    }

    logger.info('Optimized event indexer started')
  }

  async stop() {
    logger.info('Stopping optimized event indexer...')
    this.isShuttingDown = true

    // Stop memory metrics
    stopMemoryMetrics()

    // Clear all reconnect timers
    for (const timer of this.reconnectTimers) {
      clearTimeout(timer)
    }
    this.reconnectTimers = []

    // Stop all streams
    for (const stream of this.eventStreams) {
      if (stream && typeof stream === 'function') {
        stream()
      }
    }
    this.eventStreams = []

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
      activeStreams: this.eventStreams.length,
      circuitBreaker: cbStats,
      batchProcessor: batchStats,
      stateCache,
      health: cbStats.state === CircuitState.CLOSED ? 'healthy' : 'degraded',
    }
  }

  /**
   * Get Prometheus metrics
   */
  async getMetrics(): Promise<string> {
    return getMetricsText()
  }

  private async indexTokenFactory() {
    if (this.isShuttingDown) {
      logger.info('Shutdown in progress, not starting Token Factory stream')
      return
    }

    try {
      await this.circuitBreaker.execute(async () => {
        // Get last indexed ledger from state manager
        const lastLedger = await this.stateManager.getLastLedger('token_factory')
        const cursor = lastLedger || 'now'

        logger.info(`Starting Token Factory stream from cursor: ${cursor}`)

        const stream = this.server
          .events()
          .forContract(this.tokenFactory)
          .cursor(cursor)
          .stream({
            onmessage: async (event: Horizon.ServerApi.EventRecord) => {
              try {
                await this.handleTokenFactoryEvent(event)
              } catch (error) {
                logger.error('Error handling Token Factory event:', error)
                recordEventFailed('token_factory', 'unknown', 'handler_error')
              }
            },
            onerror: (error: any) => {
              logger.error('Token Factory stream error:', error)
              recordStreamError('token_factory', 'connection_error')
              setStreamStatus('token_factory', false)
              this.handleStreamError('token_factory', () => this.indexTokenFactory())
            },
          })

        this.eventStreams.push(stream)
        setStreamStatus('token_factory', true)
        logger.info('Token Factory stream started successfully')
      })
    } catch (error) {
      logger.error('Failed to start Token Factory stream:', error)
      recordStreamError('token_factory', 'initialization_error')
      setStreamStatus('token_factory', false)
      this.handleStreamError('token_factory', () => this.indexTokenFactory())
    }
  }

  private async indexAMMFactory() {
    if (!this.ammFactory) return
    if (this.isShuttingDown) {
      logger.info('Shutdown in progress, not starting AMM Factory stream')
      return
    }

    try {
      await this.circuitBreaker.execute(async () => {
        const lastLedger = await this.stateManager.getLastLedger('amm_factory')
        const cursor = lastLedger || 'now'

        logger.info(`Starting AMM Factory stream from cursor: ${cursor}`)

        const stream = this.server
          .events()
          .forContract(this.ammFactory!)
          .cursor(cursor)
          .stream({
            onmessage: async (event: Horizon.ServerApi.EventRecord) => {
              try {
                await this.handleAMMEvent(event)
              } catch (error) {
                logger.error('Error handling AMM event:', error)
                recordEventFailed('amm_factory', 'unknown', 'handler_error')
              }
            },
            onerror: (error: any) => {
              logger.error('AMM stream error:', error)
              recordStreamError('amm_factory', 'connection_error')
              setStreamStatus('amm_factory', false)
              this.handleStreamError('amm_factory', () => this.indexAMMFactory())
            },
          })

        this.eventStreams.push(stream)
        setStreamStatus('amm_factory', true)
        logger.info('AMM Factory stream started successfully')
      })
    } catch (error) {
      logger.error('Failed to start AMM stream:', error)
      recordStreamError('amm_factory', 'initialization_error')
      setStreamStatus('amm_factory', false)
      this.handleStreamError('amm_factory', () => this.indexAMMFactory())
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
  private async handleTokenFactoryEvent(event: Horizon.ServerApi.EventRecord) {
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

    // Update state (async, non-blocking)
    this.stateManager.updateLastLedger('token_factory', event.ledger, event.id).catch((error) => {
      logger.error('Failed to update last ledger:', error)
    })

    // Process event immediately with handler (for real-time updates)
    try {
      switch (eventType) {
        case 'created':
          await this.tokenHandler.handleTokenCreated(event)
          break
        case 'buy':
          await this.tokenHandler.handleTokenBuy(event)
          break
        case 'sell':
          await this.tokenHandler.handleTokenSell(event)
          break
        case 'graduate':
          await this.tokenHandler.handleTokenGraduated(event)
          break
        default:
          logger.warn(`Unknown Token Factory event type: ${eventType}`)
      }
    } catch (error) {
      logger.error(`Error processing ${eventType} event:`, error)
      // Event is still in batch processor queue, will be retried
    }
  }

  /**
   * Handle AMM event
   */
  private async handleAMMEvent(event: Horizon.ServerApi.EventRecord) {
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

    this.stateManager.updateLastLedger('amm_factory', event.ledger, event.id).catch((error) => {
      logger.error('Failed to update last ledger:', error)
    })

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

  private getEventType(event: Horizon.ServerApi.EventRecord): string {
    try {
      if (event.topic && Array.isArray(event.topic) && event.topic.length > 0) {
        return event.topic[0].toString()
      }
      return 'unknown'
    } catch (error) {
      logger.error('Error extracting event type:', error)
      return 'unknown'
    }
  }
}
