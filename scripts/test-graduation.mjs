/**
 * Test Script: Full Graduation Flow
 *
 * This script tests the complete token lifecycle:
 * 1. Launch token via factory
 * 2. Set factory as admin
 * 3. Buy tokens to trigger graduation
 * 4. Verify AMM pool creation
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
  scValToNative,
} from '@stellar/stellar-sdk';
import { createHash } from 'crypto';

// Configuration
const CONFIG = {
  rpcUrl: 'https://soroban-testnet.stellar.org',
  horizonUrl: 'https://horizon-testnet.stellar.org',
  passphrase: 'Test SDF Network ; September 2015',
  factoryContract: 'CDAGI666QPS2QU4RVUXW4WFHABETECXQVJVFNTAJJJCGS36XX6R3AWSC',
  xlmAddress: 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
};

// SECURITY: Load secrets from environment variables, never hardcode
const DEPLOYER_SECRET = process.env.DEPLOYER_SECRET;
const BUYER_SECRET = process.env.BUYER_SECRET;

if (!DEPLOYER_SECRET || !BUYER_SECRET) {
  console.error('❌ Missing required environment variables:');
  console.error('   DEPLOYER_SECRET - Stellar secret key for deployer account');
  console.error('   BUYER_SECRET - Stellar secret key for buyer account');
  console.error('\nSet them in your environment or .env.local file');
  process.exit(1);
}

// Generate unique issuer keypair
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

// Convert Buffer to Soroban Bytes ScVal
function bufferToSorobanBytes(buffer) {
  return xdr.ScVal.scvBytes(buffer);
}

async function getTokenCount(server, factoryAddress, sourceAddress) {
  const sourceAccount = await server.getAccount(sourceAddress);
  const factoryContract = new Contract(factoryAddress);

  const tx = new TransactionBuilder(sourceAccount, {
    fee: '100000',
    networkPassphrase: CONFIG.passphrase,
  })
    .addOperation(factoryContract.call('get_token_count'))
    .setTimeout(30)
    .build();

  const simulated = await server.simulateTransaction(tx);
  if ('result' in simulated && simulated.result?.retval) {
    return Number(scValToNative(simulated.result.retval));
  }
  return 0;
}

async function launchToken(server, deployerKeypair, symbol, name) {
  console.log('\n=== Launching Token ===');

  const deployerAddress = deployerKeypair.publicKey();
  const sourceAccount = await server.getAccount(deployerAddress);

  // Get current token count
  const tokenCount = await getTokenCount(server, CONFIG.factoryContract, deployerAddress);
  console.log('Current token count:', tokenCount);

  // Create issuer keypair (deterministic)
  const issuerKeypair = createUniqueIssuerKeypair(symbol, deployerAddress, tokenCount, 0);
  console.log('Issuer public key:', issuerKeypair.publicKey());

  // Create serialized asset
  const serializedAsset = createSerializedAsset(symbol, issuerKeypair.publicKey());
  console.log('Serialized asset length:', serializedAsset.length);

  // Build launch_token call
  const factoryContract = new Contract(CONFIG.factoryContract);
  const launchOp = factoryContract.call(
    'launch_token',
    nativeToScVal(Address.fromString(deployerAddress), { type: 'address' }),
    nativeToScVal(name, { type: 'string' }),
    nativeToScVal(symbol, { type: 'string' }),
    nativeToScVal(issuerKeypair.publicKey(), { type: 'string' }),
    nativeToScVal('ipfs://test-graduation', { type: 'string' }),
    nativeToScVal('Test token for graduation flow', { type: 'string' }),
    bufferToSorobanBytes(serializedAsset)
  );

  const tx = new TransactionBuilder(sourceAccount, {
    fee: '10000000', // 1 XLM to be safe
    networkPassphrase: CONFIG.passphrase,
  })
    .addOperation(launchOp)
    .setTimeout(120)
    .build();

  // Simulate
  console.log('Simulating launch_token...');
  const simulated = await server.simulateTransaction(tx);

  if ('error' in simulated) {
    console.error('Simulation error:', simulated.error);
    throw new Error(`Simulation failed: ${simulated.error}`);
  }

  // Assemble and sign
  const preparedTx = SorobanRpc.assembleTransaction(tx, simulated).build();
  preparedTx.sign(deployerKeypair);

  // Submit
  console.log('Submitting launch_token...');
  const sendResponse = await server.sendTransaction(preparedTx);

  if (sendResponse.status === 'ERROR') {
    throw new Error(`Transaction failed: ${sendResponse.errorResult?.toXDR('base64')}`);
  }

  // Wait for confirmation
  let tokenAddress = null;
  let attempts = 0;
  while (attempts < 60) {
    const getResponse = await server.getTransaction(sendResponse.hash);

    if (getResponse.status === 'SUCCESS') {
      console.log('Token launched! Hash:', sendResponse.hash);

      // Extract token address from return value
      if (getResponse.returnValue) {
        tokenAddress = Address.fromScVal(getResponse.returnValue).toString();
        console.log('Token address:', tokenAddress);
      }

      return { tokenAddress, issuerKeypair };
    } else if (getResponse.status === 'FAILED') {
      console.error('Transaction failed:', getResponse);
      throw new Error('Transaction failed on the network');
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
    attempts++;
  }

  throw new Error('Transaction confirmation timeout');
}

async function setFactoryAsAdmin(server, tokenAddress, issuerKeypair, sourceKeypair) {
  console.log('\n=== Setting Factory as Token Admin ===');

  const sourceAddress = sourceKeypair.publicKey();
  const issuerAddress = issuerKeypair.publicKey();

  // First, ensure issuer account exists (fund via friendbot if needed)
  console.log('Checking issuer account:', issuerAddress);

  try {
    const response = await fetch(`${CONFIG.horizonUrl}/accounts/${issuerAddress}`);
    if (!response.ok) {
      console.log('Funding issuer via friendbot...');
      const fundResponse = await fetch(`https://friendbot.stellar.org/?addr=${issuerAddress}`);
      const fundResult = await fundResponse.json();
      console.log('Friendbot result:', fundResult.successful ? 'Success' : 'Already funded or error');
      await new Promise(resolve => setTimeout(resolve, 2000));
    } else {
      console.log('Issuer account already exists');
    }
  } catch (e) {
    console.log('Funding issuer via friendbot...');
    await fetch(`https://friendbot.stellar.org/?addr=${issuerAddress}`);
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // Build set_admin call
  const sourceAccount = await server.getAccount(sourceAddress);
  const tokenContract = new Contract(tokenAddress);

  const setAdminOp = tokenContract.call(
    'set_admin',
    nativeToScVal(Address.fromString(CONFIG.factoryContract), { type: 'address' })
  );

  const tx = new TransactionBuilder(sourceAccount, {
    fee: '10000000',
    networkPassphrase: CONFIG.passphrase,
  })
    .addOperation(setAdminOp)
    .setTimeout(120)
    .build();

  // Simulate
  console.log('Simulating set_admin...');
  const simulated = await server.simulateTransaction(tx);

  if ('error' in simulated) {
    throw new Error(`Simulation failed: ${simulated.error}`);
  }

  // Sign auth entries with issuer keypair
  const latestLedger = await server.getLatestLedger();
  const validUntilLedger = latestLedger.sequence + 1000;

  const simulationResult = simulated;
  if (simulationResult.result?.auth && simulationResult.result.auth.length > 0) {
    console.log(`Signing ${simulationResult.result.auth.length} auth entries with issuer keypair...`);

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

  // Assemble and sign
  const preparedTx = SorobanRpc.assembleTransaction(tx, simulationResult).build();
  preparedTx.sign(issuerKeypair);

  // Submit
  console.log('Submitting set_admin...');
  const sendResponse = await server.sendTransaction(preparedTx);

  if (sendResponse.status === 'ERROR') {
    throw new Error(`Transaction failed: ${sendResponse.errorResult?.toXDR('base64')}`);
  }

  // Wait for confirmation
  let attempts = 0;
  while (attempts < 60) {
    const getResponse = await server.getTransaction(sendResponse.hash);

    if (getResponse.status === 'SUCCESS') {
      console.log('Factory set as admin! Hash:', sendResponse.hash);
      return true;
    } else if (getResponse.status === 'FAILED') {
      console.error('Transaction failed:', getResponse);
      throw new Error('Transaction failed on the network');
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
    attempts++;
  }

  throw new Error('Transaction confirmation timeout');
}

async function buyTokens(server, buyerKeypair, tokenAddress, xlmAmount) {
  console.log(`\n=== Buying ${xlmAmount / 10000000} XLM worth of tokens ===`);

  const buyerAddress = buyerKeypair.publicKey();
  const sourceAccount = await server.getAccount(buyerAddress);

  // Build buy call
  const factoryContract = new Contract(CONFIG.factoryContract);
  const deadline = Math.floor(Date.now() / 1000) + 300; // 5 minutes

  const buyOp = factoryContract.call(
    'buy',
    nativeToScVal(Address.fromString(buyerAddress), { type: 'address' }),
    nativeToScVal(Address.fromString(tokenAddress), { type: 'address' }),
    nativeToScVal(xlmAmount, { type: 'i128' }),
    nativeToScVal(BigInt(0), { type: 'i128' }), // min_tokens = 0 (no slippage protection for testing)
    nativeToScVal(deadline, { type: 'u64' })
  );

  const tx = new TransactionBuilder(sourceAccount, {
    fee: '100000000', // 10 XLM fee (graduation is expensive)
    networkPassphrase: CONFIG.passphrase,
  })
    .addOperation(buyOp)
    .setTimeout(300)
    .build();

  // Simulate
  console.log('Simulating buy...');
  const simulated = await server.simulateTransaction(tx);

  if ('error' in simulated) {
    console.error('Simulation error:', JSON.stringify(simulated, null, 2));
    throw new Error(`Simulation failed: ${simulated.error}`);
  }

  console.log('Simulation successful');
  console.log('Min resource fee:', simulated.minResourceFee);

  // Assemble and sign
  const preparedTx = SorobanRpc.assembleTransaction(tx, simulated).build();
  preparedTx.sign(buyerKeypair);

  // Submit
  console.log('Submitting buy transaction...');
  const sendResponse = await server.sendTransaction(preparedTx);

  if (sendResponse.status === 'ERROR') {
    console.error('Send error:', sendResponse.errorResult?.toXDR('base64'));
    throw new Error(`Transaction failed: ${sendResponse.errorResult?.toXDR('base64')}`);
  }

  console.log('Transaction submitted, hash:', sendResponse.hash);

  // Wait for confirmation
  let attempts = 0;
  while (attempts < 120) {
    const getResponse = await server.getTransaction(sendResponse.hash);

    if (getResponse.status === 'SUCCESS') {
      console.log('Buy successful! Hash:', sendResponse.hash);

      // Extract tokens received
      if (getResponse.returnValue) {
        const tokensReceived = scValToNative(getResponse.returnValue);
        console.log('Tokens received:', tokensReceived);
      }

      return true;
    } else if (getResponse.status === 'FAILED') {
      console.error('Transaction failed:', getResponse);
      throw new Error('Transaction failed on the network');
    }

    if (attempts % 10 === 0) {
      console.log(`Waiting for confirmation... attempt ${attempts}`);
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
    attempts++;
  }

  throw new Error('Transaction confirmation timeout');
}

async function getTokenInfo(server, tokenAddress, sourceAddress) {
  console.log('\n=== Getting Token Info ===');

  const sourceAccount = await server.getAccount(sourceAddress);
  const factoryContract = new Contract(CONFIG.factoryContract);

  const tx = new TransactionBuilder(sourceAccount, {
    fee: '100000',
    networkPassphrase: CONFIG.passphrase,
  })
    .addOperation(factoryContract.call(
      'get_token_info',
      nativeToScVal(Address.fromString(tokenAddress), { type: 'address' })
    ))
    .setTimeout(30)
    .build();

  const simulated = await server.simulateTransaction(tx);
  if ('result' in simulated && simulated.result?.retval) {
    const tokenInfo = scValToNative(simulated.result.retval);
    console.log('Token Info:', JSON.stringify(tokenInfo, (_, v) => typeof v === 'bigint' ? v.toString() : v, 2));
    return tokenInfo;
  }
  return null;
}

async function getAmmPair(server, tokenAddress, sourceAddress) {
  console.log('\n=== Getting AMM Pair ===');

  const sourceAccount = await server.getAccount(sourceAddress);
  const factoryContract = new Contract(CONFIG.factoryContract);

  const tx = new TransactionBuilder(sourceAccount, {
    fee: '100000',
    networkPassphrase: CONFIG.passphrase,
  })
    .addOperation(factoryContract.call(
      'get_amm_pair',
      nativeToScVal(Address.fromString(tokenAddress), { type: 'address' })
    ))
    .setTimeout(30)
    .build();

  const simulated = await server.simulateTransaction(tx);
  if ('result' in simulated && simulated.result?.retval) {
    const ammPair = scValToNative(simulated.result.retval);
    console.log('AMM Pair:', ammPair);
    return ammPair;
  }
  return null;
}

async function main() {
  console.log('=== Graduation Flow Test ===');
  console.log('Factory Contract:', CONFIG.factoryContract);

  // Initialize server
  const server = new SorobanRpc.Server(CONFIG.rpcUrl);

  // Use stellar CLI keys
  const deployerKeypair = Keypair.fromSecret(DEPLOYER_SECRET);
  const buyerKeypair = Keypair.fromSecret(BUYER_SECRET);

  console.log('Deployer:', deployerKeypair.publicKey());
  console.log('Buyer:', buyerKeypair.publicKey());

  try {
    // Step 1: Launch token
    const symbol = 'TEST8';
    const name = 'Test Graduation Token 8';
    const { tokenAddress, issuerKeypair } = await launchToken(server, deployerKeypair, symbol, name);

    // Step 2: Set factory as admin
    await setFactoryAsAdmin(server, tokenAddress, issuerKeypair, deployerKeypair);

    // Step 3: Check token info before buying
    await getTokenInfo(server, tokenAddress, deployerKeypair.publicKey());

    // Step 4: Buy tokens to trigger graduation
    // Graduation threshold is 100 XLM = 1,000,000,000 stroops
    // Let's buy 150 XLM to ensure we trigger graduation
    const xlmAmount = BigInt(150 * 10000000); // 150 XLM in stroops
    await buyTokens(server, buyerKeypair, tokenAddress, xlmAmount);

    // Step 5: Check token info after buying (should be graduated)
    await getTokenInfo(server, tokenAddress, deployerKeypair.publicKey());

    // Step 6: Get AMM pair address
    await getAmmPair(server, tokenAddress, deployerKeypair.publicKey());

    console.log('\n=== Test Complete! ===');
    console.log('Token Address:', tokenAddress);

  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

main().catch(console.error);
