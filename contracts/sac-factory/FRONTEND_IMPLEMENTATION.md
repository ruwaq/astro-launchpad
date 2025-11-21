# Frontend Implementation Guide - SAC Factory

## 🎯 Contract Deployed

**New Contract ID**: `CC5CNOA5KDC5AC6JQ3W57ISFXGHLV5HLVGXY4IX7XTEYS3UJTUIHZ6U6`

**Old Contract ID**: `CACNGYHX7IIM4ED3GO2VNZUE4GGL6BL3G2S6ZBNQSFOZNSZHDNMJ26TF` (deprecated)

**Network**: Stellar Testnet

**Explorer**: https://stellar.expert/explorer/testnet/contract/CC5CNOA5KDC5AC6JQ3W57ISFXGHLV5HLVGXY4IX7XTEYS3UJTUIHZ6U6

---

## 📦 Required Dependencies

```bash
npm install @stellar/stellar-sdk @stellar/freighter-api buffer
```

Or with yarn:
```bash
yarn add @stellar/stellar-sdk @stellar/freighter-api buffer
```

---

## 🚀 Complete Implementation Example

### 1. Setup and Imports

```typescript
import { Asset, Keypair, Networks, xdr } from '@stellar/stellar-sdk';
import * as freighter from '@stellar/freighter-api';
import { Buffer } from 'buffer';
import { Contract, SorobanRpc } from '@stellar/stellar-sdk';

// Contract address on testnet
const CONTRACT_ID = 'CC5CNOA5KDC5AC6JQ3W57ISFXGHLV5HLVGXY4IX7XTEYS3UJTUIHZ6U6';

// Soroban RPC endpoint
const RPC_URL = 'https://soroban-testnet.stellar.org';
const rpc = new SorobanRpc.Server(RPC_URL);
```

### 2. Create Unique Issuer for Token

```typescript
import crypto from 'crypto';

/**
 * Creates a unique issuer public key for a new token
 * This issuer is deterministic but NOT a funded Stellar account
 */
function createUniqueIssuer(
    symbol: string,
    creator: string,
    tokenCount: number,
    timestamp: number = Date.now()
): string {
    // Create unique seed
    const seedParts = [
        'SAC_ISSUER_V3',      // Version prefix
        tokenCount.toString(),  // Unique count
        timestamp.toString(),   // Timestamp
        symbol,                 // Token symbol
        creator,                // Creator address
    ];

    const seed = Buffer.concat(seedParts.map(s => Buffer.from(s)));

    // Hash to create 32-byte seed
    const issuerSeed = crypto.createHash('sha256').update(seed).digest();

    // Create deterministic keypair (we only need the public key)
    const keypair = Keypair.fromRawEd25519Seed(issuerSeed);

    return keypair.publicKey();
}
```

### 3. Create and Serialize Asset XDR

```typescript
/**
 * Creates a Stellar Asset and serializes it to XDR bytes
 */
function createSerializedAsset(
    symbol: string,
    issuerPublicKey: string
): Buffer {
    // Create the Stellar Asset
    // stellar-sdk automatically chooses AlphaNum4 or AlphaNum12 based on symbol length
    const asset = new Asset(symbol, issuerPublicKey);

    // Convert to XDR object
    const assetXDR = asset.toXDRObject();

    // Serialize to bytes
    const serializedAsset = assetXDR.toXDR();

    return serializedAsset;
}
```

### 4. Convert to Soroban Bytes Format

```typescript
/**
 * Converts Buffer to Soroban Bytes ScVal
 */
function bufferToSorobanBytes(buffer: Buffer): xdr.ScVal {
    return xdr.ScVal.scvBytes(buffer);
}
```

### 5. Complete Launch Token Function

