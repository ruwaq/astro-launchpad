/**
 * Dead Letter Queue Service
 * Handles persistence and replay of failed blockchain events
 *
 * Features:
 * - Exponential backoff retry logic
 * - Configurable max retries
 * - Status tracking (PENDING, RETRYING, RESOLVED, ABANDONED)
 * - Admin alerting on abandoned events
 * - Statistics for monitoring
 */

import type { PrismaClient, FailedEventStatus } from '@astroshibapop/shared/prisma';
import { logger } from '../lib/logger.js';

// Event structure from batch processor
export interface BatchEvent {
  id: string;
  ledger: string;
  contract: string;
  eventType: string;
  data: Record<string, unknown>;
  timestamp: Date;
}

export interface DLQConfig {
  maxRetries: number;
  initialRetryDelayMs: number; // 1000 (1s)
  maxRetryDelayMs: number; // 300000 (5min)
  retryBackoffMultiplier: number; // 2 (exponential)
}

export const DEFAULT_DLQ_CONFIG: DLQConfig = {
  maxRetries: 5,
  initialRetryDelayMs: 1000,
  maxRetryDelayMs: 300000, // 5 minutes
  retryBackoffMultiplier: 2,
};

export interface DLQStats {
  pending: number;
  retrying: number;
  abandoned: number;
  resolved: number;
  duplicate: number;
}

export class DeadLetterQueue {
  constructor(
    private prisma: PrismaClient,
    private config: DLQConfig = DEFAULT_DLQ_CONFIG
  ) {}

  /**
   * Add failed event to DLQ
   */
  async addFailedEvent(
    event: BatchEvent,
    error: Error,
    failureReason: string,
    retryCount: number = 0
  ): Promise<void> {
    try {
      const nextRetryDelay = this.calculateNextRetryDelay(retryCount);
      const nextRetryAt =
        retryCount < this.config.maxRetries
          ? new Date(Date.now() + nextRetryDelay)
          : null;

      const status: FailedEventStatus =
        retryCount >= this.config.maxRetries ? 'ABANDONED' : 'PENDING';

      await this.prisma.failedEvent.upsert({
        where: { eventId: event.id },
        create: {
          eventId: event.id,
          eventType: event.eventType,
          contract: event.contract,
          ledger: event.ledger,
          eventData: event.data as object,
          errorMessage: error.message,
          errorStack: error.stack || null,
          failureReason,
          retryCount,
          maxRetries: this.config.maxRetries,
          nextRetryAt,
          status,
        },
        update: {
          retryCount,
          errorMessage: error.message,
          errorStack: error.stack || null,
          nextRetryAt,
          lastRetryAt: new Date(),
          status,
          updatedAt: new Date(),
        },
      });

      logger.warn(
        {
          eventId: event.id,
          eventType: event.eventType,
          retryCount,
          maxRetries: this.config.maxRetries,
          status,
          failureReason,
        },
        `Event added to DLQ (retry ${retryCount}/${this.config.maxRetries})`
      );

      // Alert on abandonment
      if (status === 'ABANDONED') {
        await this.alertAbandoned(event, error);
      }
    } catch (dlqError) {
      // Don't throw - we don't want DLQ failures to crash the indexer
      logger.error({ error: dlqError, eventId: event.id }, 'Failed to add event to DLQ');
    }
  }

  /**
   * Get events ready for retry
   */
  async getRetryableEvents(limit: number = 100): Promise<any[]> {
    return this.prisma.failedEvent.findMany({
      where: {
        status: 'PENDING',
        nextRetryAt: {
          lte: new Date(),
        },
      },
      orderBy: {
        nextRetryAt: 'asc',
      },
      take: limit,
    });
  }

  /**
   * Mark event as currently retrying
   */
  async markRetrying(eventId: string): Promise<void> {
    await this.prisma.failedEvent.update({
      where: { eventId },
      data: { status: 'RETRYING' },
    });
  }

