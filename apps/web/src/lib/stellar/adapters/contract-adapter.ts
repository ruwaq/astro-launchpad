/**
 * Contract Response Adapter
 *
 * Maps Soroban contract responses to frontend-compatible types.
 * Provides type-safe transformations and handles field name mismatches.
 *
 * Pattern: Adapter Pattern for cross-boundary data transformation
 */

import { logger } from '@/lib/logger';
import { errorLogger, ErrorCategory, ErrorSeverity } from '@/lib/monitoring/error-logger';
import type { TokenStatus } from '../services/sac-factory.service';

/**
 * Raw bonding curve from Soroban contract
 * (Matches Rust struct field names)
 */
export interface RawBondingCurve {
  total_supply?: bigint;
  tokens_sold?: bigint;
  tokens_remaining?: bigint;  // ← Contract uses this name
  xlm_reserve?: bigint;
  k?: bigint;
}

/**
 * Normalized bonding curve for frontend
 * (Consistent naming for UI/service layer)
 */
export interface NormalizedBondingCurve {
  token_reserve: string;  // ← Frontend expects this name
  xlm_reserve: string;
  k: string;
  total_supply?: string;
  tokens_sold?: string;
}

/**
 * Raw token info from Soroban contract
 */
export interface RawTokenInfo {
  id: number;
  creator: string;
  token_address: string;
  name: string;
  symbol: string;
  issuer?: string;
  image_url?: string;
  description?: string;
  created_at: number;
  status: TokenStatus | { [key: string]: undefined };
  bonding_curve: RawBondingCurve;
  xlm_raised?: bigint;
  market_cap?: bigint;
  holders_count?: number;
}

/**
 * Adapter Configuration
 */
interface AdapterConfig {
  logWarnings: boolean;
  throwOnMissingFields: boolean;
}

const DEFAULT_CONFIG: AdapterConfig = {
  logWarnings: true,
  throwOnMissingFields: false,
};

/**
 * Adapt raw bonding curve from contract to normalized format
 *
 * @param raw - Raw bonding curve data from contract
 * @param config - Adapter configuration
 * @returns Normalized bonding curve with calculated fields
 *
 * @example
 * const rawCurve = { tokens_remaining: 1000n, xlm_reserve: 500n, k: 500000n };
 * const normalized = adaptBondingCurve(rawCurve);
 * // { token_reserve: "1000", xlm_reserve: "500", k: "500000" }
 */
export function adaptBondingCurve(
  raw: RawBondingCurve,
  config: Partial<AdapterConfig> = {}
): NormalizedBondingCurve {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  // Validate essential fields
  if (typeof raw.xlm_reserve === 'undefined' || typeof raw.k === 'undefined') {
    const error = 'Missing essential bonding curve fields (xlm_reserve or k)';
    errorLogger.logParsingError(error, new Error(error), { raw });
    if (cfg.throwOnMissingFields) {
      throw new Error(error);
    }
  }

  // Primary mapping: tokens_remaining → token_reserve
  let tokenReserve = raw.tokens_remaining;

  // Fallback: Calculate from k and xlm_reserve if missing
  // Formula: k = xlm_reserve * token_reserve → token_reserve = k / xlm_reserve
  if (typeof tokenReserve === 'undefined' && raw.k && raw.xlm_reserve) {
    if (cfg.logWarnings) {
      errorLogger.log({
        category: ErrorCategory.PARSING,
        severity: ErrorSeverity.WARNING,
        message: 'tokens_remaining missing, calculating from k and xlm_reserve',
        metadata: { k: raw.k.toString(), xlm_reserve: raw.xlm_reserve.toString() },
        component: 'ContractAdapter',
      });
    }
    tokenReserve = raw.k / raw.xlm_reserve;
  }

  // Convert BigInt to string for safe serialization
  return {
    token_reserve: tokenReserve?.toString() || '0',
    xlm_reserve: raw.xlm_reserve?.toString() || '0',
    k: raw.k?.toString() || '0',
    total_supply: raw.total_supply?.toString(),
    tokens_sold: raw.tokens_sold?.toString(),
  };
}

