import { Link } from 'react-router'
import type { TokenListing } from '../lib/discovery'
import type { LaunchpadToken } from '../lib/token'
import { formatAmount } from '../lib/format'
import { tokenPriceInXlmNumber } from '../lib/soroswap'
import { graduationProgress } from '../lib/tokenomics'
import { useXlmUsdPrice } from '../hooks/useXlmUsdPrice'
import { TokenArt } from './TokenArt'

export function KingOfTheHill({
  tokens,
  onSelect,
}: {
  tokens: TokenListing[]
  onSelect?: (token: LaunchpadToken) => void
}) {
  const { data: xlmUsd = 0.1555 } = useXlmUsdPrice()

  if (!tokens || tokens.length === 0) return null

  // King of the Hill is the pair with highest accumulated XLM liquidity in the curve
  const king = [...tokens].sort((a, b) =>
    b.pool.reserveXlm > a.pool.reserveXlm
      ? 1
      : b.pool.reserveXlm < a.pool.reserveXlm
        ? -1
        : 0,
  )[0]

  if (!king || king.pool.reserveXlm <= 0n) return null

  const grad = graduationProgress(king.pool.reserveXlm)
  const priceXlm = tokenPriceInXlmNumber(king.pool, king.decimals)
  const reserveXlmNum = Number(king.pool.reserveXlm) / 1e7
  const liquidityUsd = reserveXlmNum * xlmUsd
  // Market cap estimated on standard 1B supply
  const marketCapXlm = priceXlm * 1_000_000_000
  const marketCapUsd = marketCapXlm * xlmUsd

  return (
    <div className="relative overflow-hidden rounded-2xl border border-amber-500/40 bg-gradient-to-br from-amber-950/30 via-slate-900/90 to-emerald-950/30 p-4 shadow-lg sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3.5">
          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl border-2 border-amber-400/70 shadow-md sm:h-20 sm:w-20">
            <TokenArt
              id={king.id}
              symbol={king.symbol}
              className="h-full w-full"
            />
            <span
              aria-hidden="true"
              className="absolute -right-1 -top-1 rounded-bl-lg bg-amber-400 px-1.5 py-0.5 text-xs font-bold text-slate-950"
            >
              👑
            </span>
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/20 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-amber-300">
                👑 King of the Hill
              </span>
              <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-300">
                {grad.label}
              </span>
            </div>

            <h3 className="mt-1 truncate text-lg font-extrabold text-slate-100 sm:text-xl">
              ${king.symbol}{' '}
              <span className="text-sm font-normal text-slate-400">
                · {king.name}
              </span>
            </h3>

            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-300">
              <span>
                Liquidity:{' '}
                <strong className="font-mono text-emerald-300">
                  {formatAmount(king.pool.reserveXlm, 7)} XLM
                </strong>{' '}
                <span className="text-slate-400">
                  (≈ ${liquidityUsd.toLocaleString('en-US', { maximumFractionDigits: 0 })} USD)
                </span>
              </span>
              {marketCapXlm > 0 ? (
                <span>
                  MCap:{' '}
                  <strong className="font-mono text-amber-300">
                    ${marketCapUsd.toLocaleString('en-US', { maximumFractionDigits: 0 })} USD
                  </strong>
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:min-w-[230px] sm:items-end">
          <div className="w-full">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Race to Soroswap DEX</span>
              <span className="font-mono font-bold text-amber-300">
                {grad.percent.toFixed(1)}%
              </span>
            </div>
            <div className="mt-1 h-2.5 w-full overflow-hidden rounded-full border border-amber-500/30 bg-slate-950">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-400 via-emerald-400 to-teal-300 transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(5, grad.percent))}%` }}
              />
            </div>
          </div>

          <div className="mt-1 flex flex-wrap gap-2">
            {onSelect ? (
              <a
                href="#sec-swap"
                onClick={() =>
                  onSelect({
                    id: king.id,
                    decimals: king.decimals,
                    symbol: king.symbol,
                  })
                }
                className="inline-flex min-h-[38px] items-center rounded-xl bg-amber-400 px-3.5 py-1.5 text-xs font-bold text-slate-950 hover:bg-amber-300"
              >
                ⚡ Ape In ${king.symbol}
              </a>
            ) : null}
            <Link
              to={`/token/${king.id}`}
              className="inline-flex min-h-[38px] items-center rounded-xl border border-emerald-500/50 bg-emerald-500/15 px-3.5 py-1.5 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/25"
            >
              📈 Chart & Info →
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
