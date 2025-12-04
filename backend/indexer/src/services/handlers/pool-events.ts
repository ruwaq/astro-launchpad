import { PrismaClient } from '@astroshibapop/shared/prisma';
import { logger } from '../../lib/logger.js';

/**
 * Event data from pool events
 */
interface PoolEventData {
  provider?: string;
  sender?: string;
  amount0?: string;
  amount1?: string;
  liquidity?: string;
  poolAddress?: string;
  token0?: string;
  token1?: string;
  tokenIn?: string;
  tokenOut?: string;
  amountIn?: string;
  amountOut?: string;
}

/**
 * Raw event from blockchain
 */
interface RawEvent {
  id: string;
  ledger_close_time: string | number;
  value: PoolEventData;
}

/**
 * Pool Event Handler
 *
 * Handles pool-related blockchain events and persists them to the database.
 * Errors are logged with context and re-thrown to allow caller handling.
 */
export class PoolEventHandler {
  constructor(private prisma: PrismaClient) {}

  /**
   * Handle liquidity added event
   * Updates pool reserves and creates liquidity event record
   */
  async handleLiquidityAdded(event: RawEvent): Promise<void> {
    const data = this.parseEventData(event);
    const { provider, amount0, amount1, liquidity, poolAddress, token0, token1 } = data;

    if (!poolAddress || !provider || !amount0 || !amount1 || !liquidity) {
      throw new Error(`Invalid liquidity added event data: ${JSON.stringify(data)}`);
    }

    logger.info({ poolAddress, liquidity }, 'Processing liquidity added event');

    try {
      // Use transaction to ensure atomicity
      await this.prisma.$transaction(async (tx) => {
        // Get current pool state
        const pool = await tx.pool.findUnique({
          where: { address: poolAddress },
        });

        if (pool) {
          // Update existing pool with calculated values
          const newReserve0 = (BigInt(pool.reserve0 || '0') + BigInt(amount0)).toString();
          const newReserve1 = (BigInt(pool.reserve1 || '0') + BigInt(amount1)).toString();
          const newTotalSupply = (BigInt(pool.totalSupply || '0') + BigInt(liquidity)).toString();

          await tx.pool.update({
            where: { address: poolAddress },
            data: {
              reserve0: newReserve0,
              reserve1: newReserve1,
              totalSupply: newTotalSupply,
            },
          });
        } else {
          // Create new pool
          await tx.pool.create({
            data: {
              address: poolAddress,
              token0Address: token0 || '',
              token1Address: token1 || '',
              reserve0: amount0,
              reserve1: amount1,
              totalSupply: liquidity,
            },
          });
        }

        // Update or create user stats
        const user = await tx.user.findUnique({
          where: { address: provider },
        });

        if (user) {
          const newLiquidity = (BigInt(user.totalLiquidityProvided || '0') + BigInt(liquidity)).toString();
          await tx.user.update({
            where: { address: provider },
            data: {
              points: { increment: 10 },
              totalLiquidityProvided: newLiquidity,
            },
          });
        } else {
          await tx.user.create({
            data: {
              address: provider,
              points: 10,
              totalLiquidityProvided: liquidity,
            },
          });
        }

        // Create liquidity event record
        await tx.liquidityEvent.create({
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
      });

      logger.info({ poolAddress, liquidity }, 'Liquidity added event processed successfully');
    } catch (error) {
      logger.error({ error, event, data }, 'Error handling liquidity added event');
      throw error; // Re-throw to allow caller to handle (retry, dead-letter, etc.)
    }
  }

  /**
   * Handle liquidity removed event
   * Updates pool reserves and creates liquidity event record
   */
  async handleLiquidityRemoved(event: RawEvent): Promise<void> {
    const data = this.parseEventData(event);
    const { provider, amount0, amount1, liquidity, poolAddress } = data;

    if (!poolAddress || !provider || !amount0 || !amount1 || !liquidity) {
      throw new Error(`Invalid liquidity removed event data: ${JSON.stringify(data)}`);
    }

    logger.info({ poolAddress, liquidity }, 'Processing liquidity removed event');

    try {
      await this.prisma.$transaction(async (tx) => {
        // Get current pool state
        const pool = await tx.pool.findUnique({
          where: { address: poolAddress },
        });

        if (!pool) {
          throw new Error(`Pool not found: ${poolAddress}`);
        }

        // Calculate new values (ensure non-negative)
        const newReserve0 = (BigInt(pool.reserve0 || '0') - BigInt(amount0)).toString();
        const newReserve1 = (BigInt(pool.reserve1 || '0') - BigInt(amount1)).toString();
        const newTotalSupply = (BigInt(pool.totalSupply || '0') - BigInt(liquidity)).toString();

        await tx.pool.update({
          where: { address: poolAddress },
          data: {
            reserve0: newReserve0,
            reserve1: newReserve1,
            totalSupply: newTotalSupply,
          },
        });

        // Create liquidity event record
        await tx.liquidityEvent.create({
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
      });

      logger.info({ poolAddress, liquidity }, 'Liquidity removed event processed successfully');
    } catch (error) {
      logger.error({ error, event, data }, 'Error handling liquidity removed event');
      throw error;
    }
  }

  /**
   * Handle swap event
   * Updates pool volume and creates swap record
   */
  async handleSwap(event: RawEvent): Promise<void> {
    const data = this.parseEventData(event);
    const { sender, tokenIn, tokenOut, amountIn, amountOut, poolAddress } = data;

    if (!poolAddress || !sender || !tokenIn || !tokenOut || !amountIn || !amountOut) {
      throw new Error(`Invalid swap event data: ${JSON.stringify(data)}`);
    }

    logger.info({ poolAddress, amountIn, tokenIn }, 'Processing swap event');

    try {
      await this.prisma.$transaction(async (tx) => {
        // Get current pool state
        const pool = await tx.pool.findUnique({
          where: { address: poolAddress },
        });

        if (!pool) {
          throw new Error(`Pool not found: ${poolAddress}`);
        }

        // Update pool volume
        const newVolume24h = (BigInt(pool.volume24h || '0') + BigInt(amountIn)).toString();
        await tx.pool.update({
          where: { address: poolAddress },
          data: {
            volume24h: newVolume24h,
          },
        });

        // Update or create user stats
        const user = await tx.user.findUnique({
          where: { address: sender },
        });

        const pointsToAdd = Math.floor(Number(amountIn) / 10_000_000);

        if (user) {
          const newVolume = (BigInt(user.totalVolumeTraded || '0') + BigInt(amountIn)).toString();
          await tx.user.update({
            where: { address: sender },
            data: {
              points: { increment: pointsToAdd },
              totalVolumeTraded: newVolume,
            },
          });
        } else {
          await tx.user.create({
            data: {
              address: sender,
              points: pointsToAdd,
              totalVolumeTraded: amountIn,
            },
          });
        }

        // Create swap record
        await tx.swap.create({
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
      });

      logger.info({ poolAddress, amountIn }, 'Swap event processed successfully');
    } catch (error) {
      logger.error({ error, event, data }, 'Error handling swap event');
      throw error;
    }
  }

  /**
   * Parse event data from raw event
   */
  private parseEventData(event: RawEvent): PoolEventData {
    if (!event?.value) {
      logger.warn({ event }, 'Event has no value field');
      return {};
    }
    return event.value;
  }
}
