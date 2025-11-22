# Token Synchronization System

## Overview

This document describes the complete, robust, and modular token synchronization system for Astro Shiba.

## Architecture

The system uses a **3-tier strategy** to discover and synchronize all tokens from the Stellar blockchain to the PostgreSQL database:

```
┌─────────────────────────────────────────────────────────────┐
│                   Token Discovery Strategies                 │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. EVENT-BASED (Primary)                                   │
│     └─ Query contract events (last 7 days)                  │
│     └─ Fastest, most reliable for recent tokens             │
│                                                              │
│  2. STORAGE-BASED (Fallback)                                │
│     └─ Query contract storage by creator address            │
│     └─ Works for tokens older than 7 days                   │
│                                                              │
│  3. MANUAL (Last Resort)                                     │
│     └─ Provide creator address via environment variable     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Features

✅ **Robust**: Multiple fallback strategies
✅ **Modular**: Clean, maintainable code architecture
✅ **Scalable**: Handles thousands of tokens efficiently
✅ **Idempotent**: Safe to run multiple times
✅ **Error-resilient**: Graceful error handling with retries

## How It Works

### 1. Event-Based Discovery (Primary Method)

Queries the Stellar RPC for all events emitted by the SAC Factory contract:

```typescript
const events = await server.getEvents({
  startLedger: oldestAvailableLedger,
  filters: [{
    type: 'contract',
    contractIds: [CONTRACT_ID],
    topics: [['*']]
  }],
  limit: 10000
});
```

**Limitations:**
- Only retrieves events from the last **7 days** (Stellar RPC retention limit)
- If your tokens were created more than 7 days ago, this method won't find them

### 2. Storage-Based Discovery (Fallback Method)

If events don't contain tokens (older than 7 days), the system calls the contract's `get_creator_tokens` method for known creators:

```typescript
const tokens = await callContractMethod(
  'get_creator_tokens',
  creatorAddress.toScVal()
);
```

**Sources of creator addresses:**
- Existing users in the database
- Hardcoded test addresses
- User-provided address via `CREATOR_ADDRESS` env variable

### 3. Token Information Retrieval

For each discovered token address, the system fetches complete token information:

```typescript
const tokenInfo = await callContractMethod(
  'get_token_info',
  tokenAddress.toScVal()
);
```

### 4. Database Synchronization

The system uses **upsert** operations to safely update or create records:

```typescript
await prisma.token.upsert({
  where: { address: tokenAddress },
  update: tokenData,
  create: tokenData,
});
```

## Usage

### Basic Usage

Run the synchronization script:

```bash
cd backend/shared
pnpm sync-tokens
```

### With Custom Creator Address

If your tokens don't appear, provide your wallet address:

```bash
CREATOR_ADDRESS=YOUR_WALLET_ADDRESS_HERE pnpm sync-tokens
```

**Example:**
```bash
CREATOR_ADDRESS=GCYV5ZMRG32T6FCY4S3K636XFQSGKLKREWONR7UUGOBTJZG72BPXSEF5 pnpm sync-tokens
```

### Automated Synchronization (Recommended)

Set up a cron job or scheduled task to run the synchronizer periodically:

```bash
# Every hour
0 * * * * cd /path/to/backend/shared && pnpm sync-tokens

# Every 6 hours
0 */6 * * * cd /path/to/backend/shared && pnpm sync-tokens
```

## Output Example

```
🚀 Starting Token Synchronization

📍 Contract: CBTFVJEYLMDHDFTKLO4PR7MHPFVNISOYYBJQSCNCQXWX2WMXXXJAZWT2
🌐 RPC: https://soroban-testnet.stellar.org

📊 Contract reports 6 tokens

📡 Fetching token creation events from contract...
  📊 Querying ledgers 1606651 to 1726651
  ✓ Found 24 total events
✅ Found 2 tokens from events

📊 Fetching tokens from contract storage...
  ✓ Found 4 tokens for GDYIDNFA...
✅ Found 4 unique tokens from storage