```typescript
/**
 * Launch a new meme token on Stellar
 */
async function launchToken(params: {
    name: string;
    symbol: string;
    imageUrl: string;
    description: string;
    tokenCount: number;
}) {
    const { name, symbol, imageUrl, description, tokenCount } = params;

    try {
        // Step 1: Connect wallet
        const userPublicKey = await freighter.getPublicKey();
        if (!userPublicKey) {
            throw new Error('Please connect your Freighter wallet');
        }

        // Step 2: Create unique issuer
        const issuerPublicKey = createUniqueIssuer(
            symbol,
            userPublicKey,
            tokenCount
        );

        console.log('Created unique issuer:', issuerPublicKey);

        // Step 3: Create and serialize Asset XDR
        const serializedAssetBuffer = createSerializedAsset(symbol, issuerPublicKey);
        const serializedAssetScVal = bufferToSorobanBytes(serializedAssetBuffer);

        console.log('Serialized asset created');

        // Step 4: Prepare contract call
        const contract = new Contract(CONTRACT_ID);

        // Build the transaction
        const account = await rpc.getAccount(userPublicKey);

        const tx = new SorobanRpc.TransactionBuilder(account, {
            fee: '1000000', // 0.1 XLM fee
            networkPassphrase: Networks.TESTNET,
        })
            .addOperation(
                contract.call(
                    'launch_token',
                    ...[
                        // creator: Address
                        xdr.ScVal.scvAddress(
                            xdr.ScAddress.scAddressTypeAccount(
                                xdr.PublicKey.publicKeyTypeEd25519(
                                    Keypair.fromPublicKey(userPublicKey).rawPublicKey()
                                )
                            )
                        ),
                        // name: String
                        xdr.ScVal.scvString(name),
                        // symbol: String
                        xdr.ScVal.scvString(symbol),
                        // image_url: String
                        xdr.ScVal.scvString(imageUrl),
                        // description: String
                        xdr.ScVal.scvString(description),
                        // serialized_asset: Bytes
                        serializedAssetScVal,
                    ]
                )
            )
            .setTimeout(30)
            .build();

        // Step 5: Simulate transaction
        const simulated = await rpc.simulateTransaction(tx);

        if (SorobanRpc.Api.isSimulationError(simulated)) {
            throw new Error(`Simulation failed: ${simulated.error}`);
        }

        // Step 6: Prepare and sign transaction
        const preparedTx = SorobanRpc.assembleTransaction(
            tx,
            simulated
        ).build();

        // Sign with Freighter
        const signedXDR = await freighter.signTransaction(
            preparedTx.toXDR(),
            {
                networkPassphrase: Networks.TESTNET,
            }
        );

        // Step 7: Submit transaction
        const signedTx = SorobanRpc.TransactionBuilder.fromXDR(
            signedXDR,
            Networks.TESTNET
        );

        const sendResponse = await rpc.sendTransaction(signedTx);

        // Step 8: Wait for confirmation
        let getResponse = await rpc.getTransaction(sendResponse.hash);

        while (getResponse.status === 'NOT_FOUND') {
            await new Promise(resolve => setTimeout(resolve, 1000));
            getResponse = await rpc.getTransaction(sendResponse.hash);
        }

        if (getResponse.status === 'SUCCESS') {
            // Extract token address from result
            const resultValue = getResponse.returnValue;
            // Parse the Address from ScVal
            const tokenAddress = resultValue; // This will be the Address ScVal

            console.log('Token launched successfully!');
            console.log('Token Address:', tokenAddress);

            return {
                success: true,
                tokenAddress: tokenAddress.toString(),
                transactionHash: sendResponse.hash,
            };
        } else {
            throw new Error(`Transaction failed: ${getResponse.status}`);
        }
    } catch (error) {
        console.error('Error launching token:', error);
        throw error;
    }
}
```

### 6. Usage Example (React Component)

```typescript
import { useState } from 'react';

export function TokenLauncher() {
    const [name, setName] = useState('');
    const [symbol, setSymbol] = useState('');
    const [imageUrl, setImageUrl] = useState('');
    const [description, setDescription] = useState('');
    const [tokenCount, setTokenCount] = useState(0);
    const [loading, setLoading] = useState(false);

    const handleLaunch = async () => {
        if (!name || !symbol) {
            alert('Please fill in all required fields');
            return;
        }

        setLoading(true);

        try {
            const result = await launchToken({
                name,
                symbol,
                imageUrl,
                description,
                tokenCount,
            });

            alert(`Token launched! Address: ${result.tokenAddress}`);

            // Increment token count for next launch
            setTokenCount(prev => prev + 1);

            // Reset form
            setName('');
            setSymbol('');
            setImageUrl('');
            setDescription('');
        } catch (error) {
            alert(`Failed to launch token: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="token-launcher">
            <h2>Launch Your Meme Token</h2>

            <input
                type="text"
                placeholder="Token Name (e.g., Doge Shiba)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={32}
            />

            <input
                type="text"
                placeholder="Symbol (e.g., DSHIB, max 12 chars)"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                maxLength={12}
            />

            <input
                type="text"
                placeholder="Image URL (e.g., ipfs://...)"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
            />

            <textarea
                placeholder="Description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
            />

            <button
                onClick={handleLaunch}
                disabled={loading}
            >
                {loading ? 'Launching...' : 'Launch Token (0.01 XLM)'}
            </button>

            <p className="note">
                Each token gets a unique issuer address generated deterministically
            </p>
        </div>
    );
}
```

---

## 🔒 Security Considerations

### 1. Issuer Uniqueness

```typescript
// ✅ GOOD: Unique issuer per token
const issuer1 = createUniqueIssuer('TEST', creator, 0, 1000);
const issuer2 = createUniqueIssuer('TEST', creator, 1, 1001);
// These will be DIFFERENT issuers

