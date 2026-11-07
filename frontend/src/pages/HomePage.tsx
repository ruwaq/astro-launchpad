import { useState } from 'react'
import { Link } from 'react-router'
import { Onboarding } from '../components/Onboarding'
import { WalletInstallHint } from '../components/WalletInstallHint'
import { DemoMode } from '../components/DemoMode'
import { MarketList } from '../components/MarketList'
import { SwapCard } from '../components/SwapCard'
import { TokenInfoCard } from '../components/TokenInfoCard'
import { GraduationRadar } from '../components/GraduationRadar'
import { NewLaunchesFeed } from '../components/NewLaunchesFeed'
import { useTokenList } from '../hooks/useTokenList'
import { useCreatedTokens } from '../store/creations'
import { useProgress } from '../store/progress'
import { useWallet } from '../store/wallet'
import { ASTRO_TOKEN_ID } from '../lib/network'
import { BRAND } from '../lib/brand'
import { PROTOCOL_DEPLOY_FEE_USD } from '../lib/tokenomics'
import type { LaunchpadToken } from '../lib/token'

/** Genesis token: already deployed and paired on Soroswap testnet. */
const DEMO_TOKEN: LaunchpadToken = { id: ASTRO_TOKEN_ID, decimals: 7 }

type HomeTab = 'radar' | 'launches' | 'market' | 'demo'

