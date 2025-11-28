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
import { PrismaClient } from '@astroshibapop/shared/prisma';
import type { FeeStats } from '@astroshibapop/shared/types';
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
 * Fee Statistics Service
 */
export declare class FeeStatsService {
    private prisma;
    constructor(prisma: PrismaClient);
    /**
     * Get global fee statistics
     */
    getGlobalStats(): Promise<FeeStats | null>;
    /**
     * Get fee statistics for a specific token
     */
    getTokenStats(tokenAddress: string): Promise<FeeStats | null>;
    /**
     * Get comprehensive revenue breakdown
     */
    getRevenueBreakdown(): Promise<FeeRevenue>;
    /**
     * Get top tokens by fee generation
     */
    getTopTokensByFees(limit?: number, timeWindow?: 'day' | 'week' | 'month' | 'all'): Promise<TokenFeePerformance[]>;
    /**
     * Recalculate fee statistics from source
     * Use for data reconciliation or recovery
     */
    recalculateStats(config?: FeeStatsConfig): Promise<{
        success: boolean;
        updated: number;
    }>;
    /**
     * Reset time-windowed stats (run daily)
     * Clears 24h stats that are older than 24h
     */
    resetExpiredTimeWindows(): Promise<void>;
    /**
     * Get fee statistics summary for dashboard
     */
    getDashboardSummary(): Promise<{
        revenue: FeeRevenue;
        topTokens: TokenFeePerformance[];
        recentGrowth: {
            protocolFees: string;
            lpFees: string;
            totalFees: string;
            percentageChange: number;
        };
    }>;
    /**
     * Calculate average fee per transaction
     */
    getAverageFeePerTransaction(tokenAddress?: string): Promise<{
        protocolFee: string;
        lpFee: string;
        totalFee: string;
    }>;
    /**
     * Get fee collection history (paginated)
     */
    getFeeCollectionHistory(params: {
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
    }>;
    /**
     * Helper to aggregate fees using Raw SQL (because amount is String/BigInt)
     */
    private aggregateFees;
    /**
     * Recalculate global fee statistics from source
     */
    private recalculateGlobalStats;
    /**
     * Recalculate token-specific fee statistics
     */
    private recalculateTokenStats;
    /**
     * Get unique token addresses from fee collections
     */
    private getUniqueTokenAddresses;
    /**
     * Calculate average fee
     */
    private calculateAvgFee;
    /**
     * Get order by field for time window
     */
    private getOrderByFieldForTimeWindow;
    /**
     * Calculate growth metrics
     */
    private calculateGrowth;
    /**
     * Get empty revenue object
     */
    private getEmptyRevenue;
}
export {};
//# sourceMappingURL=fee-stats.service.d.ts.map