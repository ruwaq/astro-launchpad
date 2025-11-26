/**
 * Fee GraphQL Resolvers
 * 
 * Professional GraphQL resolvers for fee statistics and analytics.
 */

import { GraphQLError } from 'graphql';
import type { GraphQLContext } from '../context.js';
import { requireAdmin } from '../context.js';
import { FeeStatsService } from '../../lib/fee-stats-service.js';
import type { FeeRevenue, TokenFeePerformance } from '../../lib/fee-stats-service.js';
import { logger } from '../../lib/logger.js';

/**
 * Cache TTLs for different query types
 */
const CACHE_TTL = {
  FEE_STATS: 30, // 30 seconds - fast-changing data
  REVENUE_BREAKDOWN: 60, // 1 minute
  TOP_TOKENS: 120, // 2 minutes
  FEE_HISTORY: 300, // 5 minutes
  DASHBOARD: 30, // 30 seconds - real-time
} as const;

/**
 * Fee Statistics Input
 */
interface FeeStatsInput {
  tokenAddress?: string;
}

/**
 * Top Tokens Input
 */
interface TopTokensByFeesInput {
  limit?: number;
  timeWindow?: 'day' | 'week' | 'month' | 'all';
}

/**
 * Fee History Input
 */
interface FeeHistoryInput {
  tokenAddress?: string;
  type?: string;
  limit?: number;
  offset?: number;
  startDate?: string;
  endDate?: string;
}

/**
 * Fee Query Resolvers
 */
