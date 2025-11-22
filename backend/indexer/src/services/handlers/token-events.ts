import { PrismaClient } from '@prisma/client';
import * as StellarSdk from '@stellar/stellar-sdk';
import { logger } from '../../lib/logger.js';

export class TokenEventHandler {
  constructor(private prisma: PrismaClient) {}

  async handleTokenCreated(event: StellarSdk.StellarSdk.Horizon.ServerApi.EventRecord) {
    try {
      const data = this.parseEventData(event);
      const { creator, tokenAddress, name, symbol } = data;

      logger.info(`Token created: ${name} (${symbol}) by ${creator}`);

      // Create token in database
      await this.prisma.token.create({
        data: {
          address: tokenAddress,
          creator,
          name,
          symbol,
          decimals: 7, // Stellar default
          totalSupply: '0', // Will be updated on first trade
          metadataUri: '', // Will fetch from contract
          createdAt: new Date(event.ledger_close_time),
        },
      });

      // Create user if doesn't exist
      await this.prisma.user.upsert({
        where: { address: creator },
        update: {
          tokensCreatedCount: { increment: 1 },
          points: { increment: 100 }, // 100 points for creating token
        },
        create: {
          address: creator,
          tokensCreatedCount: 1,
          points: 100,
        },
      });

      // Create transaction record
      await this.prisma.transaction.create({
        data: {
          hash: event.id,
          type: 'TOKEN_CREATED',
          from: creator,
          tokenAddress,
          status: 'SUCCESS',
          timestamp: new Date(event.ledger_close_time),
        },
      });
    } catch (error) {
      logger.error('Error handling token created event:', error);
    }
  }

  async handleTokenBuy(event: StellarSdk.Horizon.ServerApi.EventRecord) {
    try {
      const data = this.parseEventData(event);
      const { buyer, token, xlmAmount, tokensReceived } = data;

      logger.info(`Token buy: ${tokensReceived} tokens for ${xlmAmount} XLM`);

      // Update token stats
      await this.prisma.token.update({
        where: { address: token },
        data: {
          volume24h: { increment: BigInt(xlmAmount) },
          xlmRaised: { increment: BigInt(xlmAmount) },
        },
      });

      // Update user stats
      await this.prisma.user.upsert({
        where: { address: buyer },
        update: {
          points: { increment: Math.floor(Number(xlmAmount) / 10_000_000) }, // 1 pt per 1 XLM
          totalVolumeTraded: { increment: BigInt(xlmAmount) },
        },
        create: {
          address: buyer,
          points: Math.floor(Number(xlmAmount) / 10_000_000),
          totalVolumeTraded: xlmAmount,
        },
      });

      // Create transaction
      await this.prisma.transaction.create({
        data: {
          hash: event.id,
          type: 'TOKEN_BOUGHT',
          from: buyer,
          tokenAddress: token,
          amount: tokensReceived,
          status: 'SUCCESS',
          timestamp: new Date(event.ledger_close_time),
        },
      });
    } catch (error) {
      logger.error('Error handling token buy event:', error);
    }
  }

  async handleTokenSell(event: StellarSdk.Horizon.ServerApi.EventRecord) {
    try {
      const data = this.parseEventData(event);
      const { seller, token, tokensSold, xlmReceived } = data;

      logger.info(`Token sell: ${tokensSold} tokens for ${xlmReceived} XLM`);

      // Update token stats
      await this.prisma.token.update({
        where: { address: token },
        data: {
          volume24h: { increment: BigInt(xlmReceived) },
        },
      });

      // Update user stats
      await this.prisma.user.upsert({
        where: { address: seller },
        update: {
          points: { increment: Math.floor(Number(xlmReceived) / 10_000_000) },
          totalVolumeTraded: { increment: BigInt(xlmReceived) },
        },
        create: {
          address: seller,
          points: Math.floor(Number(xlmReceived) / 10_000_000),
          totalVolumeTraded: xlmReceived,
        },
      });

      // Create transaction
      await this.prisma.transaction.create({
        data: {
          hash: event.id,
          type: 'TOKEN_SOLD',
          from: seller,
          tokenAddress: token,
          amount: tokensSold,
          status: 'SUCCESS',
          timestamp: new Date(event.ledger_close_time),
        },
      });
    } catch (error) {
      logger.error('Error handling token sell event:', error);
    }
  }

  async handleTokenGraduated(event: StellarSdk.Horizon.ServerApi.EventRecord) {
    try {
      const data = this.parseEventData(event);
      const { token, xlmRaised } = data;

      logger.info(`Token graduated: ${token} with ${xlmRaised} XLM raised`);

      await this.prisma.token.update({
        where: { address: token },
        data: {
          graduated: true,
          xlmRaised,
        },
      });
    } catch (error) {
      logger.error('Error handling token graduated event:', error);
    }
  }

  private parseEventData(event: StellarSdk.Horizon.ServerApi.EventRecord): any {
    // Parse Soroban event data
    // This is a simplified version - in production, properly decode XDR
    try {
      const value = event.value;

      // For MVP, assume value is already decoded
      // In production, use Stellar SDK to properly decode XDR
      return value;
    } catch (error) {
      logger.error('Error parsing event data:', error);
      return {};
    }
  }
}
