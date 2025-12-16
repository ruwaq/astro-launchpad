/**
 * Ledger Gap Detector
 *
 * CRITICAL: Detects and tracks gaps in ledger sequence processing
 * to ensure no events are missed during indexing.
 *
 * Gap detection is essential because:
 * 1. RPC nodes may have temporary outages
 * 2. Rate limiting can cause missed polling windows
 * 3. Network partitions may cause event loss
 * 4. Pagination limits might truncate large event batches
 */

import { PrismaClient, LedgerGapStatus } from '@astroshibapop/shared/prisma'
import { SorobanRpc } from '@stellar/stellar-sdk'
import { logger } from './logger.js'
import {
  recordLedgerGapDetected,
  recordLedgerGapRecovered,
  recordLedgerGapAbandoned,
  updateActiveGapCount,
} from './metrics.js'
import {
  alertGapAbandoned,
  alertGapThresholdExceeded,
} from './alerting.js'

// ============================================================================
// Types
// ============================================================================

export interface GapDetectorConfig {
  /** Maximum gap size to attempt recovery (larger gaps may indicate data loss) */
  maxRecoverableGapSize: number
  /** How many times to retry gap recovery before abandoning */
  maxRecoveryAttempts: number
  /** Minimum gap size to consider (small gaps might be RPC timing) */
  minGapSize: number
  /** Interval in ms between gap check runs */
  checkIntervalMs: number
  /** Enable automatic gap recovery */
  autoRecover: boolean
}

export const DEFAULT_GAP_DETECTOR_CONFIG: GapDetectorConfig = {
  maxRecoverableGapSize: 1000, // Don't try to recover gaps > 1000 ledgers
  maxRecoveryAttempts: 3,
  minGapSize: 2, // Only flag gaps of 2+ ledgers (1 ledger diff is normal)
  checkIntervalMs: 60000, // Check every 60 seconds
  autoRecover: true,
}

export interface DetectedGap {
  contractName: string
  fromLedger: number
  toLedger: number
  gapSize: number
  detectedAt: Date
}

export interface GapRecoveryResult {
  success: boolean
  eventsRecovered: number
  error?: string
}

// ============================================================================
// Ledger Gap Detector Service
// ============================================================================

export class LedgerGapDetector {
  private config: GapDetectorConfig
  private checkInterval: NodeJS.Timeout | null = null
  private isRunning: boolean = false
  private sorobanRpc: SorobanRpc.Server

  /** Track last known ledger per contract for gap detection */
  private lastKnownLedgers: Map<string, number> = new Map()

  constructor(
    private prisma: PrismaClient,
    config: Partial<GapDetectorConfig> = {}
  ) {
    this.config = { ...DEFAULT_GAP_DETECTOR_CONFIG, ...config }
    this.sorobanRpc = new SorobanRpc.Server(process.env.STELLAR_RPC_URL!)
  }

  // ============================================================================
  // Lifecycle Methods
  // ============================================================================

  /**
   * Start the gap detector service
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Gap detector already running')
      return
    }

    this.isRunning = true
    logger.info('Starting ledger gap detector...')

    // Load last known ledgers from state
    await this.loadLastKnownLedgers()

    // Initial check
    await this.checkForGaps()

    // Start periodic checks
    this.checkInterval = setInterval(async () => {
      if (this.isRunning) {
        await this.checkForGaps()
        await this.processRecoverableGaps()
      }
    }, this.config.checkIntervalMs)

    logger.info(`Gap detector started (check interval: ${this.config.checkIntervalMs}ms)`)
  }

  /**
   * Stop the gap detector service
   */
  async stop(): Promise<void> {
    this.isRunning = false

    if (this.checkInterval) {
      clearInterval(this.checkInterval)
      this.checkInterval = null
    }

    logger.info('Gap detector stopped')
  }

  // ============================================================================
  // Gap Detection
  // ============================================================================

  /**
   * Load last known ledgers from IndexerState
   */
  private async loadLastKnownLedgers(): Promise<void> {
    try {
      const states = await this.prisma.indexerState.findMany()

      for (const state of states) {
        const ledger = parseInt(state.lastLedger, 10)
        if (!isNaN(ledger)) {
          this.lastKnownLedgers.set(state.contractName, ledger)
        }
      }

      logger.info(`Loaded last known ledgers for ${states.length} contracts`)
    } catch (error) {
      logger.error('Failed to load last known ledgers:', error)
    }
  }

