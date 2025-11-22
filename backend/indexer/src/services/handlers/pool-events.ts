import { PrismaClient } from '@prisma/client';
import * as StellarSdk from '@stellar/stellar-sdk';
import { logger } from '../../lib/logger.js';

export class PoolEventHandler {
  constructor(private prisma: PrismaClient) {}

  async handleLiquidityAdded(event: StellarSdk.Horizon.ServerApi.EventRecord) {
    try {
      const data = this.parseEventData(event);
      const { provider, amount0, amount1, liquidity, poolAddress } = data;

      logger.info(`Liquidity added: ${liquidity} LP tokens`);

      // Update or create pool
      await this.prisma.pool.upsert({
        where: { address: poolAddress },
        update: {
          reserve0: { increment: BigInt(amount0) },
          reserve1: { increment: BigInt(amount1) },
          totalSupply: { increment: BigInt(liquidity) },
        },
        create: {
          address: poolAddress,
          token0Address: data.token0,
          token1Address: data.token1,
          reserve0: amount0,
          reserve1: amount1,
          totalSupply: liquidity,
        },
      });

      // Update user stats
      await this.prisma.user.upsert({
        where: { address: provider },
        update: {
          points: { increment: 10 }, // 10 points per day for LP
          totalLiquidityProvided: { increment: BigInt(liquidity) },
        },
        create: {
          address: provider,
          points: 10,
          totalLiquidityProvided: liquidity,
        },
      });

      // Create liquidity event
      await this.prisma.liquidityEvent.create({
        data: {
          hash: event.id,
          poolId: poolAddress,
          provider,
          amount0,
          amount1,
          liquidity,
          type: 'ADD',
          timestamp: new Date(event.ledger_close_time),
        },
      });
    } catch (error) {
      logger.error('Error handling liquidity added event:', error);
    }
  }

  async handleLiquidityRemoved(event: StellarSdk.Horizon.ServerApi.EventRecord) {
    try {
      const data = this.parseEventData(event);
      const { provider, amount0, amount1, liquidity, poolAddress } = data;

      logger.info(`Liquidity removed: ${liquidity} LP tokens`);

      // Update pool
      await this.prisma.pool.update({
        where: { address: poolAddress },
        data: {
          reserve0: { decrement: BigInt(amount0) },
          reserve1: { decrement: BigInt(amount1) },
          totalSupply: { decrement: BigInt(liquidity) },
        },
      });

      // Create liquidity event
      await this.prisma.liquidityEvent.create({
        data: {
          hash: event.id,
          poolId: poolAddress,
          provider,
          amount0,
          amount1,
          liquidity,
          type: 'REMOVE',
          timestamp: new Date(event.ledger_close_time),
        },
      });
    } catch (error) {
      logger.error('Error handling liquidity removed event:', error);
    }
  }

  async handleSwap(event: StellarSdk.Horizon.ServerApi.EventRecord) {
    try {
      const data = this.parseEventData(event);
      const { sender, tokenIn, tokenOut, amountIn, amountOut, poolAddress } = data;

      logger.info(`Swap: ${amountIn} ${tokenIn} for ${amountOut} ${tokenOut}`);

      // Update pool volume
      await this.prisma.pool.update({
        where: { address: poolAddress },
        data: {
          volume24h: { increment: BigInt(amountIn) },
        },
      });

      // Update user stats
      await this.prisma.user.upsert({
        where: { address: sender },
        update: {
          points: { increment: Math.floor(Number(amountIn) / 10_000_000) },
          totalVolumeTraded: { increment: BigInt(amountIn) },
        },
        create: {
          address: sender,
          points: Math.floor(Number(amountIn) / 10_000_000),
          totalVolumeTraded: amountIn,
        },
      });

      // Create swap record
      await this.prisma.swap.create({
        data: {
          hash: event.id,
          poolId: poolAddress,
          sender,
          tokenIn,
          tokenOut,
          amountIn,
          amountOut,
          timestamp: new Date(event.ledger_close_time),
        },
      });
    } catch (error) {
      logger.error('Error handling swap event:', error);
    }
  }

  private parseEventData(event: StellarSdk.Horizon.ServerApi.EventRecord): any {
    try {
      const value = event.value;
      // For MVP, assume value is already decoded
      return value;
    } catch (error) {
      logger.error('Error parsing event data:', error);
      return {};
    }
  }
}
