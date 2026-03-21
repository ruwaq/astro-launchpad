import { PrismaClient } from '@astroshibapop/shared/prisma';
import { scValToNative } from '@stellar/stellar-sdk';
import { logger } from '../../lib/logger.js';
import { createContractReader } from '../contract-reader.js';
import { wsBroadcaster } from '../websocket-server.js';
import type {
  SorobanEvent,
  TokenCreatedEventData,
  TokenBuyEventData,
  TokenSellEventData,
} from '../../types/events.js';
import { toEventString, toEventAmount } from '../../types/events.js';

export class TokenEventHandler {
  private contractReader;

  constructor(private prisma: PrismaClient) {
    this.contractReader = createContractReader();
  }

  async handleTokenCreated(event: SorobanEvent): Promise<void> {
    try {
      const data = this.parseEventData(event) as Partial<TokenCreatedEventData>;

      // Contract emits: { creator, token, name, symbol }
      // Note: field is 'token' not 'tokenAddress' from contract events
      const creator = toEventString(data.creator);
      const tokenAddress = toEventString(data.token || data.tokenAddress);
      const name = toEventString(data.name);
      const symbol = toEventString(data.symbol);

      if (!tokenAddress) {
        logger.error('TokenCreated event missing token address:', data);
        return;
      }

      logger.info(`🚀 Token created event: ${name} (${symbol}) at ${tokenAddress} by ${creator}`);

      // Check if token already exists
      const existingToken = await this.prisma.token.findUnique({
        where: { address: tokenAddress },
      });

      if (existingToken) {
        logger.info(`Token ${tokenAddress} already exists in database, skipping`);
        return;
      }

      // Fetch additional token info from contract for complete data
      let tokenInfo = null;
      try {
        tokenInfo = await this.contractReader.getTokenInfo(tokenAddress);
      } catch (e) {
        logger.warn(`Could not fetch token info from contract: ${e}`);
      }

      // Use transaction to ensure atomicity - all or nothing
      await this.prisma.$transaction(async (tx) => {
        // Create token in database with full details
        await tx.token.create({
          data: {
            address: tokenAddress,
            creator,
            name,
            symbol,
            decimals: 7, // Stellar SAC default
            totalSupply: tokenInfo?.bonding_curve?.token_reserve || '1000000000000000',
            metadataUri: tokenInfo?.image_url || '',
            imageUrl: tokenInfo?.image_url || null,
            description: tokenInfo?.description || `${name} token on Stellar`,
            circulatingSupply: tokenInfo?.bonding_curve?.token_reserve || '0',
            xlmReserve: tokenInfo?.bonding_curve?.xlm_reserve || '0',
            xlmRaised: tokenInfo?.xlm_raised || '0',
            marketCap: tokenInfo?.market_cap || '0',
            graduated: tokenInfo?.status === 'Graduated',
            currentPrice: '0',
            priceChange24h: 0,
            volume24h: '0',
            volume7d: '0',
            holders: tokenInfo?.holders_count || 1,
            createdAt: event.ledger_close_time
              ? new Date(event.ledger_close_time)
              : new Date(),
          },
        });

        logger.info(`✅ Token ${symbol} (${tokenAddress}) saved to database`);

        // Create user if doesn't exist
        await tx.user.upsert({
          where: { address: creator },
          update: {
            tokensCreatedCount: { increment: 1 },
            points: { increment: 100 }, // 100 points for creating token
          },
          create: {
            address: creator,
            tokensCreatedCount: 1,
            points: 100,
            level: 1,
            referrals: 0,
            totalVolumeTraded: '0',
            totalLiquidityProvided: '0',
          },
        });

        // Create transaction record
        await tx.transaction.create({
          data: {
            hash: event.id || `tx_create_${event.ledger}_${tokenAddress}_${creator}_${symbol}`,
            type: 'TOKEN_CREATED',
            from: creator,
            tokenAddress,
            status: 'SUCCESS',
            timestamp: event.ledger_close_time
              ? new Date(event.ledger_close_time)
              : new Date(),
          },
        });
      });

      logger.info(`✅ TokenCreated event fully processed for ${symbol}`);

      // Broadcast to WebSocket clients
      wsBroadcaster.broadcastTokenCreated({
        address: tokenAddress,
        name,
        symbol,
        creator,
      });
    } catch (error: any) {
      // Handle unique constraint violation (token already exists)
      if (error.code === 'P2002') {
        logger.info('Token already exists in database (race condition), skipping');
        return;
      }
      logger.error('Error handling token created event:', error);
    }
  }

