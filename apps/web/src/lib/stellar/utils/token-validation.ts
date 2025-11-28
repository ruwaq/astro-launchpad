/**
 * Token Validation Utilities
 *
 * Utilities for validating tokens between database and Stellar contract.
 * Helps identify and handle data synchronization issues.
 */

import { sacFactoryService } from '../services/sac-factory.service';

export interface TokenValidationResult {
  address: string;
  existsOnChain: boolean;
  existsInDatabase: boolean;
  isValid: boolean;
  error?: string;
  checkedAt: Date;
}

export interface BatchValidationResult {
  valid: TokenValidationResult[];
  invalid: TokenValidationResult[];
  errors: TokenValidationResult[];
  summary: {
    total: number;
    validCount: number;
    invalidCount: number;
    errorCount: number;
    validPercentage: number;
  };
}

/**
 * Validate a single token address against the Stellar contract
 */
export async function validateTokenOnChain(
  tokenAddress: string
): Promise<TokenValidationResult> {
  const result: TokenValidationResult = {
    address: tokenAddress,
    existsOnChain: false,
    existsInDatabase: true, // Assumed true if we're checking
    isValid: false,
    checkedAt: new Date(),
  };

  try {
    const tokenInfo = await sacFactoryService.getTokenInfo(tokenAddress);
    result.existsOnChain = !!tokenInfo;
    result.isValid = !!tokenInfo;
  } catch (error: any) {
    // Token not found or contract error
    result.existsOnChain = false;
    result.isValid = false;
    result.error = error.message || 'Failed to validate token';
  }

  return result;
}

/**
 * Validate multiple token addresses in batch
 */
export async function validateTokensBatch(
  tokenAddresses: string[],
  options: {
    concurrency?: number;
    onProgress?: (completed: number, total: number) => void;
  } = {}
): Promise<BatchValidationResult> {
  const { concurrency = 5, onProgress } = options;

  const results: TokenValidationResult[] = [];
  let completed = 0;

  // Process in batches to avoid overwhelming the RPC
  for (let i = 0; i < tokenAddresses.length; i += concurrency) {
    const batch = tokenAddresses.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map((address) => validateTokenOnChain(address))
    );

    results.push(...batchResults);
    completed += batch.length;

    if (onProgress) {
      onProgress(completed, tokenAddresses.length);
    }
  }

  // Categorize results
  const valid = results.filter((r) => r.isValid);
  const invalid = results.filter((r) => !r.isValid && !r.error);
  const errors = results.filter((r) => r.error);

  return {
    valid,
    invalid,
    errors,
    summary: {
      total: results.length,
      validCount: valid.length,
      invalidCount: invalid.length,
      errorCount: errors.length,
      validPercentage: results.length > 0
        ? Math.round((valid.length / results.length) * 100)
        : 0,
    },
  };
}

/**
 * Quick check if a token exists on chain (faster, less detailed)
 */
export async function tokenExistsOnChain(tokenAddress: string): Promise<boolean> {
  try {
    const tokenInfo = await sacFactoryService.getTokenInfo(tokenAddress);
    return !!tokenInfo;
  } catch {
    return false;
  }
}

/**
 * Get validation status label for UI display
 */
export function getValidationStatusLabel(result: TokenValidationResult): {
  label: string;
  color: 'green' | 'red' | 'yellow' | 'gray';
  description: string;
} {
  if (result.error) {
    return {
      label: 'Error',
      color: 'yellow',
      description: result.error,
    };
  }

  if (result.isValid) {
    return {
      label: 'On-Chain',
      color: 'green',
      description: 'Token verified on Stellar contract',
    };
  }

  return {
    label: 'Invalid',
    color: 'red',
    description: 'Token not found on current contract',
  };
}
