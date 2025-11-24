/**
 * Fee Statistics Service
 * 
 * Professional service for aggregating and calculating fee statistics.
 * Handles:
 * - Real-time fee stats aggregation
 * - Time-window calculations (24h, 7d, 30d)
 * - Revenue analytics
 * - Performance-optimized queries
 * 
 * Architecture:
 * - Modular calculation methods
 * - Batch processing support
 * - Cache-friendly design
 * - Type-safe operations
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { logger } from '../lib/logger.js';
import type { FeeStats } from '../../../shared/types/index.js';

/**
 * Time window configurations
 */
const TIME_WINDOWS = {
  DAY: 24 * 60 * 60 * 1000,
  WEEK: 7 * 24 * 60 * 60 * 1000,
  MONTH: 30 * 24 * 60 * 60 * 1000,
} as const;

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
interface FeeRevenue {
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
interface TokenFeePerformance {
  tokenAddress: string;
  protocolFees: string;
  lpFees: string;
  totalFees: string;
  transactionCount: number;
  avgFeePerTransaction: string;
  rank: number;
}

/**
 * Fee Statistics Service
 */
export class FeeStatsService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Get global fee statistics
   */
  async getGlobalStats(): Promise<FeeStats | null> {
    try {
      const stats = await this.prisma.feeStats.findFirst({
        where: {
          tokenAddress: null,
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
          week: 0, // TODO: Add to schema if needed
          month: 0, // TODO: Add to schema if needed
        },
      };
    } catch (error) {
      logger.error('Error calculating revenue breakdown:', error);
      throw error;
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
      const oneDayAgo = new Date(now.getTime() - TIME_WINDOWS.DAY);
      const sevenDaysAgo = new Date(now.getTime() - TIME_WINDOWS.WEEK);
      const thirtyDaysAgo = new Date(now.getTime() - TIME_WINDOWS.MONTH);

      logger.info('Resetting expired fee time windows...');

      // Get all fee collections within time windows
      const recentFees = await this.prisma.feeCollection.groupBy({
        by: ['tokenAddress'],
        where: {
          timestamp: {
            gte: thirtyDaysAgo,
          },
        },
        _sum: {
          protocolFee: true as any,
          lpFee: true as any,
        },
        _count: true,
      });

      // Update stats for each token and global
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
   * Recalculate global fee statistics from source
   */
  private async recalculateGlobalStats(): Promise<void> {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - TIME_WINDOWS.DAY);
    const sevenDaysAgo = new Date(now.getTime() - TIME_WINDOWS.WEEK);
    const thirtyDaysAgo = new Date(now.getTime() - TIME_WINDOWS.MONTH);

    // Aggregate all fees
    const allFees = await this.prisma.feeCollection.aggregate({
      _sum: {
        protocolFee: true as any,
        lpFee: true as any,
      },
      _count: true,
    });

    // Aggregate 24h fees
    const fees24h = await this.prisma.feeCollection.aggregate({
      where: { timestamp: { gte: oneDayAgo } },
      _sum: {
        protocolFee: true as any,
        lpFee: true as any,
      },
      _count: true,
    });

    // Aggregate 7d fees
    const fees7d = await this.prisma.feeCollection.aggregate({
      where: { timestamp: { gte: sevenDaysAgo } },
      _sum: {
        protocolFee: true as any,
        lpFee: true as any,
      },
    });

    // Aggregate 30d fees
    const fees30d = await this.prisma.feeCollection.aggregate({
      where: { timestamp: { gte: thirtyDaysAgo } },
      _sum: {
        protocolFee: true as any,
        lpFee: true as any,
      },
    });

    // Aggregate creation fees
    const creationFeesAll = await this.prisma.feeCollection.aggregate({
      where: { type: 'CREATION_FEE' },
      _sum: { amount: true as any },
    });

    const creationFees24h = await this.prisma.feeCollection.aggregate({
      where: { type: 'CREATION_FEE', timestamp: { gte: oneDayAgo } },
      _sum: { amount: true as any },
    });

    const creationFees7d = await this.prisma.feeCollection.aggregate({
      where: { type: 'CREATION_FEE', timestamp: { gte: sevenDaysAgo } },
      _sum: { amount: true as any },
    });

    const creationFees30d = await this.prisma.feeCollection.aggregate({
      where: { type: 'CREATION_FEE', timestamp: { gte: thirtyDaysAgo } },
      _sum: { amount: true as any },
    });

    // Calculate totals
    const totalProtocolFees = (allFees._sum as any).protocolFee || '0';
    const totalLpFees = (allFees._sum as any).lpFee || '0';
    const totalCreationFees = (creationFeesAll._sum as any).amount || '0';

    const totalFees = (
      BigInt(totalProtocolFees) +
      BigInt(totalLpFees) +
      BigInt(totalCreationFees)
    ).toString();

    const totalFees24h = (
      BigInt((fees24h._sum as any).protocolFee || '0') +
      BigInt((fees24h._sum as any).lpFee || '0') +
      BigInt((creationFees24h._sum as any).amount || '0')
    ).toString();

    const totalFees7d = (
      BigInt((fees7d._sum as any).protocolFee || '0') +
      BigInt((fees7d._sum as any).lpFee || '0') +
      BigInt((creationFees7d._sum as any).amount || '0')
    ).toString();

    const totalFees30d = (
      BigInt((fees30d._sum as any).protocolFee || '0') +
      BigInt((fees30d._sum as any).lpFee || '0') +
      BigInt((creationFees30d._sum as any).amount || '0')
    ).toString();

    // Update or create global stats
    await this.prisma.feeStats.upsert({
      where: { tokenAddress: null },
      update: {
        totalProtocolFees,
        protocolFees24h: (fees24h._sum as any).protocolFee || '0',
        protocolFees7d: (fees7d._sum as any).protocolFee || '0',
        protocolFees30d: (fees30d._sum as any).protocolFee || '0',
        totalLpFees,
        lpFees24h: (fees24h._sum as any).lpFee || '0',
        lpFees7d: (fees7d._sum as any).lpFee || '0',
        lpFees30d: (fees30d._sum as any).lpFee || '0',
        totalCreationFees,
        creationFees24h: (creationFees24h._sum as any).amount || '0',
        creationFees7d: (creationFees7d._sum as any).amount || '0',
        creationFees30d: (creationFees30d._sum as any).amount || '0',
        totalFees,
        totalFees24h,
        totalFees7d,
        totalFees30d,
        totalTransactions: allFees._count,
        transactions24h: fees24h._count,
      },
      create: {
        tokenAddress: null,
        totalProtocolFees,
        protocolFees24h: (fees24h._sum as any).protocolFee || '0',
        protocolFees7d: (fees7d._sum as any).protocolFee || '0',
        protocolFees30d: (fees30d._sum as any).protocolFee || '0',
        totalLpFees,
        lpFees24h: (fees24h._sum as any).lpFee || '0',
        lpFees7d: (fees7d._sum as any).lpFee || '0',
        lpFees30d: (fees30d._sum as any).lpFee || '0',
        totalCreationFees,
        creationFees24h: (creationFees24h._sum as any).amount || '0',
        creationFees7d: (creationFees7d._sum as any).amount || '0',
        creationFees30d: (creationFees30d._sum as any).amount || '0',
        totalFees,
        totalFees24h,
        totalFees7d,
        totalFees30d,
        totalTransactions: allFees._count,
        transactions24h: fees24h._count,
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

    const where = { tokenAddress };

    // Aggregate all fees
    const allFees = await this.prisma.feeCollection.aggregate({
      where,
      _sum: {
        protocolFee: true as any,
        lpFee: true as any,
      },
      _count: true,
    });

    // Aggregate 24h fees
    const fees24h = await this.prisma.feeCollection.aggregate({
      where: { ...where, timestamp: { gte: oneDayAgo } },
      _sum: {
        protocolFee: true as any,
        lpFee: true as any,
      },
      _count: true,
    });

    // Aggregate 7d fees
    const fees7d = await this.prisma.feeCollection.aggregate({
      where: { ...where, timestamp: { gte: sevenDaysAgo } },
      _sum: {
        protocolFee: true as any,
        lpFee: true as any,
      },
    });

    // Aggregate 30d fees
    const fees30d = await this.prisma.feeCollection.aggregate({
      where: { ...where, timestamp: { gte: thirtyDaysAgo } },
      _sum: {
        protocolFee: true as any,
        lpFee: true as any,
      },
    });

    const totalProtocolFees = (allFees._sum as any).protocolFee || '0';
    const totalLpFees = (allFees._sum as any).lpFee || '0';
    const totalFees = (BigInt(totalProtocolFees) + BigInt(totalLpFees)).toString();

    const totalFees24h = (
      BigInt((fees24h._sum as any).protocolFee || '0') +
      BigInt((fees24h._sum as any).lpFee || '0')
    ).toString();

    const totalFees7d = (
      BigInt((fees7d._sum as any).protocolFee || '0') +
      BigInt((fees7d._sum as any).lpFee || '0')
    ).toString();

    const totalFees30d = (
      BigInt((fees30d._sum as any).protocolFee || '0') +
      BigInt((fees30d._sum as any).lpFee || '0')
    ).toString();

    // Update or create token stats
    await this.prisma.feeStats.upsert({
      where: { tokenAddress },
      update: {
        totalProtocolFees,
        protocolFees24h: (fees24h._sum as any).protocolFee || '0',
        protocolFees7d: (fees7d._sum as any).protocolFee || '0',
        protocolFees30d: (fees30d._sum as any).protocolFee || '0',
        totalLpFees,
        lpFees24h: (fees24h._sum as any).lpFee || '0',
        lpFees7d: (fees7d._sum as any).lpFee || '0',
        lpFees30d: (fees30d._sum as any).lpFee || '0',
        totalFees,
        totalFees24h,
        totalFees7d,
        totalFees30d,
        totalTransactions: allFees._count,
        transactions24h: fees24h._count,
      },
      create: {
        tokenAddress,
        totalProtocolFees,
        protocolFees24h: (fees24h._sum as any).protocolFee || '0',
        protocolFees7d: (fees7d._sum as any).protocolFee || '0',
        protocolFees30d: (fees30d._sum as any).protocolFee || '0',
        totalLpFees,
        lpFees24h: (fees24h._sum as any).lpFee || '0',
        lpFees7d: (fees7d._sum as any).lpFee || '0',
        lpFees30d: (fees30d._sum as any).lpFee || '0',
        totalFees,
        totalFees24h,
        totalFees7d,
        totalFees30d,
        totalTransactions: allFees._count,
        transactions24h: fees24h._count,
        totalCreationFees: '0',
        creationFees24h: '0',
        creationFees7d: '0',
        creationFees30d: '0',
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