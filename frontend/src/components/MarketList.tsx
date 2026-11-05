import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useTokenList } from '../hooks/useTokenList'
import { formatAmount, shortAddress } from '../lib/format'
import { isValidContractAddress } from '../lib/address'
import { explorerContractUrl } from '../lib/explorer'
import { graduationProgress } from '../lib/tokenomics'
import { tokenPriceInXlm } from '../lib/soroswap'
import { useXlmUsdPrice } from '../hooks/useXlmUsdPrice'
import {
  filterAndSortTokens,
  MARKET_SORT_OPTIONS,
  type MarketSortKey,
} from '../lib/market'
import { TokenArt } from './TokenArt'
import { KingOfTheHill } from './KingOfTheHill'
import type { LaunchpadToken } from '../lib/token'
import type { TokenListing } from '../lib/discovery'

type Props = {
  /** Token currently selected for swap. */
  selectedId: string | null
  onSelect: (token: LaunchpadToken) => void
  /** In homepage show only a subset. */
  limit?: number
  showFilters?: boolean
}

function Price({ token }: { token: TokenListing }) {
  const { data: xlmUsd = 0.1555 } = useXlmUsdPrice()
  const price = tokenPriceInXlm(token.pool, token.decimals)
  if (price === 0n) return <span className="text-slate-500">—</span>
  const priceUsd = (Number(price) / 1e7) * xlmUsd
  return (
    <div className="flex flex-col items-end">
      <span className="font-mono text-sm text-emerald-400">
        {formatAmount(price, 7)} XLM
      </span>
      <span className="font-mono text-[10px] text-slate-400">
        ≈ ${priceUsd < 0.01 ? priceUsd.toFixed(6) : priceUsd.toFixed(4)}
      </span>
    </div>
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
  const grad = graduationProgress(token.pool.reserveXlm)

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
          href={explorerContractUrl(token.pool.pairId ?? token.id)}
          target="_blank"
          rel="noreferrer"
          aria-label={`View ${token.symbol} in explorer`}
          className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-slate-950/70 text-slate-300 backdrop-blur hover:text-emerald-300"
        >
          ↗
        </a>
        {selected ? (
          <span className="absolute left-2 top-2 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-semibold text-slate-950">
            in swap
          </span>
        ) : grad.graduated ? (
          <span className="absolute left-2 top-2 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-semibold text-slate-950">
            🎓 graduated
          </span>
        ) : grad.percent >= 50 ? (
          <span className="absolute left-2 top-2 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold text-slate-950">
            🔥 King
          </span>
        ) : (
          <span className="absolute left-2 top-2 rounded-full border border-slate-700 bg-slate-950/80 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
            ⚡ curve
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-3">
        <button
          type="button"
          onClick={() =>
            onSelect({
              id: token.id,
              decimals: token.decimals,
              symbol: token.symbol,
            })
          }
          className="min-h-[44px] text-left"
        >
          <p className="truncate text-sm font-semibold text-slate-100">
            {token.symbol}
          </p>
          <p className="truncate text-xs text-slate-500">{token.name}</p>
        </button>
        <div className="mt-auto pt-2">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[11px] text-slate-500">Price</span>
            <Price token={token} />
          </div>
          <p className="mt-1 flex items-baseline justify-between gap-2">
            <span className="text-[11px] text-slate-500">Liquidity</span>
            <span className="font-mono text-xs text-slate-300">
              {formatAmount(token.pool.reserveXlm, 7)} XLM
            </span>
          </p>
          <div className="mt-2">
            <div className="flex items-center justify-between text-[10px] text-slate-400">
              <span>DEX Curve</span>
              <span className="font-mono text-emerald-300">
                {grad.percent.toFixed(0)}%
              </span>
            </div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-950">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-300"
                style={{ width: `${Math.min(100, Math.max(4, grad.percent))}%` }}
              />
            </div>
          </div>

          <div className="mt-2.5 grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() =>
                onSelect({
                  id: token.id,
                  decimals: token.decimals,
                  symbol: token.symbol,
                })
              }
              className="rounded-lg bg-emerald-500/15 px-2 py-1.5 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-500/25"
            >
              ⚡ Swap
            </button>
            <Link
              to={`/token/${token.id}`}
              className="rounded-lg border border-slate-800 bg-slate-950/60 px-2 py-1.5 text-center text-[11px] font-medium text-slate-300 hover:border-slate-600"
            >
              📈 Curve
            </Link>
          </div>
        </div>
      </div>
    </li>
  )
}

export function MarketList({
  selectedId,
  onSelect,
  limit,
  showFilters = true,
}: Props) {
  const list = useTokenList()
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<MarketSortKey>('recent')

  const tokens = useMemo(
    () => filterAndSortTokens(list.data ?? [], query, sort, limit),
    [list.data, query, sort, limit],
  )
  const trimmedQuery = query.trim()
  const isDirectContract = isValidContractAddress(trimmedQuery)
  const exactMatchInList = tokens.some((t) => t.id === trimmedQuery)

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Live Market</h2>
          <p className="mt-1 text-sm text-slate-400">
            Token/XLM pairs discovered directly from Soroswap factory events.
            {showFilters
              ? ' Search, sort, and select any token to trade.'
              : ' Tap any card to swap below ⤵'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void list.refetch()}
          disabled={list.isFetching}
          className="min-h-[44px] rounded-lg border border-slate-800 px-3 py-2 text-xs text-slate-300 hover:border-slate-600 disabled:opacity-50"
        >
          {list.isFetching ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {list.data && list.data.length > 0 ? (
        <div className="mt-4">
          <KingOfTheHill tokens={list.data} onSelect={onSelect} />
        </div>
      ) : null}

      {showFilters ? (
        <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
          <label className="block text-sm">
            <span className="sr-only">Search tokens</span>
            <span className="relative block">
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by name, symbol, or contract address…"
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3.5 py-3 pr-10 text-base text-slate-100 outline-none focus:border-emerald-500"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  aria-label="Clear search"
                  className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-lg text-slate-500 hover:bg-slate-800 hover:text-slate-200"
                >
                  ×
                </button>
              ) : null}
            </span>
          </label>

          <label className="flex items-center gap-2 text-xs text-slate-400">
            <span>Sort by</span>
            <select
              value={sort}
              onChange={(event) =>
                setSort(event.target.value as MarketSortKey)
              }
              className="min-h-[44px] rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none focus:border-emerald-500"
            >
              {MARKET_SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}

      {list.data ? (
        <p aria-live="polite" className="mt-2 text-xs text-slate-500">
          {tokens.length} of {list.data.length} pairs
          {query ? ` for “${query.trim()}”` : ''}
        </p>
      ) : null}

      {list.isPending ? (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-slate-400">
            Discovering pairs on-chain…
          </p>
          <ul
            aria-hidden="true"
            className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
          >
            {Array.from({ length: limit ?? 4 }).map((_, idx) => (
              <li
                key={idx}
                className="flex flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/40"
              >
                <div className="aspect-square w-full animate-pulse bg-slate-800/60" />
                <div className="space-y-2 p-3">
                  <div className="h-4 w-16 animate-pulse rounded bg-slate-800" />
                  <div className="h-3 w-24 animate-pulse rounded bg-slate-800/70" />
                  <div className="pt-2">
                    <div className="h-3 w-full animate-pulse rounded bg-slate-800/50" />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {isDirectContract && !exactMatchInList ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-800/80 bg-emerald-950/20 px-4 py-3 text-sm">
          <div className="min-w-0">
            <p className="font-medium text-emerald-200">
              Soroban Contract Detected ({shortAddress(trimmedQuery)})
            </p>
            <p className="truncate font-mono text-xs text-slate-400">
              {trimmedQuery}
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              onSelect({
                id: trimmedQuery,
                decimals: 7,
                symbol: shortAddress(trimmedQuery),
              })
            }
            className="min-h-[40px] shrink-0 rounded-lg bg-emerald-500 px-4 py-2 text-xs font-medium text-slate-950 hover:bg-emerald-400"
          >
            Open token directly →
          </button>
        </div>
      ) : null}

      {list.isError ? (
        <div className="mt-4 rounded-lg border border-rose-900 bg-rose-950/40 px-3 py-2 text-sm text-rose-300">
          Unable to read market: {list.error.message}
        </div>
      ) : null}

      {list.data && list.data.length === 0 ? (
        <p className="mt-4 text-sm text-slate-400">
          No new pairs discovered in the recent ledger window. Launch a token to premiere the market.
        </p>
      ) : null}

      {list.data && list.data.length > 0 && tokens.length === 0 ? (
        <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-4 text-sm text-slate-400">
          No tokens match your search.
          <button
            type="button"
            onClick={() => setQuery('')}
            className="ml-2 text-emerald-400 underline underline-offset-2"
          >
            Clear
          </button>
        </div>
      ) : null}

      {tokens.length > 0 ? (
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {tokens.map((token) => (
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
        Discovered directly from Soroswap factory events in recent ledgers. Zero indexing lag; 100% on-chain data.
      </p>
    </section>
  )
}
