/**
 * Fee Statistics Service
 * 
 * Professional service for aggregating and calculating fee statistics.
 * Handles:
 * - Real-time fee stats aggregation
 * - Time-window calculations (24h, 7d, 30d)
 * - Revenue analytics
 * - Performance-optimized queries via Raw SQL for BigInt aggregation
 * 
 * Architecture:
 * - Modular calculation methods
 * - Batch processing support
 * - Cache-friendly design
 * - Type-safe operations
 */

import { PrismaClient, Prisma } from '@astroshibapop/shared/prisma';
import { logger } from '../lib/logger.js';
import type { FeeStats } from '@astroshibapop/shared/types';

/**
 * Time window configurations
 */
const TIME_WINDOWS = {
  DAY: 24 * 60 * 60 * 1000,
  WEEK: 7 * 24 * 60 * 60 * 1000,
  MONTH: 30 * 24 * 60 * 60 * 1000,
} as const;

/**
 * Marker for global stats record in FeeStats table
 * Using a constant string instead of null/undefined for Prisma unique constraint compatibility
 */
export const GLOBAL_STATS_MARKER = 'GLOBAL';

/**
 * Fee statistics configuration
 */
interface FeeStatsConfig {
  includeTokenStats?: boolean;
  includeGlobalStats?: boolean;
  recalculateFromSource?: boolean;
}

/**
 * Fee revenue breakdown
 */
export interface FeeRevenue {
  protocolFees: {
    total: string;
    day: string;
    week: string;
    month: string;
  };
  lpFees: {
    total: string;
    day: string;
    week: string;
    month: string;
  };
  creationFees: {
    total: string;
    day: string;
    week: string;
    month: string;
  };
  totalRevenue: {
    total: string;
    day: string;
    week: string;
    month: string;
  };
  transactionCount: {
    total: number;
    day: number;
    week: number;
    month: number;
  };
}

/**
 * Token fee performance
 */
export interface TokenFeePerformance {
  tokenAddress: string;
  protocolFees: string;
  lpFees: string;
  totalFees: string;
  transactionCount: number;
  avgFeePerTransaction: string;
  rank: number;
}

/**
 * Raw aggregation result type
 */
interface FeeAggregation {
  protocolFees: bigint;
  lpFees: bigint;
  creationFees: bigint;
  count: bigint;
}

/**
 * Fee Statistics Service
 */
export class FeeStatsService {
  constructor(private prisma: PrismaClient) { }

  /**
   * Get global fee statistics
   */
  async getGlobalStats(): Promise<FeeStats | null> {
    try {
      const stats = await this.prisma.feeStats.findUnique({
        where: {
          tokenAddress: GLOBAL_STATS_MARKER,
        },
      });

      return stats as FeeStats | null;
    } catch (error) {
      logger.error('Error fetching global fee stats:', error);
      throw error;
    }
  }

  /**
   * Get fee statistics for a specific token
   */
  async getTokenStats(tokenAddress: string): Promise<FeeStats | null> {
    try {
      const stats = await this.prisma.feeStats.findUnique({
        where: {
          tokenAddress,
        },
      });

      return stats as FeeStats | null;
    } catch (error) {
      logger.error('Error fetching token fee stats:', {
        tokenAddress,
        error,
      });
      throw error;
    }
  }

  /**
   * Get comprehensive revenue breakdown
   */
  async getRevenueBreakdown(): Promise<FeeRevenue> {
    try {
      const stats = await this.getGlobalStats();

      if (!stats) {
        return this.getEmptyRevenue();
      }

      // Calculate transaction counts for 7d and 30d from Transaction table
      const [transactions7d, transactions30d] = await this.getTransactionCounts();

      return {
        protocolFees: {
          total: stats.totalProtocolFees,
          day: stats.protocolFees24h,
          week: stats.protocolFees7d,
          month: stats.protocolFees30d,
        },
        lpFees: {
          total: stats.totalLpFees,
          day: stats.lpFees24h,
          week: stats.lpFees7d,
          month: stats.lpFees30d,
        },
        creationFees: {
          total: stats.totalCreationFees,
          day: stats.creationFees24h,
          week: stats.creationFees7d,
          month: stats.creationFees30d,
        },
        totalRevenue: {
          total: stats.totalFees,
          day: stats.totalFees24h,
          week: stats.totalFees7d,
          month: stats.totalFees30d,
        },
        transactionCount: {
          total: stats.totalTransactions,
          day: stats.transactions24h,
          week: transactions7d,
          month: transactions30d,
        },
      };
    } catch (error) {
      logger.error('Error calculating revenue breakdown:', error);
      throw error;
    }
  }

