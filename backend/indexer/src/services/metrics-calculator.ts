import { PrismaClient } from '@astroshibapop/shared/prisma';
import { logger } from '../lib/logger.js';

/**
 * Virtual XLM for bonding curve calculation
 * This provides initial liquidity for price stability
 */
const VIRTUAL_XLM = BigInt(30_000_0000000); // 30,000 XLM in stroops

/**
 * Calculate derived metrics like market cap, TVL, APR, etc.
 * Runs periodically to update calculated fields
 *
 * OPTIMIZED: Uses batch operations to avoid N+1 query problems
 */
export class MetricsCalculator {
  constructor(private prisma: PrismaClient) {}

  // Cache for 24h ago prices to calculate price change
  private priceCache24hAgo: Map<string, bigint> = new Map();

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

    // Fetch 24h ago prices for price change calculation
    const prices24hAgo = await this.get24hAgoPrices(tokens.map(t => t.address));

    // Collect current prices for cache update
    const currentPrices = new Map<string, bigint>();

    // Build batch updates
    const updates = tokens.map(token => {
      try {
        // Calculate current price from bonding curve
        const currentPrice = this.calculateBondingCurvePrice(token);

        // Store for cache update
        currentPrices.set(token.address, currentPrice);

        // Calculate market cap: price * circulating supply (both in stroops)
        const circulatingSupply = BigInt(token.circulatingSupply || '0');
        const marketCap = circulatingSupply > 0n
          ? (currentPrice * circulatingSupply) / BigInt(10_000_000)
          : 0n;

        // Calculate 24h price change percentage
        const price24hAgo = prices24hAgo.get(token.address);
        let priceChange24h = 0;
        if (price24hAgo && price24hAgo > 0n && currentPrice > 0n) {
          // ((current - old) / old) * 100
          priceChange24h = Number((currentPrice - price24hAgo) * 10000n / price24hAgo) / 100;
        }

        const holders = holderMap.get(token.address) || 1;

        return this.prisma.token.update({
          where: { id: token.id },
          data: {
            currentPrice: currentPrice.toString(),
            marketCap: marketCap.toString(),
            priceChange24h,
            holders,
          },
        });
      } catch (error) {
        logger.error({ error, tokenAddress: token.address }, 'Error preparing metrics for token');
        return null;
      }
    }).filter(Boolean);

    // Execute all updates in a single transaction (much faster than individual)
    if (updates.length > 0) {
      await this.prisma.$transaction(updates as any[]);
    }