// ❌ BAD: Reusing same issuer
const issuer = 'GCONSISTENTKEYXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
// Will fail with "contract already exists" error
```

### 2. Symbol Validation

```typescript
function validateSymbol(symbol: string): boolean {
    // 1-12 characters
    if (symbol.length === 0 || symbol.length > 12) {
        return false;
    }

    // Alphanumeric only
    if (!/^[A-Z0-9]+$/.test(symbol)) {
        return false;
    }

    return true;
}
```

### 3. Asset Code Format

Stellar automatically handles:
- **AlphaNum4**: Symbols with 1-4 characters
- **AlphaNum12**: Symbols with 5-12 characters
- **NULL padding**: Added automatically at the end

You don't need to manually pad the asset code!

---

## 🧪 Testing on Testnet

### 1. Get Test XLM

Visit: https://laboratory.stellar.org/#account-creator?network=test

### 2. Connect Freighter Wallet

1. Install Freighter extension
2. Create/Import account
3. Switch to Testnet
4. Fund with test XLM

### 3. Launch Test Token

```typescript
// Example test token
await launchToken({
    name: 'Test Meme Token',
    symbol: 'TMEME',
    imageUrl: 'ipfs://QmTest123...',
    description: 'A test token on Stellar testnet',
    tokenCount: 0, // First token
});
```

### 4. Verify Token

After launching, you can:
- View token in Stellar Expert: `https://stellar.expert/explorer/testnet/asset/{symbol}-{issuer}`
- Check balance in Freighter wallet
- Transfer to other addresses
- Trade on testnet DEXs

---

## 📊 Contract Functions Reference

### `launch_token`

```typescript
Parameters:
  - creator: Address
  - name: String (max 32 chars)
  - symbol: String (1-12 chars, uppercase)
  - image_url: String
  - description: String
  - serialized_asset: Bytes

Returns:
  - Address (token contract address)

Cost:
  - 0.01 XLM creation fee
```

### `buy`

```typescript
Parameters:
  - buyer: Address
  - token: Address
  - xlm_amount: i128 (in stroops)
  - min_tokens: i128 (slippage protection)

Returns:
  - i128 (tokens received)
```

### `sell`

```typescript
Parameters:
  - seller: Address
  - token: Address
  - token_amount: i128
  - min_xlm: i128 (slippage protection)

Returns:
  - i128 (XLM received)
```

---

## 🎯 Next Steps

1. ✅ Contract deployed and initialized on testnet
2. ✅ Frontend implementation guide completed
3. 🔄 Implement in your dApp
4. 🔄 Test token creation
5. 🔄 Verify tokens in wallets
6. 🔄 Test buy/sell operations
7. 🔄 Deploy to mainnet (when ready)

---

## 📚 Additional Resources

- [Stellar SDK Documentation](https://stellar.github.io/js-stellar-sdk/)
- [Soroban Documentation](https://developers.stellar.org/docs/smart-contracts)
- [Freighter Wallet](https://www.freighter.app/)
- [Stellar Laboratory](https://laboratory.stellar.org/)

---

**Generated**: 2025-01-21
**Contract**: CC5CNOA5KDC5AC6JQ3W57ISFXGHLV5HLVGXY4IX7XTEYS3UJTUIHZ6U6
**Network**: Stellar Testnet
**Status**: ✅ Ready for Integration
