import { Link } from 'react-router'
import { graduationProgress } from '../lib/tokenomics'
import { formatAmount } from '../lib/format'
import { tokenPriceInXlm } from '../lib/soroswap'
import { useXlmUsdPrice } from '../hooks/useXlmUsdPrice'
import { useTokenMetadata } from '../hooks/useTokenMetadata'
import { TokenArt } from './TokenArt'
import type { TokenListing } from '../lib/discovery'
import type { LaunchpadToken } from '../lib/token'

function GraduatingItem({
  token,
  onSelect,
}: {
  token: TokenListing
  onSelect?: (token: LaunchpadToken) => void
}) {
  const { data: xlmUsd = 0.1555 } = useXlmUsdPrice()
  const grad = graduationProgress(token.pool.reserveXlm)
  const priceStroops = tokenPriceInXlm(token.pool, token.decimals)
  const priceUsd =
    priceStroops > 0n ? (Number(priceStroops) / 1e7) * xlmUsd : 0
  const meta = useTokenMetadata(token.id)

  const remainingXlm = Math.max(0, grad.targetXlm - grad.currentXlm)

  return (
    <div className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-b from-slate-900/80 to-slate-950 p-4 transition-all hover:border-amber-500/50 hover:shadow-lg hover:shadow-amber-500/5 min-w-0 max-w-full">
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-slate-700 bg-slate-800 shadow-md">
              <TokenArt
                id={token.id}
                symbol={token.symbol}
                logoUrl={meta.data?.logoUrl}
                className="h-full w-full"
              />
              {grad.percent >= 75 ? (
                <span
                  aria-hidden="true"
                  className="absolute -right-1 -top-1 rounded-bl-md bg-amber-400 px-1 text-[10px] font-bold text-slate-950"
                >
                  🔥
                </span>
              ) : null}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <Link
                  to={`/token/${token.id}`}
                  className="truncate text-base font-bold text-slate-100 hover:text-amber-300"
                >
                  ${token.symbol}
                </Link>
                {grad.graduated ? (
                  <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                    🎓 Graduated
                  </span>
                ) : (
                  <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                    {grad.percent.toFixed(0)}%
                  </span>
                )}
              </div>
              <p className="truncate text-xs text-slate-400">{token.name}</p>
            </div>
          </div>

          <div className="text-right font-mono">
            <span className="text-sm font-semibold text-emerald-400">
              {formatAmount(token.pool.reserveXlm, 7)} XLM
            </span>
            <p className="text-[11px] text-slate-500">
              ${priceUsd < 0.01 ? priceUsd.toFixed(6) : priceUsd.toFixed(4)}
            </p>
          </div>
        </div>

        <div className="mt-3">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1">
              <span>Soroswap DEX Target</span>
              {grad.graduated ? (
                <span className="text-emerald-400 font-semibold">✓ Complete</span>
              ) : (
                <span className="text-slate-500 font-mono">
                  ({remainingXlm.toFixed(1)} XLM left)
                </span>
              )}
            </span>
            <span className="font-mono font-bold text-amber-300">
              {grad.percent.toFixed(1)}%
            </span>
          </div>

          <div
            role="progressbar"
            aria-valuenow={Math.round(grad.percent)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${token.symbol} graduation progress`}
            className="mt-1.5 h-2 w-full overflow-hidden rounded-full border border-slate-800 bg-slate-950"
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-500 via-emerald-400 to-teal-300 transition-all duration-500"
              style={{ width: `${Math.min(100, Math.max(5, grad.percent))}%` }}
            />
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2 pt-2 border-t border-slate-800/80">
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
            className="flex-1 rounded-lg bg-emerald-500 px-3 py-2 text-center text-xs font-bold text-slate-950 shadow-sm transition hover:bg-emerald-400"
          >
            ⚡ Quick Buy
          </a>
        ) : null}
        <Link
          to={`/token/${token.id}`}
          className="flex-1 rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-center text-xs font-semibold text-slate-300 transition hover:border-slate-500 hover:text-white"
        >
          🔍 View Curve →
        </Link>
      </div>
    </div>
  )
}

export function GraduationRadar({
  tokens,
  onSelect,
}: {
  tokens: TokenListing[]
  onSelect?: (token: LaunchpadToken) => void
}) {
  if (!tokens || tokens.length === 0) return null

  // Filter tokens that have pool and sort by graduation progress (highest first)
  const graduatingTokens = [...tokens]
    .filter((t) => t.pool && t.pool.exists && t.pool.reserveXlm > 0n)
    .sort((a, b) =>
      b.pool.reserveXlm > a.pool.reserveXlm
        ? 1
        : b.pool.reserveXlm < a.pool.reserveXlm
          ? -1
          : 0,
    )
    .slice(0, 3)

  if (graduatingTokens.length === 0) return null

  return (
    <section className="space-y-3 w-full max-w-full overflow-hidden">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-400/20 text-xs">
              🎓
            </span>
            <h2 className="text-xl font-bold tracking-tight text-slate-100">
              Graduating Soon · Moonshot Radar
            </h2>
            <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-amber-300">
              High FOMO 🔥
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Tokens with maximum curve momentum racing towards 2,000 XLM DEX graduation. Buy before liquidity ascends!
          </p>
        </div>

        <Link
          to="/market"
          className="text-xs font-medium text-emerald-400 underline underline-offset-2 hover:text-emerald-300"
        >
          All Graduating Tokens →
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 min-w-0 max-w-full">
        {graduatingTokens.map((token) => (
          <GraduatingItem
            key={token.id}
            token={token}
            onSelect={onSelect}
          />
        ))}
      </div>
    </section>
  )
}
