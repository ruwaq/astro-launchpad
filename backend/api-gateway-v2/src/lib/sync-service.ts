/**
 * Token Synchronization Service
 *
 * Provides robust token synchronization from Stellar blockchain to PostgreSQL.
 * Designed to be modular, scalable, and fault-tolerant.
 *
 * Features:
 * - Reads token data directly from SAC Factory contract
 * - Handles errors gracefully with retries
 * - Idempotent - safe to call multiple times
 * - Caches RPC connections for performance
 */

import { SorobanRpc, Contract, Address, scValToNative, TransactionBuilder, Account } from '@stellar/stellar-sdk';
import { randomUUID } from 'crypto';
import type { PrismaClient } from '@prisma/client';

// ============================================================================
// Configuration
// ============================================================================

// IMPORTANT: Use the ACTIVE testnet contract ID as default (V7 - Dec 3, 2024 - pump.fun style, 30k XLM graduation)
const CONTRACT_ID = process.env.TOKEN_FACTORY_CONTRACT_ID || 'CBNQZ3NE5CUAZVDTI34FGMABOV26EOHGCVXU5F7KLRFSGMC33W7U225Z';
const RPC_URL = process.env.STELLAR_RPC_URL || 'https://soroban-testnet.stellar.org';
const NETWORK_PASSPHRASE = process.env.STELLAR_NETWORK_PASSPHRASE || 'Test SDF Network ; September 2015';

// Log the contract being used at startup
console.log(`[SyncService] Using contract ID: ${CONTRACT_ID}`);

// RPC connection - can be cached
let serverInstance: SorobanRpc.Server | null = null;
// Contract instance - recreated each time to ensure correct CONTRACT_ID is used
let cachedContractId: string | null = null;
let contractInstance: Contract | null = null;

function getServer(): SorobanRpc.Server {
  if (!serverInstance) {
    serverInstance = new SorobanRpc.Server(RPC_URL);
  }
  return serverInstance;
}

function getContract(): Contract {
  // Recreate contract if CONTRACT_ID changed (hot reload support)
  const currentContractId = process.env.TOKEN_FACTORY_CONTRACT_ID || CONTRACT_ID;
  if (!contractInstance || cachedContractId !== currentContractId) {
    console.log(`[SyncService] Creating contract instance for: ${currentContractId}`);
    contractInstance = new Contract(currentContractId);
    cachedContractId = currentContractId;
  }
  return contractInstance;
}

// ============================================================================
// Types
// ============================================================================

export interface TokenInfo {
  name: string;
  symbol: string;
  creator: string;
  total_supply?: string;
  circulating_supply?: string;
  xlm_reserve?: string;
  xlm_raised?: string;
  graduated?: boolean;
  current_price?: string;
  market_cap?: string;
  image_url?: string;
  description?: string;
  created_at?: number;
}

/**
 * Social links parsed from embedded metadata
 */
export interface SocialLinks {
  website?: string;
  telegram?: string;
  twitter?: string;
  discord?: string;
}

/**
 * Parse embedded metadata from description
 * Format: "Description text\n\n---METADATA---\n{json}"
 */
function parseEmbeddedMetadata(description: string): { cleanDescription: string; socialLinks: SocialLinks } {
  const defaultResult = { cleanDescription: description, socialLinks: {} };

  if (!description) return defaultResult;

  const metadataSeparator = '---METADATA---';
  const separatorIndex = description.indexOf(metadataSeparator);

  if (separatorIndex === -1) return defaultResult;

  // Split into description and metadata
  const cleanDescription = description.substring(0, separatorIndex).trim();
  const metadataJson = description.substring(separatorIndex + metadataSeparator.length).trim();

  try {
    const metadata = JSON.parse(metadataJson);
    const socialLinks: SocialLinks = {};

    if (metadata.social) {
      if (metadata.social.website) socialLinks.website = metadata.social.website;
      if (metadata.social.telegram) socialLinks.telegram = metadata.social.telegram;
      if (metadata.social.twitter) socialLinks.twitter = metadata.social.twitter;
      if (metadata.social.discord) socialLinks.discord = metadata.social.discord;
    }

    console.log(`[SyncService] Parsed social links:`, socialLinks);
    return { cleanDescription, socialLinks };
  } catch (error) {
    console.warn(`[SyncService] Failed to parse embedded metadata:`, error);
    return defaultResult;
  }
}

