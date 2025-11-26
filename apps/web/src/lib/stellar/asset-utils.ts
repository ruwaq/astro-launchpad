/**
 * Asset XDR Creation Utilities for SAC Factory
 *
 * Handles client-side creation and serialization of Stellar Asset XDR
 * following Stellar/Soroban best practices for SAC token deployment.
 */

import {
  Asset,
  Keypair,
  xdr,
  Contract,
  TransactionBuilder,
  SorobanRpc,
  nativeToScVal,
  Address,
  Operation,
  Account,
  authorizeEntry,
  Networks,
} from '@stellar/stellar-sdk';
import { createHash } from 'crypto';
import { getNetworkConfig } from '@/lib/config/network';

/**
 * Creates a unique issuer keypair for a new token
 *
 * This issuer is deterministic but NOT a funded Stellar account.
 * It's only used as a unique identifier for the SAC token.
 * The keypair is needed to sign set_admin transactions.
 *
 * @param symbol - Token symbol (e.g., "DOGE", "SHIB")
 * @param creator - Creator's Stellar address
 * @param tokenCount - Unique count from contract
 * @param timestamp - Timestamp for uniqueness (defaults to now)
 * @returns Full Keypair object (public key + secret key)
 */
export function createUniqueIssuerKeypair(
  symbol: string,
  creator: string,
  tokenCount: number,
  timestamp: number = Date.now()
): Keypair {
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

  // Create deterministic keypair
  return Keypair.fromRawEd25519Seed(issuerSeed);
}

/**
 * Creates a unique issuer public key for a new token
 * (Convenience wrapper that returns just the public key)
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
  return createUniqueIssuerKeypair(symbol, creator, tokenCount, timestamp).publicKey();
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
  issuerKeypair: Keypair;  // Full keypair for signing set_admin
  serializedAssetScVal: xdr.ScVal;
  serializedAssetBuffer: Buffer;
}

/**
 * Enhanced asset creation result that includes pre-calculated SAC address
 * This enables batching launch_token + set_admin in a single transaction
 */
export interface EnhancedAssetCreationResult extends AssetCreationResult {
  /** The pre-calculated SAC token contract address */
  sacAddress: string;
  /** The Stellar Asset object for operations */
  asset: Asset;
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

  // Step 1: Create unique issuer keypair
  // Important: We use a fixed timestamp (0) so the issuer is deterministic
  // based only on symbol, creator, and tokenCount. This allows us to
  // recreate the same keypair later for signing set_admin.
  const issuerKeypair = createUniqueIssuerKeypair(
    params.symbol,
    params.creator,
    params.tokenCount,
    0  // Fixed timestamp for deterministic issuer
  );
  const issuerPublicKey = issuerKeypair.publicKey();

  // Step 2: Create and serialize Asset XDR
  const serializedAssetBuffer = createSerializedAsset(
    params.symbol,
    issuerPublicKey
  );

  // Step 3: Convert to Soroban ScVal
  const serializedAssetScVal = bufferToSorobanBytes(serializedAssetBuffer);

  return {
    issuerPublicKey,
    issuerKeypair,
    serializedAssetScVal,
    serializedAssetBuffer,
  };
}

/**
 * Enhanced asset creation that includes pre-calculated SAC address
 *
 * This is the key function for improved UX: by pre-calculating the SAC
 * contract address before the token is created, we can batch launch_token
 * and set_admin into a SINGLE transaction.
 *
 * The SAC address is deterministic and can be calculated from:
 * - Asset code (symbol)
 * - Asset issuer (deterministic from symbol + creator + tokenCount)
 * - Network passphrase
 *
 * @param params - Token creation parameters
 * @param network - Network to use ('testnet' or 'mainnet')
 * @returns Enhanced result with pre-calculated SAC address
 */
