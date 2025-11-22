# 🏗️ Astro Shiba Frontend Architecture
**World-Class Token Launchpad** - Pump.fun meets Stellar

**Date**: November 21, 2024
**Goal**: Build the #1 token launchpad on Stellar
**Inspiration**: Pump.fun ($11.3B volume), GasPump, Moonshot

---

## 🎯 Design Philosophy

### Core Principles (from UX Research)
1. **Speed is Everything**: <30s token launch, <2s page loads
2. **Mobile-First**: 70%+ users on mobile
3. **Instant Gratification**: Real-time updates, no waiting
4. **Social Proof**: Show activity everywhere
5. **Clarity Over Cleverness**: No tutorials needed
6. **Transparency**: All data on-chain, visible

### Key Metrics
- **Token Launch**: Sub-30 seconds
- **Page Load**: <2 seconds
- **Price Update**: <500ms
- **Chart Refresh**: 1 second
- **Mobile Usage**: Target 75%+

---

## 🏛️ System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Next.js 15 App Router                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Pages                    Components              Stores    │
│  ├── Home (/)            ├── TokenCard           ├── tokens │
│  ├── Token (/t/[id])     ├── TradingModal        ├── trades │
│  ├── Create (/create)    ├── PriceChart          ├── users  │
│  ├── Explore            ├── ActivityFeed         ├── wallet │
│  ├── Leaderboard        ├── Leaderboard          └── ui     │
│  └── Portfolio          ├── Comments                        │
│                         ├── Achievements                     │
│                         └── ProgressBar                      │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│                    State Management (Zustand)                │
│  - Optimistic UI updates                                     │
│  - Real-time sync with WebSocket                            │
│  - Persistent state (localStorage)                           │
├─────────────────────────────────────────────────────────────┤
│                    Services Layer                            │
│  ├── Stellar SDK          ├── WebSocket Client              │
│  ├── SAC Factory          ├── GraphQL Client                │
│  ├── Wallet Integration   └── Analytics                     │
│  └── Contract Bindings                                       │
├─────────────────────────────────────────────────────────────┤
│                    Backend Integration                       │
│  ├── Indexer (Events)     ├── API Gateway (GraphQL)         │
│  ├── WebSocket Server     └── Database (Postgres)           │
│  └── Real-time Price Feed                                    │
└─────────────────────────────────────────────────────────────┘
```

---

## 📁 Directory Structure

```
apps/web/
├── src/
│   ├── app/                      # Next.js 15 App Router
│   │   ├── (marketing)/          # Public pages (no auth)
│   │   │   ├── page.tsx          # Home - Activity feed
│   │   │   ├── explore/          # Token grid
│   │   │   └── leaderboard/      # Rankings
│   │   ├── (app)/                # Protected pages
│   │   │   ├── create/           # Token creation
│   │   │   ├── portfolio/        # User portfolio
│   │   │   └── settings/         # User settings
│   │   ├── t/[address]/          # Token detail page
│   │   │   └── page.tsx          # Trading + Chart + Social
│   │   ├── layout.tsx            # Root layout
│   │   └── globals.css           # Tailwind + animations
│   │
│   ├── components/
│   │   ├── token/                # Token-related components
│   │   │   ├── TokenCard.tsx     # Card with live price
│   │   │   ├── TokenGrid.tsx     # Masonry grid
│   │   │   ├── TokenPreview.tsx  # Creation preview
│   │   │   └── TokenStats.tsx    # Stats widget
│   │   │
│   │   ├── trading/              # Trading components
│   │   │   ├── TradingModal.tsx  # Buy/Sell modal
│   │   │   ├── PriceChart.tsx    # Recharts integration
│   │   │   ├── OrderBook.tsx     # Recent trades
│   │   │   └── SwapButton.tsx    # Preset amounts
│   │   │
│   │   ├── social/               # Social features
│   │   │   ├── ActivityFeed.tsx  # Global activity
│   │   │   ├── CommentSection.tsx
│   │   │   ├── UserProfile.tsx
│   │   │   └── ReactionButton.tsx
│   │   │
│   │   ├── leaderboard/          # Rankings
│   │   │   ├── CreatorsBoard.tsx
│   │   │   ├── HoldersBoard.tsx
│   │   │   └── VolumeBoard.tsx
│   │   │
│   │   ├── gamification/         # Engagement
│   │   │   ├── AchievementBadge.tsx
│   │   │   ├── ProgressBar.tsx
│   │   │   ├── LevelIndicator.tsx
│   │   │   └── Confetti.tsx
│   │   │
│   │   ├── layout/               # Layout components
│   │   │   ├── Navbar.tsx        # Top nav with wallet
│   │   │   ├── Sidebar.tsx       # Desktop sidebar
│   │   │   ├── MobileNav.tsx     # Bottom nav (mobile)
│   │   │   └── DashboardLayout.tsx
│   │   │
│   │   └── ui/                   # shadcn/ui components
│   │       ├── button.tsx
│   │       ├── card.tsx
│   │       ├── modal.tsx
│   │       └── ... (30+ components)
│   │
│   ├── stores/                   # Zustand stores
│   │   ├── useTokenStore.ts      # Tokens state
│   │   ├── useTradeStore.ts      # Trades history
│   │   ├── useUserStore.ts       # User data
│   │   ├── useWalletStore.ts     # Wallet connection
│   │   ├── useActivityStore.ts   # Activity feed
│   │   └── useUIStore.ts         # UI state (modals, etc)
│   │
│   ├── hooks/                    # Custom hooks
│   │   ├── useToken.ts           # Token data fetching
│   │   ├── useTrade.ts           # Trading operations
│   │   ├── useRealtime.ts        # WebSocket subscription
│   │   ├── usePrice.ts           # Live price updates
│   │   ├── useContract.ts        # Contract interactions
│   │   └── useOptimistic.ts      # Optimistic UI
│   │
│   ├── lib/
│   │   ├── stellar/              # Stellar integration
│   │   │   ├── client.ts
│   │   │   ├── services/
│   │   │   │   ├── sac-factory.service.ts
│   │   │   │   └── token.service.ts
│   │   │   └── utils.ts
│   │   │
│   │   ├── graphql/              # GraphQL client
│   │   │   ├── client.ts
│   │   │   ├── queries/
│   │   │   │   ├── tokens.ts
│   │   │   │   ├── trades.ts
│   │   │   │   └── users.ts
│   │   │   └── subscriptions/
│   │   │       └── activity.ts
│   │   │
│   │   ├── websocket/            # Real-time connection
│   │   │   ├── client.ts
│   │   │   ├── events.ts
│   │   │   └── handlers/
│   │   │
│   │   ├── utils/                # Utilities
│   │   │   ├── formatting.ts     # Number, date formatting
│   │   │   ├── validation.ts     # Form validation
│   │   │   ├── constants.ts      # App constants
│   │   │   └── helpers.ts        # General helpers
│   │   │
│   │   └── config/               # Configuration
│   │       ├── network.ts        # Stellar network config
│   │       ├── contracts.ts      # Contract addresses
│   │       └── env.ts            # Environment vars
│   │
│   ├── types/                    # TypeScript types
│   │   ├── token.ts
│   │   ├── trade.ts
│   │   ├── user.ts
│   │   └── contract.ts
│   │
│   └── styles/                   # Global styles
│       ├── globals.css
│       └── animations.css
│
├── public/
│   ├── images/
│   ├── fonts/
│   └── icons/
│
└── package.json
```

---

## 🎨 Component Architecture

### 1. Token Card (Infinite Scroll Grid)
```typescript
<TokenCard
  token={token}
  onClick={() => navigate(`/t/${token.address}`)}
  live={true}  // Real-time price updates
  compact={false}  // Full info vs compact
