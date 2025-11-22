# Real SAC Deployment - Current Status

## ✅ Successfully Deployed to Testnet

**Contract ID**: `CACNGYHX7IIM4ED3GO2VNZUE4GGL6BL3G2S6ZBNQSFOZNSZHDNMJ26TF`

**Deployment Details**:
- Network: Stellar Testnet
- WASM Hash: `23c1242ec1e8563eed9af0ef7ce3ea615f2e69abf268ffb6e392b1bad8052ef2`
- WASM Size: 23.7 KB (optimized)
- Tests Passing: 35/35 ✅
- Initialized: Yes ✅

**Explorer Link**: https://stellar.expert/explorer/testnet/contract/CACNGYHX7IIM4ED3GO2VNZUE4GGL6BL3G2S6ZBNQSFOZNSZHDNMJ26TF

---

## 🚨 Critical Limitation - Production Build Issue

### The Problem

The current deployment has a fundamental architectural issue:

**XDR serialization requires `std`**, which is NOT available in `no_std` Soroban contracts.

- ✅ **Test builds**: Include XDR serialization code (works with `testutils` feature)
- ❌ **Production builds**: Contain a `panic!()` in the serialization function

### What This Means

If you call `launch_token` on the deployed contract, it will **PANIC** because it cannot serialize the Asset XDR in production.

```rust
// Production version (src/sac_deployment.rs:132)
#[cfg(not(any(test, feature = "testutils")))]
fn create_serialized_asset(...) -> Result<Bytes, Error> {
    panic!("Asset serialization must be done client-side in production");
}
```

---

## ✅ Proper Architecture (Stellar/Soroban Best Practice)

According to Stellar documentation and the `no_std` constraint, the **correct pattern** is:

### Client-Side Serialization

1. **Frontend/Client** creates the Stellar Asset XDR
2. **Frontend/Client** serializes it to bytes using `stellar-sdk` (has `std` available)
3. **Frontend/Client** passes the serialized bytes to the contract
4. **Contract** uses those bytes with `env.deployer().with_stellar_asset(bytes)`

### Reference Implementation

From Stellar docs: https://developers.stellar.org/docs/build/guides/tokens/deploying-a-sac

```rust
#[contractimpl]
impl SacDeployer {
    pub fn deploy_sac(env: Env, serialized_asset: Bytes) -> Address {
        let deployer = env.deployer().with_stellar_asset(serialized_asset);
        deployer.deploy()
    }
}
```

---

## 🔧 Required Changes for Production

### Option 1: Client-Side Serialization (Recommended)

Modify the contract to accept pre-serialized asset bytes:

```rust
pub fn launch_token(
    env: Env,
    creator: Address,
    name: String,
    symbol: String,
    image_url: String,
    description: String,
    serialized_asset: Bytes,  // ← NEW: Client provides this
) -> Result<Address, Error> {
    // ... validation code ...

    // Deploy SAC using client-provided bytes
    let token_address = sac_deployment::deploy_with_serialized_asset(
        &env,
        serialized_asset
    )?;

    // ... rest of the function ...
}
```

**Frontend Example** (using stellar-sdk):

```typescript
import { Asset, Networks } from '@stellar/stellar-sdk';

// Create the asset
const asset = new Asset(symbol, issuerPublicKey);

// Serialize to XDR bytes
const serializedAsset = asset.toXDRObject().toXDR('base64');

// Call contract
await contract.launch_token({
    creator,
    name,
    symbol,
    image_url,
    description,
    serialized_asset: serializedAsset
});
```

### Option 2: Add Build-Time Feature Flag

Add a `testutils` feature to Cargo.toml and build with it enabled (NOT recommended for production):

```toml
[features]
testutils = []
```

Build command:
```bash
stellar contract build --features testutils
```

---

## 📋 Test Results

All 35 tests passing (using test builds with XDR serialization):

```
✅ bonding_curve::tests (4 tests)
✅ fee_management::tests (2 tests)
✅ math::tests (8 tests)
✅ sac_deployment::tests (4 tests) ← NEW SAC deployment tests
✅ tests::tests (17 tests)
```

### New SAC Deployment Tests