  /**
   * Get transaction counts for 7d and 30d periods
   * @returns [transactions7d, transactions30d]
   */
  private async getTransactionCounts(): Promise<[number, number]> {
    try {
      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      // Run both counts in parallel for efficiency
      const [count7d, count30d] = await Promise.all([
        this.prisma.transaction.count({
          where: {
            timestamp: { gte: sevenDaysAgo },
            status: 'SUCCESS',
          },
        }),
        this.prisma.transaction.count({
          where: {
            timestamp: { gte: thirtyDaysAgo },
            status: 'SUCCESS',
          },
        }),
      ]);

      return [count7d, count30d];
    } catch (error) {
      logger.warn('Error fetching transaction counts, using 0:', error);
      return [0, 0];
    }
  }

  /**
   * Get top tokens by fee generation
   */
  async getTopTokensByFees(
    limit: number = 10,
    timeWindow: 'day' | 'week' | 'month' | 'all' = 'all'
  ): Promise<TokenFeePerformance[]> {
    try {
      const orderByField = this.getOrderByFieldForTimeWindow(timeWindow);

      const tokens = await this.prisma.feeStats.findMany({
        where: {
          tokenAddress: {
            not: null,
          },
        },
        orderBy: {
          [orderByField]: 'desc',
        },
        take: limit,
      });

      return tokens.map((token, index) => ({
        tokenAddress: token.tokenAddress!,
        protocolFees: token.totalProtocolFees,
        lpFees: token.totalLpFees,
        totalFees: token.totalFees,
        transactionCount: token.totalTransactions,
        avgFeePerTransaction: this.calculateAvgFee(
          token.totalFees,
          token.totalTransactions
        ),
        rank: index + 1,
      }));
    } catch (error) {
      logger.error('Error fetching top tokens by fees:', error);
      throw error;
    }
  }

  /**
   * Recalculate fee statistics from source
   * Use for data reconciliation or recovery
   */
  async recalculateStats(
    config: FeeStatsConfig = {}
  ): Promise<{ success: boolean; updated: number }> {
    try {
      logger.info('Starting fee stats recalculation...', config);

      const { includeTokenStats = true, includeGlobalStats = true } = config;

      let updated = 0;

      // Recalculate global stats
      if (includeGlobalStats) {
        await this.recalculateGlobalStats();
        updated++;
      }

      // Recalculate token stats
      if (includeTokenStats) {
        const tokenAddresses = await this.getUniqueTokenAddresses();

        for (const tokenAddress of tokenAddresses) {
          await this.recalculateTokenStats(tokenAddress);
          updated++;
        }
      }

      logger.info(`Fee stats recalculation complete. Updated: ${updated}`);

      return { success: true, updated };
    } catch (error) {
      logger.error('Error recalculating fee stats:', error);
      throw error;
    }
  }

