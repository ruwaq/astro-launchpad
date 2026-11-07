import { Link } from 'react-router'
import { useActivity } from '../store/activity'
import { useTokenList } from '../hooks/useTokenList'
import { useXlmUsdPrice } from '../hooks/useXlmUsdPrice'
import {
  calculateDeployFeeInXlm,
  graduationProgress,
  PROTOCOL_DEPLOY_FEE_USD,
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

export function LiveTickerBar() {
  const entries = useActivity((state) => state.entries)
  const { data: tokens } = useTokenList()
  const { data: xlmUsd = 0.1555 } = useXlmUsdPrice()
  const mintFeeXlm = calculateDeployFeeInXlm(xlmUsd)

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
        text: '1% Creator · 99% Pool · LP Burned to GAAAA...WHF',
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
    <div
      aria-label="Live launchpad activity"
      className="border-b border-slate-900 bg-slate-950/95 px-3 py-1.5 text-xs"
    >
      <div className="mx-auto flex max-w-5xl items-center gap-2 overflow-x-auto no-scrollbar">
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-950/60 px-2.5 py-0.5 font-semibold text-emerald-300">
          <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
          LIVE
        </span>

        <Link
          to="/create"
          className="inline-flex shrink-0 items-center gap-1 rounded-full border border-slate-800 bg-slate-900/90 px-2.5 py-0.5 font-mono text-[11px] text-slate-300 hover:border-emerald-500/60 hover:text-emerald-200"
          title={`Mint fee pegged to $${PROTOCOL_DEPLOY_FEE_USD.toFixed(2)} USD based on real-time live spot XLM`}
        >
          <span>⚡ Mint:</span>
          <strong className="text-emerald-300">
            ${PROTOCOL_DEPLOY_FEE_USD.toFixed(2)} USD
          </strong>
          <span className="text-slate-400">
            (≈ {mintFeeXlm.toFixed(2)} XLM @ ${xlmUsd.toFixed(3)})
          </span>
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
    </div>
  )
}
