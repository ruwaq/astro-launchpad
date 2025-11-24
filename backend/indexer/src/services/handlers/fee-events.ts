/**
 * Fee Event Handler
 * 
 * Handles fee-related events from the SAC Factory contract:
 * - FeeBreakdown: Emitted on every buy/sell with fee calculation
 * - ProtocolFeeCollected: Protocol fee transferred to treasury
 * - LpFeeCollected: LP fee added to bonding curve
 * - FeeConfigUpdated: Changes to fee configuration
 */

import { PrismaClient } from '@prisma/client';
import { logger } from '../../lib/logger';

// Fee event types from contract
const FEE_EVENT_TOPICS = {
  FEE_BREAKDOWN: 'fee_breakdown',
  PROTOCOL_FEE_COLLECTED: 'protocol_fee_collected',
  LP_FEE_COLLECTED: 'lp_fee_collected',
  PROTOCOL_FEE_UPDATED: 'protocol_fee_updated',
  LP_FEE_UPDATED: 'lp_fee_updated',
  CREATION_FEE_UPDATED: 'creation_fee_updated',
  TREASURY_UPDATED: 'treasury_updated',
};

export class FeeEventHandler {
  constructor(private prisma: PrismaClient) {}

  /**
   * Main entry point for fee event handling
   */
  async handleEvent(event: any): Promise<void> {
    try {
      const eventType = this.getEventType(event);
      
      logger.info(`Processing fee event: ${eventType}`, {
        ledger: event.ledger,
        txHash: event.txHash,
      });

      switch (eventType) {
        case FEE_EVENT_TOPICS.FEE_BREAKDOWN:
          await this.handleFeeBreakdown(event);
          break;
        case FEE_EVENT_TOPICS.PROTOCOL_FEE_COLLECTED:
          await this.handleProtocolFeeCollected(event);
          break;
        case FEE_EVENT_TOPICS.LP_FEE_COLLECTED:
          await this.handleLpFeeCollected(event);
          break;
        case FEE_EVENT_TOPICS.PROTOCOL_FEE_UPDATED:
          await this.handleProtocolFeeUpdated(event);
          break;
        case FEE_EVENT_TOPICS.LP_FEE_UPDATED:
          await this.handleLpFeeUpdated(event);
          break;
        case FEE_EVENT_TOPICS.CREATION_FEE_UPDATED:
          await this.handleCreationFeeUpdated(event);
          break;
        case FEE_EVENT_TOPICS.TREASURY_UPDATED:
          await this.handleTreasuryUpdated(event);
          break;
        default:
          logger.warn(`Unknown fee event type: ${eventType}`);
      }
    } catch (error) {
      logger.error('Error handling fee event', {
        error,
        event: event.id,
      });
      throw error;
    }
  }

  /**
   * Handle FeeBreakdown event
   * Emitted on every buy/sell transaction with fee details
   */
  private async handleFeeBreakdown(event: any): Promise<void> {
    const data = this.parseFeeBreakdownEvent(event);
    
    logger.info(`Fee breakdown: ${data.grossAmount} stroops`, {
      token: data.tokenAddress,
      protocolFee: data.protocolFee,
      lpFee: data.lpFee,
      netAmount: data.netAmount,
    });

    // Create fee collection record
    await this.prisma.feeCollection.create({
      data: {
        eventType: 'FEE_BREAKDOWN',
        transactionHash: event.txHash,
        ledger: event.ledger,
        timestamp: new Date(event.createdAt),
        tokenAddress: data.tokenAddress,
        tokenSymbol: data.tokenSymbol || null,
        protocolFee: data.protocolFee,
        lpFee: data.lpFee,
        totalFee: data.totalFee,
        grossAmount: data.grossAmount,
        netAmount: data.netAmount,
        treasuryAddress: null,
      },
    });

    // Update fee stats (both token-specific and global)
    await this.updateFeeStats(
      data.tokenAddress,
      data.protocolFee,
      data.lpFee,
      data.grossAmount,
      new Date(event.createdAt)
    );

    await this.updateFeeStats(
      null, // Global stats
      data.protocolFee,
      data.lpFee,
      data.grossAmount,
      new Date(event.createdAt)
    );
  }

