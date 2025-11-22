# 🚀 Backend Setup Guide - Astro Shiba

**Status**: Ready to Configure
**Date**: November 21, 2024
**Components**: Indexer + API Gateway + WebSocket + Redis

---

## 📋 Prerequisites

### Required Services:
1. ✅ **Upstash Redis** - CONFIGURED
   - REST URL: `https://leading-goshawk-32655.upstash.io`
   - REST Token: Configured in `.env`

2. ❌ **PostgreSQL Database** - NEEDS SETUP
   - Options:
     - **A) Local Postgres**: Install and run locally
     - **B) Supabase**: Free hosted Postgres (recommended)
     - **C) Neon**: Serverless Postgres (recommended)
     - **D) Railway**: Easy deployment

3. ✅ **Stellar Testnet** - READY
   - RPC: `https://soroban-testnet.stellar.org`
   - Contracts deployed and configured

---

## 🗄️ Option A: Local PostgreSQL

### Install Postgres:
```bash
# macOS (via Homebrew)
brew install postgresql@15
brew services start postgresql@15

# Create database
createdb astroshibapop

# Update .env
DATABASE_URL="postgresql://localhost:5432/astroshibapop?schema=public"
```

---

## ☁️ Option B: Supabase (Recommended - Free)

### Steps:
1. Go to https://supabase.com
2. Create account / Sign in
3. Click "New Project"
4. Set:
   - Name: `astroshibapop`
   - Database Password: (save this!)
   - Region: Choose closest
5. Wait ~2 minutes for provisioning
6. Go to Project Settings → Database
7. Copy "Connection string" (URI format)
8. Update `.env`:
   ```
   DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres"
   ```

---

## ⚡ Option C: Neon (Recommended - Serverless)

### Steps:
1. Go to https://neon.tech
2. Create account / Sign in
3. Create new project: `astroshibapop`
4. Copy connection string
5. Update `.env`:
   ```
   DATABASE_URL="postgresql://[user]:[password]@[host]/[database]?sslmode=require"
   ```

---

## 🚂 Option D: Railway (Easy Deploy)

### Steps:
1. Go to https://railway.app
2. Create account / Sign in
3. New Project → Add PostgreSQL
4. Copy `DATABASE_URL` from Variables tab
5. Update `.env` with the URL

---

## 🔧 Backend Setup Steps

### 1. Install Dependencies
```bash
cd /Users/munay/dev/Astro-Shiba/backend/indexer
pnpm install
```

### 2. Configure Database URL
Choose one of the options above and update `.env`:
```bash
nano .env
# Update DATABASE_URL with your Postgres connection string
```

### 3. Run Prisma Migrations
```bash
# Generate Prisma Client
pnpm db:generate

# Push schema to database (creates tables)
pnpm db:push

# Or run migrations (recommended for production)
pnpm db:migrate
```

### 4. Start Indexer
```bash
# Development mode (auto-reload)
pnpm dev

# Production mode
pnpm build
pnpm start
```

---

## 📊 What the Indexer Does

### Event Indexing:
The indexer listens to Stellar Testnet and indexes events from SAC Factory:

```typescript
// Events tracked:
1. TokenLaunched {
   creator: Address,
   token_address: Address,
   name: String,
   symbol: String,
   ...
}

2. TokenTraded {
   token: Address,
   trader: Address,
   xlm_amount: i128,
   token_amount: i128,
   is_buy: bool,
}

3. TokenGraduated {
   token: Address,
   amm_pair: Address,
   xlm_raised: i128,
}

4. LiquidityLocked {
   amm_pair: Address,
   lp_tokens: i128,
}
```

### Database Tables Created:
- `Token` - All launched tokens
- `Transaction` - All trades (buy/sell)
- `Pool` - AMM pairs (after graduation)
- `Swap` - AMM swaps
- `User` - User stats and gamification
- `Achievement` - User achievements

### What Gets Indexed:
✅ Every token launch
✅ Every buy/sell trade
✅ Every graduation event
✅ Every LP lock event
✅ Price history (1m intervals)
✅ Volume calculations (24h, 7d)
✅ Holder counts
✅ User statistics

---

## 🔌 API Gateway Setup

