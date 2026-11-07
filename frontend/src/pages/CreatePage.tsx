import { useState } from 'react'
import { Link } from 'react-router'
import { CreateTokenForm } from '../components/CreateTokenForm'
import { LiquidityForm } from '../components/LiquidityForm'
import { useCreatedTokens } from '../store/creations'
import { shortAddress } from '../lib/format'
import type { LaunchpadToken } from '../lib/token'

const LAUNCH_STEPS = [
  {
    icon: '✨',
    title: 'Create Your Coin',
    hint: 'Pick a name, ticker, logo & Telegram. $1.11 USD deploy fee.',
  },
  {
    icon: '🚀',
    title: 'Trade on the Curve',
    hint: 'Fair launch for everyone. Price increases as players buy.',
  },
  {
    icon: '🎓',
    title: 'Graduate to Soroswap DEX',
    hint: 'Hit 100% and liquidity is locked forever with LP burned!',
  },
]

export function CreatePage() {
  const createdTokens = useCreatedTokens((state) => state.tokens)
  const addCreatedToken = useCreatedTokens((state) => state.add)
  const [active, setActive] = useState<LaunchpadToken | null>(null)

  const liquidityToken = active ?? createdTokens[0] ?? null

  function onCreated(token: LaunchpadToken) {
    addCreatedToken({
      id: token.id,
      symbol: token.symbol,
      decimals: token.decimals,
    })
    setActive(token)
  }

  function selectToken(id: string) {
    const token = createdTokens.find((item) => item.id === id)
    if (!token) return
    setActive({ id: token.id, decimals: token.decimals, symbol: token.symbol })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black sm:text-3xl flex items-center gap-2">
          <span>🎮</span> Launch Your Token
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-400">
          Create and launch your coin on Stellar in seconds. Simple, fast, and 100% rug-proof with renounced ownership.
        </p>
      </div>

      <ol
        aria-label="How a token launches into the market"
        className="grid gap-3 sm:grid-cols-3"
      >
        {LAUNCH_STEPS.map((step, index) => (
          <li
            key={step.title}
            className="rounded-xl border border-slate-800 bg-slate-900/50 p-3.5 shadow-sm"
          >
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/20 text-xs font-bold text-emerald-300">
                {index + 1}
              </span>
              <span className="text-base">{step.icon}</span>
              <p className="text-sm font-bold text-slate-200">
                {step.title}
              </p>
            </div>
            <p className="mt-2 text-xs text-slate-400 leading-relaxed">{step.hint}</p>
          </li>
        ))}
      </ol>

      <CreateTokenForm onCreated={onCreated} />

      {liquidityToken ? (
        <details id="add-liquidity" className="group rounded-xl border border-slate-800 bg-slate-900/30 p-4 transition-all">
          <summary className="flex cursor-pointer select-none items-center justify-between font-semibold text-sm text-slate-300 hover:text-white">
            <span className="flex items-center gap-2">
              <span>💧</span> Manage Initial Pool Liquidity for ${liquidityToken.symbol}
            </span>
            <span className="text-xs text-slate-500 transition-transform group-open:rotate-180">
              ▼
            </span>
          </summary>

          <div className="mt-4 space-y-3 pt-3 border-t border-slate-800">
            {createdTokens.length > 1 ? (
              <label className="block max-w-md text-sm">
                <span className="text-slate-400">Select token:</span>
                <select
                  value={liquidityToken.id}
                  onChange={(event) => selectToken(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500"
                >
                  {createdTokens.map((token) => (
                    <option key={token.id} value={token.id}>
                      {token.symbol ?? 'Token'} · {shortAddress(token.id)}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            <LiquidityForm key={liquidityToken.id} token={liquidityToken} />

            <div className="pt-2">
              <Link
                to={`/token/${liquidityToken.id}`}
                className="inline-flex items-center gap-1.5 text-sm font-bold text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                Go to ${liquidityToken.symbol} Trading Page →
              </Link>
            </div>
          </div>
        </details>
      ) : null}
    </div>
  )
}
