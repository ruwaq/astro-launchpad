import { useTokenEvents } from '../hooks/useTokenEvents'
import { useSoroswapPool } from '../hooks/useSoroswapPool'
import { formatAmount, shortAddress } from '../lib/format'
import { explorerTxUrl } from '../lib/explorer'
import {
  classifyTokenEvent,
  tokenEventSummary,
  type TokenTradeRole,
} from '../lib/token-events'
import type { LaunchpadToken } from '../lib/token'

const EVENT_CLASSES: Record<TokenTradeRole, string> = {
  buy: 'border-emerald-700 bg-emerald-950/60 text-emerald-300',
  sell: 'border-amber-700 bg-amber-950/60 text-amber-300',
  transfer: 'border-sky-800 bg-sky-950/40 text-sky-300',
  mint: 'border-emerald-800 bg-emerald-950/40 text-emerald-300',
  burn: 'border-rose-800 bg-rose-950/40 text-rose-300',
}

const EVENT_LABELS: Record<TokenTradeRole, string> = {
  buy: '🟢 Buy from Pool',
  sell: '🔴 Sell to Pool',
  transfer: 'Transfer',
  mint: 'Mint',
  burn: 'Burn',
}

function formatWhen(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Recent on-chain activity read from RPC events.
 */
export function TokenActivity({
  token,
  tokenId,
  decimals = 7,
}: {
  token?: LaunchpadToken
  tokenId?: string
  decimals?: number
}) {
  const activeId = token?.id ?? tokenId ?? ''
  const activeDecimals = token?.decimals ?? decimals
  const activeSymbol = token?.symbol ?? 'token'

  const events = useTokenEvents(activeId)
  const pool = useSoroswapPool(activeId)
  const pairId = pool.data?.pairId ?? null
  const list = events.data ?? []

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Recent On-Chain Activity</h2>
          <p className="mt-1 text-xs text-slate-500">
            Buys, sells against the Soroswap AMM, transfers, and burns read live from SEP-41 contract events.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void events.refetch()}
          disabled={events.isFetching}
          className="min-h-[44px] rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300 hover:border-slate-500 disabled:opacity-50"
        >
          {events.isFetching ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {events.isPending ? (
        <p className="mt-4 text-sm text-slate-400">Reading token events on-chain…</p>
      ) : null}

      {events.isError ? (
        <div className="mt-4 rounded-lg border border-rose-900 bg-rose-950/40 px-3 py-2 text-sm text-rose-300">
          Unable to read on-chain activity: {events.error.message}
        </div>
      ) : null}

      {events.isSuccess && list.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-slate-700 bg-slate-950/30 p-4 text-sm text-slate-400">
          No transfers, mints, or burns detected in the recent ledger window. New trades will appear here automatically.
        </p>
      ) : null}

      {list.length > 0 ? (
        <ul className="mt-2 divide-y divide-slate-800">
          {list.map((event) => {
            const role = classifyTokenEvent(event, pairId)
            return (
              <li
                key={event.id}
                className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${EVENT_CLASSES[role]}`}
                    >
                      {EVENT_LABELS[role]}
                    </span>
                    <span className="font-mono text-xs text-slate-200">
                      {formatAmount(event.amount, activeDecimals)}{' '}
                      {activeSymbol}
                    </span>
                    <span className="font-mono text-[11px] text-slate-500">
                      {formatWhen(event.at)}
                    </span>
                  </div>
                  <p className="mt-1 break-words text-xs text-slate-400">
                    {tokenEventSummary(event, pairId)}
                  </p>
                </div>

                {event.txHash ? (
                  <a
                    href={explorerTxUrl(event.txHash)}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 text-xs text-slate-400 underline underline-offset-2 hover:text-slate-200"
                  >
                    tx {shortAddress(event.txHash)} ↗
                  </a>
                ) : null}
              </li>
            )
          })}
        </ul>
      ) : null}

      <p className="mt-3 text-xs text-slate-500">
        Recent RPC window (~14 h). Swaps on the AMM are identified automatically whenever the source or destination of a transfer is the Soroswap pair contract.
      </p>
    </section>
  )
}
