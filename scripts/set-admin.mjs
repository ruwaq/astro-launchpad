/**
 * Set Factory as Token Admin
 * Derives the issuer keypair and calls set_admin
 */

import {
  Keypair,
  Contract,
  TransactionBuilder,
  SorobanRpc,
  nativeToScVal,
  Address,
  authorizeEntry,
} from '@stellar/stellar-sdk';
import { createHash } from 'crypto';

// Configuration
const CONFIG = {
  rpcUrl: 'https://soroban-testnet.stellar.org',
  passphrase: 'Test SDF Network ; September 2015',
  factoryContract: 'CDAGI666QPS2QU4RVUXW4WFHABETECXQVJVFNTAJJJCGS36XX6R3AWSC',
  tokenAddress: 'CBSOJIEQEGWLJYMAAOLSEE3FC7LEKQNUWXY2IWAGULQQKRFZYN4VO5PO',
  creatorAddress: 'GB2XFP6XK2MPOGURZCEH3KISW7W657IXC3MJZKG5MNBFMUSUNX3QWCFJ',
  symbol: 'TEST9',
  tokenCount: 1,
};

// Derive issuer keypair (must match createUniqueIssuerKeypair in asset-utils.ts)
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

async function main() {
  console.log('=== Setting Factory as Token Admin ===');
  console.log('Token:', CONFIG.tokenAddress);
  console.log('Factory:', CONFIG.factoryContract);

  // Derive the issuer keypair
  const issuerKeypair = createUniqueIssuerKeypair(
    CONFIG.symbol,
    CONFIG.creatorAddress,
    CONFIG.tokenCount,
    0 // Fixed timestamp
  );

  console.log('Issuer public key:', issuerKeypair.publicKey());
  console.log('Expected:', 'GDRHSNLULHMVSQO5WAUZI7RDPJFUXWHSGKDYLCU5P2BAARSAB7K3LLVN');

  // Verify we have the right issuer
  if (issuerKeypair.publicKey() !== 'GDRHSNLULHMVSQO5WAUZI7RDPJFUXWHSGKDYLCU5P2BAARSAB7K3LLVN') {
    throw new Error('Issuer mismatch! Cannot proceed.');
  }

  console.log('✓ Issuer keypair derived correctly');

  // Initialize server
  const server = new SorobanRpc.Server(CONFIG.rpcUrl);

  // Get source account (issuer)
  const issuerAddress = issuerKeypair.publicKey();
  const sourceAccount = await server.getAccount(issuerAddress);

  // Build set_admin call on the token contract
  const tokenContract = new Contract(CONFIG.tokenAddress);
  const setAdminOp = tokenContract.call(
    'set_admin',
    nativeToScVal(Address.fromString(CONFIG.factoryContract), { type: 'address' })
  );

  const tx = new TransactionBuilder(sourceAccount, {
    fee: '10000000', // 1 XLM
    networkPassphrase: CONFIG.passphrase,
  })
    .addOperation(setAdminOp)
    .setTimeout(120)
    .build();

  // Simulate
  console.log('Simulating set_admin...');
  const simulated = await server.simulateTransaction(tx);

  if ('error' in simulated) {
    console.error('Simulation error:', simulated.error);
    throw new Error(`Simulation failed: ${simulated.error}`);
  }

  console.log('✓ Simulation successful');

  // Sign auth entries with issuer keypair
  const latestLedger = await server.getLatestLedger();
  const validUntilLedger = latestLedger.sequence + 1000;

  const simulationResult = simulated;
  if (simulationResult.result?.auth && simulationResult.result.auth.length > 0) {
    console.log(`Signing ${simulationResult.result.auth.length} auth entries...`);

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
    console.error('Send error:', sendResponse.errorResult?.toXDR('base64'));
    throw new Error(`Transaction failed: ${sendResponse.errorResult?.toXDR('base64')}`);
  }

  console.log('Transaction submitted, hash:', sendResponse.hash);

  // Wait for confirmation
  let attempts = 0;
  while (attempts < 60) {
    const getResponse = await server.getTransaction(sendResponse.hash);

    if (getResponse.status === 'SUCCESS') {
      console.log('✓ Factory set as admin! Hash:', sendResponse.hash);
      return;
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

main().catch(console.error);
