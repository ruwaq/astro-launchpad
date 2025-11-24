/**
 * Fee Stats Maintenance Service
 * 
 * Handles periodic maintenance tasks for fee statistics:
 * - Reset expired time windows (daily)
 * - Recalculate stats for accuracy (hourly)
 * - Clean up old records (weekly)
 * - Generate reports (daily)
 * 
 * Usage:
 *   import { FeeStatsMaintenance } from './fee-stats-maintenance'
 *   const maintenance = new FeeStatsMaintenance(prisma)
 *   await maintenance.startCronJobs()
 */

import { PrismaClient } from '@prisma/client';
import { logger } from '../lib/logger.js';
import { FeeStatsService } from './fee-stats.service.js';
import cron from 'node-cron';

/**
 * Maintenance task result
 */
interface MaintenanceResult {
  task: string;
  success: boolean;
  duration: number;
  recordsProcessed?: number;
  error?: string;
}

/**
 * Maintenance configuration
 */
interface MaintenanceConfig {
  enabledTasks: {
    resetTimeWindows: boolean;
    recalculateStats: boolean;
    cleanupOldRecords: boolean;
    generateReports: boolean;
  };
  schedules: {
    resetTimeWindows: string; // Cron expression
    recalculateStats: string;
    cleanupOldRecords: string;
    generateReports: string;
  };
  retention: {
    feeCollectionDays: number; // Keep raw records for X days
    statsHistoryDays: number; // Keep historical stats for X days
  };
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: MaintenanceConfig = {
  enabledTasks: {
    resetTimeWindows: true,
    recalculateStats: true,
    cleanupOldRecords: true,
    generateReports: true,
  },
  schedules: {
    resetTimeWindows: '0 0 * * *', // Daily at midnight
    recalculateStats: '0 * * * *', // Every hour
    cleanupOldRecords: '0 3 * * 0', // Weekly on Sunday at 3 AM
    generateReports: '0 1 * * *', // Daily at 1 AM
  },
  retention: {
    feeCollectionDays: 90, // Keep raw records for 90 days
    statsHistoryDays: 365, // Keep stats for 1 year
  },
};

/**
 * Fee Stats Maintenance Service
 */
export class FeeStatsMaintenance {
  private feeStatsService: FeeStatsService;
  private config: MaintenanceConfig;
  private cronJobs: cron.ScheduledTask[] = [];
  private isRunning: boolean = false;

  constructor(
    private prisma: PrismaClient,
    config: Partial<MaintenanceConfig> = {}
  ) {
    this.feeStatsService = new FeeStatsService(prisma);
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Start all cron jobs
   */
  async startCronJobs(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Maintenance cron jobs are already running');
      return;
    }

    logger.info('🔧 Starting Fee Stats Maintenance cron jobs...');

    // Task 1: Reset expired time windows (daily)
    if (this.config.enabledTasks.resetTimeWindows) {
      const job1 = cron.schedule(
        this.config.schedules.resetTimeWindows,
        async () => {
          await this.runTask('resetTimeWindows', () =>
            this.resetExpiredTimeWindows()
          );
        }
      );
      this.cronJobs.push(job1);
      logger.info(
        `  ✅ Reset time windows: ${this.config.schedules.resetTimeWindows}`
      );
    }

    // Task 2: Recalculate stats (hourly)
    if (this.config.enabledTasks.recalculateStats) {
      const job2 = cron.schedule(
        this.config.schedules.recalculateStats,
        async () => {
          await this.runTask('recalculateStats', () =>
            this.recalculateStats()
          );
        }
      );
      this.cronJobs.push(job2);
      logger.info(
        `  ✅ Recalculate stats: ${this.config.schedules.recalculateStats}`
      );
    }

    // Task 3: Cleanup old records (weekly)
    if (this.config.enabledTasks.cleanupOldRecords) {
      const job3 = cron.schedule(
        this.config.schedules.cleanupOldRecords,
        async () => {
          await this.runTask('cleanupOldRecords', () =>
            this.cleanupOldRecords()
          );
        }
      );
      this.cronJobs.push(job3);
      logger.info(
        `  ✅ Cleanup old records: ${this.config.schedules.cleanupOldRecords}`
      );
    }

    // Task 4: Generate reports (daily)
    if (this.config.enabledTasks.generateReports) {
      const job4 = cron.schedule(
        this.config.schedules.generateReports,
        async () => {
          await this.runTask('generateReports', () => this.generateReports());
        }
      );
      this.cronJobs.push(job4);
      logger.info(
        `  ✅ Generate reports: ${this.config.schedules.generateReports}`
      );
    }

    this.isRunning = true;
    logger.info(
      `🚀 Fee Stats Maintenance started with ${this.cronJobs.length} cron jobs`
    );
  }

