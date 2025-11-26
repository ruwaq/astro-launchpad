/**
 * Contract Reader Service
 *
 * Reads data directly from Soroban smart contracts using RPC simulation.
 * This is the single source of truth for on-chain data.
 *
 * Features:
 * - Read-only contract calls via simulation
 * - Automatic retry with exponential backoff
 * - XDR encoding/decoding utilities
 * - Type-safe contract responses
 */

import {
  SorobanRpc,
  Contract,
  Address,
  scValToNative,
  xdr,
  TransactionBuilder,
  Account,
  Networks,
} from '@stellar/stellar-sdk';
import { logger } from '../lib/logger.js';

// ============================================================================
// Types
// ============================================================================

export interface TokenInfo {
  id: number;
  creator: string;
  token_address: string;
  name: string;
  symbol: string;
  image_url: string;
  description: string;
  created_at: number;
  status: 'Bonding' | 'Graduated';
  bonding_curve: {
    xlm_reserve: string;
    token_reserve: string;
    k: string;
  };
  xlm_raised: string;
  market_cap: string;
  holders_count: number;
}

export interface ContractReaderConfig {
  rpcUrl: string;
  networkPassphrase: string;
  contractId: string;
  maxRetries?: number;
  retryDelayMs?: number;
}

// ============================================================================
// Contract Reader Class
// ============================================================================

export class ContractReader {
  private server: SorobanRpc.Server;
  private contract: Contract;
  private networkPassphrase: string;
  private maxRetries: number;
  private retryDelayMs: number;

  constructor(config: ContractReaderConfig) {
    this.server = new SorobanRpc.Server(config.rpcUrl);
    this.contract = new Contract(config.contractId);
    this.networkPassphrase = config.networkPassphrase;
    this.maxRetries = config.maxRetries ?? 3;
    this.retryDelayMs = config.retryDelayMs ?? 1000;

    logger.info(`ContractReader initialized for contract: ${config.contractId}`);
  }

  // ==========================================================================
  // Public Methods
  // ==========================================================================

  /**
   * Get total number of tokens created
   */
  async getTokenCount(): Promise<number> {
    try {
      const result = await this.callContract('get_token_count');
      return typeof result === 'number' ? result : Number(result);
    } catch (error) {
      logger.error('Failed to get token count:', error);
      return 0;
    }
  }

  /**
   * Get token info by address
   */
  async getTokenInfo(tokenAddress: string): Promise<TokenInfo | null> {
    try {
      const addressScVal = Address.fromString(tokenAddress).toScVal();
      const result = await this.callContract('get_token_info', addressScVal);

      if (!result) return null;

      return this.parseTokenInfo(result);
    } catch (error) {
      logger.warn(`Failed to get token info for ${tokenAddress}:`, error);
      return null;
    }
  }

  /**
   * Get all tokens with pagination
   */
  async getAllTokens(offset: number = 0, limit: number = 100): Promise<string[]> {
    try {
      const result = await this.callContract(
        'get_all_tokens',
        xdr.ScVal.scvU32(offset),
        xdr.ScVal.scvU32(limit)
      );

      if (!result || !Array.isArray(result)) return [];

      return result.map((addr: any) => {
        if (typeof addr === 'string') return addr;
        if (addr?.toString) return addr.toString();
        return String(addr);
      });
    } catch {
      logger.warn('get_all_tokens not available, trying alternative method');
      return this.getAllTokensAlternative(offset, limit);
    }
  }

  /**
   * Alternative method to get tokens - fetch from events
   */
  private async getAllTokensAlternative(offset: number, limit: number): Promise<string[]> {
    try {
      // Try get_tokens_paginated
      const result = await this.callContract(
        'get_tokens_paginated',
        xdr.ScVal.scvU32(offset),
        xdr.ScVal.scvU32(limit)
      );

      if (result && Array.isArray(result)) {
        return result.map((addr: any) => String(addr));
      }

      return [];
    } catch (error) {
      logger.error('Failed to get tokens with alternative method:', error);
      return [];
    }
  }

  /**
   * Get token price
   */
  async getTokenPrice(tokenAddress: string): Promise<string> {
    try {
      const addressScVal = Address.fromString(tokenAddress).toScVal();
      const result = await this.callContract('get_price', addressScVal);
      return result?.toString() ?? '0';
    } catch {
      logger.warn(`Failed to get price for ${tokenAddress}`);
      return '0';
    }
  }

