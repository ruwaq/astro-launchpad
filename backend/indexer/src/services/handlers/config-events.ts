/**
 * Config Event Handler
 *
 * Handles configuration update events from the SAC Factory contract:
 * - ProtocolFeeUpdated
 * - LpFeeUpdated
 * - CreationFeeUpdated
 * - TreasuryUpdated
 * - GraduationThresholdUpdated
 * - XlmAddressUpdated
 * - OracleAddressUpdated
 * - AmmWasmHashUpdated
 * - AntiWhaleConfigUpdated
 * - MinMarketCapUpdated
 * - OraclePriceMaxAgeUpdated
 * - BridgeConfigUpdated
 */

import { PrismaClient } from '@astroshibapop/shared/prisma';
import { scValToNative } from '@stellar/stellar-sdk';
import { logger } from '../../lib/logger.js';

// Config event types from contract
const CONFIG_EVENT_TOPICS = {
  PROTOCOL_FEE_UPDATED: 'protocolfeeupdated',
  LP_FEE_UPDATED: 'lpfeeupdated',
  CREATION_FEE_UPDATED: 'creationfeeupdated',
  TREASURY_UPDATED: 'treasuryupdated',
  GRADUATION_THRESHOLD_UPDATED: 'graduationthresholdupdated',
  XLM_ADDRESS_UPDATED: 'xlmaddressupdated',
  ORACLE_ADDRESS_UPDATED: 'oracleaddressupdated',
  AMM_WASM_HASH_UPDATED: 'ammwasmhashupdated',
  ANTI_WHALE_CONFIG_UPDATED: 'antiwhaleconfigpdated',
  MIN_MARKET_CAP_UPDATED: 'minmarketcapupdated',
  ORACLE_PRICE_MAX_AGE_UPDATED: 'oraclepricemaxageupdated',
  BRIDGE_CONFIG_UPDATED: 'bridgeconfigpdated',
  FEE_CONFIG_UPDATED: 'feeconfigpdated',
};

export class ConfigEventHandler {
  constructor(private prisma: PrismaClient) {}

  /**
   * Main entry point for config event handling
   */
  async handleEvent(event: any): Promise<void> {
    try {
      const eventType = this.getEventType(event);

      logger.info(`Processing config event: ${eventType}`, {
        ledger: event.ledger,
        txHash: event.id,
      });

      switch (eventType) {
        case CONFIG_EVENT_TOPICS.PROTOCOL_FEE_UPDATED:
          await this.handleProtocolFeeUpdated(event);
          break;
        case CONFIG_EVENT_TOPICS.LP_FEE_UPDATED:
          await this.handleLpFeeUpdated(event);
          break;
        case CONFIG_EVENT_TOPICS.CREATION_FEE_UPDATED:
          await this.handleCreationFeeUpdated(event);
          break;
        case CONFIG_EVENT_TOPICS.TREASURY_UPDATED:
          await this.handleTreasuryUpdated(event);
          break;
        case CONFIG_EVENT_TOPICS.GRADUATION_THRESHOLD_UPDATED:
          await this.handleGraduationThresholdUpdated(event);
          break;
        case CONFIG_EVENT_TOPICS.XLM_ADDRESS_UPDATED:
          await this.handleXlmAddressUpdated(event);
          break;
        case CONFIG_EVENT_TOPICS.ORACLE_ADDRESS_UPDATED:
          await this.handleOracleAddressUpdated(event);
          break;
        case CONFIG_EVENT_TOPICS.AMM_WASM_HASH_UPDATED:
          await this.handleAmmWasmHashUpdated(event);
          break;
        case CONFIG_EVENT_TOPICS.ANTI_WHALE_CONFIG_UPDATED:
          await this.handleAntiWhaleConfigUpdated(event);
          break;
        case CONFIG_EVENT_TOPICS.MIN_MARKET_CAP_UPDATED:
          await this.handleMinMarketCapUpdated(event);
          break;
        case CONFIG_EVENT_TOPICS.ORACLE_PRICE_MAX_AGE_UPDATED:
          await this.handleOraclePriceMaxAgeUpdated(event);
          break;
        case CONFIG_EVENT_TOPICS.BRIDGE_CONFIG_UPDATED:
          await this.handleBridgeConfigUpdated(event);
          break;
        case CONFIG_EVENT_TOPICS.FEE_CONFIG_UPDATED:
          await this.handleFeeConfigUpdated(event);
          break;
        default:
          logger.warn(`Unknown config event type: ${eventType}`);
      }
    } catch (error) {
      logger.error('Error handling config event', {
        error,
        eventId: event.id,
      });
      throw error;
    }
  }

