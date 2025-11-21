# SAC Factory - Testnet Deployment Guide

**Date:** November 21, 2025
**Network:** Stellar Testnet
**Contract Version:** 2.1.1

---

## 📋 PREREQUISITES

### 1. Install Stellar CLI

```bash
# macOS
brew install stellar/tap/stellar-cli

# Linux
cargo install --locked stellar-cli

# Verify installation
stellar --version  # Should be 23.0.0+
```

### 2. Create Testnet Identity

```bash
# Generate new keypair
stellar keys generate testnet-deployer --network testnet

# Get your address
stellar keys address testnet-deployer
```

**Save your address!** You'll need it in the next step.

### 3. Fund Your Testnet Account

Visit: https://laboratory.stellar.org/#account-creator?network=testnet

1. Paste your address from step 2
2. Click "Get test network lumens"
3. Wait for confirmation (~5 seconds)

Verify balance:
```bash
stellar account balance --id $(stellar keys address testnet-deployer) --network testnet
```

You should see: `10000.0000000 XLM`

---

## 🚀 DEPLOYMENT

### Quick Deploy (Automated)

```bash
# From contracts/sac-factory directory
./scripts/deploy-testnet.sh
```

This script will:
1. ✅ Verify prerequisites
2. ✅ Check account balance
3. ✅ Build the contract
4. ✅ Deploy WASM to testnet
5. ✅ Initialize the contract
6. ✅ Verify deployment
7. ✅ Save deployment info

Expected output:
```
========================================
🎉 DEPLOYMENT SUCCESSFUL!
========================================

📝 Deployment Details:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Network:      testnet
Contract ID:  CDXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
Admin:        GDXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
Treasury:     GDXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
WASM Size:    25K

🔗 Explorer:
https://stellar.expert/explorer/testnet/contract/CDXXX...
```

### Manual Deploy (Step by Step)

If you prefer manual deployment:

#### Step 1: Build Contract
```bash
cargo build --release --target wasm32-unknown-unknown
```

#### Step 2: Deploy WASM
```bash
CONTRACT_ID=$(stellar contract deploy \
    --wasm target/wasm32-unknown-unknown/release/sac_factory.wasm \
    --source testnet-deployer \
    --network testnet)

echo "Contract ID: $CONTRACT_ID"
```

#### Step 3: Initialize Contract
```bash
DEPLOYER=$(stellar keys address testnet-deployer)

stellar contract invoke \
    --id $CONTRACT_ID \
    --source testnet-deployer \
    --network testnet \
    -- initialize \
    --admin $DEPLOYER \
    --treasury $DEPLOYER
```

#### Step 4: Verify
```bash
stellar contract invoke \
    --id $CONTRACT_ID \
    --source testnet-deployer \
    --network testnet \
    -- get_token_count
```

Should return: `0`

---

## 🧪 TESTING

### Quick Test (Automated)

```bash
./scripts/test-contract.sh <CONTRACT_ID>
```

### Manual Testing

#### Test 1: Get Token Count
```bash
stellar contract invoke \
    --id $CONTRACT_ID \
    --source testnet-deployer \
    --network testnet \
    -- get_token_count
```

Expected: `0`

#### Test 2: Get Fee Config
```bash
stellar contract invoke \
    --id $CONTRACT_ID \
    --source testnet-deployer \
    --network testnet \
    -- get_fee_config
```

Expected output:
```json
{
  "creation_fee": 100000,
  "trading_fee_bps": 100,
  "treasury": "GDXXX..."
}
```

#### Test 3: Launch Test Token
```bash
CREATOR=$(stellar keys address testnet-deployer)

stellar contract invoke \
    --id $CONTRACT_ID \
    --source testnet-deployer \
    --network testnet \
    -- launch_token \
    --creator $CREATOR \
    --name "Test Token" \
    --symbol "TEST" \
    --image_url "ipfs://QmTest123" \
    --description "My first test token"
```

Expected: Token address (contract ID starting with `C`)

#### Test 4: Get Token Info
```bash
stellar contract invoke \
    --id $CONTRACT_ID \
    --source testnet-deployer \
    --network testnet \
    -- get_token_info \
    --token <TOKEN_ADDRESS_FROM_STEP_3>
```

Expected: Full token information

