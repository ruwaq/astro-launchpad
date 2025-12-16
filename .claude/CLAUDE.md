# CLAUDE.md - Astro Launchpad

> ## Mantra
> **Código profesional, escalable, mantenible, robusto y fluido - top mundial para interacción con usuarios reales, siempre con tecnología de calidad e implementaciones avanzadas. Siempre terminar todas las tareas sin parar.**

## Project Overview

**Astro Shiba** es una infraestructura descentralizada de tokenización y launchpad construida nativamente sobre **Soroban** (Stellar Protocol 24). Permite crear tokens SAC en menos de 30 segundos, con bonding curves algorítmicas y liquidez bloqueada irreversiblemente.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 15, React 19, TailwindCSS, Zustand |
| Backend | Apollo Server, GraphQL, Prisma, PostgreSQL |
| Cache | Redis, Vercel KV |
| Blockchain | Stellar/Soroban (Rust), Protocol 24 |
| Build | pnpm, Turborepo |

## Project Structure

```
Astro-Shiba/
├── apps/
│   └── web/                    # Next.js 15 frontend
│       └── src/
│           ├── app/            # App Router pages
│           ├── components/     # React components
│           ├── hooks/          # Custom hooks
│           ├── stores/         # Zustand stores
│           └── lib/            # Utilities
├── backend/
│   ├── api-gateway-v2/         # GraphQL API (Apollo)
│   ├── indexer/                # Blockchain event indexer
│   └── shared/                 # Prisma schema, shared utils
├── contracts/
│   ├── sac-factory/            # Token factory (Rust/Soroban)
│   └── amm-pair/               # AMM pairs (Rust/Soroban)
├── packages/
│   ├── ui/                     # Shared UI components
│   └── shared-types/           # TypeScript types
└── .claude/
    ├── agents/                 # 11 specialized agents
    └── commands/               # Slash commands
```

## Key Commands

```bash
# Development
pnpm dev                        # Start all apps
pnpm build                      # Build all packages
pnpm typecheck                  # TypeScript check
pnpm lint                       # Lint all packages
pnpm test                       # Run tests

# Database
pnpm db:migrate                 # Run Prisma migrations
pnpm db:seed                    # Seed database
pnpm db:studio                  # Open Prisma Studio

# Contracts
cd contracts/sac-factory
cargo build --release --target wasm32-unknown-unknown
cargo test
stellar contract deploy --network testnet
```

## Claude Code Agents

### Agentes Locales (astro-launchpad/.claude/agents/)

| Agent | Model | Purpose |
|-------|-------|---------|
| `bonding-curve-specialist` | opus | Bonding curve math validation |
| `graduation-validator` | opus | $69k graduation flow |
| `graphql-auditor` | haiku | Apollo/GraphQL security |
| `next-app-architect` | haiku | Next.js 15 patterns |

### Agentes Heredados (Root .claude/agents/)

| Agent | Model | Purpose |
|-------|-------|---------|
| `security-auditor` | sonnet | OWASP, Web3 vulnerabilities |
| `code-quality` | haiku | TypeScript/React patterns |
| `test-generator` | sonnet | Unit/integration tests |
| `indexer-specialist` | haiku | Blockchain event processing |
| `prisma-specialist` | haiku | Database/ORM operations |
| `frontend-architect` | sonnet | React architecture |
| `ux-flow-tester` | sonnet | User flow testing |
| `continuous-improver` | sonnet | Auto-documentation updates |

## Skills Disponibles

| Skill | Location | Purpose |
|-------|----------|---------|
| `next-15-patterns` | Local | Server/Client components |
| `typescript-patterns` | Root | TS/React best practices |
| `defi-patterns` | Root | AMM, bonding curves |
| `auto-documentation` | Root | Doc generation |

## Slash Commands

| Command | Purpose |
|---------|---------|
| `/primetime` | Full ecosystem validation |
| `/ecosystem-check` | Quick consistency validation |
| `/security-check` | Security audit |

## Architecture Patterns

### Frontend
- **Server/Client Component Boundary** pattern (Next.js 15 RSC)
  - `page.tsx` = async Server Component (fetches data with ISR)
  - `*Client.tsx` = Client Component (handles interactivity)
- **ISR (Incremental Static Regeneration)** for optimal caching
  - Home: 5 minutes (`next: { revalidate: 300 }`)
  - Explore: 1 minute (`next: { revalidate: 60 }`)
  - Leaderboard: 2 minutes (`next: { revalidate: 120 }`)
- **Apollo Client** for real-time polling in client components
- **Zustand** for global state (token cache)
- **Custom hooks** (`useApi.ts`) for data logic

### Backend
- **GraphQL** with Apollo Server
- **DataLoaders** for N+1 prevention
- **Prisma** for type-safe database access
- **Redis** for caching hot data

