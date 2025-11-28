/**
 * ASTRO Token Event Handler
 *
 * Handles ASTRO token integration events from the SAC Factory contract:
 * - AstroConfigUpdated: When ASTRO integration config changes
 * - AstroBuybackExecuted: When ASTRO buyback and burn happens
 * - AstroLiquidityAdded: When ASTRO liquidity is added to pairs
 */

import { PrismaClient } from '@astroshibapop/shared/prisma';
import { scValToNative } from '@stellar/stellar-sdk';
import { logger } from '../../lib/logger.js';

// ASTRO event types from contract
const ASTRO_EVENT_TOPICS = {
  ASTRO_CONFIG_UPDATED: 'astroconfigpdated',
  ASTRO_BUYBACK_EXECUTED: 'astrobuybackexecuted',
  ASTRO_LIQUIDITY_ADDED: 'astroliquidityadded',
};

export class AstroEventHandler {
  constructor(private prisma: PrismaClient) {}

  /**
   * Main entry point for ASTRO event handling
   */
  async handleEvent(event: any): Promise<void> {
    try {
      const eventType = this.getEventType(event);

      logger.info(`Processing ASTRO event: ${eventType}`, {
        ledger: event.ledger,
        txHash: event.id,
      });

      switch (eventType) {
        case ASTRO_EVENT_TOPICS.ASTRO_CONFIG_UPDATED:
          await this.handleAstroConfigUpdated(event);
          break;
        case ASTRO_EVENT_TOPICS.ASTRO_BUYBACK_EXECUTED:
          await this.handleAstroBuybackExecuted(event);
          break;
        case ASTRO_EVENT_TOPICS.ASTRO_LIQUIDITY_ADDED:
          await this.handleAstroLiquidityAdded(event);
          break;
        default:
          logger.warn(`Unknown ASTRO event type: ${eventType}`);
      }
    } catch (error) {
      logger.error('Error handling ASTRO event', {
        error,
        eventId: event.id,
      });
      throw error;
    }
  }

  /**
   * Handle AstroConfigUpdated event
   */
  private async handleAstroConfigUpdated(event: any): Promise<void> {
    const data = this.parseEventData(event);

    logger.info('ASTRO config updated', {
      tokenAddress: data.token_address,
      ammAddress: data.amm_address,
      liquidityBps: data.liquidity_bps,
      buybackBps: data.buyback_bps,
    });

    await this.prisma.astroEvent.create({
      data: {
        type: 'ASTRO_CONFIG_UPDATED',
        ammPair: this.scValToString(data.amm_address),
        timestamp: this.getTimestamp(event),
        txHash: event.id,
        blockNumber: event.ledger?.toString(),
      },
    });

    // Also record in config updates
    await this.prisma.configUpdateEvent.create({
      data: {
        type: 'BRIDGE_CONFIG_UPDATED', // Closest match
        newAddress: this.scValToString(data.amm_address),
        updatedBy: this.scValToString(data.updated_by),
        timestamp: this.getTimestamp(event),
        txHash: event.id,
        blockNumber: event.ledger?.toString(),
      },
    });
  }

  /**
   * Handle AstroBuybackExecuted event
   * This is a significant event - ASTRO tokens are burned
   */
  private async handleAstroBuybackExecuted(event: any): Promise<void> {
    const data = this.parseEventData(event);
    const graduatedToken = this.scValToString(data.graduated_token);
    const xlmUsed = this.scValToString(data.xlm_used);
    const astroBurned = this.scValToString(data.astro_burned);

    logger.info(`ASTRO buyback executed: ${xlmUsed} XLM -> ${astroBurned} ASTRO burned`, {
      graduatedToken,
    });

    await this.prisma.astroEvent.create({
      data: {
        type: 'ASTRO_BUYBACK_EXECUTED',
        graduatedToken,
        xlmUsed,
        astroBurned,
        timestamp: this.getTimestamp(event),
        txHash: event.id,
        blockNumber: event.ledger?.toString(),
      },
    });
  }

  /**
   * Handle AstroLiquidityAdded event
   */
  private async handleAstroLiquidityAdded(event: any): Promise<void> {
    const data = this.parseEventData(event);
    const graduatedToken = this.scValToString(data.graduated_token);
    const astroAmount = this.scValToString(data.astro_amount);
    const tokenAmount = this.scValToString(data.token_amount);
    const ammPair = this.scValToString(data.amm_pair);

    logger.info(`ASTRO liquidity added: ${astroAmount} ASTRO + ${tokenAmount} tokens to ${ammPair}`);

    await this.prisma.astroEvent.create({
      data: {
        type: 'ASTRO_LIQUIDITY_ADDED',
        graduatedToken,
        astroAmount,
        tokenAmount,
        ammPair,
        timestamp: this.getTimestamp(event),
        txHash: event.id,
        blockNumber: event.ledger?.toString(),
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
      logger.error('Error parsing ASTRO event data:', error);
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

export default AstroEventHandler;
