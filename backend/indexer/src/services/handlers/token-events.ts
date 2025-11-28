import { PrismaClient } from '@astroshibapop/shared/prisma';
import { scValToNative } from '@stellar/stellar-sdk';
import { logger } from '../../lib/logger.js';
import { createContractReader } from '../contract-reader.js';

export class TokenEventHandler {
  private contractReader;

  constructor(private prisma: PrismaClient) {
    this.contractReader = createContractReader();
  }

  async handleTokenCreated(event: any) {
    try {
      const data = this.parseEventData(event);

      // Contract emits: { creator, token, name, symbol }
      // Note: field is 'token' not 'tokenAddress' from contract events
      const creator = data.creator?.toString() || '';
      const tokenAddress = data.token?.toString() || data.tokenAddress?.toString() || '';
      const name = data.name?.toString() || '';
      const symbol = data.symbol?.toString() || '';

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
            hash: event.id || `tx_${Date.now()}`,
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
    } catch (error: any) {
      // Handle unique constraint violation (token already exists)
      if (error.code === 'P2002') {
        logger.info('Token already exists in database (race condition), skipping');
        return;
      }
      logger.error('Error handling token created event:', error);
    }
  }

  async handleTokenBuy(event: any) {
    try {
      const data = this.parseEventData(event);

      // Contract emits: { buyer, token, xlm_amount, tokens_received }
      // Handle both snake_case (from Soroban) and camelCase
      const buyer = data.buyer?.toString() || '';
      const tokenAddress = data.token?.toString() || '';
      const xlmAmount = data.xlm_amount?.toString() || data.xlmAmount?.toString() || '0';
      const tokensReceived = data.tokens_received?.toString() || data.tokensReceived?.toString() || '0';

      if (!tokenAddress || !buyer) {
        logger.warn('TokenBuy event missing required fields:', data);
        return;
      }

      // CRITICAL: Idempotency check - prevent processing same event twice
      // Use event.id as unique identifier for this event
      const eventHash = event.id || `tx_buy_${tokenAddress}_${buyer}_${xlmAmount}_${Date.now()}`;
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
    } catch (error: any) {
      // Handle unique constraint violation (transaction already exists)
      if (error.code === 'P2002') {
        logger.debug('Buy transaction already exists (race condition), skipping');
        return;
      }
      logger.error('Error handling token buy event:', error);
    }
  }

  async handleTokenSell(event: any) {
    try {
      const data = this.parseEventData(event);

      // Contract emits: { seller, token, tokens_sold, xlm_received }
      // Handle both snake_case (from Soroban) and camelCase
      const seller = data.seller?.toString() || '';
      const tokenAddress = data.token?.toString() || '';
      const tokensSold = data.tokens_sold?.toString() || data.tokensSold?.toString() || '0';
      const xlmReceived = data.xlm_received?.toString() || data.xlmReceived?.toString() || '0';

      if (!tokenAddress || !seller) {
        logger.warn('TokenSell event missing required fields:', data);
        return;
      }

      // CRITICAL: Idempotency check - prevent processing same event twice
      const eventHash = event.id || `tx_sell_${tokenAddress}_${seller}_${tokensSold}_${Date.now()}`;
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
    } catch (error: any) {
      // Handle unique constraint violation (transaction already exists)
      if (error.code === 'P2002') {
        logger.debug('Sell transaction already exists (race condition), skipping');
        return;
      }
      logger.error('Error handling token sell event:', error);
    }
  }

  async handleTokenGraduated(event: any) {
    try {
      const data = this.parseEventData(event);

      // Contract emits: { token, xlm_raised }
      const tokenAddress = data.token?.toString() || '';
      const xlmRaised = data.xlm_raised?.toString() || data.xlmRaised?.toString() || '0';

      if (!tokenAddress) {
        logger.warn('TokenGraduated event missing token address:', data);
        return;
      }

      logger.info(`🎓 Token graduated: ${tokenAddress} with ${xlmRaised} stroops raised`);

      await this.prisma.token.update({
        where: { address: tokenAddress },
        data: {
          graduated: true,
          xlmRaised,
        },
      });
    } catch (error) {
      logger.error('Error handling token graduated event:', error);
    }
  }

  /**
   * Parse Soroban event data using scValToNative
   * Handles both raw XDR values and already-decoded objects
   */
  private parseEventData(event: any): any {
    try {
      // Get the event value
      const value = event.value;

      if (!value) {
        logger.warn('Event has no value:', event);
        return {};
      }

      // If value is already a plain object, return it
      if (typeof value === 'object' && !value._switch && !value._arm) {
        logger.debug('Event value already decoded:', value);
        return value;
      }

      // Decode XDR using Stellar SDK
      // scValToNative handles the XDR->JS conversion
      const decoded = scValToNative(value);
      logger.debug('Decoded event data:', decoded);

      return decoded;
    } catch (error) {
      logger.error('Error parsing event data:', error);
      logger.debug('Raw event:', JSON.stringify(event, null, 2));

      // Attempt fallback parsing
      try {
        // Sometimes the value is in a different format
        if (event.value?.value) {
          return scValToNative(event.value.value);
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
  getEventType(event: any): string {
    try {
      if (event.topic && Array.isArray(event.topic) && event.topic.length > 0) {
        const firstTopic = event.topic[0];

        // Topic might be XDR encoded or a string/symbol
        if (typeof firstTopic === 'string') {
          return firstTopic;
        }

        // Try to decode if it's an XDR value
        try {
          const decoded = scValToNative(firstTopic);
          if (typeof decoded === 'string') {
            return decoded;
          }
          return decoded?.toString() || 'unknown';
        } catch {
          return firstTopic?.toString() || 'unknown';
        }
      }
      return 'unknown';
    } catch (error) {
      logger.error('Error extracting event type:', error);
      return 'unknown';
    }
  }
}
