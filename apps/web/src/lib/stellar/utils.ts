/**
 * Stellar Utility Functions
 *
 * Helper functions for common Stellar operations, formatting,
 * and validation tasks.
 */

import { Address, nativeToScVal, scValToNative, xdr } from '@stellar/stellar-sdk';
import type { ScValConvertible } from './types';

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
 * Amount Formatting - Stellar Best Practices
 *
 * Reference: https://developers.stellar.org/docs/learn/fundamentals/stellar-data-structures/assets
 * - 1 XLM = 10,000,000 stroops (10^7)
 * - Maximum precision: 7 decimal places
 * - Use integers (stroops) for storage/transmission to avoid floating-point errors
 * - Convert to XLM only for display
 */

/** Stellar decimal precision (7 decimals) */
export const STELLAR_DECIMALS = 7;
/** 1 XLM in stroops */
export const STROOPS_PER_XLM = 10_000_000n;

/**
 * Graduation threshold for tokens to move from bonding curve to DEX
 * When a token raises this amount of XLM, it "graduates"
 */
export const GRADUATION_THRESHOLD_XLM = 10_000;
/** Graduation threshold in stroops (10,000 XLM) */
export const GRADUATION_THRESHOLD_STROOPS = 100_000_000_000n;

/**
 * Convert stroops to XLM using BigInt for precision
 * Uses integer arithmetic to avoid floating-point errors
 *
 * @param stroops - Amount in stroops (string, number, or bigint)
 * @param maxDecimals - Maximum decimal places to show (default: 7)
 * @returns XLM amount as string with proper decimal places
 */
export function stroopsToXlm(
  stroops: string | number | bigint,
  maxDecimals: number = STELLAR_DECIMALS
): string {
  try {
    // Convert to BigInt for precision
    const stroopsBigInt =
      typeof stroops === 'bigint'
        ? stroops
        : BigInt(typeof stroops === 'string' ? stroops.split('.')[0] : Math.floor(stroops));

    // Handle negative amounts
    const isNegative = stroopsBigInt < 0n;
    const absStroops = isNegative ? -stroopsBigInt : stroopsBigInt;

    // Split into whole XLM and fractional parts
    const wholeXlm = absStroops / STROOPS_PER_XLM;
    const fractionalStroops = absStroops % STROOPS_PER_XLM;

    // Convert fractional part to string with leading zeros
    let fractionalStr = fractionalStroops.toString().padStart(7, '0');

    // Trim trailing zeros and limit to maxDecimals
    fractionalStr = fractionalStr.slice(0, maxDecimals).replace(/0+$/, '');

    // Build result
    const sign = isNegative ? '-' : '';
    if (fractionalStr.length === 0) {
      return `${sign}${wholeXlm}`;
    }
    return `${sign}${wholeXlm}.${fractionalStr}`;
  } catch {
    return '0';
  }
}

/**
 * Convert XLM to stroops using precise string parsing
 *
 * @param xlm - Amount in XLM (string or number)
 * @returns Stroops amount as string
 */
export function xlmToStroops(xlm: string | number): string {
  try {
    const xlmStr = typeof xlm === 'number' ? xlm.toString() : xlm;
    const [wholePart, fractionalPart = ''] = xlmStr.split('.');

    // Pad or trim fractional part to 7 digits
    const paddedFractional = fractionalPart.padEnd(7, '0').slice(0, 7);

    // Combine and parse as BigInt
    const stroops = BigInt(wholePart + paddedFractional);
    return stroops.toString();
  } catch {
    return '0';
  }
}

/**
 * Format XLM amount for display with locale-aware formatting
 * Preserves precision while adding thousands separators
 *
 * @param xlmAmount - Amount in XLM (already converted from stroops)
 * @param options - Formatting options
 */
export function formatXlmDisplay(
  xlmAmount: string | number,
  options: {
    maxDecimals?: number;
    minDecimals?: number;
    showTrailingZeros?: boolean;
    locale?: string;
  } = {}
): string {
  const {
    maxDecimals = STELLAR_DECIMALS,
    minDecimals = 0,
    showTrailingZeros = false,
    locale = 'en-US',
  } = options;

  const num = typeof xlmAmount === 'string' ? parseFloat(xlmAmount) : xlmAmount;
  if (isNaN(num)) return '0';

  // Use Intl.NumberFormat for locale-aware formatting
  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: showTrailingZeros ? minDecimals : 0,
    maximumFractionDigits: maxDecimals,
  }).format(num);

  return formatted;
}

/**
 * Format stroops directly for display (convenience function)
 *
 * @param stroops - Amount in stroops
 * @param options - Display formatting options
 */
export function formatStroopsDisplay(
  stroops: string | number | bigint,
  options: {
    maxDecimals?: number;
    compact?: boolean;
    locale?: string;
  } = {}
): string {
  const { maxDecimals = 2, compact = false, locale = 'en-US' } = options;

  // Convert to XLM first
  const xlm = stroopsToXlm(stroops, STELLAR_DECIMALS);
  const xlmNum = parseFloat(xlm);

  if (compact) {
    return formatCompactNumber(xlmNum);
  }

  return formatXlmDisplay(xlmNum, { maxDecimals, locale });
}

/**
 * Format amount with proper decimals (deprecated - use formatXlmDisplay)
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
  if (Math.abs(num) < 1000) return num.toFixed(2);
  if (Math.abs(num) < 1_000_000) return `${(num / 1000).toFixed(1)}K`;
  if (Math.abs(num) < 1_000_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
  return `${(num / 1_000_000_000).toFixed(2)}B`;
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
export function toScVal(value: ScValConvertible, type?: xdr.ScValType): xdr.ScVal {
  return nativeToScVal(value, type ? { type } : undefined);
}

/**
 * Convert Soroban ScVal to JavaScript value
 */
export function fromScVal(scVal: xdr.ScVal): unknown {
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
