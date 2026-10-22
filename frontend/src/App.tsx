import { useState } from 'react'
import { WalletButton } from './components/WalletButton'
import { TokenInfoCard } from './components/TokenInfoCard'
import { CreateTokenForm } from './components/CreateTokenForm'
import { LiquidityForm } from './components/LiquidityForm'
import { SwapCard } from './components/SwapCard'
import { useWallet } from './store/wallet'
import { ASTRO_TOKEN_ID, RPC_URL } from './lib/network'
import type { LaunchpadToken } from './lib/token'

/** Token de ejemplo: ya está desplegado y con par en Soroswap. */
const DEMO_TOKEN: LaunchpadToken = { id: ASTRO_TOKEN_ID, decimals: 7 }

export default function App() {
  const { publicKey } = useWallet()
  const [createdToken, setCreatedToken] = useState<LaunchpadToken | null>(null)

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-900">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <h1 className="text-lg font-semibold tracking-tight">Astro Launchpad</h1>
          <WalletButton />
        </div>
      </header>

      <main className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-10">
        <div className="flex flex-col gap-3">
          <h2 className="text-3xl font-bold">Launchpad + AMM en Stellar</h2>
          <p className="max-w-xl text-slate-400">
            Crea tu token, añade liquidez y swapea — todo on-chain, con la red
            como única fuente de datos.
          </p>
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-slate-800 px-3 py-1 text-xs text-slate-400">
            <span className="h-2 w-2 rounded-full bg-amber-400" />
            testnet · login = wallet
          </span>
        </div>

        <TokenInfoCard />
        <SwapCard token={DEMO_TOKEN} />
        <CreateTokenForm onCreated={(token) => setCreatedToken(token)} />
        {createdToken ? <LiquidityForm token={createdToken} /> : null}
        {createdToken ? <SwapCard token={createdToken} /> : null}

        <footer className="mt-4 border-t border-slate-900 pt-4 text-xs text-slate-500">
          <p>
            RPC: <span className="font-mono">{RPC_URL}</span> · contrato:{' '}
            <span className="font-mono">{ASTRO_TOKEN_ID}</span>
          </p>
          {publicKey ? (
            <p className="mt-1">Conectado como {publicKey}</p>
          ) : null}
        </footer>
      </main>
    </div>
  )
}