export interface SyncResult {
  success: boolean;
  tokenAddress: string;
  message: string;
  token?: any;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * PERFORMANCE: Default timeout for contract calls (30 seconds)
 * Prevents hanging requests if RPC is slow/unresponsive
 */
const CONTRACT_CALL_TIMEOUT_MS = 30000;

/**
 * Execute a promise with a timeout
 * @throws Error if timeout is exceeded
 */
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operationName: string
): Promise<T> {
  let timeoutId: NodeJS.Timeout;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`Operation '${operationName}' timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutId!);
    return result;
  } catch (error) {
    clearTimeout(timeoutId!);
    throw error;
  }
}

/**
 * Retry a function with exponential backoff
 */
async function retry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  delayMs = 1000
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, delayMs * Math.pow(2, i)));
    }
  }
  throw new Error('Max retries exceeded');
}

/**
 * Call contract read-only method with proper error handling and timeout
 * PERFORMANCE: Added timeout to prevent hanging requests
 */
async function callContractMethod(method: string, ...params: any[]): Promise<any> {
  return retry(async () => {
    const server = getServer();
    const contract = getContract();

    const operation = contract.call(method, ...params);

    // Build the transaction for simulation
    const tx = new TransactionBuilder(
      new Account(
        'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
        '0'
      ),
      {
        fee: '100',
        networkPassphrase: NETWORK_PASSPHRASE,
      }
    )
      .addOperation(operation as any)
      .setTimeout(30)
      .build() as any;

    // PERFORMANCE: Execute simulation with timeout to prevent hanging
    const simulationResponse = await withTimeout(
      server.simulateTransaction(tx),
      CONTRACT_CALL_TIMEOUT_MS,
      `contract.${method}`
    );

    if (SorobanRpc.Api.isSimulationSuccess(simulationResponse)) {
      if (simulationResponse.result?.retval) {
        return scValToNative(simulationResponse.result.retval);
      }
    }

    throw new Error(`Contract call failed: ${method}`);
  });
}

/**
 * Validate TokenInfo response from contract
 * Ensures required fields are present and valid
 */
function validateTokenInfo(info: any): info is TokenInfo {
  if (!info || typeof info !== 'object') {
    console.error('[SyncService] TokenInfo is null or not an object');
    return false;
  }

  const requiredFields = ['name', 'symbol', 'creator'];
  const missingFields = requiredFields.filter(field => !info[field]);

  if (missingFields.length > 0) {
    console.error(`[SyncService] TokenInfo missing required fields: ${missingFields.join(', ')}`);
    return false;
  }

  // Validate creator is a valid Stellar address
  if (typeof info.creator !== 'string' || info.creator.length !== 56 || !info.creator.startsWith('G')) {
    console.error(`[SyncService] Invalid creator address: ${info.creator}`);
    return false;
  }

  return true;
}

/**
 * Get token info from contract with extended retry for race conditions
 * New tokens may not be immediately visible in RPC after creation
 */
async function getTokenInfoFromContract(tokenAddress: string): Promise<TokenInfo | null> {
  // First attempt with standard retry
  try {
    const address = Address.fromString(tokenAddress).toScVal();
    const info = await callContractMethod('get_token_info', address);

    if (validateTokenInfo(info)) {
      return info;
    }

    console.warn(`[SyncService] Token info validation failed for ${tokenAddress}`);
    return null;
  } catch (error: any) {
    console.warn(`[SyncService] First attempt failed for ${tokenAddress}: ${error.message}`);
  }

  // Extended retry for newly created tokens (race condition fix)
  // Wait progressively longer as RPC might need time to index
  console.log(`[SyncService] Attempting extended retry for newly created token...`);

  const extendedRetries = 5;
  const baseDelay = 2000; // 2 seconds

  for (let attempt = 0; attempt < extendedRetries; attempt++) {
    const delay = baseDelay * (attempt + 1); // 2s, 4s, 6s, 8s, 10s
    console.log(`[SyncService] Retry ${attempt + 1}/${extendedRetries} after ${delay}ms...`);

    await new Promise(resolve => setTimeout(resolve, delay));

    try {
      const address = Address.fromString(tokenAddress).toScVal();
      const info = await callContractMethod('get_token_info', address);

      if (validateTokenInfo(info)) {
        console.log(`[SyncService] Token found on retry ${attempt + 1}`);
        return info;
      }
    } catch (error: any) {
      console.warn(`[SyncService] Retry ${attempt + 1} failed: ${error.message}`);
    }
  }

  console.error(`[SyncService] All retries exhausted for token ${tokenAddress}`);
  return null;
}

// ============================================================================
// Main Sync Functions
// ============================================================================

/**
 * Sync a single token from blockchain to database
 * This is the main function called by the GraphQL mutation
 */
export async function syncTokenToDatabase(
  tokenAddress: string,
  prisma: PrismaClient
): Promise<SyncResult> {
  console.log(`[SyncService] Syncing token: ${tokenAddress}`);

  try {
    // Step 1: Get token info from contract
    const tokenInfo = await getTokenInfoFromContract(tokenAddress);

    if (!tokenInfo) {
      // Token might not exist in contract yet, or contract call failed
      // Check if it exists in DB already
      const existingToken = await prisma.token.findUnique({
        where: { address: tokenAddress }
      });

      if (existingToken) {
        return {
          success: true,
          tokenAddress,
          message: 'Token already exists in database',
          token: existingToken
        };
      }

      return {
        success: false,
        tokenAddress,
        message: 'Token not found in contract. It may not exist or contract call failed.'
      };
    }

    console.log(`[SyncService] Token info: ${tokenInfo.name} (${tokenInfo.symbol})`);

    // Step 2: Parse embedded metadata from description (social links)
    const { cleanDescription, socialLinks } = parseEmbeddedMetadata(tokenInfo.description || '');

    // Step 3: Prepare token data
    const tokenData = {
      address: tokenAddress,
      creator: tokenInfo.creator,
      name: tokenInfo.name,
      symbol: tokenInfo.symbol,
      decimals: 7,
      totalSupply: tokenInfo.total_supply?.toString() || '1000000000000000',
      metadataUri: tokenInfo.image_url || '',
      imageUrl: tokenInfo.image_url || null,
      description: cleanDescription || `${tokenInfo.name} token on Stellar`,

      // Social links (parsed from embedded metadata)
      website: socialLinks.website || null,
      telegram: socialLinks.telegram || null,
      twitter: socialLinks.twitter || null,
      discord: socialLinks.discord || null,

      // Bonding curve data
      circulatingSupply: tokenInfo.circulating_supply?.toString() || '0',
      xlmReserve: tokenInfo.xlm_reserve?.toString() || '0',
      graduated: tokenInfo.graduated || false,
      xlmRaised: tokenInfo.xlm_raised?.toString() || '0',

      // Market data
      marketCap: tokenInfo.market_cap?.toString() || '0',
      currentPrice: tokenInfo.current_price?.toString() || '0',
      priceChange24h: 0,
      volume24h: '0',
      volume7d: '0',
      holders: 1,

      createdAt: tokenInfo.created_at ? new Date(Number(tokenInfo.created_at) * 1000) : new Date(),
      updatedAt: new Date(),
    };

    // CRITICAL: Use Prisma interactive transaction for atomic operations
    // This ensures all-or-nothing behavior - if any operation fails, all are rolled back
    const token = await prisma.$transaction(async (tx) => {
      // Step 4: Upsert token (insert or update)
      const upsertedToken = await tx.token.upsert({
        where: { address: tokenAddress },
        update: {
          ...tokenData,
          // Don't overwrite createdAt on update
          createdAt: undefined,
        },
        create: tokenData,
      });

      // Step 5: Ensure creator exists as user
      await tx.user.upsert({
        where: { address: tokenInfo.creator },
        update: {},
        create: {
          address: tokenInfo.creator,
          points: 0,
          level: 1,
          referrals: 0,
          tokensCreatedCount: 1,
          totalVolumeTraded: '0',
          totalLiquidityProvided: '0',
        },
      });

      // Step 6: Record transaction if it's a new token
      const existingTx = await tx.transaction.findFirst({
        where: {
          tokenAddress,
          type: 'TOKEN_CREATED'
        }
      });

      if (!existingTx) {
        // Use cryptographically secure UUID to prevent hash collisions
        const uniqueId = randomUUID();
        await tx.transaction.create({
          data: {
            hash: `create_${tokenAddress}_${uniqueId}`,
            type: 'TOKEN_CREATED',
            from: tokenInfo.creator,
            tokenAddress,
            amount: '0',
            status: 'SUCCESS',
            timestamp: upsertedToken.createdAt,
          }
        });
      }

      return upsertedToken;
    }, {
      // Transaction options for robustness
      maxWait: 5000, // Max time to wait for transaction slot
      timeout: 10000, // Max time for transaction to complete
    });

    console.log(`[SyncService] Successfully synced token: ${tokenInfo.name}`);

    return {
      success: true,
      tokenAddress,
      message: `Token ${tokenInfo.name} synced successfully`,
      token
    };

  } catch (error: any) {
    console.error(`[SyncService] Error syncing token ${tokenAddress}:`, error);
    return {
      success: false,
      tokenAddress,
      message: `Sync failed: ${error.message}`
    };
  }
}

/**
 * Sync all tokens from contract events (batch operation)
 * Use this for initial sync or catching up
 */
export async function syncAllTokensFromContract(
  prisma: PrismaClient
): Promise<{ synced: number; failed: number; total: number }> {
  console.log('[SyncService] Starting full token sync...');

  const server = getServer();
  const tokenAddresses = new Set<string>();

  try {
    // Get token addresses from contract events
    const latestLedger = await server.getLatestLedger();
    const endLedger = latestLedger.sequence;
    const startLedger = Math.max(endLedger - 120000, 0);

    const events = await server.getEvents({
      startLedger,
      filters: [
        {
          type: 'contract',
          contractIds: [CONTRACT_ID],
          topics: [['*']]
        }
      ],
      limit: 10000
    });

    if (events.events) {
      for (const event of events.events) {
        try {
          const eventData = scValToNative(event.value);
          if (eventData?.token_address) {
            tokenAddresses.add(eventData.token_address);
          } else if (eventData?.token) {
            tokenAddresses.add(eventData.token);
          } else if (typeof eventData === 'string' && eventData.startsWith('C')) {
            tokenAddresses.add(eventData);
          }
        } catch {
          // Silent fail for individual event parsing
        }
      }
    }

    console.log(`[SyncService] Found ${tokenAddresses.size} tokens from events`);

  } catch (error: any) {
    console.warn('[SyncService] Could not fetch events:', error.message);
  }

  // Sync each token
  let synced = 0;
  let failed = 0;

  for (const address of tokenAddresses) {
    const result = await syncTokenToDatabase(address, prisma);
    if (result.success) {
      synced++;
    } else {
      failed++;
    }
  }

  console.log(`[SyncService] Sync complete: ${synced} synced, ${failed} failed, ${tokenAddresses.size} total`);

  return {
    synced,
    failed,
    total: tokenAddresses.size
  };
}

/**
 * Get token count from contract
 */
export async function getContractTokenCount(): Promise<number> {
  try {
    const count = await callContractMethod('get_token_count');
    return typeof count === 'number' ? count : 0;
  } catch {
    return 0;
  }
}
