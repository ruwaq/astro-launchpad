/**
 * Blockchain Sync Service - Production Grade
 *
 * Maintains consistency between on-chain state and database.
 * This is the SINGLE SOURCE OF TRUTH synchronization layer.
 *
 * Architecture:
 * - Periodic full sync of token state from blockchain
 * - Real-time event updates via indexer
 * - Consistency checks and automatic repair
 * - Metrics and monitoring
 *
 * @author Astro Team
 * @version 2.0.0
 */

import { PrismaClient } from '@astroshibapop/shared/prisma';
import { Networks } from '@stellar/stellar-sdk';
import { logger } from '../lib/logger.js';
import { wsBroadcaster } from './websocket-server.js';
import { ContractReader } from './contract-reader.js';

// ============================================================================
// Configuration
// ============================================================================

export interface SyncConfig {
  rpcUrl: string;
  networkPassphrase: string;
  contractId: string;
  syncIntervalMs: number;
  batchSize: number;
  concurrency: number;
  enableMetrics: boolean;
}

const DEFAULT_CONFIG: Partial<SyncConfig> = {
  syncIntervalMs: 60000, // 1 minute
  batchSize: 10,
  concurrency: 5,
  enableMetrics: true,
};

// ============================================================================
// Metrics
// ============================================================================

interface SyncMetrics {
  lastSyncAt: Date | null;
  lastSyncDuration: number;
  tokensChecked: number;
  tokensUpdated: number;
  tokensMismatched: number;
  syncErrors: number;
  consecutiveFailures: number;
  isHealthy: boolean;
}

// ============================================================================
// Blockchain Sync Service
// ============================================================================

export class BlockchainSyncService {
  private prisma: PrismaClient;
  private contractReader: ContractReader;
  private config: SyncConfig;
  private metrics: SyncMetrics;
  private syncInterval: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(prisma: PrismaClient, config: Partial<SyncConfig> = {}) {
    this.prisma = prisma;
    this.config = {
      rpcUrl: config.rpcUrl || process.env.STELLAR_RPC_URL || 'https://soroban-testnet.stellar.org',
      networkPassphrase: config.networkPassphrase || process.env.STELLAR_PASSPHRASE || Networks.TESTNET,
      contractId: config.contractId || process.env.TOKEN_FACTORY_CONTRACT_ID || '',
      ...DEFAULT_CONFIG,
      ...config,
    } as SyncConfig;

    // Use ContractReader for all blockchain interactions
    this.contractReader = new ContractReader({
      rpcUrl: this.config.rpcUrl,
      networkPassphrase: this.config.networkPassphrase,
      contractId: this.config.contractId,
    });

    this.metrics = {
      lastSyncAt: null,
      lastSyncDuration: 0,
      tokensChecked: 0,
      tokensUpdated: 0,
      tokensMismatched: 0,
      syncErrors: 0,
      consecutiveFailures: 0,
      isHealthy: true,
    };

    logger.info('BlockchainSyncService initialized', {
      contractId: this.config.contractId,
      syncInterval: `${this.config.syncIntervalMs}ms`,
    });
  }

  // ==========================================================================
  // Public API
  // ==========================================================================

  /**
   * Start periodic synchronization
   */
  start(): void {
    if (this.isRunning) {
      logger.warn('BlockchainSyncService already running');
      return;
    }

    this.isRunning = true;
    logger.info('🚀 Starting BlockchainSyncService...');

    // Run initial sync
    this.runSync().catch((err) => logger.error('Initial sync failed:', err));

    // Schedule periodic sync
    this.syncInterval = setInterval(() => {
      this.runSync().catch((err) => logger.error('Periodic sync failed:', err));
    }, this.config.syncIntervalMs);
  }

  /**
   * Stop synchronization
   */
  stop(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    this.isRunning = false;
    logger.info('BlockchainSyncService stopped');
  }

  /**
   * Get current metrics
   */
  getMetrics(): SyncMetrics {
    return { ...this.metrics };
  }

  /**
   * Force immediate sync
   */
  async forcSync(): Promise<SyncMetrics> {
    await this.runSync();
    return this.getMetrics();
  }

  /**
   * Sync a single token by address
   */
  async syncSingleToken(tokenAddress: string): Promise<boolean> {
    try {
      const onChainData = await this.getTokenFromBlockchain(tokenAddress);
      if (!onChainData) {
        logger.warn(`Token ${tokenAddress} not found on blockchain`);
        return false;
      }

      await this.updateTokenInDatabase(tokenAddress, onChainData);
      logger.info(`✅ Synced token: ${onChainData.name} (${onChainData.symbol})`);
      return true;
    } catch (error) {
      logger.error(`Failed to sync token ${tokenAddress}:`, error);
      return false;
    }
  }

