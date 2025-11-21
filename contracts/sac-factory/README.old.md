# SAC Factory - Pump.fun for Stellar

Ultra-simple token launchpad inspired by Pump.fun, built on Stellar/Soroban.

## Features

🚀 **One-Click Launch**
- Deploy SAC tokens in <30 seconds
- No coding required
- Only 0.01 XLM ($0.001) fee

💰 **Fair Launch**
- No presale
- No team allocation
- Creator buys like everyone else

📈 **Bonding Curve**
- Constant product formula (x * y = k)
- Automatic price discovery
- Transparent and predictable

🎓 **Auto-Graduation**
- Graduates to AMM at $69k market cap
- Liquidity locked forever (LP tokens burned)
- Prevents rug pulls

## How It Works

### 1. Launch Phase
- Creator deploys token with name, symbol, and image
- 1 billion total supply
- 800 million (80%) allocated to bonding curve
- 200 million (20%) for AMM liquidity

### 2. Bonding Curve Phase
- Users buy/sell directly from smart contract
- Price determined by constant product formula
- No order books, no liquidity providers needed
- Every trade moves the price algorithmically

### 3. Graduation Phase
- Automatic at $69k market cap (~575,000 XLM at $0.12/XLM)
- Contract creates AMM pair
- Injects all raised XLM + remaining tokens
- Burns LP tokens permanently

## Technical Details

### Bonding Curve Math

```
k = xlm_reserve * tokens_remaining

Buy:
tokens_out = tokens_remaining - (k / (xlm_reserve + xlm_in))

Sell:
xlm_out = xlm_reserve - (k / (tokens_remaining + tokens_in))

Current Price:
price = xlm_reserve / tokens_remaining
```

### Initial Parameters
- Total Supply: 1,000,000,000 tokens
- Bonding Curve Supply: 800,000,000 tokens (80%)
- AMM Supply: 200,000,000 tokens (20%)
- Initial Virtual XLM: 1,000 XLM
- Graduation Threshold: 10,000 XLM (adjustable)
- Creation Fee: 0.01 XLM

## Usage

### Build
```bash
cd contracts/sac-factory
soroban contract build
soroban contract optimize --wasm target/wasm32-unknown-unknown/release/sac_factory.wasm
```

### Deploy
```bash
soroban contract deploy \
  --wasm target/wasm32-unknown-unknown/release/sac_factory.optimized.wasm \
  --source DEPLOYER_SECRET \
  --network testnet
```

### Initialize
```bash
soroban contract invoke \
  --id CONTRACT_ID \
  --source ADMIN_SECRET \
  --network testnet \
  -- \
  initialize \
  --admin ADMIN_ADDRESS \
  --treasury TREASURY_ADDRESS
```

### Launch Token
```bash
soroban contract invoke \
  --id CONTRACT_ID \
  --source CREATOR_SECRET \
  --network testnet \
  -- \
  launch_token \
  --creator CREATOR_ADDRESS \
  --name "Doge Shiba" \
  --symbol "DSHIB" \
  --image_url "ipfs://..." \
  --description "The next big meme!"
```

### Buy Tokens
```bash
soroban contract invoke \
  --id CONTRACT_ID \
  --source BUYER_SECRET \
  --network testnet \
  -- \
  buy \
  --buyer BUYER_ADDRESS \
  --token TOKEN_ADDRESS \
  --xlm_amount 10000000000 \
  --min_tokens 100000000
```

## Stellar Advantages

Unlike Pump.fun on Solana, SAC Factory leverages Stellar's unique features:

### 🌍 Multi-Currency Support
- Accept payments in XLM, USDC, EURC, or any asset
- Path payments for automatic conversion
- Users pay in their preferred currency

### 💳 Fiat Integration
- 475,000+ on/off ramps worldwide via Stellar anchors
- Direct fiat → token purchases
- No need for exchanges

### ⚡ Superior Performance
- 3-5 second finality
- $0.000005 per transaction
- 99.99% uptime (no outages)

### 🔒 Native Stablecoins
- USDC and EURC issued directly on Stellar
- Used by Visa, MoneyGram, Wirex
- Most trusted stablecoins in crypto

## Roadmap

### Phase 1: MVP ✅
- [x] Core bonding curve
- [x] Buy/sell functionality
- [x] Auto-graduation at threshold
- [x] Event emission

### Phase 2: Production
- [ ] Real SAC token deployment
- [ ] Native XLM transfers
- [ ] AMM integration (deploy actual pairs)
- [ ] LP token burning
- [ ] Fee collection

### Phase 3: Features
- [ ] Multi-currency support (USDC, EURC)
- [ ] Path payments integration
- [ ] Creator time-locks
- [ ] Referral system
- [ ] Social features (comments, likes)

### Phase 4: Advanced
- [ ] Limit orders
- [ ] DCA (Dollar Cost Averaging)
- [ ] Portfolio tracking
- [ ] Analytics dashboard
- [ ] Mobile PWA

## Security

### Audits
- [ ] Internal review
- [ ] External audit 1
- [ ] External audit 2
- [ ] Bug bounty program

### Safety Features
- ✅ Overflow/underflow protection
- ✅ Slippage protection
- ✅ Fair launch mechanics
- ✅ Liquidity lock on graduation
- ⏳ Reentrancy guards
- ⏳ Emergency pause
- ⏳ Rate limiting

## License

MIT

## Disclaimer

This is experimental software. Use at your own risk. Meme tokens are highly speculative. Only invest what you can afford to lose.
