import { Link } from 'react-router'
import { useActivity } from '../store/activity'
import { useTokenList } from '../hooks/useTokenList'
import {
  CREATOR_ALLOCATION_BPS,
  graduationProgress,
  POOL_ALLOCATION_BPS,
  STELLAR_BURN_ADDRESS,
} from '../lib/tokenomics'
import { formatAmount, shortAddress } from '../lib/format'
import { ASTRO_TOKEN_ID } from '../lib/network'

type TickerPill = {
  id: string
  to: string
  badge: string
  text: string
  tone: 'emerald' | 'amber' | 'rose' | 'violet'
}

/** Fair launch figures in %, derived from tokenomics (0.5% / 99.5%). */
const creatorPercent = Number(CREATOR_ALLOCATION_BPS) / 100 // 0.5%
const poolPercent = Number(POOL_ALLOCATION_BPS) / 100 // 99.5%

export function LiveTickerBar() {
  const entries = useActivity((state) => state.entries)
  const { data: tokens } = useTokenList()

  const pills: TickerPill[] = []

  // 1. Real activity entries from current session
  for (const entry of entries.slice(0, 6)) {
    const sym = entry.tokenSymbol ?? 'TOKEN'
    const who = entry.account ? shortAddress(entry.account) : 'Trader'
    if (entry.kind === 'swap' && entry.swapDirection === 'buy') {
      pills.push({
        id: `act-${entry.id}`,
        to: `/token/${entry.tokenId}`,
        badge: '🟢 BUY',
        text: `${who} bought ${entry.secondaryAmount ?? ''} XLM of $${sym}`,
        tone: 'emerald',
      })
    } else if (entry.kind === 'swap' && entry.swapDirection === 'sell') {
      pills.push({
        id: `act-${entry.id}`,
        to: `/token/${entry.tokenId}`,
        badge: '🔴 SELL',
        text: `${who} sold ${entry.amount ?? ''} $${sym}`,
        tone: 'rose',
      })
    } else if (entry.kind === 'create') {
      pills.push({
        id: `act-${entry.id}`,
        to: `/token/${entry.tokenId}`,
        badge: '🚀 NEW',
        text: `${who} launched $${sym} (Fair Launch)`,
        tone: 'violet',
      })
    } else if (entry.kind === 'burn') {
      pills.push({
        id: `act-${entry.id}`,
        to: `/token/${entry.tokenId}`,
        badge: '🔥 BURN',
        text: `${entry.amount ?? ''} $${sym} burned`,
        tone: 'amber',
      })
    }
  }

  // 2. Real on-chain pairs discovered from Soroswap factory
  for (const token of (tokens ?? []).slice(0, 8)) {
    const grad = graduationProgress(token.pool.reserveXlm)
    const xlmLiq = formatAmount(token.pool.reserveXlm, 7)
    pills.push({
      id: `tok-${token.id}`,
      to: `/token/${token.id}`,
      badge: grad.graduated
        ? '🎓 DEX'
        : grad.percent >= 50
          ? '👑 KING'
          : '⚡ CURVE',
      text: `$${token.symbol} · ${xlmLiq} XLM (${grad.percent.toFixed(0)}%)`,
      tone: grad.graduated
        ? 'emerald'
        : grad.percent >= 50
          ? 'amber'
          : 'violet',
    })
  }

  // Fallback pills when waiting for RPC
  if (pills.length === 0) {
    pills.push(
      {
        id: 'seed-astro',
        to: `/token/${ASTRO_TOKEN_ID}`,
        badge: '👑 FEATURED',
        text: '$ASTRO live on Soroswap Testnet · View real-time curve',
        tone: 'amber',
      },
      {
        id: 'seed-launch',
        to: '/create',
        badge: '🚀 FAIR LAUNCH',
        text: `${creatorPercent}% Creator · ${poolPercent}% Pool · LP Burned to ${shortAddress(STELLAR_BURN_ADDRESS)}`,
        tone: 'emerald',
      },
    )
  }

  const toneClasses: Record<TickerPill['tone'], string> = {
    emerald:
      'border-emerald-500/40 bg-emerald-500/10 text-emerald-200 hover:border-emerald-400',
    amber:
      'border-amber-500/40 bg-amber-500/10 text-amber-200 hover:border-amber-400',
    rose: 'border-rose-500/40 bg-rose-500/10 text-rose-200 hover:border-rose-400',
    violet:
      'border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-200 hover:border-fuchsia-400',
  }

  return (
    <aside
      aria-label="Live launchpad activity"
      className="w-full max-w-full overflow-hidden border-b border-slate-900 bg-slate-950/95 px-3 py-1.5 text-xs"
    >
      <div className="mx-auto flex w-full max-w-5xl items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth">
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-950/60 px-2.5 py-0.5 font-semibold text-emerald-300">
          <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
          LIVE
        </span>

        <Link
          to="/create"
          className="inline-flex shrink-0 items-center gap-1 rounded-full border border-sky-500/30 bg-sky-950/50 px-2.5 py-0.5 text-[11px] font-semibold text-sky-300 hover:border-sky-400 hover:text-white transition-colors"
        >
          <span>🚀</span>
          <span>Launch Token</span>
        </Link>

        <div className="flex items-center gap-2">
          {pills.map((pill) => (
            <Link
              key={pill.id}
              to={pill.to}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] transition-transform hover:scale-[1.02] ${toneClasses[pill.tone]}`}
            >
              <span className="font-bold">{pill.badge}</span>
              <span className="truncate max-w-[240px]">{pill.text}</span>
            </Link>
          ))}
        </div>
      </div>
    </aside>
  )
}
