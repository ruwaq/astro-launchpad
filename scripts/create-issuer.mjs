import { Keypair, Asset } from '@stellar/stellar-sdk';
import { createHash } from 'crypto';

const symbol = process.argv[2] || 'TEST9';
const creator = 'GB2XFP6XK2MPOGURZCEH3KISW7W657IXC3MJZKG5MNBFMUSUNX3QWCFJ'; // testnet-deployer
const tokenCount = parseInt(process.argv[3] || '1');

// Create unique issuer keypair
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

const issuerKeypair = createUniqueIssuerKeypair(symbol, creator, tokenCount, 0);
console.log('Symbol:', symbol);
console.log('Token count:', tokenCount);
console.log('Issuer public key:', issuerKeypair.publicKey());
console.log('Issuer secret:', issuerKeypair.secret());

// Create serialized asset
const asset = new Asset(symbol, issuerKeypair.publicKey());
const assetXDR = asset.toXDRObject().toXDR('hex');
console.log('Asset XDR (hex):', assetXDR);
