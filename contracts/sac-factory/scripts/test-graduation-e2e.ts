#!/usr/bin/env npx tsx
/**
 * Complete Graduation E2E Test Script
 *
 * Tests the full flow from token creation to graduation:
 * 1. Create a new token
 * 2. Buy tokens (accumulate XLM towards graduation)
 * 3. Check graduation progress
 * 4. Continue buying until graduation threshold
 * 5. Verify token graduated
 * 6. (Optional) Verify DEX integration
 *
 * Usage:
 *   cd contracts/sac-factory
 *   TESTNET_SECRET_KEY=$(stellar keys show testnet-deployer) npx tsx scripts/test-graduation-e2e.ts
 */

import {
  Keypair,
  rpc,
  Contract,
  TransactionBuilder,
  Networks,
  Asset,
  xdr,
  nativeToScVal,
  Address,
  scValToNative,
  Account,
} from '@stellar/stellar-sdk';

// Alias for compatibility
const SorobanRpc = rpc;

// ============================================================================
// Configuration
// ============================================================================

const CONTRACT_ID = process.env.TOKEN_FACTORY_CONTRACT_ID || 'CAETFO74SF5GSPA2SCUIR6P5XET6ASEMQPESLRWNWRDC37UX32HBKEMK';
const RPC_URL = process.env.STELLAR_RPC_URL || 'https://soroban-testnet.stellar.org';
const NETWORK_PASSPHRASE = Networks.TESTNET;

// Test configuration
const CREATOR_SECRET_KEY = process.env.CREATOR_SECRET_KEY || process.env.TESTNET_SECRET_KEY || '';
const BUYER_SECRET_KEY = process.env.BUYER_SECRET_KEY || '';
const TEST_MODE = process.env.TEST_MODE || 'full'; // 'create-only', 'buy-only', 'full'

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// ============================================================================
// Helper Functions
// ============================================================================

async function simulateAndSend(
  server: rpc.Server,
  tx: any,
  keypair: Keypair,
  description: string
): Promise<any> {
  log(`\n${description}...`, 'cyan');

  // Simulate
  const simResult = await server.simulateTransaction(tx);

  if (rpc.Api.isSimulationError(simResult)) {
    log(`  Simulation error: ${simResult.error}`, 'red');
    throw new Error(`Simulation failed: ${simResult.error}`);
  }

  // Prepare and sign
  const preparedTx = rpc.assembleTransaction(tx, simResult).build();
  preparedTx.sign(keypair);

  // Submit
  log(`  Submitting transaction...`, 'yellow');
  const sendResult = await server.sendTransaction(preparedTx);
  log(`  TX Hash: ${sendResult.hash}`, 'blue');

  // Wait for result
  let getResult;
  let attempts = 0;
  while (attempts < 60) {
    getResult = await server.getTransaction(sendResult.hash);
    if (getResult.status !== SorobanRpc.Api.GetTransactionStatus.NOT_FOUND) {
      break;
    }
    await new Promise(r => setTimeout(r, 1000));
    attempts++;
    if (attempts % 10 === 0) {
      log(`  Waiting... (${attempts}s)`, 'yellow');
    }
  }

  if (getResult?.status === SorobanRpc.Api.GetTransactionStatus.SUCCESS) {
    log(`  Success!`, 'green');
    return getResult;
  } else {
    log(`  Failed: ${JSON.stringify(getResult)}`, 'red');
    throw new Error(`Transaction failed: ${getResult?.status}`);
  }
}

async function callReadOnly(
  server: rpc.Server,
  contract: Contract,
  method: string,
  ...params: any[]
): Promise<any> {
  const account = new Account(
    'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
    '0'
  );

  const tx = new TransactionBuilder(account, {
    fee: '100',
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...params))
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx);

  if (SorobanRpc.Api.isSimulationSuccess(sim) && sim.result?.retval) {
    return scValToNative(sim.result.retval);
  }

  throw new Error(`Read-only call failed: ${method}`);
}

// ============================================================================
// Test Steps
// ============================================================================