  private async handleProtocolFeeUpdated(event: any): Promise<void> {
    const data = this.parseEventData(event);

    logger.info(`Protocol fee updated: ${data.old_fee_bps} -> ${data.new_fee_bps} bps`);

    await this.prisma.configUpdateEvent.create({
      data: {
        type: 'PROTOCOL_FEE_UPDATED',
        oldValue: this.scValToString(data.old_fee_bps),
        newValue: this.scValToString(data.new_fee_bps),
        updatedBy: this.scValToString(data.updated_by),
        timestamp: this.getTimestamp(event),
        txHash: event.id,
        blockNumber: event.ledger?.toString(),
      },
    });
  }

  private async handleLpFeeUpdated(event: any): Promise<void> {
    const data = this.parseEventData(event);

    logger.info(`LP fee updated: ${data.old_fee_bps} -> ${data.new_fee_bps} bps`);

    await this.prisma.configUpdateEvent.create({
      data: {
        type: 'LP_FEE_UPDATED',
        oldValue: this.scValToString(data.old_fee_bps),
        newValue: this.scValToString(data.new_fee_bps),
        updatedBy: this.scValToString(data.updated_by),
        timestamp: this.getTimestamp(event),
        txHash: event.id,
        blockNumber: event.ledger?.toString(),
      },
    });
  }

  private async handleCreationFeeUpdated(event: any): Promise<void> {
    const data = this.parseEventData(event);

    logger.info(`Creation fee updated: ${data.old_fee} -> ${data.new_fee}`);

    await this.prisma.configUpdateEvent.create({
      data: {
        type: 'CREATION_FEE_UPDATED',
        oldValue: this.scValToString(data.old_fee),
        newValue: this.scValToString(data.new_fee),
        updatedBy: this.scValToString(data.updated_by),
        timestamp: this.getTimestamp(event),
        txHash: event.id,
        blockNumber: event.ledger?.toString(),
      },
    });
  }

  private async handleTreasuryUpdated(event: any): Promise<void> {
    const data = this.parseEventData(event);

    logger.info(`Treasury updated: ${data.old_treasury} -> ${data.new_treasury}`);

    await this.prisma.configUpdateEvent.create({
      data: {
        type: 'TREASURY_UPDATED',
        oldAddress: this.scValToString(data.old_treasury),
        newAddress: this.scValToString(data.new_treasury),
        updatedBy: this.scValToString(data.updated_by),
        timestamp: this.getTimestamp(event),
        txHash: event.id,
        blockNumber: event.ledger?.toString(),
      },
    });
  }

  private async handleGraduationThresholdUpdated(event: any): Promise<void> {
    const data = this.parseEventData(event);

    logger.info(`Graduation threshold updated: ${data.old_threshold} -> ${data.new_threshold}`);

    await this.prisma.configUpdateEvent.create({
      data: {
        type: 'GRADUATION_THRESHOLD_UPDATED',
        oldValue: this.scValToString(data.old_threshold),
        newValue: this.scValToString(data.new_threshold),
        updatedBy: this.scValToString(data.updated_by),
        timestamp: this.getTimestamp(event),
        txHash: event.id,
        blockNumber: event.ledger?.toString(),
      },
    });
  }

  private async handleXlmAddressUpdated(event: any): Promise<void> {
    const data = this.parseEventData(event);

    logger.info(`XLM address updated`);

    await this.prisma.configUpdateEvent.create({
      data: {
        type: 'XLM_ADDRESS_UPDATED',
        oldAddress: this.scValToString(data.old_address),
        newAddress: this.scValToString(data.new_address),
        updatedBy: this.scValToString(data.updated_by),
        timestamp: this.getTimestamp(event),
        txHash: event.id,
        blockNumber: event.ledger?.toString(),
      },
    });
  }

  private async handleOracleAddressUpdated(event: any): Promise<void> {
    const data = this.parseEventData(event);

    logger.info(`Oracle address updated`);

    await this.prisma.configUpdateEvent.create({
      data: {
        type: 'ORACLE_ADDRESS_UPDATED',
        oldAddress: this.scValToString(data.old_address),
        newAddress: this.scValToString(data.new_address),
        updatedBy: this.scValToString(data.updated_by),
        timestamp: this.getTimestamp(event),
        txHash: event.id,
        blockNumber: event.ledger?.toString(),
      },
    });
  }

  private async handleAmmWasmHashUpdated(event: any): Promise<void> {
    const data = this.parseEventData(event);

    logger.info(`AMM WASM hash updated`);

    await this.prisma.configUpdateEvent.create({
      data: {
        type: 'AMM_WASM_HASH_UPDATED',
        updatedBy: this.scValToString(data.updated_by),
        timestamp: this.getTimestamp(event),
        txHash: event.id,
        blockNumber: event.ledger?.toString(),
      },
    });
  }

