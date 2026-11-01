import { useTokenEvents } from '../hooks/useTokenEvents'
import { formatAmount, shortAddress } from '../lib/format'
import {
  tokenEventSummary,
  type TokenEventKind,
} from '../lib/token-events'
import type { LaunchpadToken } from '../lib/token'

const EVENT_CLASSES: Record<TokenEventKind, string> = {
  transfer: 'border-sky-800 bg-sky-950/40 text-sky-300',
  mint: 'border-emerald-800 bg-emerald-950/40 text-emerald-300',
  burn: 'border-rose-800 bg-rose-950/40 text-rose-300',
}

const EVENT_LABELS: Record<TokenEventKind, string> = {
  transfer: 'Transferencia',
  mint: 'Emisión',
  burn: 'Quema',
}

function formatWhen(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('es-ES', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Actividad global reciente del contrato, no la del usuario. Se lee de los
 * eventos del RPC (ventana limitada); el par de Soroswap no emite swaps, así
 * que aquí se ven transferencias, emisiones y quemas del token.
 */
export function TokenActivity({ token }: { token: LaunchpadToken }) {
  const events = useTokenEvents(token.id)
  const list = events.data ?? []

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Actividad on-chain reciente</h2>
          <p className="mt-1 text-xs text-slate-500">
            Movimientos del contrato en la ventana reciente del RPC. No es un
            índice global.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void events.refetch()}
          disabled={events.isFetching}
          className="min-h-[44px] rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300 hover:border-slate-500 disabled:opacity-50"
        >
          {events.isFetching ? 'Actualizando…' : 'Actualizar'}
        </button>
      </div>

      {events.isPending ? (
        <p className="mt-4 text-sm text-slate-400">Leyendo eventos del token…</p>
      ) : null}

      {events.isError ? (
        <div className="mt-4 rounded-lg border border-rose-900 bg-rose-950/40 px-3 py-2 text-sm text-rose-300">
          No se pudo leer la actividad on-chain: {events.error.message}
        </div>
      ) : null}

      {events.isSuccess && list.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-slate-700 bg-slate-950/30 p-4 text-sm text-slate-400">
          No hay transferencias, emisiones ni quemas en la ventana reciente.
          Las operaciones nuevas aparecerán aquí.
        </p>
      ) : null}

      {list.length > 0 ? (
        <ul className="mt-2 divide-y divide-slate-800">
          {list.map((event) => (
            <li
              key={event.id}
              className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${EVENT_CLASSES[event.kind]}`}
                  >
                    {EVENT_LABELS[event.kind]}
                  </span>
                  <span className="font-mono text-xs text-slate-200">
                    {formatAmount(event.amount, token.decimals)}{' '}
                    {token.symbol ?? 'token'}
                  </span>
                  <span className="font-mono text-[11px] text-slate-500">
                    {formatWhen(event.at)}
                  </span>
                </div>
                <p className="mt-1 break-words text-xs text-slate-400">
                  {tokenEventSummary(event)}
                </p>
              </div>

              {event.txHash ? (
                <a
                  href={`https://stellar.expert/explorer/testnet/tx/${event.txHash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 text-xs text-slate-400 underline underline-offset-2 hover:text-slate-200"
                >
                  tx {shortAddress(event.txHash)} ↗
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      <p className="mt-3 text-xs text-slate-500">
        Ventana reciente del RPC (~14 h). No incluye swaps del par porque
        Soroswap no los emite; el histórico completo requiere un indexer.
      </p>
    </section>
  )
}
