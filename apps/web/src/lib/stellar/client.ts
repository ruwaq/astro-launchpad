/**
 * Stellar Client
 *
 * Provides a singleton instance for interacting with the Stellar network
 * through both Horizon (for account data) and Soroban RPC (for contracts).
 */

import { SorobanRpc, Horizon } from '@stellar/stellar-sdk';
import { getNetworkConfig, NETWORK } from './config';

/**
 * Soroban RPC Client
 * Used for interacting with smart contracts
 */
class SorobanClient {
  private server: SorobanRpc.Server;
  private config = getNetworkConfig();

  constructor() {
    this.server = new SorobanRpc.Server(this.config.rpcUrl, {
      allowHttp: NETWORK === 'testnet',
    });
  }

  /**
   * Get the Soroban RPC server instance
   */
  getServer(): SorobanRpc.Server {
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
   */
  async getHealth(): Promise<SorobanRpc.Api.GetHealthResponse> {
    return this.server.getHealth();
  }

  /**
   * Get current ledger information
   */
  async getLatestLedger(): Promise<SorobanRpc.Api.GetLatestLedgerResponse> {
    return this.server.getLatestLedger();
  }

  /**
   * Simulate a transaction before submitting
   */
  async simulateTransaction(
    transaction: any
  ): Promise<SorobanRpc.Api.SimulateTransactionResponse> {
    return this.server.simulateTransaction(transaction);
  }

  /**
   * Submit a transaction to the network
   */
  async sendTransaction(
    transaction: any
  ): Promise<SorobanRpc.Api.SendTransactionResponse> {
    return this.server.sendTransaction(transaction);
  }

  /**
   * Get transaction status
   */
  async getTransaction(
    hash: string
  ): Promise<SorobanRpc.Api.GetTransactionResponse> {
    return this.server.getTransaction(hash);
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
   */
  async loadAccount(publicKey: string): Promise<Horizon.AccountResponse> {
    return this.server.loadAccount(publicKey);
  }

  /**
   * Fetch current base fee for the network
   */
  async fetchBaseFee(): Promise<number> {
    return this.server.fetchBaseFee();
  }

  /**
   * Submit a Horizon transaction
   */
  async submitTransaction(
    transaction: any
  ): Promise<Horizon.HorizonApi.SubmitTransactionResponse> {
    return this.server.submitTransaction(transaction);
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
    soroban: SorobanRpc.Api.GetHealthResponse;
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
      console.error('Horizon health check failed:', error);
      return false;
    }
  }
}

/**
 * Singleton instance of the Stellar client
 */
export const stellarClient = new StellarClient();

/**
 * Export client classes for type usage
 */
export { SorobanClient, HorizonClient };