  /**
   * Stop all cron jobs
   */
  stopCronJobs(): void {
    logger.info('🛑 Stopping Fee Stats Maintenance cron jobs...');

    for (const job of this.cronJobs) {
      job.stop();
    }

    this.cronJobs = [];
    this.isRunning = false;

    logger.info('✅ Fee Stats Maintenance stopped');
  }

  /**
   * Run a maintenance task with error handling and logging
   */
  private async runTask(
    taskName: string,
    taskFn: () => Promise<number>
  ): Promise<MaintenanceResult> {
    const startTime = Date.now();
    logger.info(`🔧 Running maintenance task: ${taskName}`);

    try {
      const recordsProcessed = await taskFn();
      const duration = Date.now() - startTime;

      logger.info(
        `✅ Task ${taskName} completed in ${duration}ms (${recordsProcessed} records)`
      );

      return {
        task: taskName,
        success: true,
        duration,
        recordsProcessed,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      logger.error(`❌ Task ${taskName} failed after ${duration}ms:`, error);

      return {
        task: taskName,
        success: false,
        duration,
        error: errorMessage,
      };
    }
  }

  /**
   * Task 1: Reset expired time windows
   */
  private async resetExpiredTimeWindows(): Promise<number> {
    await this.feeStatsService.resetExpiredTimeWindows();
    return 0; // Returns number of records processed
  }

  /**
   * Task 2: Recalculate statistics for accuracy
   */
  private async recalculateStats(): Promise<number> {
    const result = await this.feeStatsService.recalculateStats({
      includeTokenStats: true,
      includeGlobalStats: true,
    });

    return result.updated;
  }

  /**
   * Task 3: Cleanup old records
   */
  private async cleanupOldRecords(): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(
      cutoffDate.getDate() - this.config.retention.feeCollectionDays
    );

    logger.info(`Cleaning up fee collections older than ${cutoffDate.toISOString()}`);

    // Delete old fee collection records
    const result = await this.prisma.feeCollection.deleteMany({
      where: {
        timestamp: {
          lt: cutoffDate,
        },
      },
    });

    logger.info(`Deleted ${result.count} old fee collection records`);

    return result.count;
  }

  /**
   * Task 4: Generate daily reports
   */
  private async generateReports(): Promise<number> {
    logger.info('Generating daily fee reports...');

    // Get revenue breakdown
    const revenue = await this.feeStatsService.getRevenueBreakdown();

    // Get top tokens
    const topTokens = await this.feeStatsService.getTopTokensByFees(10, 'day');

    // Log report
    logger.info('\n' + '='.repeat(80));
    logger.info('📊 DAILY FEE REPORT');
    logger.info('='.repeat(80));

    logger.info('\n💰 Revenue (Last 24h):');
    logger.info(
      `  Protocol Fees: ${this.formatXLM(revenue.protocolFees.day)}`
    );
    logger.info(`  LP Fees: ${this.formatXLM(revenue.lpFees.day)}`);
    logger.info(
      `  Creation Fees: ${this.formatXLM(revenue.creationFees.day)}`
    );
    logger.info(`  Total: ${this.formatXLM(revenue.totalRevenue.day)}`);
    logger.info(`  Transactions: ${revenue.transactionCount.day}`);

    logger.info('\n📈 Revenue (Last 7d):');
    logger.info(
      `  Protocol Fees: ${this.formatXLM(revenue.protocolFees.week)}`
    );
    logger.info(`  LP Fees: ${this.formatXLM(revenue.lpFees.week)}`);
    logger.info(
      `  Creation Fees: ${this.formatXLM(revenue.creationFees.week)}`
    );
    logger.info(`  Total: ${this.formatXLM(revenue.totalRevenue.week)}`);

    logger.info('\n🏆 Top 10 Tokens (Last 24h):');
    topTokens.forEach((token, index) => {
      logger.info(
        `  ${index + 1}. ${token.tokenAddress.substring(0, 8)}... - ${this.formatXLM(token.totalFees)}`
      );
    });

    logger.info('\n' + '='.repeat(80));

    // TODO: Send report via email/webhook if configured

    return 1; // 1 report generated
  }

