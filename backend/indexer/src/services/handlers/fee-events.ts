/**
 * Fee Event Handler
 * 
 * Handles fee-related events from the SAC Factory contract:
 * - FeeBreakdown: Emitted on every buy/sell with fee calculation
 * - ProtocolFeeCollected: Protocol fee transferred to treasury
 * - LpFeeCollected: LP fee added to bonding curve
 * - FeeConfigUpdated: Changes to fee configuration
 */

import { PrismaClient } from '@astroshibapop/shared/prisma';
import { logger } from '../../lib/logger.js';

// Fee event types from contract
const FEE_EVENT_TOPICS = {
  FEE_BREAKDOWN: 'fee_breakdown',
  PROTOCOL_FEE_COLLECTED: 'protocol_fee_collected',
  LP_FEE_COLLECTED: 'lp_fee_collected',
  FEES_WITHDRAWN: 'fees_withdrawn',
  PROTOCOL_FEE_UPDATED: 'protocol_fee_updated',
  LP_FEE_UPDATED: 'lp_fee_updated',
  CREATION_FEE_UPDATED: 'creation_fee_updated',
  TREASURY_UPDATED: 'treasury_updated',
};

// Default fee values (must match contract's fee_management.rs)
const DEFAULT_PROTOCOL_FEE_BPS = 5;
const DEFAULT_LP_FEE_BPS = 25;
const DEFAULT_CREATION_FEE = '100000000'; // 10 XLM in stroops

export class FeeEventHandler {
  constructor(private prisma: PrismaClient) {}

  /**
   * Get current fee config for a contract, or return defaults
   * This ensures fee updates preserve non-updated values
   */
  private async getCurrentFeeConfig(contractAddress: string): Promise<{
    protocolFeeBps: number;
    lpFeeBps: number;
    creationFee: string;
    treasuryAddress: string;
  }> {
    const currentConfig = await this.prisma.feeConfig.findFirst({
      where: { contractAddress },
      orderBy: { effectiveFrom: 'desc' },
    });

    return {
      protocolFeeBps: currentConfig?.protocolFeeBps ?? DEFAULT_PROTOCOL_FEE_BPS,
      lpFeeBps: currentConfig?.lpFeeBps ?? DEFAULT_LP_FEE_BPS,
      creationFee: currentConfig?.creationFee ?? DEFAULT_CREATION_FEE,
      treasuryAddress: currentConfig?.treasuryAddress ?? '',
    };
  }

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
        case FEE_EVENT_TOPICS.FEES_WITHDRAWN:
          await this.handleFeesWithdrawn(event);
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
        hash: event.txHash || `evt_${event.id}`, // Use txHash or event ID
        type: 'PROTOCOL_FEE', // Default type, could refine based on logic
        transactionType: 'SWAP', // Assume SWAP for breakdown
        
        tokenAddress: data.tokenAddress,
        userAddress: event.by || 'unknown', // Need to extract user from event
        
        amount: data.totalFee,
        
        // Breakdown
        grossAmount: data.grossAmount,
        protocolFee: data.protocolFee,
        lpFee: data.lpFee,
        netAmount: data.netAmount,
        
        treasuryAddress: null,
        