  /**
   * Handle ProtocolFeeCollected event
   * Emitted when protocol fee is transferred to treasury
   */
  private async handleProtocolFeeCollected(event: any): Promise<void> {
    const data = this.parseProtocolFeeCollectedEvent(event);
    
    logger.info(`Protocol fee collected: ${data.amount} stroops`, {
      token: data.tokenAddress,
      treasury: data.treasuryAddress,
    });

    await this.prisma.feeCollection.create({
      data: {
        eventType: 'PROTOCOL_FEE_COLLECTED',
        transactionHash: event.txHash,
        ledger: event.ledger,
        timestamp: new Date(event.createdAt),
        tokenAddress: data.tokenAddress,
        tokenSymbol: data.tokenSymbol || null,
        protocolFee: data.amount,
        lpFee: '0',
        totalFee: data.amount,
        grossAmount: '0',
        netAmount: '0',
        treasuryAddress: data.treasuryAddress,
      },
    });
  }

  /**
   * Handle LpFeeCollected event
   * Emitted when LP fee is added to bonding curve
   */
  private async handleLpFeeCollected(event: any): Promise<void> {
    const data = this.parseLpFeeCollectedEvent(event);
    
    logger.info(`LP fee collected: ${data.amount} stroops`, {
      token: data.tokenAddress,
    });

    await this.prisma.feeCollection.create({
      data: {
        eventType: 'LP_FEE_COLLECTED',
        transactionHash: event.txHash,
        ledger: event.ledger,
        timestamp: new Date(event.createdAt),
        tokenAddress: data.tokenAddress,
        tokenSymbol: data.tokenSymbol || null,
        protocolFee: '0',
        lpFee: data.amount,
        totalFee: data.amount,
        grossAmount: '0',
        netAmount: '0',
        treasuryAddress: null,
      },
    });
  }

  /**
   * Handle ProtocolFeeUpdated event
   */
  private async handleProtocolFeeUpdated(event: any): Promise<void> {
    const data = this.parseProtocolFeeUpdatedEvent(event);
    
    logger.info(`Protocol fee updated: ${data.oldFeeBps} -> ${data.newFeeBps} bps`, {
      updatedBy: data.updatedBy,
    });

    // Close current config by setting effectiveUntil
    await this.prisma.feeConfig.updateMany({
      where: {
        effectiveUntil: null,
      },
      data: {
        effectiveUntil: new Date(event.createdAt),
      },
    });

    // Create new config
    await this.prisma.feeConfig.create({
      data: {
        protocolFeeBps: parseInt(data.newFeeBps),
        lpFeeBps: 25, // Default, should be fetched from contract
        creationFee: '100000000', // Default, should be fetched from contract
        treasuryAddress: data.updatedBy, // Should be fetched from contract
        effectiveFrom: new Date(event.createdAt),
        updatedBy: data.updatedBy,
      },
    });
  }

  /**
   * Handle LpFeeUpdated event
   */
  private async handleLpFeeUpdated(event: any): Promise<void> {
    const data = this.parseLpFeeUpdatedEvent(event);
    
    logger.info(`LP fee updated: ${data.oldFeeBps} -> ${data.newFeeBps} bps`, {
      updatedBy: data.updatedBy,
    });

    // Close current config
    await this.prisma.feeConfig.updateMany({
      where: {
        effectiveUntil: null,
      },
      data: {
        effectiveUntil: new Date(event.createdAt),
      },
    });

    // Create new config
    await this.prisma.feeConfig.create({
      data: {
        protocolFeeBps: 5, // Default, should be fetched from contract
        lpFeeBps: parseInt(data.newFeeBps),
        creationFee: '100000000', // Default
        treasuryAddress: data.updatedBy,
        effectiveFrom: new Date(event.createdAt),
        updatedBy: data.updatedBy,
      },
    });
  }

  /**
   * Handle CreationFeeUpdated event
   */
  private async handleCreationFeeUpdated(event: any): Promise<void> {
    const data = this.parseCreationFeeUpdatedEvent(event);
    
    logger.info(`Creation fee updated: ${data.oldFee} -> ${data.newFee} stroops`, {
      updatedBy: data.updatedBy,
    });

    // Close current config
    await this.prisma.feeConfig.updateMany({
      where: {
        effectiveUntil: null,
      },
      data: {
        effectiveUntil: new Date(event.createdAt),
      },
    });

    // Create new config
    await this.prisma.feeConfig.create({
      data: {
        protocolFeeBps: 5, // Default
        lpFeeBps: 25, // Default
        creationFee: data.newFee,
        treasuryAddress: data.updatedBy,
        effectiveFrom: new Date(event.createdAt),
        updatedBy: data.updatedBy,
      },
    });
  }

