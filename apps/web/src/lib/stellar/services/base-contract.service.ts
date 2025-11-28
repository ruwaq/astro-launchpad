/**
 * Base Contract Service
 *
 * Abstract base class for all contract services.
 * Provides common functionality for contract interactions.
 */

import { Contract, SorobanRpc, xdr, TransactionBuilder, Account } from '@stellar/stellar-sdk';
import { stellarClient } from '../client';
import { getNetworkConfig } from '../config';
import type { ContractCallResult } from '../types';

export interface PreparedTransaction {
  txXDR: string;
  simulationResult: SorobanRpc.Api.SimulateTransactionResponse;
}

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
   * Includes network timeout protection
   */
  protected async callReadOnly(
    method: string,
    ...params: xdr.ScVal[]
  ): Promise<ContractCallResult<xdr.ScVal>> {
    // SAFETY: Network timeout to prevent hanging requests
    const NETWORK_TIMEOUT = 15000; // 15 seconds

    try {
      const soroban = stellarClient.getSoroban();
      const server = soroban.getServer();

      // Build the contract call operation
      const operation = this.contract.call(method, ...params);

      // Build the simulation transaction
      const tx = new TransactionBuilder(
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
        .build();

      // SAFETY: Wrap simulation in timeout to prevent hanging
      const simulationPromise = server.simulateTransaction(tx as any);
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`Contract call ${method} timed out after ${NETWORK_TIMEOUT}ms`)), NETWORK_TIMEOUT);
      });

      const simulationResponse = await Promise.race([simulationPromise, timeoutPromise]);

      if (SorobanRpc.Api.isSimulationSuccess(simulationResponse)) {
        return simulationResponse.result?.retval ?? null;
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

  /**
   * Prepare a transaction for signing
   * Builds, simulates, and assembles the transaction with auth
   *
   * @param sourceAddress - The address that will sign and submit the transaction
   * @param operation - The contract operation to execute
   * @returns Prepared transaction XDR ready for signing
   */
  protected async prepareTransaction(
    sourceAddress: string,
    operation: xdr.Operation
  ): Promise<PreparedTransaction> {
    const soroban = stellarClient.getSoroban();
    const horizon = stellarClient.getHorizon();
    const server = soroban.getServer();
    const config = getNetworkConfig();

    // Load the source account
    const account = await horizon.loadAccount(sourceAddress);

    // Build the transaction
    const transaction = new TransactionBuilder(account, {
      fee: '100000', // 0.01 XLM base fee (will be adjusted by simulation)
      networkPassphrase: config.networkPassphrase,
    })
      .addOperation(operation as any)
      .setTimeout(300) // 5 minutes
      .build();

    // Simulate the transaction
    const simulationResult = await server.simulateTransaction(transaction);

    if (!SorobanRpc.Api.isSimulationSuccess(simulationResult)) {
      if (SorobanRpc.Api.isSimulationError(simulationResult)) {
        throw new Error(`Simulation failed: ${simulationResult.error}`);
      }
      throw new Error('Simulation failed with unknown error');
    }

    // Assemble the transaction with simulation results (auth, resource limits)
    const preparedTxBuilder = SorobanRpc.assembleTransaction(transaction, simulationResult);
    const preparedTx = preparedTxBuilder.build();

    return {
      txXDR: preparedTx.toXDR(),
      simulationResult,
    };
  }

  /**
   * Submit a signed transaction to the network and wait for result
   *
   * @param signedTxXDR - The signed transaction XDR
   * @returns Transaction result with hash
   */
  protected async submitSignedTransaction(
    signedTxXDR: string
  ): Promise<{ hash: string; result: SorobanRpc.Api.GetSuccessfulTransactionResponse }> {
    const soroban = stellarClient.getSoroban();
    const server = soroban.getServer();
    const config = getNetworkConfig();

    // Parse the signed transaction
    const transaction = TransactionBuilder.fromXDR(signedTxXDR, config.networkPassphrase);

    // Submit to network
    const sendResult = await server.sendTransaction(transaction);

    if (sendResult.status === 'ERROR') {
      throw new Error(`Transaction submission failed: ${sendResult.errorResult?.toXDR('base64') || 'Unknown error'}`);
    }

    // Wait for confirmation
    const hash = sendResult.hash;
    let getResult = await server.getTransaction(hash);

    // Poll until transaction is confirmed (max ~30 seconds)
    const maxAttempts = 30;
    let attempts = 0;

    while (getResult.status === SorobanRpc.Api.GetTransactionStatus.NOT_FOUND && attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      getResult = await server.getTransaction(hash);
      attempts++;
    }

    if (getResult.status === SorobanRpc.Api.GetTransactionStatus.SUCCESS) {
      return {
        hash,
        result: getResult as SorobanRpc.Api.GetSuccessfulTransactionResponse,
      };
    }

    if (getResult.status === SorobanRpc.Api.GetTransactionStatus.FAILED) {
      throw new Error(`Transaction failed: ${(getResult as any).resultXdr || 'Unknown error'}`);
    }

    throw new Error('Transaction timed out waiting for confirmation');
  }
}
