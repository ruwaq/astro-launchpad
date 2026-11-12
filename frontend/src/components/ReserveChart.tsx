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
  type TokenEvent,
} from '../lib/token-events'
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
    <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 sm:p-5 shadow-sm w-full max-w-full min-w-0 overflow-hidden space-y-3">
      <h2 className="sr-only">Pair History</h2>
      {/* Sleek Chart Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
        <div className="flex items-baseline gap-2.5">
          <span className="font-mono text-2xl font-black text-white">
            {formatMetric(selectedPoint ? (selectedPoint.value ?? latest) : latest)}
          </span>
          <span className="text-xs font-mono text-slate-400">
            {metric === 'price' ? `XLM / $${symbol ?? 'TOKEN'}` : 'XLM Liquidity'}
          </span>
          {delta !== null ? (
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-mono font-bold ${
                delta >= 0 ? 'bg-emerald-500/15 text-emerald-300' : 'bg-rose-500/15 text-rose-300'
              }`}
            >
              {delta >= 0 ? '+' : ''}{delta.toFixed(1)}%
            </span>
          ) : null}
        </div>

        <div
          className="flex rounded-xl border border-slate-800 p-0.5 bg-slate-950/70"
          role="tablist"
          aria-label="Chart metric"
        >
          <button
            type="button"
            role="tab"
            aria-selected={metric === 'price'}
            onClick={() => {
              setMetric('price')
              setSelectedPointIndex(null)
            }}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              metric === 'price'
                ? 'bg-sky-500 text-slate-950 font-bold shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Price
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={metric === 'liquidity'}
            onClick={() => {
              setMetric('liquidity')
              setSelectedPointIndex(null)
            }}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              metric === 'liquidity'
                ? 'bg-sky-500 text-slate-950 font-bold shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Liquidity
          </button>
        </div>
      </div>

      {values.length >= 2 ? (
        <>
          <div className="flex items-center justify-between font-mono text-[10px] text-slate-400">
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

          <div className="mt-2 flex items-center justify-between font-mono text-[10px] text-slate-400">
            <span>{formatTime(activeSnapshots[0]?.t ?? 0)}</span>
            <span>{formatTime(activeSnapshots[activeSnapshots.length - 1]?.t ?? 0)}</span>
          </div>
        </>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-800 bg-slate-950/40 p-6 text-center">
          <p className="text-xs text-slate-400">
            Awaiting trades · Swaps on Soroswap are plotted live automatically
          </p>
        </div>
      )}

      {/* Clean Telemetry Status Row */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80 font-mono text-[11px] text-slate-400">
        <div className="flex items-center gap-3">
          <span className="text-emerald-400 font-bold">🟢 {buyCount} buys</span>
          <span className="text-rose-400 font-bold">🔴 {sellCount} sells</span>
        </div>
        <div className="flex items-center gap-2">
          <span>Target: <strong className="text-amber-300 font-bold">{grad.percent.toFixed(1)}%</strong> ({grad.targetXlm} XLM)</span>
        </div>
      </div>
    </section>
  )
}
