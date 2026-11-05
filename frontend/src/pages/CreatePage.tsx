import { useState } from 'react'
import { Link } from 'react-router'
import { CreateTokenForm } from '../components/CreateTokenForm'
import { LiquidityForm } from '../components/LiquidityForm'
import { useCreatedTokens } from '../store/creations'
import { shortAddress } from '../lib/format'
import type { LaunchpadToken } from '../lib/token'

const LAUNCH_STEPS = [
  {
    title: 'Deploy Token',
    hint: 'Deploys SEP-41 smart contract on testnet.',
  },
  {
    title: 'Seed Liquidity',
    hint: 'Creates token/XLM pair on Soroswap & burns LP.',
  },
  {
    title: 'Live on Market',
    hint: 'Instantly tradeable across Stellar DEXs.',
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
    <>
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">Launch Your Token</h1>
        <p className="mt-1 max-w-2xl text-slate-400">
          Deploy a SEP-41 token on Stellar testnet and seed liquidity on Soroswap.
          Your wallet signs each step; 100% decentralized with zero backend.
        </p>
      </div>

      <ol
        aria-label="How a token launches into the market"
        className="grid gap-2 sm:grid-cols-3"
      >
        {LAUNCH_STEPS.map((step, index) => (
          <li
            key={step.title}
            className="rounded-lg border border-slate-800 bg-slate-900/40 p-3"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-700 text-xs font-semibold text-slate-300">
              {index + 1}
            </span>
            <p className="mt-2 text-sm font-medium text-slate-200">
              {step.title}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">{step.hint}</p>
          </li>
        ))}
      </ol>

      <CreateTokenForm onCreated={onCreated} />

      {liquidityToken ? (
        <div id="add-liquidity" className="scroll-mt-20 flex flex-col gap-3">
          {createdTokens.length > 1 ? (
            <label className="block max-w-md text-sm">
              <span className="text-slate-400">Token to manage liquidity</span>
              <select
                value={liquidityToken.id}
                onChange={(event) => selectToken(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 px-3.5 py-3 text-base text-slate-100 outline-none focus:border-emerald-500"
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

          <Link
            to={`/token/${liquidityToken.id}`}
            className="text-sm text-emerald-400 underline underline-offset-2 hover:text-emerald-300"
          >
            View Token Details →
          </Link>
        </div>
      ) : null}
    </>
  )
}