/>

Features:
- Live price ticker (WebSocket)
- Graduation progress bar
- Creator avatar
- Holders count
- Volume 24h
- Trending indicator (🔥)
- Quick trade buttons
```

### 2. Trading Modal (Pump.fun Style)
```typescript
<TradingModal
  token={token}
  defaultAction="buy"  // buy | sell
  onSuccess={handleTradeSuccess}
/>

Features:
- Price chart (Recharts)
- Preset amounts (1, 10, 100 XLM)
- Custom amount input
- Slippage settings
- Estimated output
- Recent trades feed
- Quick swap button
```

### 3. Activity Feed (Real-time)
```typescript
<ActivityFeed
  filter="all"  // all | tokens | trades | achievements
  limit={50}
  realtime={true}
/>

Items:
- Token launched
- Trade executed (buy/sell)
- Token graduated
- Achievement unlocked
- New holder milestone
```

### 4. Price Chart (Recharts)
```typescript
<PriceChart
  tokenAddress={address}
  timeframe="1H"  // 1H | 24H | 7D | ALL
  showVolume={true}
  showGraduation={true}  // Mark graduation point
/>

Features:
- Area chart with gradient
- Volume bars
- Graduation threshold line
- Hover tooltip
- Time range selector
- Full screen mode
```

---

## 🔌 Real-Time System

### WebSocket Events
```typescript
// Price updates (every 1s)
ws.on('price_update', ({ token, price, change24h }) => {
  updateTokenPrice(token, price, change24h);
});

