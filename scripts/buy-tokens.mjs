/**
 * Buy tokens to trigger graduation
 * Creates trustline and buys tokens via factory
 */

import {
  Keypair,
  Contract,
  TransactionBuilder,
  SorobanRpc,
  nativeToScVal,
  Address,
  Operation,
  Asset,
  Account,
} from '@stellar/stellar-sdk';

// Configuration
const CONFIG = {
  rpcUrl: 'https://soroban-testnet.stellar.org',
  horizonUrl: 'https://horizon-testnet.stellar.org',
  passphrase: 'Test SDF Network ; September 2015',
  factoryContract: 'CDAGI666QPS2QU4RVUXW4WFHABETECXQVJVFNTAJJJCGS36XX6R3AWSC',
  tokenAddress: 'CBSOJIEQEGWLJYMAAOLSEE3FC7LEKQNUWXY2IWAGULQQKRFZYN4VO5PO',
  issuerAddress: 'GDRHSNLULHMVSQO5WAUZI7RDPJFUXWHSGKDYLCU5P2BAARSAB7K3LLVN',
  symbol: 'TEST9',
};

// SECURITY: Load secrets from environment variables, never hardcode
const BUYER_SECRET = process.env.BUYER_SECRET;
const TREASURY_SECRET = process.env.TREASURY_SECRET;

if (!BUYER_SECRET || !TREASURY_SECRET) {
  console.error('❌ Missing required environment variables:');
  console.error('   BUYER_SECRET - Stellar secret key for buyer account');
  console.error('   TREASURY_SECRET - Stellar secret key for treasury account');
  console.error('\nSet them in your environment or .env.local file');
  process.exit(1);
}

async function createTrustline(keypair, asset) {
  console.log(`Creating trustline for ${keypair.publicKey()}...`);

  // Get account from Horizon
  const response = await fetch(`${CONFIG.horizonUrl}/accounts/${keypair.publicKey()}`);
  const accountData = await response.json();

  // Check if trustline already exists
  const existingTrustline = accountData.balances?.find(
    b => b.asset_code === asset.code && b.asset_issuer === asset.issuer
  );

  if (existingTrustline) {
    console.log('Trustline already exists');
    return true;
  }

  // Build trustline transaction
  const tx = new TransactionBuilder(
    new Account(keypair.publicKey(), accountData.sequence),
    {
      fee: '100000',
      networkPassphrase: CONFIG.passphrase,
    }
  )
    .addOperation(Operation.changeTrust({ asset }))
    .setTimeout(30)
    .build();

  tx.sign(keypair);

  // Submit to Horizon
  const submitResponse = await fetch(`${CONFIG.horizonUrl}/transactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `tx=${encodeURIComponent(tx.toXDR())}`,
  });

  const result = await submitResponse.json();
  if (submitResponse.ok) {
    console.log('✓ Trustline created');
    return true;
  } else {
    console.error('Trustline error:', result);
    return false;
  }
}

async function buyTokens(server, buyerKeypair, xlmAmount) {
  console.log(`\n=== Buying ${Number(xlmAmount) / 10000000} XLM worth of tokens ===`);

  const buyerAddress = buyerKeypair.publicKey();
  const sourceAccount = await server.getAccount(buyerAddress);

  // Build buy call
  const factoryContract = new Contract(CONFIG.factoryContract);
  const deadline = Math.floor(Date.now() / 1000) + 300; // 5 minutes

  const buyOp = factoryContract.call(
    'buy',
    nativeToScVal(Address.fromString(buyerAddress), { type: 'address' }),
    nativeToScVal(Address.fromString(CONFIG.tokenAddress), { type: 'address' }),
    nativeToScVal(BigInt(xlmAmount.toString()), { type: 'i128' }),
    nativeToScVal(BigInt(0), { type: 'i128' }), // min_tokens = 0
    nativeToScVal(BigInt(deadline), { type: 'u64' })
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

  console.log('✓ Simulation successful');
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

  // Check status via RPC API (avoid SDK parsing issue)
  let attempts = 0;
  while (attempts < 120) {
    try {
      const statusResponse = await fetch(CONFIG.rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getTransaction',
          params: { hash: sendResponse.hash }
        })
      });
      const statusResult = await statusResponse.json();

      if (statusResult.result?.status === 'SUCCESS') {
        console.log('✓ Buy successful!');
        return sendResponse.hash;
      } else if (statusResult.result?.status === 'FAILED') {
        console.error('Transaction failed');
        throw new Error('Transaction failed on the network');
      }
    } catch (e) {
      // Ignore parsing errors
    }

    if (attempts % 10 === 0) {
      console.log(`Waiting for confirmation... attempt ${attempts}`);
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
    attempts++;
  }

  throw new Error('Transaction confirmation timeout');
}

async function main() {
  console.log('=== Buy Tokens to Trigger Graduation ===');
  console.log('Token:', CONFIG.tokenAddress);
  console.log('Factory:', CONFIG.factoryContract);

  const buyerKeypair = Keypair.fromSecret(BUYER_SECRET);
  const treasuryKeypair = Keypair.fromSecret(TREASURY_SECRET);

  console.log('Buyer:', buyerKeypair.publicKey());
  console.log('Treasury:', treasuryKeypair.publicKey());

  // Create asset
  const asset = new Asset(CONFIG.symbol, CONFIG.issuerAddress);

  // Create trustlines
  console.log('\n=== Creating Trustlines ===');
  await createTrustline(buyerKeypair, asset);
  await createTrustline(treasuryKeypair, asset);

  // Initialize Soroban server
  const server = new SorobanRpc.Server(CONFIG.rpcUrl);

  // Buy tokens - 150 XLM to trigger graduation
  const xlmAmount = BigInt(150 * 10000000); // 150 XLM in stroops
  const hash = await buyTokens(server, buyerKeypair, xlmAmount);

  console.log('\n=== Checking Token Status ===');

  // Check token info after buy
  const sourceAccount = await server.getAccount(buyerKeypair.publicKey());
  const factoryContract = new Contract(CONFIG.factoryContract);

  const tx = new TransactionBuilder(sourceAccount, {
    fee: '100000',
    networkPassphrase: CONFIG.passphrase,
  })
    .addOperation(factoryContract.call(
      'get_token_info',
      nativeToScVal(Address.fromString(CONFIG.tokenAddress), { type: 'address' })
    ))
    .setTimeout(30)
    .build();

  const simulated = await server.simulateTransaction(tx);
  if ('result' in simulated && simulated.result?.retval) {
    console.log('Token Info after buy:');
    console.log(JSON.stringify(simulated.result.retval, null, 2));
  }

  console.log('\n=== Test Complete! ===');
  console.log('Buy transaction hash:', hash);
}

main().catch(console.error);
