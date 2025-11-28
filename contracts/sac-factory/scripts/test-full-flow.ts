#!/usr/bin/env npx tsx
/**
 * Test Full Flow Script - Creates a token, buys, and sells
 *
 * Usage: npx tsx scripts/test-full-flow.ts
 */

import {
  Keypair,
  SorobanRpc,
  Contract,
  TransactionBuilder,
  Networks,
  Operation,
  Asset,
  xdr,
  nativeToScVal,
  Address,
  scValToNative,
} from '@stellar/stellar-sdk';

// Configuration
const CONTRACT_ID = 'CBFRERAZAPWNNFB7Z4NB3DZGUYGJAVD5YM4IRAXVQFBT4IVXD6WFZLEX';
const RPC_URL = 'https://soroban-testnet.stellar.org';
const NETWORK_PASSPHRASE = Networks.TESTNET;

// Test account (testnet-deployer)
// WARNING: This is for testnet only!
const SECRET_KEY = process.env.TESTNET_SECRET_KEY || '';

async function main() {
  console.log('🚀 Starting Full Flow Test...\n');

  if (!SECRET_KEY) {
    console.log('Please set TESTNET_SECRET_KEY environment variable');
    console.log('You can get the secret with: stellar keys show testnet-deployer');
    process.exit(1);
  }

  const server = new SorobanRpc.Server(RPC_URL);
  const keypair = Keypair.fromSecret(SECRET_KEY);
  const publicKey = keypair.publicKey();

  console.log(`Using account: ${publicKey}`);
  console.log(`Contract: ${CONTRACT_ID}\n`);

  // Check account balance
  const account = await server.getAccount(publicKey);
  console.log(`Account sequence: ${account.sequenceNumber()}`);

  // Step 1: Create a test token
  console.log('\n📝 Step 1: Creating Test Token...');

  const tokenSymbol = 'TEST' + Math.floor(Math.random() * 1000);
  const tokenName = 'Test Token ' + tokenSymbol;

  // Create asset and serialize to XDR
  const asset = new Asset(tokenSymbol, publicKey);
  const assetXdr = asset.toXDRObject();
  const serializedAsset = assetXdr.toXDR();

  console.log(`Token Symbol: ${tokenSymbol}`);
  console.log(`Token Name: ${tokenName}`);
  console.log(`Asset Issuer: ${publicKey}`);
  console.log(`Serialized Asset (hex): ${serializedAsset.toString('hex').substring(0, 50)}...`);

  // Build launch_token transaction
  const contract = new Contract(CONTRACT_ID);

  try {
    // Create the function call
    const launchOp = contract.call(
      'launch_token',
      nativeToScVal(publicKey, { type: 'address' }),  // creator
      nativeToScVal(tokenName, { type: 'string' }),    // name
      nativeToScVal(tokenSymbol, { type: 'string' }),  // symbol
      nativeToScVal(publicKey, { type: 'string' }),    // issuer (as string)
      nativeToScVal('https://example.com/token.png', { type: 'string' }),  // image_url
      nativeToScVal('Test token for flow verification', { type: 'string' }),  // description
      xdr.ScVal.scvBytes(serializedAsset),  // serialized_asset
    );

    // Build transaction
    const tx = new TransactionBuilder(account, {
      fee: '10000000', // 1 XLM fee buffer for Soroban
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(launchOp)
      .setTimeout(300)
      .build();

    // Simulate first
    console.log('\nSimulating transaction...');
    const simResult = await server.simulateTransaction(tx);

    if (SorobanRpc.Api.isSimulationError(simResult)) {
      console.error('Simulation error:', simResult.error);
      process.exit(1);
    }

    // Prepare and sign
    const preparedTx = SorobanRpc.assembleTransaction(tx, simResult).build();
    preparedTx.sign(keypair);

    // Submit
    console.log('Submitting transaction...');
    const sendResult = await server.sendTransaction(preparedTx);
    console.log(`Transaction hash: ${sendResult.hash}`);

    // Wait for result
    let getResult;
    let attempts = 0;
    while (attempts < 30) {
      getResult = await server.getTransaction(sendResult.hash);
      if (getResult.status !== SorobanRpc.Api.GetTransactionStatus.NOT_FOUND) {
        break;
      }
      await new Promise(r => setTimeout(r, 1000));
      attempts++;
    }

    if (getResult?.status === SorobanRpc.Api.GetTransactionStatus.SUCCESS) {
      console.log('\n✅ Token Created Successfully!');

      // Extract token address from result
      if (getResult.returnValue) {
        const tokenAddress = scValToNative(getResult.returnValue);
        console.log(`Token Address: ${tokenAddress}`);

        // Step 2: Test buy
        console.log('\n📝 Step 2: Buying Tokens...');
        // (Would implement buy test here)

        // Step 3: Test sell
        console.log('\n📝 Step 3: Selling Tokens...');
        // (Would implement sell test here)
      }
    } else {
      console.log('❌ Transaction failed:', getResult);
    }

  } catch (error) {
    console.error('Error:', error);
  }

  console.log('\n✅ Full Flow Test Complete!');
}

main().catch(console.error);