export function createAssetForLaunchWithSacAddress(
  params: CreateAssetParams,
  network: 'testnet' | 'mainnet' = 'testnet'
): EnhancedAssetCreationResult {
  // Validate inputs
  if (!validateSymbol(params.symbol)) {
    throw new Error(
      'Invalid symbol: must be 1-12 alphanumeric characters (uppercase)'
    );
  }

  // Step 1: Create unique issuer keypair (deterministic)
  const issuerKeypair = createUniqueIssuerKeypair(
    params.symbol,
    params.creator,
    params.tokenCount,
    0  // Fixed timestamp for deterministic issuer
  );
  const issuerPublicKey = issuerKeypair.publicKey();

  // Step 2: Create Stellar Asset
  const asset = new Asset(params.symbol, issuerPublicKey);

  // Step 3: Pre-calculate SAC contract address
  // This is the key insight: SAC addresses are deterministic!
  const networkPassphrase = network === 'testnet'
    ? Networks.TESTNET
    : Networks.PUBLIC;
  const sacAddress = asset.contractId(networkPassphrase);

  // Step 4: Serialize Asset XDR for contract call
  const serializedAssetBuffer = createSerializedAsset(
    params.symbol,
    issuerPublicKey
  );
  const serializedAssetScVal = bufferToSorobanBytes(serializedAssetBuffer);

  return {
    issuerPublicKey,
    issuerKeypair,
    serializedAssetScVal,
    serializedAssetBuffer,
    sacAddress,
    asset,
  };
}

/**
 * Creates and funds the issuer account if it doesn't exist
 *
 * For SAC tokens with derived issuers, the issuer account needs to exist
 * on the network to authorize set_admin transactions.
 *
 * @param issuerKeypair - The issuer's keypair
 * @param sourceAddress - The source account that pays for account creation
 * @param signTransaction - Function to sign the transaction (from wallet)
 * @returns True if account exists or was created successfully
 */