1. `test_create_issuer_account_id` - Validates unique issuer generation
2. `test_create_serialized_asset_4_char` - 4-character symbols (AlphaNum4)
3. `test_create_serialized_asset_12_char` - 12-character symbols (AlphaNum12)
4. `test_unique_issuers_for_same_symbol` - Ensures different salts = different issuers

---

## 🎯 Next Steps

### Immediate (for MVP testing):

1. ✅ Deploy contract to testnet (DONE)
2. ✅ Initialize contract (DONE)
3. 🔄 **Implement client-side XDR serialization** in frontend
4. 🔄 Test real SAC token deployment from frontend
5. 🔄 Verify tokens are transferable
6. 🔄 Confirm tokens appear in wallets (Freighter, Lobstr)

### For Production:

1. **Refactor** `launch_token` to accept `serialized_asset: Bytes` parameter
2. **Implement** frontend Asset XDR creation using `@stellar/stellar-sdk`
3. **Test** end-to-end flow: Frontend → Contract → SAC deployment
4. **Verify** tokens work with DEXs and wallets
5. **Deploy** updated contract to testnet
6. **Migrate** to mainnet after thorough testing

---

## 📚 Implementation Details

### What We Built

```rust
// src/sac_deployment.rs

/// Deploy a REAL Stellar Asset Contract token
pub fn deploy_real_sac_token_with_salt(
    env: &Env,
    symbol: &SorobanString,
    creator: &Address,
    salt: &BytesN<32>,
) -> Result<Address, Error> {
    // Creates unique Asset XDR with:
    // - AlphaNum4 (1-4 char symbols)
    // - AlphaNum12 (5-12 char symbols)
    // - Unique issuer per token (using salt)

    let serialized_asset = create_serialized_asset(env, symbol, creator, salt)?;

    // Deploy using Stellar's built-in SAC deployer
    let deployer = env.deployer().with_stellar_asset(serialized_asset);
    let token_address = deployer.deploy();

    Ok(token_address)
}
```

### Key Features Implemented

✅ **Real SAC Deployment**: Uses `env.deployer().with_stellar_asset()`
✅ **Unique Issuers**: Each token gets a unique issuer AccountId (using salt)
✅ **Proper Asset Codes**: NULL-padded at end (no spaces, no NULLs in middle)
✅ **Symbol Support**: 1-4 chars (AlphaNum4), 5-12 chars (AlphaNum12)
✅ **Guaranteed Uniqueness**: Salt = token_count + timestamp + symbol hash

---

## 🔐 Security Notes

### Current Implementation

- **Salt Generation**: `token_count + timestamp` ensures uniqueness
- **Issuer Generation**: Deterministic hash of `SAC_ISSUER_V2 + salt + symbol`
- **No Private Keys**: Issuer is a derived AccountId (not a funded account)

### Considerations for Production

1. **Issuer accounts** are deterministic but NOT funded (no actual Stellar account exists)
2. **Real SAC tokens** will be fully transferable and visible in wallets
3. **Frontend must validate** symbol characters before serialization
4. **Client-side XDR creation** must use proper Stellar SDK libraries

---

## 📖 References

- [Stellar: Deploying SAC from Contract](https://developers.stellar.org/docs/build/guides/tokens/deploying-a-sac)
- [Soroban SDK Deployer Docs](https://docs.rs/soroban-sdk/latest/soroban_sdk/deploy/struct.Deployer.html)
- [Stellar Asset Contract (SAC)](https://developers.stellar.org/docs/smart-contracts/tokens/stellar-asset-contract)

---

## 💡 Summary

**What's Working**:
- ✅ Contract compiles and deploys
- ✅ All 35 tests pass
- ✅ SAC deployment logic implemented
- ✅ Unique issuer generation working
- ✅ Contract initialized on testnet

**What's Blocked**:
- ❌ Cannot call `launch_token` on deployed contract (will panic)
- ❌ Need client-side XDR serialization first

**Path Forward**:
- 🎯 Implement frontend Asset XDR creation
- 🎯 OR refactor contract to accept serialized bytes as parameter
- 🎯 Following Stellar/Soroban best practices for SAC deployment

---

**Generated**: 2025-01-21
**Contract**: CACNGYHX7IIM4ED3GO2VNZUE4GGL6BL3G2S6ZBNQSFOZNSZHDNMJ26TF
**Network**: Stellar Testnet
