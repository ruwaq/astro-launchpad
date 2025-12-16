/**
 * DLQ Maintenance Service
 *
 * Handles periodic maintenance tasks for the Dead Letter Queue:
 * - Clean up old resolved/duplicate events (retention policy)
 * - Retry pending events on schedule
 * - Generate DLQ health reports
 *
 * Usage:
 *   import { createDLQMaintenance } from './dlq-maintenance'
 *   const maintenance = createDLQMaintenance(prisma, dlq)
 *   maintenance.start()
 */

import type { PrismaClient } from '@astroshibapop/shared/prisma';
import cron from 'node-cron';
import { logger } from '../lib/logger.js';
import { DeadLetterQueue, DLQStats } from './dead-letter-queue.js';
import { alertDLQThresholdExceeded } from '../lib/alerting.js';

// ============================================================================
// Configuration
// ============================================================================

export interface DLQMaintenanceConfig {
  /** How long to retain resolved events (days) */
  retentionDays: number;
  /** Cron schedule for cleanup (default: daily at 3 AM) */
  cleanupSchedule: string;
  /** Cron schedule for retry processing (default: every 5 minutes) */
  retrySchedule: string;
  /** Cron schedule for health check (default: every hour) */
  healthCheckSchedule: string;
  /** Max events to retry per cycle */
  maxRetryBatch: number;
}

export const DEFAULT_DLQ_MAINTENANCE_CONFIG: DLQMaintenanceConfig = {
  retentionDays: 30,
  cleanupSchedule: '0 3 * * *', // 3:00 AM daily
  retrySchedule: '*/5 * * * *', // Every 5 minutes
  healthCheckSchedule: '0 * * * *', // Every hour
  maxRetryBatch: 50,
};

// ============================================================================
// Service
// ============================================================================

export interface DLQMaintenanceService {
  start(): void;
  stop(): void;
  runCleanup(): Promise<number>;
  runRetries(): Promise<number>;
  runHealthCheck(): Promise<DLQStats>;
}

export function createDLQMaintenance(
  prisma: PrismaClient,
  dlq: DeadLetterQueue,
  config: DLQMaintenanceConfig = DEFAULT_DLQ_MAINTENANCE_CONFIG
): DLQMaintenanceService {
  let cleanupJob: cron.ScheduledTask | null = null;
  let retryJob: cron.ScheduledTask | null = null;
  let healthCheckJob: cron.ScheduledTask | null = null;

  /**
   * Run cleanup of old resolved/duplicate events
   */
  async function runCleanup(): Promise<number> {
    const startTime = Date.now();
    try {
      logger.info('Starting DLQ cleanup...');
      const deletedCount = await dlq.cleanupOldEvents(config.retentionDays);
      const duration = Date.now() - startTime;
      logger.info({ deletedCount, duration, retentionDays: config.retentionDays },
        `DLQ cleanup completed: ${deletedCount} old events removed`);
      return deletedCount;
    } catch (error) {
      logger.error({ error }, 'DLQ cleanup failed');
      return 0;
    }
  }

  /**
   * Process pending retry events
   */
  async function runRetries(): Promise<number> {
    const startTime = Date.now();
    let processedCount = 0;

    try {
      const events = await dlq.getRetryableEvents(config.maxRetryBatch);

      if (events.length === 0) {
        return 0;
      }

      logger.info({ count: events.length }, 'Processing DLQ retry batch');

      for (const event of events) {
        try {
          await dlq.markRetrying(event.eventId);

          // The actual retry would be handled by the event processor
          // Here we just mark them as ready for retry
          // The event indexer will pick these up on next poll

          // For now, just update nextRetryAt to trigger a retry
          await prisma.failedEvent.update({
            where: { eventId: event.eventId },
            data: {
              status: 'PENDING',
              nextRetryAt: new Date(), // Ready for immediate retry
            },
          });

          processedCount++;
        } catch (error) {
          logger.error({ eventId: event.eventId, error }, 'Failed to process DLQ retry');
        }
      }

      const duration = Date.now() - startTime;
      logger.info({ processedCount, duration }, `DLQ retry batch completed`);

      return processedCount;
    } catch (error) {
      logger.error({ error }, 'DLQ retry processing failed');
      return processedCount;
    }
  }

  /**
   * Run health check and alert if necessary
   */
  async function runHealthCheck(): Promise<DLQStats> {
    try {
      const stats = await dlq.getStats();

      // Log current stats
      logger.info({
        pending: stats.pending,
        retrying: stats.retrying,
        abandoned: stats.abandoned,
        resolved: stats.resolved,
        duplicate: stats.duplicate,
      }, 'DLQ health check');

      // Check threshold and alert if needed
      alertDLQThresholdExceeded(stats.abandoned);

      // Warn if too many events are pending
      if (stats.pending > 100) {
        logger.warn({ pending: stats.pending },
          'High number of pending DLQ events - may indicate processing issues');
      }

      return stats;
    } catch (error) {
      logger.error({ error }, 'DLQ health check failed');
      return { pending: 0, retrying: 0, abandoned: 0, resolved: 0, duplicate: 0 };
    }
  }

  /**
   * Start all maintenance cron jobs
   */
  function start(): void {
    // Cleanup job (daily at 3 AM)
    cleanupJob = cron.schedule(config.cleanupSchedule, () => {
      runCleanup().catch(error => {
        logger.error({ error }, 'Scheduled DLQ cleanup failed');
      });
    });
    logger.info({ schedule: config.cleanupSchedule }, 'DLQ cleanup job scheduled');

    // Retry job (every 5 minutes)
    retryJob = cron.schedule(config.retrySchedule, () => {
      runRetries().catch(error => {
        logger.error({ error }, 'Scheduled DLQ retry processing failed');
      });
    });
    logger.info({ schedule: config.retrySchedule }, 'DLQ retry job scheduled');

    // Health check job (every hour)
    healthCheckJob = cron.schedule(config.healthCheckSchedule, () => {
      runHealthCheck().catch(error => {
        logger.error({ error }, 'Scheduled DLQ health check failed');
      });
    });
    logger.info({ schedule: config.healthCheckSchedule }, 'DLQ health check job scheduled');

    // Run initial health check
    runHealthCheck().catch(error => {
      logger.error({ error }, 'Initial DLQ health check failed');
    });
  }

  /**
   * Stop all maintenance cron jobs
   */
  function stop(): void {
    if (cleanupJob) {
      cleanupJob.stop();
      cleanupJob = null;
    }
    if (retryJob) {
      retryJob.stop();
      retryJob = null;
    }
    if (healthCheckJob) {
      healthCheckJob.stop();
      healthCheckJob = null;
    }
    logger.info('DLQ maintenance jobs stopped');
  }

  return {
    start,
    stop,
    runCleanup,
    runRetries,
    runHealthCheck,
  };
}
