import { useMemo, useState } from 'react'
import { useTokenEvents } from '../hooks/useTokenEvents'
import { useSoroswapPool } from '../hooks/useSoroswapPool'
import { formatAmount, shortAddress } from '../lib/format'
import { explorerAccountUrl, explorerTxUrl } from '../lib/explorer'
import {
  classifyTokenEvent,
  tokenEventSummary,
  type TokenEvent,
  type TokenTradeRole,
} from '../lib/token-events'
import { whaleThresholdBase } from '../lib/tokenomics'
import { useCopy } from '../hooks/useCopy'
import type { LaunchpadToken } from '../lib/token'

const EMPTY_EVENTS: TokenEvent[] = []

type FilterKey = 'all' | 'buy' | 'sell' | 'whale'
type ViewMode = 'grid' | 'list'

const ROLE_BADGES: Record<
  TokenTradeRole,
  { label: string; bg: string; text: string; border: string; icon: string }
> = {
  buy: {
    label: 'BUY',
    bg: 'bg-emerald-500/20',
    text: 'text-emerald-300',
    border: 'border-emerald-500/50',
    icon: '🟢',
  },
  sell: {
    label: 'SELL',
    bg: 'bg-rose-500/20',
    text: 'text-rose-300',
    border: 'border-rose-500/50',
    icon: '🔴',
  },
  mint: {
    label: 'MINT',
    bg: 'bg-cyan-500/20',
    text: 'text-cyan-300',
    border: 'border-cyan-500/50',
    icon: '✨',
  },
  burn: {
    label: 'BURN',
    bg: 'bg-purple-500/20',
    text: 'text-purple-300',
    border: 'border-purple-500/50',
    icon: '🔥',
  },
  transfer: {
    label: 'TRANSFER',
    bg: 'bg-sky-500/20',
    text: 'text-sky-300',
    border: 'border-sky-500/50',
    icon: '🔄',
  },
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 60_000) return 'just now'
  const mins = Math.floor(diff / 60_000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function addressAvatarColor(address?: string): string {
  if (!address) return 'bg-slate-700'
  const colors = [
    'from-emerald-400 to-teal-600',
    'from-cyan-400 to-blue-600',
    'from-amber-400 to-orange-600',
    'from-purple-400 to-indigo-600',
    'from-rose-400 to-pink-600',
    'from-lime-400 to-emerald-600',
  ]
  let sum = 0
  for (let i = 0; i < address.length; i++) {
    sum += address.charCodeAt(i)
  }
  return colors[sum % colors.length]
}

/**
 * Interactive on-chain trade & transfer history in cuadros (cards).
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
  const activeSymbol = token?.symbol ?? 'TOKEN'

  const events = useTokenEvents(activeId)
  const pool = useSoroswapPool(activeId)
  const pairId = pool.data?.pairId ?? null
  const list = events.data ?? EMPTY_EVENTS
  const { lastCopied, copy } = useCopy()

  const [filter, setFilter] = useState<FilterKey>('all')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [selectedEvent, setSelectedEvent] = useState<TokenEvent | null>(null)

  // Classify events
  const classifiedEvents = useMemo(() => {
    const whaleThreshold = whaleThresholdBase(activeDecimals)
    return list.map((event) => {
      const role = classifyTokenEvent(event, pairId)
      // Whale trade: >= 1% of the standard fair-launch supply.
      const isWhale = event.amount >= whaleThreshold
      return { event, role, isWhale }
    })
  }, [list, pairId, activeDecimals])

  const buyCount = useMemo(
    () => classifiedEvents.filter((item) => item.role === 'buy').length,
    [classifiedEvents],
  )
  const sellCount = useMemo(
    () => classifiedEvents.filter((item) => item.role === 'sell').length,
    [classifiedEvents],
  )
  const whaleCount = useMemo(
    () => classifiedEvents.filter((item) => item.isWhale).length,
    [classifiedEvents],
  )

  const filtered = useMemo(() => {
    return classifiedEvents.filter((item) => {
      if (filter === 'buy') return item.role === 'buy'
      if (filter === 'sell') return item.role === 'sell'
      if (filter === 'whale') return item.isWhale
      return true
    })
  }, [classifiedEvents, filter])

  return (
    <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/40 p-4 sm:p-6 shadow-sm">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/20 text-sm">
              🧱
            </span>
            <h2 className="text-base sm:text-lg font-bold text-slate-100">
              Recent On-Chain Activity
            </h2>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Interactive live feed of buys, sells, and token movements fetched directly from Soroban RPC.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* View mode toggle */}
          <div className="flex rounded-lg border border-slate-800 bg-slate-950/80 p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              title="Grid View"
              className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                viewMode === 'grid'
                  ? 'bg-emerald-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              ⊞ Grid
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              title="List View"
              className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                viewMode === 'list'
                  ? 'bg-emerald-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              ☰ List
            </button>
          </div>

          <button
            type="button"
            onClick={() => void events.refetch()}
            disabled={events.isFetching}
            className="min-h-[34px] rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:border-slate-500 disabled:opacity-50 transition"
          >
            {events.isFetching ? 'Refreshing…' : '🔄 Refresh'}
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-800/80 pb-2">
        <button
          type="button"
          onClick={() => setFilter('all')}
          className={`min-h-[32px] rounded-lg px-3 py-1 text-xs font-bold transition ${
            filter === 'all'
              ? 'bg-slate-800 text-slate-100 border border-slate-600 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          🌐 All ({list.length})
        </button>

        <button
          type="button"
          onClick={() => setFilter('buy')}
          className={`min-h-[32px] rounded-lg px-3 py-1 text-xs font-bold transition flex items-center gap-1.5 ${
            filter === 'buy'
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500 shadow-sm'
              : 'text-slate-400 hover:text-emerald-300 hover:bg-slate-900'
          }`}
        >
          <span>🟢</span> Buys ({buyCount})
        </button>

        <button
          type="button"
          onClick={() => setFilter('sell')}
          className={`min-h-[32px] rounded-lg px-3 py-1 text-xs font-bold transition flex items-center gap-1.5 ${
            filter === 'sell'
              ? 'bg-rose-500/20 text-rose-300 border border-rose-500 shadow-sm'
              : 'text-slate-400 hover:text-rose-300 hover:bg-slate-900'
          }`}
        >
          <span>🔴</span> Sells ({sellCount})
        </button>

        <button
          type="button"
          onClick={() => setFilter('whale')}
          className={`min-h-[32px] rounded-lg px-3 py-1 text-xs font-bold transition flex items-center gap-1.5 ${
            filter === 'whale'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500 shadow-sm'
              : 'text-slate-400 hover:text-amber-300 hover:bg-slate-900'
          }`}
        >
          <span>🐋</span> Whales ({whaleCount})
        </button>
      </div>

      {/* Loading state */}
      {events.isPending ? (
        <div className="py-8 text-center text-sm text-slate-400">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
          <p className="mt-2">Reading on-chain activity from Stellar network…</p>
        </div>
      ) : null}

      {/* Error state */}
      {events.isError ? (
        <div className="rounded-xl border border-rose-900 bg-rose-950/40 p-4 text-xs text-rose-300">
          Error reading events from Soroban: {events.error.message}
        </div>
      ) : null}

      {/* Empty state */}
      {events.isSuccess && list.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/30 p-8 text-center space-y-2">
          <span className="text-3xl">🌱</span>
          <p className="text-sm font-bold text-slate-200">Be the first trader in history!</p>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            No trades recorded in this ledger window yet. Execute a swap to place the first block on the board.
          </p>
        </div>
      ) : null}

      {/* Interactive Selected Event Drawer */}
      {selectedEvent ? (
        <div className="rounded-xl border border-emerald-500/60 bg-slate-950 p-4 shadow-lg shadow-emerald-500/10 space-y-3 transition-all animate-fadeIn">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
              <span>🔍</span> Selected Event Details
            </span>
            <button
              type="button"
              onClick={() => setSelectedEvent(null)}
              className="text-xs text-slate-400 hover:text-white px-2 py-0.5 rounded border border-slate-800 hover:bg-slate-800"
            >
              ✕ Close
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-slate-500">Amount:</span>
              <p className="font-mono text-sm font-bold text-emerald-300 mt-0.5">
                {formatAmount(selectedEvent.amount, activeDecimals)} ${activeSymbol}
              </p>
            </div>

            <div>
              <span className="text-slate-500">Timestamp:</span>
              <p className="font-mono text-slate-300 mt-0.5">
                {new Date(selectedEvent.at).toLocaleString()}
              </p>
            </div>

            <div>
              <span className="text-slate-500">From (Sender):</span>
              <p className="font-mono text-slate-300 break-all mt-0.5">
                {selectedEvent.from ? (
                  <a
                    href={explorerAccountUrl(selectedEvent.from)}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:underline text-cyan-300"
                  >
                    {selectedEvent.from}
                  </a>
                ) : (
                  'Genesis / Mint'
                )}
              </p>
            </div>

            <div>
              <span className="text-slate-500">To (Recipient):</span>
              <p className="font-mono text-slate-300 break-all mt-0.5">
                {selectedEvent.to ? (
                  <a
                    href={explorerAccountUrl(selectedEvent.to)}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:underline text-cyan-300"
                  >
                    {selectedEvent.to}
                  </a>
                ) : (
                  'Burn'
                )}
              </p>
            </div>
          </div>

          {selectedEvent.txHash ? (
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80 text-xs">
              <span className="font-mono text-slate-400">
                Tx: {shortAddress(selectedEvent.txHash)}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void copy(selectedEvent.txHash ?? '')}
                  className="rounded border border-slate-700 bg-slate-900 px-2.5 py-1 text-slate-300 hover:border-slate-500"
                >
                  {lastCopied === selectedEvent.txHash ? '✓ Copied' : 'Copy Hash'}
                </button>
                <a
                  href={explorerTxUrl(selectedEvent.txHash)}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded border border-emerald-700 bg-emerald-950/40 px-2.5 py-1 font-bold text-emerald-300 hover:border-emerald-500"
                >
                  Stellar Explorer ↗
                </a>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* View Mode: Interactive Grid in Cuadros */}
      {viewMode === 'grid' && filtered.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {filtered.map(({ event, role, isWhale }) => {
            const badge = ROLE_BADGES[role]
            const trader = role === 'buy' ? event.to : event.from
            const isSelected = selectedEvent?.id === event.id

            return (
              <div
                key={event.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedEvent(event)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    setSelectedEvent(event)
                  }
                }}
                className={`group relative rounded-xl border p-3.5 transition-all text-left cursor-pointer hover:-translate-y-0.5 hover:shadow-lg ${
                  isSelected
                    ? 'border-emerald-400 bg-slate-950 ring-2 ring-emerald-500/30'
                    : role === 'buy'
                      ? 'border-emerald-900/60 bg-emerald-950/15 hover:border-emerald-500/60 hover:bg-emerald-950/30 hover:shadow-emerald-500/5'
                      : role === 'sell'
                        ? 'border-rose-900/60 bg-rose-950/15 hover:border-rose-500/60 hover:bg-rose-950/30 hover:shadow-rose-500/5'
                        : 'border-slate-800 bg-slate-950/50 hover:border-slate-600'
                }`}
              >
                {/* Cuadro Header */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-black tracking-wide ${badge.border} ${badge.bg} ${badge.text}`}
                    >
                      <span>{badge.icon}</span>
                      <span>{badge.label}</span>
                    </span>
                    {isWhale ? (
                      <span className="rounded-full border border-amber-500/50 bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-300 animate-pulse">
                        🐋 Whale
                      </span>
                    ) : null}
                  </div>

                  <span className="text-[11px] font-mono text-slate-400">
                    {timeAgo(event.at)}
                  </span>
                </div>

                {/* Card Amount */}
                <div className="mt-2.5">
                  <span className="text-[11px] text-slate-500">Traded Amount</span>
                  <div className="flex items-baseline gap-1 font-mono">
                    <span
                      className={`text-base sm:text-lg font-black tracking-tight ${
                        role === 'buy'
                          ? 'text-emerald-400'
                          : role === 'sell'
                            ? 'text-rose-400'
                            : 'text-slate-100'
                      }`}
                    >
                      {role === 'buy' ? '+' : role === 'sell' ? '-' : ''}
                      {formatAmount(event.amount, activeDecimals)}
                    </span>
                    <span className="text-xs font-bold text-slate-400">
                      ${activeSymbol}
                    </span>
                  </div>
                </div>

                {/* Cuadro Trader Footer */}
                <div className="mt-3 flex items-center justify-between border-t border-slate-800/60 pt-2.5 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className={`h-5 w-5 shrink-0 rounded-full bg-gradient-to-tr ${addressAvatarColor(
                        trader,
                      )}`}
                    />
                    <span className="font-mono text-[11px] text-slate-300 truncate">
                      {trader ? shortAddress(trader) : 'Soroswap Pool'}
                    </span>
                  </div>

                  {event.txHash ? (
                    <a
                      href={explorerTxUrl(event.txHash)}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-[11px] text-slate-400 hover:text-emerald-300 underline underline-offset-2 flex items-center gap-0.5"
                    >
                      tx ↗
                    </a>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      ) : null}

      {/* View Mode: Compact List */}
      {viewMode === 'list' && filtered.length > 0 ? (
        <ul className="divide-y divide-slate-800">
          {filtered.map(({ event, role }) => {
            const badge = ROLE_BADGES[role]
            return (
              <li
                key={event.id}
                role="button"
                tabIndex={0}
                aria-pressed={selectedEvent?.id === event.id}
                onClick={() => setSelectedEvent(event)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    setSelectedEvent(event)
                  }
                }}
                className="flex flex-col gap-2 py-2.5 sm:flex-row sm:items-center sm:justify-between cursor-pointer hover:bg-slate-900/50 px-2 rounded-lg transition"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${badge.border} ${badge.bg} ${badge.text}`}
                  >
                    {badge.label}
                  </span>
                  <span className="font-mono text-xs font-bold text-slate-100">
                    {formatAmount(event.amount, activeDecimals)} ${activeSymbol}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {tokenEventSummary(event, pairId)}
                  </span>
                </div>

                <div className="flex items-center gap-3 font-mono text-[11px] text-slate-500">
                  <span>{timeAgo(event.at)}</span>
                  {event.txHash ? (
                    <a
                      href={explorerTxUrl(event.txHash)}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-slate-400 hover:text-emerald-300 underline"
                    >
                      tx ↗
                    </a>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ul>
      ) : null}

      <p className="mt-2 text-center text-[11px] text-slate-500">
        Soroban RPC retention window (~14h). Activity blocks sync automatically with each Stellar ledger.
      </p>
    </section>
  )
}
