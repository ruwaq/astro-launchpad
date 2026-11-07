import { Link } from 'react-router'
import { BRAND } from '../lib/brand'
import { PROTOCOL_DEPLOY_FEE_USD, GRADUATION_TARGET_XLM } from '../lib/tokenomics'

export function FomoTicker() {
  return (
    <div
      role="region"
      aria-label="Live Token Activity & Graduation FOMO Ticker"
      className="relative overflow-hidden rounded-xl border border-emerald-500/30 bg-gradient-to-r from-emerald-950/40 via-slate-900/90 to-amber-950/40 p-2 text-xs shadow-inner backdrop-blur-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
          </span>
          <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-emerald-400">
            Live DEX Pulse
          </span>
          <span className="hidden text-slate-600 sm:inline">|</span>
        </div>

        <div className="flex flex-1 items-center gap-4 overflow-x-auto py-0.5 text-[11px] text-slate-300 scrollbar-none">
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 font-medium text-emerald-300">
            <span>🔥</span>
            <span>Fair Launch ${PROTOCOL_DEPLOY_FEE_USD.toFixed(2)} USD</span>
          </span>

          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-amber-500/10 px-2 py-0.5 font-medium text-amber-300">
            <span>🎓</span>
            <span>Race to {GRADUATION_TARGET_XLM.toLocaleString()} XLM Graduation</span>
          </span>

          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-sky-500/10 px-2 py-0.5 font-medium text-sky-300">
            <span>🛡️</span>
            <span>100% LP Burned to Dead Address (Anti-Rug)</span>
          </span>

          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-purple-500/10 px-2 py-0.5 font-medium text-purple-300">
            <span>🌊</span>
            <span>{BRAND.name} Instant AMM Curve</span>
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Link
            to="/create"
            className="rounded-md bg-emerald-500/20 px-2.5 py-1 text-[11px] font-bold text-emerald-300 transition hover:bg-emerald-500/30"
          >
            + Ape In / Launch
          </Link>
        </div>
      </div>
    </div>
  )
}