// New trades (instant)
ws.on('trade', ({ token, type, amount, user, timestamp }) => {
  addToActivityFeed({ type: 'trade', ...data });
  updateTokenStats(token);
});

// Token launched (instant)
ws.on('token_launched', ({ token, creator }) => {
  addToActivityFeed({ type: 'launch', ...data });
  incrementTokenCount();
});

// Graduation (instant + confetti 🎉)
ws.on('token_graduated', ({ token, ammPair, lpLocked }) => {
  addToActivityFeed({ type: 'graduation', ...data });
  showConfetti();
  updateTokenStatus(token, 'Graduated');
});
```

### Optimistic UI Updates
```typescript
// Example: Buy tokens
const buyTokens = async (amount: bigint) => {
  // 1. Optimistic update (instant)
  const optimisticTrade = {
    id: `temp-${Date.now()}`,
    type: 'buy',
    amount,
    status: 'pending',
    timestamp: Date.now(),
  };

  addTrade(optimisticTrade);
  updateBalance(predictedBalance);

  try {
    // 2. Submit transaction
    const tx = await submitBuyTransaction(amount);

    // 3. Update with real data
    updateTrade(optimisticTrade.id, {
      id: tx.hash,
      status: 'confirmed',
    });
  } catch (error) {
    // 4. Rollback on error
    removeTrade(optimisticTrade.id);
    revertBalance();
    showError(error.message);
  }
};
```

---

## 📱 Mobile-First Design

### Breakpoints
```css
/* Mobile (default) */
@media (min-width: 0px) {
  /* Bottom navigation */
  /* Single column layout */
  /* Touch-friendly buttons (44px+) */
}

/* Tablet */
@media (min-width: 768px) {
  /* 2-column grid */
  /* Sidebar appears */
}

/* Desktop */
@media (min-width: 1024px) {
  /* 3-column grid */
  /* Full sidebar */
  /* Charts full-size */
}

/* Large Desktop */
@media (min-width: 1440px) {
  /* 4-column grid */
  /* Activity feed sidebar */
}
```

### Mobile Optimizations
- Bottom navigation (thumb-friendly)
- Swipe gestures (token cards, tabs)
- Pull-to-refresh
- Infinite scroll
- Touch ripple effects
- Haptic feedback (via Vibration API)
- Install as PWA

---

## 🎮 Gamification System

### Achievements
```typescript
const achievements = [
  // Token Creation
  { id: 'first_token', name: 'First Token', icon: '🚀', xp: 100 },
  { id: 'token_master', name: 'Token Master', icon: '👑', xp: 1000, requirement: '10 tokens' },

  // Trading
  { id: 'first_trade', name: 'First Trade', icon: '💰', xp: 50 },
  { id: 'whale', name: 'Whale', icon: '🐋', xp: 5000, requirement: '1000 XLM volume' },

  // Social
  { id: 'commentator', name: 'Commentator', icon: '💬', xp: 100, requirement: '50 comments' },
  { id: 'influencer', name: 'Influencer', icon: '⭐', xp: 2000, requirement: '1000 likes' },

  // Special
  { id: 'early_bird', name: 'Early Bird', icon: '🐦', xp: 500, requirement: 'First 100 users' },
  { id: 'diamond_hands', name: 'Diamond Hands', icon: '💎', xp: 1000, requirement: 'Hold 30 days' },
];
```

### Leaderboards
```typescript
// Creators Leaderboard
- Most tokens launched
- Highest total volume
- Most graduated tokens
- Highest avg graduation %

// Holders Leaderboard
- Most tokens held
- Highest portfolio value
- Best PnL %
- Longest hold streak

// Trading Leaderboard
- Highest volume 24h
- Most trades
- Best win rate
- Fastest graduation
```

---

## 🚀 Performance Optimization

### Code Splitting
```typescript
// Dynamic imports for heavy components
const TradingModal = dynamic(() => import('@/components/trading/TradingModal'));
const PriceChart = dynamic(() => import('@/components/trading/PriceChart'));
const CommentSection = dynamic(() => import('@/components/social/CommentSection'));
```

### Image Optimization
```typescript
// Next.js Image component
<Image
  src={token.imageUrl}
  width={400}
  height={400}
  alt={token.name}
  priority={isPriority}
  placeholder="blur"
  blurDataURL={token.blurHash}
