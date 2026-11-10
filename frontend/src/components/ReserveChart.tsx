import { useEffect, useId, useMemo, useRef, useState } from 'react'
import {
  snapshotLiquidity,
  snapshotPrice,
  toChartPoints,
  type ReserveSnapshot,
} from '../lib/snapshots'
import { GRADUATION_TARGET_XLM, graduationProgress } from '../lib/tokenomics'
import {
  classifyTokenEvent,
  tokenEventSummary,
  type TokenEvent,
} from '../lib/token-events'
import { explorerTxUrl } from '../lib/explorer'
import { formatAmount, shortAddress } from '../lib/format'
import type { PoolState } from '../lib/soroswap'

const WIDTH = 400
const HEIGHT = 160
const PADDING = 16
const EMPTY_SNAPSHOTS: ReserveSnapshot[] = []
const EMPTY_EVENTS: TokenEvent[] = []

type Metric = 'price' | 'liquidity'

function formatMetric(value: number): string {
  if (!Number.isFinite(value)) return '—'
  const abs = Math.abs(value)
  const digits = abs > 0 && abs < 0.01 ? 8 : 4
  return value.toLocaleString('en-US', { maximumFractionDigits: digits })
}

function formatTime(t: number): string {
  return new Date(t).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function ReserveChart({
  snapshots,
  history,
  decimals,
  symbol,
  events = EMPTY_EVENTS,
  pool,
}: {
  snapshots?: ReserveSnapshot[]
  history?: ReserveSnapshot[]
  decimals: number
  symbol?: string
  events?: TokenEvent[]
  pool?: PoolState
}) {
  const activeSnapshots = snapshots ?? history ?? EMPTY_SNAPSHOTS
  const [metric, setMetric] = useState<Metric>('price')
  const [selectedPointIndex, setSelectedPointIndex] = useState<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [chartWidth, setChartWidth] = useState(WIDTH)
  const gradientId = useId().replace(/:/g, '')

  useEffect(() => {
    if (!containerRef.current) return
    const el = containerRef.current
    const updateWidth = () => {
      const rect = el.getBoundingClientRect()
      if (rect.width > 50) {
        setChartWidth(Math.round(rect.width))
      }
    }
    updateWidth()
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const w = Math.round(entry.contentRect.width)
          if (w > 50) setChartWidth(w)
        }
      })
      ro.observe(el)
      return () => ro.disconnect()
    }
  }, [])

  const pairId = pool?.pairId ?? null

  const trades = useMemo(() => {
    return (events ?? []).filter(
      (e) =>
        e.kind === 'transfer' &&
        pairId &&
        (e.from === pairId || e.to === pairId),
    )
  }, [events, pairId])

  const buyCount = useMemo(
    () =>
      trades.filter((e) => classifyTokenEvent(e, pairId) === 'buy').length,
    [trades, pairId],
  )
  const sellCount = useMemo(
    () =>
      trades.filter((e) => classifyTokenEvent(e, pairId) === 'sell').length,
    [trades, pairId],
  )

  const grad = graduationProgress(pool?.reserveXlm ?? 0n)

  const values = useMemo(
    () =>
      activeSnapshots
        .map((snapshot) =>
          metric === 'price'
            ? snapshotPrice(snapshot, decimals)
            : snapshotLiquidity(snapshot),
        )
        .map((value) => (Number.isFinite(value) ? value : 0)),
    [decimals, metric, activeSnapshots],
  )

  const series = useMemo(
    () => toChartPoints(values, chartWidth, HEIGHT, PADDING),
    [values, chartWidth],
  )

  const points = series.points
    .map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`)
    .join(' ')
  const area = points
    ? `${PADDING},${HEIGHT - PADDING} ${points} ${chartWidth - PADDING},${
        HEIGHT - PADDING
      }`
    : ''

  const first = values[0] ?? 0
  const latest = values[values.length - 1] ?? 0
  const delta = first > 0 ? ((latest - first) / first) * 100 : null
  const metricLabel =
    metric === 'price' ? `Price (XLM per ${symbol ?? 'token'})` : 'Liquidity (XLM)'

  // Target line for graduation in liquidity view
  const targetY = useMemo(() => {
    if (metric !== 'liquidity' || series.max <= 0) return null
    const effectiveMax = Math.max(series.max, GRADUATION_TARGET_XLM)
    const effectiveMin = Math.min(series.min, 0)
    const span = effectiveMax - effectiveMin
    if (span <= 0) return null
    const ratio = (GRADUATION_TARGET_XLM - effectiveMin) / span
    return HEIGHT - PADDING - ratio * (HEIGHT - PADDING * 2)
  }, [metric, series.max, series.min])

  const selectedPoint =
    selectedPointIndex !== null && series.points[selectedPointIndex]
      ? {
          point: series.points[selectedPointIndex],
          snapshot: activeSnapshots[selectedPointIndex],
          value: values[selectedPointIndex],
        }
      : null

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-3 sm:p-6 shadow-sm w-full max-w-full min-w-0 overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/20 text-sm">
              📈
            </span>
            <h2 className="text-xl font-bold text-slate-100">
              Pair History & Trading Curve
            </h2>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Real-time Soroban AMM trades for {symbol ?? 'token'}, upward price pressure (🟢 buys), sells (🔴), and progress towards the {GRADUATION_TARGET_XLM.toLocaleString()} XLM DEX graduation threshold.
          </p>
        </div>

        <div
          className="flex rounded-lg border border-slate-700 p-1 bg-slate-950/60"
          role="group"
          aria-label="Chart metric"
        >
          <button
            type="button"
            aria-pressed={metric === 'price'}
            onClick={() => {
              setMetric('price')
              setSelectedPointIndex(null)
            }}
            className={`min-h-[38px] rounded-md px-3 py-1 text-xs font-semibold transition ${
              metric === 'price'
                ? 'bg-emerald-500 text-slate-950 shadow'
                : 'text-slate-300 hover:text-slate-100'
            }`}
          >
            📈 Price Curve
          </button>
          <button
            type="button"
            aria-pressed={metric === 'liquidity'}
            onClick={() => {
              setMetric('liquidity')
              setSelectedPointIndex(null)
            }}
            className={`min-h-[38px] rounded-md px-3 py-1 text-xs font-semibold transition ${
              metric === 'liquidity'
                ? 'bg-emerald-500 text-slate-950 shadow'
                : 'text-slate-300 hover:text-slate-100'
            }`}
          >
            🌊 Liquidity & DEX Goal
          </button>
        </div>
      </div>

      {/* FOMO Trade Stats & Sentiment */}
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
          <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
            DEX Graduation
          </span>
          <div className="mt-1 flex items-baseline gap-1.5 font-mono">
            <span className="text-base font-bold text-amber-300">
              {grad.percent.toFixed(1)}%
            </span>
            <span className="text-[11px] text-slate-400">
              ({grad.currentXlm.toFixed(1)} / {grad.targetXlm} XLM)
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
          <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
            Curve Momentum
          </span>
          <div className="mt-1 flex items-baseline gap-1 font-mono">
            <span className="text-base font-bold text-emerald-400">
              {delta !== null ? `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%` : 'Active'}
            </span>
            <span className="text-[11px] text-slate-500">since start</span>
          </div>
        </div>

        <div className="rounded-xl border border-emerald-900/40 bg-emerald-950/20 p-3">
          <span className="text-[11px] font-medium uppercase tracking-wider text-emerald-400">
            🟢 Total Buys
          </span>
          <div className="mt-1 font-mono text-base font-bold text-emerald-300">
            {buyCount} {buyCount === 1 ? 'swap' : 'swaps'}
          </div>
        </div>

        <div className="rounded-xl border border-rose-900/40 bg-rose-950/20 p-3">
          <span className="text-[11px] font-medium uppercase tracking-wider text-rose-400">
            🔴 Total Sells
          </span>
          <div className="mt-1 font-mono text-base font-bold text-rose-300">
            {sellCount} {sellCount === 1 ? 'swap' : 'swaps'}
          </div>
        </div>
      </div>

      {values.length >= 2 ? (
        <>
          <div className="mt-4 flex flex-wrap items-end justify-between gap-3 border-t border-slate-800/60 pt-3">
            <div>
              <p className="text-xs text-slate-500">{metricLabel}</p>
              <p className="mt-1 font-mono text-2xl font-bold text-emerald-300">
                {formatMetric(selectedPoint ? (selectedPoint.value ?? latest) : latest)}
              </p>
              {selectedPoint?.snapshot ? (
                <p className="text-[11px] text-slate-400">
                  Recorded at {formatTime(selectedPoint.snapshot.t)}
                </p>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-300">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                Live Curve Sync
              </span>
            </div>
          </div>

          <div className="mt-2 flex items-center justify-between font-mono text-[10px] text-slate-500">
            <span>Peak: {formatMetric(series.max)}</span>
            <span>Floor: {formatMetric(series.min)}</span>
          </div>

          <div
            ref={containerRef}
            className="relative mt-1 overflow-hidden rounded-xl border border-slate-800/80 bg-slate-950/80 p-2 w-full max-w-full min-w-0"
          >
            <svg
              viewBox={`0 0 ${chartWidth} ${HEIGHT}`}
              role="img"
              aria-label={`${metricLabel}: min ${formatMetric(
                series.min,
              )}, max ${formatMetric(series.max)}, latest ${formatMetric(
                latest,
              )}`}
              className="h-44 w-full max-w-full block overflow-hidden"
            >
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Graduation target reference line */}
              {targetY !== null && targetY >= 0 && targetY <= HEIGHT ? (
                <g>
                  <line
                    x1={PADDING}
                    y1={targetY}
                    x2={chartWidth - PADDING}
                    y2={targetY}
                    stroke="#f59e0b"
                    strokeWidth="1.5"
                    strokeDasharray="4 4"
                  />
                  <text
                    x={chartWidth - PADDING - 4}
                    y={targetY - 4}
                    fill="#f59e0b"
                    fontSize="9"
                    fontFamily="monospace"
                    textAnchor="end"
                  >
                    🎓 DEX Graduation ({GRADUATION_TARGET_XLM.toLocaleString()} XLM)
                  </text>
                </g>
              ) : null}

              {/* Area Under Curve */}
              <polygon points={area} fill={`url(#${gradientId})`} />

              {/* Main Curve Line */}
              <polyline
                points={points}
                fill="none"
                stroke="#10b981"
                strokeWidth="2.5"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />

              {/* Point circles with buy/sell indicators */}
              {series.points.map((pt, idx) => {
                const prev = idx > 0 ? values[idx - 1] : values[idx]
                const curr = values[idx]
                const isUp = curr !== undefined && prev !== undefined && curr >= prev
                const isSelected = selectedPointIndex === idx

                return (
                  <circle
                    key={idx}
                    cx={pt.x}
                    cy={pt.y}
                    r={isSelected ? 5 : 3.5}
                    fill={isUp ? '#10b981' : '#f43f5e'}
                    stroke="#0f172a"
                    strokeWidth="1.5"
                    className="cursor-pointer transition-transform hover:scale-150"
                    onClick={() => setSelectedPointIndex(idx)}
                  />
                )
              })}
            </svg>
          </div>

          <div className="mt-2 flex items-center justify-between font-mono text-[10px] text-slate-500">
            <span>{formatTime(activeSnapshots[0]?.t ?? 0)}</span>
            <span>{formatTime(activeSnapshots[activeSnapshots.length - 1]?.t ?? 0)}</span>
          </div>
        </>
      ) : (
        <div className="mt-4 rounded-xl border border-dashed border-slate-700 bg-slate-950/40 p-5 text-center">
          <p className="text-sm font-semibold text-slate-300">
            Curve awaiting initial buy/sell trades
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Swaps against the Soroswap AMM pool are tracked live and plotted automatically as upward (🟢) and downward (🔴) vectors.
          </p>
        </div>
      )}

      {/* Pre-Graduation Live Trade Feed */}
      <div className="mt-6 border-t border-slate-800/80 pt-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Pre-Graduation Trades ({trades.length})
          </h3>
          <span className="text-[11px] text-slate-500">
            Soroban AMM swaps
          </span>
        </div>

        {trades.length === 0 ? (
          <p className="mt-2 text-xs text-slate-500">
            No trades recorded in recent ledger window. Swap on this token to initiate the curve!
          </p>
        ) : (
          <div className="mt-3 divide-y divide-slate-800/60 overflow-hidden rounded-xl border border-slate-800/80 bg-slate-950/50">
            {trades.slice(0, 5).map((ev: TokenEvent) => {
              const role = classifyTokenEvent(ev, pairId)
              const isBuy = role === 'buy'
              return (
                <div
                  key={ev.id}
                  className="flex flex-wrap items-center justify-between gap-2 p-2.5 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                        isBuy
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-rose-500/20 text-rose-300'
                      }`}
                    >
                      {isBuy ? '🟢 BUY' : '🔴 SELL'}
                    </span>
                    <span className="font-mono text-slate-200">
                      {formatAmount(ev.amount, decimals)} {symbol ?? 'TOKEN'}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      by {shortAddress((isBuy ? ev.to : ev.from) ?? '')}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-500">
                      {tokenEventSummary(ev, pairId)}
                    </span>
                    {ev.txHash ? (
                      <a
                        href={explorerTxUrl(ev.txHash)}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono text-[11px] text-emerald-400 underline hover:text-emerald-300"
                      >
                        tx ↗
                      </a>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}
