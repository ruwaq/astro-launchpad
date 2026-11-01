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
import type { LaunchpadToken } from '../lib/token'

/** Token de ejemplo: ya está desplegado y con par en Soroswap. */
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
          {BRAND.tagline} · {BRAND.taglineEn}
        </p>
        <h1 className="text-2xl font-bold sm:text-3xl">{BRAND.hero}</h1>
        <p className="max-w-xl text-slate-400">
          Crea tu token, añade liquidez y swapea — todo on-chain, con la red
          como única fuente de datos.{' '}
          <span className="text-slate-300">
            Te quedas con tus LP tokens: ganas fees de cada swap mientras
            sostengas tu liquidez.
          </span>
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            to="/create"
            className="inline-flex min-h-[44px] items-center rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-medium text-slate-950 hover:bg-emerald-400"
          >
            Crear mi token
          </Link>
          <Link
            to="/market"
            className="inline-flex min-h-[44px] items-center rounded-lg border border-slate-700 px-4 py-2.5 text-sm text-slate-200 hover:border-slate-500"
          >
            Explorar el mercado
          </Link>
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-slate-800 px-3 py-1 text-xs text-slate-400">
            <span className="h-2 w-2 rounded-full bg-amber-400" />
            testnet · login = wallet
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

      <div id="sec-mercado" className="scroll-mt-20">
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
            Ver todo el mercado →
          </Link>
        </div>
      </div>

      <div id="sec-swap" className="scroll-mt-20">
        <SwapCard token={selectedToken} />
      </div>

      <LiquidityPosition key={selectedToken.id} token={selectedToken} />

      <TokenInfoCard />
    </>
  )
}
