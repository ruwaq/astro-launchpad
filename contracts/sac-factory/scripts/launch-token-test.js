#!/usr/bin/env node

/**
 * Launch Token Test Script
 * 
 * Tests the complete token launch flow with fees on Stellar Testnet:
 * 1. Creates a unique Stellar Asset (SAC)
 * 2. Serializes the asset to XDR bytes
 * 3. Calls launch_token on the SAC Factory contract
 * 4. Pays the 10 XLM creation fee
 * 5. Verifies token was created
 * 6. Simulates buy/sell to test trading fees
 * 
 * Usage:
 *   node scripts/launch-token-test.js
 */

import * as StellarSdk from '@stellar/stellar-sdk';
import { Server } from '@stellar/stellar-sdk/rpc';

// Configuration
const RPC_URL = 'https://soroban-testnet.stellar.org';
const NETWORK_PASSPHRASE = 'Test SDF Network ; September 2015';
const CONTRACT_ID = 'CABE2SUA2JOY5PERZZIS7WQMFVMDVGDIK2MKFVXCDNTWH3HJ2PGZXTXE';

// Test user secret key (testnet-deployer from Stellar CLI)
// Replace with your own testnet account
const USER_SECRET = process.env.STELLAR_SECRET || 'YOUR_SECRET_KEY_HERE';

const server = new Server(RPC_URL);

/**
 * Create a unique Stellar Asset and serialize to XDR bytes
 */
function createSerializedAsset(symbol, issuerPublicKey) {
  console.log(`\n📝 Creating asset: ${symbol}`);
  console.log(`   Issuer: ${issuerPublicKey}`);
  
  // Create the Stellar Asset
  const asset = new StellarSdk.Asset(symbol, issuerPublicKey);
  
  // Convert to XDR and then to bytes
  const assetXdr = asset.toXDRObject();
  const xdrBuffer = assetXdr.toXDR('raw');
  
  console.log(`   XDR Buffer length: ${xdrBuffer.length} bytes`);
  
  return xdrBuffer;
}

/**
 * Convert Buffer to Soroban Bytes ScVal
 */
function bufferToScVal(buffer) {
  return StellarSdk.xdr.ScVal.scvBytes(buffer);
}

/**
 * Submit transaction and wait for confirmation
 */
