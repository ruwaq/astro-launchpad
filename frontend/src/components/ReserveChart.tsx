import { useId, useMemo, useState } from 'react'
import {
  snapshotLiquidity,
  snapshotPrice,
  toChartPoints,
  type ReserveSnapshot,
} from '../lib/snapshots'

const WIDTH = 320
const HEIGHT = 120
const PADDING = 12

type Metric = 'price' | 'liquidity'

function formatMetric(value: number): string {
  if (!Number.isFinite(value)) return '—'
  const abs = Math.abs(value)
  const digits = abs > 0 && abs < 0.01 ? 8 : 4
  return value.toLocaleString('es-ES', { maximumFractionDigits: digits })
}

function formatTime(t: number): string {
  return new Date(t).toLocaleString('es-ES', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function ReserveChart({
  snapshots,
  decimals,
  symbol,
}: {
  snapshots: ReserveSnapshot[]
  decimals: number
  symbol?: string
}) {
  const [metric, setMetric] = useState<Metric>('price')
  const gradientId = useId().replace(/:/g, '')

  const values = useMemo(
    () =>
      snapshots
        .map((snapshot) =>
          metric === 'price'
            ? snapshotPrice(snapshot, decimals)
            : snapshotLiquidity(snapshot),
        )
        .map((value) => (Number.isFinite(value) ? value : 0)),
    [decimals, metric, snapshots],
  )

  const series = useMemo(
    () => toChartPoints(values, WIDTH, HEIGHT, PADDING),
    [values],
  )
  const points = series.points
    .map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`)
    .join(' ')
  const area = points
    ? `${PADDING},${HEIGHT - PADDING} ${points} ${WIDTH - PADDING},${
        HEIGHT - PADDING
      }`
    : ''

  const first = values[0] ?? 0
  const latest = values[values.length - 1] ?? 0
  const delta = first > 0 ? ((latest - first) / first) * 100 : null
  const metricLabel =
    metric === 'price' ? `Precio (XLM por ${symbol ?? 'token'})` : 'Liquidez (XLM)'

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Historial del par</h2>
          <p className="mt-1 text-xs text-slate-500">
            {snapshots.length === 1
              ? '1 snapshot local'
              : `${snapshots.length} snapshots locales`}{' '}
            · cambios al instante y pulso cada ~5 min
          </p>
        </div>
        <div
          className="flex rounded-lg border border-slate-700 p-1"
          role="group"
          aria-label="Métrica del gráfico"
        >
          <button
            type="button"
            aria-pressed={metric === 'price'}
            onClick={() => setMetric('price')}
            className={`min-h-[44px] rounded-md px-3 py-1 text-xs font-medium transition ${
              metric === 'price'
                ? 'bg-emerald-500 text-slate-950'
                : 'text-slate-300 hover:text-slate-100'
            }`}
          >
            Precio
          </button>
          <button
            type="button"
            aria-pressed={metric === 'liquidity'}
            onClick={() => setMetric('liquidity')}
            className={`min-h-[44px] rounded-md px-3 py-1 text-xs font-medium transition ${
              metric === 'liquidity'
                ? 'bg-emerald-500 text-slate-950'
                : 'text-slate-300 hover:text-slate-100'
            }`}
          >
            Liquidez
          </button>
        </div>
      </div>

      {values.length >= 2 ? (
        <>
          <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs text-slate-500">{metricLabel}</p>
              <p className="mt-1 font-mono text-2xl font-semibold text-emerald-300">
                {formatMetric(latest)}
              </p>
            </div>
            {delta === null ? null : (
              <p
                className={`rounded-full border px-2.5 py-1 font-mono text-xs ${
                  delta >= 0
                    ? 'border-emerald-900 bg-emerald-950/40 text-emerald-300'
                    : 'border-rose-900 bg-rose-950/40 text-rose-300'
                }`}
              >
                {delta >= 0 ? '+' : ''}
                {delta.toFixed(2)}% desde la primera lectura
              </p>
            )}
          </div>

          <div className="mt-2 flex items-center justify-between font-mono text-[10px] text-slate-500">
            <span>máx. {formatMetric(series.max)}</span>
            <span>mín. {formatMetric(series.min)}</span>
          </div>

          <svg
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            preserveAspectRatio="none"
            role="img"
            aria-label={`${metricLabel}: mínimo ${formatMetric(
              series.min,
            )}, máximo ${formatMetric(series.max)}, último ${formatMetric(
              latest,
            )}`}
            className="mt-1 h-36 w-full"
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#34d399" stopOpacity="0.28" />
                <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
              </linearGradient>
            </defs>
            <polygon points={area} fill={`url(#${gradientId})`} />
            <polyline
              points={points}
              fill="none"
              stroke="#34d399"
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>

          <div className="flex items-center justify-between font-mono text-[10px] text-slate-500">
            <span>{formatTime(snapshots[0]?.t ?? 0)}</span>
            <span>{formatTime(snapshots[snapshots.length - 1]?.t ?? 0)}</span>
          </div>
        </>
      ) : (
        <div className="mt-4 rounded-lg border border-dashed border-slate-700 bg-slate-950/30 p-4">
          <p className="text-sm text-slate-300">
            Aún no hay suficientes lecturas para dibujar el gráfico.
          </p>
          <p className="mt-1 text-xs text-slate-500">
            La primera se guarda al abrir el token; la siguiente, unos 5 minutos
            después. Mantén esta pestaña abierta para ver la evolución.
          </p>
        </div>
      )}

      <p className="mt-3 text-xs text-slate-500">
        Historial local de este navegador: se llena mientras abres el detalle de
        este token; no incluye lo que pasó antes ni lo que vean otras personas.
        El histórico global necesita un indexer; mientras tanto, esto es una
        lectura honesta de lo observado.
      </p>
    </section>
  )
}