  private async handleAntiWhaleConfigUpdated(event: any): Promise<void> {
    const data = this.parseEventData(event);

    logger.info(`Anti-whale config updated`);

    await this.prisma.configUpdateEvent.create({
      data: {
        type: 'ANTI_WHALE_CONFIG_UPDATED',
        updatedBy: this.scValToString(data.updated_by),
        timestamp: this.getTimestamp(event),
        txHash: event.id,
        blockNumber: event.ledger?.toString(),
      },
    });
  }

  private async handleMinMarketCapUpdated(event: any): Promise<void> {
    const data = this.parseEventData(event);

    logger.info(`Min market cap updated: ${data.old_min_market_cap} -> ${data.new_min_market_cap}`);

    await this.prisma.configUpdateEvent.create({
      data: {
        type: 'MIN_MARKET_CAP_UPDATED',
        oldValue: this.scValToString(data.old_min_market_cap),
        newValue: this.scValToString(data.new_min_market_cap),
        updatedBy: this.scValToString(data.updated_by),
        timestamp: this.getTimestamp(event),
        txHash: event.id,
        blockNumber: event.ledger?.toString(),
      },
    });
  }

  private async handleOraclePriceMaxAgeUpdated(event: any): Promise<void> {
    const data = this.parseEventData(event);

    logger.info(`Oracle price max age updated: ${data.old_max_age} -> ${data.new_max_age}`);

    await this.prisma.configUpdateEvent.create({
      data: {
        type: 'ORACLE_PRICE_MAX_AGE_UPDATED',
        oldValue: this.scValToString(data.old_max_age),
        newValue: this.scValToString(data.new_max_age),
        updatedBy: this.scValToString(data.updated_by),
        timestamp: this.getTimestamp(event),
        txHash: event.id,
        blockNumber: event.ledger?.toString(),
      },
    });
  }

  private async handleBridgeConfigUpdated(event: any): Promise<void> {
    const data = this.parseEventData(event);

    logger.info(`Bridge config updated: enabled=${data.enabled}`);

    await this.prisma.configUpdateEvent.create({
      data: {
        type: 'BRIDGE_CONFIG_UPDATED',
        oldAddress: this.scValToString(data.old_bridge),
        newAddress: this.scValToString(data.new_bridge),
        newValue: data.enabled ? 'true' : 'false',
        updatedBy: this.scValToString(data.updated_by),
        timestamp: this.getTimestamp(event),
        txHash: event.id,
        blockNumber: event.ledger?.toString(),
      },
    });
  }

  private async handleFeeConfigUpdated(event: any): Promise<void> {
    const data = this.parseEventData(event);

    logger.info(`Fee config updated`);

    // Create or update FeeConfig record
    await this.prisma.feeConfig.upsert({
      where: { contractAddress: event.contractId || 'sac_factory' },
      update: {
        creationFee: this.scValToString(data.creation_fee),
        protocolFeeBps: parseInt(this.scValToString(data.trading_fee_bps)) || 5,
        lpFeeBps: 25, // Default
        updatedBy: this.scValToString(data.updated_by),
        effectiveFrom: this.getTimestamp(event),
      },
      create: {
        contractAddress: event.contractId || 'sac_factory',
        creationFee: this.scValToString(data.creation_fee),
        protocolFeeBps: parseInt(this.scValToString(data.trading_fee_bps)) || 5,
        lpFeeBps: 25,
        treasuryAddress: this.scValToString(data.updated_by),
        effectiveFrom: this.getTimestamp(event),
        updatedBy: this.scValToString(data.updated_by),
      },
    });
  }

  // Helper methods

  private parseEventData(event: any): any {
    try {
      const value = event.value;
      if (!value) return {};

      if (typeof value === 'object' && !value._switch && !value._arm) {
        return value;
      }

      return scValToNative(value);
    } catch (error) {
      logger.error('Error parsing config event data:', error);
      return {};
    }
  }

  private getEventType(event: any): string {
    try {
      const topics = event.topic || [];
      if (topics.length === 0) return 'unknown';

      const firstTopic = topics[0];
      if (typeof firstTopic === 'string') {
        return firstTopic.toLowerCase();
      }

      try {
        const decoded = scValToNative(firstTopic);
        return (typeof decoded === 'string' ? decoded : decoded?.toString() || 'unknown').toLowerCase();
      } catch {
        return firstTopic?.toString()?.toLowerCase() || 'unknown';
      }
    } catch {
      return 'unknown';
    }
  }

  private getTimestamp(event: any): Date {
    if (event.ledger_close_time) {
      return new Date(event.ledger_close_time);
    }
    return new Date();
  }

  private scValToString(scVal: any): string {
    if (!scVal) return '';
    if (typeof scVal === 'string') return scVal;
    if (typeof scVal === 'number' || typeof scVal === 'bigint') return scVal.toString();
    if (scVal.toString) return scVal.toString();
    return String(scVal);
  }
}

export default ConfigEventHandler;
