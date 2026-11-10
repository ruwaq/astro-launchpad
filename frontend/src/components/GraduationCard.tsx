import { useQuery } from '@tanstack/react-query'
import {
  auditTokenSecurity,
  CREATOR_GRADUATION_REWARD_XLM,
  CREATOR_VESTING_SCHEDULE,
  graduationProgress,
  SOROSWAP_SWAP_FEE_PERCENT,
  STELLAR_BURN_ADDRESS,
} from '../lib/tokenomics'
import {
  explorerAccountUrl,
  explorerContractUrl,
  SOROSWAP_APP_URL,
} from '../lib/explorer'
import { shortAddress } from '../lib/format'
import { fetchBurnedLpInfo, type PoolState } from '../lib/soroswap'

export function GraduationCard({
  symbol,
  owner,
  totalSupply,
  pool,
}: {
  symbol: string
  owner: string | null
  totalSupply: bigint
  pool: PoolState | undefined
}) {
  const reserveXlm = pool?.exists ? pool.reserveXlm : 0n
  const grad = graduationProgress(reserveXlm)
  const audit = auditTokenSecurity({ owner, totalSupply, pool })
  const pairId = pool?.exists ? pool.pairId : null

  const { data: lpBurnInfo } = useQuery({
    queryKey: ['burned-lp', pairId],
    queryFn: () => (pairId ? fetchBurnedLpInfo(pairId) : null),
    enabled: Boolean(pairId),
    staleTime: 10_000,
  })
  const burnedPercent = lpBurnInfo?.burnedPercent ?? 0
  const lpIsLocked = burnedPercent >= 90

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base sm:text-lg font-bold flex items-center gap-2">
              <span>🚀</span> Road to Soroswap DEX Graduation
            </h2>
            <span
              className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                grad.graduated
                  ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300 animate-pulse'
                  : 'border-slate-700 bg-slate-950/60 text-slate-300'
              }`}
            >
              {grad.label}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-400 max-w-xl">
            When the bonding curve hits 100% ({grad.targetXlm.toLocaleString('en-US')} XLM), all liquidity is locked & burned into Soroswap DEX forever! Dev receives 0.5% locked for 15 days to protect buyers. 100% fair launch, rug-proof.
          </p>
        </div>

        <div className="text-right font-mono">
          <span className="text-xl sm:text-2xl font-black text-emerald-400">
            {grad.percent.toFixed(1)}%
          </span>
          <p className="text-xs text-slate-400">
            {grad.currentXlm.toLocaleString('en-US', {
              maximumFractionDigits: 1,
            })}{' '}
            / {grad.targetXlm.toLocaleString('en-US')} XLM
          </p>
        </div>
      </div>

      <div className="relative mt-4 pt-4">
        {/* Animated Rocket Positioned Above the Bar */}
        <div
          className="absolute top-0 -translate-x-1/2 text-sm transition-all duration-500 pointer-events-none"
          style={{ left: `${Math.min(98, Math.max(2, grad.percent))}%` }}
        >
          🚀
        </div>

        <div
          role="progressbar"
          aria-valuenow={Math.round(grad.percent)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Progress towards graduation on Soroswap DEX"
          className="h-3 w-full overflow-hidden rounded-full border border-slate-800 bg-slate-950"
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-300 transition-all duration-500 shadow-sm shadow-emerald-500/50"
            style={{ width: `${Math.min(100, Math.max(2, grad.percent))}%` }}
          />
        </div>
      </div>

      <div className="mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        <div
          className={`rounded-lg border p-3 text-xs ${
            audit.ownershipRenounced
              ? 'border-emerald-900/70 bg-emerald-950/20 text-emerald-200'
              : 'border-amber-900/70 bg-amber-950/20 text-amber-200'
          }`}
        >
          <p className="font-semibold flex items-center gap-1">
            <span>{audit.ownershipRenounced ? '🛡️' : '⚠️'}</span>
            {audit.ownershipRenounced
              ? 'Immutable Supply'
              : 'Active Owner'}
          </p>
          <p className="mt-1 opacity-80">
            {audit.ownershipRenounced
              ? 'Ownership renounced on-chain. Nobody can mint more tokens.'
              : 'Owner can still mint tokens.'}
          </p>
        </div>

        <div
          className={`rounded-lg border p-3 text-xs ${
            lpIsLocked
              ? 'border-emerald-900/70 bg-emerald-950/20 text-emerald-200'
              : 'border-slate-800 bg-slate-950/50 text-slate-300'
          }`}
        >
          <p className="font-semibold flex items-center gap-1">
            <span>🔥</span>
            {lpIsLocked
              ? `LP Burned (${burnedPercent.toFixed(1)}%)`
              : `Burned LP: ${burnedPercent.toFixed(1)}%`}
          </p>
          <p className="mt-1 opacity-80">
            {lpIsLocked ? (
              <>
                LP locked in dead account{' '}
                <a
                  href={explorerAccountUrl(STELLAR_BURN_ADDRESS)}
                  target="_blank"
                  rel="noreferrer"
                  className="underline hover:text-emerald-100"
                >
                  {shortAddress(STELLAR_BURN_ADDRESS)} ↗
                </a>
              </>
            ) : (
              'LP is automatically burned to dead address on graduation.'
            )}
          </p>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3 text-xs text-slate-300">
          <p className="font-semibold text-slate-200 flex items-center gap-1">
            <span>⚖️</span> Fair Tokenomics & Anti-Dump (15 Days)
          </p>
          <p className="mt-1 text-slate-400">
            99.5% allocated to liquidity pool (100% LP burned), 0.5% developer cut protected with 15-day anti-dump vesting post-graduation.
          </p>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3 text-xs text-slate-300">
          <p className="font-semibold text-emerald-300 flex items-center gap-1">
            <span>💎</span> Fees & Rewards
          </p>
          <p className="mt-1 text-slate-400">
            {SOROSWAP_SWAP_FEE_PERCENT}% LP fee remains in pool. Creator receives +{CREATOR_GRADUATION_REWARD_XLM} XLM bonus on graduation.
          </p>
        </div>
      </div>

      {/* 5-Phase Anti-Dump Vesting Schedule (15 Days) */}
      <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-950/15 p-3.5 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-1 text-xs">
          <span className="font-bold text-amber-300 flex items-center gap-1.5">
            <span>🛡️</span> Anti-Dump Protection: 5-Phase Vesting (15 Days)
          </span>
          <span className="font-mono text-[11px] text-slate-300">
            Dev Cut: 5,000,000 $TOKEN (0.5% supply)
          </span>
        </div>
        <p className="text-[11px] text-slate-400">
          To protect community buyers from immediate post-graduation selloffs, developer tokens unlock gradually every 3 days (20% per phase):
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1">
          {CREATOR_VESTING_SCHEDULE.map((phase) => (
            <div
              key={phase.phase}
              className="rounded-lg border border-slate-800 bg-slate-950/70 p-2 text-center"
            >
              <span className="text-[10px] font-semibold text-amber-400 block">
                Phase {phase.phase} (Day {phase.day})
              </span>
              <p className="font-mono text-xs font-black text-slate-100 mt-0.5">
                {phase.percent}%
              </p>
              <span className="text-[10px] text-slate-500 font-mono block">
                {phase.tokensAmount.toLocaleString()} tokens
              </span>
            </div>
          ))}
        </div>
      </div>

      {pool?.exists && pool.pairId ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-xs text-slate-400">
          <span>
            {grad.graduated
              ? `🎓 ${symbol} reached the target and is operating with deep liquidity on Soroswap!`
              : `${(grad.targetXlm - grad.currentXlm).toLocaleString('en-US', { maximumFractionDigits: 1 })} XLM remaining in purchases to reach 100% graduation.`}
          </span>
          <div className="flex flex-wrap gap-2">
            <a
              href={SOROSWAP_APP_URL}
              target="_blank"
              rel="noreferrer"
              className="rounded-md border border-emerald-800 bg-emerald-950/40 px-2.5 py-1 font-medium text-emerald-300 hover:border-emerald-600"
            >
              Soroswap DEX ↗
            </a>
            <a
              href={explorerContractUrl(pool.pairId)}
              target="_blank"
              rel="noreferrer"
              className="rounded-md border border-slate-700 px-2.5 py-1 text-slate-300 hover:border-slate-500"
            >
              Pair Contract ↗
            </a>
          </div>
        </div>
      ) : null}
    </section>
  )
}
