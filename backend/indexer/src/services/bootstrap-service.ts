/**
 * Bootstrap Service
 *
 * Synchronizes all existing tokens from the blockchain to the database.
 * Runs on startup to ensure database is in sync with on-chain state.
 *
 * Features:
 * - Full sync of all tokens from contract
 * - Incremental updates for existing tokens
 * - Idempotent operations (safe to run multiple times)
 * - Progress tracking and logging
 */

import { PrismaClient } from '@astroshibapop/shared/prisma';
import { ContractReader, TokenInfo, createContractReader } from './contract-reader.js';
import { logger } from '../lib/logger.js';

// ============================================================================
// Types
// ============================================================================

export interface BootstrapResult {
  success: boolean;
  tokensProcessed: number;
  tokensCreated: number;
  tokensUpdated: number;
  errors: number;
  duration: number;
}

export interface BootstrapConfig {
  batchSize?: number;
  concurrency?: number;
  skipExisting?: boolean;
}

// ============================================================================
// Bootstrap Service Class
// ============================================================================

export class BootstrapService {
  private contractReader: ContractReader;
  private batchSize: number;
  private concurrency: number;
  private skipExisting: boolean;

  constructor(
    private prisma: PrismaClient,
    config: BootstrapConfig = {}
  ) {
    this.contractReader = createContractReader();
    this.batchSize = config.batchSize ?? 10;
    this.concurrency = config.concurrency ?? 3;
    this.skipExisting = config.skipExisting ?? false;
  }

  // ==========================================================================
  // Public Methods
  // ==========================================================================

  /**
   * Run full bootstrap - sync all tokens from blockchain
   */
  async bootstrap(): Promise<BootstrapResult> {
    const startTime = Date.now();
    const result: BootstrapResult = {
      success: false,
      tokensProcessed: 0,
      tokensCreated: 0,
      tokensUpdated: 0,
      errors: 0,
      duration: 0,
    };

    logger.info('🚀 Starting bootstrap sync...');

    try {
      // Step 1: Get token count from contract
      const tokenCount = await this.contractReader.getTokenCount();
      logger.info(`📊 Contract reports ${tokenCount} tokens`);

      // Step 2: Get all token addresses using multiple strategies
      const tokenAddressSet = new Set<string>();

      // Strategy 1: Try direct contract method
      const contractTokens = await this.contractReader.getAllTokens(0, 1000);
      contractTokens.forEach(addr => tokenAddressSet.add(addr));
      logger.info(`  - Contract method: ${contractTokens.length} tokens`);

      // Strategy 2: Try events if contract method returned empty
      if (tokenAddressSet.size === 0) {
        logger.info('Using event-based token discovery...');
        const eventTokens = await this.contractReader.getTokensFromEvents();
        eventTokens.forEach(addr => tokenAddressSet.add(addr));
        logger.info(`  - Events method: ${eventTokens.length} tokens`);
      }

      // Strategy 3: Include existing database tokens (for re-sync)
      const dbTokens = await this.prisma.token.findMany({
        where: { deletedAt: null },
        select: { address: true },
      });
      dbTokens.forEach(t => tokenAddressSet.add(t.address));
      logger.info(`  - Database: ${dbTokens.length} existing tokens`);

      const tokenAddresses = Array.from(tokenAddressSet);
      logger.info(`📋 Found ${tokenAddresses.length} unique token addresses to sync`);

      if (tokenAddresses.length === 0) {
        logger.warn('No tokens found to sync');
        result.success = true;
        result.duration = Date.now() - startTime;
        return result;
      }

      // Step 3: Process tokens in batches
      const batches = this.chunkArray(tokenAddresses, this.batchSize);

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        logger.info(`Processing batch ${i + 1}/${batches.length} (${batch.length} tokens)`);

        // Process batch with concurrency limit
        const batchResults = await this.processBatchWithConcurrency(batch);

        for (const batchResult of batchResults) {
          result.tokensProcessed++;
          if (batchResult.created) result.tokensCreated++;
          if (batchResult.updated) result.tokensUpdated++;
          if (batchResult.error) result.errors++;
        }

        // Log progress
        const progress = Math.round((result.tokensProcessed / tokenAddresses.length) * 100);
        logger.info(`Progress: ${progress}% (${result.tokensProcessed}/${tokenAddresses.length})`);
      }

      result.success = true;
    } catch (error) {
      logger.error('Bootstrap failed:', error);
      result.success = false;
    }

    result.duration = Date.now() - startTime;