  // ==========================================================================
  // Core Sync Logic
  // ==========================================================================

  private async runSync(): Promise<void> {
    const startTime = Date.now();
    logger.info('📊 Starting blockchain sync...');

    try {
      // Get all tokens from database
      const dbTokens = await this.prisma.token.findMany({
        where: { deletedAt: null },
        select: {
          address: true,
          xlmReserve: true,
          xlmRaised: true,
          currentPrice: true,
          graduated: true,
          holders: true,
          marketCap: true,
        },
      });

      logger.info(`Found ${dbTokens.length} tokens in database`);

      // Process in batches with concurrency
      const batches = this.chunkArray(dbTokens, this.config.batchSize);
      let tokensChecked = 0;
      let tokensUpdated = 0;
      let tokensMismatched = 0;

      for (const batch of batches) {
        const results = await Promise.allSettled(
          batch.map((token) => this.syncTokenWithBlockchain(token))
        );

        for (const result of results) {
          tokensChecked++;
          if (result.status === 'fulfilled') {
            if (result.value.updated) tokensUpdated++;
            if (result.value.mismatched) tokensMismatched++;
          }
        }

        // Small delay between batches to avoid rate limiting
        await this.sleep(100);
      }

      // Update metrics
      this.metrics.lastSyncAt = new Date();
      this.metrics.lastSyncDuration = Date.now() - startTime;
      this.metrics.tokensChecked = tokensChecked;
      this.metrics.tokensUpdated = tokensUpdated;
      this.metrics.tokensMismatched = tokensMismatched;
      this.metrics.consecutiveFailures = 0;
      this.metrics.isHealthy = true;

      logger.info('✅ Blockchain sync completed', {
        duration: `${this.metrics.lastSyncDuration}ms`,
        checked: tokensChecked,
        updated: tokensUpdated,
        mismatched: tokensMismatched,
      });
    } catch (error) {
      this.metrics.syncErrors++;
      this.metrics.consecutiveFailures++;
      this.metrics.isHealthy = this.metrics.consecutiveFailures < 3;
      logger.error('❌ Blockchain sync failed:', error);
    }
  }

  private async syncTokenWithBlockchain(
    dbToken: { address: string; xlmReserve: string | null; xlmRaised: string | null; marketCap: string | null; graduated: boolean }
  ): Promise<{ updated: boolean; mismatched: boolean }> {
    try {
      const onChainData = await this.getTokenFromBlockchain(dbToken.address);

      if (!onChainData) {
        return { updated: false, mismatched: false };
      }

      // Check for mismatches
      const mismatched = this.detectMismatch(dbToken, onChainData);

      if (mismatched) {
        await this.updateTokenInDatabase(dbToken.address, onChainData);
        logger.debug(`Updated token ${dbToken.address}: xlmReserve=${onChainData.xlmReserve}, marketCap=${onChainData.marketCap}`);
        return { updated: true, mismatched: true };
      }

      return { updated: false, mismatched: false };
    } catch (error) {
      logger.debug(`Error syncing token ${dbToken.address}:`, error);
      return { updated: false, mismatched: false };
    }
  }

  private detectMismatch(
    dbToken: { xlmReserve: string | null; xlmRaised: string | null; marketCap: string | null; graduated: boolean },
    onChain: OnChainTokenData
  ): boolean {
    // Compare key fields
    const dbXlmReserve = BigInt(dbToken.xlmReserve || '0');
    const onChainXlmReserve = BigInt(onChain.xlmReserve || '0');

    const dbXlmRaised = BigInt(dbToken.xlmRaised || '0');
    const onChainXlmRaised = BigInt(onChain.xlmRaised || '0');

    const dbMarketCap = BigInt(dbToken.marketCap || '0');
    const onChainMarketCap = BigInt(onChain.marketCap || '0');

    // Allow small tolerance (1%) for rounding differences
    const tolerance = BigInt(100); // 1%

    const reserveMismatch =
      Math.abs(Number(dbXlmReserve - onChainXlmReserve)) >
      Number((onChainXlmReserve * tolerance) / BigInt(10000));

    const raisedMismatch =
      Math.abs(Number(dbXlmRaised - onChainXlmRaised)) >
      Number((onChainXlmRaised * tolerance) / BigInt(10000));

    const marketCapMismatch =
      Math.abs(Number(dbMarketCap - onChainMarketCap)) >
      Number((onChainMarketCap * tolerance) / BigInt(10000));

    const graduationMismatch = dbToken.graduated !== onChain.graduated;

    return reserveMismatch || raisedMismatch || marketCapMismatch || graduationMismatch;
  }

  // ==========================================================================
  // Blockchain Interaction
  // ==========================================================================

