/**
 * Event Types for Indexer
 *
 * Type definitions for Soroban contract events and parsed event data.
 * These types help catch errors at compile time and reduce ESLint warnings.
 */

/**
 * Raw Soroban event from RPC
 * Using loose typing because the actual Stellar SDK types are complex
 * and the event structure can vary
 */
export interface SorobanEvent {
  id: string;
  type?: string;
  ledger?: number;
  ledgerClosedAt?: string;
  contractId?: string;
  topic?: unknown[];
  value?: unknown;
  inSuccessfulContractCall?: boolean;
  txHash?: string;
  // Optional fields for processing
  ledger_close_time?: Date | string;
  // Allow additional properties
  [key: string]: unknown;
}

/**
 * Parsed event with native values
 */
export interface ParsedEvent extends SorobanEvent {
  parsedTopic: string[];
  parsedValue: unknown;
}

/**
 * Token Created Event Data
 */
export interface TokenCreatedEventData {
  creator: string;
  token: string;
  tokenAddress?: string; // Alias for token
  name: string;
  symbol: string;
}

/**
 * Token Buy Event Data
 */
export interface TokenBuyEventData {
  buyer: string;
  token: string;
  xlm_amount: string | bigint;
  xlmAmount?: string | bigint; // CamelCase alias
  tokens_received: string | bigint;
  tokensReceived?: string | bigint; // CamelCase alias
}

/**
 * Token Sell Event Data
 */
export interface TokenSellEventData {
  seller: string;
  token: string;
  token_amount: string | bigint;
  tokenAmount?: string | bigint; // CamelCase alias
  xlm_received: string | bigint;
  xlmReceived?: string | bigint; // CamelCase alias
}

/**
 * Graduation Event Data
 */
export interface GraduationEventData {
  token: string;
  tokenAddress?: string;
  total_xlm_raised: string | bigint;
  totalXlmRaised?: string | bigint;
  final_price: string | bigint;
  finalPrice?: string | bigint;
  amm_pair?: string;
  ammPair?: string;
  lp_tokens_burned?: string | bigint;
}

/**
 * Fee Collected Event Data
 */
export interface FeeCollectedEventData {
  token: string;
  fee_type: 'buy' | 'sell' | 'graduation' | string;
  feeType?: string;
  amount: string | bigint;
  recipient: string;
}

/**
 * Config Updated Event Data
 */
export interface ConfigUpdatedEventData {
  field: string;
  old_value: unknown;
  new_value: unknown;
  oldValue?: unknown;
  newValue?: unknown;
  updated_by: string;
  updatedBy?: string;
}

/**
 * Admin Event Data
 */
export interface AdminEventData {
  action: string;
  admin: string;
  target?: string;
  params?: Record<string, unknown>;
}

/**
 * Token Info from Contract Reader
 */
export interface TokenInfo {
  name: string;
  symbol: string;
  decimals?: number;
  description?: string;
  image_url?: string;
  status?: 'Active' | 'Graduated' | 'Paused';
  creator?: string;
  created_at?: number;
  holders_count?: number;
  market_cap?: string;
  xlm_raised?: string;
  bonding_curve?: {
    token_reserve: string;
    xlm_reserve: string;
    current_price?: string;
  };
}

/**
 * Union type for all event data types
 */
export type EventData =
  | TokenCreatedEventData
  | TokenBuyEventData
  | TokenSellEventData
  | GraduationEventData
  | FeeCollectedEventData
  | ConfigUpdatedEventData
  | AdminEventData
  | Record<string, unknown>;

/**
 * Type guard for TokenCreatedEventData
 */
export function isTokenCreatedEvent(data: unknown): data is TokenCreatedEventData {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  return (
    (typeof d.creator === 'string' || d.creator === undefined) &&
    (typeof d.token === 'string' || typeof d.tokenAddress === 'string') &&
    (typeof d.name === 'string' || d.name === undefined) &&
    (typeof d.symbol === 'string' || d.symbol === undefined)
  );
}

/**
 * Type guard for TokenBuyEventData
 */
export function isTokenBuyEvent(data: unknown): data is TokenBuyEventData {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  return (
    typeof d.buyer === 'string' &&
    typeof d.token === 'string' &&
    (d.xlm_amount !== undefined || d.xlmAmount !== undefined)
  );
}

/**
 * Type guard for TokenSellEventData
 */
export function isTokenSellEvent(data: unknown): data is TokenSellEventData {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  return (
    typeof d.seller === 'string' &&
    typeof d.token === 'string' &&
    (d.token_amount !== undefined || d.tokenAmount !== undefined)
  );
}

/**
 * Type guard for GraduationEventData
 */
export function isGraduationEvent(data: unknown): data is GraduationEventData {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  return (
    (typeof d.token === 'string' || typeof d.tokenAddress === 'string') &&
    (d.total_xlm_raised !== undefined || d.totalXlmRaised !== undefined)
  );
}

/**
 * Safe string conversion for event field values
 */
export function toEventString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'number') return value.toString();
  if (typeof value === 'object' && 'toString' in value) {
    return (value as { toString(): string }).toString();
  }
  return String(value);
}

/**
 * Safe BigInt conversion for amounts
 */
export function toEventAmount(value: unknown): string {
  if (value === null || value === undefined) return '0';
  if (typeof value === 'string') return value;
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'number') return value.toString();
  return '0';
}