/>
```

### Data Fetching
```typescript
// React Query for caching + auto-refetch
const { data, isLoading } = useQuery({
  queryKey: ['token', address],
  queryFn: () => fetchTokenData(address),
  refetchInterval: 10000,  // 10s
  staleTime: 5000,  // 5s
});
```

### Bundle Size
```bash
# Target bundle sizes
Main bundle: <200KB gzipped
Route chunks: <100KB each
Images: WebP/AVIF optimized
Fonts: Subsetting, preload
```

---

## 🎨 Design System

### Colors (from research)
```css
/* Primary (Brand) */
--brand-primary: #FF6B6B;  /* Astro Shiba Red */
--brand-blue: #4ECDC4;     /* Stellar Blue */
--brand-green: #45B7D1;    /* Success */

/* Semantic */
--success: #10B981;
--warning: #F59E0B;
--error: #EF4444;
--info: #3B82F6;

/* Neutrals */
--gray-50: #F9FAFB;
--gray-900: #111827;
```

### Typography
```css
/* Font Stack */
font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;

/* Sizes */
--text-xs: 0.75rem;    /* 12px */
--text-sm: 0.875rem;   /* 14px */
--text-base: 1rem;     /* 16px */
--text-lg: 1.125rem;   /* 18px */
--text-xl: 1.25rem;    /* 20px */
--text-2xl: 1.5rem;    /* 24px */
--text-3xl: 1.875rem;  /* 30px */
--text-4xl: 2.25rem;   /* 36px */
```

### Animations
```css
/* Micro-interactions */
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

@keyframes bounce-slow {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}

@keyframes shimmer {
  0% { background-position: -1000px 0; }
  100% { background-position: 1000px 0; }
}
```

---

## 📊 Analytics & Monitoring

### Events to Track
```typescript
// User Events
- wallet_connected
- token_created
- trade_executed (buy/sell)
- comment_posted
- achievement_unlocked

// Performance Events
- page_load_time
- chart_render_time
- trade_execution_time
- websocket_latency

// Business Metrics
- tokens_launched_24h
- total_volume_24h
- active_traders
- average_token_lifetime
```

### Error Tracking
```typescript
// Sentry integration
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 1.0,
  environment: process.env.NODE_ENV,
});

// Error boundaries
<ErrorBoundary fallback={<ErrorPage />}>
  <App />
</ErrorBoundary>
```

---

## 🔐 Security

### Input Validation
```typescript
// All user inputs validated
- Token name: 1-32 chars
- Symbol: 1-12 alphanumeric uppercase
- Image URL: Valid URL or IPFS
- Trade amounts: >0, <max supply
- Comments: Sanitized HTML
```

### Transaction Security
```typescript
// MEV protection
const deadline = Date.now() + 300_000;  // 5 min

// Slippage protection
const minTokens = calculateMin(expectedTokens, slippage);

// Simulation before sign
const simResult = await simulateTx(tx);
if (simResult.error) throw new Error();
```

---

## 🎯 Success Metrics

### Phase 1 (MVP - Week 1-4)
- ✅ Token launch <30 seconds
- ✅ Mobile responsive (100%)
- ✅ Real-time price updates
- ✅ Basic trading interface
- ✅ Activity feed
- Target: 100 tokens launched

### Phase 2 (Social - Week 5-8)
- ✅ Comments & reactions
- ✅ User profiles
- ✅ Leaderboards (3 types)
- ✅ Achievement system
- Target: 1,000 active users

### Phase 3 (Advanced - Week 9-16)
- ✅ Advanced charts
- ✅ Portfolio analytics
- ✅ Live streaming
- ✅ Limit orders
- Target: $1M volume

---

## 🚀 Deployment

### Environments
```bash
# Development
pnpm dev  # localhost:3000

# Staging (Vercel Preview)
- Auto-deploy on PR
- Testnet contracts
- Full analytics

# Production (Vercel)
- Main branch auto-deploy
- Mainnet contracts
- CDN + Edge functions
```

### Performance Targets
```
Lighthouse Score:
- Performance: >90
- Accessibility: >95
- Best Practices: >95
- SEO: >90

Core Web Vitals:
- LCP: <2.5s
- FID: <100ms
- CLS: <0.1
```

---

**Architecture Status**: ✅ DESIGNED
**Next Step**: Implementation
**Target**: World-Class UX

🤖 Generated with [Claude Code](https://claude.com/claude-code)
