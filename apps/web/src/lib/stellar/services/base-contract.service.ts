/**
 * Base Contract Service
 *
 * Abstract base class for all contract services.
 * Provides common functionality for contract interactions.
 */

import { Contract, SorobanRpc, xdr, TransactionBuilder, Account } from '@stellar/stellar-sdk';
import { stellarClient } from '../client';
import { getNetworkConfig } from '../config';

export abstract class BaseContractService {
  protected contractId: string;
  protected contract: Contract;

  constructor(contractId: string) {
    this.contractId = contractId;
    this.contract = new Contract(contractId);
  }

  /**
   * Get the contract ID
   */
  getContractId(): string {
    return this.contractId;
  }

  /**
   * Get the contract instance
   */
  getContract(): Contract {
    return this.contract;
  }

  /**
   * Call a read-only contract method (no transaction required)
   */
  protected async callReadOnly(
    method: string,
    ...params: xdr.ScVal[]
  ): Promise<any> {
    try {
      const soroban = stellarClient.getSoroban();
      const server = soroban.getServer();

      // Build the contract call operation
      const operation = this.contract.call(method, ...params);

      // Simulate the transaction to get the result
      const simulationResponse = await server.simulateTransaction(
        new TransactionBuilder(
          // Use a dummy source account for read-only calls
          new Account(
            'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
            '0'
          ),
          {
            fee: '100',
            networkPassphrase: getNetworkConfig().networkPassphrase,
          }
        )
          .addOperation(operation as any)
          .setTimeout(30)
          .build() as any
      );

      if (SorobanRpc.Api.isSimulationSuccess(simulationResponse)) {
        return simulationResponse.result?.retval;
      } else if (SorobanRpc.Api.isSimulationError(simulationResponse)) {
        throw new Error(
          `Simulation failed: ${simulationResponse.error}`
        );
      } else {
        throw new Error('Unexpected simulation response');
      }
    } catch (error) {
      console.error(`Error calling ${method}:`, error);
      throw error;
    }
  }

  /**
   * Build a contract call operation for a write method
   */
  protected buildOperation(method: string, ...params: xdr.ScVal[]): xdr.Operation {
    return this.contract.call(method, ...params);
  }
}
