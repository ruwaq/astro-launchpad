import { useState } from 'react'
import {
  BONDING_CURVE_ALLOCATION_BPS,
  CREATOR_ALLOCATION_BPS,
  DEX_RESERVE_ALLOCATION_BPS,
  graduationProgress,
  STELLAR_BURN_ADDRESS,
} from '../lib/tokenomics'
import { explorerAccountUrl } from '../lib/explorer'
import type { PoolState } from '../lib/soroswap'

type SegmentKey = 'curve' | 'dex' | 'creator'

export function TokenGraphics({
  symbol = 'TOKEN',
  pool,
  buyCount = 0,
  sellCount = 0,
}: {
  symbol?: string
  pool?: PoolState
  buyCount?: number
  sellCount?: number
}) {
  const [activeSegment, setActiveSegment] = useState<SegmentKey>('curve')
  const grad = graduationProgress(pool?.reserveXlm ?? 0n)

  const curvePercent = Number(BONDING_CURVE_ALLOCATION_BPS) / 100 // 79.5%
  const dexPercent = Number(DEX_RESERVE_ALLOCATION_BPS) / 100 // 20.0%
  const creatorPercent = Number(CREATOR_ALLOCATION_BPS) / 100 // 0.5%

  const totalSwaps = buyCount + sellCount
  const buyRatio = totalSwaps > 0 ? (buyCount / totalSwaps) * 100 : 100
  const sellRatio = totalSwaps > 0 ? (sellCount / totalSwaps) * 100 : 0

  const SEGMENT_INFO: Record<
    SegmentKey,
    { title: string; color: string; percent: number; desc: string; icon: string }
  > = {
    curve: {
      title: 'Curva de Trading Justo (Bonding Curve)',
      color: 'bg-emerald-400 text-emerald-300 border-emerald-500',
      percent: curvePercent,
      desc: '795,000,000 tokens disponibles para compra y venta inmediata de la comunidad en la curva constante antes de graduarse.',
      icon: '📈',
    },
    dex: {
      title: 'Reserva de Liquidez Soroswap DEX',
      color: 'bg-cyan-400 text-cyan-300 border-cyan-500',
      percent: dexPercent,
      desc: '200,000,000 tokens reservados para fondear la piscina oficial de Soroswap DEX con el 100% de los tokens LP quemados.',
      icon: '🌊',
    },
    creator: {
      title: 'Incentivo del Desarrollador / Creador',
      color: 'bg-amber-400 text-amber-300 border-amber-500',
      percent: creatorPercent,
      desc: '5,000,000 tokens (0.5%) entregados al creador únicamente cuando el token logra graduarse exitosamente a Soroswap DEX.',
      icon: '👑',
    },
  }

  const selected = SEGMENT_INFO[activeSegment]

  return (
    <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/40 p-4 sm:p-6 shadow-sm">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/20 text-sm">
            📊
          </span>
          <h2 className="text-base sm:text-lg font-bold text-slate-100">
            Gráficos de Distribución & Hitos de ${symbol}
          </h2>
        </div>
        <span className="rounded-full border border-slate-700 bg-slate-950/60 px-2.5 py-0.5 font-mono text-xs text-slate-300">
          Supply: 1,000,000,000 Fijo
        </span>
      </div>

      {/* 1. Visual Token Distribution Bar */}
      <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3.5 space-y-3">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span className="font-semibold text-slate-200">
            Arquitectura de Tokens (100% Inmutable)
          </span>
          <span className="text-[11px] text-slate-500">Toca para ver detalles</span>
        </div>

        {/* Visual Segmented Bar */}
        <div className="flex h-4 w-full overflow-hidden rounded-full p-0.5 bg-slate-900 border border-slate-800 gap-0.5">
          <button
            type="button"
            onClick={() => setActiveSegment('curve')}
            title="Curva de Trading (79.5%)"
            style={{ width: `${curvePercent}%` }}
            className={`h-full rounded-l-full bg-emerald-500 transition-all hover:opacity-90 ${
              activeSegment === 'curve' ? 'ring-2 ring-emerald-300' : 'opacity-80'
            }`}
          />
          <button
            type="button"
            onClick={() => setActiveSegment('dex')}
            title="Reserva Soroswap DEX (20.0%)"
            style={{ width: `${dexPercent}%` }}
            className={`h-full bg-cyan-400 transition-all hover:opacity-90 ${
              activeSegment === 'dex' ? 'ring-2 ring-cyan-300' : 'opacity-80'
            }`}
          />
          <button
            type="button"
            onClick={() => setActiveSegment('creator')}
            title="Premio Creador (0.5%)"
            style={{ width: `${creatorPercent}%` }}
            className={`h-full rounded-r-full bg-amber-400 transition-all hover:opacity-90 ${
              activeSegment === 'creator' ? 'ring-2 ring-amber-300' : 'opacity-80'
            }`}
          />
        </div>

        {/* Interactive Segment Buttons */}
        <div className="grid grid-cols-3 gap-1.5 text-center text-xs">
          <button
            type="button"
            onClick={() => setActiveSegment('curve')}
            className={`rounded-lg border p-1.5 transition-all ${
              activeSegment === 'curve'
                ? 'border-emerald-500 bg-emerald-950/40 text-emerald-300 font-bold'
                : 'border-slate-800 bg-slate-900/40 text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className="block font-mono text-emerald-400">{curvePercent}%</span>
            <span className="text-[11px] truncate">Curva Venta</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSegment('dex')}
            className={`rounded-lg border p-1.5 transition-all ${
              activeSegment === 'dex'
                ? 'border-cyan-500 bg-cyan-950/40 text-cyan-300 font-bold'
                : 'border-slate-800 bg-slate-900/40 text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className="block font-mono text-cyan-400">{dexPercent}%</span>
            <span className="text-[11px] truncate">Reserva DEX</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSegment('creator')}
            className={`rounded-lg border p-1.5 transition-all ${
              activeSegment === 'creator'
                ? 'border-amber-500 bg-amber-950/40 text-amber-300 font-bold'
                : 'border-slate-800 bg-slate-900/40 text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className="block font-mono text-amber-400">{creatorPercent}%</span>
            <span className="text-[11px] truncate">Dev 0.5%</span>
          </button>
        </div>

        {/* Active Segment Explanation Card */}
        <div className="rounded-lg border border-slate-800 bg-slate-900/80 p-3 text-xs">
          <div className="flex items-center gap-1.5 font-bold text-slate-200">
            <span>{selected.icon}</span>
            <span>{selected.title}</span>
            <span className="ml-auto font-mono text-emerald-400">{selected.percent}%</span>
          </div>
          <p className="mt-1 text-slate-400 leading-relaxed">{selected.desc}</p>
        </div>
      </div>

      {/* 2. Sentiment Graphic (Buys vs Sells Bar) */}
      <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3.5 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-300 flex items-center gap-1">
            <span>⚖️</span> Sentimiento de Trading ({totalSwaps} swaps)
          </span>
          <div className="flex gap-2 font-mono text-[11px]">
            <span className="text-emerald-400 font-bold">🟢 {buyRatio.toFixed(0)}% Compras</span>
            <span className="text-rose-400 font-bold">🔴 {sellRatio.toFixed(0)}% Ventas</span>
          </div>
        </div>

        <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-slate-900 border border-slate-800">
          <div
            style={{ width: `${buyRatio}%` }}
            className="h-full bg-emerald-500 transition-all duration-500"
          />
          <div
            style={{ width: `${sellRatio}%` }}
            className="h-full bg-rose-500 transition-all duration-500"
          />
        </div>
      </div>

      {/* 3. Cuadros de Hitos del Juego (Milestone Cards) */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
          <span>🏆</span> Cuadros de Hitos de ${symbol}
        </h3>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {/* Milestone 1 */}
          <div className="rounded-xl border border-emerald-900/60 bg-emerald-950/20 p-3">
            <div className="flex items-center justify-between">
              <span className="text-base">🌱</span>
              <span className="text-[10px] font-bold uppercase text-emerald-400 bg-emerald-900/50 px-1.5 py-0.5 rounded">
                Listo ✓
              </span>
            </div>
            <p className="mt-2 text-xs font-bold text-slate-200">1. Génesis</p>
            <p className="mt-0.5 text-[11px] text-slate-400">
              1B supply inmutable, 0% inflación y propiedad renunciada.
            </p>
          </div>

          {/* Milestone 2 */}
          <div
            className={`rounded-xl border p-3 ${
              pool?.exists
                ? 'border-emerald-900/60 bg-emerald-950/20'
                : 'border-slate-800 bg-slate-950/40'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-base">💧</span>
              <span
                className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                  pool?.exists
                    ? 'text-emerald-400 bg-emerald-900/50'
                    : 'text-amber-400 bg-amber-950/40'
                }`}
              >
                {pool?.exists ? 'Activo ✓' : 'Pendiente'}
              </span>
            </div>
            <p className="mt-2 text-xs font-bold text-slate-200">2. Pool Inicial</p>
            <p className="mt-0.5 text-[11px] text-slate-400">
              {pool?.exists
                ? 'Curva Soroswap abierta para trading de la comunidad.'
                : 'Requiere sembrar la liquidez de arranque para activar la curva.'}
            </p>
          </div>

          {/* Milestone 3 */}
          <div
            className={`rounded-xl border p-3 ${
              grad.percent >= 50
                ? 'border-emerald-900/60 bg-emerald-950/20'
                : 'border-slate-800 bg-slate-950/40'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-base">🚀</span>
              <span
                className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                  grad.percent >= 50
                    ? 'text-emerald-400 bg-emerald-900/50'
                    : 'text-slate-400 bg-slate-800'
                }`}
              >
                {grad.percent >= 50 ? '50%+ ✓' : `${grad.percent.toFixed(0)}%`}
              </span>
            </div>
            <p className="mt-2 text-xs font-bold text-slate-200">3. Carrera DEX</p>
            <p className="mt-0.5 text-[11px] text-slate-400">
              Objetivo: acumular compras en XLM rumbo a la graduación.
            </p>
          </div>

          {/* Milestone 4 */}
          <div
            className={`rounded-xl border p-3 ${
              grad.graduated
                ? 'border-emerald-500 bg-emerald-950/30'
                : 'border-slate-800 bg-slate-950/40'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-base">🎓</span>
              <span
                className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                  grad.graduated
                    ? 'text-emerald-300 bg-emerald-900/60 animate-pulse'
                    : 'text-slate-500 bg-slate-800'
                }`}
              >
                {grad.graduated ? 'Graduado 🏆' : `${grad.targetXlm} XLM`}
              </span>
            </div>
            <p className="mt-2 text-xs font-bold text-slate-200">4. Soroswap DEX</p>
            <p className="mt-0.5 text-[11px] text-slate-400">
              100% de LP quemados a{' '}
              <a
                href={explorerAccountUrl(STELLAR_BURN_ADDRESS)}
                target="_blank"
                rel="noreferrer"
                className="underline hover:text-emerald-300"
              >
                GAAAA...WHF
              </a>
              .
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
