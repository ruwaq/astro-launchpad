import { PrismaClient } from '@astroshibapop/shared/prisma';
import { logger } from '../lib/logger.js';

/**
 * Calculate derived metrics like market cap, TVL, APR, etc.
 * Runs periodically to update calculated fields
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

    for (const token of tokens) {
      try {
        // Calculate current price from bonding curve or pool
        const currentPrice = await this.getTokenPrice(token.address);

        // Calculate market cap
        const marketCap = (BigInt(token.totalSupply) * BigInt(currentPrice)) / BigInt(10_000_000);

        // Calculate 24h price change
        const priceChange24h = await this.calculatePriceChange(token.address);

        // Count holders
        const holders = await this.countTokenHolders(token.address);

        await this.prisma.token.update({
          where: { id: token.id },
          data: {
            currentPrice: currentPrice.toString(),
            marketCap: marketCap.toString(),
            priceChange24h,
            holders,
          },
        });
      } catch (error) {
        logger.error(`Error calculating metrics for token ${token.address}:`, error);
      }
    }
  }

  private async calculatePoolMetrics() {
    const pools = await this.prisma.pool.findMany();

    for (const pool of pools) {
      try {
        // Calculate TVL (Total Value Locked)
        const tvl = await this.calculatePoolTVL(pool.address);

        // Calculate APR
        const apr = await this.calculatePoolAPR(pool.address);

        await this.prisma.pool.update({
          where: { id: pool.id },
          data: {
            tvl: tvl.toString(),
            apr,
          },
        });
      } catch (error) {
        logger.error(`Error calculating metrics for pool ${pool.address}:`, error);
      }
    }
  }

  private async calculateUserLevels() {
    const users = await this.prisma.user.findMany();

    for (const user of users) {
      // Calculate level from points
      // Formula: level = floor(sqrt(points / 100))
      const level = Math.floor(Math.sqrt(user.points / 100)) + 1;

      if (level !== user.level) {
        await this.prisma.user.update({
          where: { id: user.id },
          data: { level },
        });
      }
    }
  }

  private async getTokenPrice(_tokenAddress: string): Promise<number> {
    // Get price from bonding curve or pool
    // For MVP, return dummy value
    return 1000; // 0.0001 XLM
  }

  private async calculatePriceChange(_tokenAddress: string): Promise<number> {
    // Calculate 24h price change percentage
    // For MVP, return 0
    return 0;
  }

  private async countTokenHolders(tokenAddress: string): Promise<number> {
    // Count unique holders from transactions
    // For MVP, estimate from transactions
    const buyTxs = await this.prisma.transaction.count({
      where: {
        tokenAddress,
        type: 'TOKEN_BOUGHT',
      },
    });

    return Math.max(1, buyTxs);
  }

  private async calculatePoolTVL(poolAddress: string): Promise<bigint> {
    const pool = await this.prisma.pool.findUnique({
      where: { address: poolAddress },
    });

    if (!pool) return BigInt(0);

    // TVL = reserve0 + reserve1 (in XLM value)
    // Simplified: assume both tokens valued at 1:1 with XLM
    return BigInt(pool.reserve0) + BigInt(pool.reserve1);
  }

  private async calculatePoolAPR(_poolAddress: string): Promise<number> {
    // Calculate APR based on fees earned
    // APR = (fees_24h * 365 / tvl) * 100
    // For MVP, return estimated APR
    return 25.5; // 25.5% APR
  }
}
