/**
 * Create trustline for treasury account for TEST9
 */

import {
  Keypair,
  TransactionBuilder,
  Operation,
  Asset,
  Account,
} from '@stellar/stellar-sdk';

const CONFIG = {
  horizonUrl: 'https://horizon-testnet.stellar.org',
  passphrase: 'Test SDF Network ; September 2015',
  issuerAddress: 'GDRHSNLULHMVSQO5WAUZI7RDPJFUXWHSGKDYLCU5P2BAARSAB7K3LLVN',
  symbol: 'TEST9',
};

// Treasury secret (this is actually testnet-deployer, but used as treasury in the contract)
const TREASURY_SECRET = 'SBLK5NCAL63Z3MS4NL5T2H7A6BQHDUEJMN5ETHPGE6AIGIK5TEYNWX5R';

// Actual treasury address that receives creator fee
const ACTUAL_TREASURY = 'GCNNAUR5SCD2NXBXOIL32J7IJQ7N2RPTQH3T27FR5NGUOVK2L4HXPD2E';

async function createTrustline(keypair, asset) {
  console.log('Creating trustline for', keypair.publicKey());
  console.log('Asset:', asset.code, ':', asset.issuer);

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

async function main() {
  const asset = new Asset(CONFIG.symbol, CONFIG.issuerAddress);

  // Create trustline for testnet-deployer (which is used as treasury in buy script)
  const deployerKeypair = Keypair.fromSecret(TREASURY_SECRET);
  await createTrustline(deployerKeypair, asset);

  // The actual treasury that receives creator fee is different
  // We need to check if GCNNAUR5SCD2NXBXOIL32J7IJQ7N2RPTQH3T27FR5NGUOVK2L4HXPD2E
  // is a different account. Looking at the error, it seems the creator fee
  // is trying to mint to treasury.

  // The error says trustline missing for GCNNAUR5SCD2NXBXOIL32J7IJQ7N2RPTQH3T27FR5NGUOVK2L4HXPD2E
  // which is the configured treasury address. Let me check if we have access to it.

  console.log('\nNote: The actual treasury (GCNNAUR5...) also needs a trustline.');
  console.log('If you have access to that account, add a trustline manually.');
}

main().catch(console.error);