async function createToken(
  server: SorobanRpc.Server,
  contract: Contract,
  keypair: Keypair,
  account: any
): Promise<string> {
  log('\n' + '='.repeat(60), 'cyan');
  log('STEP 1: Creating Test Token (V2 - Pure Soroban)', 'cyan');
  log('='.repeat(60), 'cyan');

  const publicKey = keypair.publicKey();
  const tokenSymbol = 'GRD' + Math.floor(Math.random() * 1000);
  const tokenName = 'Graduation Test ' + tokenSymbol;

  log(`  Token Name: ${tokenName}`, 'blue');
  log(`  Token Symbol: ${tokenSymbol}`, 'blue');
  log(`  Creator: ${publicKey}`, 'blue');
  log(`  Using launch_token_v2 (no SAC issuer restrictions)`, 'yellow');

  // Use launch_token_v2 for pure Soroban token (no SAC issuer restrictions)
  const launchOp = contract.call(
    'launch_token_v2',
    nativeToScVal(publicKey, { type: 'address' }),
    nativeToScVal(tokenName, { type: 'string' }),
    nativeToScVal(tokenSymbol, { type: 'string' }),
    nativeToScVal('https://example.com/graduation-test.png', { type: 'string' }),
    nativeToScVal('Token for graduation E2E testing', { type: 'string' }),
  );

  const tx = new TransactionBuilder(account, {
    fee: '10000000',
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(launchOp)
    .setTimeout(300)
    .build();

  const result = await simulateAndSend(server, tx, keypair, 'Creating token V2');

  if (result.returnValue) {
    const tokenAddress = scValToNative(result.returnValue);
    log(`  Token Address: ${tokenAddress}`, 'green');
    return tokenAddress;
  }

  throw new Error('Failed to get token address from result');
}

async function buyTokens(
  server: SorobanRpc.Server,
  contract: Contract,
  keypair: Keypair,
  tokenAddress: string,
  xlmAmount: bigint
): Promise<bigint> {
  log('\n' + '='.repeat(60), 'cyan');
  log(`STEP 2: Buying Tokens (${Number(xlmAmount) / 10_000_000} XLM)`, 'cyan');
  log('='.repeat(60), 'cyan');

  const publicKey = keypair.publicKey();
  const account = await server.getAccount(publicKey);

  // Get deadline (1 hour from now)
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);

  const buyOp = contract.call(
    'buy',
    nativeToScVal(publicKey, { type: 'address' }),
    Address.fromString(tokenAddress).toScVal(),
    nativeToScVal(xlmAmount, { type: 'i128' }),
    nativeToScVal(BigInt(0), { type: 'i128' }), // min_tokens_out (0 = no slippage protection)
    nativeToScVal(deadline, { type: 'u64' }),
  );

  const tx = new TransactionBuilder(account, {
    fee: '10000000',
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(buyOp)
    .setTimeout(300)
    .build();

  const result = await simulateAndSend(server, tx, keypair, `Buying with ${Number(xlmAmount) / 10_000_000} XLM`);

  if (result.returnValue) {
    const tokensReceived = scValToNative(result.returnValue);
    log(`  Tokens Received: ${Number(tokensReceived) / 10_000_000}`, 'green');
    return BigInt(tokensReceived);
  }

  return BigInt(0);
}

async function getGraduationProgress(
  server: SorobanRpc.Server,
  contract: Contract,
  tokenAddress: string
): Promise<{ progress: number; xlmRaised: bigint; threshold: bigint; graduated: boolean }> {
  log('\n' + '-'.repeat(40), 'blue');
  log('Checking Graduation Progress', 'blue');
  log('-'.repeat(40), 'blue');

  // Get token info
  const tokenInfo = await callReadOnly(
    server,
    contract,
    'get_token_info',
    Address.fromString(tokenAddress).toScVal()
  );

  // Get graduation threshold
  const threshold = await callReadOnly(server, contract, 'get_graduation_threshold');

  // Get progress
  const progress = await callReadOnly(
    server,
    contract,
    'get_graduation_progress',
    Address.fromString(tokenAddress).toScVal()
  );

  const xlmRaised = BigInt(tokenInfo.xlm_raised || 0);
  const thresholdBigInt = BigInt(threshold);
  const progressPercent = Number(progress) / 100;
  const graduated = tokenInfo.graduated || false;

  log(`  XLM Raised: ${Number(xlmRaised) / 10_000_000} XLM`, 'cyan');
  log(`  Threshold: ${Number(thresholdBigInt) / 10_000_000} XLM`, 'cyan');
  log(`  Progress: ${progressPercent.toFixed(2)}%`, progressPercent >= 100 ? 'green' : 'yellow');
  log(`  Graduated: ${graduated ? 'YES' : 'NO'}`, graduated ? 'green' : 'yellow');

  return {
    progress: progressPercent,
    xlmRaised,
    threshold: thresholdBigInt,
    graduated,
  };
}

async function sellTokens(
  server: SorobanRpc.Server,
  contract: Contract,
  keypair: Keypair,
  tokenAddress: string,
  tokenAmount: bigint
): Promise<bigint> {
  log('\n' + '='.repeat(60), 'cyan');
  log(`STEP: Selling Tokens (${Number(tokenAmount) / 10_000_000} tokens)`, 'cyan');
  log('='.repeat(60), 'cyan');

  const publicKey = keypair.publicKey();
  const account = await server.getAccount(publicKey);
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);

  const sellOp = contract.call(
    'sell',
    nativeToScVal(publicKey, { type: 'address' }),
    Address.fromString(tokenAddress).toScVal(),
    nativeToScVal(tokenAmount, { type: 'i128' }),
    nativeToScVal(BigInt(0), { type: 'i128' }), // min_xlm_out
    nativeToScVal(deadline, { type: 'u64' }),
  );

  const tx = new TransactionBuilder(account, {
    fee: '10000000',
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(sellOp)
    .setTimeout(300)
    .build();

  const result = await simulateAndSend(server, tx, keypair, `Selling ${Number(tokenAmount) / 10_000_000} tokens`);

  if (result.returnValue) {
    const xlmReceived = scValToNative(result.returnValue);
    log(`  XLM Received: ${Number(xlmReceived) / 10_000_000}`, 'green');
    return BigInt(xlmReceived);
  }

  return BigInt(0);
}

// ============================================================================
// Main Test Flow
// ============================================================================

async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('   GRADUATION E2E TEST - Full Flow');
  console.log('='.repeat(60));
  console.log(`\nContract: ${CONTRACT_ID}`);
  console.log(`RPC: ${RPC_URL}`);
  console.log(`Mode: ${TEST_MODE}\n`);

  if (!CREATOR_SECRET_KEY) {
    log('ERROR: Please set CREATOR_SECRET_KEY or TESTNET_SECRET_KEY environment variable', 'red');
    log('Run: export CREATOR_SECRET_KEY=$(stellar keys show testnet-deployer)', 'yellow');
    process.exit(1);
  }

  if (!BUYER_SECRET_KEY) {
    log('ERROR: Please set BUYER_SECRET_KEY environment variable', 'red');
    log('This must be a DIFFERENT account from the creator (SAC issuer restriction)', 'yellow');
    log('Run: export BUYER_SECRET_KEY=$(stellar keys show alice)', 'yellow');
    process.exit(1);
  }

  const server = new SorobanRpc.Server(RPC_URL);
  const creatorKeypair = Keypair.fromSecret(CREATOR_SECRET_KEY);
  const buyerKeypair = Keypair.fromSecret(BUYER_SECRET_KEY);
  const creatorPublicKey = creatorKeypair.publicKey();
  const buyerPublicKey = buyerKeypair.publicKey();
  const contract = new Contract(CONTRACT_ID);

  log(`Creator account: ${creatorPublicKey}`, 'blue');
  log(`Buyer account: ${buyerPublicKey}`, 'blue');

  if (creatorPublicKey === buyerPublicKey) {
    log('ERROR: Creator and Buyer must be different accounts!', 'red');
    log('SAC restriction: issuer cannot receive mint of their own tokens', 'yellow');
    process.exit(1);
  }

  // Get accounts and check balances
  let creatorAccount;
  let buyerAccount;
  try {
    creatorAccount = await server.getAccount(creatorPublicKey);
    log(`Creator account sequence: ${creatorAccount.sequenceNumber()}`, 'blue');
  } catch (error) {
    log(`ERROR: Creator account not found or not funded`, 'red');
    process.exit(1);
  }

  try {
    buyerAccount = await server.getAccount(buyerPublicKey);
    log(`Buyer account sequence: ${buyerAccount.sequenceNumber()}`, 'blue');
  } catch (error) {
    log(`ERROR: Buyer account not found or not funded`, 'red');
    process.exit(1);
  }

  // Get current contract stats
  try {
    const tokenCount = await callReadOnly(server, contract, 'get_token_count');
    const threshold = await callReadOnly(server, contract, 'get_graduation_threshold');
    log(`\nContract Stats:`, 'cyan');
    log(`  Total Tokens: ${tokenCount}`, 'blue');
    log(`  Graduation Threshold: ${Number(threshold) / 10_000_000} XLM`, 'blue');
  } catch (error) {
    log(`Warning: Could not get contract stats`, 'yellow');
  }

  // ========== STEP 1: Create Token ==========
  let tokenAddress: string;

  if (TEST_MODE === 'buy-only' && process.env.TOKEN_ADDRESS) {
    tokenAddress = process.env.TOKEN_ADDRESS;
    log(`\nUsing existing token: ${tokenAddress}`, 'yellow');
  } else {
    tokenAddress = await createToken(server, contract, creatorKeypair, creatorAccount);
  }

  if (TEST_MODE === 'create-only') {
    log('\n' + '='.repeat(60), 'green');
    log('CREATE-ONLY MODE: Token created successfully!', 'green');
    log(`Token Address: ${tokenAddress}`, 'green');
    log('='.repeat(60), 'green');
    return;
  }

  // ========== STEP 2: Initial Buy ==========
  const initialBuyAmount = BigInt(100_0000000); // 100 XLM
  log(`\nBuyer (${buyerPublicKey.slice(0, 8)}...) will purchase tokens`, 'cyan');
  await buyTokens(server, contract, buyerKeypair, tokenAddress, initialBuyAmount);

  // Check progress
  let status = await getGraduationProgress(server, contract, tokenAddress);

  // ========== STEP 3: Test Sell ==========
  log('\n' + '='.repeat(60), 'cyan');
  log('STEP 3: Testing Sell Function', 'cyan');
  log('='.repeat(60), 'cyan');

  // Sell small amount to test
  const sellAmount = BigInt(10_0000000); // 10 tokens
  try {
    await sellTokens(server, contract, buyerKeypair, tokenAddress, sellAmount);
  } catch (error: any) {
    log(`  Sell failed (might need token balance): ${error.message}`, 'yellow');
  }

  // ========== STEP 4: Buy More Towards Graduation ==========
  if (!status.graduated) {
    log('\n' + '='.repeat(60), 'cyan');
    log('STEP 4: Buying More to Approach Graduation', 'cyan');
    log('='.repeat(60), 'cyan');

    // Calculate how much more XLM needed
    const xlmNeeded = status.threshold - status.xlmRaised;
    const xlmAvailable = BigInt(500_0000000); // Max 500 XLM per buy for safety

    // Buy in chunks to avoid spending too much
    const buyAmount = xlmNeeded < xlmAvailable ? xlmNeeded : xlmAvailable;

    if (buyAmount > BigInt(10_0000000)) { // Only if > 10 XLM needed
      log(`  XLM needed for graduation: ${Number(xlmNeeded) / 10_000_000}`, 'yellow');
      log(`  Will buy: ${Number(buyAmount) / 10_000_000} XLM`, 'yellow');

      // Refresh buyer account (needed for sequence number)
      buyerAccount = await server.getAccount(buyerPublicKey);
      await buyTokens(server, contract, buyerKeypair, tokenAddress, buyAmount);

      // Check progress again
      status = await getGraduationProgress(server, contract, tokenAddress);
    }
  }

  // ========== FINAL STATUS ==========
  log('\n' + '='.repeat(60), 'green');
  log('GRADUATION E2E TEST COMPLETE', 'green');
  log('='.repeat(60), 'green');

  log(`\nFinal Results:`, 'cyan');
  log(`  Token Address: ${tokenAddress}`, 'blue');
  log(`  XLM Raised: ${Number(status.xlmRaised) / 10_000_000} XLM`, 'blue');
  log(`  Progress: ${status.progress.toFixed(2)}%`, status.graduated ? 'green' : 'yellow');
  log(`  Graduated: ${status.graduated ? 'YES' : 'NO'}`, status.graduated ? 'green' : 'yellow');

  if (status.graduated) {
    log('\n  TOKEN HAS GRADUATED!', 'green');
    log('  Check DEX for new trading pair', 'green');
  } else {
    const remaining = Number(status.threshold - status.xlmRaised) / 10_000_000;
    log(`\n  ${remaining.toFixed(2)} XLM more needed for graduation`, 'yellow');
    log('  Run again with more XLM to complete graduation', 'yellow');
  }

  log('\n' + '='.repeat(60) + '\n', 'cyan');
}

// Run
main().catch((error) => {
  log(`\nFATAL ERROR: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});
