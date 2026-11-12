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
import { TokenArt } from '../components/TokenArt'
import { useTokenList } from '../hooks/useTokenList'
import { useCreatedTokens } from '../store/creations'
import { useProgress } from '../store/progress'
import { useWallet } from '../store/wallet'
import { ASTRO_TOKEN_ID } from '../lib/network'
import { BRAND } from '../lib/brand'
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
      {/* Welcome & Value Proposition Hero: macOS Liquid Glass + NFT Spotlight */}
      <section className="liquid-glass relative overflow-hidden rounded-3xl p-5 sm:p-8">
        <div className="grid gap-6 lg:grid-cols-12 items-center">
          <div className="lg:col-span-8 flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-400/40 bg-sky-950/50 px-3 py-1 text-xs font-semibold text-sky-300">
                <span className="h-2 w-2 animate-pulse rounded-full bg-sky-400" />
                {BRAND.taglineEn} · Stellar Soroban Testnet
              </span>
              <span className="liquid-glass-pill rounded-full px-3 py-1 text-xs text-slate-300 font-mono">
                OpenSea-Grade Generative Art + AMM
              </span>
            </div>

            <h1 className="text-2xl font-black sm:text-4xl lg:text-5xl tracking-tight text-white">
              Fair Launchpad & Generative NFT Art Studio on Stellar 🌊🚀
            </h1>

            <p className="max-w-2xl text-sm sm:text-base text-slate-300 leading-relaxed">
              Premiere your project as an on-chain Generative Collectible & Soroswap AMM pool.
              Fixed 1B supply, 100% LP burned to the Stellar burn address, and ownership renounced on-chain.
              Zero rug-pulls, museum-grade visual identities, and instant permissionless liquidity.
            </p>

            <div className="mt-2 flex flex-wrap items-center gap-3">
              <Link
                to="/create"
                className="liquid-glass-pill inline-flex min-h-[44px] items-center rounded-2xl border-sky-400/40 bg-sky-500/90 px-6 py-2.5 text-sm font-bold text-slate-950 hover:bg-sky-400 shadow-lg shadow-sky-500/20 transition-all hover:scale-[1.02]"
              >
                🚀 Launch Token
              </Link>
              <Link
                to="/market"
                className="liquid-glass-pill inline-flex min-h-[44px] items-center rounded-2xl px-6 py-2.5 text-sm font-semibold text-slate-200 hover:text-white transition-all hover:scale-[1.02]"
              >
                🎨 Browse Gallery →
              </Link>
            </div>

            <WalletInstallHint />
          </div>

          {/* Right Spotlight: Genesis $ASTRO NFT Artwork Pedestal */}
          <div className="lg:col-span-4 flex justify-center">
            <Link
              to={`/token/${ASTRO_TOKEN_ID}`}
              className="liquid-glass-card group relative aspect-square w-full max-w-[260px] overflow-hidden rounded-3xl bg-slate-950 p-2.5 block"
            >
              <div className="relative aspect-square w-full overflow-hidden rounded-2xl">
                <TokenArt
                  id={ASTRO_TOKEN_ID}
                  symbol="ASTRO"
                  showBadge
                  className="h-full w-full transition-transform duration-500 group-hover:scale-105"
                />
                <div className="nft-holo-sheen absolute inset-0" />
                <div className="absolute top-2 left-2">
                  <span className="liquid-glass-pill rounded-full px-2 py-0.5 text-[9px] font-bold tracking-wider text-sky-300 uppercase">
                    Genesis #001
                  </span>
                </div>
              </div>
              <div className="mt-2 px-1 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-white group-hover:text-sky-300 transition-colors">
                    $ASTRO Flagship
                  </p>
                  <p className="text-[10px] text-slate-400">Cosmic Nebula Series</p>
                </div>
                <span className="liquid-glass-pill rounded-lg px-2 py-1 text-[10px] font-mono font-semibold text-emerald-300">
                  Live Pool ↗
                </span>
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* Onboarding Steps Guide (if applicable) */}
      <Onboarding
        created={createdTokens.length > 0}
        liquidity={liquidity}
        swapped={swapped}
      />

      {/* Organized Showcase Section with Clean Tabs */}
      <div className="space-y-4">
        {/* Navigation Tabs Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto border-b border-slate-800 pb-2 no-scrollbar">
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
