#!/usr/bin/env tsx
/**
 * Seed Database with REAL Data from Deployed Contract
 *
 * This script:
 * 1. Connects to the deployed SAC Factory on Stellar Testnet
 * 2. Fetches all tokens created on-chain
 * 3. Populates the database with real token data
 * 4. Creates users for each creator
 * 5. Generates realistic transaction history
 *
 * Usage:
 *   cd backend/shared
 *   pnpm db:seed-contract
 */

import { PrismaClient } from '@prisma/client';
import { SorobanRpc, Contract, Address, xdr } from '@stellar/stellar-sdk';

const prisma = new PrismaClient();

// Contract configuration from environment
const CONTRACT_ID = process.env.TOKEN_FACTORY_CONTRACT_ID || 'CBTFVJEYLMDHDFTKLO4PR7MHPFVNISOYYBJQSCNCQXWX2WMXXXJAZWT2';
const RPC_URL = process.env.STELLAR_RPC_URL || 'https://soroban-testnet.stellar.org';
const NETWORK_PASSPHRASE = process.env.STELLAR_NETWORK_PASSPHRASE || 'Test SDF Network ; September 2015';

// Stellar client
const server = new SorobanRpc.Server(RPC_URL);
const contract = new Contract(CONTRACT_ID);

/**
 * Convert ScVal to native JavaScript value
 */
function scValToNative(scVal: xdr.ScVal): any {
  const type = scVal.switch();

  switch (type.name) {
    case 'scvBool':
      return scVal.b();
    case 'scvU32':
      return scVal.u32();
    case 'scvI32':
      return scVal.i32();
    case 'scvU64':
      return scVal.u64().toString();
    case 'scvI64':
      return scVal.i64().toString();
    case 'scvU128':
      const u128 = scVal.u128();
      return (BigInt(u128.hi().toString()) << BigInt(64)) | BigInt(u128.lo().toString());
    case 'scvI128':
      const i128 = scVal.i128();
      return (BigInt(i128.hi().toString()) << BigInt(64)) | BigInt(i128.lo().toString());
    case 'scvString':
      return scVal.str().toString();
    case 'scvSymbol':
      return scVal.sym().toString();
    case 'scvVec':
      return scVal.vec()?.map(scValToNative) || [];
    case 'scvMap':
      const map: any = {};
      scVal.map()?.forEach((entry) => {
        const key = scValToNative(entry.key());
        const val = scValToNative(entry.val());
        map[key] = val;
      });
      return map;
    case 'scvAddress':
      return Address.fromScVal(scVal).toString();
    default:
      return null;
  }
}

/**
 * Call contract read-only method
 */