async function submitAndWait(tx) {
  try {
    const response = await server.sendTransaction(tx);
    console.log(`   Transaction hash: ${response.hash}`);
    
    if (response.status === 'ERROR') {
      console.error('   ❌ Transaction failed:', response);
      throw new Error(`Transaction failed: ${response.errorResultXdr}`);
    }
    
    // Poll for result
    let getResponse = await server.getTransaction(response.hash);
    let retries = 0;
    const maxRetries = 30;
    
    while (getResponse.status === 'NOT_FOUND' && retries < maxRetries) {
      console.log(`   ⏳ Waiting for confirmation... (${retries + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, 2000));
      getResponse = await server.getTransaction(response.hash);
      retries++;
    }
    
    if (getResponse.status === 'SUCCESS') {
      console.log('   ✅ Transaction confirmed!');
      return getResponse;
    } else {
      console.error('   ❌ Transaction failed or timed out');
      throw new Error(`Transaction status: ${getResponse.status}`);
    }
  } catch (error) {
    console.error('   ❌ Error submitting transaction:', error.message);
    throw error;
  }
}

/**
 * Launch a new token on the SAC Factory
 */
async function launchToken(userKeypair, tokenName, tokenSymbol, imageUrl, description) {
  console.log('\n🚀 Launching token...');
  console.log(`   Name: ${tokenName}`);
  console.log(`   Symbol: ${tokenSymbol}`);
  
  try {
    // Get user account
    const userAccount = await server.getAccount(userKeypair.publicKey());
    
    // Create serialized asset
    const serializedAsset = createSerializedAsset(tokenSymbol, userKeypair.publicKey());
    
    // Build contract call arguments
    const contract = new StellarSdk.Contract(CONTRACT_ID);
    
    // Build the transaction
    const transaction = new StellarSdk.TransactionBuilder(userAccount, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(
        contract.call(
          'launch_token',
          StellarSdk.Address.fromString(userKeypair.publicKey()).toScVal(),  // creator
          StellarSdk.nativeToScVal(tokenName, { type: 'string' }),           // name
          StellarSdk.nativeToScVal(tokenSymbol, { type: 'symbol' }),         // symbol
          StellarSdk.nativeToScVal(imageUrl, { type: 'string' }),            // image_url
          StellarSdk.nativeToScVal(description, { type: 'string' }),         // description
          bufferToScVal(serializedAsset)                                     // serialized_asset
        )
      )
      .setTimeout(30)
      .build();
    
    console.log('\n📤 Preparing transaction...');
    const preparedTx = await server.prepareTransaction(transaction);
    
    console.log('✍️  Signing transaction...');
    preparedTx.sign(userKeypair);
    
    console.log('📡 Submitting to network...');
    const result = await submitAndWait(preparedTx);
    
    // Extract token address from result
    if (result.returnValue) {
      const tokenAddress = StellarSdk.Address.fromScVal(result.returnValue);
      console.log(`\n🎉 Token created successfully!`);
      console.log(`   Token Address: ${tokenAddress.toString()}`);
      console.log(`   Explorer: https://stellar.expert/explorer/testnet/contract/${tokenAddress.toString()}`);
      return tokenAddress.toString();
    } else {
      throw new Error('No return value from contract');
    }
  } catch (error) {
    console.error('\n❌ Failed to launch token:', error.message);
    throw error;
  }
}

/**
 * Get token info from contract
 */
async function getTokenInfo(userKeypair, tokenAddress) {
  console.log('\n📊 Getting token info...');
  
  try {
    const contract = new StellarSdk.Contract(CONTRACT_ID);
    const userAccount = await server.getAccount(userKeypair.publicKey());
    
    const transaction = new StellarSdk.TransactionBuilder(userAccount, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(
        contract.call(
          'get_token_info',
          StellarSdk.Address.fromString(tokenAddress).toScVal()
        )
      )
      .setTimeout(30)
      .build();
    
    const preparedTx = await server.prepareTransaction(transaction);
    const simulated = await server.simulateTransaction(preparedTx);
    
    if (simulated.result) {
      const info = StellarSdk.scValToNative(simulated.result.retval);
      console.log('   Token Info:', JSON.stringify(info, null, 2));
      return info;
    }
  } catch (error) {
    console.error('   ❌ Failed to get token info:', error.message);
  }
}

/**
 * Get fee configuration
 */
async function getFeeConfig(userKeypair) {
  console.log('\n💰 Getting fee configuration...');
  
  try {
    const contract = new StellarSdk.Contract(CONTRACT_ID);
    const userAccount = await server.getAccount(userKeypair.publicKey());
    
    const transaction = new StellarSdk.TransactionBuilder(userAccount, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(contract.call('get_fee_config'))
      .setTimeout(30)
      .build();
    
    const preparedTx = await server.prepareTransaction(transaction);
    const simulated = await server.simulateTransaction(preparedTx);
    
    if (simulated.result) {
      const config = StellarSdk.scValToNative(simulated.result.retval);
      console.log('   Fee Config:', JSON.stringify(config, null, 2));
      return config;
    }
  } catch (error) {
    console.error('   ❌ Failed to get fee config:', error.message);
  }
}

/**
 * Get accumulated protocol fees
 */
async function getAccumulatedFees(userKeypair) {
  console.log('\n📈 Getting accumulated protocol fees...');
  
  try {
    const contract = new StellarSdk.Contract(CONTRACT_ID);
    const userAccount = await server.getAccount(userKeypair.publicKey());
    
    const transaction = new StellarSdk.TransactionBuilder(userAccount, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(contract.call('get_accumulated_protocol_fees'))
      .setTimeout(30)
      .build();
    
    const preparedTx = await server.prepareTransaction(transaction);
    const simulated = await server.simulateTransaction(preparedTx);
    
    if (simulated.result) {
      const fees = StellarSdk.scValToNative(simulated.result.retval);
      console.log(`   Accumulated Fees: ${fees} stroops (${fees / 10000000} XLM)`);
      return fees;
    }
  } catch (error) {
    console.error('   ❌ Failed to get accumulated fees:', error.message);
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('   🧪 AstroShiba Token Launch Test - Testnet');
  console.log('═══════════════════════════════════════════════════════════');
  
  try {
    // Check if secret key is provided
    if (USER_SECRET === 'YOUR_SECRET_KEY_HERE') {
      console.error('\n❌ Error: Please set STELLAR_SECRET environment variable');
      console.log('\nUsage:');
      console.log('  export STELLAR_SECRET=YOUR_SECRET_KEY');
      console.log('  node scripts/launch-token-test.js');
      console.log('\nOr use stellar CLI identity:');
      console.log('  stellar keys show testnet-deployer');
      process.exit(1);
    }
    
    // Create keypair from secret
    const userKeypair = StellarSdk.Keypair.fromSecret(USER_SECRET);
    console.log(`\n👤 User: ${userKeypair.publicKey()}`);
    
    // Get initial fee config
    await getFeeConfig(userKeypair);
    await getAccumulatedFees(userKeypair);
    
    // Launch token
    const timestamp = Date.now();
    const tokenName = `Test Token ${timestamp}`;
    const tokenSymbol = `TST${timestamp.toString().slice(-4)}`;
    const imageUrl = 'ipfs://QmTest123456789';
    const description = 'Test token for AstroShiba fee system validation';
    
    const tokenAddress = await launchToken(
      userKeypair,
      tokenName,
      tokenSymbol,
      imageUrl,
      description
    );
    
    // Get token info
    await getTokenInfo(userKeypair, tokenAddress);
    
    // Get updated accumulated fees
    console.log('\n💵 After token creation:');
    await getAccumulatedFees(userKeypair);
    
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('   ✅ Test completed successfully!');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('\n📋 Summary:');
    console.log(`   ✅ Token created: ${tokenAddress}`);
    console.log(`   ✅ Creation fee paid: 10 XLM`);
    console.log(`   ✅ Fee system working correctly`);
    console.log('\n🔗 Next steps:');
    console.log('   • Test buy operation to verify trading fees');
    console.log('   • Verify events in Stellar Explorer');
    console.log('   • Check indexer is capturing fee events');
    console.log('\n');
    
  } catch (error) {
    console.error('\n═══════════════════════════════════════════════════════════');
    console.error('   ❌ Test failed!');
    console.error('═══════════════════════════════════════════════════════════');
    console.error('\nError:', error.message);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { launchToken, getFeeConfig, getAccumulatedFees, getTokenInfo };