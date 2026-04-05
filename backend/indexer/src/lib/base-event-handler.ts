/**
 * Base Event Handler
 *
 * Provides common functionality for all Soroban event handlers:
 * - Event data parsing
 * - Type conversions (scVal to native)
 * - Timestamp extraction
 * - Idempotency checking
 * - Error handling patterns
 */

import { PrismaClient } from '@astroshibapop/shared/prisma';
import { scValToNative } from '@stellar/stellar-sdk';
import { logger } from './logger.js';
import type { SorobanEvent } from '../types/events.js';

export interface EventHandlerContext {
  prisma: PrismaClient;
  logger: typeof logger;
}

/**
 * Abstract base class for Soroban event handlers.
 * Provides common utilities to reduce code duplication across handlers.
 */
export abstract class BaseEventHandler {
  protected prisma: PrismaClient;
  protected logger: typeof logger;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.logger = logger;
  }

  /**
   * Parse event data from Soroban event.
   * Handles both direct data and nested value structures.
   */
  protected parseEventData(event: SorobanEvent): Record<string, unknown> {
    try {
      if (!event.value) return {};

      // Handle direct scVal
      if (typeof event.value === 'object' && 'value' in event.value) {
        return scValToNative(event.value as any) as Record<string, unknown>;
      }

      // Try to parse as-is
      return scValToNative(event.value as any) as Record<string, unknown>;
    } catch (error) {
      this.logger.warn({ error, event }, 'Failed to parse event data');
      return {};
    }
  }

  /**
   * Convert scVal to string safely.
   * Handles various input types (Address, string, Buffer, etc.)
   */
  protected scValToString(val: unknown): string {
    if (val === null || val === undefined) return '';

    // Handle Stellar Address objects
    if (typeof val === 'object' && val !== null && 'toString' in val) {
      return (val as { toString: () => string }).toString();
    }

    // Handle Buffer/Uint8Array
    if (Buffer.isBuffer(val) || val instanceof Uint8Array) {
      return Buffer.from(val).toString('hex');
    }

    return String(val);
  }

  /**
   * Convert scVal to bigint amount safely.
   * Returns '0' for invalid/missing values.
   */
  protected scValToAmount(val: unknown): string {
    if (val === null || val === undefined) return '0';

    if (typeof val === 'bigint') {
      return val.toString();
    }

    if (typeof val === 'number') {
      return Math.floor(val).toString();
    }

    if (typeof val === 'string') {
      const parsed = BigInt(val);
      return parsed.toString();
    }

    return '0';
  }

  /**
   * Extract timestamp from event, fallback to current time.
   */
  protected getTimestamp(event: SorobanEvent): Date {
    if (event.ledger_close_time) {
      return new Date(event.ledger_close_time);
    }
    return new Date();
  }

  /**
   * Generate a unique event hash for idempotency checking.
   */
  protected generateEventHash(event: SorobanEvent, ...additionalKeys: string[]): string {
    const baseKey = event.id || `event_${event.ledger}`;
    if (additionalKeys.length === 0) {
      return baseKey;
    }
    return `${baseKey}_${additionalKeys.join('_')}`;
  }

  /**
   * Check if an event has already been processed.
   * Uses transaction hash for idempotency.
   */
  protected async isEventProcessed(eventHash: string): Promise<boolean> {
    const existing = await this.prisma.transaction.findFirst({
      where: { hash: eventHash },
      select: { id: true },
    });
    return existing !== null;
  }

  /**
   * Wrap handler execution with common error handling.
   * Handles P2002 (unique constraint) errors gracefully.
   */
  protected async withErrorHandling<T>(
    operationName: string,
    operation: () => Promise<T>
  ): Promise<T | null> {
    try {
      return await operation();
    } catch (error: any) {
      // Handle unique constraint violation (already exists)
      if (error.code === 'P2002') {
        this.logger.debug(`${operationName}: Record already exists (idempotency), skipping`);
        return null;
      }

      this.logger.error({ error, operation: operationName }, `Error in ${operationName}`);
      throw error;
    }
  }

  /**
   * Normalize event data field names.
   * Handles both snake_case (Soroban) and camelCase.
   */
  protected normalizeField<T>(
    data: Record<string, unknown>,
    snakeCase: string,
    camelCase: string
  ): T | undefined {
    return (data[snakeCase] ?? data[camelCase]) as T | undefined;
  }
}