### Contracts
- **Bonding Curve** for fair token pricing
- **Dual Fee System** (0.05% protocol + 0.25% LP)
- **RBAC** access control
- **DIA Oracle** integration

## Key Files

| File | Purpose |
|------|---------|
| **Pages (Server/Client Boundary)** | |
| `apps/web/src/app/page.tsx` | Home Server Component (ISR 5min) |
| `apps/web/src/app/HomeClient.tsx` | Home Client Component |
| `apps/web/src/app/explore/page.tsx` | Explore Server Component (ISR 1min) |
| `apps/web/src/app/explore/ExploreClient.tsx` | Explore Client Component |
| `apps/web/src/app/leaderboard/page.tsx` | Leaderboard Server Component (ISR 2min) |
| `apps/web/src/app/leaderboard/LeaderboardClient.tsx` | Leaderboard Client Component |
| **Services & Hooks** | |
| `apps/web/src/lib/stellar/services/sac-factory.service.ts` | Main contract service |
| `apps/web/src/hooks/useApi.ts` | Apollo hooks for data fetching |
| `apps/web/src/components/widgets/TradingWidget.tsx` | Trading interface |
| **Charts** | |
| `apps/web/src/components/charts/SimpleChart.tsx` | Price/Cap chart (lightweight-charts) |
| `apps/web/src/components/charts/TradingViewChart.tsx` | Advanced TradingView chart |
| **Backend** | |
| `backend/api-gateway-v2/src/graphql/schema.ts` | GraphQL schema |
| `backend/indexer/src/services/dead-letter-queue.ts` | Failed event retry system |
| **Contracts** | |
| `contracts/sac-factory/src/lib.rs` | Main contract |
| `contracts/sac-factory/src/bonding_curve.rs` | Price algorithm |

## Design Tokens

### Colors
```typescript
primary: '#fa9427'   // Orange - CTAs
blue: '#247bca'      // Trust, navigation
green: '#144722'     // Success
```

### Key Patterns
- Border radius: `rounded-xl` (12px)
- Shadows: `shadow-sm` to `shadow-xl`
- Spacing: 4px base unit
- Font: Inter (sans), JetBrains Mono (mono)

## Environment Variables

```bash
# Required
STELLAR_NETWORK=testnet
STELLAR_RPC_URL=https://soroban-testnet.stellar.org
DATABASE_URL=postgresql://...
REDIS_URL=redis://localhost:6379

# Contract IDs (after deployment)
TOKEN_FACTORY_CONTRACT_ID=CXXX...

# Monitoring (Sentry)
NEXT_PUBLIC_SENTRY_DSN=https://xxx@o4xxx.ingest.sentry.io/xxx
SENTRY_AUTH_TOKEN=sntrys_xxx  # For source maps upload
```

## Testing

### Coverage Targets
| Area | Target |
|------|--------|
| Hooks | 90% |
| Utils | 100% |
| Services | 90% |
| Contracts | 95% |
| Components | 70% |

### Run Tests
```bash
pnpm test                    # All tests
pnpm test:coverage           # With coverage
cargo test                   # Contract tests
```

## Deployment & Infrastructure

### Vercel Projects (ACTIVE)

| Project Name | Project ID | Repo | Root Directory | URL |
|--------------|------------|------|----------------|-----|
| `astro-launchpad` | `prj_mmcv6JicsAxUBbltv3PIzGDlRJAQ` | astro-launchpad | `apps/web` | https://astro-launchpad-topaz.vercel.app |
| `api-gateway-v2` | `prj_EJfm9FKM9wNWOYH8hp3TMfaJMn2o` | astro-launchpad | `backend/api-gateway-v2` | https://api-gateway-v2.vercel.app |

### Other NunaLabs Projects (separate repos)

| Project Name | Repo | Description |
|--------------|------|-------------|
| `astroswap-dex` | astro-swap | DEX frontend (Vite) |
| `nuna-curate-web` | Nuna-Curate | NFT curation platform |
| `qenti-fi-web` | QentiFi | DeFi platform |
| `nahui-gallery-frontend` | NahuiGallery | NFT gallery |

### Vercel Configuration (NunaLabs)

| Config | Value |
|--------|-------|
| Team ID | `team_WWWCdgHNWlHrbpK6IBj761Dr` |
| Team Name | `nunalabs-projects` |
| Account | `nunartistas@gmail.com` |
| GitHub Repo ID | `1104872053` |
| Free Plan Limit | 100 deployments/day |

### Deploy Commands

