import { useState } from 'react'
import { Networks, StellarWalletsKit } from '@creit.tech/stellar-wallets-kit'
import { defaultModules } from '@creit.tech/stellar-wallets-kit/modules/utils'

StellarWalletsKit.init({
  modules: defaultModules(),
  network: Networks.TESTNET,
})

export default function App() {
  const [pubKey, setPubKey] = useState<string | null>(null)

  async function connect() {
    const { address } = await StellarWalletsKit.authModal()
    setPubKey(address)
  }

  async function disconnect() {
    await StellarWalletsKit.disconnect()
    setPubKey(null)
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
        <h1 className="text-lg font-semibold tracking-tight">
          Astro Launchpad
        </h1>
        {pubKey ? (
          <div className="flex items-center gap-2">
            <code className="rounded bg-slate-800 px-2 py-1 text-xs">
              {pubKey.slice(0, 6)}…{pubKey.slice(-4)}
            </code>
            <button
              type="button"
              onClick={disconnect}
              className="rounded-lg border border-slate-700 px-3 py-1 text-sm hover:bg-slate-800"
            >
              Salir
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={connect}
            className="rounded-lg bg-emerald-500 px-4 py-1.5 text-sm font-medium text-slate-950 hover:bg-emerald-400"
          >
            Conectar wallet
          </button>
        )}
      </header>

      <main className="mx-auto flex max-w-5xl flex-col items-center justify-center gap-4 px-4 pt-24 text-center">
        <h2 className="text-3xl font-bold">Launchpad + AMM en Stellar</h2>
        <p className="max-w-md text-slate-400">
          Crea tu token, añade liquidez y swapea — todo on-chain, mostrando
          posiciones, aperturas y feeds en tiempo real.
        </p>
        <span className="inline-flex items-center gap-2 rounded-full border border-slate-800 px-3 py-1 text-xs text-slate-400">
          <span className="h-2 w-2 rounded-full bg-amber-400" />
          testnet · login = wallet
        </span>
      </main>
    </div>
  )
}