  async handleTokenBuy(event: SorobanEvent): Promise<void> {
    try {
      const data = this.parseEventData(event) as Partial<TokenBuyEventData>;

      // Contract emits: { buyer, token, xlm_amount, tokens_received }
      // Handle both snake_case (from Soroban) and camelCase
      const buyer = toEventString(data.buyer);
      const tokenAddress = toEventString(data.token);
      const xlmAmount = toEventAmount(data.xlm_amount ?? data.xlmAmount);
      const tokensReceived = toEventAmount(data.tokens_received ?? data.tokensReceived);

      if (!tokenAddress || !buyer) {
        logger.warn('TokenBuy event missing required fields:', data);
        return;
      }

      // CRITICAL: Idempotency check - prevent processing same event twice
      // Use event.id as unique identifier, or deterministic fallback from blockchain data
      const eventHash = event.id || `tx_buy_${event.ledger}_${tokenAddress}_${buyer}_${xlmAmount}_${tokensReceived}`;
      const existingTx = await this.prisma.transaction.findFirst({
        where: { hash: eventHash },
      });

      if (existingTx) {
        logger.debug(`Buy event ${eventHash} already processed, skipping (idempotency)`);
        return;
      }

      logger.info(`💰 Token buy: ${tokensReceived} tokens for ${xlmAmount} stroops by ${buyer}`);

      // Use transaction to ensure atomicity
      await this.prisma.$transaction(async (tx) => {
        // Update token stats - CRITICAL: Use increment, not replace!
        try {
          const currentToken = await tx.token.findUnique({
            where: { address: tokenAddress },
            select: { volume24h: true, xlmRaised: true },
          });

          if (currentToken) {
            const currentVolume = BigInt(currentToken.volume24h || '0');
            const currentXlmRaised = BigInt(currentToken.xlmRaised || '0');
            const addedAmount = BigInt(xlmAmount);

            await tx.token.update({
              where: { address: tokenAddress },
              data: {
                volume24h: (currentVolume + addedAmount).toString(),
                xlmRaised: (currentXlmRaised + addedAmount).toString(),
              },
            });
          }
        } catch (updateErr) {
          logger.warn(`Could not update token ${tokenAddress}:`, updateErr);
          // Continue with transaction - token might not exist yet
        }

        // Update user stats
        await tx.user.upsert({
          where: { address: buyer },
          update: {
            points: { increment: Math.floor(Number(xlmAmount) / 10_000_000) }, // 1 pt per 1 XLM
          },
          create: {
            address: buyer,
            points: Math.floor(Number(xlmAmount) / 10_000_000),
            totalVolumeTraded: xlmAmount,
            level: 1,
            referrals: 0,
            totalLiquidityProvided: '0',
          },
        });

        // Create transaction record (also serves as idempotency marker)
        await tx.transaction.create({
          data: {
            hash: eventHash,
            type: 'TOKEN_BOUGHT',
            from: buyer,
            tokenAddress,
            amount: tokensReceived,
            status: 'SUCCESS',
            timestamp: event.ledger_close_time
              ? new Date(event.ledger_close_time)
              : new Date(),
          },
        });
      });

      // Broadcast to WebSocket clients
      wsBroadcaster.broadcastTradeExecuted({
        tokenAddress,
        type: 'buy',
        amount: tokensReceived,
        price: xlmAmount,
        trader: buyer,
        txHash: eventHash,
      });
    } catch (error: any) {
      // Handle unique constraint violation (transaction already exists)
      if (error.code === 'P2002') {
        logger.debug('Buy transaction already exists (race condition), skipping');
        return;
      }
      logger.error('Error handling token buy event:', error);
    }
  }

  async handleTokenSell(event: SorobanEvent): Promise<void> {
    try {
      const data = this.parseEventData(event) as Partial<TokenSellEventData>;

      // Contract emits: { seller, token, tokens_sold, xlm_received }
      // Handle both snake_case (from Soroban) and camelCase
      const seller = toEventString(data.seller);
      const tokenAddress = toEventString(data.token);
      const tokensSold = toEventAmount(data.token_amount ?? data.tokenAmount);
      const xlmReceived = toEventAmount(data.xlm_received ?? data.xlmReceived);

      if (!tokenAddress || !seller) {
        logger.warn('TokenSell event missing required fields:', data);
        return;
      }

      // CRITICAL: Idempotency check - prevent processing same event twice
      // Use event.id as unique identifier, or deterministic fallback from blockchain data
      const eventHash = event.id || `tx_sell_${event.ledger}_${tokenAddress}_${seller}_${tokensSold}_${xlmReceived}`;
      const existingTx = await this.prisma.transaction.findFirst({
        where: { hash: eventHash },
      });

      if (existingTx) {
        logger.debug(`Sell event ${eventHash} already processed, skipping (idempotency)`);
        return;
      }

      logger.info(`💸 Token sell: ${tokensSold} tokens for ${xlmReceived} stroops by ${seller}`);

      // Use transaction to ensure atomicity
      await this.prisma.$transaction(async (tx) => {
        // Update token stats - CRITICAL: Use increment, not replace!
        try {
          const currentToken = await tx.token.findUnique({
            where: { address: tokenAddress },
            select: { volume24h: true },
          });

          if (currentToken) {
            const currentVolume = BigInt(currentToken.volume24h || '0');
            const addedVolume = BigInt(xlmReceived);

            await tx.token.update({
              where: { address: tokenAddress },
              data: {
                volume24h: (currentVolume + addedVolume).toString(),
              },
            });
          }
        } catch (updateErr) {
          logger.warn(`Could not update token ${tokenAddress}:`, updateErr);
          // Continue with transaction - token might not exist yet
        }

        // Update user stats
        await tx.user.upsert({
          where: { address: seller },
          update: {
            points: { increment: Math.floor(Number(xlmReceived) / 10_000_000) },
          },
          create: {
            address: seller,
            points: Math.floor(Number(xlmReceived) / 10_000_000),
            totalVolumeTraded: xlmReceived,
            level: 1,
            referrals: 0,
            totalLiquidityProvided: '0',
          },
        });

        // Create transaction record (also serves as idempotency marker)
        await tx.transaction.create({
          data: {
            hash: eventHash,
            type: 'TOKEN_SOLD',
            from: seller,
            tokenAddress,
            amount: tokensSold,
            status: 'SUCCESS',
            timestamp: event.ledger_close_time
              ? new Date(event.ledger_close_time)
              : new Date(),
          },
        });
      });

      // Broadcast to WebSocket clients
      wsBroadcaster.broadcastTradeExecuted({
        tokenAddress,
        type: 'sell',
        amount: tokensSold,
        price: xlmReceived,
        trader: seller,
        txHash: eventHash,
      });
    } catch (error: any) {
      // Handle unique constraint violation (transaction already exists)
      if (error.code === 'P2002') {
        logger.debug('Sell transaction already exists (race condition), skipping');
        return;
      }
      logger.error('Error handling token sell event:', error);
    }
  }

