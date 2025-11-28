/**
 * Graduation Event Handler
 *
 * Handles graduation-related events from the SAC Factory contract:
 * - TokenGraduated: Basic graduation event
 * - GraduationDetailed: Enhanced graduation with AMM details
 * - GraduationFailed: When graduation fails
 * - TokenRecovered: When token is recovered from failed graduation
 * - GraduationRetried: When graduation is retried
 * - BridgeGraduation: When graduation happens via DEX bridge
 * - GraduationWithAstro: Graduation with ASTRO token integration
 */

import { PrismaClient } from '@astroshibapop/shared/prisma';
import { scValToNative } from '@stellar/stellar-sdk';
import { logger } from '../../lib/logger.js';

// Graduation event types from contract
const GRADUATION_EVENT_TOPICS = {
  TOKEN_GRADUATED: 'tokengraduated',
  GRADUATION_DETAILED: 'graduationdetailed',
  GRADUATION_FAILED: 'graduationfailed',
  TOKEN_RECOVERED: 'tokenrecovered',
  GRADUATION_RETRIED: 'graduationretried',
  BRIDGE_GRADUATION: 'bridgegraduation',
  GRADUATION_WITH_ASTRO: 'graduationwithastro',
  LIQUIDITY_LOCKED: 'liquiditylocked',
};

export class GraduationEventHandler {
  constructor(private prisma: PrismaClient) {}

  /**
   * Main entry point for graduation event handling
   */
  async handleEvent(event: any): Promise<void> {
    try {
      const eventType = this.getEventType(event);

      logger.info(`Processing graduation event: ${eventType}`, {
        ledger: event.ledger,
        txHash: event.id,
      });

      switch (eventType) {
        case GRADUATION_EVENT_TOPICS.TOKEN_GRADUATED:
          await this.handleTokenGraduated(event);
          break;
        case GRADUATION_EVENT_TOPICS.GRADUATION_DETAILED:
          await this.handleGraduationDetailed(event);
          break;
        case GRADUATION_EVENT_TOPICS.GRADUATION_FAILED:
          await this.handleGraduationFailed(event);
          break;
        case GRADUATION_EVENT_TOPICS.TOKEN_RECOVERED:
          await this.handleTokenRecovered(event);
          break;
        case GRADUATION_EVENT_TOPICS.GRADUATION_RETRIED:
          await this.handleGraduationRetried(event);
          break;
        case GRADUATION_EVENT_TOPICS.BRIDGE_GRADUATION:
          await this.handleBridgeGraduation(event);
          break;
        case GRADUATION_EVENT_TOPICS.GRADUATION_WITH_ASTRO:
          await this.handleGraduationWithAstro(event);
          break;
        case GRADUATION_EVENT_TOPICS.LIQUIDITY_LOCKED:
          await this.handleLiquidityLocked(event);
          break;
        default:
          logger.warn(`Unknown graduation event type: ${eventType}`);
      }
    } catch (error) {
      logger.error('Error handling graduation event', {
        error,
        eventId: event.id,
      });
      throw error;
    }
  }

  /**
   * Handle basic TokenGraduated event
   */
  private async handleTokenGraduated(event: any): Promise<void> {
    const data = this.parseEventData(event);
    const tokenAddress = this.scValToString(data.token);
    const xlmRaised = this.scValToString(data.xlm_raised);

    logger.info(`Token graduated: ${tokenAddress} with ${xlmRaised} XLM raised`);

    // Create graduation event record
    await this.prisma.graduationEvent.create({
      data: {
        type: 'GRADUATED',
        tokenAddress,
        xlmRaised,
        timestamp: this.getTimestamp(event),
        txHash: event.id,
        blockNumber: event.ledger?.toString(),
      },
    });

    // Update token status
    await this.prisma.token.updateMany({
      where: { address: tokenAddress },
      data: {
        graduated: true,
        xlmRaised,
      },
    });
  }

  /**
   * Handle GraduationDetailed event with AMM details
   */
  private async handleGraduationDetailed(event: any): Promise<void> {
    const data = this.parseEventData(event);
    const tokenAddress = this.scValToString(data.token);

    logger.info(`Graduation detailed for ${tokenAddress}`);

    await this.prisma.graduationEvent.create({
      data: {
        type: 'GRADUATION_DETAILED',
        tokenAddress,
        xlmRaised: this.scValToString(data.xlm_raised),
        tokensGraduated: this.scValToString(data.tokens_graduated),
        ammPairAddress: this.scValToString(data.amm_pair_address),
        lpTokensBurned: this.scValToString(data.lp_tokens_burned),
        timestamp: this.getTimestamp(event),
        txHash: event.id,
        blockNumber: event.ledger?.toString(),
      },
    });

    // Update token
    await this.prisma.token.updateMany({
      where: { address: tokenAddress },
      data: {
        graduated: true,
        xlmRaised: this.scValToString(data.xlm_raised),
      },
    });
  }