  /**
   * Get bonding curve state
   */
  async getBondingCurve(tokenAddress: string): Promise<{
    xlmReserve: string;
    tokenReserve: string;
    k: string;
  } | null> {
    try {
      const addressScVal = Address.fromString(tokenAddress).toScVal();
      const result = await this.callContract('get_bonding_curve', addressScVal);

      if (!result) return null;

      return {
        xlmReserve: result.xlm_reserve?.toString() ?? '0',
        tokenReserve: result.token_reserve?.toString() ?? '0',
        k: result.k?.toString() ?? '0',
      };
    } catch {
      logger.warn(`Failed to get bonding curve for ${tokenAddress}`);
      return null;
    }
  }

  /**
   * Fetch tokens from contract events (last 7 days)
   */
  async getTokensFromEvents(): Promise<string[]> {
    const tokenAddresses = new Set<string>();

    try {
      const latestLedger = await this.server.getLatestLedger();
      const endLedger = latestLedger.sequence;
      // Go back ~7 days (about 120,000 ledgers at 5s per ledger)
      const startLedger = Math.max(endLedger - 120000, 0);

      logger.info(`Fetching events from ledger ${startLedger} to ${endLedger}`);

      const events = await this.server.getEvents({
        startLedger,
        filters: [
          {
            type: 'contract',
            contractIds: [this.contract.contractId()],
          },
        ],
        limit: 10000,
      });

      if (events.events) {
        for (const event of events.events) {
          try {
            const eventData = scValToNative(event.value);

            // Extract token address from different event formats
            if (eventData?.token_address) {
              tokenAddresses.add(eventData.token_address);
            } else if (eventData?.token) {
              tokenAddresses.add(eventData.token);
            } else if (typeof eventData === 'string' && eventData.startsWith('C')) {
              tokenAddresses.add(eventData);
            }
          } catch {
            // Silent fail for individual event parsing
          }
        }
      }

      logger.info(`Found ${tokenAddresses.size} unique tokens from events`);
    } catch (error) {
      logger.error('Failed to fetch events:', error);
    }

    return Array.from(tokenAddresses);
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Call contract method with retry logic
   */
  private async callContract(method: string, ...params: xdr.ScVal[]): Promise<any> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const operation = this.contract.call(method, ...params);

        // Create a minimal transaction for simulation
        const tx = new TransactionBuilder(
          new Account(
            'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
            '0'
          ),
          {
            fee: '100',
            networkPassphrase: this.networkPassphrase,
          }
        )
          .addOperation(operation)
          .setTimeout(30)
          .build();

        const simulation = await this.server.simulateTransaction(tx);

        if (SorobanRpc.Api.isSimulationSuccess(simulation)) {
          if (simulation.result?.retval) {
            return scValToNative(simulation.result.retval);
          }
          return null;
        }

        throw new Error(`Simulation failed for ${method}`);
      } catch (error: any) {
        lastError = error;

        if (attempt < this.maxRetries) {
          const delay = this.retryDelayMs * Math.pow(2, attempt - 1);
          logger.debug(`Retry ${attempt}/${this.maxRetries} for ${method} in ${delay}ms`);
          await this.sleep(delay);
        }
      }
    }

    throw lastError ?? new Error(`Failed to call ${method}`);
  }

  /**
   * Parse raw contract response to TokenInfo
   */
  private parseTokenInfo(data: any): TokenInfo | null {
    if (!data) return null;

    try {
      return {
        id: Number(data.id ?? 0),
        creator: String(data.creator ?? ''),
        token_address: String(data.token_address ?? ''),
        name: String(data.name ?? ''),
        symbol: String(data.symbol ?? ''),
        image_url: String(data.image_url ?? ''),
        description: String(data.description ?? ''),
        created_at: Number(data.created_at ?? 0),
        status: data.status === 'Graduated' ? 'Graduated' : 'Bonding',
        bonding_curve: {
          xlm_reserve: String(data.bonding_curve?.xlm_reserve ?? '0'),
          token_reserve: String(data.bonding_curve?.token_reserve ?? '0'),
          k: String(data.bonding_curve?.k ?? '0'),
        },
        xlm_raised: String(data.xlm_raised ?? '0'),
        market_cap: String(data.market_cap ?? '0'),
        holders_count: Number(data.holders_count ?? 0),
      };
    } catch (error) {
      logger.error('Failed to parse token info:', error);
      return null;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createContractReader(): ContractReader {
  const config: ContractReaderConfig = {
    rpcUrl: process.env.STELLAR_RPC_URL || 'https://soroban-testnet.stellar.org',
    networkPassphrase: process.env.STELLAR_PASSPHRASE || Networks.TESTNET,
    contractId: process.env.TOKEN_FACTORY_CONTRACT_ID || '',
    maxRetries: 3,
    retryDelayMs: 1000,
  };

  if (!config.contractId) {
    throw new Error('TOKEN_FACTORY_CONTRACT_ID is required');
  }

  return new ContractReader(config);
}