  /**
   * Get token data from blockchain using ContractReader
   */
  private async getTokenFromBlockchain(tokenAddress: string): Promise<OnChainTokenData | null> {
    try {
      const tokenInfo = await this.contractReader.getTokenInfo(tokenAddress);

      if (!tokenInfo) return null;

      // Map TokenInfo to OnChainTokenData format
      return {
        name: tokenInfo.name,
        symbol: tokenInfo.symbol,
        creator: tokenInfo.creator,
        xlmReserve: tokenInfo.bonding_curve.xlm_reserve,
        tokenReserve: tokenInfo.bonding_curve.token_reserve,
        xlmRaised: tokenInfo.xlm_raised,
        marketCap: tokenInfo.market_cap,
        holdersCount: tokenInfo.holders_count,
        graduated: tokenInfo.status === 'Graduated',
        imageUrl: tokenInfo.image_url,
        description: tokenInfo.description,
      };
    } catch (error) {
      logger.debug(`Failed to fetch token ${tokenAddress} from blockchain:`, error);
      return null;
    }
  }

  // ==========================================================================
  // Database Updates
  // ==========================================================================

  private async updateTokenInDatabase(
    tokenAddress: string,
    onChain: OnChainTokenData
  ): Promise<void> {
    // Calculate current price using multiple strategies
    const currentPrice = this.calculatePrice(onChain);

    await this.prisma.token.update({
      where: { address: tokenAddress },
      data: {
        xlmReserve: onChain.xlmReserve,
        xlmRaised: onChain.xlmRaised,
        marketCap: onChain.marketCap,
        currentPrice,
        holders: onChain.holdersCount,
        graduated: onChain.graduated,
        circulatingSupply: onChain.tokenReserve,
        imageUrl: onChain.imageUrl || undefined,
        description: onChain.description || undefined,
        updatedAt: new Date(),
      },
    });

    // Broadcast update via WebSocket (if broadcaster available)
    this.broadcastTokenUpdate(tokenAddress, onChain);
  }

  private broadcastTokenUpdate(tokenAddress: string, data: OnChainTokenData): void {
    // Broadcast via WebSocket if available
    try {
      // Use same price calculation as database update
      const price = this.calculatePrice(data);

      wsBroadcaster.broadcast('token:updated', {
        tokenAddress,
        name: data.name,
        symbol: data.symbol,
        xlmReserve: data.xlmReserve,
        tokenReserve: data.tokenReserve,
        xlmRaised: data.xlmRaised,
        marketCap: data.marketCap,
        holdersCount: data.holdersCount,
        graduated: data.graduated,
        price,
      }, tokenAddress);
    } catch (error) {
      // Silent fail if no listener
      logger.debug('Failed to broadcast token update:', error);
    }
  }

  // ==========================================================================
  // Price Calculation
  // ==========================================================================

  /**
   * Calculate token price using multiple strategies:
   * 1. From bonding curve reserves (xlmReserve / tokenReserve) if tokenReserve > 0
   * 2. From market cap / total supply as fallback
   *
   * Total supply is 1 billion tokens with 7 decimals = 10^16 units
   */
  private calculatePrice(onChain: OnChainTokenData): string {
    const TOTAL_SUPPLY = BigInt('10000000000000000'); // 1 billion * 10^7 decimals
    const DECIMALS = BigInt(10_000_000);

    const xlmReserve = BigInt(onChain.xlmReserve || '0');
    const tokenReserve = BigInt(onChain.tokenReserve || '0');
    const marketCap = BigInt(onChain.marketCap || '0');

    // Strategy 1: Calculate from bonding curve reserves
    if (tokenReserve > 0n) {
      return ((xlmReserve * DECIMALS) / tokenReserve).toString();
    }

    // Strategy 2: Calculate from market cap / total supply
    // When tokenReserve = 0, all tokens are circulating
    if (marketCap > 0n) {
      // price = marketCap / totalSupply (both in stroops)
      return ((marketCap * DECIMALS) / TOTAL_SUPPLY).toString();
    }

    // Fallback: No price data available
    return '0';
  }

  // ==========================================================================
  // Utilities
  // ==========================================================================

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ============================================================================
// Types
// ============================================================================

interface OnChainTokenData {
  name: string;
  symbol: string;
  creator: string;
  xlmReserve: string;
  tokenReserve: string;
  xlmRaised: string;
  marketCap: string;
  holdersCount: number;
  graduated: boolean;
  imageUrl: string;
  description: string;
}

// ============================================================================
// Factory
// ============================================================================

export function createBlockchainSyncService(
  prisma: PrismaClient,
  config?: Partial<SyncConfig>
): BlockchainSyncService {
  return new BlockchainSyncService(prisma, config);
}
