/**
 * Contract Error Utilities
 *
 * Parses and handles Soroban contract errors for user-friendly messages
 */

import { SorobanRpc } from '@stellar/stellar-sdk';

// Contract error codes mapping (from sac-factory/src/errors.rs)
export const CONTRACT_ERROR_MESSAGES: Record<number, string> = {
  1: 'Contract already initialized',
  2: 'Contract not initialized',
  10: 'Unauthorized action',
  11: 'Not an admin',
  20: 'Invalid token name',
  21: 'Invalid token symbol',
  22: 'Invalid amount',
  30: 'Token not found',
  31: 'Token already graduated',
  32: 'Insufficient liquidity',
  40: 'Slippage exceeded - price changed too much',
  41: 'Insufficient balance',
  50: 'Math overflow',
  51: 'Math underflow',
  52: 'Division by zero',
  70: 'Contract is paused',
  80: 'Insufficient fee',
  100: 'Transaction expired',
  101: 'Transfer failed',
  140: 'Anti-whale: max buy amount exceeded (try a smaller amount)',
  141: 'Anti-whale: max holdings exceeded (you cannot hold more than 50% of supply)',
};

/**
 * Parse contract error from error message/code
 */
export function parseContractError(error: { message?: string } | string): string {
  const msg = typeof error === 'string' ? error : (error?.message || '');

  // Try to extract error code from message like "Error(Contract, #141)"
  const errorMatch = msg.match(/#(\d+)/);
  if (errorMatch) {
    const code = parseInt(errorMatch[1], 10);
    if (CONTRACT_ERROR_MESSAGES[code]) {
      return CONTRACT_ERROR_MESSAGES[code];
    }
    return `Contract error #${code}`;
  }

  // Check for common error patterns
  if (msg.includes('InsufficientBalance') || msg.includes('insufficient')) {
    return 'Insufficient balance';
  }
  if (msg.includes('rejected') || msg.includes('cancelled')) {
    return 'Transaction cancelled';
  }

  return msg || 'Transaction failed';
}

/**
 * Extract meaningful error from Soroban simulation response
 */
export function extractSimulationError(simulated: SorobanRpc.Api.SimulateTransactionResponse): string {
  // Check for error field (string or object)
  if ('error' in simulated && simulated.error) {
    const error = simulated.error;

    // If it's a string, parse it directly
    if (typeof error === 'string') {
      return parseContractError(error);
    }

    // If it's an object, try to extract error info
    if (typeof error === 'object') {
      // Check for nested error message
      const errObj = error as Record<string, unknown>;
      if (errObj.message && typeof errObj.message === 'string') {
        return parseContractError(errObj.message);
      }
      if (errObj.code && typeof errObj.code === 'number') {
        if (CONTRACT_ERROR_MESSAGES[errObj.code]) {
          return CONTRACT_ERROR_MESSAGES[errObj.code];
        }
        return `Contract error #${errObj.code}`;
      }
      // Try to stringify and parse
      const errorStr = JSON.stringify(error);
      if (errorStr && errorStr !== '{}') {
        return parseContractError(errorStr);
      }
    }
  }

  // Check for simulation error response type
  if (SorobanRpc.Api.isSimulationError(simulated)) {
    return parseContractError(simulated.error || 'Simulation failed');
  }

  // Check results array for errors
  const results = (simulated as { results?: Array<{ error?: string }> }).results;
  if (results && Array.isArray(results) && results[0]?.error) {
    return parseContractError(results[0].error);
  }

  return 'Transaction simulation failed - please try again';
}