  /**
   * Reset time-windowed stats (run daily)
   * Clears 24h stats that are older than 24h
   */
  async resetExpiredTimeWindows(): Promise<void> {
    try {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - TIME_WINDOWS.MONTH);

      logger.info('Resetting expired fee time windows...');

      // Get tokens active in the last 30 days
      const recentFees = await this.prisma.feeCollection.groupBy({
        by: ['tokenAddress'],
        where: {
          timestamp: {
            gte: thirtyDaysAgo,
          },
        },
      });

      // Update stats for each token
      for (const fee of recentFees) {
        await this.recalculateTokenStats(fee.tokenAddress);
      }

      // Recalculate global
      await this.recalculateGlobalStats();

      logger.info('Time window reset complete');
    } catch (error) {
      logger.error('Error resetting time windows:', error);
      throw error;
    }
  }

  /**
   * Get fee statistics summary for dashboard
   */
  async getDashboardSummary(): Promise<{
    revenue: FeeRevenue;
    topTokens: TokenFeePerformance[];
    recentGrowth: {
      protocolFees: string;
      lpFees: string;
      totalFees: string;
      percentageChange: number;
    };
  }> {
    try {
      const [revenue, topTokens] = await Promise.all([
        this.getRevenueBreakdown(),
        this.getTopTokensByFees(5, 'day'),
      ]);

      const growth = this.calculateGrowth(revenue);

      return {
        revenue,
        topTokens,
        recentGrowth: growth,
      };
    } catch (error) {
      logger.error('Error fetching dashboard summary:', error);
      throw error;
    }
  }

  /**
   * Calculate average fee per transaction
   */
  async getAverageFeePerTransaction(
    tokenAddress?: string
  ): Promise<{
    protocolFee: string;
    lpFee: string;
    totalFee: string;
  }> {
    try {
      const stats = tokenAddress
        ? await this.getTokenStats(tokenAddress)
        : await this.getGlobalStats();

      if (!stats || stats.totalTransactions === 0) {
        return {
          protocolFee: '0',
          lpFee: '0',
          totalFee: '0',
        };
      }

      return {
        protocolFee: this.calculateAvgFee(
          stats.totalProtocolFees,
          stats.totalTransactions
        ),
        lpFee: this.calculateAvgFee(
          stats.totalLpFees,
          stats.totalTransactions
        ),
        totalFee: this.calculateAvgFee(
          stats.totalFees,
          stats.totalTransactions
        ),
      };
    } catch (error) {
      logger.error('Error calculating average fee:', error);
      throw error;
    }
  }

  /**
   * Get fee collection history (paginated)
   */
  async getFeeCollectionHistory(params: {
    tokenAddress?: string;
    type?: string;
    limit?: number;
    offset?: number;
    startDate?: Date;
    endDate?: Date;
  }): Promise<{
    items: any[];
    total: number;
    hasMore: boolean;
  }> {
    try {
      const {
        tokenAddress,
        type,
        limit = 50,
        offset = 0,
        startDate,
        endDate,
      } = params;

      const where: Prisma.FeeCollectionWhereInput = {};

      if (tokenAddress) {
        where.tokenAddress = tokenAddress;
      }

      if (type) {
        where.type = type as any;
      }

      if (startDate || endDate) {
        where.timestamp = {};
        if (startDate) where.timestamp.gte = startDate;
        if (endDate) where.timestamp.lte = endDate;
      }

      const [items, total] = await Promise.all([
        this.prisma.feeCollection.findMany({
          where,
          orderBy: {
            timestamp: 'desc',
          },
          take: limit,
          skip: offset,
        }),
        this.prisma.feeCollection.count({ where }),
      ]);

      return {
        items,
        total,
        hasMore: offset + items.length < total,
      };
    } catch (error) {
      logger.error('Error fetching fee collection history:', error);
      throw error;
    }
  }

  // ========== Private Helper Methods ==========

  /**
   * Helper to aggregate fees using Raw SQL with Prisma.sql for type safety
   * Uses parameterized queries to prevent SQL injection
   */
  private async aggregateFeesSecure(
    filter: { type: 'all' } | { type: 'since'; timestamp: Date } | { type: 'token'; tokenAddress: string } | { type: 'tokenSince'; tokenAddress: string; timestamp: Date }
  ): Promise<FeeAggregation> {
    let result: any[];

    // Use type-safe Prisma.sql template literals for all queries
    switch (filter.type) {
      case 'all':
        result = await this.prisma.$queryRaw<any[]>`
          SELECT
            COALESCE(SUM(CAST(NULLIF("protocolFee", '') AS BIGINT)), 0) as "protocolFees",
            COALESCE(SUM(CAST(NULLIF("lpFee", '') AS BIGINT)), 0) as "lpFees",
            COALESCE(SUM(CASE WHEN "type" = 'CREATION_FEE' THEN CAST("amount" AS BIGINT) ELSE 0 END), 0) as "creationFees",
            COUNT(*) as "count"
          FROM "FeeCollection"
        `;
        break;
      case 'since':
        result = await this.prisma.$queryRaw<any[]>`
          SELECT
            COALESCE(SUM(CAST(NULLIF("protocolFee", '') AS BIGINT)), 0) as "protocolFees",
            COALESCE(SUM(CAST(NULLIF("lpFee", '') AS BIGINT)), 0) as "lpFees",
            COALESCE(SUM(CASE WHEN "type" = 'CREATION_FEE' THEN CAST("amount" AS BIGINT) ELSE 0 END), 0) as "creationFees",
            COUNT(*) as "count"
          FROM "FeeCollection"
          WHERE "timestamp" >= ${filter.timestamp}
        `;
        break;
      case 'token':
        result = await this.prisma.$queryRaw<any[]>`
          SELECT
            COALESCE(SUM(CAST(NULLIF("protocolFee", '') AS BIGINT)), 0) as "protocolFees",
            COALESCE(SUM(CAST(NULLIF("lpFee", '') AS BIGINT)), 0) as "lpFees",
            COALESCE(SUM(CASE WHEN "type" = 'CREATION_FEE' THEN CAST("amount" AS BIGINT) ELSE 0 END), 0) as "creationFees",
            COUNT(*) as "count"
          FROM "FeeCollection"
          WHERE "tokenAddress" = ${filter.tokenAddress}
        `;
        break;
      case 'tokenSince':
        result = await this.prisma.$queryRaw<any[]>`
          SELECT
            COALESCE(SUM(CAST(NULLIF("protocolFee", '') AS BIGINT)), 0) as "protocolFees",
            COALESCE(SUM(CAST(NULLIF("lpFee", '') AS BIGINT)), 0) as "lpFees",
            COALESCE(SUM(CASE WHEN "type" = 'CREATION_FEE' THEN CAST("amount" AS BIGINT) ELSE 0 END), 0) as "creationFees",
            COUNT(*) as "count"
          FROM "FeeCollection"
          WHERE "tokenAddress" = ${filter.tokenAddress} AND "timestamp" >= ${filter.timestamp}
        `;
        break;
    }

    if (!result || result.length === 0) {
      return { protocolFees: 0n, lpFees: 0n, creationFees: 0n, count: 0n };
    }

    return {
      protocolFees: BigInt(result[0].protocolFees || 0),
      lpFees: BigInt(result[0].lpFees || 0),
      creationFees: BigInt(result[0].creationFees || 0),
      count: BigInt(result[0].count || 0),
    };
  }

  /**
   * Recalculate global fee statistics from source
   */
  private async recalculateGlobalStats(): Promise<void> {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - TIME_WINDOWS.DAY);
    const sevenDaysAgo = new Date(now.getTime() - TIME_WINDOWS.WEEK);
    const thirtyDaysAgo = new Date(now.getTime() - TIME_WINDOWS.MONTH);

    // All Time
    const all = await this.aggregateFeesSecure({ type: 'all' });
    // 24h
    const day = await this.aggregateFeesSecure({ type: 'since', timestamp: oneDayAgo });
    // 7d
    const week = await this.aggregateFeesSecure({ type: 'since', timestamp: sevenDaysAgo });
    // 30d
    const month = await this.aggregateFeesSecure({ type: 'since', timestamp: thirtyDaysAgo });

    const totalFees = (all.protocolFees + all.lpFees + all.creationFees).toString();
    const totalFees24h = (day.protocolFees + day.lpFees + day.creationFees).toString();
    const totalFees7d = (week.protocolFees + week.lpFees + week.creationFees).toString();
    const totalFees30d = (month.protocolFees + month.lpFees + month.creationFees).toString();

    // Prepare stats data
    const statsData = {
      totalProtocolFees: all.protocolFees.toString(),
      protocolFees24h: day.protocolFees.toString(),
      protocolFees7d: week.protocolFees.toString(),
      protocolFees30d: month.protocolFees.toString(),

      totalLpFees: all.lpFees.toString(),
      lpFees24h: day.lpFees.toString(),
      lpFees7d: week.lpFees.toString(),
      lpFees30d: month.lpFees.toString(),

      totalCreationFees: all.creationFees.toString(),
      creationFees24h: day.creationFees.toString(),
      creationFees7d: week.creationFees.toString(),
      creationFees30d: month.creationFees.toString(),

      totalFees,
      totalFees24h,
      totalFees7d,
      totalFees30d,

      totalTransactions: Number(all.count),
      transactions24h: Number(day.count),
    };

    // Use GLOBAL_STATS_MARKER instead of null for Prisma unique constraint compatibility
    await this.prisma.feeStats.upsert({
      where: { tokenAddress: GLOBAL_STATS_MARKER },
      update: statsData,
      create: {
        tokenAddress: GLOBAL_STATS_MARKER,
        ...statsData,
      },
    });
  }

  /**
   * Recalculate token-specific fee statistics
   */
  private async recalculateTokenStats(tokenAddress: string): Promise<void> {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - TIME_WINDOWS.DAY);
    const sevenDaysAgo = new Date(now.getTime() - TIME_WINDOWS.WEEK);
    const thirtyDaysAgo = new Date(now.getTime() - TIME_WINDOWS.MONTH);

    // All Time
    const all = await this.aggregateFeesSecure({ type: 'token', tokenAddress });
    // 24h
    const day = await this.aggregateFeesSecure({ type: 'tokenSince', tokenAddress, timestamp: oneDayAgo });
    // 7d
    const week = await this.aggregateFeesSecure({ type: 'tokenSince', tokenAddress, timestamp: sevenDaysAgo });
    // 30d
    const month = await this.aggregateFeesSecure({ type: 'tokenSince', tokenAddress, timestamp: thirtyDaysAgo });

    const totalFees = (all.protocolFees + all.lpFees + all.creationFees).toString();
    const totalFees24h = (day.protocolFees + day.lpFees + day.creationFees).toString();
    const totalFees7d = (week.protocolFees + week.lpFees + week.creationFees).toString();
    const totalFees30d = (month.protocolFees + month.lpFees + month.creationFees).toString();

    await this.prisma.feeStats.upsert({
      where: { tokenAddress },
      update: {
        totalProtocolFees: all.protocolFees.toString(),
        protocolFees24h: day.protocolFees.toString(),
        protocolFees7d: week.protocolFees.toString(),
        protocolFees30d: month.protocolFees.toString(),

        totalLpFees: all.lpFees.toString(),
        lpFees24h: day.lpFees.toString(),
        lpFees7d: week.lpFees.toString(),
        lpFees30d: month.lpFees.toString(),

        // Creation fees usually happen once, but safe to aggregate
        totalCreationFees: all.creationFees.toString(),
        creationFees24h: day.creationFees.toString(),
        creationFees7d: week.creationFees.toString(),
        creationFees30d: month.creationFees.toString(),

        totalFees,
        totalFees24h,
        totalFees7d,
        totalFees30d,

        totalTransactions: Number(all.count),
        transactions24h: Number(day.count),
      },
      create: {
        tokenAddress,
        totalProtocolFees: all.protocolFees.toString(),
        protocolFees24h: day.protocolFees.toString(),
        protocolFees7d: week.protocolFees.toString(),
        protocolFees30d: month.protocolFees.toString(),

        totalLpFees: all.lpFees.toString(),
        lpFees24h: day.lpFees.toString(),
        lpFees7d: week.lpFees.toString(),
        lpFees30d: month.lpFees.toString(),

        totalCreationFees: all.creationFees.toString(),
        creationFees24h: day.creationFees.toString(),
        creationFees7d: week.creationFees.toString(),
        creationFees30d: month.creationFees.toString(),

        totalFees,
        totalFees24h,
        totalFees7d,
        totalFees30d,

        totalTransactions: Number(all.count),
        transactions24h: Number(day.count),
      },
    });
  }

  /**
   * Get unique token addresses from fee collections
   */
  private async getUniqueTokenAddresses(): Promise<string[]> {
    const result = await this.prisma.feeCollection.findMany({
      select: {
        tokenAddress: true,
      },
      distinct: ['tokenAddress'],
    });

    return result.map((r) => r.tokenAddress);
  }

  /**
   * Calculate average fee
   */
  private calculateAvgFee(totalFees: string, count: number): string {
    if (count === 0) return '0';
    return (BigInt(totalFees) / BigInt(count)).toString();
  }

  /**
   * Get order by field for time window
   */
  private getOrderByFieldForTimeWindow(
    timeWindow: 'day' | 'week' | 'month' | 'all'
  ): string {
    switch (timeWindow) {
      case 'day':
        return 'totalFees24h';
      case 'week':
        return 'totalFees7d';
      case 'month':
        return 'totalFees30d';
      case 'all':
      default:
        return 'totalFees';
    }
  }

  /**
   * Calculate growth metrics
   */
  private calculateGrowth(revenue: FeeRevenue): {
    protocolFees: string;
    lpFees: string;
    totalFees: string;
    percentageChange: number;
  } {
    const weekTotal = BigInt(revenue.totalRevenue.week);
    const dayTotal = BigInt(revenue.totalRevenue.day);

    // Calculate 7-day average
    const weekAvg = weekTotal / BigInt(7);

    // Calculate percentage change
    let percentageChange = 0;
    if (weekAvg > BigInt(0)) {
      const diff = dayTotal - weekAvg;
      percentageChange = Number((diff * BigInt(100)) / weekAvg);
    }

    return {
      protocolFees: revenue.protocolFees.day,
      lpFees: revenue.lpFees.day,
      totalFees: revenue.totalRevenue.day,
      percentageChange,
    };
  }

  /**
   * Get empty revenue object
   */
  private getEmptyRevenue(): FeeRevenue {
    return {
      protocolFees: { total: '0', day: '0', week: '0', month: '0' },
      lpFees: { total: '0', day: '0', week: '0', month: '0' },
      creationFees: { total: '0', day: '0', week: '0', month: '0' },
      totalRevenue: { total: '0', day: '0', week: '0', month: '0' },
      transactionCount: { total: 0, day: 0, week: 0, month: 0 },
    };
  }
}
