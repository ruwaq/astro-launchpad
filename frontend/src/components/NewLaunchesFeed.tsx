import { Link } from 'react-router'
import { formatAmount } from '../lib/format'
import { tokenPriceInXlm } from '../lib/soroswap'
import { useTokenMetadata } from '../hooks/useTokenMetadata'
import { TokenArt } from './TokenArt'
import type { TokenListing } from '../lib/discovery'
import type { LaunchpadToken } from '../lib/token'

function LaunchItem({
  token,
  onSelect,
}: {
  token: TokenListing
  onSelect?: (token: LaunchpadToken) => void
}) {
  const meta = useTokenMetadata(token.id)
  const priceStroops = tokenPriceInXlm(token.pool, token.decimals)

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-800/80 bg-slate-900/50 p-3 transition hover:border-slate-700 hover:bg-slate-900/80 min-w-0 max-w-full overflow-hidden">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-xl border border-slate-800 bg-slate-800">
          <TokenArt
            id={token.id}
            symbol={token.symbol}
            logoUrl={meta.data?.logoUrl}
            className="h-full w-full"
          />
          <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-slate-900 bg-emerald-400" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <Link
              to={`/token/${token.id}`}
              className="truncate font-bold text-slate-100 hover:text-emerald-300 text-sm"
            >
              ${token.symbol}
            </Link>
            <span className="shrink-0 rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400">
              New
            </span>
          </div>
          <p className="truncate text-xs text-slate-500">{token.name}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <div className="text-right font-mono text-xs">
          <div className="text-slate-200">
            {priceStroops > 0n ? `${formatAmount(priceStroops, 7)} XLM` : 'Fair Launch'}
          </div>
          <div className="text-[10px] text-emerald-400">
            🔥 LP Burned
          </div>
        </div>

        {onSelect ? (
          <a
            href="#sec-swap"
            onClick={() =>
              onSelect({
                id: token.id,
                decimals: token.decimals,
                symbol: token.symbol,
              })
            }
            className="rounded-lg bg-emerald-500/20 px-2.5 py-1.5 text-xs font-bold text-emerald-300 transition hover:bg-emerald-500/30"
          >
            Buy
          </a>
        ) : (
          <Link
            to={`/token/${token.id}`}
            className="rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:border-slate-500"
          >
            Trade
          </Link>
        )}
      </div>
    </div>
  )
}

export function NewLaunchesFeed({
  tokens,
  isLoading,
  onSelect,
}: {
  tokens: TokenListing[]
  isLoading?: boolean
  onSelect?: (token: LaunchpadToken) => void
}) {
  if (isLoading) {
    return (
      <section className="space-y-3 w-full max-w-full overflow-hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-400/20 text-xs">
              ⚡
            </span>
            <h2 className="text-lg font-bold text-slate-100">
              Fresh Token Launches
            </h2>
          </div>
        </div>
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between gap-3 rounded-xl border border-slate-800/80 bg-slate-900/50 p-3 animate-pulse">
              <div className="flex items-center gap-2.5">
                <div className="h-10 w-10 rounded-xl bg-slate-800" />
                <div className="space-y-1.5">
                  <div className="h-3.5 w-20 rounded bg-slate-800" />
                  <div className="h-2.5 w-28 rounded bg-slate-800/60" />
                </div>
              </div>
              <div className="h-6 w-16 rounded bg-slate-800" />
            </div>
          ))}
        </div>
      </section>
    )
  }

  if (!tokens || tokens.length === 0) {
    return (
      <section className="space-y-3 w-full max-w-full overflow-hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-400/20 text-xs">
              ⚡
            </span>
            <h2 className="text-lg font-bold text-slate-100">
              Fresh Token Launches
            </h2>
          </div>
          <Link
            to="/create"
            className="text-xs font-semibold text-emerald-400 hover:text-emerald-300"
          >
            + Launch Token
          </Link>
        </div>
        <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/40 p-6 text-center space-y-2">
          <p className="text-sm font-semibold text-slate-300">No new launches discovered in recent ledgers</p>
          <p className="text-xs text-slate-500">
            Be the first to launch a fair memecoin with Soroswap AMM liquidity.
          </p>
        </div>
      </section>
    )
  }

  // Sort by ledger descending (newest first)
  const newTokens = [...tokens]
    .sort((a, b) => b.ledger - a.ledger)
    .slice(0, 4)

  return (
    <section className="space-y-3 w-full max-w-full overflow-hidden">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-400/20 text-xs">
            ⚡
          </span>
          <h2 className="text-lg font-bold text-slate-100">
            Fresh Token Launches
          </h2>
        </div>
        <Link
          to="/create"
          className="text-xs font-semibold text-emerald-400 hover:text-emerald-300"
        >
          + Launch Token
        </Link>
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2 min-w-0 max-w-full">
        {newTokens.map((token) => (
          <LaunchItem key={token.id} token={token} onSelect={onSelect} />
        ))}
      </div>
    </section>
  )
}
