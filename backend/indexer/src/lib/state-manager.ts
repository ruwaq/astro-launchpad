/**
 * State Manager
 * Persists indexer state (last indexed ledger) for resumption
 */

import { PrismaClient } from '@astroshibapop/shared/prisma'
import { logger } from './logger.js'
import { updateLastIndexedLedger, updateIndexingLag } from './metrics.js'

export interface IndexerStateData {
  contractName: string
  lastLedger: string
  lastEventId?: string
  lastProcessedAt: Date
}

export class StateManager {
  private cache: Map<string, IndexerStateData> = new Map()
  /** Mutex locks per contract to prevent concurrent updates */
  private locks: Map<string, Promise<boolean>> = new Map()

  constructor(private prisma: PrismaClient) {}

  /**
   * Acquire a lock for a contract to prevent concurrent updates
   * Returns a release function to call when done
   */
  private async acquireLock(contractName: string): Promise<() => void> {
    // Wait for any existing lock to complete
    while (this.locks.has(contractName)) {
      await this.locks.get(contractName)
    }

    // Create a new lock with a resolver
    let releaseLock: () => void
    const lockPromise = new Promise<boolean>((resolve) => {
      releaseLock = () => {
        this.locks.delete(contractName)
        resolve(true)
      }
    })

    this.locks.set(contractName, lockPromise)
    return releaseLock!
  }

  /**
   * Get last indexed ledger for a contract
   * Returns null if never indexed before
   */
  async getLastLedger(contractName: string): Promise<string | null> {
    try {
      // Try cache first
      const cached = this.cache.get(contractName)
      if (cached) {
        return cached.lastLedger
      }

      // Fetch from database
      const state = await this.prisma.indexerState.findUnique({
        where: { contractName },
      })

      if (!state) {
        logger.info(`No previous state found for ${contractName}`)
        return null
      }

      // Update cache
      this.cache.set(contractName, {
        contractName: state.contractName,
        lastLedger: state.lastLedger,
        lastEventId: state.lastEventId || undefined,
        lastProcessedAt: state.lastProcessedAt,
      })

      logger.info(`Resuming ${contractName} from ledger: ${state.lastLedger}`)
      return state.lastLedger
    } catch (error) {
      logger.error(`Failed to get last ledger for ${contractName}:`, error)
      return null
    }
  }

  /**
   * Update last indexed ledger for a contract
   * Uses upsert to handle both create and update cases
   * Protected by mutex to prevent race conditions in concurrent updates
   */
  async updateLastLedger(
    contractName: string,
    lastLedger: string,
    lastEventId?: string
  ): Promise<boolean> {
    // Acquire lock to prevent concurrent updates for same contract
    const releaseLock = await this.acquireLock(contractName)

    try {
      const now = new Date()

      // Update database
      await this.prisma.indexerState.upsert({
        where: { contractName },
        create: {
          contractName,
          lastLedger,
          lastEventId,
          lastProcessedAt: now,
        },
        update: {
          lastLedger,
          lastEventId,
          lastProcessedAt: now,
        },
      })

      // Update cache
      this.cache.set(contractName, {
        contractName,
        lastLedger,
        lastEventId,
        lastProcessedAt: now,
      })

      // Update metrics
      const ledgerNum = parseInt(lastLedger, 10)
      if (!isNaN(ledgerNum)) {
        updateLastIndexedLedger(contractName, ledgerNum)
      }

      // Calculate and update lag
      const lagSeconds = Math.floor((Date.now() - now.getTime()) / 1000)
      updateIndexingLag(contractName, lagSeconds)

      return true
    } catch (error) {
      logger.error(`Failed to update last ledger for ${contractName}:`, error)
      return false
    } finally {
      // Always release the lock
      releaseLock()
    }
  }

  /**
   * Get full state for a contract
   */
  async getState(contractName: string): Promise<IndexerStateData | null> {
    try {
      // Try cache first
      const cached = this.cache.get(contractName)
      if (cached) {
        return cached
      }

      // Fetch from database
      const state = await this.prisma.indexerState.findUnique({
        where: { contractName },
      })

      if (!state) {
        return null
      }

      const data: IndexerStateData = {
        contractName: state.contractName,
        lastLedger: state.lastLedger,
        lastEventId: state.lastEventId || undefined,
        lastProcessedAt: state.lastProcessedAt,
      }

      // Update cache
      this.cache.set(contractName, data)

      return data
    } catch (error) {
      logger.error(`Failed to get state for ${contractName}:`, error)
      return null
    }
  }

  /**
   * Get all contract states
   */
  async getAllStates(): Promise<IndexerStateData[]> {
    try {
      const states = await this.prisma.indexerState.findMany()

      return states.map((state) => ({
        contractName: state.contractName,
        lastLedger: state.lastLedger,
        lastEventId: state.lastEventId || undefined,
        lastProcessedAt: state.lastProcessedAt,
      }))
    } catch (error) {
      logger.error('Failed to get all states:', error)
      return []
    }
  }

  /**
   * Reset state for a contract (force re-index from beginning)
   */
  async resetState(contractName: string): Promise<boolean> {
    try {
      await this.prisma.indexerState.delete({
        where: { contractName },
      })

      this.cache.delete(contractName)

      logger.warn(`Reset state for ${contractName}`)
      return true
    } catch (error) {
      logger.error(`Failed to reset state for ${contractName}:`, error)
      return false
    }
  }

  /**
   * Clear cache (useful after manual database changes)
   */
  clearCache() {
    this.cache.clear()
    logger.info('State cache cleared')
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      contracts: Array.from(this.cache.keys()),
    }
  }
}