  /**
   * Record a new ledger being processed - called by indexer
   * Returns detected gap if one exists
   */
  recordLedgerProcessed(contractName: string, newLedger: number): DetectedGap | null {
    const lastLedger = this.lastKnownLedgers.get(contractName)

    // Update tracking
    this.lastKnownLedgers.set(contractName, newLedger)

    // First ledger for this contract, no gap possible
    if (lastLedger === undefined) {
      return null
    }

    // Calculate gap (we expect ledgers to be sequential or close)
    const gapSize = newLedger - lastLedger - 1

    // No gap or gap too small to track
    if (gapSize < this.config.minGapSize) {
      return null
    }

    // Detected a gap!
    const gap: DetectedGap = {
      contractName,
      fromLedger: lastLedger + 1,
      toLedger: newLedger - 1,
      gapSize,
      detectedAt: new Date(),
    }

    logger.warn({
      contractName,
      fromLedger: gap.fromLedger,
      toLedger: gap.toLedger,
      gapSize,
    }, 'LEDGER GAP DETECTED')

    // Record in metrics
    recordLedgerGapDetected(contractName, gapSize)

    // Persist gap to database asynchronously
    this.persistGap(gap).catch((err) => {
      logger.error({ error: err }, 'Failed to persist ledger gap')
    })

    return gap
  }

  /**
   * Persist detected gap to database
   */
  private async persistGap(gap: DetectedGap): Promise<void> {
    try {
      await this.prisma.ledgerGap.create({
        data: {
          contractName: gap.contractName,
          fromLedger: gap.fromLedger.toString(),
          toLedger: gap.toLedger.toString(),
          gapSize: gap.gapSize,
          status: gap.gapSize > this.config.maxRecoverableGapSize
            ? 'ABANDONED'
            : 'DETECTED',
          detectedAt: gap.detectedAt,
          metadata: {
            detectionMethod: 'realtime',
            rpcUrl: process.env.STELLAR_RPC_URL,
          },
        },
      })

      // Update metrics
      await this.updateGapMetrics()
    } catch (error: any) {
      // Handle unique constraint (gap already exists)
      if (error.code === 'P2002') {
        logger.debug('Gap already recorded in database')
        return
      }
      throw error
    }
  }

  /**
   * Check for gaps by comparing indexed state with network state
   */
  private async checkForGaps(): Promise<void> {
    try {
      // Get current network ledger
      const latestLedger = await this.sorobanRpc.getLatestLedger()
      const networkLedger = latestLedger.sequence

      // Get all indexer states
      const states = await this.prisma.indexerState.findMany()

      for (const state of states) {
        const indexedLedger = parseInt(state.lastLedger, 10)

        if (isNaN(indexedLedger)) {
          continue
        }

        // Calculate lag (how far behind the indexer is)
        const lag = networkLedger - indexedLedger

        // If lag is very large, might indicate a stale indexer
        if (lag > 100) {
          logger.warn({
            contractName: state.contractName,
            indexedLedger,
            networkLedger,
            lag,
          }, 'Indexer significantly behind network')
        }
      }
    } catch (error) {
      logger.error('Failed to check for gaps:', error)
    }
  }

  // ============================================================================
  // Gap Recovery
  // ============================================================================

  /**
   * Process recoverable gaps
   */
  private async processRecoverableGaps(): Promise<void> {
    if (!this.config.autoRecover) {
      return
    }

    try {
      // Get gaps ready for recovery
      const gaps = await this.prisma.ledgerGap.findMany({
        where: {
          status: 'DETECTED',
          recoveryAttempts: {
            lt: this.config.maxRecoveryAttempts,
          },
          gapSize: {
            lte: this.config.maxRecoverableGapSize,
          },
        },
        orderBy: {
          detectedAt: 'asc', // Oldest first
        },
        take: 5, // Process up to 5 gaps at a time
      })

      if (gaps.length === 0) {
        return
      }

      logger.info(`Processing ${gaps.length} recoverable gaps...`)

      for (const gap of gaps) {
        await this.recoverGap(gap)
      }
    } catch (error) {
      logger.error('Failed to process recoverable gaps:', error)
    }
  }

