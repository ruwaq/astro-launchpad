# SAC Factory Contract - Upgrade Guide

## Current Deployment (V5)
- **Contract ID**: `CAETFO74SF5GSPA2SCUIR6P5XET6ASEMQPESLRWNWRDC37UX32HBKEMK`
- **WASM Hash**: `65ed3d84203942a00cf6b32b7cc332234cd7a45af9252892101cd02b897eeaa8`
- **Network**: Stellar Testnet
- **Admin**: `GB2XFP6XK2MPOGURZCEH3KISW7W657IXC3MJZKG5MNBFMUSUNX3QWCFJ`

## Upgrade Process (For Future Updates)

Starting from V5, the contract can be upgraded **without losing data**. This is the scalable approach.

### Step 1: Build the New Contract
```bash
cd contracts/sac-factory
cargo build --release --target wasm32v1-none
```

### Step 2: Upload New WASM to Stellar
```bash
stellar contract upload \
  --wasm target/wasm32v1-none/release/sac_factory.wasm \
  --rpc-url https://soroban-testnet.stellar.org \
  --network-passphrase "Test SDF Network ; September 2015" \
  --source-account testnet-deployer
```
This returns a new WASM hash (e.g., `abc123...`).

### Step 3: Upgrade the Contract (Preserves All Data!)
```bash
stellar contract invoke \
  --id CAETFO74SF5GSPA2SCUIR6P5XET6ASEMQPESLRWNWRDC37UX32HBKEMK \
  --rpc-url https://soroban-testnet.stellar.org \
  --network-passphrase "Test SDF Network ; September 2015" \
  --source-account testnet-deployer \
  -- upgrade \
  --admin GB2XFP6XK2MPOGURZCEH3KISW7W657IXC3MJZKG5MNBFMUSUNX3QWCFJ \
  --new_wasm_hash <NEW_WASM_HASH>
```

### Step 4: Verify the Upgrade
```bash
stellar contract invoke \
  --id CAETFO74SF5GSPA2SCUIR6P5XET6ASEMQPESLRWNWRDC37UX32HBKEMK \
  --rpc-url https://soroban-testnet.stellar.org \
  --network-passphrase "Test SDF Network ; September 2015" \
  --source-account testnet-deployer \
  -- version
```

## Key Benefits

1. **Same Contract Address**: `CAETFO74SF5GSPA2SCUIR6P5XET6ASEMQPESLRWNWRDC37UX32HBKEMK` never changes
2. **All Data Preserved**: Tokens, users, balances - everything stays intact
3. **Only Code Changes**: Just the executable code is replaced
4. **Rollback Possible**: Old WASM remains in ledger (can rollback if needed)
5. **No Frontend Changes**: Same contract ID means no env updates needed

## Security Notes

- Only the Owner role can upgrade the contract
- Emits system event for transparency
- Always test on testnet before mainnet upgrades
- Keep track of WASM hashes for rollback purposes

## Version History

| Version | WASM Hash | Changes |
|---------|-----------|---------|
| V5 | `65ed3d84...` | Added `upgrade()` and `version()` functions |
| V4 | `6894685...` | Added `reset_wallet_holdings`, `clear_wallet_holdings` |
| V3 | ... | Initial bonding curve implementation |