export function HomePage() {
  const [selectedToken, setSelectedToken] = useState<LaunchpadToken>(DEMO_TOKEN)
  const [activeTab, setActiveTab] = useState<HomeTab>('radar')
  const { demoActive } = useWallet()
  const list = useTokenList()
  const createdTokens = useCreatedTokens((state) => state.tokens)
  const liquidity = useProgress((state) => state.liquidity)
  const swapped = useProgress((state) => state.swapped)

  return (
    <div className="flex flex-col gap-6 w-full max-w-full overflow-hidden">
      {/* Welcome & Value Proposition Hero */}
      <section className="relative overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900/90 via-slate-950 to-emerald-950/20 p-5 sm:p-8 shadow-sm">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-950/40 px-3 py-1 text-xs font-semibold text-emerald-300">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
              {BRAND.taglineEn} · Stellar Soroban Testnet
            </span>
            <span className="rounded-full border border-slate-800 bg-slate-900/60 px-3 py-1 text-xs text-slate-400 font-mono">
              SEP-41 Standard
            </span>
          </div>

          <h1 className="text-2xl font-extrabold sm:text-4xl tracking-tight text-slate-100">
            The Safest & Most Fun Memecoin Launchpad on Stellar 🌊🚀
          </h1>

          <p className="max-w-2xl text-sm sm:text-base text-slate-300 leading-relaxed">
            Launch your memecoin for just{' '}
            <strong className="text-emerald-300">${PROTOCOL_DEPLOY_FEE_USD.toFixed(2)} USD</strong>{' '}
            in XLM. Standard <strong>Fair Launch</strong> with 0.5% developer cut upon graduation, 99.5% in pool,
            renounced ownership, and 100% LP burned to the Stellar dead address.{' '}
            <span className="text-slate-400">
              Zero team dumps, zero rug-pulls, and instant AMM trading on Soroswap DEX.
            </span>
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-3">
            <Link
              to="/create"
              className="inline-flex min-h-[44px] items-center rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-bold text-slate-950 hover:bg-emerald-400 shadow-md shadow-emerald-500/20 transition-all hover:scale-[1.02]"
            >
              🚀 Launch Token (${PROTOCOL_DEPLOY_FEE_USD.toFixed(2)} USD)
            </Link>
            <Link
              to="/market"
              className="inline-flex min-h-[44px] items-center rounded-xl border border-slate-700 bg-slate-900/60 px-5 py-2.5 text-sm font-semibold text-slate-200 hover:border-slate-500 transition-all"
            >
              👑 View Full Market →
            </Link>
          </div>

          <WalletInstallHint />
        </div>
      </section>

      {/* Onboarding Steps Guide (if applicable) */}
      <Onboarding
        created={createdTokens.length > 0}
        liquidity={liquidity}
        swapped={swapped}
      />

      {/* Quick Navigation Hub Cards */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Link
          to="/create"
          className="group rounded-xl border border-slate-800 bg-slate-900/40 p-4 transition-all hover:border-emerald-500/50 hover:bg-slate-900/80"
        >
          <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
            <span>🚀</span> Launchpad
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Create in 1 click for $1.11 USD. 100% anti-rug with locked liquidity.
          </p>
          <span className="mt-2 inline-block text-xs font-semibold text-emerald-400 group-hover:underline">
            Create Token →
          </span>
        </Link>

        <Link
          to="/market"
          className="group rounded-xl border border-slate-800 bg-slate-900/40 p-4 transition-all hover:border-amber-500/50 hover:bg-slate-900/80"
        >
          <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
            <span>👑</span> Live Market
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Discover trending pairs, top liquidity tokens, and DEX graduation races.
          </p>
          <span className="mt-2 inline-block text-xs font-semibold text-amber-400 group-hover:underline">
            Explore Market →
          </span>
        </Link>

        <Link
          to="/portfolio"
          className="group rounded-xl border border-slate-800 bg-slate-900/40 p-4 transition-all hover:border-sky-500/50 hover:bg-slate-900/80"
        >
          <div className="flex items-center gap-2 text-sky-400 font-bold text-sm">
            <span>💼</span> Your Portfolio
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Track token balances, liquidity positions, and transaction history.
          </p>
          <span className="mt-2 inline-block text-xs font-semibold text-sky-400 group-hover:underline">
            Open Portfolio →
          </span>
        </Link>
      </div>

      {/* Organized Showcase Section with Clean Tabs (Solves cluttered landscape) */}
      <div className="space-y-4">
        {/* Navigation Tabs Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto border-b border-slate-800 pb-2 scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveTab('radar')}
            className={`min-h-[40px] whitespace-nowrap rounded-lg px-3.5 py-2 text-xs font-bold transition ${
              activeTab === 'radar'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            🎓 Moonshot Radar (Graduating Soon)
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('launches')}
            className={`min-h-[40px] whitespace-nowrap rounded-lg px-3.5 py-2 text-xs font-bold transition ${
              activeTab === 'launches'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            ⚡ Fresh Launches
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('market')}
            className={`min-h-[40px] whitespace-nowrap rounded-lg px-3.5 py-2 text-xs font-bold transition ${
              activeTab === 'market'
                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            👑 Market Spotlight
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('demo')}
            className={`min-h-[40px] whitespace-nowrap rounded-lg px-3.5 py-2 text-xs font-bold transition ${
              activeTab === 'demo'
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            🧪 Demo Mode (Friendbot)
          </button>
        </div>

        {/* Tab 1: Moonshot Radar */}
        {activeTab === 'radar' ? (
          <div className="space-y-3">
            <GraduationRadar
              tokens={list.data ?? []}
              onSelect={setSelectedToken}
            />
          </div>
        ) : null}

        {/* Tab 2: Fresh Launches */}
        {activeTab === 'launches' ? (
          <div className="space-y-3">
            <NewLaunchesFeed
              tokens={list.data ?? []}
              onSelect={setSelectedToken}
            />
          </div>
        ) : null}

        {/* Tab 3: Market Spotlight */}
        {activeTab === 'market' ? (
          <div id="sec-market" className="scroll-mt-20">
            <MarketList
              limit={4}
              showFilters={false}
              selectedId={selectedToken.id}
              onSelect={setSelectedToken}
            />
            <div className="mt-2 text-right">
              <Link
                to="/market"
                className="text-sm text-emerald-400 underline underline-offset-2 hover:text-emerald-300"
              >
                View Full Market →
              </Link>
            </div>
          </div>
        ) : null}

        {/* Tab 4: Demo Wallet / Friendbot */}
        {activeTab === 'demo' ? (
          <DemoMode
            key={`${selectedToken.id}-${demoActive}`}
            token={selectedToken}
          />
        ) : null}
      </div>

      {/* Quick Swap Card (Always accessible for instant trading) */}
      <div id="sec-swap" className="scroll-mt-20">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <span>🔄</span> Instant AMM Swap
          </h2>
          <span className="text-xs text-slate-500">
            Trading ${selectedToken.symbol ?? 'TOKEN'}
          </span>
        </div>
        <SwapCard token={selectedToken} />
      </div>

      {/* Token Info Card */}
      <TokenInfoCard
        token={selectedToken}
        example={selectedToken.id === ASTRO_TOKEN_ID}
      />
    </div>
  )
}