        timestamp: new Date(event.createdAt || Date.now()),
        blockNumber: event.ledger ? event.ledger.toString() : '0',
      },
    });
    
    // Note: Fee stats updates are handled by FeeStatsService, 
    // we just record the raw collection here.
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
        hash: event.txHash || `evt_${event.id}`,
        type: 'PROTOCOL_FEE',
        transactionType: 'COLLECT',
        
        tokenAddress: data.tokenAddress,
        userAddress: 'system',
        
        amount: data.amount,
        grossAmount: '0',
        netAmount: '0',
        protocolFee: data.amount,
        
        treasuryAddress: data.treasuryAddress,
        
        timestamp: new Date(event.createdAt || Date.now()),
        blockNumber: event.ledger ? event.ledger.toString() : '0',
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
        hash: event.txHash || `evt_${event.id}`,
        type: 'LP_FEE',
        transactionType: 'COLLECT',

        tokenAddress: data.tokenAddress,
        userAddress: 'system',

        amount: data.amount,
        grossAmount: '0',
        netAmount: '0',
        lpFee: data.amount,

        treasuryAddress: null,

        timestamp: new Date(event.createdAt || Date.now()),
        blockNumber: event.ledger ? event.ledger.toString() : '0',
      },
    });
  }

  /**
   * Handle FeesWithdrawn event
   * Emitted when admin withdraws accumulated fees from a token
   */
  private async handleFeesWithdrawn(event: any): Promise<void> {
    const data = this.parseFeesWithdrawnEvent(event);

    logger.info(`Fees withdrawn: ${data.amount} stroops from token ${data.tokenAddress}`, {
      recipient: data.recipient,
      withdrawnBy: data.withdrawnBy,
    });

    await this.prisma.feeCollection.create({
      data: {
        hash: event.txHash || `evt_${event.id}`,
        type: 'WITHDRAWAL',
        transactionType: 'WITHDRAW',

        tokenAddress: data.tokenAddress,
        userAddress: data.withdrawnBy,

        amount: data.amount,
        grossAmount: '0',
        netAmount: data.amount,

        treasuryAddress: data.recipient,

        timestamp: new Date(event.createdAt || Date.now()),
        blockNumber: event.ledger ? event.ledger.toString() : '0',
      },
    });
  }

  /**
   * Handle ProtocolFeeUpdated event
   * Preserves current LP fee and creation fee values
   */
  private async handleProtocolFeeUpdated(event: any): Promise<void> {
    const data = this.parseProtocolFeeUpdatedEvent(event);
    const contractAddress = event.contractId || 'sac_factory';

    logger.info(`Protocol fee updated: ${data.oldFeeBps} -> ${data.newFeeBps} bps`, {
      updatedBy: data.updatedBy,
    });

    // Get current config to preserve non-updated values
    const currentConfig = await this.getCurrentFeeConfig(contractAddress);

    // Create new config with updated protocol fee, preserving other values
    await this.prisma.feeConfig.create({
      data: {
        contractAddress,
        protocolFeeBps: parseInt(data.newFeeBps),
        lpFeeBps: currentConfig.lpFeeBps,           // Preserve current LP fee
        creationFee: currentConfig.creationFee,     // Preserve current creation fee
        treasuryAddress: currentConfig.treasuryAddress || data.updatedBy,
        effectiveFrom: new Date(event.createdAt || Date.now()),
        updatedBy: data.updatedBy,
      },
    });
  }

  /**
   * Handle LpFeeUpdated event
   * Preserves current protocol fee and creation fee values
   */
  private async handleLpFeeUpdated(event: any): Promise<void> {
    const data = this.parseLpFeeUpdatedEvent(event);
    const contractAddress = event.contractId || 'sac_factory';

    logger.info(`LP fee updated: ${data.oldFeeBps} -> ${data.newFeeBps} bps`, {
      updatedBy: data.updatedBy,
    });

    // Get current config to preserve non-updated values
    const currentConfig = await this.getCurrentFeeConfig(contractAddress);

    await this.prisma.feeConfig.create({
      data: {
        contractAddress,
        protocolFeeBps: currentConfig.protocolFeeBps, // Preserve current protocol fee
        lpFeeBps: parseInt(data.newFeeBps),
        creationFee: currentConfig.creationFee,       // Preserve current creation fee
        treasuryAddress: currentConfig.treasuryAddress || data.updatedBy,
        effectiveFrom: new Date(event.createdAt || Date.now()),
        updatedBy: data.updatedBy,
      },
    });
  }

  /**
   * Handle CreationFeeUpdated event
   * Preserves current protocol fee and LP fee values
   */
  private async handleCreationFeeUpdated(event: any): Promise<void> {
    const data = this.parseCreationFeeUpdatedEvent(event);
    const contractAddress = event.contractId || 'sac_factory';

    logger.info(`Creation fee updated: ${data.oldFee} -> ${data.newFee} stroops`, {
      updatedBy: data.updatedBy,
    });

    // Get current config to preserve non-updated values
    const currentConfig = await this.getCurrentFeeConfig(contractAddress);

    await this.prisma.feeConfig.create({
      data: {
        contractAddress,
        protocolFeeBps: currentConfig.protocolFeeBps, // Preserve current protocol fee
        lpFeeBps: currentConfig.lpFeeBps,             // Preserve current LP fee
        creationFee: data.newFee,
        treasuryAddress: currentConfig.treasuryAddress || data.updatedBy,
        effectiveFrom: new Date(event.createdAt || Date.now()),
        updatedBy: data.updatedBy,
      },
    });
  }

  /**
   * Handle TreasuryUpdated event
   * Preserves all fee values, updates only treasury address
   */
  private async handleTreasuryUpdated(event: any): Promise<void> {
    const data = this.parseTreasuryUpdatedEvent(event);
    const contractAddress = event.contractId || 'sac_factory';

    logger.info(`Treasury updated: ${data.oldTreasury} -> ${data.newTreasury}`, {
      updatedBy: data.updatedBy,
    });

    // Get current config to preserve all fee values
    const currentConfig = await this.getCurrentFeeConfig(contractAddress);

    await this.prisma.feeConfig.create({
      data: {
        contractAddress,
        protocolFeeBps: currentConfig.protocolFeeBps, // Preserve current protocol fee
        lpFeeBps: currentConfig.lpFeeBps,             // Preserve current LP fee
        creationFee: currentConfig.creationFee,       // Preserve current creation fee
        treasuryAddress: data.newTreasury,
        effectiveFrom: new Date(event.createdAt || Date.now()),
        updatedBy: data.updatedBy,
      },
    });
  }

  // ... Helper methods kept simple ...

  /**
   * Parse FeeBreakdown event from Soroban
   */
  private parseFeeBreakdownEvent(event: any): any {
    // Simplified parsing logic
    const value = event.value?.value || {};
    return {
      tokenAddress: this.scValToString(value.token),
      grossAmount: this.scValToString(value.gross_amount || '0'),
      protocolFee: this.scValToString(value.protocol_fee || '0'),
      lpFee: this.scValToString(value.lp_fee || '0'),
      totalFee: this.scValToString(value.total_fees || '0'),
      netAmount: this.scValToString(value.net_amount || '0'),
    };
  }

  private parseProtocolFeeCollectedEvent(event: any): any {
    const value = event.value?.value || {};
    return {
      tokenAddress: this.scValToString(value.token),
      amount: this.scValToString(value.amount || '0'),
      treasuryAddress: this.scValToString(value.treasury),
    };
  }

  private parseLpFeeCollectedEvent(event: any): any {
    const value = event.value?.value || {};
    return {
      tokenAddress: this.scValToString(value.token),
      amount: this.scValToString(value.amount || '0'),
    };
  }

  private parseFeesWithdrawnEvent(event: any): any {
    const value = event.value?.value || {};
    return {
      tokenAddress: this.scValToString(value.token),
      amount: this.scValToString(value.amount || '0'),
      recipient: this.scValToString(value.recipient),
      withdrawnBy: this.scValToString(value.withdrawn_by),
    };
  }

  private parseProtocolFeeUpdatedEvent(event: any): any {
    const value = event.value?.value || {};
    return {
      oldFeeBps: this.scValToString(value.old_fee_bps || '0'),
      newFeeBps: this.scValToString(value.new_fee_bps || '0'),
      updatedBy: this.scValToString(value.updated_by),
    };
  }

  private parseLpFeeUpdatedEvent(event: any): any {
    const value = event.value?.value || {};
    return {
      oldFeeBps: this.scValToString(value.old_fee_bps || '0'),
      newFeeBps: this.scValToString(value.new_fee_bps || '0'),
      updatedBy: this.scValToString(value.updated_by),
    };
  }

  private parseCreationFeeUpdatedEvent(event: any): any {
    const value = event.value?.value || {};
    return {
      oldFee: this.scValToString(value.old_fee || '0'),
      newFee: this.scValToString(value.new_fee || '0'),
      updatedBy: this.scValToString(value.updated_by),
    };
  }

  private parseTreasuryUpdatedEvent(event: any): any {
    const value = event.value?.value || {};
    return {
      oldTreasury: this.scValToString(value.old_treasury),
      newTreasury: this.scValToString(value.new_treasury),
      updatedBy: this.scValToString(value.updated_by),
    };
  }

  private getEventType(event: any): string {
    const topics = event.topic || [];
    if (topics.length === 0) return 'unknown';
    
    // In a real implementation, we would decode the symbol from XDR
    // For now, assuming we handle the raw or decoded topic string
    const eventName = topics[0].toString();
    return eventName.toLowerCase();
  }

  private scValToString(scVal: any): string {
    if (!scVal) return '';
    if (typeof scVal === 'string') return scVal;
    if (typeof scVal === 'number') return scVal.toString();
    return String(scVal);
  }
}

export default FeeEventHandler;
