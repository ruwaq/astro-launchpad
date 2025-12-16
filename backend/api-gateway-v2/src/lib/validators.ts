/**
 * Input Validators for GraphQL Resolvers
 * Validates and sanitizes user input to prevent injection attacks
 */

import { StrKey } from '@stellar/stellar-base';
import { GraphQLError } from 'graphql';

/**
 * Validate Stellar address format (G... for accounts, C... for contracts)
 */
export function validateStellarAddress(
  address: string | null | undefined,
  fieldName: string = 'address'
): string {
  if (!address) {
    throw new GraphQLError(`${fieldName} is required`);
  }

  if (typeof address !== 'string' || address.length !== 56) {
    throw new GraphQLError(`Invalid ${fieldName}: must be a 56 character string`);
  }

  // Validate G... addresses (accounts)
  if (address.startsWith('G')) {
    if (!StrKey.isValidEd25519PublicKey(address)) {
      throw new GraphQLError(`Invalid ${fieldName}: not a valid Stellar account address`);
    }
    return address;
  }

  // Validate C... addresses (contracts)
  if (address.startsWith('C')) {
    try {
      StrKey.decodeContract(address);
      return address;
    } catch {
      throw new GraphQLError(`Invalid ${fieldName}: not a valid Stellar contract address`);
    }
  }

  throw new GraphQLError(`Invalid ${fieldName}: must start with 'G' (account) or 'C' (contract)`);
}

/**
 * Validate pagination limit
 */
export function validateLimit(
  limit: number | undefined | null,
  maxLimit: number = 100,
  defaultLimit: number = 20
): number {
  if (limit === undefined || limit === null) {
    return defaultLimit;
  }

  if (typeof limit !== 'number' || !Number.isInteger(limit)) {
    throw new GraphQLError('Limit must be an integer');
  }

  if (limit < 1) {
    throw new GraphQLError('Limit must be at least 1');
  }

  if (limit > maxLimit) {
    throw new GraphQLError(`Limit cannot exceed ${maxLimit}`);
  }

  return limit;
}

/**
 * Validate pagination offset
 */
export function validateOffset(
  offset: number | undefined | null,
  defaultOffset: number = 0
): number {
  if (offset === undefined || offset === null) {
    return defaultOffset;
  }

  if (typeof offset !== 'number' || !Number.isInteger(offset)) {
    throw new GraphQLError('Offset must be an integer');
  }

  if (offset < 0) {
    throw new GraphQLError('Offset cannot be negative');
  }

  // Prevent extremely large offsets that could cause performance issues
  if (offset > 1000000) {
    throw new GraphQLError('Offset is too large. Use cursor-based pagination for deep pagination.');
  }

  return offset;
}

/**
 * Validate search string (prevent SQL injection patterns)
 */
export function validateSearchString(
  search: string | undefined | null,
  maxLength: number = 100
): string | undefined {
  if (!search) {
    return undefined;
  }

  if (typeof search !== 'string') {
    throw new GraphQLError('Search must be a string');
  }

  // Trim and limit length
  const trimmed = search.trim().slice(0, maxLength);

  // SECURITY: Use allow-list pattern for search input (defense in depth)
  // Only allow alphanumeric, spaces, hyphens, underscores, and dots
  // Prisma uses parameterized queries, but this provides additional protection
  const sanitized = trimmed.replace(/[^a-zA-Z0-9\s\-_.$]/g, '');

  return sanitized || undefined;
}

/**
 * Validate orderBy enum value
 */
export function validateOrderBy(
  orderBy: string | undefined | null,
  allowedValues: string[],
  defaultValue: string
): string {
  if (!orderBy) {
    return defaultValue;
  }

  if (typeof orderBy !== 'string') {
    throw new GraphQLError('OrderBy must be a string');
  }

  const upperOrderBy = orderBy.toUpperCase();

  if (!allowedValues.includes(upperOrderBy)) {
    throw new GraphQLError(
      `Invalid orderBy value: ${orderBy}. Allowed values: ${allowedValues.join(', ')}`
    );
  }

  return upperOrderBy;
}

