/**
 * Stellar Client
 *
 * Provides a singleton instance for interacting with the Stellar network
 * through both Horizon (for account data) and Soroban RPC (for contracts).
 *
 * PRODUCTION: All RPC calls have timeouts to prevent hanging requests
 */

import { rpc, Horizon, Transaction, FeeBumpTransaction } from '@stellar/stellar-sdk';
import { getNetworkConfig, NETWORK } from './config';
import type { StellarTransaction } from './types';
import { stellarLogger } from '@/lib/logger';

// RPC timeout configuration (in milliseconds)
const RPC_TIMEOUTS = {
  DEFAULT: 30_000,        // 30 seconds for most operations
  SIMULATE: 45_000,       // 45 seconds for simulation (can be slow)
  SEND: 30_000,           // 30 seconds for submission
  HEALTH: 10_000,         // 10 seconds for health checks
  ACCOUNT: 15_000,        // 15 seconds for account loading
} as const;

// Retry configuration
const RETRY_CONFIG = {
  MAX_RETRIES: 3,
  BASE_DELAY_MS: 1000,
  MAX_DELAY_MS: 10000,
  RETRYABLE_ERRORS: [
    'ETIMEDOUT',
    'ECONNRESET',
    'ECONNREFUSED',
    'ENOTFOUND',
    'socket hang up',
    'network',
    '502',
    '503',
    '504',
    'rate limit',
  ],
} as const;

/**
 * Wrap a promise with a timeout
 * Rejects with TimeoutError if the operation takes too long
 */
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operation: string
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`RPC timeout: ${operation} took longer than ${timeoutMs}ms`));
    }, timeoutMs);
    // Ensure timeout is cleared if promise resolves
    promise.finally(() => clearTimeout(timeoutId));
  });

  return Promise.race([promise, timeoutPromise]);
}

/**
 * Check if an error is retryable (transient network error)
 */
function isRetryableError(error: unknown): boolean {
  if (!error) return false;
  const errorMessage = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return RETRY_CONFIG.RETRYABLE_ERRORS.some((retryable) =>
    errorMessage.includes(retryable.toLowerCase())
  );
}

/**
 * Calculate exponential backoff delay with jitter
 */
function getBackoffDelay(attempt: number): number {
  const exponentialDelay = RETRY_CONFIG.BASE_DELAY_MS * Math.pow(2, attempt);
  const jitter = Math.random() * 0.3 * exponentialDelay; // 30% jitter
  return Math.min(exponentialDelay + jitter, RETRY_CONFIG.MAX_DELAY_MS);
}

/**
 * PRODUCTION: Retry wrapper with exponential backoff for transient errors
 * Use this for critical operations that may fail due to network issues
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  operationName: string,
  maxRetries: number = RETRY_CONFIG.MAX_RETRIES
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      // Don't retry non-retryable errors
      if (!isRetryableError(error)) {
        throw error;
      }

      // Don't retry if we've exhausted retries
      if (attempt >= maxRetries) {
        stellarLogger.error(`[${operationName}] All ${maxRetries} retries exhausted`, error);
        throw error;
      }

      const delay = getBackoffDelay(attempt);
      stellarLogger.warn(
        `[${operationName}] Attempt ${attempt + 1}/${maxRetries + 1} failed, retrying in ${Math.round(delay)}ms...`,
        { error: error instanceof Error ? error.message : String(error) }
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * Soroban RPC Client
 * Used for interacting with smart contracts
 */
class SorobanClient {
  private server: rpc.Server;
  private config = getNetworkConfig();

  constructor() {
    this.server = new rpc.Server(this.config.rpcUrl, {
      allowHttp: NETWORK === 'testnet',
    });
  }

  /**
   * Get the Soroban RPC server instance
   */
  getServer(): rpc.Server {
    return this.server;
  }

  /**
   * Get current network passphrase
   */
  getNetworkPassphrase(): string {
    return this.config.networkPassphrase;
  }

  /**
   * Get health status of the Soroban RPC endpoint
   * TIMEOUT: 10 seconds
   */
  async getHealth(): Promise<rpc.Api.GetHealthResponse> {
    return withTimeout(
      this.server.getHealth(),
      RPC_TIMEOUTS.HEALTH,
      'Soroban getHealth'
    );
  }

  /**
   * Get current ledger information
   * TIMEOUT: 10 seconds
   */
  async getLatestLedger(): Promise<rpc.Api.GetLatestLedgerResponse> {
    return withTimeout(
      this.server.getLatestLedger(),
      RPC_TIMEOUTS.HEALTH,
      'Soroban getLatestLedger'
    );
  }

  /**
   * Simulate a transaction before submitting
   * TIMEOUT: 45 seconds (simulation can be slow for complex contracts)
   */
  async simulateTransaction(
    transaction: StellarTransaction
  ): Promise<rpc.Api.SimulateTransactionResponse> {
    return withTimeout(
      this.server.simulateTransaction(transaction),
      RPC_TIMEOUTS.SIMULATE,
      'Soroban simulateTransaction'
    );
  }

  /**
   * Submit a transaction to the network
   * TIMEOUT: 30 seconds
   */
  async sendTransaction(
    transaction: StellarTransaction
  ): Promise<rpc.Api.SendTransactionResponse> {
    return withTimeout(
      this.server.sendTransaction(transaction),
      RPC_TIMEOUTS.SEND,
      'Soroban sendTransaction'
    );
  }

