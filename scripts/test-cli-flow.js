#!/usr/bin/env node
/**
 * CLI Flow Test Script
 * Tests the complete token creation and trading flow
 */

const {
  Asset,
  Keypair,
  Contract,
  TransactionBuilder,
  SorobanRpc,
  nativeToScVal,
  Address,
  Operation,
  Account,
  authorizeEntry,
  xdr,
} = require('@stellar/stellar-sdk');
const { createHash } = require('crypto');
const { execSync } = require('child_process');

// Configuration
const CONFIG = {
  rpcUrl: 'https://soroban-testnet.stellar.org',
  horizonUrl: 'https://horizon-testnet.stellar.org',
  passphrase: 'Test SDF Network ; September 2015',
  factoryContractId: 'CDOEJUCJSXTLPSVDVMMDCEY77IWO4ON2LTFLGSJWPJGATQU4JDAFWIZL',
  xlmSacAddress: 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
};

// Get secret key from stellar CLI
function getSecretKey(alias) {
  try {
    const result = execSync(`stellar keys show ${alias}`, { encoding: 'utf-8' });
    return result.trim();
  } catch (e) {
    console.error(`Failed to get key for ${alias}:`, e.message);
    process.exit(1);
  }
}

// Create unique issuer keypair (same logic as frontend)
function createUniqueIssuerKeypair(symbol, creator, tokenCount, timestamp = 0) {
  const seedParts = [
    'SAC_ISSUER_V3',
    tokenCount.toString(),
    timestamp.toString(),
    symbol,
    creator,
  ];
  const seed = Buffer.concat(seedParts.map(part => Buffer.from(part, 'utf-8')));
  const issuerSeed = createHash('sha256').update(seed).digest();
  return Keypair.fromRawEd25519Seed(issuerSeed);
}

// Create serialized asset XDR
function createSerializedAsset(symbol, issuerPublicKey) {
  const asset = new Asset(symbol, issuerPublicKey);
  const assetXDR = asset.toXDRObject();
  return assetXDR.toXDR();
}

// Fund account via friendbot
async function fundAccount(address) {
  try {
    const response = await fetch(`https://friendbot.stellar.org/?addr=${address}`);
    const result = await response.json();
    return result.successful !== false;
  } catch (e) {
    return false;
  }
}