/**
 * Adapt raw token status to normalized enum
 *
 * Soroban returns enums as objects: { Bonding: undefined } or { Graduated: undefined }
 * Database may store as string: 'Bonding' or 'Graduated'
 * We normalize to simple string enum.
 *
 * @param status - Raw status from contract or database
 * @returns Normalized TokenStatus
 */
export function adaptTokenStatus(
  status: TokenStatus | { [key: string]: undefined } | undefined
): TokenStatus {
  // Null/undefined - default to Bonding (most common case for new tokens)
  if (!status) {
    return 'Bonding' as TokenStatus;
  }

  // Already a string (from database)
  if (typeof status === 'string') {
    const normalized = status.toLowerCase();
    if (normalized === 'graduated') {
      return 'Graduated' as TokenStatus;
    }
    // Any other string value defaults to Bonding
    return 'Bonding' as TokenStatus;
  }

  // Soroban enum format: { Bonding: undefined } or { Graduated: undefined }
  if (typeof status === 'object') {
    const keys = Object.keys(status);

    // Check for known status keys
    if (keys.includes('Graduated')) {
      return 'Graduated' as TokenStatus;
    }
    if (keys.includes('Bonding')) {
      return 'Bonding' as TokenStatus;
    }
    if (keys.includes('GraduationFailed')) {
      logger.warn('[Adapter] Token graduation failed, treating as Bonding');
      return 'Bonding' as TokenStatus;
    }

    // Empty object or unknown keys - default to Bonding silently
    // This is common for newly created tokens or database tokens
  }

  // Default to Bonding for any unrecognized format
  return 'Bonding' as TokenStatus;
}

/**
 * Adapt raw token info to service layer format
 *
 * @param raw - Raw token info from contract
 * @returns Adapted token info with normalized fields
 */
export function adaptTokenInfo(raw: RawTokenInfo) {
  return {
    id: raw.id,
    creator: raw.creator,
    token_address: raw.token_address,
    name: raw.name,
    symbol: raw.symbol,
    issuer: raw.issuer || '',
    image_url: raw.image_url || '',
    description: raw.description || '',
    created_at: raw.created_at,
    status: adaptTokenStatus(raw.status),
    bonding_curve: adaptBondingCurve(raw.bonding_curve),
    xlm_raised: raw.xlm_raised?.toString() || '0',
    market_cap: raw.market_cap?.toString() || '0',
    holders_count: raw.holders_count || 0,
  };
}

/**
 * Validate bonding curve invariants
 *
 * Ensures k = xlm_reserve * token_reserve within acceptable tolerance
 *
 * @param curve - Normalized bonding curve
 * @returns true if valid, false otherwise
 */
export function validateBondingCurveInvariant(
  curve: NormalizedBondingCurve,
  toleranceBps: number = 10 // 0.1% tolerance
): boolean {
  try {
    const xlmReserve = BigInt(curve.xlm_reserve);
    const tokenReserve = BigInt(curve.token_reserve);
    const k = BigInt(curve.k);

    const calculatedK = xlmReserve * tokenReserve;
    const difference = calculatedK > k ? calculatedK - k : k - calculatedK;
    const toleranceAmount = (k * BigInt(toleranceBps)) / BigInt(10000);

    const isValid = difference <= toleranceAmount;

    if (!isValid) {
      logger.warn('[Adapter] Bonding curve invariant violated', {
        expected_k: k.toString(),
        calculated_k: calculatedK.toString(),
        difference: difference.toString(),
        tolerance: toleranceAmount.toString(),
      });
    }

    return isValid;
  } catch (error) {
    logger.error('[Adapter] Error validating bonding curve invariant', { error, curve });
    return false;
  }
}
