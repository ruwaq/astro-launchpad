import { useState } from 'react'
import { Link } from 'react-router'
import { CreateTokenForm } from '../components/CreateTokenForm'
import { LiquidityForm } from '../components/LiquidityForm'
import { useCreatedTokens } from '../store/creations'
import { shortAddress } from '../lib/format'
import type { LaunchpadToken } from '../lib/token'

export function CreatePage() {
  const createdTokens = useCreatedTokens((state) => state.tokens)
  const addCreatedToken = useCreatedTokens((state) => state.add)
  const [active, setActive] = useState<LaunchpadToken | null>(null)

  // Tras un refresh no hay estado de sesión: el store local nos deja seguir
  // con la liquidez de un token creado antes.
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
        <h1 className="text-2xl font-bold sm:text-3xl">Lanza tu token</h1>
        <p className="mt-1 max-w-2xl text-slate-400">
          Despliega un SEP-41 en testnet y añade liquidez en Soroswap. La wallet
          firma cada paso; no hay backend ni registro.
        </p>
      </div>

      <CreateTokenForm onCreated={onCreated} />

      {liquidityToken ? (
        <div className="flex flex-col gap-3">
          {createdTokens.length > 1 ? (
            <label className="block max-w-md text-sm">
              <span className="text-slate-400">Token para añadir liquidez</span>
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
            Ver el detalle del token →
          </Link>
        </div>
      ) : null}
    </>
  )
}
