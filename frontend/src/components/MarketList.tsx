import { useCallback, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { useTokenList } from '../hooks/useTokenList'
import { formatAmount, shortAddress } from '../lib/format'
import { isValidContractAddress } from '../lib/address'
import { graduationProgress } from '../lib/tokenomics'
import { DEFAULT_XLM_USD_PRICE } from '../lib/xlm'
import { formatTokenPrice, formatUsdPrice, tokenPriceInXlmNumber } from '../lib/soroswap'
import { useXlmUsdPrice } from '../hooks/useXlmUsdPrice'
import { useWatchlist } from '../store/watchlist'
import {
  filterAndSortTokens,
  MARKET_SORT_OPTIONS,
  type MarketSortKey,
} from '../lib/market'
import { TokenArt } from './TokenArt'
import { KingOfTheHill } from './KingOfTheHill'
import { useTokenMetadata } from '../hooks/useTokenMetadata'
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
  const { data: xlmUsd = DEFAULT_XLM_USD_PRICE } = useXlmUsdPrice()
  // Número en coma flotante: los fair launch cotizan por debajo de 1 stroop
  // (995M tokens contra < 99.5 XLM) y la versión bigint truncaría a 0.
  const price = tokenPriceInXlmNumber(token.pool, token.decimals)
  if (price <= 0) return <span className="text-slate-500">—</span>
  const priceUsd = price * xlmUsd
  return (
    <div className="flex flex-col items-end">
      <span className="font-mono text-sm text-emerald-400">
        {formatTokenPrice(price)} XLM
      </span>
      <span className="font-mono text-[10px] text-slate-400">
        ≈ ${formatUsdPrice(priceUsd)}
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
  const isFav = useWatchlist((s) => s.favorites.includes(token.id))
  const toggleFav = useWatchlist((s) => s.toggle)
  const meta = useTokenMetadata(token.id)

  const isGraduated = grad.graduated
  const ageLabel = token.ledger > 0 ? `#${token.ledger}` : null

  return (
    <li
      tabIndex={0}
      role="button"
      aria-label={`Select ${token.name} (${token.symbol})`}
      onClick={() =>
        onSelect({
          id: token.id,
          decimals: token.decimals,
          symbol: token.symbol,
        })
      }
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect({
            id: token.id,
            decimals: token.decimals,
            symbol: token.symbol,
          })
        }
      }}
      className={`liquid-glass-card group relative flex cursor-pointer flex-col overflow-hidden rounded-3xl ${
        selected ? 'ring-2 ring-sky-400 border-sky-400/50' : ''
      }`}
    >
      {/* Token Emblem Showcase Frame */}
      <div className="relative aspect-square w-full overflow-hidden bg-slate-950">
        <TokenArt
          id={token.id}
          symbol={token.symbol}
          logoUrl={meta.data?.logoUrl}
          className="h-full w-full transition-transform duration-500 ease-out group-hover:scale-105"
        />

        {/* Holographic Sheen */}
        <div className="holo-sheen absolute inset-0" />

        {/* Subtle Bottom Vignette for Floating Glass Controls */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-slate-950/90 via-slate-950/35 to-transparent" />

        {/* Top-Left: Ticker & Launchpad Verified Badge */}
        <div className="absolute top-3 left-3 flex flex-wrap items-center gap-1.5">
          <span className="liquid-glass-pill rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wider text-sky-300 font-mono">
            ${token.symbol}
          </span>
          {token.verifiedLaunchpad ? (
            <span className="liquid-glass-pill rounded-full border-emerald-400/50 bg-emerald-950/75 px-2 py-1 text-[10px] font-semibold text-emerald-300">
              ✓ Fair
            </span>
          ) : ageLabel ? (
            <span className="liquid-glass-pill rounded-full px-2 py-1 font-mono text-[10px] text-slate-300">
              {ageLabel}
            </span>
          ) : null}
        </div>

        {/* Top-Right: Collector Favorite Toggle */}
        <div className="absolute top-3 right-3">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              toggleFav(token.id)
            }}
            aria-label={
              isFav ? `Remove ${token.symbol} from favorites` : `Add ${token.symbol} to favorites`
            }
            aria-pressed={isFav}
            className={`liquid-glass-pill flex h-8 w-8 items-center justify-center rounded-full transition-transform hover:scale-110 ${
              isFav ? 'border-amber-400/50 text-amber-300' : 'text-white/80 hover:text-white'
            }`}
          >
            {isFav ? '★' : '☆'}
          </button>
        </div>

        {/* Bottom-Left of Art Frame: Graduation Status Pill */}
        <div className="absolute bottom-3 left-3 flex items-center gap-1.5">
          {selected ? (
            <span className="liquid-glass-pill rounded-full border-sky-400/50 bg-sky-950/80 px-2.5 py-1 text-[10px] font-bold tracking-wider text-sky-300 uppercase">
              ✦ in swap
            </span>
          ) : isGraduated ? (
            <span className="liquid-glass-pill rounded-full border-emerald-400/40 bg-emerald-950/60 px-2.5 py-1 text-[10px] font-bold tracking-wider text-emerald-300 uppercase">
              ✦ Graduated
            </span>
          ) : grad.percent >= 50 ? (
            <span className="liquid-glass-pill rounded-full border-amber-400/40 bg-amber-950/60 px-2.5 py-1 text-[10px] font-bold tracking-wider text-amber-300 uppercase">
              👑 King ({grad.percent.toFixed(0)}%)
            </span>
          ) : (
            <span className="liquid-glass-pill rounded-full px-2.5 py-1 text-[10px] font-medium text-sky-300">
              Curve {grad.percent.toFixed(0)}%
            </span>
          )}
        </div>
      </div>

      {/* Token Details & Price Pedestal */}
      <div className="flex flex-1 flex-col justify-between gap-3 p-4">
        <div>
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-[11px] text-slate-400">
              {shortAddress(token.id)}
            </span>
          </div>
          <div className="mt-0.5 flex items-baseline justify-between gap-2">
            <h3 className="truncate text-base font-bold text-white group-hover:text-sky-300">
              {token.name}
            </h3>
            <span className="shrink-0 rounded-md bg-white/[0.06] px-1.5 py-0.5 font-mono text-xs font-semibold text-slate-200">
              ${token.symbol}
            </span>
          </div>
          {meta.data?.description ? (
            <p className="mt-1 line-clamp-1 text-xs text-slate-400">
              {meta.data.description}
            </p>
          ) : null}
        </div>

        {/* Spot Price & Pool Reserve Split */}
        <div className="grid grid-cols-2 gap-2 rounded-2xl border border-white/[0.07] bg-slate-950/45 p-2.5">
          <div>
            <p className="text-[10px] font-medium tracking-wider text-slate-400 uppercase">
              Spot Price
            </p>
            <div className="mt-0.5">
              <Price token={token} />
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-medium tracking-wider text-slate-400 uppercase">
              Pool Depth
            </p>
            <p className="mt-0.5 font-mono text-xs font-semibold text-emerald-300">
              {token.pool.reserveXlm === 0n ? 'Empty' : `${formatAmount(token.pool.reserveXlm, 7)} XLM`}
            </p>
          </div>
        </div>

        {/* Graduation Progress Hairline Bar */}
        <div className="space-y-1">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-900/90">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isGraduated
                  ? 'bg-gradient-to-r from-emerald-400 to-teal-300'
                  : 'bg-gradient-to-r from-sky-500 via-indigo-400 to-emerald-400'
              }`}
              style={{ width: `${Math.max(3, Math.min(100, grad.percent))}%` }}
            />
          </div>
        </div>

        {/* Open Terminal Indicator */}
        <div className="liquid-glass-pill flex items-center justify-center gap-1.5 rounded-xl py-2 text-center text-xs font-semibold text-slate-200 group-hover:text-sky-300 transition">
          <span>Trade & Chart</span>
          <span aria-hidden="true">→</span>
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
  const [searchParams, setSearchParams] = useSearchParams()

  const [localQuery, setLocalQuery] = useState('')
  const [localSort, setLocalSort] = useState<MarketSortKey>('recent')
  const [localFavsOnly, setLocalFavsOnly] = useState(false)
  const [localVerifiedOnly, setLocalVerifiedOnly] = useState(false)

  const query = showFilters ? (searchParams.get('q') ?? localQuery) : ''
  const sort = showFilters ? ((searchParams.get('sort') as MarketSortKey) || localSort) : 'recent'
  const favsOnly = showFilters ? (searchParams.has('favs') ? searchParams.get('favs') === '1' : localFavsOnly) : false
  const verifiedOnly = showFilters ? (searchParams.has('fair') ? searchParams.get('fair') === '1' : localVerifiedOnly) : false

  const setQuery = useCallback(
    (newQ: string) => {
      setLocalQuery(newQ)
      if (showFilters) {
        setSearchParams(
          (prev) => {
            const next = new URLSearchParams(prev)
            if (newQ.trim()) next.set('q', newQ)
            else next.delete('q')
            return next
          },
          { replace: true },
        )
      }
    },
    [showFilters, setSearchParams],
  )

  const setSort = useCallback(
    (newSort: MarketSortKey) => {
      setLocalSort(newSort)
      if (showFilters) {
        setSearchParams(
          (prev) => {
            const next = new URLSearchParams(prev)
            if (newSort !== 'recent') next.set('sort', newSort)
            else next.delete('sort')
            return next
          },
          { replace: true },
        )
      }
    },
    [showFilters, setSearchParams],
  )

  const setFavsOnly = useCallback(
    (newFavs: boolean) => {
      setLocalFavsOnly(newFavs)
      if (showFilters) {
        setSearchParams(
          (prev) => {
            const next = new URLSearchParams(prev)
            if (newFavs) next.set('favs', '1')
            else next.delete('favs')
            return next
          },
          { replace: true },
        )
      }
    },
    [showFilters, setSearchParams],
  )

  const setVerifiedOnly = useCallback(
    (next: boolean) => {
      setLocalVerifiedOnly(next)
      if (showFilters) {
        setSearchParams(
          (prev) => {
            const params = new URLSearchParams(prev)
            if (next) params.set('fair', '1')
            else params.delete('fair')
            return params
          },
          { replace: true },
        )
      }
    },
    [showFilters, setSearchParams],
  )

  const favorites = useWatchlist((s) => s.favorites)
  const isFavorite = useCallback((id: string) => favorites.includes(id), [favorites])

  const tokens = useMemo(() => {
    let result = filterAndSortTokens(list.data ?? [], query, sort)
    if (favsOnly) {
      result = result.filter((t) => isFavorite(t.id))
    }
    if (verifiedOnly) {
      result = result.filter((t) => Boolean(t.verifiedLaunchpad))
    }
    return typeof limit === 'number' ? result.slice(0, limit) : result
  }, [list.data, query, sort, limit, favsOnly, verifiedOnly, isFavorite])
  const trimmedQuery = query.trim()
  const isDirectContract = isValidContractAddress(trimmedQuery)
  const exactMatchInList = tokens.some((t) => t.id === trimmedQuery)

  return (
    <section className="liquid-glass rounded-3xl p-5 sm:p-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Live Market</h2>
          <p className="mt-1 text-sm text-slate-400">
            On-chain fair launches & Soroswap Token/XLM pairs.
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

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              aria-pressed={verifiedOnly}
              onClick={() => setVerifiedOnly(!verifiedOnly)}
              className={`min-h-[44px] rounded-lg border px-3 py-2 text-xs font-medium transition ${
                verifiedOnly
                  ? 'border-emerald-500/60 bg-emerald-950/40 text-emerald-300'
                  : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-slate-200'
              }`}
            >
              {verifiedOnly ? '✓ Fair Launches Only' : '✓ Fair Only'}
            </button>

            <button
              type="button"
              aria-pressed={favsOnly}
              onClick={() => setFavsOnly(!favsOnly)}
              className={`min-h-[44px] rounded-lg border px-3 py-2 text-xs font-medium transition ${
                favsOnly
                  ? 'border-amber-500/60 bg-amber-950/40 text-amber-300'
                  : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-slate-200'
              }`}
            >
              {favsOnly ? '★ Favorites Only' : '☆ All'}
            </button>

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

          <div className="flex flex-wrap items-center gap-1.5 sm:col-span-2">
            <button
              type="button"
              onClick={() => {
                setSort('graduation')
                setFavsOnly(false)
              }}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                sort === 'graduation' && !favsOnly
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              🎓 Graduating Soon
            </button>
            <button
              type="button"
              onClick={() => {
                setSort('recent')
                setFavsOnly(false)
              }}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                sort === 'recent' && !favsOnly
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              ⚡ New Launches
            </button>
            <button
              type="button"
              onClick={() => {
                setSort('liquidity')
                setFavsOnly(false)
              }}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                sort === 'liquidity' && !favsOnly
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                  : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              💧 Highest Liquidity
            </button>
          </div>
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
          No tokens match the current search or filters.
          {(query || favsOnly || verifiedOnly) ? (
            <button
              type="button"
              onClick={() => {
                setQuery('')
                setFavsOnly(false)
                setVerifiedOnly(false)
              }}
              className="ml-2 text-emerald-400 underline underline-offset-2"
            >
              Clear filters
            </button>
          ) : null}
        </div>
      ) : null}

      {tokens.length > 0 ? (
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
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