    // Update price cache for next cycle's 24h comparison
    this.updatePriceCache(currentPrices);
  }

  /**
   * Get prices from 24 hours ago for price change calculation
   *
   * NOTE: Without a dedicated PriceHistory table, we use the cached prices
   * from the previous calculation cycle. For accurate 24h changes, consider
   * adding a TokenPriceSnapshot model to the schema.
   *
   * Current fallback strategy:
   * 1. Return cached 24h ago prices from memory (populated on each run)
   * 2. If cache empty, return empty map (price change will be 0)
   */
  private async get24hAgoPrices(tokenAddresses: string[]): Promise<Map<string, bigint>> {
    const result = new Map<string, bigint>();

    // Return cached prices from previous cycle
    // This provides approximate 24h change when metrics run periodically
    for (const address of tokenAddresses) {
      const cachedPrice = this.priceCache24hAgo.get(address);
      if (cachedPrice) {
        result.set(address, cachedPrice);
      }
    }

    return result;
  }

  /**
   * Update the 24h price cache with current prices
   * Call this after calculating current prices
   */
  private updatePriceCache(tokenPrices: Map<string, bigint>): void {
    // Only update cache every ~24 hours by checking if it's empty
    // In production, this should be handled by a scheduled job
    if (this.priceCache24hAgo.size === 0) {
      for (const [address, price] of tokenPrices) {
        this.priceCache24hAgo.set(address, price);
      }
    }
  }

  private async calculatePoolMetrics() {
    const pools = await this.prisma.pool.findMany({
      select: {
        id: true,
        address: true,
        token0Address: true,
        token1Address: true,
        reserve0: true,
        reserve1: true,
      },
    });

    if (pools.length === 0) return;

    // Calculate 24h fees for all pools from FeeCollection events
    // Pass pools with token addresses for correct fee matching
    const fees24hMap = await this.calculatePoolFees24h(pools);

    // Build batch updates
    const updates = pools.map(pool => {
      try {
        // Get fees from our calculation (now keyed by pool.id)
        const fees24h = fees24hMap.get(pool.id) || 0n;

        // Calculate TVL directly from pool data (no extra query!)
        const tvl = this.calculatePoolTVLSync(pool);

        // Calculate APR using real fees data
        const apr = this.calculatePoolAPRWithFees(fees24h, tvl);

        return this.prisma.pool.update({
          where: { id: pool.id },
          data: {
            tvl: tvl.toString(),
            fees24h: fees24h.toString(),
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

  /**
   * Calculate 24h fees for pools from FeeCollection events
   *
   * NOTE: FeeCollection.tokenAddress contains the TOKEN address (not pool address).
   * Pools have token0Address (usually XLM) and token1Address (the token).
   * We need to match FeeCollection by the token addresses in the pool.
   *
   * @param pools Array of pools with their token addresses
   * @returns Map of pool id to fees in stroops
   */
  private async calculatePoolFees24h(pools: Array<{ id: string; token0Address: string; token1Address: string }>): Promise<Map<string, bigint>> {
    const result = new Map<string, bigint>();

    if (pools.length === 0) return result;

    try {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      // Collect all token addresses from pools (both token0 and token1)
      const tokenAddresses = new Set<string>();
      pools.forEach(pool => {
        tokenAddresses.add(pool.token0Address);
        tokenAddresses.add(pool.token1Address);
      });

      // Query fee collections from last 24 hours for these tokens
      // Note: lpFee and protocolFee are String fields, so we aggregate manually
      const feeCollections = await this.prisma.feeCollection.findMany({
        where: {
          tokenAddress: { in: Array.from(tokenAddresses) },
          timestamp: { gte: twentyFourHoursAgo },
        },
        select: {
          tokenAddress: true,
          lpFee: true,
          protocolFee: true,
        },
      });

      // Create map of tokenAddress -> fees (aggregate manually since fields are strings)
      const tokenFeesMap = new Map<string, bigint>();
      for (const fee of feeCollections) {
        const lpFee = BigInt(fee.lpFee || '0');
        const protocolFee = BigInt(fee.protocolFee || '0');
        const totalFee = lpFee + protocolFee;
        const existingFees = tokenFeesMap.get(fee.tokenAddress) || 0n;
        tokenFeesMap.set(fee.tokenAddress, existingFees + totalFee);
      }

      // Map fees back to pools (sum fees from both tokens in the pool)
      for (const pool of pools) {
        const token0Fees = tokenFeesMap.get(pool.token0Address) || 0n;
        const token1Fees = tokenFeesMap.get(pool.token1Address) || 0n;
        result.set(pool.id, token0Fees + token1Fees);
      }
    } catch (error) {
      logger.error({ error }, 'Error calculating pool fees 24h');
    }

    return result;
  }

  /**
   * Calculate APR with real fees data
   * APR = (fees_24h * 365 / tvl) * 100
   */
  private calculatePoolAPRWithFees(fees24h: bigint, tvl: bigint): number {
    if (tvl === 0n) return 0;

    // APR = (fees_24h * 365 / tvl) * 100
    // Using 10000 multiplier for precision (2 decimal places)
    const apr = (fees24h * 365n * 10000n) / tvl;
    return Number(apr) / 100;
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
   * Calculate token price from bonding curve formula
   * Price = (virtualXlm + xlmReserve) / circulatingSupply
   *
   * @param token Token data with reserves and supply
   * @returns Price in stroops (1 XLM = 10^7 stroops)
   */
  private calculateBondingCurvePrice(token: {
    xlmReserve?: string | null;
    circulatingSupply?: string | null;
  }): bigint {
    try {
      const xlmReserve = BigInt(token.xlmReserve || '0');
      const circulatingSupply = BigInt(token.circulatingSupply || '0');

      // Avoid division by zero
      if (circulatingSupply === 0n) {
        return 0n;
      }

      // Price = (VIRTUAL_XLM + xlmReserve) * 10^7 / circulatingSupply
      // Multiply by 10^7 first to maintain precision (stroops per token unit)
      const totalXlm = VIRTUAL_XLM + xlmReserve;
      return (totalXlm * BigInt(10_000_000)) / circulatingSupply;
    } catch {
      return 0n;
    }
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
   * Calculate pool APR based on fees earned relative to TVL
   * APR = (fees_24h * 365 / tvl) * 100
   *
   * @param pool Pool data with fee and TVL information
   * @returns APR as percentage (e.g., 25.5 means 25.5%)
   */
  private calculatePoolAPRSync(pool: {
    fees24h?: string | null;
    reserve0: string;
    reserve1: string;
  }): number {
    try {
      const fees24h = BigInt(pool.fees24h || '0');
      const tvl = BigInt(pool.reserve0 || '0') + BigInt(pool.reserve1 || '0');

      // Avoid division by zero
      if (tvl === 0n) {
        return 0;
      }

      // APR = (fees_24h * 365 / tvl) * 100
      // Using 10000 multiplier for precision (2 decimal places)
      const apr = (fees24h * 365n * 10000n) / tvl;
      return Number(apr) / 100; // Convert to percentage with 2 decimals
    } catch {
      return 0;
    }
  }
}