export const feeQueryResolvers = {
  /**
   * Get global fee statistics
   */
  async globalFeeStats(_parent: any, _args: any, context: GraphQLContext) {
    try {
      const service = new FeeStatsService(context.prisma);
      const stats = await service.getGlobalStats();

      if (!stats) {
        return {
          totalProtocolFees: '0',
          protocolFees24h: '0',
          protocolFees7d: '0',
          protocolFees30d: '0',
          totalLpFees: '0',
          lpFees24h: '0',
          lpFees7d: '0',
          lpFees30d: '0',
          totalCreationFees: '0',
          creationFees24h: '0',
          creationFees7d: '0',
          creationFees30d: '0',
          totalFees: '0',
          totalFees24h: '0',
          totalFees7d: '0',
          totalFees30d: '0',
          totalTransactions: 0,
          transactions24h: 0,
          updatedAt: new Date(),
        };
      }

      return stats;
    } catch (error) {
      // @ts-ignore - Pino logger signature
      logger.error('Error fetching global fee stats:', error);
      throw new GraphQLError('Failed to fetch global fee statistics', {
        extensions: {
          code: 'INTERNAL_SERVER_ERROR',
        },
      });
    }
  },

  /**
   * Get token-specific fee statistics
   */
  async tokenFeeStats(
    _parent: any,
    args: FeeStatsInput,
    context: GraphQLContext
  ) {
    try {
      if (!args.tokenAddress) {
        throw new GraphQLError('Token address is required', {
          extensions: {
            code: 'BAD_USER_INPUT',
          },
        });
      }

      const service = new FeeStatsService(context.prisma);
      const stats = await service.getTokenStats(args.tokenAddress);

      if (!stats) {
        return null;
      }

      return stats;
    } catch (error) {
      if (error instanceof GraphQLError) throw error;

      // @ts-ignore - Pino logger signature
      logger.error('Error fetching token fee stats:', {
        tokenAddress: args.tokenAddress,
        error,
      });
      throw new GraphQLError('Failed to fetch token fee statistics', {
        extensions: {
          code: 'INTERNAL_SERVER_ERROR',
        },
      });
    }
  },

  /**
   * Get comprehensive revenue breakdown
   */
  async revenueBreakdown(_parent: any, _args: any, context: GraphQLContext) {
    try {
      const service = new FeeStatsService(context.prisma);
      const revenue = await service.getRevenueBreakdown();

      return {
        protocolFees: revenue.protocolFees,
        lpFees: revenue.lpFees,
        creationFees: revenue.creationFees,
        totalRevenue: revenue.totalRevenue,
        transactionCount: revenue.transactionCount,
      };
    } catch (error) {
      // @ts-ignore - Pino logger signature
      logger.error('Error fetching revenue breakdown:', error);
      throw new GraphQLError('Failed to fetch revenue breakdown', {
        extensions: {
          code: 'INTERNAL_SERVER_ERROR',
        },
      });
    }
  },

  /**
   * Get top tokens by fee generation
   */
  async topTokensByFees(
    _parent: any,
    args: TopTokensByFeesInput,
    context: GraphQLContext
  ) {
    try {
      const { limit = 10, timeWindow = 'all' } = args;

      if (limit < 1 || limit > 100) {
        throw new GraphQLError('Limit must be between 1 and 100', {
          extensions: {
            code: 'BAD_USER_INPUT',
          },
        });
      }

      const service = new FeeStatsService(context.prisma);
      const tokens = await service.getTopTokensByFees(limit, timeWindow);

      return tokens;
    } catch (error) {
      if (error instanceof GraphQLError) throw error;

      // @ts-ignore - Pino logger signature
      logger.error('Error fetching top tokens by fees:', error);
      throw new GraphQLError('Failed to fetch top tokens', {
        extensions: {
          code: 'INTERNAL_SERVER_ERROR',
        },
      });
    }
  },

  /**
   * Get fee collection history (paginated)
   */
  async feeCollectionHistory(
    _parent: any,
    args: FeeHistoryInput,
    context: GraphQLContext
  ) {
    try {
      const {
        tokenAddress,
        type,
        limit = 50,
        offset = 0,
        startDate,
        endDate,
      } = args;

      if (limit < 1 || limit > 100) {
        throw new GraphQLError('Limit must be between 1 and 100', {
          extensions: {
            code: 'BAD_USER_INPUT',
          },
        });
      }

      const service = new FeeStatsService(context.prisma);
      const result = await service.getFeeCollectionHistory({
        tokenAddress,
        type,
        limit,
        offset,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
      });

      return {
        items: result.items,
        total: result.total,
        hasMore: result.hasMore,
        pageInfo: {
          hasNextPage: result.hasMore,
          hasPreviousPage: offset > 0,
          offset,
          limit,
        },
      };
    } catch (error) {
      if (error instanceof GraphQLError) throw error;

      // @ts-ignore - Pino logger signature
      logger.error('Error fetching fee collection history:', error);
      throw new GraphQLError('Failed to fetch fee collection history', {
        extensions: {
          code: 'INTERNAL_SERVER_ERROR',
        },
      });
    }
  },

  /**
   * Get dashboard summary with all key metrics
   */
  async feeDashboard(_parent: any, _args: any, context: GraphQLContext) {
    try {
      const service = new FeeStatsService(context.prisma);
      const summary = await service.getDashboardSummary();

      return {
        revenue: summary.revenue,
        topTokens: summary.topTokens,
        recentGrowth: summary.recentGrowth,
        timestamp: new Date(),
      };
    } catch (error) {
      // @ts-ignore - Pino logger signature
      logger.error('Error fetching fee dashboard:', error);
      throw new GraphQLError('Failed to fetch fee dashboard', {
        extensions: {
          code: 'INTERNAL_SERVER_ERROR',
        },
      });
    }
  },

  /**
   * Get average fee per transaction
   */
  async averageFeePerTransaction(
    _parent: any,
    args: FeeStatsInput,
    context: GraphQLContext
  ) {
    try {
      const service = new FeeStatsService(context.prisma);
      const avg = await service.getAverageFeePerTransaction(args.tokenAddress);

      return avg;
    } catch (error) {
      // @ts-ignore - Pino logger signature
      logger.error('Error fetching average fee:', error);
      throw new GraphQLError('Failed to fetch average fee', {
        extensions: {
          code: 'INTERNAL_SERVER_ERROR',
        },
      });
    }
  },

  /**
   * Get current fee configuration
   */
  async feeConfig(_parent: any, _args: any, context: GraphQLContext) {
    try {
      // Get contract address from config
      const contractAddress = process.env.SAC_FACTORY_ADDRESS;

      if (!contractAddress) {
        throw new GraphQLError('Contract address not configured', {
          extensions: {
            code: 'INTERNAL_SERVER_ERROR',
          },
        });
      }

      const config = await context.prisma.feeConfig.findUnique({
        where: {
          contractAddress,
        },
      });

      if (!config) {
        // Return default config
        return {
          protocolFeeBps: 5,
          lpFeeBps: 25,
          creationFee: '100000000',
          treasuryAddress: contractAddress,
          effectiveFrom: new Date(),
        };
      }

      return config;
    } catch (error) {
      if (error instanceof GraphQLError) throw error;

      // @ts-ignore - Pino logger signature
      logger.error('Error fetching fee config:', error);
      throw new GraphQLError('Failed to fetch fee configuration', {
        extensions: {
          code: 'INTERNAL_SERVER_ERROR',
        },
      });
    }
  },
};