  /**
   * Run all maintenance tasks once (for testing/manual execution)
   */
  async runAllTasks(): Promise<MaintenanceResult[]> {
    logger.info('🔧 Running all maintenance tasks manually...');

    const results: MaintenanceResult[] = [];

    if (this.config.enabledTasks.resetTimeWindows) {
      results.push(
        await this.runTask('resetTimeWindows', () =>
          this.resetExpiredTimeWindows()
        )
      );
    }

    if (this.config.enabledTasks.recalculateStats) {
      results.push(
        await this.runTask('recalculateStats', () => this.recalculateStats())
      );
    }

    if (this.config.enabledTasks.cleanupOldRecords) {
      results.push(
        await this.runTask('cleanupOldRecords', () => this.cleanupOldRecords())
      );
    }

    if (this.config.enabledTasks.generateReports) {
      results.push(
        await this.runTask('generateReports', () => this.generateReports())
      );
    }

    // Summary
    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    logger.info(
      `\n📊 Maintenance Summary: ${successful} succeeded, ${failed} failed`
    );

    return results;
  }

  /**
   * Get current maintenance status
   */
  getStatus(): {
    isRunning: boolean;
    activeCronJobs: number;
    config: MaintenanceConfig;
  } {
    return {
      isRunning: this.isRunning,
      activeCronJobs: this.cronJobs.length,
      config: this.config,
    };
  }

  /**
   * Helper: Format stroops to XLM
   */
  private formatXLM(stroops: string): string {
    try {
      const xlm = Number(stroops) / 10_000_000;
      return `${xlm.toFixed(2)} XLM`;
    } catch {
      return '0.00 XLM';
    }
  }
}

/**
 * Create and start maintenance service (singleton pattern)
 */
let maintenanceInstance: FeeStatsMaintenance | null = null;

export async function startFeeStatsMaintenance(
  prisma: PrismaClient,
  config?: Partial<MaintenanceConfig>
): Promise<FeeStatsMaintenance> {
  if (maintenanceInstance) {
    logger.warn('Fee Stats Maintenance is already running');
    return maintenanceInstance;
  }

  maintenanceInstance = new FeeStatsMaintenance(prisma, config);
  await maintenanceInstance.startCronJobs();

  return maintenanceInstance;
}

/**
 * Stop maintenance service
 */
export function stopFeeStatsMaintenance(): void {
  if (maintenanceInstance) {
    maintenanceInstance.stopCronJobs();
    maintenanceInstance = null;
  }
}

/**
 * Get current maintenance instance
 */
export function getFeeStatsMaintenance(): FeeStatsMaintenance | null {
  return maintenanceInstance;
}

/**
 * CLI execution
 */
async function main() {
  const prisma = new PrismaClient();

  try {
    const args = process.argv.slice(2);
    const runOnce = args.includes('--once');

    const maintenance = new FeeStatsMaintenance(prisma);

    if (runOnce) {
      // Run all tasks once
      logger.info('Running all maintenance tasks once...');
      await maintenance.runAllTasks();
    } else {
      // Start cron jobs
      await maintenance.startCronJobs();

      // Keep process alive
      process.on('SIGINT', () => {
        logger.info('Received SIGINT, stopping maintenance...');
        maintenance.stopCronJobs();
        prisma.$disconnect();
        process.exit(0);
      });

      process.on('SIGTERM', () => {
        logger.info('Received SIGTERM, stopping maintenance...');
        maintenance.stopCronJobs();
        prisma.$disconnect();
        process.exit(0);
      });
    }
  } catch (error) {
    logger.error('Fatal error:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}