```bash
# Auto-deploy: Push to main triggers Vercel deployment
git push origin main

# Manual deploy via API (NO CLI - use API only)
# astro-launchpad (frontend)
curl -X POST "https://api.vercel.com/v13/deployments?teamId=team_WWWCdgHNWlHrbpK6IBj761Dr" \
  -H "Authorization: Bearer $VERCEL_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"astro-launchpad","gitSource":{"type":"github","repoId":1104872053,"ref":"main"},"target":"production","projectSettings":{"rootDirectory":"apps/web"}}'

# api-gateway-v2 (backend)
curl -X POST "https://api.vercel.com/v13/deployments?teamId=team_WWWCdgHNWlHrbpK6IBj761Dr" \
  -H "Authorization: Bearer $VERCEL_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"api-gateway-v2","gitSource":{"type":"github","repoId":1104872053,"ref":"main"},"target":"production","projectSettings":{"rootDirectory":"backend/api-gateway-v2"}}'

# Check deployment status
curl -s -H "Authorization: Bearer $VERCEL_TOKEN" \
  "https://api.vercel.com/v6/deployments?projectId=prj_mmcv6JicsAxUBbltv3PIzGDlRJAQ&teamId=team_WWWCdgHNWlHrbpK6IBj761Dr&limit=1" | jq '.deployments[0] | {state, url}'
```

> **Note**: Vercel CLI removed. Always use API for deployments.

### Contracts (Stellar)
```bash
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/sac_factory.wasm \
  --network testnet
```

### Production URLs

| Service | URL |
|---------|-----|
| Frontend | https://astro-launchpad-topaz.vercel.app |
| GraphQL API | https://api-gateway-v2.vercel.app/graphql |
| Stellar RPC | https://soroban-testnet.stellar.org |

## Contributing Guidelines

1. **Branch naming**: `feature/`, `fix/`, `refactor/`
2. **Commit format**: Conventional commits
3. **PR required**: All changes via PR
4. **Tests required**: For new features
5. **Run `/primetime`**: Before major releases

## Quick Reference

### User Flows
1. **Create Token**: `/create` → Fill form → Sign → Confirm
2. **Trading**: `/t/[address]` → Enter amount → Sign → Success
3. **Portfolio**: `/portfolio` → View holdings/history

### Contract Functions
- `create_token(name, symbol, metadata)` - Create new token
- `buy_tokens(token, amount)` - Buy via bonding curve
- `sell_tokens(token, amount)` - Sell via bonding curve
- `get_price(token, amount)` - Get current price

### GraphQL Queries
- `tokens(first, skip)` - List tokens
- `token(address)` - Single token
- `transactions(tokenId)` - Token transactions
- `globalStats` - Platform statistics

## Recent Changes (Dec 2025)

### Chart Component Fix (SimpleChart.tsx)
**Location**: `apps/web/src/components/charts/SimpleChart.tsx`

Fixed issues with chart not rendering:
1. **Data condition** - Changed from `currentPrice > 0` to `currentPrice > 0 || xlmRaised > 0` to show chart in Cap mode when price is 0
2. **Container rendering** - Always render chart container with loading overlay instead of conditional early return
3. **Ref availability** - Chart container now always in DOM for lightweight-charts initialization

**Chart Architecture**:
- Uses `lightweight-charts` library (TradingView)
- Two view modes: Cap (XLM raised) and Price
- Graduation target line at 30,000 XLM
- Real-time updates via 3-second polling
- Green area chart with line overlay

### Build Configuration
- `playwright.config.ts` and `e2e/**/*` excluded from TypeScript build in `tsconfig.json`
- Prevents build failures when `@playwright/test` not installed

### Token Page Data Flow
**Location**: `apps/web/src/app/t/[address]/page.tsx`

Data source priority:
1. **PRIMARY**: Stellar contract (via `sac-factory.service.ts`)
2. **FALLBACK**: GraphQL API (read-only mode)

```typescript
const isReadOnlyMode = hasGraphqlData && !hasContractData;
```

### Production Audit Status
Last audit: December 16, 2025

**Completed**:
- Security audit (contracts, API, frontend)
- Performance analysis
- Database/Prisma review
- GraphQL API audit
- Indexer reliability check
- Frontend architecture review
- Testing coverage analysis

**Key Findings Addressed**:
- Chart rendering fixed
- Build errors resolved
- Lockfile synced

## Known Issues

### Pending Vercel Deployment
After pushing fixes, Vercel deployment takes 1-2 minutes to build + CDN propagation time.

### IPFS Gateway Errors
`gateway.pinata.cloud` occasionally returns `ERR_FAILED`. This affects token images but not core functionality.

### Peer Dependency Warnings
Non-blocking warnings in pnpm install:
- `@trezor/connect-plugin-stellar` expects `@stellar/stellar-sdk@^13.3.0` (using 14.4.0)
- `@as-integrations/express4` expects `express@^4.0.0` (using 5.1.0)
- `apollo-server-micro` expects `micro@^9.3.4` (using 10.0.1)

These are compatibility warnings, not errors.

---

**For questions about Claude Code features**, use the `claude-code-guide` agent.

**Ready for primetime?** Run `/primetime` for full validation.