  /**
   * Attempt to recover a single gap
   */
  private async recoverGap(gap: any): Promise<GapRecoveryResult> {
    const gapId = gap.id
    const contractName = gap.contractName
    const fromLedger = parseInt(gap.fromLedger, 10)
    const toLedger = parseInt(gap.toLedger, 10)

    logger.info({
      gapId,
      contractName,
      fromLedger,
      toLedger,
    }, 'Attempting gap recovery...')

    try {
      // Mark as recovering
      await this.prisma.ledgerGap.update({
        where: { id: gapId },
        data: {
          status: 'RECOVERING',
          lastRecoveryAt: new Date(),
          recoveryAttempts: {
            increment: 1,
          },
        },
      })

      // Get contract ID based on name
      const contractId = contractName === 'token_factory'
        ? process.env.TOKEN_FACTORY_CONTRACT_ID
        : process.env.AMM_FACTORY_CONTRACT_ID

      if (!contractId) {
        throw new Error(`No contract ID for ${contractName}`)
      }

      // Query events for the gap range
      let eventsRecovered = 0
      let currentLedger = fromLedger

      // Process in chunks to avoid overwhelming RPC
      const chunkSize = 100

      while (currentLedger <= toLedger) {
        const endLedger = Math.min(currentLedger + chunkSize - 1, toLedger)

        try {
          const response = await this.sorobanRpc.getEvents({
            filters: [
              {
                type: 'contract',
                contractIds: [contractId],
              },
            ],
            startLedger: currentLedger,
            // Note: Soroban RPC doesn't have endLedger, but limits results
          })

          if (response.events && response.events.length > 0) {
            // Filter events within our gap range
            const gapEvents = response.events.filter((e: any) => {
              const eventLedger = e.ledger
              return eventLedger >= fromLedger && eventLedger <= toLedger
            })

            eventsRecovered += gapEvents.length

            if (gapEvents.length > 0) {
              logger.info({
                contractName,
                ledgerRange: `${currentLedger}-${endLedger}`,
                eventsFound: gapEvents.length,
              }, 'Found events in gap')

              // Store recovered events for processing
              // The indexer will pick these up via DLQ or direct processing
              for (const event of gapEvents) {
                await this.storeRecoveredEvent(contractName, event)
              }
            }
          }
        } catch (error) {
          logger.warn({
            error,
            ledgerRange: `${currentLedger}-${endLedger}`,
          }, 'Failed to fetch events for ledger range')
        }

        currentLedger = endLedger + 1
      }

      // Mark gap as recovered
      await this.prisma.ledgerGap.update({
        where: { id: gapId },
        data: {
          status: 'RECOVERED',
          recoveredAt: new Date(),
          eventsRecovered,
        },
      })

      logger.info({
        gapId,
        eventsRecovered,
      }, 'Gap recovery completed')

      recordLedgerGapRecovered(contractName, eventsRecovered)
      await this.updateGapMetrics()

      return { success: true, eventsRecovered }
    } catch (error: any) {
      logger.error({
        gapId,
        error: error.message,
      }, 'Gap recovery failed')

      // Check if max retries exceeded
      const updatedGap = await this.prisma.ledgerGap.findUnique({
        where: { id: gapId },
      })

      if (updatedGap && updatedGap.recoveryAttempts >= this.config.maxRecoveryAttempts) {
        const abandonReason = `Max retries (${this.config.maxRecoveryAttempts}) exceeded: ${error.message}`

        // Abandon gap
        await this.prisma.ledgerGap.update({
          where: { id: gapId },
          data: {
            status: 'ABANDONED',
            abandonedAt: new Date(),
            abandonReason,
          },
        })

        recordLedgerGapAbandoned(contractName, 'max_retries')

        // Trigger alert for abandoned gap
        alertGapAbandoned(
          gapId,
          contractName,
          gap.fromLedger,
          gap.toLedger,
          gap.gapSize,
          abandonReason
        )

        logger.error({ gapId }, 'Gap abandoned after max retries')
      } else {
        // Reset status for next retry
        await this.prisma.ledgerGap.update({
          where: { id: gapId },
          data: {
            status: 'DETECTED',
            lastError: error.message,
          },
        })
      }

      await this.updateGapMetrics()

      return { success: false, eventsRecovered: 0, error: error.message }
    }
  }

  /**
   * Store a recovered event for processing
   */
  private async storeRecoveredEvent(contractName: string, event: any): Promise<void> {
    try {
      // Use the FailedEvent table with a special status to queue for processing
      await this.prisma.failedEvent.upsert({
        where: {
          eventId: event.id,
        },
        create: {
          eventId: event.id,
          eventType: 'recovered',
          contract: contractName,
          ledger: String(event.ledger),
          eventData: event,
          errorMessage: 'Recovered from gap - pending processing',
          failureReason: 'gap_recovery',
          status: 'PENDING',
          nextRetryAt: new Date(), // Process immediately
        },
        update: {
          // Don't overwrite if already exists
        },
      })
    } catch (error) {
      logger.debug({ eventId: event.id }, 'Event already exists or failed to store')
    }
  }