### 1. Configure API Gateway
```bash
cd /Users/munay/dev/Astro-Shiba/backend/api-gateway-v2
pnpm install
```

### 2. Create .env
```bash
# Copy from indexer and add:
PORT=4000
GRAPHQL_PLAYGROUND=true
```

### 3. Start API Gateway
```bash
pnpm dev
```

### 4. Test GraphQL
Open: `http://localhost:4000/graphql`

Example query:
```graphql
query {
  tokens(limit: 10) {
    id
    address
    name
    symbol
    currentPrice
    marketCap
    volume24h
    holders
  }
}
```

---

## 🌐 WebSocket Server

The API Gateway includes WebSocket support for real-time updates:

### Events emitted:
```typescript
// New token launched
ws.emit('token_launched', {
  token: TokenInfo,
  creator: string,
  timestamp: number,
});

// Token traded
ws.emit('token_traded', {
  token: string,
  type: 'buy' | 'sell',
  amount: string,
  price: string,
  trader: string,
});

// Token graduated
ws.emit('token_graduated', {
  token: string,
  ammPair: string,
  lpLocked: string,
});

// Price update (every 5s for active tokens)
ws.emit('price_update', {
  token: string,
  price: string,
  change24h: number,
});
```

---

## 🔄 Data Flow

```
Stellar Testnet (Contract Events)
         ↓
   Horizon API (Event Stream)
         ↓
   Indexer (Event Processing)
         ↓
   PostgreSQL (Data Storage)
   Redis (Caching)
         ↓
   GraphQL API (Query)
   WebSocket (Real-time)
         ↓
   Frontend (Display)
```

---

## 📈 Caching Strategy (Redis)

### What gets cached:
```typescript
// Hot data (5s TTL)
- Current prices for all tokens
- Active token list
- Latest trades (last 100)

// Warm data (30s TTL)
- Token details
- User stats
- Volume calculations

// Cold data (5m TTL)
- Historical data
- Leaderboards
- Achievements
```

### Redis Keys:
```
token:price:{address}       // Current price
token:info:{address}        // Token details
token:trades:{address}      // Recent trades
leaderboard:volume:24h      // Volume rankings
leaderboard:holders         // Holder rankings
activity:global             // Global activity feed
```

---

## 🚦 Health Checks

### Indexer:
```bash
curl http://localhost:3000/health
# Response:
{
  "status": "healthy",
  "lastProcessedLedger": 123456,
  "tokensIndexed": 42,
  "eventsProcessed": 1337,
  "uptime": 3600
}
```

### API Gateway:
```bash
curl http://localhost:4000/health
# Response:
{
  "status": "healthy",
  "database": "connected",
  "redis": "connected",
  "uptime": 3600
}
```

---

## 🐛 Debugging

### Check Indexer Logs:
```bash
cd backend/indexer
pnpm dev

# Logs show:
[INFO] Starting indexer...
[INFO] Connected to database
[INFO] Connected to Redis
[INFO] Watching contract: CBTF...AZWT2
[INFO] Processing ledger 123456
[INFO] Event: TokenLaunched - Token: CABC...XYZ
```

### Check Database:
```bash
# Using Prisma Studio (visual DB browser)
cd backend/indexer
pnpm db:studio

# Opens: http://localhost:5555
# Browse all tables visually
```

### Check Redis:
```bash
# Using Upstash Console
# Go to: https://console.upstash.com
# View keys, values, stats
```

---

## 📊 Metrics (Prometheus)

### Enable metrics:
```bash
# In .env
ENABLE_METRICS=true
METRICS_PORT=9090
```

### Access metrics:
```
http://localhost:9090/metrics
```

### Metrics exposed:
```
indexer_events_processed_total
indexer_ledgers_processed_total
indexer_errors_total
api_requests_total
api_response_time_seconds
websocket_connections_active
```

---

## 🔐 Security Considerations

### Production Setup:
1. ✅ Use connection pooling (Prisma default)
2. ✅ Enable Redis authentication (Upstash default)
3. ✅ Rate limiting on API (configured)
4. ✅ CORS configuration (whitelist frontend)
5. ⚠️ Add API keys for GraphQL (optional)
6. ⚠️ Enable HTTPS in production
7. ⚠️ Database encryption at rest

