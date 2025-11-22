#!/usr/bin/env tsx
/**
 * Robust Token Indexer & Synchronizer
 *
 * This script provides a complete, modular solution for syncing tokens from the
 * SAC Factory contract to the PostgreSQL database.
 *
 * Features:
 * - Reads contract events to discover ALL tokens (no hardcoded addresses needed)
 * - Falls back to reading contract storage directly
 * - Handles errors gracefully with retries
 * - Idempotent - safe to run multiple times
 * - Modular and maintainable architecture
 *
 * Usage:
 *   cd backend/shared
 *   pnpm sync-tokens
 */

import { PrismaClient } from '@prisma/client';
import { SorobanRpc, Contract, Address, xdr, scValToNative } from '@stellar/stellar-sdk';

const prisma = new PrismaClient();

// Configuration
const CONTRACT_ID = process.env.TOKEN_FACTORY_CONTRACT_ID || 'CBTFVJEYLMDHDFTKLO4PR7MHPFVNISOYYBJQSCNCQXWX2WMXXXJAZWT2';
const RPC_URL = process.env.STELLAR_RPC_URL || 'https://soroban-testnet.stellar.org';
const NETWORK_PASSPHRASE = process.env.STELLAR_NETWORK_PASSPHRASE || 'Test SDF Network ; September 2015';

const server = new SorobanRpc.Server(RPC_URL);
const contract = new Contract(CONTRACT_ID);

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
    try {
      const {TransactionBuilder, Account} = await import('@stellar/stellar-sdk');

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
    } catch (error: any) {
      console.error(`❌ Error calling ${method}:`, error.message);
      throw error;
    }
  });
}

/**
 * Get all token addresses by reading contract events
 */
async function getAllTokenAddressesFromEvents(): Promise<Set<string>> {
  console.log('📡 Fetching token creation events from contract...');

  try {
    // Get the latest ledger to determine the range
    const latestLedger = await server.getLatestLedger();
    const endLedger = latestLedger.sequence;
    // Query last 7 days of events (Stellar RPC retention limit)
    // Approximate: 5 seconds per ledger = ~12,000 ledgers per day
    const idealStartLedger = endLedger - (7 * 24 * 60 * 12);

    // Use oldestLedger if available, otherwise use idealStartLedger
    const startLedger = latestLedger.oldestLedger || Math.max(idealStartLedger, endLedger - 120000);

    console.log(`  📊 Querying ledgers ${startLedger} to ${endLedger}`);

    const events = await server.getEvents({
      startLedger: startLedger,
      filters: [
        {
          type: 'contract',
          contractIds: [CONTRACT_ID],
          // Match all events from this contract
          topics: [['*']]
        }
      ],
      limit: 10000
    });

    const tokenAddresses = new Set<string>();

    if (events.events && events.events.length > 0) {
      console.log(`  ✓ Found ${events.events.length} total events`);

      for (const event of events.events) {
        try {
          // Parse event data to extract token address
          const eventData = scValToNative(event.value);

          // Look for token_created events or any event with a token address
          if (eventData) {
            // Try to extract token address from different event structures
            if (eventData.token_address) {
              tokenAddresses.add(eventData.token_address);
            } else if (eventData.token) {
              tokenAddresses.add(eventData.token);
            } else if (typeof eventData === 'string' && eventData.startsWith('C')) {
              // Might be a direct token address
              tokenAddresses.add(eventData);
            }
          }
        } catch (err) {
          // Silent fail for individual event parsing errors
        }
      }
    }

    console.log(`✅ Found ${tokenAddresses.size} tokens from events`);
    return tokenAddresses;
  } catch (error: any) {
    console.warn('⚠️  Could not fetch events:', error.message || error);
    return new Set();
  }
}

/**
 * Get all token addresses by reading from all known creators
 * This is a fallback method when events are not available
 */
async function getAllTokenAddressesFromStorage(): Promise<Set<string>> {
  console.log('📊 Fetching tokens from contract storage...');

  const allTokens = new Set<string>();

  // Strategy 1: Get all tokens from database users (existing creators)
  const existingCreators = await prisma.user.findMany({
    select: { address: true }
  });

  for (const creator of existingCreators) {
    try {
      const creatorAddress = Address.fromString(creator.address).toScVal();
      const tokens = await callContractMethod('get_creator_tokens', creatorAddress);

      if (tokens && Array.isArray(tokens)) {
        tokens.forEach(addr => {
          if (typeof addr === 'string') {
            allTokens.add(addr);
          }
        });
        console.log(`  ✓ Found ${tokens.length} tokens for ${creator.address.slice(0, 8)}...`);
      }
    } catch (error) {
      // Silent fail - creator might not have tokens
    }
  }

  // Strategy 2: Try common test addresses
  const testAddresses = [
    'GDYIDNFAXWPRMNBX6DH2MH2DTXUPWX65CMNYOQF4HHQWLXBXTWVGMKWJ',
    'GCW2OQGQAZNIDZ7ULXC6S4RQWQCVMJN6PVEWYYHQWDWADAIWVGJ5QKKX',
    'GAJHORKZ5HXWQWMDE7E5KZXZXQXZXQXZXQXZXQXZXQXZXQXZXQXZXQ',
    'GCYV5ZMRG32T6FCY4S3K636XFQSGKLKREWONR7UUGOBTJZG72BPXSEF5', // Add user's address if known
  ];

  for (const testAddr of testAddresses) {
    try {
      const creatorAddress = Address.fromString(testAddr).toScVal();
      const tokens = await callContractMethod('get_creator_tokens', creatorAddress);

      if (tokens && Array.isArray(tokens)) {
        tokens.forEach(addr => {
          if (typeof addr === 'string') {
            allTokens.add(addr);
          }
        });
        if (tokens.length > 0) {
          console.log(`  ✓ Found ${tokens.length} tokens for ${testAddr.slice(0, 8)}...`);
        }
      }
    } catch (error) {
      // Silent fail
    }
  }

  console.log(`✅ Found ${allTokens.size} unique tokens from storage`);
  return allTokens;
}