/**
 * Validate timeframe enum value
 */
export function validateTimeframe(
  timeframe: string | undefined | null,
  defaultValue: string = 'DAY'
): string {
  const allowedTimeframes = ['HOUR', 'DAY', 'WEEK', 'MONTH', 'ALL_TIME'];

  if (!timeframe) {
    return defaultValue;
  }

  if (typeof timeframe !== 'string') {
    throw new GraphQLError('Timeframe must be a string');
  }

  const upperTimeframe = timeframe.toUpperCase();

  if (!allowedTimeframes.includes(upperTimeframe)) {
    throw new GraphQLError(
      `Invalid timeframe: ${timeframe}. Allowed values: ${allowedTimeframes.join(', ')}`
    );
  }

  return upperTimeframe;
}

/**
 * Validate leaderboard type enum value
 */
export function validateLeaderboardType(
  type: string | undefined | null,
  defaultValue: string = 'TRADERS'
): string {
  const allowedTypes = ['TRADERS', 'CREATORS', 'LIQUIDITY_PROVIDERS', 'VIRAL_TOKENS'];

  if (!type) {
    return defaultValue;
  }

  if (typeof type !== 'string') {
    throw new GraphQLError('Type must be a string');
  }

  const upperType = type.toUpperCase();

  if (!allowedTypes.includes(upperType)) {
    throw new GraphQLError(
      `Invalid type: ${type}. Allowed values: ${allowedTypes.join(', ')}`
    );
  }

  return upperType;
}

/**
 * Validate transaction type
 */
export function validateTransactionType(
  type: string | undefined | null
): string | undefined {
  const allowedTypes = ['TOKEN_CREATED', 'TOKEN_BOUGHT', 'TOKEN_SOLD', 'GRADUATED', 'LIQUIDITY_ADDED'];

  if (!type) {
    return undefined;
  }

  if (typeof type !== 'string') {
    throw new GraphQLError('Type must be a string');
  }

  const upperType = type.toUpperCase();

  if (!allowedTypes.includes(upperType)) {
    throw new GraphQLError(
      `Invalid transaction type: ${type}. Allowed values: ${allowedTypes.join(', ')}`
    );
  }

  return upperType;
}

/**
 * Validate bigint string (for amounts)
 * SECURITY: Max length of 80 chars prevents DoS attacks via extremely long strings
 */
const MAX_BIGINT_STRING_LENGTH = 80;

export function validateBigIntString(
  value: string | undefined | null,
  fieldName: string = 'amount',
  min?: bigint,
  max?: bigint
): string | undefined {
  if (!value) {
    return undefined;
  }

  if (typeof value !== 'string') {
    throw new GraphQLError(`${fieldName} must be a string`);
  }

  // SECURITY: Prevent DoS via extremely long number strings
  if (value.length > MAX_BIGINT_STRING_LENGTH) {
    throw new GraphQLError(`${fieldName} exceeds maximum length of ${MAX_BIGINT_STRING_LENGTH} characters`);
  }

  // Check if it's a valid number string
  if (!/^\d+$/.test(value)) {
    throw new GraphQLError(`${fieldName} must be a positive integer string`);
  }

  try {
    const bigIntValue = BigInt(value);

    if (min !== undefined && bigIntValue < min) {
      throw new GraphQLError(`${fieldName} must be at least ${min.toString()}`);
    }

    if (max !== undefined && bigIntValue > max) {
      throw new GraphQLError(`${fieldName} cannot exceed ${max.toString()}`);
    }

    return value;
  } catch (error) {
    if (error instanceof GraphQLError) throw error;
    throw new GraphQLError(`Invalid ${fieldName}: not a valid number`);
  }
}
