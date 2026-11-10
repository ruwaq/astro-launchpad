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
      title: 'Fair Bonding Curve AMM Trading',
      color: 'bg-emerald-400 text-emerald-300 border-emerald-500',
      percent: curvePercent,
      desc: '795,000,000 tokens available for immediate community trading on the constant-product AMM before graduation.',
      icon: '📈',
    },
    dex: {
      title: 'Soroswap DEX Deep Liquidity Reserve',
      color: 'bg-cyan-400 text-cyan-300 border-cyan-500',
      percent: dexPercent,
      desc: '200,000,000 tokens reserved to anchor deep liquidity on Soroswap DEX with 100% of LP tokens burned.',
      icon: '🌊',
    },
    creator: {
      title: 'Creator Fair Vesting Incentive',
      color: 'bg-amber-400 text-amber-300 border-amber-500',
      percent: creatorPercent,
      desc: '5,000,000 tokens (0.5%) distributed to the creator across 5 vesting phases over 15 days post-graduation to protect community holders.',
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
            Token Distribution & Milestones for ${symbol}
          </h2>
        </div>
        <span className="rounded-full border border-slate-700 bg-slate-950/60 px-2.5 py-0.5 font-mono text-xs text-slate-300">
          Supply: 1,000,000,000 Fixed
        </span>
      </div>

      {/* 1. Visual Token Distribution Bar */}
      <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3.5 space-y-3">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span className="font-semibold text-slate-200">
            Token Architecture (100% Immutable)
          </span>
          <span className="text-[11px] text-slate-500">Tap segments to view details</span>
        </div>

        {/* Visual Segmented Bar */}
        <div className="flex h-4 w-full overflow-hidden rounded-full p-0.5 bg-slate-900 border border-slate-800 gap-0.5">
          <button
            type="button"
            onClick={() => setActiveSegment('curve')}
            title="Trading Curve (79.5%)"
            style={{ width: `${curvePercent}%` }}
            className={`h-full rounded-l-full bg-emerald-500 transition-all hover:opacity-90 ${
              activeSegment === 'curve' ? 'ring-2 ring-emerald-300' : 'opacity-80'
            }`}
          />
          <button
            type="button"
            onClick={() => setActiveSegment('dex')}
            title="Soroswap DEX Reserve (20.0%)"
            style={{ width: `${dexPercent}%` }}
            className={`h-full bg-cyan-400 transition-all hover:opacity-90 ${
              activeSegment === 'dex' ? 'ring-2 ring-cyan-300' : 'opacity-80'
            }`}
          />
          <button
            type="button"
            onClick={() => setActiveSegment('creator')}
            title="Creator Allocation (0.5%)"
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
            <span className="text-[11px] truncate">Bonding Curve</span>
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
            <span className="text-[11px] truncate">DEX Reserve</span>
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
            <span>⚖️</span> Trade Sentiment ({totalSwaps} swaps)
          </span>
          <div className="flex gap-2 font-mono text-[11px]">
            <span className="text-emerald-400 font-bold">🟢 {buyRatio.toFixed(0)}% Buys</span>
            <span className="text-rose-400 font-bold">🔴 {sellRatio.toFixed(0)}% Sells</span>
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

      {/* 3. Milestone Cards */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
          <span>🏆</span> Protocol Milestones for ${symbol}
        </h3>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {/* Milestone 1 */}
          <div className="rounded-xl border border-emerald-900/60 bg-emerald-950/20 p-3">
            <div className="flex items-center justify-between">
              <span className="text-base">🌱</span>
              <span className="text-[10px] font-bold uppercase text-emerald-400 bg-emerald-900/50 px-1.5 py-0.5 rounded">
                Complete ✓
              </span>
            </div>
            <p className="mt-2 text-xs font-bold text-slate-200">1. Genesis</p>
            <p className="mt-0.5 text-[11px] text-slate-400">
              1B immutable supply, 0% inflation, and ownership renounced.
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
                {pool?.exists ? 'Active ✓' : 'Pending'}
              </span>
            </div>
            <p className="mt-2 text-xs font-bold text-slate-200">2. Initial Liquidity</p>
            <p className="mt-0.5 text-[11px] text-slate-400">
              {pool?.exists
                ? 'Soroswap AMM pool open for community trading.'
                : 'Requires initial seed liquidity deposit to activate trading curve.'}
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
            <p className="mt-2 text-xs font-bold text-slate-200">3. DEX Sprint</p>
            <p className="mt-0.5 text-[11px] text-slate-400">
              Goal: accumulate XLM buy volume racing towards the graduation milestone.
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
                {grad.graduated ? 'Graduated 🏆' : `${grad.targetXlm} XLM`}
              </span>
            </div>
            <p className="mt-2 text-xs font-bold text-slate-200">4. Soroswap DEX</p>
            <p className="mt-0.5 text-[11px] text-slate-400">
              100% of LP burned to{' '}
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