  /**
   * Handle TreasuryUpdated event
   */
  private async handleTreasuryUpdated(event: any): Promise<void> {
    const data = this.parseTreasuryUpdatedEvent(event);
    
    logger.info(`Treasury updated: ${data.oldTreasury} -> ${data.newTreasury}`, {
      updatedBy: data.updatedBy,
    });

    // Close current config
    await this.prisma.feeConfig.updateMany({
      where: {
        effectiveUntil: null,
      },
      data: {
        effectiveUntil: new Date(event.createdAt),
      },
    });

    // Create new config
    await this.prisma.feeConfig.create({
      data: {
        protocolFeeBps: 5, // Default
        lpFeeBps: 25, // Default
        creationFee: '100000000', // Default
        treasuryAddress: data.newTreasury,
        effectiveFrom: new Date(event.createdAt),
        updatedBy: data.updatedBy,
      },
    });
  }

  /**
   * Update fee statistics for token or global
   */
  private async updateFeeStats(
    tokenAddress: string | null,
    protocolFee: string,
    lpFee: string,
    volume: string,
    timestamp: Date
  ): Promise<void> {
    const scope = tokenAddress ? 'TOKEN' : 'GLOBAL';
    const periods = ['HOUR', 'DAY', 'WEEK', 'MONTH', 'ALL_TIME'] as const;

    for (const period of periods) {
      const { periodStart, periodEnd } = this.getPeriodBounds(timestamp, period);

      const stats = await this.prisma.feeStats.findFirst({
        where: {
          scope,
          tokenAddress,
          period,
          periodStart,
        },
      });

      const protocolFeeNum = BigInt(protocolFee);
      const lpFeeNum = BigInt(lpFee);
      const totalFeeNum = protocolFeeNum + lpFeeNum;
      const volumeNum = BigInt(volume);

      if (stats) {
        // Update existing stats
        const newTotalProtocol = BigInt(stats.totalProtocolFees) + protocolFeeNum;
        const newTotalLp = BigInt(stats.totalLpFees) + lpFeeNum;
        const newTotalFees = BigInt(stats.totalFees) + totalFeeNum;
        const newTotalVolume = BigInt(stats.totalVolume) + volumeNum;
        const newTradeCount = stats.tradeCount + 1;

        await this.prisma.feeStats.update({
          where: { id: stats.id },
          data: {
            totalProtocolFees: newTotalProtocol.toString(),
            totalLpFees: newTotalLp.toString(),
            totalFees: newTotalFees.toString(),
            totalVolume: newTotalVolume.toString(),
            tradeCount: newTradeCount,
            avgProtocolFee: (newTotalProtocol / BigInt(newTradeCount)).toString(),
            avgLpFee: (newTotalLp / BigInt(newTradeCount)).toString(),
            avgTradeSize: (newTotalVolume / BigInt(newTradeCount)).toString(),
          },
        });
      } else {
        // Create new stats
        await this.prisma.feeStats.create({
          data: {
            scope,
            tokenAddress,
            period,
            periodStart,
            periodEnd,
            totalProtocolFees: protocolFee,
            totalLpFees: lpFee,
            totalFees: totalFeeNum.toString(),
            totalVolume: volume,
            tradeCount: 1,
            avgProtocolFee: protocolFee,
            avgLpFee: lpFee,
            avgTradeSize: volume,
          },
        });
      }
    }
  }

  /**
   * Get period boundaries for a given timestamp
   */
  private getPeriodBounds(timestamp: Date, period: string): { periodStart: Date; periodEnd: Date } {
    const date = new Date(timestamp);
    let periodStart: Date;
    let periodEnd: Date;

    switch (period) {
      case 'HOUR':
        periodStart = new Date(date);
        periodStart.setMinutes(0, 0, 0);
        periodEnd = new Date(periodStart);
        periodEnd.setHours(periodEnd.getHours() + 1);
        break;
      case 'DAY':
        periodStart = new Date(date);
        periodStart.setHours(0, 0, 0, 0);
        periodEnd = new Date(periodStart);
        periodEnd.setDate(periodEnd.getDate() + 1);
        break;
      case 'WEEK':
        periodStart = new Date(date);
        periodStart.setHours(0, 0, 0, 0);
        periodStart.setDate(periodStart.getDate() - periodStart.getDay());
        periodEnd = new Date(periodStart);
        periodEnd.setDate(periodEnd.getDate() + 7);
        break;
      case 'MONTH':
        periodStart = new Date(date.getFullYear(), date.getMonth(), 1);
        periodEnd = new Date(date.getFullYear(), date.getMonth() + 1, 1);
        break;
      case 'ALL_TIME':
        periodStart = new Date(0);
        periodEnd = new Date('2099-12-31');
        break;
      default:
        periodStart = new Date(0);
        periodEnd = new Date('2099-12-31');
    }

    return { periodStart, periodEnd };
  }