async function callContract(method: string, ...params: xdr.ScVal[]): Promise<any> {
  try {
    const operation = contract.call(method, ...params);

    const simulationResponse = await server.simulateTransaction(
      new (await import('@stellar/stellar-sdk')).TransactionBuilder(
        new (await import('@stellar/stellar-sdk')).Account(
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
    } else {
      throw new Error(`Simulation failed: ${JSON.stringify(simulationResponse)}`);
    }

    return null;
  } catch (error) {
    console.error(`Error calling ${method}:`, error);
    throw error;
  }
}

/**
 * Get token count from contract
 */
async function getTokenCount(): Promise<number> {
  console.log('📊 Fetching token count from contract...');
  const count = await callContract('get_token_count');
  console.log(`✅ Found ${count} tokens on-chain`);
  return count;
}

/**
 * Get token info from contract
 */
async function getTokenInfo(tokenAddress: string): Promise<any> {
  console.log(`📝 Fetching info for token: ${tokenAddress}`);

  const addressScVal = Address.fromString(tokenAddress).toScVal();
  const tokenInfo = await callContract('get_token_info', addressScVal);

  if (!tokenInfo) {
    console.warn(`⚠️  Token ${tokenAddress} not found`);
    return null;
  }

  return tokenInfo;
}

/**
 * Generate realistic transaction history for a token
 */
function generateTransactionHistory(tokenAddress: string, creator: string, count: number = 10) {
  const transactions: any[] = [];
  const now = new Date();

  // Create token transaction
  transactions.push({
    hash: `created_${tokenAddress}_${Date.now()}`,
    type: 'TOKEN_CREATED',
    from: creator,
    to: null,
    tokenAddress,
    amount: null,
    status: 'SUCCESS',
    timestamp: new Date(now.getTime() - count * 60000), // count minutes ago
  });

  // Generate buy/sell transactions
  const traders = [
    'GDYIDNFAXWPRMNBX6DH2MH2DTXUPWX65CMNYOQF4HHQWLXBXTWVGMKWJ',
    'GAJHORKZ5HXWQWMDE7E5KZXZXQXZXQXZXQXZXQXZXQXZXQXZXQXZXQ',
    'GCXZXQXZXQXZXQXZXQXZXQXZXQXZXQXZXQXZXQXZXQXZXQXZXQXZXQ',
  ];

  for (let i = 0; i < count; i++) {
    const trader = traders[i % traders.length];
    const isBuy = Math.random() > 0.5;
    const amount = (Math.random() * 10000 + 1000).toFixed(0);

    transactions.push({
      hash: `tx_${tokenAddress}_${i}_${Date.now()}`,
      type: isBuy ? 'TOKEN_BOUGHT' : 'TOKEN_SOLD',
      from: trader,
      to: isBuy ? trader : CONTRACT_ID,
      tokenAddress,
      amount,
      status: 'SUCCESS',
      timestamp: new Date(now.getTime() - (count - i) * 60000),
    });
  }

  return transactions;
}

/**
 * Main seeding function
 */
async function main() {
  console.log('🚀 Starting database seed from deployed contract...\n');
  console.log(`📍 Contract: ${CONTRACT_ID}`);
  console.log(`🌐 RPC: ${RPC_URL}\n`);

  try {
    // Step 1: Get token count
    const tokenCount = await getTokenCount();

    if (tokenCount === 0) {
      console.log('⚠️  No tokens found on-chain. Deploy some tokens first!');
      return;
    }

    console.log(`\n📦 Processing ${tokenCount} tokens...\n`);

    // Step 2: For each token ID, get creator tokens (we'll iterate through known creators)
    // Since we can't easily enumerate all tokens without pagination support,
    // we'll use get_creator_tokens_paginated if we know the creators

    // For now, let's try to get tokens by fetching from ID 0 to tokenCount
    // This requires knowing token addresses, which we don't have directly
    // Instead, we'll query the contract's state

    // WORKAROUND: Query common test addresses
    const testCreators = [
      'GDYIDNFAXWPRMNBX6DH2MH2DTXUPWX65CMNYOQF4HHQWLXBXTWVGMKWJ',
      'GCW2OQGQAZNIDZ7ULXC6S4RQWQCVMJN6PVEWYYHQWDWADAIWVGJ5QKKX',
      'GAJHORKZ5HXWQWMDE7E5KZXZXQXZXQXZXQXZXQXZXQXZXQXZXQXZXQ',
    ];

    const allTokenAddresses: Set<string> = new Set();

    for (const creator of testCreators) {
      try {
        console.log(`🔍 Checking tokens for creator: ${creator.slice(0, 8)}...`);
        const creatorAddressScVal = Address.fromString(creator).toScVal();
        const offset = xdr.ScVal.scvU32(0);
        const limit = xdr.ScVal.scvU32(100);

        const tokens = await callContract('get_creator_tokens_paginated', creatorAddressScVal, offset, limit);

        if (tokens && tokens.length > 0) {
          console.log(`✅ Found ${tokens.length} tokens for this creator`);
          tokens.forEach((addr: string) => allTokenAddresses.add(addr));
        }
      } catch (error) {
        console.log(`⚠️  Could not fetch tokens for ${creator.slice(0, 8)}: ${error}`);
      }
    }

    console.log(`\n📊 Total unique token addresses found: ${allTokenAddresses.size}\n`);

    if (allTokenAddresses.size === 0) {
      console.log('⚠️  No token addresses could be retrieved. Using mock data instead.\n');
      // Create mock data for demo
      await seedMockData();
      return;
    }

    // Step 3: Process each token
    const tokensData: any[] = [];
    const usersMap = new Map<string, any>();
    const transactionsData: any[] = [];

    for (const tokenAddress of allTokenAddresses) {
      try {
        const tokenInfo = await getTokenInfo(tokenAddress);

        if (!tokenInfo) continue;

        console.log(`✅ Token: ${tokenInfo.name} (${tokenInfo.symbol})`);

        // Prepare token data
        const tokenData = {
          address: tokenInfo.token_address,
          creator: tokenInfo.creator,
          name: tokenInfo.name,
          symbol: tokenInfo.symbol,
          decimals: 7, // SAC tokens have 7 decimals
          totalSupply: '10000000000000000', // 1B tokens with 7 decimals
          metadataUri: tokenInfo.image_url || '',
          imageUrl: tokenInfo.image_url,
          description: tokenInfo.description || `${tokenInfo.name} token on Stellar`,
          circulatingSupply: tokenInfo.bonding_curve?.token_reserve?.toString() || '8000000000000000',
          xlmReserve: tokenInfo.bonding_curve?.xlm_reserve?.toString() || '0',
          graduated: tokenInfo.status !== 'Bonding',
          xlmRaised: tokenInfo.xlm_raised?.toString() || '0',
          marketCap: tokenInfo.market_cap?.toString() || '0',
          currentPrice: '100000', // 0.01 XLM in stroops
          priceChange24h: Math.random() * 20 - 10, // -10% to +10%
          volume24h: (Math.random() * 100000 + 10000).toFixed(0),
          volume7d: (Math.random() * 500000 + 50000).toFixed(0),
          holders: Math.floor(Math.random() * 100 + 10),
          createdAt: new Date(tokenInfo.created_at * 1000),
        };

        tokensData.push(tokenData);

        // Prepare user data
        if (!usersMap.has(tokenInfo.creator)) {
          usersMap.set(tokenInfo.creator, {
            address: tokenInfo.creator,
            points: Math.floor(Math.random() * 10000),
            level: Math.floor(Math.random() * 10 + 1),
            referrals: Math.floor(Math.random() * 20),
            tokensCreatedCount: 1,
            totalVolumeTraded: (Math.random() * 1000000).toFixed(0),
            totalLiquidityProvided: (Math.random() * 500000).toFixed(0),
          });
        } else {
          const user = usersMap.get(tokenInfo.creator);
          user.tokensCreatedCount++;
        }

        // Generate transactions
        const txs = generateTransactionHistory(tokenAddress, tokenInfo.creator, 15);
        transactionsData.push(...txs);

      } catch (error) {
        console.error(`❌ Error processing token ${tokenAddress}:`, error);
      }
    }

    // Step 4: Insert into database
    console.log(`\n💾 Inserting data into database...\n`);

    // Insert users
    console.log(`👥 Inserting ${usersMap.size} users...`);
    for (const userData of usersMap.values()) {
      await prisma.user.upsert({
        where: { address: userData.address },
        update: userData,
        create: userData,
      });
    }
    console.log(`✅ Users inserted`);

    // Insert tokens
    console.log(`🪙  Inserting ${tokensData.length} tokens...`);
    for (const tokenData of tokensData) {
      await prisma.token.upsert({
        where: { address: tokenData.address },
        update: tokenData,
        create: tokenData,
      });
    }
    console.log(`✅ Tokens inserted`);

    // Insert transactions
    console.log(`📝 Inserting ${transactionsData.length} transactions...`);
    for (const txData of transactionsData) {
      await prisma.transaction.upsert({
        where: { hash: txData.hash },
        update: txData,
        create: txData,
      });
    }
    console.log(`✅ Transactions inserted`);

    console.log(`\n✨ Database seeded successfully!`);
    console.log(`\n📊 Summary:`);
    console.log(`   - Tokens: ${tokensData.length}`);
    console.log(`   - Users: ${usersMap.size}`);
    console.log(`   - Transactions: ${transactionsData.length}`);

  } catch (error) {
    console.error('❌ Error seeding database:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Seed mock data if contract queries fail
 */
async function seedMockData() {
  console.log('🎭 Creating mock data for demonstration...\n');

  const mockTokens = [
    {
      address: 'CTOKENMOCKADDR1XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX1',
      creator: 'GDYIDNFAXWPRMNBX6DH2MH2DTXUPWX65CMNYOQF4HHQWLXBXTWVGMKWJ',
      name: 'Doge Shiba',
      symbol: 'DSHIB',
      imageUrl: 'https://picsum.photos/seed/dshib/400',
      description: 'The ultimate meme coin on Stellar',
      volume24h: '125000',
      marketCap: '50000',
    },
    {
      address: 'CTOKENMOCKADDR2XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX2',
      creator: 'GCW2OQGQAZNIDZ7ULXC6S4RQWQCVMJN6PVEWYYHQWDWADAIWVGJ5QKKX',
      name: 'Moon Rocket',
      symbol: 'MOON',
      imageUrl: 'https://picsum.photos/seed/moon/400',
      description: 'To the moon and beyond!',
      volume24h: '89000',
      marketCap: '35000',
    },
    {
      address: 'CTOKENMOCKADDR3XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX3',
      creator: 'GAJHORKZ5HXWQWMDE7E5KZXZXQXZXQXZXQXZXQXZXQXZXQXZXQXZXQ',
      name: 'Pepe Stellar',
      symbol: 'PEPES',
      imageUrl: 'https://picsum.photos/seed/pepe/400',
      description: 'Rare Pepe on Stellar blockchain',
      volume24h: '156000',
      marketCap: '68000',
    },
    {
      address: 'CTOKENMOCKADDR4XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX4',
      creator: 'GDYIDNFAXWPRMNBX6DH2MH2DTXUPWX65CMNYOQF4HHQWLXBXTWVGMKWJ',
      name: 'Stellar Cat',
      symbol: 'SCAT',
      imageUrl: 'https://picsum.photos/seed/cat/400',
      description: 'The purrfect token',
      volume24h: '72000',
      marketCap: '28000',
    },
  ];

  const usersMap = new Map<string, any>();
  const tokensData: any[] = [];
  const transactionsData: any[] = [];

  for (const mock of mockTokens) {
    const tokenData = {
      address: mock.address,
      creator: mock.creator,
      name: mock.name,
      symbol: mock.symbol,
      decimals: 7,
      totalSupply: '10000000000000000',
      metadataUri: mock.imageUrl,
      imageUrl: mock.imageUrl,
      description: mock.description,
      circulatingSupply: '8000000000000000',
      xlmReserve: (parseFloat(mock.marketCap) * 10_000_000 / 2).toFixed(0),
      graduated: false,
      xlmRaised: (parseFloat(mock.marketCap) * 10_000_000 / 2).toFixed(0),
      marketCap: (parseFloat(mock.marketCap) * 10_000_000).toString(),
      currentPrice: '100000',
      priceChange24h: Math.random() * 20 - 10,
      volume24h: (parseFloat(mock.volume24h) * 10_000_000).toString(),
      volume7d: (parseFloat(mock.volume24h) * 7 * 10_000_000).toString(),
      holders: Math.floor(Math.random() * 100 + 10),
      createdAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
    };

    tokensData.push(tokenData);

    if (!usersMap.has(mock.creator)) {
      usersMap.set(mock.creator, {
        address: mock.creator,
        points: Math.floor(Math.random() * 10000),
        level: Math.floor(Math.random() * 10 + 1),
        referrals: Math.floor(Math.random() * 20),
        tokensCreatedCount: 1,
        totalVolumeTraded: (Math.random() * 1000000).toFixed(0),
        totalLiquidityProvided: (Math.random() * 500000).toFixed(0),
      });
    } else {
      const user = usersMap.get(mock.creator);
      user.tokensCreatedCount++;
    }

    const txs = generateTransactionHistory(mock.address, mock.creator, 20);
    transactionsData.push(...txs);
  }

  // Insert into database
  console.log(`👥 Inserting ${usersMap.size} users...`);
  for (const userData of usersMap.values()) {
    await prisma.user.upsert({
      where: { address: userData.address },
      update: userData,
      create: userData,
    });
  }

  console.log(`🪙  Inserting ${tokensData.length} tokens...`);
  for (const tokenData of tokensData) {
    await prisma.token.upsert({
      where: { address: tokenData.address },
      update: tokenData,
      create: tokenData,
    });
  }

  console.log(`📝 Inserting ${transactionsData.length} transactions...`);
  for (const txData of transactionsData) {
    await prisma.transaction.upsert({
      where: { hash: txData.hash },
      update: txData,
      create: txData,
    });
  }

  console.log(`\n✨ Mock data seeded successfully!`);
}

// Run main function
main()
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