  // ============================================================================
  // Metrics & Monitoring
  // ============================================================================

  /**
   * Update gap count metrics
   */
  private async updateGapMetrics(): Promise<void> {
    try {
      const counts = await this.prisma.ledgerGap.groupBy({
        by: ['contractName', 'status'],
        _count: {
          id: true,
        },
      })

      // Calculate active gaps per contract
      const activeGaps = new Map<string, number>()

      for (const count of counts) {
        if (count.status === 'DETECTED' || count.status === 'RECOVERING') {
          const current = activeGaps.get(count.contractName) || 0
          activeGaps.set(count.contractName, current + count._count.id)
        }
      }

      // Update metrics
      let totalActiveGaps = 0
      for (const [contract, count] of activeGaps) {
        updateActiveGapCount(contract, count)
        totalActiveGaps += count
      }

      // Check threshold for alerting
      alertGapThresholdExceeded(totalActiveGaps)
    } catch (error) {
      logger.error('Failed to update gap metrics:', error)
    }
  }

  /**
   * Get gap statistics
   */
  async getStats(): Promise<{
    totalGaps: number
    detected: number
    recovering: number
    recovered: number
    abandoned: number
    byContract: Record<string, { detected: number; recovered: number; abandoned: number }>
  }> {
    try {
      const counts = await this.prisma.ledgerGap.groupBy({
        by: ['contractName', 'status'],
        _count: {
          id: true,
        },
      })

      let detected = 0
      let recovering = 0
      let recovered = 0
      let abandoned = 0
      const byContract: Record<string, { detected: number; recovered: number; abandoned: number }> = {}

      for (const count of counts) {
        const contractStats = byContract[count.contractName] || { detected: 0, recovered: 0, abandoned: 0 }

        switch (count.status) {
          case 'DETECTED':
            detected += count._count.id
            contractStats.detected += count._count.id
            break
          case 'RECOVERING':
            recovering += count._count.id
            contractStats.detected += count._count.id
            break
          case 'RECOVERED':
            recovered += count._count.id
            contractStats.recovered += count._count.id
            break
          case 'ABANDONED':
            abandoned += count._count.id
            contractStats.abandoned += count._count.id
            break
        }

        byContract[count.contractName] = contractStats
      }

      return {
        totalGaps: detected + recovering + recovered + abandoned,
        detected,
        recovering,
        recovered,
        abandoned,
        byContract,
      }
    } catch (error) {
      logger.error('Failed to get gap stats:', error)
      return {
        totalGaps: 0,
        detected: 0,
        recovering: 0,
        recovered: 0,
        abandoned: 0,
        byContract: {},
      }
    }
  }

  /**
   * List gaps with optional filtering
   */
  async listGaps(options: {
    status?: string
    contractName?: string
    limit?: number
  } = {}): Promise<any[]> {
    const { status, contractName, limit = 100 } = options

    const where: any = {}
    if (status) where.status = status
    if (contractName) where.contractName = contractName

    return this.prisma.ledgerGap.findMany({
      where,
      orderBy: { detectedAt: 'desc' },
      take: limit,
    })
  }

  /**
   * Manually trigger recovery for a specific gap
   */
  async triggerRecovery(gapId: string): Promise<GapRecoveryResult> {
    const gap = await this.prisma.ledgerGap.findUnique({
      where: { id: gapId },
    })

    if (!gap) {
      return { success: false, eventsRecovered: 0, error: 'Gap not found' }
    }

    if (gap.status === 'RECOVERED') {
      return { success: false, eventsRecovered: 0, error: 'Gap already recovered' }
    }

    // Reset status and attempt recovery
    await this.prisma.ledgerGap.update({
      where: { id: gapId },
      data: {
        status: 'DETECTED',
        recoveryAttempts: 0, // Reset retries for manual trigger
      },
    })

    return this.recoverGap(gap)
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createLedgerGapDetector(
  prisma: PrismaClient,
  config?: Partial<GapDetectorConfig>
): LedgerGapDetector {
  return new LedgerGapDetector(prisma, config)
}
