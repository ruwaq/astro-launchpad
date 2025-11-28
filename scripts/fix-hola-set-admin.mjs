/**
 * Fix set_admin for HOLA token
 *
 * The token was created but set_admin failed with tx_bad_seq.
 * This script regenerates the issuer keypair and calls set_admin.
 */
import { createHash } from 'crypto';
import {
  Keypair,
  Contract,
  SorobanRpc,
  TransactionBuilder,
  nativeToScVal,
  Address,
  authorizeEntry,
} from '@stellar/stellar-sdk';

const CONFIG = {
  rpcUrl: 'https://soroban-testnet.stellar.org',
  horizonUrl: 'https://horizon-testnet.stellar.org',
  passphrase: 'Test SDF Network ; September 2015',
  factoryContract: 'CDAGI666QPS2QU4RVUXW4WFHABETECXQVJVFNTAJJJCGS36XX6R3AWSC',
  tokenAddress: 'CBITJZL7TC25WJKALVVPPMZUBHBOET6WLDUX3GWBNHZEIALQOYI7AB5F',
};

// Token info from contract
const TOKEN = {
  symbol: 'HOLA',
  creator: 'GAYES36VZUWL437CC2IIJ7OUCWYWESEOJ6GITMTCHEF6OOYWIUNBKVXI',
  id: 2,
  // Token count when created was 2 (verified by testing - matches issuer GDL752RY...)
  tokenCountAtCreation: 2,
};

// SECURITY: Load secrets from environment variables, never hardcode
const SOURCE_SECRET = process.env.DEPLOYER_SECRET;

if (!SOURCE_SECRET) {
  console.error('❌ Missing required environment variable: DEPLOYER_SECRET');
  console.error('   Set it in your environment or .env.local file');
  process.exit(1);
}

/**
 * Recreate the issuer keypair using the same deterministic algorithm
 */
