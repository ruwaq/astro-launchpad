import { useState } from 'react'
import { Link } from 'react-router'
import { Onboarding } from '../components/Onboarding'
import { WalletInstallHint } from '../components/WalletInstallHint'
import { DemoMode } from '../components/DemoMode'
import { MarketList } from '../components/MarketList'
import { SwapCard } from '../components/SwapCard'
import { LiquidityPosition } from '../components/LiquidityPosition'
import { TokenInfoCard } from '../components/TokenInfoCard'
import { useCreatedTokens } from '../store/creations'
import { useProgress } from '../store/progress'
import { useWallet } from '../store/wallet'
import { ASTRO_TOKEN_ID } from '../lib/network'
import { BRAND } from '../lib/brand'
import { PROTOCOL_DEPLOY_FEE_USD } from '../lib/tokenomics'
import type { LaunchpadToken } from '../lib/token'

/** Genesis token: already deployed and paired on Soroswap testnet. */
const DEMO_TOKEN: LaunchpadToken = { id: ASTRO_TOKEN_ID, decimals: 7 }

export function HomePage() {
  const [selectedToken, setSelectedToken] = useState<LaunchpadToken>(DEMO_TOKEN)
  const { demoActive } = useWallet()
  const createdTokens = useCreatedTokens((state) => state.tokens)
  const liquidity = useProgress((state) => state.liquidity)
  const swapped = useProgress((state) => state.swapped)

  return (
    <>
      <div className="flex flex-col gap-3">
        <p className="text-xs font-medium uppercase tracking-widest text-emerald-400">
          {BRAND.taglineEn} · {BRAND.name}
        </p>
        <h1 className="text-2xl font-bold sm:text-3xl">
          The Safest & Most Fun Memecoin Launchpad on Stellar 🌊🚀
        </h1>
        <p className="max-w-xl text-slate-400">
          Launch your memecoin for just{' '}
          <strong className="text-emerald-300">${PROTOCOL_DEPLOY_FEE_USD.toFixed(2)} USD</strong>{' '}
          in XLM. Standard <strong>Fair Launch</strong> with 1% Creator allocation, 99% in pool,
          renounced ownership, and 100% LP burned to the Stellar dead address.{' '}
          <span className="text-slate-300">
            Trade live immediately on the AstroGate curve and across the Stellar AMM ecosystem
            (Soroswap DEX, Aquarius, SDEX).
          </span>
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            to="/create"
            className="inline-flex min-h-[44px] items-center rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-bold text-slate-950 hover:bg-emerald-400 shadow-md shadow-emerald-500/20"
          >
            Launch Token (${PROTOCOL_DEPLOY_FEE_USD.toFixed(2)} USD)
          </Link>
          <Link
            to="/market"
            className="inline-flex min-h-[44px] items-center rounded-lg border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-200 hover:border-slate-500"
          >
            👑 View King of the Hill & Market
          </Link>
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-slate-800 bg-slate-900/60 px-3 py-1 text-xs text-slate-300">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
            Stellar Soroban Testnet · SEP-41
          </span>
        </div>
        <WalletInstallHint />
      </div>

      <Onboarding
        created={createdTokens.length > 0}
        liquidity={liquidity}
        swapped={swapped}
      />

      <DemoMode
        key={`${selectedToken.id}-${demoActive}`}
        token={selectedToken}
      />

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

      <div id="sec-swap" className="scroll-mt-20">
        <SwapCard token={selectedToken} />
      </div>

      <LiquidityPosition key={selectedToken.id} token={selectedToken} />

      <TokenInfoCard
        token={selectedToken}
        example={selectedToken.id === ASTRO_TOKEN_ID}
      />
    </>
  )
}