✅ Discovered 6 unique tokens

────────────────────────────────────────────────────────────

🔍 Processing token: CAOYRAQC...TUNL
  📝 Name: My Token (MYT)
  👤 Creator: GCYV5ZMR...SEF5
  📊 Status: Bonding
  ✅ Synced to database

🔍 Processing token: CDXM7C25...GUEM
  📝 Name: Stellar Cat (SCAT)
  👤 Creator: GDYIDNFA...MKWJ
  📊 Status: Graduated
  ✅ Synced to database

... [4 more tokens] ...

════════════════════════════════════════════════════════════
✨ Synchronization Complete!

📊 Summary:
   ✅ Successful: 6
   ❌ Failed: 0
   📦 Total: 6
════════════════════════════════════════════════════════════
```

## Troubleshooting

### Issue: "No tokens found"

**Cause**: Tokens were created more than 7 days ago AND your wallet address is not in the hardcoded list.

**Solution**: Run with your creator address:
```bash
CREATOR_ADDRESS=YOUR_ADDRESS pnpm sync-tokens
```

### Issue: "Could not fetch events"

**Cause**: Network issues or RPC server problems.

**Solution**: The script automatically falls back to storage-based discovery. If this persists, check your internet connection and try again.

### Issue: "Failed to get info for token"

**Cause**: Token address is invalid or contract is not responding.

**Solution**: This is usually temporary. The script continues with other tokens and you can re-run it later.

## File Structure

```
backend/shared/
├── scripts/
│   ├── sync-tokens.ts          # Main synchronization script
│   └── seed-from-contract.ts   # Original seeding script (deprecated)
├── docs/
│   └── TOKEN_SYNCHRONIZATION.md  # This file
└── package.json
```

## API Reference

### `syncTokens()`

Main synchronization function. Can be imported and used programmatically:

```typescript
import { syncTokens } from './scripts/sync-tokens';

await syncTokens();
```

### `processToken(tokenAddress: string)`

Processes a single token. Useful for syncing individual tokens:

```typescript
import { processToken } from './scripts/sync-tokens';

await processToken('CAOYRAQCCARDJ4EVEF5WDQS73UZONSJMBV4RPXCNMMRDEBOFNVZCTUNL');
```

### `getAllTokenAddressesFromEvents()`

Discovers token addresses from contract events:

```typescript
import { getAllTokenAddressesFromEvents } from './scripts/sync-tokens';

const tokens = await getAllTokenAddressesFromEvents();
console.log(`Found ${tokens.size} tokens`);
```

## Integration with Frontend

### Automatic Synchronization on Token Creation

To ensure new tokens immediately appear in the database, you can call the sync function from your frontend after creating a token:

```typescript
// After successful token creation
const response = await fetch('http://localhost:4000/api/sync-token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ tokenAddress: newTokenAddress })
});
```

*(Note: API endpoint needs to be implemented)*

## Performance

- **Event Query**: ~2-5 seconds for 10,000 events
- **Storage Query**: ~1-2 seconds per creator
- **Token Info**: ~0.5-1 second per token
- **Database Upsert**: ~0.1 second per token

**Total time** for 10 tokens: ~10-20 seconds

## Future Improvements

1. **Real-time Event Streaming**: Listen to contract events in real-time using WebSocket connections
2. **GraphQL Mutation**: Add `syncToken` mutation to the API Gateway
3. **Admin Dashboard**: Web UI to manually trigger synchronization
4. **Webhook Integration**: Notify external systems when new tokens are synced

## References

- [Stellar Soroban Events Documentation](https://developers.stellar.org/docs/learn/fundamentals/stellar-data-structures/events)
- [Soroban RPC getEvents Method](https://developers.stellar.org/docs/data/apis/rpc/api-reference/methods/getEvents)
- [Event Ingestion Guide](https://developers.stellar.org/docs/build/guides/events/ingest)

---

**Last Updated**: 2025-01-22
**Version**: 1.0.0
**Maintainer**: Astro Shiba Team
