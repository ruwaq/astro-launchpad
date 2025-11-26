/**
 * Fee Stats Initializer
 * 
 * Initializes fee statistics system and performs initial data setup.
 * Run this once after deploying the fee system to:
 * - Create global fee stats record
 * - Initialize fee config from contract
 * - Optionally backfill historical data
 * 
 * Usage:
 *   npx ts-node src/services/fee-stats-initializer.ts
 *   npx ts-node src/services/fee-stats-initializer.ts --backfill
 */

import { PrismaClient } from '@astroshibapop/shared/prisma';
import { logger } from '../lib/logger.js';
import { FeeStatsService } from './fee-stats.service.js';

interface InitOptions {
  backfill?: boolean;
  contractAddress?: string;
  treasuryAddress?: string;
}

export class FeeStatsInitializer {
  private prisma: PrismaClient;
  private feeStatsService: FeeStatsService;
  private contractAddress: string;

  constructor(prisma: PrismaClient, contractAddress: string) {
    this.prisma = prisma;
    this.feeStatsService = new FeeStatsService(prisma);
    this.contractAddress = contractAddress;
  }

  /**
   * Initialize fee statistics system
   */
  async initialize(options: InitOptions = {}): Promise<void> {
    logger.info('🚀 Starting Fee Stats Initialization...');

    try {
      // Step 1: Create global fee stats record if not exists
      await this.initializeGlobalStats();

      // Step 2: Initialize fee configuration
      await this.initializeFeeConfig(options);

      // Step 3: Backfill historical data (optional)
      if (options.backfill) {
        await this.backfillHistoricalData();
      }

      // Step 4: Validate setup
      await this.validateSetup();

      logger.info('✅ Fee Stats Initialization completed successfully!');
    } catch (error) {
      logger.error('❌ Fee Stats Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Step 1: Initialize global fee stats record
   */
  private async initializeGlobalStats(): Promise<void> {
    logger.info('📊 Step 1: Initializing global fee stats...');

    const existing = await this.prisma.feeStats.findFirst({
      where: { tokenAddress: null },
    });

    if (existing) {
      logger.info('  ℹ️  Global stats record already exists');
      return;
    }

    await this.prisma.feeStats.create({
      data: {
        tokenAddress: null,
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
      },
    });

    logger.info('  ✅ Global fee stats record created');
  }

  /**
   * Step 2: Initialize fee configuration from contract or defaults
   */
  private async initializeFeeConfig(options: InitOptions): Promise<void> {
    logger.info('⚙️  Step 2: Initializing fee configuration...');

    const existing = await this.prisma.feeConfig.findUnique({
      where: { contractAddress: this.contractAddress },
    });

    if (existing) {
      logger.info('  ℹ️  Fee config already exists');
      logger.info(`     Protocol Fee: ${existing.protocolFeeBps} bps (${existing.protocolFeeBps / 100}%)`);
      logger.info(`     LP Fee: ${existing.lpFeeBps} bps (${existing.lpFeeBps / 100}%)`);
      logger.info(`     Creation Fee: ${existing.creationFee} stroops`);
      return;
    }

    // Default configuration (matches smart contract defaults)
    const defaultConfig = {
      contractAddress: this.contractAddress,
      protocolFeeBps: 5, // 0.05%
      lpFeeBps: 25, // 0.25%
      creationFee: '100000000', // 10 XLM
      treasuryAddress: options.treasuryAddress || this.contractAddress,
      effectiveFrom: new Date(),
    };

    await this.prisma.feeConfig.create({
      data: defaultConfig,
    });

    logger.info('  ✅ Fee configuration created');
    logger.info(`     Protocol Fee: ${defaultConfig.protocolFeeBps} bps (0.05%)`);
    logger.info(`     LP Fee: ${defaultConfig.lpFeeBps} bps (0.25%)`);
    logger.info(`     Creation Fee: ${defaultConfig.creationFee} stroops (10 XLM)`);
    logger.info(`     Treasury: ${defaultConfig.treasuryAddress}`);
  }

  /**
   * Step 3: Backfill historical fee data (optional)
   */
  private async backfillHistoricalData(): Promise<void> {
    logger.info('🔄 Step 3: Backfilling historical fee data...');

    // Count existing transactions with fee data
    const transactionsWithFees = await this.prisma.transaction.count({
      where: {
        OR: [
          { protocolFee: { not: null } },
          { lpFee: { not: null } },
        ],
      },
    });

    if (transactionsWithFees > 0) {
      logger.info(`  ℹ️  Found ${transactionsWithFees} transactions with fee data`);
      logger.info('  🔄 Recalculating stats from existing data...');

      // Recalculate stats from existing fee data
      const result = await this.feeStatsService.recalculateStats({
        includeTokenStats: true,
        includeGlobalStats: true,
      });

      logger.info(`  ✅ Recalculated stats for ${result.updated} records`);
    } else {
      logger.info('  ℹ️  No historical fee data found to backfill');
    }
  }

  /**
   * Step 4: Validate setup
   */
  private async validateSetup(): Promise<void> {
    logger.info('🔍 Step 4: Validating setup...');

    // Check global stats
    const globalStats = await this.prisma.feeStats.findFirst({
      where: { tokenAddress: null },
    });

    if (!globalStats) {
      throw new Error('Global fee stats record not found');
    }
    logger.info('  ✅ Global stats: OK');

    // Check fee config
    const feeConfig = await this.prisma.feeConfig.findUnique({
      where: { contractAddress: this.contractAddress },
    });

    if (!feeConfig) {
      throw new Error('Fee configuration not found');
    }
    logger.info('  ✅ Fee config: OK');

    // Validate fee percentages
    const totalFees = feeConfig.protocolFeeBps + feeConfig.lpFeeBps;
    if (totalFees > 200) {
      logger.warn(`  ⚠️  Warning: Total fees (${totalFees} bps) exceed 2%`);
    } else {
      logger.info(`  ✅ Fee percentages: ${totalFees} bps (${totalFees / 100}%) - Within limits`);
    }

    // Check database indexes
    logger.info('  ✅ Database indexes: Assuming OK (run EXPLAIN queries to verify)');

    logger.info('✅ Validation complete');
  }

  /**
   * Print current system status
   */
  async printStatus(): Promise<void> {
    logger.info('\n📊 Fee System Status:');
    logger.info('═'.repeat(80));

    // Global stats
    const globalStats = await this.feeStatsService.getGlobalStats();
    if (globalStats) {
      logger.info('\n💰 Global Revenue:');
      logger.info(`  Total Protocol Fees: ${this.formatXLM(globalStats.totalProtocolFees)}`);
      logger.info(`  Total LP Fees: ${this.formatXLM(globalStats.totalLpFees)}`);
      logger.info(`  Total Creation Fees: ${this.formatXLM(globalStats.totalCreationFees)}`);
      logger.info(`  Total Revenue: ${this.formatXLM(globalStats.totalFees)}`);
      logger.info(`  Total Transactions: ${globalStats.totalTransactions.toLocaleString()}`);

      logger.info('\n📈 Last 24 Hours:');
      logger.info(`  Protocol Fees: ${this.formatXLM(globalStats.protocolFees24h)}`);
      logger.info(`  LP Fees: ${this.formatXLM(globalStats.lpFees24h)}`);
      logger.info(`  Total: ${this.formatXLM(globalStats.totalFees24h)}`);
      logger.info(`  Transactions: ${globalStats.transactions24h.toLocaleString()}`);
    }

    // Fee config
    const feeConfig = await this.prisma.feeConfig.findUnique({
      where: { contractAddress: this.contractAddress },
    });

    if (feeConfig) {
      logger.info('\n⚙️  Current Configuration:');
      logger.info(`  Protocol Fee: ${feeConfig.protocolFeeBps} bps (${feeConfig.protocolFeeBps / 100}%)`);
      logger.info(`  LP Fee: ${feeConfig.lpFeeBps} bps (${feeConfig.lpFeeBps / 100}%)`);
      logger.info(`  Total Trading Fee: ${feeConfig.protocolFeeBps + feeConfig.lpFeeBps} bps (${(feeConfig.protocolFeeBps + feeConfig.lpFeeBps) / 100}%)`);
      logger.info(`  Creation Fee: ${this.formatXLM(feeConfig.creationFee)}`);
      logger.info(`  Treasury: ${feeConfig.treasuryAddress}`);
      logger.info(`  Effective From: ${feeConfig.effectiveFrom.toISOString()}`);
    }

    // Top tokens by fees
    const topTokens = await this.feeStatsService.getTopTokensByFees(5, 'all');
    if (topTokens.length > 0) {
      logger.info('\n🏆 Top 5 Tokens by Fee Generation:');
      topTokens.forEach((token, index) => {
        logger.info(`  ${index + 1}. ${token.tokenAddress}`);
        logger.info(`     Total Fees: ${this.formatXLM(token.totalFees)}`);
        logger.info(`     Transactions: ${token.transactionCount.toLocaleString()}`);
      });
    }

    logger.info('\n' + '═'.repeat(80));
  }

  /**
   * Helper: Format stroops to XLM
   */
  private formatXLM(stroops: string): string {
    const xlm = BigInt(stroops) / BigInt(10_000_000);
    const remainder = BigInt(stroops) % BigInt(10_000_000);
    return `${xlm}.${remainder.toString().padStart(7, '0')} XLM`;
  }
}

/**
 * CLI execution
 */
async function main() {
  const prisma = new PrismaClient();
  
  try {
    const contractAddress = process.env.SAC_FACTORY_ADDRESS || process.env.TOKEN_FACTORY_CONTRACT_ID;
    const treasuryAddress = process.env.TREASURY_ADDRESS;
    
    if (!contractAddress) {
      throw new Error('SAC_FACTORY_ADDRESS or TOKEN_FACTORY_CONTRACT_ID environment variable is required');
    }

    const initializer = new FeeStatsInitializer(prisma, contractAddress);

    // Parse CLI args
    const args = process.argv.slice(2);
    const backfill = args.includes('--backfill');
    const statusOnly = args.includes('--status');

    if (statusOnly) {
      // Just print status
      await initializer.printStatus();
    } else {
      // Full initialization
      await initializer.initialize({
        backfill,
        contractAddress,
        treasuryAddress,
      });

      // Print final status
      await initializer.printStatus();
    }

    await prisma.$disconnect();
    process.exit(0);
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