    logger.info('='.repeat(50));
    logger.info('Bootstrap Summary:');
    logger.info(`  Success: ${result.success}`);
    logger.info(`  Tokens Processed: ${result.tokensProcessed}`);
    logger.info(`  Created: ${result.tokensCreated}`);
    logger.info(`  Updated: ${result.tokensUpdated}`);
    logger.info(`  Errors: ${result.errors}`);
    logger.info(`  Duration: ${result.duration}ms`);
    logger.info('='.repeat(50));

    return result;
  }

  /**
   * Sync a single token by address
   */
  async syncToken(tokenAddress: string): Promise<{
    success: boolean;
    created: boolean;
    updated: boolean;
  }> {
    try {
      // Check if token exists in DB
      const existingToken = await this.prisma.token.findUnique({
        where: { address: tokenAddress },
      });

      if (existingToken && this.skipExisting) {
        return { success: true, created: false, updated: false };
      }

      // Fetch token info from contract
      const tokenInfo = await this.contractReader.getTokenInfo(tokenAddress);

      if (!tokenInfo) {
        logger.warn(`Token ${tokenAddress} not found in contract`);
        return { success: false, created: false, updated: false };
      }

      // Prepare token data
      const tokenData = this.prepareTokenData(tokenAddress, tokenInfo);

      // Upsert token
      await this.prisma.token.upsert({
        where: { address: tokenAddress },
        update: {
          ...tokenData,
          createdAt: undefined, // Don't overwrite createdAt on update
        },
        create: tokenData,
      });

      // Ensure creator exists
      await this.ensureCreatorExists(tokenInfo.creator);

      const isNew = !existingToken;
      logger.info(`${isNew ? '✅ Created' : '🔄 Updated'} token: ${tokenInfo.name} (${tokenInfo.symbol})`);

      return {
        success: true,
        created: isNew,
        updated: !isNew,
      };
    } catch (error) {
      logger.error(`Failed to sync token ${tokenAddress}:`, error);
      return { success: false, created: false, updated: false };
    }
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  private async processBatchWithConcurrency(
    addresses: string[]
  ): Promise<Array<{ created: boolean; updated: boolean; error: boolean }>> {
    const results: Array<{ created: boolean; updated: boolean; error: boolean }> = [];

    // Process in parallel with concurrency limit
    for (let i = 0; i < addresses.length; i += this.concurrency) {
      const chunk = addresses.slice(i, i + this.concurrency);
      const chunkResults = await Promise.all(
        chunk.map(async (address) => {
          try {
            const result = await this.syncToken(address);
            return {
              created: result.created,
              updated: result.updated,
              error: !result.success,
            };
          } catch {
            return { created: false, updated: false, error: true };
          }
        })
      );
      results.push(...chunkResults);

      // Small delay between concurrent batches to avoid rate limiting
      if (i + this.concurrency < addresses.length) {
        await this.sleep(100);
      }
    }

    return results;
  }

  private prepareTokenData(tokenAddress: string, info: TokenInfo) {
    return {
      address: tokenAddress,
      creator: info.creator,
      name: info.name,
      symbol: info.symbol,
      decimals: 7,
      totalSupply: info.bonding_curve?.token_reserve ?? '1000000000000000',
      metadataUri: info.image_url ?? '',
      imageUrl: info.image_url || null,
      description: info.description || `${info.name} token on Stellar`,
      circulatingSupply: info.bonding_curve?.token_reserve ?? '0',
      xlmReserve: info.bonding_curve?.xlm_reserve ?? '0',
      graduated: info.status === 'Graduated',
      xlmRaised: info.xlm_raised ?? '0',
      marketCap: info.market_cap ?? '0',
      currentPrice: '0', // Will be calculated
      priceChange24h: 0,
      volume24h: '0',
      volume7d: '0',
      holders: info.holders_count ?? 1,
      createdAt: info.created_at
        ? new Date(Number(info.created_at) * 1000)
        : new Date(),
      updatedAt: new Date(),
    };
  }

  private async ensureCreatorExists(creatorAddress: string): Promise<void> {
    try {
      await this.prisma.user.upsert({
        where: { address: creatorAddress },
        update: {
          tokensCreatedCount: { increment: 0 }, // No-op update
        },
        create: {
          address: creatorAddress,
          points: 100,
          level: 1,
          referrals: 0,
          tokensCreatedCount: 1,
          totalVolumeTraded: '0',
          totalLiquidityProvided: '0',
        },
      });
    } catch (error) {
      // Ignore duplicate key errors
      if (!(error as any)?.code?.includes('P2002')) {
        logger.warn(`Failed to ensure creator exists: ${creatorAddress}`);
      }
    }
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createBootstrapService(
  prisma: PrismaClient,
  config?: BootstrapConfig
): BootstrapService {
  return new BootstrapService(prisma, config);
}
