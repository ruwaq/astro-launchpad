/**
 * Stellar Utility Functions
 *
 * Helper functions for common Stellar operations, formatting,
 * and validation tasks.
 */

import { Address, nativeToScVal, scValToNative, xdr } from '@stellar/stellar-sdk';

/**
 * Address Validation
 */

/**
 * Validate a Stellar public key (G address)
 */
export function isValidStellarAddress(address: string): boolean {
  try {
    if (!address || typeof address !== 'string') return false;
    if (!address.startsWith('G') || address.length !== 56) return false;
    Address.fromString(address);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate a Stellar contract ID (C address)
 */
export function isValidContractId(contractId: string): boolean {
  try {
    if (!contractId || typeof contractId !== 'string') return false;
    if (!contractId.startsWith('C') || contractId.length !== 56) return false;
    Address.fromString(contractId);
    return true;
  } catch {
    return false;
  }
}

/**
 * Amount Formatting
 */

/**
 * Convert stroops to XLM
 * 1 XLM = 10,000,000 stroops
 */
export function stroopsToXlm(stroops: string | number): string {
  const amount = typeof stroops === 'string' ? parseInt(stroops) : stroops;
  return (amount / 10_000_000).toFixed(7);
}

/**
 * Convert XLM to stroops
 */
export function xlmToStroops(xlm: string | number): string {
  const amount = typeof xlm === 'string' ? parseFloat(xlm) : xlm;
  return Math.floor(amount * 10_000_000).toString();
}

/**
 * Format amount with proper decimals
 */
export function formatAmount(
  amount: string | number,
  decimals: number = 7
): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return '0';
  return num.toFixed(decimals).replace(/\.?0+$/, '');
}

/**
 * Format amount as currency (with thousands separators)
 */
export function formatCurrency(
  amount: string | number,
  decimals: number = 2
): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return '0';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
}

/**
 * Format large numbers (K, M, B)
 */
export function formatCompactNumber(num: number): string {
  if (num < 1000) return num.toString();
  if (num < 1_000_000) return `${(num / 1000).toFixed(1)}K`;
  if (num < 1_000_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  return `${(num / 1_000_000_000).toFixed(1)}B`;
}

/**
 * Address Formatting
 */

/**
 * Truncate address for display
 */
export function truncateAddress(address: string, chars: number = 4): string {
  if (!address) return '';
  if (address.length <= chars * 2) return address;
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

/**
 * Soroban ScVal Utilities
 */

/**
 * Convert JavaScript value to Soroban ScVal
 */
export function toScVal(value: any, type?: xdr.ScValType): xdr.ScVal {
  return nativeToScVal(value, type ? { type } : undefined);
}

/**
 * Convert Soroban ScVal to JavaScript value
 */
export function fromScVal(scVal: xdr.ScVal): any {
  return scValToNative(scVal);
}

/**
 * Create Address ScVal from string
 */
export function addressToScVal(address: string): xdr.ScVal {
  return Address.fromString(address).toScVal();
}

/**
 * Time Utilities
 */

/**
 * Get time ago string
 */
export function getTimeAgo(timestamp: number): string {
  const seconds = Math.floor(Date.now() / 1000) - timestamp;
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 2592000) return `${Math.floor(seconds / 86400)}d ago`;
  if (seconds < 31536000) return `${Math.floor(seconds / 2592000)}mo ago`;
  return `${Math.floor(seconds / 31536000)}y ago`;
}

/**
 * Error Utilities
 */

/**
 * Extract error message from various error types
 */
export function getErrorMessage(error: unknown): string {
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message);
  }
  return 'An unknown error occurred';
}

/**
 * Percentage Calculations
 */

/**
 * Apply slippage to amount
 */
export function applySlippage(
  amount: number,
  slippagePercent: number,
  isMinimum: boolean = true
): number {
  const multiplier = isMinimum
    ? (100 - slippagePercent) / 100
    : (100 + slippagePercent) / 100;
  return amount * multiplier;
}
