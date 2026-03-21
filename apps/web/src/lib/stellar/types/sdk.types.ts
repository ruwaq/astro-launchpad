/**
 * Stellar SDK Type Definitions
 *
 * Proper type definitions for Stellar SDK operations and responses
 * to replace `as any` casts throughout the codebase.
 */

import { rpc } from '@stellar/stellar-sdk';
import type { xdr, Transaction } from '@stellar/stellar-sdk';

/**
 * Transaction type that's compatible with TransactionBuilder
 */
export type StellarTransaction = Transaction<any, any>;

/**
 * Operation type compatible with contract calls
 */
export type ContractOperation = xdr.Operation;

/**
 * Failed transaction response from Soroban RPC
 */
export type GetFailedTransactionResponse = rpc.Api.GetFailedTransactionResponse;

/**
 * Type guard for failed transaction
 */
export function isFailedTransaction(
  result: rpc.Api.GetTransactionResponse
): result is rpc.Api.GetFailedTransactionResponse {
  return result.status === rpc.Api.GetTransactionStatus.FAILED;
}

/**
 * Signed transaction XDR string
 */
export type SignedTransactionXDR = string;

/**
 * Simulation response type
 */
export type SimulationResponse = rpc.Api.SimulateTransactionResponse;

/**
 * Successful simulation result
 */
export type SuccessfulSimulation = rpc.Api.SimulateTransactionSuccessResponse;

/**
 * Transaction send result
 */
export type SendTransactionResult = rpc.Api.SendTransactionResponse;

/**
 * Get transaction result
 */
export type GetTransactionResult = rpc.Api.GetTransactionResponse;
