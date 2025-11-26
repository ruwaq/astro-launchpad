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
import type { PrismaClient } from '@prisma/client';

// ============================================================================
// Configuration
// ============================================================================

// IMPORTANT: Use the ACTIVE testnet contract ID as default
const CONTRACT_ID = process.env.TOKEN_FACTORY_CONTRACT_ID || 'CDAGI666QPS2QU4RVUXW4WFHABETECXQVJVFNTAJJJCGS36XX6R3AWSC';
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
 * Call contract read-only method with proper error handling
 */
async function callContractMethod(method: string, ...params: any[]): Promise<any> {
  return retry(async () => {
    const server = getServer();
    const contract = getContract();

    const operation = contract.call(method, ...params);

    const simulationResponse = await server.simulateTransaction(
      new TransactionBuilder(
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
        .build() as any
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
 * Get token info from contract
 */
async function getTokenInfoFromContract(tokenAddress: string): Promise<TokenInfo | null> {
  try {
    const address = Address.fromString(tokenAddress).toScVal();
    const info = await callContractMethod('get_token_info', address);
    return info;
  } catch (error: any) {
    console.error(`[SyncService] Failed to get info for token ${tokenAddress}:`, error.message);
    return null;
  }
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

    // Step 2: Prepare token data
    const tokenData = {
      address: tokenAddress,
      creator: tokenInfo.creator,
      name: tokenInfo.name,
      symbol: tokenInfo.symbol,
      decimals: 7,
      totalSupply: tokenInfo.total_supply?.toString() || '1000000000000000',
      metadataUri: tokenInfo.image_url || '',
      imageUrl: tokenInfo.image_url || null,
      description: tokenInfo.description || `${tokenInfo.name} token on Stellar`,

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

    // Step 3: Upsert token (insert or update)
    const token = await prisma.token.upsert({
      where: { address: tokenAddress },
      update: {
        ...tokenData,
        // Don't overwrite createdAt on update
        createdAt: undefined,
      },
      create: tokenData,
    });

    // Step 4: Ensure creator exists as user
    await prisma.user.upsert({
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

    // Step 5: Record transaction if it's a new token
    const existingTx = await prisma.transaction.findFirst({
      where: {
        tokenAddress,
        type: 'TOKEN_CREATED'
      }
    });

    if (!existingTx) {
      await prisma.transaction.create({
        data: {
          hash: `create_${tokenAddress}_${Date.now()}`,
          type: 'TOKEN_CREATED',
          from: tokenInfo.creator,
          tokenAddress,
          amount: '0',
          status: 'SUCCESS',
          timestamp: token.createdAt,
        }
      });
    }

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