  /**
   * Parse FeeBreakdown event from Soroban
   */
  private parseFeeBreakdownEvent(event: any): any {
    const value = event.value?.value;
    
    return {
      tokenAddress: this.scValToString(value?.token),
      tokenSymbol: null, // Will be populated from DB later if needed
      grossAmount: this.scValToString(value?.gross_amount || '0'),
      protocolFee: this.scValToString(value?.protocol_fee || '0'),
      lpFee: this.scValToString(value?.lp_fee || '0'),
      totalFee: this.scValToString(value?.total_fees || '0'),
      netAmount: this.scValToString(value?.net_amount || '0'),
    };
  }

  /**
   * Parse ProtocolFeeCollected event
   */
  private parseProtocolFeeCollectedEvent(event: any): any {
    const value = event.value?.value;
    
    return {
      tokenAddress: this.scValToString(value?.token),
      tokenSymbol: null,
      amount: this.scValToString(value?.amount || '0'),
      treasuryAddress: this.scValToString(value?.treasury),
    };
  }

  /**
   * Parse LpFeeCollected event
   */
  private parseLpFeeCollectedEvent(event: any): any {
    const value = event.value?.value;
    
    return {
      tokenAddress: this.scValToString(value?.token),
      tokenSymbol: null,
      amount: this.scValToString(value?.amount || '0'),
    };
  }

  /**
   * Parse ProtocolFeeUpdated event
   */
  private parseProtocolFeeUpdatedEvent(event: any): any {
    const value = event.value?.value;
    
    return {
      oldFeeBps: this.scValToString(value?.old_fee_bps || '0'),
      newFeeBps: this.scValToString(value?.new_fee_bps || '0'),
      updatedBy: this.scValToString(value?.updated_by),
    };
  }

  /**
   * Parse LpFeeUpdated event
   */
  private parseLpFeeUpdatedEvent(event: any): any {
    const value = event.value?.value;
    
    return {
      oldFeeBps: this.scValToString(value?.old_fee_bps || '0'),
      newFeeBps: this.scValToString(value?.new_fee_bps || '0'),
      updatedBy: this.scValToString(value?.updated_by),
    };
  }

  /**
   * Parse CreationFeeUpdated event
   */
  private parseCreationFeeUpdatedEvent(event: any): any {
    const value = event.value?.value;
    
    return {
      oldFee: this.scValToString(value?.old_fee || '0'),
      newFee: this.scValToString(value?.new_fee || '0'),
      updatedBy: this.scValToString(value?.updated_by),
    };
  }

  /**
   * Parse TreasuryUpdated event
   */
  private parseTreasuryUpdatedEvent(event: any): any {
    const value = event.value?.value;
    
    return {
      oldTreasury: this.scValToString(value?.old_treasury),
      newTreasury: this.scValToString(value?.new_treasury),
      updatedBy: this.scValToString(value?.updated_by),
    };
  }

  /**
   * Get event type from event topic
   */
  private getEventType(event: any): string {
    const topics = event.topic || [];
    if (topics.length === 0) return 'unknown';
    
    const eventName = this.scValToString(topics[0]);
    return eventName.toLowerCase();
  }

  /**
   * Convert Soroban ScVal to string
   */
  private scValToString(scVal: any): string {
    if (!scVal) return '';
    
    // Handle different ScVal types
    if (typeof scVal === 'string') return scVal;
    if (typeof scVal === 'number') return scVal.toString();
    if (scVal._value) return scVal._value.toString();
    if (scVal.value) return this.scValToString(scVal.value);
    
    return String(scVal);
  }
}

export default FeeEventHandler;