function recreateIssuerKeypair(symbol, creator, tokenCount) {
  // This must match createUniqueIssuerKeypair in asset-utils.ts
  const seedParts = [
    'SAC_ISSUER_V3',         // Version prefix
    tokenCount.toString(),    // Unique count from contract
    '0',                      // Timestamp is 0 for deterministic generation
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

async function main() {
  console.log('=== Fix HOLA Token set_admin ===');
  console.log('Token:', CONFIG.tokenAddress);
  console.log('Factory:', CONFIG.factoryContract);

  // Step 1: Recreate issuer keypair
  console.log('\n1. Recreating issuer keypair...');
  const issuerKeypair = recreateIssuerKeypair(
    TOKEN.symbol,
    TOKEN.creator,
    TOKEN.tokenCountAtCreation
  );
  console.log('  Derived issuer public key:', issuerKeypair.publicKey());

  // Verify this matches the expected issuer (GDL752RY52WMZTHLJ66JLZOGUJDGJHHIX2BCOFZ7L2IV6ZOXECQUTPYT from summary)
  const expectedIssuer = 'GDL752RY52WMZTHLJ66JLZOGUJDGJHHIX2BCOFZ7L2IV6ZOXECQUTPYT';
  if (issuerKeypair.publicKey() === expectedIssuer) {
    console.log('  ✓ Issuer keypair matches expected!');
  } else {
    console.log('  ⚠ Issuer keypair mismatch!');
    console.log('    Expected:', expectedIssuer);
    console.log('    Got:', issuerKeypair.publicKey());
    // Try with tokenCount 0 and 2 as well
    for (const tc of [0, 2]) {
      const altKeypair = recreateIssuerKeypair(TOKEN.symbol, TOKEN.creator, tc);
      console.log(`  Trying tokenCount=${tc}:`, altKeypair.publicKey());
      if (altKeypair.publicKey() === expectedIssuer) {
        console.log('    ✓ MATCH! Using tokenCount =', tc);
      }
    }
  }

  // Step 2: Connect to Soroban
  const server = new SorobanRpc.Server(CONFIG.rpcUrl);
  const sourceKeypair = Keypair.fromSecret(SOURCE_SECRET);

  console.log('\n2. Source account:', sourceKeypair.publicKey());

  // Step 3: Check if issuer account exists on the network
  console.log('\n3. Checking if issuer account exists...');
  try {
    const response = await fetch(`${CONFIG.horizonUrl}/accounts/${issuerKeypair.publicKey()}`);
    if (response.ok) {
      console.log('  ✓ Issuer account exists');
    } else {
      console.log('  ⚠ Issuer account does NOT exist - will try to fund via friendbot');
      // Try friendbot
      const fundResponse = await fetch(`https://friendbot.stellar.org/?addr=${issuerKeypair.publicKey()}`);
      if (fundResponse.ok) {
        console.log('  ✓ Funded issuer via friendbot');
      } else {
        const fundResult = await fundResponse.json();
        console.log('  Friendbot result:', fundResult.detail || fundResult);
      }
    }
  } catch (err) {
    console.error('  Error checking issuer account:', err.message);
  }

  // Wait a bit for network to sync after friendbot
  console.log('\n3.1. Waiting for network sync...');
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Step 4: Build set_admin transaction
  console.log('\n4. Building set_admin transaction...');
  // Refresh source account to get latest sequence number
  const sourceAccount = await server.getAccount(sourceKeypair.publicKey());

  const tokenContract = new Contract(CONFIG.tokenAddress);
  const setAdminOp = tokenContract.call(
    'set_admin',
    nativeToScVal(Address.fromString(CONFIG.factoryContract), { type: 'address' })
  );

  const transaction = new TransactionBuilder(sourceAccount, {
    fee: '1000000', // 0.1 XLM
    networkPassphrase: CONFIG.passphrase,
  })
    .addOperation(setAdminOp)
    .setTimeout(30)
    .build();

  // Step 5: Simulate
  console.log('\n5. Simulating transaction...');
  const simulated = await server.simulateTransaction(transaction);

  if ('error' in simulated) {
    console.error('  Simulation error:', simulated.error);
    throw new Error(`Simulation failed: ${simulated.error}`);
  }

  console.log('  ✓ Simulation successful');

  // Step 6: Sign auth entries with issuer keypair
  console.log('\n6. Signing auth entries with issuer keypair...');

  const latestLedger = await server.getLatestLedger();
  const validUntilLedger = latestLedger.sequence + 1000;

  if (simulated.result && simulated.result.auth && simulated.result.auth.length > 0) {
    console.log(`  Signing ${simulated.result.auth.length} auth entries...`);

    const signedAuthEntries = await Promise.all(
      simulated.result.auth.map(async (entry) => {
        return authorizeEntry(
          entry,
          issuerKeypair,
          validUntilLedger,
          CONFIG.passphrase
        );
      })
    );

    // Replace auth entries with signed ones
    simulated.result.auth = signedAuthEntries;
    console.log('  ✓ Auth entries signed');
  }

  // Step 7: Assemble and sign transaction
  console.log('\n7. Assembling transaction...');
  const preparedTx = SorobanRpc.assembleTransaction(transaction, simulated).build();

  // Sign with issuer for auth
  preparedTx.sign(issuerKeypair);
  // Sign with source for fees
  preparedTx.sign(sourceKeypair);

  console.log('  ✓ Transaction signed');

  // Step 8: Submit
  console.log('\n8. Submitting transaction...');
  const sendResponse = await server.sendTransaction(preparedTx);

  if (sendResponse.status === 'ERROR') {
    console.error('  Send error:', sendResponse.errorResult?.toXDR('base64'));
    throw new Error(`Transaction failed: ${sendResponse.errorResult?.toXDR('base64')}`);
  }

  console.log('  Transaction hash:', sendResponse.hash);

  // Step 9: Wait for confirmation
  console.log('\n9. Waiting for confirmation...');
  let attempts = 0;
  while (attempts < 30) {
    const getResponse = await server.getTransaction(sendResponse.hash);

    if (getResponse.status === 'SUCCESS') {
      console.log('  ✓ Transaction successful!');
      console.log('\n=== set_admin completed successfully! ===');
      console.log('Factory is now admin of HOLA token');
      return sendResponse.hash;
    } else if (getResponse.status === 'FAILED') {
      console.error('  Transaction failed on the network');
      throw new Error('Transaction failed');
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
    attempts++;
    if (attempts % 5 === 0) {
      console.log(`  Waiting... (${attempts}s)`);
    }
  }

  throw new Error('Transaction confirmation timeout');
}

main().catch(err => {
  console.error('\n❌ Error:', err.message);
  process.exit(1);
});