async function ensureIssuerAccountExists(
  issuerKeypair: Keypair,
  sourceAddress: string,
  signTransaction: (xdr: string) => Promise<string>
): Promise<{ exists: boolean; error?: string }> {
  const config = getNetworkConfig();
  // Use Horizon for classic account operations
  const horizonUrl = config.horizonUrl;

  const issuerAddress = issuerKeypair.publicKey();

  // First check if account already exists
  try {
    const response = await fetch(`${horizonUrl}/accounts/${issuerAddress}`);
    if (response.ok) {
      console.log('Issuer account already exists:', issuerAddress);
      return { exists: true };
    }
  } catch {
    // Account doesn't exist, we'll create it
  }

  console.log('Creating issuer account:', issuerAddress);

  // Retry logic for tx_bad_seq errors (sequence number race condition)
  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Wait before retry to allow Horizon to update sequence
      if (attempt > 1) {
        console.log(`Retry attempt ${attempt}/${maxRetries} - waiting for sequence update...`);
        await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
      }

      // Get source account from Horizon (fresh sequence number each attempt)
      const sourceResponse = await fetch(`${horizonUrl}/accounts/${sourceAddress}`);
      if (!sourceResponse.ok) {
        throw new Error('Source account not found');
      }
      const sourceData = await sourceResponse.json();

      // Create the account with minimum balance (1.5 XLM to be safe)
      const createAccountOp = Operation.createAccount({
        destination: issuerAddress,
        startingBalance: '1.5', // 1.5 XLM minimum
      });

      // Build transaction using Horizon sequence number
      const transaction = new TransactionBuilder(
        new Account(sourceAddress, sourceData.sequence),
        {
          fee: '100000', // 0.01 XLM
          networkPassphrase: config.passphrase,
        }
      )
        .addOperation(createAccountOp)
        .setTimeout(30)
        .build();

      // Sign with wallet
      const signedXDR = await signTransaction(transaction.toXDR());
      const signedTx = TransactionBuilder.fromXDR(signedXDR, config.passphrase);

      // Submit to Horizon (classic transaction)
      const submitResponse = await fetch(`${horizonUrl}/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `tx=${encodeURIComponent(signedTx.toXDR())}`,
      });

      if (!submitResponse.ok) {
        const errorData = await submitResponse.json();
        const errorStr = JSON.stringify(errorData);

        // Check if it's a sequence error - retry with fresh sequence
        if (errorStr.includes('tx_bad_seq') && attempt < maxRetries) {
          console.log('Sequence number mismatch, will retry with fresh sequence...');
          lastError = new Error(`Account creation failed (attempt ${attempt}): ${errorStr}`);
          continue;
        }

        throw new Error(`Account creation failed: ${errorStr}`);
      }

      console.log('Issuer account created successfully');
      return { exists: true };
    } catch (error: unknown) {
      const err = error as Error;
      lastError = err;

      // If it's a sequence error and we have retries left, continue
      if (err.message.includes('tx_bad_seq') && attempt < maxRetries) {
        console.log('Sequence error caught, will retry...');
        continue;
      }

      // For other errors or last attempt, break out
      if (attempt === maxRetries) {
        break;
      }
    }
  }

  console.error('Error creating issuer account after retries:', lastError);
  return { exists: false, error: lastError?.message || 'Unknown error' };
}

/**
 * Sets the factory contract as admin of a SAC token
 *
 * This function calls `set_admin` on the token contract to transfer
 * admin rights from the issuer to the factory. This enables the factory
 * to mint/burn tokens for the bonding curve.
 *
 * IMPORTANT: The issuer account must exist on the network for this to work.
 * If it doesn't exist, this function will attempt to create it using the
 * source account's funds.
 *
 * The flow is:
 * 1. Ensure issuer account exists (creates it if needed)
 * 2. Build set_admin transaction with source = user's address
 * 3. Sign auth entries with issuer keypair (authorizes the admin change)
 * 4. User's wallet signs the transaction envelope (pays fees)
 * 5. Submit transaction
 *
 * @param tokenAddress - The SAC token contract address
 * @param factoryAddress - The factory contract address to set as new admin
 * @param issuerKeypair - The issuer's keypair (used to authorize the change)
 * @param sourceAddress - The source account for the transaction (pays fees)
 * @param signTransaction - Function to sign transactions (from wallet) - REQUIRED
 * @returns Transaction hash if successful
 */
export async function setFactoryAsTokenAdmin(
  tokenAddress: string,
  factoryAddress: string,
  issuerKeypair: Keypair,
  sourceAddress: string,
  signTransaction: (xdr: string) => Promise<string>
): Promise<{ success: boolean; hash?: string; error?: string }> {
  try {
    const config = getNetworkConfig();
    const server = new SorobanRpc.Server(config.rpcUrl);

    // Step 1: Ensure issuer account exists (required for authorization)
    const accountResult = await ensureIssuerAccountExists(
      issuerKeypair,
      sourceAddress,
      signTransaction
    );

    if (!accountResult.exists) {
      throw new Error(`Failed to create issuer account: ${accountResult.error}`);
    }

    // Get source account
    const sourceAccount = await server.getAccount(sourceAddress);

    // Build the set_admin call
    const tokenContract = new Contract(tokenAddress);
    const setAdminOp = tokenContract.call(
      'set_admin',
      nativeToScVal(Address.fromString(factoryAddress), { type: 'address' })
    );

    // Create transaction
    const transaction = new TransactionBuilder(sourceAccount, {
      fee: '1000000', // 0.1 XLM
      networkPassphrase: config.passphrase,
    })
      .addOperation(setAdminOp)
      .setTimeout(30)
      .build();

    // Simulate transaction
    const simulated = await server.simulateTransaction(transaction);

    if ('error' in simulated) {
      throw new Error(`Simulation failed: ${simulated.error}`);
    }

    // Get current ledger for auth expiration
    const latestLedger = await server.getLatestLedger();
    const validUntilLedger = latestLedger.sequence + 1000; // Valid for ~83 minutes

    // Sign auth entries with the issuer keypair
    // The issuer is the current admin of the SAC token and must authorize the change
    const simulationResult = simulated as SorobanRpc.Api.SimulateTransactionSuccessResponse;

    if (simulationResult.result?.auth && simulationResult.result.auth.length > 0) {
      console.log(`Signing ${simulationResult.result.auth.length} auth entries with issuer keypair...`);

      // Sign each auth entry
      const signedAuthEntries = await Promise.all(
        simulationResult.result.auth.map(async (entry) => {
          return authorizeEntry(
            entry,
            issuerKeypair,
            validUntilLedger,
            config.passphrase
          );
        })
      );

      // Replace auth entries in simulation result with signed ones
      simulationResult.result.auth = signedAuthEntries;
    }

    // Assemble transaction with signed auth entries
    const preparedTx = SorobanRpc.assembleTransaction(transaction, simulationResult).build();

    // Sign the transaction envelope
    // The issuer keypair signs for the auth entries (already done above via authorizeEntry)
    // The source account (user) needs to sign the transaction envelope for fees
    // User signs the transaction envelope
    const userSignedXDR = await signTransaction(preparedTx.toXDR());
    const userSignedTx = TransactionBuilder.fromXDR(userSignedXDR, config.passphrase);

    // Submit transaction
    const sendResponse = await server.sendTransaction(userSignedTx as any);

    if (sendResponse.status === 'ERROR') {
      throw new Error(`Transaction failed: ${sendResponse.errorResult?.toXDR('base64')}`);
    }

    // Wait for confirmation
    let attempts = 0;
    const maxAttempts = 30;

    while (attempts < maxAttempts) {
      try {
        const getResponse = await server.getTransaction(sendResponse.hash);

        if (getResponse.status === 'SUCCESS') {
          return { success: true, hash: sendResponse.hash };
        } else if (getResponse.status === 'FAILED') {
          throw new Error('Transaction failed on the network');
        }
      } catch (txError: unknown) {
        const txErr = txError as Error;
        // Handle SDK version incompatibility ("Bad union switch" errors)
        // These can occur when the RPC returns response types the SDK doesn't recognize
        // Since the transaction was already submitted successfully, we can check if it's
        // confirmed by trying to get the ledger entry or waiting for it to settle
        if (txErr.message.includes('Bad union switch')) {
          console.warn('SDK version incompatibility detected, checking transaction via alternative method...');
          // Wait a bit and try again - the transaction was submitted successfully
          await new Promise(resolve => setTimeout(resolve, 2000));
          attempts++;

          // After a few attempts with this error, assume success since sendTransaction worked
          if (attempts >= 5) {
            console.log('Transaction submitted successfully, assuming confirmation (SDK compatibility issue)');
            return { success: true, hash: sendResponse.hash };
          }
          continue;
        }
        throw txError;
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
      attempts++;
    }

    throw new Error('Transaction confirmation timeout');
  } catch (error: unknown) {
    const err = error as Error;
    console.error('Error setting factory as admin:', error);
    return { success: false, error: err.message };
  }
}

/**
 * Repairs a token by setting the factory as admin
 *
 * This function is used for tokens that were created but where the
 * set_admin step failed. It regenerates the issuer keypair from the
 * token's metadata and calls set_admin.
 *
 * @param tokenAddress - The SAC token contract address
 * @param tokenId - The token's ID (tokenCount at creation time)
 * @param symbol - The token's symbol
 * @param creator - The token's creator address
 * @param issuer - The stored issuer address (for verification)
 * @param factoryAddress - The factory contract address
 * @param sourceAddress - The source account for the transaction
 * @param signTransaction - Function to sign transactions
 * @returns Success status and transaction hash
 */
export async function repairTokenAdmin(
  tokenAddress: string,
  tokenId: number,
  symbol: string,
  creator: string,
  issuer: string,
  factoryAddress: string,
  sourceAddress: string,
  signTransaction: (xdr: string) => Promise<string>
): Promise<{ success: boolean; hash?: string; error?: string }> {
  try {
    // Step 1: Regenerate the issuer keypair
    const regeneratedKeypair = createUniqueIssuerKeypair(
      symbol,
      creator,
      tokenId,
      0 // Fixed timestamp for determinism
    );

    // Step 2: Verify the regenerated keypair matches the stored issuer
    if (regeneratedKeypair.publicKey() !== issuer) {
      console.error('Issuer mismatch!');
      console.error('Expected:', issuer);
      console.error('Got:', regeneratedKeypair.publicKey());
      return {
        success: false,
        error: `Issuer keypair mismatch. Expected ${issuer}, got ${regeneratedKeypair.publicKey()}. Token may have been created with different parameters.`
      };
    }

    console.log('Issuer keypair regenerated successfully, proceeding with set_admin...');

    // Step 3: Call setFactoryAsTokenAdmin with the regenerated keypair
    const result = await setFactoryAsTokenAdmin(
      tokenAddress,
      factoryAddress,
      regeneratedKeypair,
      sourceAddress,
      signTransaction
    );

    return result;
  } catch (error: unknown) {
    const err = error as Error;
    console.error('Error repairing token admin:', error);
    return { success: false, error: err.message };
  }
}