  /**
   * Handle GraduationFailed event - CRITICAL
   */
  private async handleGraduationFailed(event: any): Promise<void> {
    const data = this.parseEventData(event);
    const tokenAddress = this.scValToString(data.token);
    const reason = this.scValToString(data.reason);

    logger.error(`Graduation FAILED for ${tokenAddress}: ${reason}`);

    await this.prisma.graduationEvent.create({
      data: {
        type: 'GRADUATION_FAILED',
        tokenAddress,
        xlmRaised: this.scValToString(data.xlm_raised),
        reason,
        timestamp: this.getTimestamp(event),
        txHash: event.id,
        blockNumber: event.ledger?.toString(),
      },
    });

    // Token remains not graduated - no update needed
  }

  /**
   * Handle TokenRecovered event
   */
  private async handleTokenRecovered(event: any): Promise<void> {
    const data = this.parseEventData(event);
    const tokenAddress = this.scValToString(data.token);

    logger.info(`Token recovered: ${tokenAddress} by ${data.recovered_by}`);

    await this.prisma.graduationEvent.create({
      data: {
        type: 'TOKEN_RECOVERED',
        tokenAddress,
        recoveredBy: this.scValToString(data.recovered_by),
        recoveryType: this.scValToString(data.recovery_type),
        timestamp: this.getTimestamp(event),
        txHash: event.id,
        blockNumber: event.ledger?.toString(),
      },
    });

    // Reset token to bonding phase
    await this.prisma.token.updateMany({
      where: { address: tokenAddress },
      data: {
        graduated: false,
      },
    });
  }

  /**
   * Handle GraduationRetried event
   */
  private async handleGraduationRetried(event: any): Promise<void> {
    const data = this.parseEventData(event);
    const tokenAddress = this.scValToString(data.token);

    logger.info(`Graduation retried for ${tokenAddress}`);

    await this.prisma.graduationEvent.create({
      data: {
        type: 'GRADUATION_RETRIED',
        tokenAddress,
        recoveredBy: this.scValToString(data.retried_by),
        timestamp: this.getTimestamp(event),
        txHash: event.id,
        blockNumber: event.ledger?.toString(),
      },
    });
  }

  /**
   * Handle BridgeGraduation event
   */
  private async handleBridgeGraduation(event: any): Promise<void> {
    const data = this.parseEventData(event);
    const tokenAddress = this.scValToString(data.token);

    logger.info(`Bridge graduation for ${tokenAddress}`);

    await this.prisma.graduationEvent.create({
      data: {
        type: 'BRIDGE_GRADUATION',
        tokenAddress,
        ammPairAddress: this.scValToString(data.pair_address),
        xlmRaised: this.scValToString(data.xlm_raised),
        timestamp: this.getTimestamp(event),
        txHash: event.id,
        blockNumber: event.ledger?.toString(),
      },
    });

    // Update token
    await this.prisma.token.updateMany({
      where: { address: tokenAddress },
      data: {
        graduated: true,
        xlmRaised: this.scValToString(data.xlm_raised),
      },
    });
  }

  /**
   * Handle GraduationWithAstro event
   */
  private async handleGraduationWithAstro(event: any): Promise<void> {
    const data = this.parseEventData(event);
    const tokenAddress = this.scValToString(data.token);

    logger.info(`Graduation with ASTRO for ${tokenAddress}`);

    await this.prisma.graduationEvent.create({
      data: {
        type: 'GRADUATION_WITH_ASTRO',
        tokenAddress,
        xlmRaised: this.scValToString(data.xlm_raised),
        timestamp: this.getTimestamp(event),
        txHash: event.id,
        blockNumber: event.ledger?.toString(),
      },
    });

    // Also create ASTRO event for detailed tracking
    await this.prisma.astroEvent.create({
      data: {
        type: 'ASTRO_BUYBACK_EXECUTED',
        graduatedToken: tokenAddress,
        xlmUsed: this.scValToString(data.xlm_buyback),
        astroBurned: this.scValToString(data.astro_burned),
        xlmMainPool: this.scValToString(data.xlm_main_pool),
        xlmAstroLiquidity: this.scValToString(data.xlm_astro_liquidity),
        xlmBuyback: this.scValToString(data.xlm_buyback),
        timestamp: this.getTimestamp(event),
        txHash: event.id,
        blockNumber: event.ledger?.toString(),
      },
    });

    // Update token
    await this.prisma.token.updateMany({
      where: { address: tokenAddress },
      data: {
        graduated: true,
        xlmRaised: this.scValToString(data.xlm_raised),
      },
    });
  }

  /**
   * Handle LiquidityLocked event
   */
  private async handleLiquidityLocked(event: any): Promise<void> {
    const data = this.parseEventData(event);

    logger.info(`Liquidity locked: ${data.lp_tokens} LP tokens in ${data.amm_pair}`);

    // This is more of a pool event, but often happens during graduation
    // We record it in graduation events for traceability
    await this.prisma.graduationEvent.create({
      data: {
        type: 'GRADUATED', // Associated with graduation
        tokenAddress: 'unknown', // Not directly provided in this event
        ammPairAddress: this.scValToString(data.amm_pair),
        lpTokensBurned: this.scValToString(data.lp_tokens),
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
      logger.error('Error parsing graduation event data:', error);
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

export default GraduationEventHandler;
