import { useTokenList } from '../hooks/useTokenList'
import { formatAmount } from '../lib/format'
import { tokenPriceInXlm } from '../lib/soroswap'
import { TokenArt } from './TokenArt'
import type { LaunchpadToken } from '../lib/token'
import type { TokenListing } from '../lib/discovery'

type Props = {
  /** Token actualmente seleccionado para el swap. */
  selectedId: string | null
  onSelect: (token: LaunchpadToken) => void
}

function Price({ token }: { token: TokenListing }) {
  const price = tokenPriceInXlm(token.pool, token.decimals)
  if (price === 0n) return <span className="text-slate-500">—</span>
  return (
    <span className="font-mono text-sm text-emerald-400">
      {formatAmount(price, 7)} XLM
    </span>
  )
}

function MarketCard({
  token,
  selected,
  onSelect,
}: {
  token: TokenListing
  selected: boolean
  onSelect: (token: LaunchpadToken) => void
}) {
  return (
    <li
      className={`relative flex flex-col overflow-hidden rounded-2xl border bg-slate-900/40 transition-colors ${
        selected
          ? 'border-emerald-500 ring-1 ring-emerald-500/40'
          : 'border-slate-800 hover:border-slate-600'
      }`}
    >
      <div className="relative">
        <TokenArt
          id={token.id}
          symbol={token.symbol}
          className="aspect-square w-full"
        />
        <a
          href={`https://stellar.expert/explorer/testnet/contract/${token.pool.pairId}`}
          target="_blank"
          rel="noreferrer"
          aria-label={`Ver ${token.symbol} en el explorador`}
          className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-slate-950/70 text-slate-300 backdrop-blur hover:text-emerald-300"
        >
          ↗
        </a>
        {selected ? (
          <span className="absolute left-2 top-2 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-semibold text-slate-950">
            en el swap
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col p-3">
        <button
          type="button"
          onClick={() => onSelect({ id: token.id, decimals: token.decimals })}
          className="min-h-[44px] text-left"
        >
          <p className="truncate text-sm font-semibold text-slate-100">
            {token.symbol}
          </p>
          <p className="truncate text-xs text-slate-500">{token.name}</p>
        </button>
        <div className="mt-auto pt-2">
          <p className="flex items-baseline justify-between gap-2">
            <span className="text-[11px] text-slate-500">Precio</span>
            <Price token={token} />
          </p>
          <p className="mt-1 flex items-baseline justify-between gap-2">
            <span className="text-[11px] text-slate-500">Liquidez</span>
            <span className="font-mono text-xs text-slate-300">
              {formatAmount(token.pool.reserveXlm, 7)}
            </span>
          </p>
        </div>
      </div>
    </li>
  )
}

/**
 * Mercado estilo colección OpenSea: cada par pinta una tarjeta con arte
 * generativo determinista (hash del contrato → paleta + formas). Los
 * datos siguen siendo 100% de la red: eventos de la factory de Soroswap.
 * Tocar una tarjeta la selecciona para el swap de abajo.
 */
export function MarketList({ selectedId, onSelect }: Props) {
  const list = useTokenList()

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Mercado</h2>
          <p className="mt-1 text-sm text-slate-400">
            Pares token/XLM leídos de los eventos de la factory de Soroswap.
            Toca una tarjeta para swapearla abajo ⤵
          </p>
        </div>
        <button
          type="button"
          onClick={() => void list.refetch()}
          disabled={list.isFetching}
          className="min-h-[44px] rounded-lg border border-slate-800 px-3 py-2 text-xs text-slate-300 hover:border-slate-600 disabled:opacity-50"
        >
          {list.isFetching ? 'Actualizando…' : 'Actualizar'}
        </button>
      </div>

      {list.isPending ? (
        <p className="mt-4 text-sm text-slate-400">
          Descubriendo pares en la red…
        </p>
      ) : null}

      {list.isError ? (
        <div className="mt-4 rounded-lg border border-rose-900 bg-rose-950/40 px-3 py-2 text-sm text-rose-300">
          No se pudo leer el mercado: {list.error.message}
        </div>
      ) : null}

      {list.data && list.data.length === 0 ? (
        <p className="mt-4 text-sm text-slate-400">
          No hay pares nuevos en la ventana reciente. Crea un token y añade
          liquidez para estrenar el mercado.
        </p>
      ) : null}

      {list.data && list.data.length > 0 ? (
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {list.data.map((token) => (
            <MarketCard
              key={token.id}
              token={token}
              selected={token.id === selectedId}
              onSelect={onSelect}
            />
          ))}
        </ul>
      ) : null}

      <p className="mt-4 text-xs text-slate-500">
        La ventana son los últimos ~14 h de ledgers (los eventos caducan en el
        RPC). No hay índice propio: lo que ves sale de la red. El arte es
        generativo: cada contrato tiene el suyo derivado de su hash.
      </p>
    </section>
  )
}
