/**
 * Asset XDR Creation Utilities for SAC Factory
 *
 * Handles client-side creation and serialization of Stellar Asset XDR
 * following Stellar/Soroban best practices for SAC token deployment.
 */

import { Asset, Keypair, xdr } from '@stellar/stellar-sdk';
import { createHash } from 'crypto';

/**
 * Creates a unique issuer public key for a new token
 *
 * This issuer is deterministic but NOT a funded Stellar account.
 * It's only used as a unique identifier for the SAC token.
 *
 * @param symbol - Token symbol (e.g., "DOGE", "SHIB")
 * @param creator - Creator's Stellar address
 * @param tokenCount - Unique count from contract
 * @param timestamp - Timestamp for uniqueness (defaults to now)
 * @returns Stellar public key (G address)
 */
export function createUniqueIssuer(
  symbol: string,
  creator: string,
  tokenCount: number,
  timestamp: number = Date.now()
): string {
  // Create unique seed from multiple components
  const seedParts = [
    'SAC_ISSUER_V3',         // Version prefix
    tokenCount.toString(),    // Unique count from contract
    timestamp.toString(),     // Timestamp for uniqueness
    symbol,                   // Token symbol
    creator,                  // Creator address
  ];

  // Combine all parts into a single buffer
  const seed = Buffer.concat(
    seedParts.map(part => Buffer.from(part, 'utf-8'))
  );

  // Hash to create 32-byte seed for keypair
  const issuerSeed = createHash('sha256').update(seed).digest();

  // Create deterministic keypair (we only need the public key)
  const keypair = Keypair.fromRawEd25519Seed(issuerSeed);

  return keypair.publicKey();
}

/**
 * Creates a Stellar Asset and serializes it to XDR bytes
 *
 * Stellar automatically chooses:
 * - AlphaNum4 for symbols with 1-4 characters
 * - AlphaNum12 for symbols with 5-12 characters
 *
 * @param symbol - Token symbol (1-12 characters, uppercase)
 * @param issuerPublicKey - Issuer's public key (from createUniqueIssuer)
 * @returns Serialized Asset XDR as Buffer
 */
export function createSerializedAsset(
  symbol: string,
  issuerPublicKey: string
): Buffer {
  // Validate symbol
  if (!symbol || symbol.length === 0 || symbol.length > 12) {
    throw new Error('Symbol must be 1-12 characters');
  }

  // Validate issuer
  if (!issuerPublicKey || !issuerPublicKey.startsWith('G')) {
    throw new Error('Invalid issuer public key');
  }

  // Create the Stellar Asset
  // stellar-sdk automatically chooses AlphaNum4 or AlphaNum12 based on symbol length
  const asset = new Asset(symbol, issuerPublicKey);

  // Convert to XDR object
  const assetXDR = asset.toXDRObject();

  // Serialize to bytes
  const serializedAsset = assetXDR.toXDR();

  return serializedAsset;
}

/**
 * Converts Buffer to Soroban Bytes ScVal
 *
 * @param buffer - Buffer containing serialized Asset XDR
 * @returns ScVal of type Bytes for contract call
 */
export function bufferToSorobanBytes(buffer: Buffer): xdr.ScVal {
  return xdr.ScVal.scvBytes(buffer);
}

/**
 * Validates a token symbol according to Stellar rules
 *
 * @param symbol - Symbol to validate
 * @returns True if valid, false otherwise
 */
export function validateSymbol(symbol: string): boolean {
  // 1-12 characters
  if (!symbol || symbol.length === 0 || symbol.length > 12) {
    return false;
  }

  // Alphanumeric only (uppercase recommended)
  if (!/^[A-Z0-9]+$/.test(symbol)) {
    return false;
  }

  return true;
}

/**
 * Validates a token name
 *
 * @param name - Name to validate
 * @returns True if valid, false otherwise
 */
export function validateName(name: string): boolean {
  // 1-32 characters
  if (!name || name.length === 0 || name.length > 32) {
    return false;
  }

  return true;
}

/**
 * Complete asset creation workflow for launching a token
 *
 * @param params - Token creation parameters
 * @returns Object containing issuer public key and serialized asset ScVal
 */
export interface CreateAssetParams {
  symbol: string;
  creator: string;
  tokenCount: number;
}

export interface AssetCreationResult {
  issuerPublicKey: string;
  serializedAssetScVal: xdr.ScVal;
  serializedAssetBuffer: Buffer;
}

export function createAssetForLaunch(
  params: CreateAssetParams
): AssetCreationResult {
  // Validate inputs
  if (!validateSymbol(params.symbol)) {
    throw new Error(
      'Invalid symbol: must be 1-12 alphanumeric characters (uppercase)'
    );
  }

  // Step 1: Create unique issuer
  const issuerPublicKey = createUniqueIssuer(
    params.symbol,
    params.creator,
    params.tokenCount
  );

  // Step 2: Create and serialize Asset XDR
  const serializedAssetBuffer = createSerializedAsset(
    params.symbol,
    issuerPublicKey
  );

  // Step 3: Convert to Soroban ScVal
  const serializedAssetScVal = bufferToSorobanBytes(serializedAssetBuffer);

  return {
    issuerPublicKey,
    serializedAssetScVal,
    serializedAssetBuffer,
  };
}