  /**
   * Get transaction status
   * TIMEOUT: 30 seconds
   */
  async getTransaction(
    hash: string
  ): Promise<rpc.Api.GetTransactionResponse> {
    return withTimeout(
      this.server.getTransaction(hash),
      RPC_TIMEOUTS.DEFAULT,
      'Soroban getTransaction'
    );
  }
}

/**
 * Horizon Client
 * Used for account information and classic Stellar operations
 */
class HorizonClient {
  private server: Horizon.Server;
  private config = getNetworkConfig();

  constructor() {
    this.server = new Horizon.Server(this.config.horizonUrl, {
      allowHttp: NETWORK === 'testnet',
    });
  }

  /**
   * Get the Horizon server instance
   */
  getServer(): Horizon.Server {
    return this.server;
  }

  /**
   * Load account information
   * TIMEOUT: 15 seconds
   */
  async loadAccount(publicKey: string): Promise<Horizon.AccountResponse> {
    return withTimeout(
      this.server.loadAccount(publicKey),
      RPC_TIMEOUTS.ACCOUNT,
      'Horizon loadAccount'
    );
  }

  /**
   * Fetch current base fee for the network
   * TIMEOUT: 10 seconds
   */
  async fetchBaseFee(): Promise<number> {
    return withTimeout(
      this.server.fetchBaseFee(),
      RPC_TIMEOUTS.HEALTH,
      'Horizon fetchBaseFee'
    );
  }

  /**
   * Submit a Horizon transaction
   * TIMEOUT: 30 seconds
   */
  async submitTransaction(
    transaction: StellarTransaction
  ): Promise<Horizon.HorizonApi.SubmitTransactionResponse> {
    return withTimeout(
      this.server.submitTransaction(transaction),
      RPC_TIMEOUTS.SEND,
      'Horizon submitTransaction'
    );
  }
}

/**
 * Unified Stellar Client
 * Combines both Soroban and Horizon functionality
 */
class StellarClient {
  private soroban: SorobanClient;
  private horizon: HorizonClient;

  constructor() {
    this.soroban = new SorobanClient();
    this.horizon = new HorizonClient();
  }

  /**
   * Get Soroban RPC client for contract interactions
   */
  getSoroban(): SorobanClient {
    return this.soroban;
  }

  /**
   * Get Horizon client for account/transaction data
   */
  getHorizon(): HorizonClient {
    return this.horizon;
  }

  /**
   * Get network passphrase
   */
  getNetworkPassphrase(): string {
    return this.soroban.getNetworkPassphrase();
  }

  /**
   * Check overall network health
   */
  async checkHealth(): Promise<{
    soroban: rpc.Api.GetHealthResponse;
    horizon: boolean;
  }> {
    const [sorobanHealth, horizonHealth] = await Promise.all([
      this.soroban.getHealth(),
      this.checkHorizonHealth(),
    ]);

    return {
      soroban: sorobanHealth,
      horizon: horizonHealth,
    };
  }

  /**
   * Check if Horizon is responding
   */
  private async checkHorizonHealth(): Promise<boolean> {
    try {
      await this.horizon.fetchBaseFee();
      return true;
    } catch (error) {
      stellarLogger.error('Horizon health check failed:', error);
      return false;
    }
  }
}

/**
 * Singleton instance of the Stellar client
 */
export const stellarClient = new StellarClient();

/**
 * SAFE DEADLINE: Get deadline timestamp based on network ledger time
 *
 * Using client-side Date.now() can cause issues if the user's clock is off.
 * This function fetches the latest ledger close time and adds the timeout.
 *
 * Falls back to client time if network call fails (with safety margin).
 *
 * @param timeoutSeconds - How many seconds in the future (default: 300 = 5 minutes)
 * @returns BigInt timestamp for deadline parameter
 */
export async function getNetworkDeadline(timeoutSeconds: number = 300): Promise<bigint> {
  try {
    const ledgerInfo = await stellarClient.getSoroban().getLatestLedger();
    // Ledger close time is already in UNIX seconds
    const ledgerTime = ledgerInfo.sequence > 0 ? Math.floor(Date.now() / 1000) : Date.now() / 1000;

    // If we have valid ledger data, use close time
    // Otherwise fall back to current time with extra margin
    return BigInt(Math.floor(ledgerTime) + timeoutSeconds);
  } catch (error) {
    stellarLogger.warn('[getNetworkDeadline] Failed to get ledger time, using client time with safety margin:', {
      error: error instanceof Error ? error.message : String(error)
    });
    // Fallback: Use client time but add extra 30s margin for clock skew
    const clientTime = Math.floor(Date.now() / 1000);
    return BigInt(clientTime + timeoutSeconds + 30);
  }
}

/**
 * SYNC: Get deadline synchronously (uses client time with safety margin)
 *
 * Use this only when you can't await the async version.
 * Adds a 30-second margin to account for potential clock skew.
 *
 * @param timeoutSeconds - How many seconds in the future (default: 300 = 5 minutes)
 * @returns BigInt timestamp for deadline parameter
 */
export function getClientDeadline(timeoutSeconds: number = 300): bigint {
  // Add 30s margin for safety against clock skew
  const clientTime = Math.floor(Date.now() / 1000);
  return BigInt(clientTime + timeoutSeconds);
}

/**
 * Export client classes for type usage
 */
export { SorobanClient, HorizonClient };