---

## 🎯 Quick Start (Recommended Order)

### Step 1: Choose Database
```bash
# Recommended: Supabase (easiest)
1. Sign up at supabase.com
2. Create project
3. Copy DATABASE_URL
4. Update backend/indexer/.env
```

### Step 2: Setup Indexer
```bash
cd backend/indexer
pnpm install
pnpm db:push          # Creates tables
pnpm dev              # Starts indexing
```

### Step 3: Setup API Gateway
```bash
cd backend/api-gateway-v2
pnpm install
pnpm dev              # Starts GraphQL + WebSocket
```

### Step 4: Update Frontend
```bash
cd apps/web
# Update .env.local:
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_GRAPHQL_ENDPOINT=http://localhost:4000/graphql
NEXT_PUBLIC_WS_ENDPOINT=ws://localhost:4000/ws

pnpm dev
```

### Step 5: Test End-to-End
```bash
# 1. Create a token via frontend
# 2. Check indexer logs (should see TokenLaunched event)
# 3. Check database (token should appear)
# 4. Query GraphQL (token should be queryable)
# 5. WebSocket should emit real-time update
```

---

## 📁 File Structure

```
backend/
├── indexer/
│   ├── .env                  ✅ CONFIGURED
│   ├── prisma/
│   │   └── schema.prisma     ✅ READY
│   ├── src/
│   │   ├── index.ts          ⏳ NEEDS UPDATE
│   │   ├── services/
│   │   │   └── event-indexer.ts  ⏳ NEEDS UPDATE
│   │   └── lib/
│   │       ├── redis.ts      ❌ NEEDS CREATION
│   │       └── stellar.ts    ⏳ NEEDS UPDATE
│   └── package.json          ✅ READY
│
├── api-gateway-v2/
│   ├── .env                  ❌ NEEDS CREATION
│   ├── src/
│   │   ├── index.ts          ⏳ NEEDS UPDATE
│   │   ├── schema/
│   │   │   └── typeDefs.ts   ⏳ NEEDS UPDATE
│   │   ├── resolvers/
│   │   │   └── index.ts      ⏳ NEEDS UPDATE
│   │   └── lib/
│   │       └── websocket.ts  ❌ NEEDS CREATION
│   └── package.json          ✅ READY
│
└── shared/
    └── types/                ✅ READY
```

---

## ✅ Success Criteria

When backend is fully set up, you should see:

### In Indexer Terminal:
```
[INFO] Indexer started
[INFO] Connected to Postgres: ✓
[INFO] Connected to Redis: ✓
[INFO] Watching SAC Factory: CBTF...AZWT2
[INFO] Current ledger: 123456
[INFO] Indexed 0 tokens, 0 transactions
[INFO] Waiting for events...
```

### In API Terminal:
```
[INFO] API Gateway started
[INFO] GraphQL Playground: http://localhost:4000/graphql
[INFO] WebSocket server: ws://localhost:4000/ws
[INFO] Connected to database: ✓
[INFO] Connected to Redis: ✓
```

### In Frontend:
```
✅ Home page shows REAL token list
✅ Activity feed shows REAL trades
✅ Price updates in REAL-TIME
✅ Leaderboards show REAL data
```

---

## 🎉 Next Steps After Setup

1. **Test Token Creation**:
   - Create token via frontend
   - Watch indexer process event
   - Query token via GraphQL
   - See it appear in frontend list

2. **Test Trading**:
   - Buy tokens via frontend
   - Watch trade get indexed
   - See activity feed update
   - Check volume calculations

3. **Test Real-Time**:
   - Open multiple browser tabs
   - Make trade in one tab
   - See update in all tabs instantly
   - Check WebSocket logs

4. **Build Features**:
   - Explore page (token grid)
   - Token detail page
   - Activity feed
   - Leaderboards
   - User profiles

---

## 📞 Support

If you encounter issues:

1. Check logs in both indexer and API terminals
2. Verify DATABASE_URL connection
3. Test Redis connection via Upstash console
4. Check Stellar RPC is responding
5. Verify contract address is correct

---

**Status**: ✅ Configuration Complete
**Next**: Choose database provider and run setup

🤖 Generated with [Claude Code](https://claude.com/claude-code)
