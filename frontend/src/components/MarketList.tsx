import { useTokenList } from '../hooks/useTokenList'
import { formatAmount, shortAddress } from '../lib/format'
import { tokenPriceInXlm } from '../lib/soroswap'
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

/**
 * Tokens recientes con par en XLM, descubiertos de los eventos de la factory
 * de Soroswap. Seleccionar una fila cambia el swap de la página.
 */
export function MarketList({ selectedId, onSelect }: Props) {
  const list = useTokenList()

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Mercado</h2>
          <p className="mt-1 text-sm text-slate-400">
            Pares token/XLM creados recientemente en Soroswap testnet, leídos de
            los eventos de la factory.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void list.refetch()}
          disabled={list.isFetching}
          className="rounded-lg border border-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:border-slate-600 disabled:opacity-50"
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
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="pb-2 pr-3 font-medium">Token</th>
                <th className="pb-2 pr-3 font-medium">Precio</th>
                <th className="pb-2 pr-3 font-medium">Liquidez XLM</th>
                <th className="pb-2 font-medium">Par</th>
              </tr>
            </thead>
            <tbody>
              {list.data.map((token) => {
                const selected = token.id === selectedId
                return (
                  <tr
                    key={token.id}
                    className={`border-t border-slate-800/70 ${
                      selected ? 'bg-emerald-950/20' : ''
                    }`}
                  >
                    <td className="py-2 pr-3">
                      <button
                        type="button"
                        onClick={() =>
                          onSelect({ id: token.id, decimals: token.decimals })
                        }
                        className="text-left"
                      >
                        <span className="font-medium text-slate-100">
                          {token.symbol}
                        </span>
                        <span className="ml-2 text-xs text-slate-500">
                          {token.name}
                        </span>
                      </button>
                    </td>
                    <td className="py-2 pr-3">
                      <Price token={token} />
                    </td>
                    <td className="py-2 pr-3 font-mono text-xs text-slate-300">
                      {formatAmount(token.pool.reserveXlm, 7)}
                    </td>
                    <td className="py-2">
                      <a
                        href={`https://stellar.expert/explorer/testnet/contract/${token.pool.pairId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono text-xs text-slate-400 hover:text-emerald-400"
                      >
                        {shortAddress(token.id)} ↗
                      </a>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      <p className="mt-4 text-xs text-slate-500">
        La ventana son los últimos ~14 h de ledgers (los eventos caducan en el
        RPC). No hay índice propio: lo que ves sale de la red.
      </p>
    </section>
  )
}