#### Test 5: Buy Tokens
```bash
BUYER=$(stellar keys address testnet-deployer)

stellar contract invoke \
    --id $CONTRACT_ID \
    --source testnet-deployer \
    --network testnet \
    -- buy \
    --buyer $BUYER \
    --token <TOKEN_ADDRESS> \
    --xlm_amount 1000000000 \
    --min_tokens 0
```

Expected: Number of tokens received

---

## 📊 MONITORING

### View on Stellar Expert

https://stellar.expert/explorer/testnet/contract/YOUR_CONTRACT_ID

You can see:
- Contract invocations
- Events emitted
- State changes
- Transactions

### Query Contract State

```bash
# Get all tokens launched
stellar contract invoke \
    --id $CONTRACT_ID \
    --source testnet-deployer \
    --network testnet \
    -- get_token_count

# Get creator's tokens
CREATOR=$(stellar keys address testnet-deployer)

stellar contract invoke \
    --id $CONTRACT_ID \
    --source testnet-deployer \
    --network testnet \
    -- get_creator_tokens \
    --creator $CREATOR

# Get contract state
stellar contract invoke \
    --id $CONTRACT_ID \
    --source testnet-deployer \
    --network testnet \
    -- get_state
```

---

## 🔧 TROUBLESHOOTING

### Error: "account not found"

**Solution:** Fund your testnet account
```bash
# Get your address
stellar keys address testnet-deployer

# Fund at: https://laboratory.stellar.org/#account-creator?network=testnet
```

### Error: "transaction submission failed"

**Solution:** Check account balance
```bash
stellar account balance --id $(stellar keys address testnet-deployer) --network testnet
```

Ensure you have at least 1 XLM for deployment.

### Error: "contract already initialized"

**Solution:** The contract was already initialized. This is normal if you're re-testing.

To get contract info:
```bash
stellar contract invoke \
    --id $CONTRACT_ID \
    --source testnet-deployer \
    --network testnet \
    -- get_token_count
```

### Error: "WASM validation failed"

**Solution:** Rebuild the contract
```bash
cargo clean
cargo build --release --target wasm32-unknown-unknown
```

---

## 📁 DEPLOYMENT FILES

After successful deployment, you'll find:

### `deployments/testnet-YYYYMMDD-HHMMSS.json`

Contains:
```json
{
  "network": "testnet",
  "contract_id": "CDXXX...",
  "admin": "GDXXX...",
  "treasury": "GDXXX...",
  "wasm_size": "25K",
  "deployed_at": "2025-11-21T20:00:00Z",
  "deployer_identity": "testnet-deployer",
  "stellar_version": "stellar 23.0.0"
}
```

**Keep this file!** You'll need it for:
- Frontend configuration
- Mainnet deployment reference
- Audit documentation

---

## 🔐 SECURITY CHECKLIST

Before using in production:

- [ ] Contract passed all 31 unit tests
- [ ] Security audit completed (4 critical issues fixed)
- [ ] Tested on testnet for 2+ weeks
- [ ] No unexpected behavior observed
- [ ] Events logging correctly
- [ ] Fee calculations accurate
- [ ] Bonding curve working as expected
- [ ] Pause/unpause functionality tested
- [ ] Role-based access control verified
- [ ] Professional audit scheduled (pre-mainnet)

---

## 🌐 FRONTEND INTEGRATION

After deployment, update your frontend `.env`:

```env
NEXT_PUBLIC_SAC_FACTORY_ADDRESS=CDXXXXXXXXXXXXXXXXXXXXXXXXXX
NEXT_PUBLIC_NETWORK=testnet
NEXT_PUBLIC_STELLAR_RPC_URL=https://soroban-testnet.stellar.org
```

---

## 📞 SUPPORT

### Documentation
- [Stellar Docs](https://developers.stellar.org/docs/build/smart-contracts)
- [Soroban Examples](https://github.com/stellar/soroban-examples)
- [Contract Security](REAL_SECURITY_AUDIT.md)

### Community
- Discord: https://discord.gg/stellar
- Forum: https://stellar.stackexchange.com

### Issues
- Report bugs: Create GitHub issue
- Security: Contact team privately first

---

## 🚀 NEXT STEPS

1. **Monitor testnet** for 2-4 weeks
2. **Test all features** thoroughly
3. **Collect metrics** (gas costs, event data)
4. **Professional audit** before mainnet
5. **Mainnet deployment** when ready

---

**Last Updated:** November 21, 2025
**Contract Version:** 2.1.1
**Deployment Scripts:** v1.0