/**
 * Fee Mutation Resolvers (Admin only)
 */
export const feeMutationResolvers = {
  /**
   * Recalculate fee statistics (Admin only)
   */
  async recalculateFeeStats(
    _parent: any,
    args: { includeTokenStats?: boolean; includeGlobalStats?: boolean },
    context: GraphQLContext
  ) {
    try {
      // Require admin privileges
      requireAdmin(context);

      const service = new FeeStatsService(context.prisma);
      const result = await service.recalculateStats({
        includeTokenStats: args.includeTokenStats,
        includeGlobalStats: args.includeGlobalStats,
      });

      // @ts-ignore - Pino logger signature
      logger.info('Fee stats recalculated', result);

      return {
        success: result.success,
        message: `Successfully recalculated ${result.updated} fee statistics`,
        updated: result.updated,
      };
    } catch (error) {
      if (error instanceof GraphQLError) throw error;

      // @ts-ignore - Pino logger signature
      logger.error('Error recalculating fee stats:', error);
      throw new GraphQLError('Failed to recalculate fee statistics', {
        extensions: {
          code: 'INTERNAL_SERVER_ERROR',
        },
      });
    }
  },

  /**
   * Reset expired time windows (Admin only)
   */
  async resetExpiredTimeWindows(
    _parent: any,
    _args: any,
    context: GraphQLContext
  ) {
    try {
      // Require admin privileges
      requireAdmin(context);

      const service = new FeeStatsService(context.prisma);
      await service.resetExpiredTimeWindows();

      logger.info('Expired time windows reset successfully');

      return {
        success: true,
        message: 'Successfully reset expired time windows',
      };
    } catch (error) {
      // @ts-ignore - Pino logger signature
      logger.error('Error resetting time windows:', error);
      throw new GraphQLError('Failed to reset time windows', {
        extensions: {
          code: 'INTERNAL_SERVER_ERROR',
        },
      });
    }
  },
};

/**
 * Type resolvers for nested fields
 */
export const feeTypeResolvers = {
  FeeCollection: {
    // Resolve token if needed
    async token(parent: any, _args: any, context: GraphQLContext) {
      if (!parent.tokenAddress) return null;

      return context.loaders.tokenLoader.load(parent.tokenAddress);
    },
  },

  TokenFeePerformance: {
    // Resolve token details
    async token(parent: any, _args: any, context: GraphQLContext) {
      return context.loaders.tokenLoader.load(parent.tokenAddress);
    },
  },
};

/**
 * All fee resolvers combined
 */
export const feeResolvers = {
  Query: feeQueryResolvers,
  Mutation: feeMutationResolvers,
  ...feeTypeResolvers,
};