// Create account on network
async function createAndFundIssuer(issuerKeypair, sourceKeypair) {
  const issuerAddress = issuerKeypair.publicKey();

  // Check if account exists
  try {
    const response = await fetch(`${CONFIG.horizonUrl}/accounts/${issuerAddress}`);
    if (response.ok) {
      console.log('  Issuer account already exists');
      return true;
    }
  } catch (e) {}

  console.log('  Creating issuer account:', issuerAddress);

  // Get source account info
  const sourceResponse = await fetch(`${CONFIG.horizonUrl}/accounts/${sourceKeypair.publicKey()}`);
  const sourceData = await sourceResponse.json();

  // Create account operation
  const createAccountOp = Operation.createAccount({
    destination: issuerAddress,
    startingBalance: '2', // 2 XLM
  });

  const account = new Account(sourceKeypair.publicKey(), sourceData.sequence);
  const transaction = new TransactionBuilder(account, {
    fee: '100000',
    networkPassphrase: CONFIG.passphrase,
  })
    .addOperation(createAccountOp)
    .setTimeout(30)
    .build();

  transaction.sign(sourceKeypair);

  // Submit to Horizon
  const submitResponse = await fetch(`${CONFIG.horizonUrl}/transactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `tx=${encodeURIComponent(transaction.toXDR())}`,
  });

  if (!submitResponse.ok) {
    const errorData = await submitResponse.json();
    throw new Error(`Account creation failed: ${JSON.stringify(errorData)}`);
  }

  console.log('  Issuer account created successfully');
  return true;
}

// Call set_admin on SAC token
async function setFactoryAsAdmin(tokenAddress, issuerKeypair, sourceKeypair) {
  const server = new SorobanRpc.Server(CONFIG.rpcUrl);

  console.log('  Getting source account...');
  const sourceAccount = await server.getAccount(sourceKeypair.publicKey());

  // Build set_admin call
  const tokenContract = new Contract(tokenAddress);
  const setAdminOp = tokenContract.call(
    'set_admin',
    nativeToScVal(Address.fromString(CONFIG.factoryContractId), { type: 'address' })
  );

  const transaction = new TransactionBuilder(sourceAccount, {
    fee: '1000000',
    networkPassphrase: CONFIG.passphrase,
  })
    .addOperation(setAdminOp)
    .setTimeout(30)
    .build();

  console.log('  Simulating transaction...');
  const simulated = await server.simulateTransaction(transaction);

  if ('error' in simulated) {
    throw new Error(`Simulation failed: ${simulated.error}`);
  }

  // Get current ledger for auth expiration
  const latestLedger = await server.getLatestLedger();
  const validUntilLedger = latestLedger.sequence + 1000;

  // Sign auth entries
  const simulationResult = simulated;
  if (simulationResult.result?.auth && simulationResult.result.auth.length > 0) {
    console.log(`  Signing ${simulationResult.result.auth.length} auth entries...`);

    const signedAuthEntries = await Promise.all(
      simulationResult.result.auth.map(async (entry) => {
        return authorizeEntry(
          entry,
          issuerKeypair,
          validUntilLedger,
          CONFIG.passphrase
        );
      })
    );

    simulationResult.result.auth = signedAuthEntries;
  }

  // Assemble with signed auth
  const preparedTx = SorobanRpc.assembleTransaction(transaction, simulationResult).build();
  preparedTx.sign(issuerKeypair);

  console.log('  Submitting transaction...');
  const sendResponse = await server.sendTransaction(preparedTx);

  if (sendResponse.status === 'ERROR') {
    throw new Error(`Transaction failed: ${sendResponse.errorResult?.toXDR('base64')}`);
  }

  // Wait for confirmation
  console.log('  Waiting for confirmation...');
  let attempts = 0;
  while (attempts < 30) {
    const getResponse = await server.getTransaction(sendResponse.hash);
    if (getResponse.status === 'SUCCESS') {
      return sendResponse.hash;
    } else if (getResponse.status === 'FAILED') {
      throw new Error('Transaction failed on network');
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
    attempts++;
  }
  throw new Error('Transaction timeout');
}

// Main test flow
async function main() {
  console.log('='.repeat(60));
  console.log('CLI Flow Test - Token Creation & Trading');
  console.log('='.repeat(60));

  // Step 1: Get creator keypair
  console.log('\n1. Loading creator keypair...');
  const creatorSecret = getSecretKey('creator');
  const creatorKeypair = Keypair.fromSecret(creatorSecret);
  console.log('  Creator:', creatorKeypair.publicKey());

  // Step 2: Get current token count
  console.log('\n2. Getting token count from contract...');
  const tokenCountResult = execSync(
    `stellar contract invoke \
      --id ${CONFIG.factoryContractId} \
      --source creator \
      --rpc-url ${CONFIG.rpcUrl} \
      --network-passphrase "${CONFIG.passphrase}" \
      -- get_token_count`,
    { encoding: 'utf-8' }
  );
  const tokenCount = parseInt(tokenCountResult.match(/\d+/)?.[0] || '0');
  console.log('  Current token count:', tokenCount);

  // Step 3: Create unique issuer
  console.log('\n3. Creating unique issuer keypair...');
  const symbol = 'CLITEST';
  const issuerKeypair = createUniqueIssuerKeypair(
    symbol,
    creatorKeypair.publicKey(),
    tokenCount,
    0
  );
  console.log('  Issuer public key:', issuerKeypair.publicKey());
  console.log('  Issuer secret key:', issuerKeypair.secret());

  // Step 4: Create issuer account on network
  console.log('\n4. Creating and funding issuer account...');
  await createAndFundIssuer(issuerKeypair, creatorKeypair);

  // Step 5: Create serialized asset
  console.log('\n5. Creating serialized asset XDR...');
  const serializedAsset = createSerializedAsset(symbol, issuerKeypair.publicKey());
  const hexAsset = serializedAsset.toString('hex');
  console.log('  Serialized asset (hex):', hexAsset);

  // Step 6: Call launch_token via CLI
  console.log('\n6. Launching token via contract...');
  try {
    const launchResult = execSync(
      `stellar contract invoke \
        --id ${CONFIG.factoryContractId} \
        --source creator \
        --rpc-url ${CONFIG.rpcUrl} \
        --network-passphrase "${CONFIG.passphrase}" \
        --send=yes \
        -- launch_token \
        --creator ${creatorKeypair.publicKey()} \
        --name "CLI Test Token" \
        --symbol ${symbol} \
        --issuer ${issuerKeypair.publicKey()} \
        --image_url "https://example.com/test.png" \
        --description "Test token created via CLI" \
        --serialized_asset ${hexAsset}`,
      { encoding: 'utf-8', timeout: 60000 }
    );
    console.log('  Launch result:', launchResult.trim());

    // Extract token address from result
    const tokenAddressMatch = launchResult.match(/"?([A-Z0-9]{56})"?/);
    if (tokenAddressMatch) {
      const tokenAddress = tokenAddressMatch[1];
      console.log('  Token address:', tokenAddress);

      // Step 7: Set factory as admin
      console.log('\n7. Setting factory as token admin...');
      const adminHash = await setFactoryAsAdmin(tokenAddress, issuerKeypair, creatorKeypair);
      console.log('  Admin set successfully! Hash:', adminHash);

      // Step 8: Verify token info
      console.log('\n8. Verifying token info...');
      const tokenInfoResult = execSync(
        `stellar contract invoke \
          --id ${CONFIG.factoryContractId} \
          --source creator \
          --rpc-url ${CONFIG.rpcUrl} \
          --network-passphrase "${CONFIG.passphrase}" \
          -- get_token_info \
          --token ${tokenAddress}`,
        { encoding: 'utf-8' }
      );
      console.log('  Token info:', tokenInfoResult.trim());

      // Step 9: Test buy
      console.log('\n9. Testing buy (10 XLM)...');
      const buyerSecret = getSecretKey('test-buyer');
      const buyerKeypair = Keypair.fromSecret(buyerSecret);
      console.log('  Buyer:', buyerKeypair.publicKey());

      const deadline = Math.floor(Date.now() / 1000) + 300;
      const xlmAmount = 10 * 10_000_000; // 10 XLM in stroops

      const buyResult = execSync(
        `stellar contract invoke \
          --id ${CONFIG.factoryContractId} \
          --source test-buyer \
          --rpc-url ${CONFIG.rpcUrl} \
          --network-passphrase "${CONFIG.passphrase}" \
          --send=yes \
          -- buy \
          --buyer ${buyerKeypair.publicKey()} \
          --token ${tokenAddress} \
          --xlm_amount ${xlmAmount} \
          --min_tokens 1 \
          --deadline ${deadline}`,
        { encoding: 'utf-8', timeout: 60000 }
      );
      console.log('  Buy result:', buyResult.trim());

      console.log('\n' + '='.repeat(60));
      console.log('SUCCESS! All tests passed.');
      console.log('='.repeat(60));
    }
  } catch (e) {
    console.error('  Error:', e.message);
    if (e.stderr) console.error('  Stderr:', e.stderr.toString());
  }
}

main().catch(console.error);