  /**
   * Mark event as resolved (successfully processed)
   */
  async markResolved(
    eventId: string,
    resolvedBy: string = 'auto-retry',
    note?: string
  ): Promise<void> {
    await this.prisma.failedEvent.update({
      where: { eventId },
      data: {
        status: 'RESOLVED',
        resolvedAt: new Date(),
        resolvedBy,
        resolutionNote: note || null,
      },
    });

    logger.info({ eventId, resolvedBy }, 'DLQ event marked as resolved');
  }

  /**
   * Mark event as duplicate (already processed - idempotency)
   */
  async markDuplicate(eventId: string): Promise<void> {
    await this.prisma.failedEvent.update({
      where: { eventId },
      data: {
        status: 'DUPLICATE',
        resolvedAt: new Date(),
        resolutionNote: 'Event already processed (idempotency check)',
      },
    });
  }

  /**
   * Get a failed event by ID
   */
  async getFailedEvent(eventId: string) {
    return this.prisma.failedEvent.findUnique({
      where: { eventId },
    });
  }

  /**
   * List failed events with optional filters
   */
  async listFailedEvents(options: {
    status?: FailedEventStatus;
    contract?: string;
    eventType?: string;
    limit?: number;
    offset?: number;
  } = {}) {
    const { status, contract, eventType, limit = 100, offset = 0 } = options;

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (contract) where.contract = contract;
    if (eventType) where.eventType = eventType;

    return this.prisma.failedEvent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });
  }

  /**
   * Calculate next retry delay with exponential backoff
   * Delay = initialDelay * (multiplier ^ retryCount)
   * Capped at maxRetryDelayMs
   */
  private calculateNextRetryDelay(retryCount: number): number {
    const delay =
      this.config.initialRetryDelayMs *
      Math.pow(this.config.retryBackoffMultiplier, retryCount);

    return Math.min(delay, this.config.maxRetryDelayMs);
  }

  /**
   * Alert on abandoned events (requires manual intervention)
   */
  private async alertAbandoned(event: BatchEvent, error: Error): Promise<void> {
    logger.error(
      {
        eventId: event.id,
        eventType: event.eventType,
        contract: event.contract,
        ledger: event.ledger,
        error: error.message,
        maxRetries: this.config.maxRetries,
      },
      `EVENT ABANDONED - Manual intervention required`
    );

    // TODO: Integrate with alerting system (Slack, PagerDuty, etc.)
    // Example:
    // await sendSlackAlert({
    //   channel: '#indexer-alerts',
    //   message: `Event ${event.id} abandoned after ${this.config.maxRetries} retries`,
    //   severity: 'high',
    // });
  }

  /**
   * Get DLQ statistics for monitoring
   */
  async getStats(): Promise<DLQStats> {
    const [pending, retrying, abandoned, resolved, duplicate] = await Promise.all([
      this.prisma.failedEvent.count({ where: { status: 'PENDING' } }),
      this.prisma.failedEvent.count({ where: { status: 'RETRYING' } }),
      this.prisma.failedEvent.count({ where: { status: 'ABANDONED' } }),
      this.prisma.failedEvent.count({ where: { status: 'RESOLVED' } }),
      this.prisma.failedEvent.count({ where: { status: 'DUPLICATE' } }),
    ]);

    return { pending, retrying, abandoned, resolved, duplicate };
  }

  /**
   * Clean up old resolved/duplicate events (retention policy)
   * @param olderThanDays - Delete events older than this many days
   */
  async cleanupOldEvents(olderThanDays: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const result = await this.prisma.failedEvent.deleteMany({
      where: {
        status: { in: ['RESOLVED', 'DUPLICATE'] },
        resolvedAt: { lt: cutoffDate },
      },
    });

    if (result.count > 0) {
      logger.info({ deletedCount: result.count, olderThanDays }, 'Cleaned up old DLQ events');
    }

    return result.count;
  }
}
