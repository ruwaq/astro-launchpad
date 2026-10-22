import { useState } from 'react'
import { WalletButton } from './components/WalletButton'
import { WalletInstallHint } from './components/WalletInstallHint'
import { Onboarding } from './components/Onboarding'
import { TokenInfoCard } from './components/TokenInfoCard'
import { CreateTokenForm } from './components/CreateTokenForm'
import { LiquidityForm } from './components/LiquidityForm'
import { MarketList } from './components/MarketList'
import { SwapCard } from './components/SwapCard'
import { useWallet } from './store/wallet'
import { ASTRO_TOKEN_ID, RPC_URL } from './lib/network'
import { BRAND } from './lib/brand'
import type { LaunchpadToken } from './lib/token'

/** Token de ejemplo: ya está desplegado y con par en Soroswap. */
const DEMO_TOKEN: LaunchpadToken = { id: ASTRO_TOKEN_ID, decimals: 7 }

export default function App() {
  const { publicKey } = useWallet()
  const [selectedToken, setSelectedToken] = useState<LaunchpadToken>(DEMO_TOKEN)
  const [createdToken, setCreatedToken] = useState<LaunchpadToken | null>(null)
  const [liquidityDone, setLiquidityDone] = useState(false)
  const [swappedOnce, setSwappedOnce] = useState(false)

  function onCreate(token: LaunchpadToken) {
    setCreatedToken(token)
    setSelectedToken(token)
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-40 border-b border-slate-900 bg-slate-950/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:py-4">
          <h1 className="min-w-0 truncate text-lg font-semibold tracking-tight">
          {BRAND.emoji} {BRAND.name}
          </h1>
          <WalletButton />
        </div>
      </header>

      <main className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-6 sm:gap-6 sm:py-10">
        <div className="flex flex-col gap-3">
          <p className="text-xs font-medium uppercase tracking-widest text-emerald-400">
            {BRAND.tagline} · {BRAND.taglineEn}
          </p>
          <h2 className="text-2xl font-bold sm:text-3xl">{BRAND.hero}</h2>
          <p className="max-w-xl text-slate-400">
            Crea tu token, añade liquidez y swapea — todo on-chain, con la red
            como única fuente de datos.{' '}
            <span className="text-slate-300">
              Te quedas con tus LP tokens: ganas fees de cada swap mientras
              sostengas tu liquidez.
            </span>
          </p>
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-slate-800 px-3 py-1 text-xs text-slate-400">
            <span className="h-2 w-2 rounded-full bg-amber-400" />
            testnet · login = wallet
          </span>
          <WalletInstallHint />
        </div>

        <Onboarding
          created={Boolean(createdToken)}
          liquidity={liquidityDone}
          swapped={swappedOnce}
        />

        {/* Orden móvil pensado en una sola meta por pantalla:
            1) explorar el mercado → 2) swap del token elegido →
            3) lanzar el propio (crear + liquidez juntos). */}
        <div id="sec-mercado" className="scroll-mt-20">
          <MarketList selectedId={selectedToken.id} onSelect={setSelectedToken} />
        </div>
        <div id="sec-swap" className="scroll-mt-20">
          <SwapCard token={selectedToken} onSwapped={() => setSwappedOnce(true)} />
        </div>
        <div id="sec-crear" className="scroll-mt-20 flex flex-col gap-4 sm:gap-6">
          <CreateTokenForm onCreated={onCreate} />
          {createdToken ? (
            <LiquidityForm token={createdToken} onAdded={() => setLiquidityDone(true)} />
          ) : null}
        </div>

        {/* Info del token de ejemplo: demo artifact al final de la página. */}
        <TokenInfoCard />

        <footer className="mt-4 border-t border-slate-900 pt-4 text-xs text-slate-500">
          <p>
            {BRAND.name}: {BRAND.provenance}.
          </p>
          <p className="mt-1">
            RPC: <span className="font-mono">{RPC_URL}</span> · contrato:{' '}
            <span className="font-mono">{ASTRO_TOKEN_ID}</span>
          </p>
          {publicKey ? <p className="mt-1">Conectado como {publicKey}</p> : null}
        </footer>
      </main>
    </div>
  )
}
