import { useState } from 'react'
import { Link } from 'react-router'
import { WalletInstallHint } from '../components/WalletInstallHint'
import { DemoMode } from '../components/DemoMode'
import { MarketList } from '../components/MarketList'
import { SwapCard } from '../components/SwapCard'
import { TokenInfoCard } from '../components/TokenInfoCard'
import { GraduationRadar } from '../components/GraduationRadar'
import { NewLaunchesFeed } from '../components/NewLaunchesFeed'
import { TokenArt } from '../components/TokenArt'
import { CosmicLauncherGame } from '../components/CosmicLauncherGame'
import { tokenArtSpec } from '../lib/art'
import { useTokenList } from '../hooks/useTokenList'
import { useWallet } from '../store/wallet'
import { ASTRO_TOKEN_ID } from '../lib/network'
import { BRAND } from '../lib/brand'
import type { LaunchpadToken } from '../lib/token'

/** Genesis token: already deployed and paired on Soroswap testnet. */
const DEMO_TOKEN: LaunchpadToken = { id: ASTRO_TOKEN_ID, decimals: 7, symbol: 'ASTRO' }
const ASTRO_SPEC = tokenArtSpec(ASTRO_TOKEN_ID)

export function HomePage() {
  const [selectedToken, setSelectedToken] = useState<LaunchpadToken>(DEMO_TOKEN)
  const demoActive = useWallet((state) => state.demoActive)
  const list = useTokenList()

  return (
    <div className="flex flex-col gap-10 w-full max-w-full overflow-hidden">
      {/* 1. Hero Presentation: Project Intro + Animated Badges */}
      <section className="liquid-glass relative overflow-hidden rounded-3xl p-6 sm:p-10 border border-sky-500/20 shadow-2xl">
        <div className="grid gap-8 lg:grid-cols-12 items-center">
          <div className="lg:col-span-8 flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-400/40 bg-sky-950/60 px-3 py-1 text-xs font-semibold text-sky-300">
                <span className="h-2 w-2 animate-pulse rounded-full bg-sky-400" />
                {BRAND.taglineEn} · Stellar Soroban
              </span>
              <span className="liquid-glass-pill rounded-full px-3 py-1 text-xs text-emerald-300 font-mono font-medium">
                100% Burned LP · Zero Dev Rugs
              </span>
            </div>

            <h1 className="text-3xl font-black sm:text-5xl lg:text-6xl tracking-tight text-white leading-tight">
              Fair Memecoin Launchpad on Stellar 🌊🚀
            </h1>

            <p className="max-w-2xl text-sm sm:text-base text-slate-300 leading-relaxed">
              Launch and trade community tokens with instant permissionless Soroswap AMM liquidity.
              Single-transaction atomic deployments: 99.5% supply paired, 100% LP burned to the dead address,
              and contract ownership renounced permanently on-chain.
            </p>

            <div className="mt-2 flex flex-wrap items-center gap-3">
              <Link
                to="/create"
                className="liquid-glass-pill inline-flex min-h-[44px] items-center rounded-2xl border-sky-400/40 bg-sky-500/90 px-6 py-2.5 text-sm font-bold text-slate-950 hover:bg-sky-400 shadow-lg shadow-sky-500/20 transition-all hover:scale-[1.02]"
              >
                🚀 Launch Token
              </Link>
              <a
                href="#sec-radar"
                className="liquid-glass-pill inline-flex min-h-[44px] items-center rounded-2xl px-5 py-2.5 text-sm font-semibold text-amber-300 hover:text-amber-200 hover:bg-amber-500/10 transition-all"
              >
                🎓 Moonshot Radar →
              </a>
              <a
                href="#sec-market"
                className="liquid-glass-pill inline-flex min-h-[44px] items-center rounded-2xl px-5 py-2.5 text-sm font-semibold text-slate-200 hover:text-white transition-all"
              >
                📊 Explore Market →
              </a>
            </div>

            <WalletInstallHint />
          </div>

          {/* Right Spotlight: Flagship $ASTRO Genesis Token */}
          <div className="lg:col-span-4 flex justify-center">
            <Link
              to={`/token/${ASTRO_TOKEN_ID}`}
              className="liquid-glass-card group relative aspect-square w-full max-w-[270px] overflow-hidden rounded-3xl bg-slate-950 p-3 block border border-sky-500/20 shadow-xl"
            >
              <div className="relative aspect-square w-full overflow-hidden rounded-2xl">
                <TokenArt
                  id={ASTRO_TOKEN_ID}
                  symbol="ASTRO"
                  className="h-full w-full transition-transform duration-500 group-hover:scale-105"
                />
                <div className="nft-holo-sheen absolute inset-0" />
                <div className="absolute top-2 left-2">
                  <span className="liquid-glass-pill rounded-full px-2.5 py-0.5 text-[9px] font-bold tracking-wider text-sky-300 uppercase">
                    Flagship #001
                  </span>
                </div>
              </div>
              <div className="mt-2.5 px-1 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-white group-hover:text-sky-300 transition-colors">
                    $ASTRO Genesis
                  </p>
                  <p className="text-[10px] text-slate-400">{ASTRO_SPEC.paletteName} Series</p>
                </div>
                <span className="liquid-glass-pill rounded-lg px-2 py-1 text-[10px] font-mono font-semibold text-emerald-300">
                  Live AMM ↗
                </span>
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* 2. Interactive Cosmic Launcher Game Simulator */}
      <section id="sec-game" className="scroll-mt-20">
        <CosmicLauncherGame />
      </section>

      {/* 3. Dedicated Section: 🎓 Moonshot Radar (Graduating Soon) */}
      <section id="sec-radar" className="scroll-mt-20 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 border-b border-slate-800 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-amber-400" />
              <span className="font-mono text-xs uppercase tracking-wider text-amber-400 font-semibold">
                Milestone Telemetry
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight mt-0.5">
              🎓 Moonshot Radar (Graduating Soon)
            </h2>
            <p className="text-xs sm:text-sm text-slate-400">
              Tokens climbing the bonding curve toward the 2,000 XLM graduation milestone.
            </p>
          </div>
        </div>

        <GraduationRadar
          tokens={list.data ?? []}
          isLoading={list.isPending}
          onSelect={setSelectedToken}
        />
      </section>

      {/* 4. Dedicated Section: ⚡ Fresh Launches */}
      <section id="sec-launches" className="scroll-mt-20 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 border-b border-slate-800 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-emerald-400" />
              <span className="font-mono text-xs uppercase tracking-wider text-emerald-400 font-semibold">
                Real-Time Factory Stream
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight mt-0.5">
              ⚡ Fresh Launches
            </h2>
            <p className="text-xs sm:text-sm text-slate-400">
              The newest fair-launch tokens deployed with 100% burned LP and instant AMM pools.
            </p>
          </div>
        </div>

        <NewLaunchesFeed
          tokens={list.data ?? []}
          isLoading={list.isPending}
          onSelect={setSelectedToken}
        />
      </section>

      {/* 5. Dedicated Section: 👑 Market Discovery & Trading Pairs */}
      <section id="sec-market" className="scroll-mt-20 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 border-b border-slate-800 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-sky-400" />
              <span className="font-mono text-xs uppercase tracking-wider text-sky-400 font-semibold">
                Decentralized AMM
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight mt-0.5">
              👑 Trending & Market Discovery
            </h2>
            <p className="text-xs sm:text-sm text-slate-400">
              Explore active Soroswap liquidity pools. Zero pre-sales, zero team tokens.
            </p>
          </div>
          <Link
            to="/market"
            className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 underline underline-offset-4"
          >
            View All Tokens in Market →
          </Link>
        </div>

        <MarketList
          limit={6}
          showFilters={false}
          selectedId={selectedToken.id}
          onSelect={setSelectedToken}
        />
      </section>

      {/* 6. Quick Swap Card Terminal */}
      <section id="sec-swap" className="scroll-mt-20 space-y-3">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <span>🔄</span> Instant AMM Swap Terminal
          </h2>
          <span className="text-xs font-mono text-slate-400">
            Selected: <span className="text-sky-300 font-bold">${selectedToken.symbol ?? 'TOKEN'}</span>
          </span>
        </div>
        <SwapCard key={selectedToken.id} token={selectedToken} />
      </section>

      {/* 7. Token Info Card */}
      <section>
        <TokenInfoCard
          token={selectedToken}
          example={selectedToken.id === ASTRO_TOKEN_ID}
        />
      </section>

      {/* 8. Demo Wallet / Friendbot Section */}
      <section id="sec-demo" className="scroll-mt-20 pt-4 border-t border-slate-800/80">
        <div className="mb-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-purple-400 flex items-center gap-2">
            <span>🧪</span> Testnet Playground & Demo Wallet
          </h2>
          <p className="text-xs text-slate-400">
            Switch between 3 pre-configured Friendbot accounts to test buying, selling, and liquidity flows without a wallet extension.
          </p>
        </div>
        <DemoMode
          key={`${selectedToken.id}-${demoActive}`}
          token={selectedToken}
        />
      </section>
    </div>
  )
}
