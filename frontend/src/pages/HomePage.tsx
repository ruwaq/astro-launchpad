import { Link } from 'react-router'
import { WalletInstallHint } from '../components/WalletInstallHint'
import { DemoMode } from '../components/DemoMode'
import { TokenArt } from '../components/TokenArt'
import { useWallet } from '../store/wallet'
import { ASTRO_TOKEN_ID } from '../lib/network'
import { BRAND } from '../lib/brand'
import type { LaunchpadToken } from '../lib/token'

/** Genesis token: already deployed and paired on Soroswap testnet. */
const DEMO_TOKEN: LaunchpadToken = { id: ASTRO_TOKEN_ID, decimals: 7, symbol: 'ASTRO' }

export function HomePage() {
  const demoActive = useWallet((state) => state.demoActive)

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
              <Link
                to="/market"
                className="liquid-glass-pill inline-flex min-h-[44px] items-center rounded-2xl px-5 py-2.5 text-sm font-semibold text-slate-200 hover:text-white transition-all"
              >
                📊 Explore Market →
              </Link>
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
                <div className="holo-sheen absolute inset-0" />
                <div className="absolute top-2 left-2">
                  <span className="liquid-glass-pill rounded-full px-2.5 py-0.5 text-[9px] font-bold tracking-wider text-sky-300 uppercase font-mono">
                    Flagship #001
                  </span>
                </div>
              </div>
              <div className="mt-2.5 px-1 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-white group-hover:text-sky-300 transition-colors">
                    $ASTRO Genesis
                  </p>
                  <p className="text-[10px] text-slate-400">Genesis Memecoin</p>
                </div>
                <span className="liquid-glass-pill rounded-lg px-2 py-1 text-[10px] font-mono font-semibold text-emerald-300">
                  Live AMM ↗
                </span>
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* 2. Three Pillars: Minimalist Feature Overview */}
      <section className="grid gap-4 sm:grid-cols-3">
        <div className="liquid-glass rounded-2xl p-5 border border-white/[0.07] space-y-2">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-500/20 text-base">
              ⚡
            </span>
            <h3 className="font-bold text-white text-sm">Single-Tx Atomic Deploy</h3>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Token deployment, Soroswap AMM pool creation, initial seeding, and LP burning execute simultaneously in one signature.
          </p>
          <Link to="/create" className="inline-block text-xs font-semibold text-sky-400 hover:text-sky-300 pt-1">
            Launch your meme →
          </Link>
        </div>

        <div className="liquid-glass rounded-2xl p-5 border border-white/[0.07] space-y-2">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/20 text-base">
              🛡️
            </span>
            <h3 className="font-bold text-white text-sm">100% Burned LP</h3>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Liquidity pool tokens are permanently sent to Stellar dead address. Ownership renounced on-chain — zero dev rug pulls possible.
          </p>
          <Link to="/market" className="inline-block text-xs font-semibold text-emerald-400 hover:text-emerald-300 pt-1">
            Browse verified tokens →
          </Link>
        </div>

        <div className="liquid-glass rounded-2xl p-5 border border-white/[0.07] space-y-2">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/20 text-base">
              🎓
            </span>
            <h3 className="font-bold text-white text-sm">2,000 XLM DEX Target</h3>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Tokens ascend the automated bonding curve. Track real-time progress on Moonshot Radar as liquidity deepens.
          </p>
          <Link to="/market" className="inline-block text-xs font-semibold text-amber-300 hover:text-amber-200 pt-1">
            View radar telemetry →
          </Link>
        </div>
      </section>

      {/* 4. Demo Mode: Disposable Friendbot Accounts for Testnet */}
      <section className="liquid-glass rounded-2xl p-5 border border-purple-500/20">
        <div className="mb-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-purple-400 flex items-center gap-2">
            <span>🧪</span> Testnet Playground & Instant Demo Wallet
          </h2>
          <p className="text-xs text-slate-400">
            Switch between pre-configured Friendbot accounts to test swaps and launches with 10,000 testnet XLM.
          </p>
        </div>
        <DemoMode key={`home-demo-${demoActive}`} token={DEMO_TOKEN} />
      </section>
    </div>
  )
}