  async handleTokenGraduated(event: SorobanEvent): Promise<void> {
    try {
      const data = this.parseEventData(event) as Record<string, unknown>;

      // Contract emits: { token, xlm_raised }
      const tokenAddress = toEventString(data.token);
      const xlmRaised = toEventAmount(data.xlm_raised ?? data.xlmRaised);

      if (!tokenAddress) {
        logger.warn('TokenGraduated event missing token address:', data);
        return;
      }

      logger.info(`🎓 Token graduated: ${tokenAddress} with ${xlmRaised} stroops raised`);

      const updatedToken = await this.prisma.token.update({
        where: { address: tokenAddress },
        data: {
          graduated: true,
          xlmRaised,
        },
        select: { name: true, currentPrice: true },
      });

      // Broadcast to WebSocket clients
      wsBroadcaster.broadcastTokenGraduated({
        address: tokenAddress,
        name: updatedToken.name,
        finalPrice: updatedToken.currentPrice || '0',
      });
    } catch (error) {
      logger.error('Error handling token graduated event:', error);
    }
  }

  /**
   * Parse Soroban event data using scValToNative
   * Handles both raw XDR values and already-decoded objects
   */
  private parseEventData(event: SorobanEvent): Record<string, unknown> {
    try {
      // Get the event value
      const value = event.value;

      if (!value) {
        logger.warn('Event has no value:', event);
        return {};
      }

      // Check if value looks like an XDR ScVal (has _switch or _arm which are internal XDR properties)
      const valueObj = value as Record<string, unknown>;
      const isXdrValue = typeof value === 'object' &&
        value !== null &&
        ('_switch' in valueObj || '_arm' in valueObj || 'switch' in valueObj);

      // If value is already a plain object (not XDR), return it
      if (typeof value === 'object' && value !== null && !isXdrValue) {
        logger.debug('Event value already decoded:', value);
        return value as Record<string, unknown>;
      }

      // Decode XDR using Stellar SDK
      // scValToNative handles the XDR->JS conversion
      const decoded = scValToNative(value as Parameters<typeof scValToNative>[0]);
      logger.debug('Decoded event data:', decoded);

      if (typeof decoded === 'object' && decoded !== null) {
        return decoded as Record<string, unknown>;
      }
      return { value: decoded };
    } catch (error) {
      logger.error('Error parsing event data:', error);
      logger.debug('Raw event:', JSON.stringify(event, null, 2));

      // Attempt fallback parsing
      try {
        // Sometimes the value is in a different format
        const eventValue = event.value as Record<string, unknown> | undefined;
        if (eventValue?.value) {
          const fallbackDecoded = scValToNative(eventValue.value as Parameters<typeof scValToNative>[0]);
          if (typeof fallbackDecoded === 'object' && fallbackDecoded !== null) {
            return fallbackDecoded as Record<string, unknown>;
          }
          return { value: fallbackDecoded };
        }
      } catch {
        // Ignore fallback errors
      }

      return {};
    }
  }

  /**
   * Get event type from topic
   * Soroban events have topics as an array where first element is the event name
   */
  getEventType(event: SorobanEvent): string {
    try {
      if (event.topic && Array.isArray(event.topic) && event.topic.length > 0) {
        const firstTopic = event.topic[0];

        // Topic might be XDR encoded or a string/symbol
        if (typeof firstTopic === 'string') {
          return firstTopic;
        }

        // Try to decode if it's an XDR value
        try {
          const decoded = scValToNative(firstTopic as Parameters<typeof scValToNative>[0]);
          if (typeof decoded === 'string') {
            return decoded;
          }
          return decoded?.toString() || 'unknown';
        } catch {
          return String(firstTopic) || 'unknown';
        }
      }
      return 'unknown';
    } catch (error) {
      logger.error('Error extracting event type:', error);
      return 'unknown';
    }
  }
}
