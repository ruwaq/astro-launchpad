import { PrismaClient } from '@astroshibapop/shared/prisma';
import { logger } from '../lib/logger.js';

/**
 * Calculate derived metrics like market cap, TVL, APR, etc.
 * Runs periodically to update calculated fields
 *
 * OPTIMIZED: Uses batch operations to avoid N+1 query problems
 */
export class MetricsCalculator {
  constructor(private prisma: PrismaClient) {}

  async calculateAll() {
    logger.debug('Calculating metrics...');

    await Promise.all([
      this.calculateTokenMetrics(),
      this.calculatePoolMetrics(),
      this.calculateUserLevels(),
    ]);

    logger.debug('Metrics calculated');
  }

  private async calculateTokenMetrics() {
    // Calculate market cap, price changes, holder count
    const tokens = await this.prisma.token.findMany();

    if (tokens.length === 0) return;

    // Batch: Get holder counts for all tokens in ONE query
    const holderCounts = await this.prisma.transaction.groupBy({
      by: ['tokenAddress'],
      where: {
        type: 'TOKEN_BOUGHT',
        tokenAddress: { in: tokens.map(t => t.address) },
      },
      _count: { tokenAddress: true },
    });

    // Create a map for O(1) lookup
    const holderMap = new Map(
      holderCounts.map(h => [h.tokenAddress, Math.max(1, h._count.tokenAddress)])
    );

    // Build batch updates
    const updates = tokens.map(token => {
      try {
        const currentPrice = this.getTokenPriceSync(token.address);
        const marketCap = (BigInt(token.totalSupply) * BigInt(currentPrice)) / BigInt(10_000_000);
        const holders = holderMap.get(token.address) || 1;

        return this.prisma.token.update({
          where: { id: token.id },
          data: {
            currentPrice: currentPrice.toString(),
            marketCap: marketCap.toString(),
            priceChange24h: 0, // TODO: Calculate from historical data
            holders,
          },
        });
      } catch (error) {
        logger.error(`Error preparing metrics for token ${token.address}:`, error);
        return null;
      }
    }).filter(Boolean);

    // Execute all updates in a single transaction (much faster than individual)
    if (updates.length > 0) {
      await this.prisma.$transaction(updates as any[]);
    }
  }

  private async calculatePoolMetrics() {
    const pools = await this.prisma.pool.findMany();

    if (pools.length === 0) return;

    // Build batch updates - no need to refetch pools, we already have all data
    const updates = pools.map(pool => {
      try {
        // Calculate TVL directly from pool data (no extra query!)
        const tvl = this.calculatePoolTVLSync(pool);
        const apr = this.calculatePoolAPRSync(pool);

        return this.prisma.pool.update({
          where: { id: pool.id },
          data: {
            tvl: tvl.toString(),
            apr,
          },
        });
      } catch (error) {
        logger.error(`Error preparing metrics for pool ${pool.address}:`, error);
        return null;
      }
    }).filter(Boolean);

    // Execute all updates in a single transaction
    if (updates.length > 0) {
      await this.prisma.$transaction(updates as any[]);
    }
  }

  private async calculateUserLevels() {
    // OPTIMIZED: Single SQL query to update all users at once
    // Much faster than fetching all users and updating one by one
    await this.prisma.$executeRaw`
      UPDATE "User"
      SET level = GREATEST(1, FLOOR(SQRT(points / 100.0)) + 1)
      WHERE level != GREATEST(1, FLOOR(SQRT(points / 100.0)) + 1)
    `;
  }

  /**
   * Synchronous version for batch processing
   * Get price from bonding curve or pool
   */
  private getTokenPriceSync(_tokenAddress: string): number {
    // For MVP, return dummy value
    // TODO: Implement real price lookup from cached bonding curve data
    return 1000; // 0.0001 XLM
  }

  /**
   * Synchronous TVL calculation - uses pool data directly (no extra query)
   */
  private calculatePoolTVLSync(pool: { reserve0: string; reserve1: string }): bigint {
    // TVL = reserve0 + reserve1 (in XLM value)
    // Simplified: assume both tokens valued at 1:1 with XLM
    try {
      return BigInt(pool.reserve0 || '0') + BigInt(pool.reserve1 || '0');
    } catch {
      return BigInt(0);
    }
  }

  /**
   * Synchronous APR calculation
   */
  private calculatePoolAPRSync(_pool: any): number {
    // Calculate APR based on fees earned
    // APR = (fees_24h * 365 / tvl) * 100
    // For MVP, return estimated APR
    return 25.5; // 25.5% APR
  }
}