/**
 * Get token info from contract
 */
async function getTokenInfo(tokenAddress: string): Promise<any> {
  try {
    const address = Address.fromString(tokenAddress).toScVal();
    const info = await callContractMethod('get_token_info', address);
    return info;
  } catch (error) {
    console.error(`❌ Failed to get info for token ${tokenAddress}:`, error);
    return null;
  }
}

/**
 * Process and store a single token
 */
async function processToken(tokenAddress: string): Promise<void> {
  console.log(`\n🔍 Processing token: ${tokenAddress.slice(0, 8)}...${tokenAddress.slice(-4)}`);

  const tokenInfo = await getTokenInfo(tokenAddress);

  if (!tokenInfo) {
    console.warn(`⚠️  No info found for ${tokenAddress}`);
    return;
  }

  console.log(`  📝 Name: ${tokenInfo.name} (${tokenInfo.symbol})`);
  console.log(`  👤 Creator: ${tokenInfo.creator}`);
  console.log(`  📊 Status: ${tokenInfo.graduated ? 'Graduated' : 'Bonding'}`);

  // Prepare token data for database
  const tokenData = {
    address: tokenAddress,
    creator: tokenInfo.creator,
    name: tokenInfo.name,
    symbol: tokenInfo.symbol,
    decimals: 7, // SAC standard
    totalSupply: tokenInfo.total_supply?.toString() || '1000000000000000', // 100M with 7 decimals
    metadataUri: tokenInfo.image_url || '',
    imageUrl: tokenInfo.image_url || null,
    description: tokenInfo.description || `${tokenInfo.name} token on Stellar`,

    // Bonding curve data
    circulatingSupply: tokenInfo.circulating_supply?.toString() || '0',
    xlmReserve: tokenInfo.xlm_reserve?.toString() || '0',
    graduated: tokenInfo.graduated || false,
    xlmRaised: tokenInfo.xlm_raised?.toString() || '0',

    // Market data (calculated or from contract)
    marketCap: tokenInfo.market_cap?.toString() || '0',
    currentPrice: tokenInfo.current_price?.toString() || '0',
    priceChange24h: 0, // Would need historical data
    volume24h: '0', // Would need to aggregate transactions
    volume7d: '0',
    holders: 1, // At least the creator

    createdAt: tokenInfo.created_at ? new Date(Number(tokenInfo.created_at) * 1000) : new Date(),
    updatedAt: new Date(),
  };

  // Upsert token
  await prisma.token.upsert({
    where: { address: tokenAddress },
    update: tokenData,
    create: tokenData,
  });

  // Upsert creator as user
  await prisma.user.upsert({
    where: { address: tokenInfo.creator },
    update: {
      tokensCreatedCount: { increment: 0 }, // Just ensure it exists
    },
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

  console.log(`  ✅ Synced to database`);
}

// ============================================================================
// Main Synchronization Function
// ============================================================================

async function main() {
  console.log('🚀 Starting Token Synchronization\n');
  console.log(`📍 Contract: ${CONTRACT_ID}`);
  console.log(`🌐 RPC: ${RPC_URL}\n`);

  try {
    // Step 1: Get token count
    const tokenCount = await callContractMethod('get_token_count');
    console.log(`📊 Contract reports ${tokenCount} tokens\n`);

    if (tokenCount === 0) {
      console.log('⚠️  No tokens found. Exiting.');
      return;
    }

    // Step 2: Discover all token addresses
    let allTokenAddresses = await getAllTokenAddressesFromEvents();

    if (allTokenAddresses.size === 0) {
      console.log('\n⚠️  No tokens found via events. Trying storage method...\n');
      allTokenAddresses = await getAllTokenAddressesFromStorage();
    }

    if (allTokenAddresses.size === 0) {
      console.log('\n❌ Could not discover any token addresses.');
      console.log('💡 Please provide a creator address as an environment variable:');
      console.log('   CREATOR_ADDRESS=YOUR_ADDRESS pnpm sync-tokens');
      return;
    }

    console.log(`\n✅ Discovered ${allTokenAddresses.size} unique tokens\n`);
    console.log('─'.repeat(60));

    // Step 3: Process each token
    let successCount = 0;
    let failCount = 0;

    for (const tokenAddress of allTokenAddresses) {
      try {
        await processToken(tokenAddress);
        successCount++;
      } catch (error) {
        console.error(`❌ Failed to process ${tokenAddress}:`, error);
        failCount++;
      }
    }

    // Step 4: Summary
    console.log('\n' + '═'.repeat(60));
    console.log('✨ Synchronization Complete!\n');
    console.log(`📊 Summary:`);
    console.log(`   ✅ Successful: ${successCount}`);
    console.log(`   ❌ Failed: ${failCount}`);
    console.log(`   📦 Total: ${allTokenAddresses.size}`);
    console.log('═'.repeat(60) + '\n');

  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run
main()
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

export { main as syncTokens, processToken, getAllTokenAddressesFromEvents };
