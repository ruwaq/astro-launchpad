import { useQuery } from '@tanstack/react-query'
import {
  auditTokenSecurity,
  CREATOR_GRADUATION_REWARD_XLM,
  graduationProgress,
  PROTOCOL_DEPLOY_FEE_XLM,
  PROTOCOL_GRADUATION_FEE_XLM,
  SOROSWAP_SWAP_FEE_PERCENT,
} from '../lib/tokenomics'
import { explorerAccountUrl, explorerContractUrl } from '../lib/explorer'
import { fetchBurnedLpInfo, type PoolState } from '../lib/soroswap'
import { STELLAR_BURN_ADDRESS } from '../lib/tokenomics'

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
    <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold">
              Liquidity Curve & Graduation
            </h2>
            <span
              className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                grad.graduated
                  ? 'border-emerald-500 bg-emerald-500/20 text-emerald-200'
                  : 'border-slate-700 bg-slate-950/60 text-slate-300'
              }`}
            >
              {grad.label}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Fair Launch mechanics on Stellar: every buy injects XLM directly
            into the Soroswap pool reserve, ascending the constant-product curve{' '}
            <code className="text-slate-300">x · y = k</code> until graduating to deep DEX status.
          </p>
        </div>

        <div className="text-right font-mono">
          <span className="text-lg font-bold text-emerald-400">
            {grad.percent.toFixed(1)}%
          </span>
          <p className="text-xs text-slate-400">
            {grad.currentXlm.toLocaleString('en-US', {
              maximumFractionDigits: 2,
            })}{' '}
            / {grad.targetXlm.toLocaleString('en-US')} XLM
          </p>
        </div>
      </div>

      <div
        role="progressbar"
        aria-valuenow={Math.round(grad.percent)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Progress towards graduation on Soroswap DEX"
        className="mt-3 h-3 w-full overflow-hidden rounded-full border border-slate-800 bg-slate-950"
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-300 transition-all duration-500"
          style={{ width: `${Math.min(100, Math.max(2, grad.percent))}%` }}
        />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div
          className={`rounded-lg border p-3 text-xs ${
            audit.ownershipRenounced
              ? 'border-emerald-900/70 bg-emerald-950/20 text-emerald-200'
              : 'border-amber-900/70 bg-amber-950/20 text-amber-200'
          }`}
        >
          <p className="font-semibold">
            {audit.ownershipRenounced
              ? '✓ Immutable Supply (No Owner)'
              : '⚠️ Active Owner (Mint Enabled)'}
          </p>
          <p className="mt-1 opacity-80">
            {audit.ownershipRenounced
              ? 'Creator renounced the contract: nobody can ever mint more tokens.'
              : 'Creator has not renounced ownership and could inflate supply.'}
          </p>
        </div>

        <div
          className={`rounded-lg border p-3 text-xs ${
            lpIsLocked
              ? 'border-emerald-900/70 bg-emerald-950/20 text-emerald-200'
              : 'border-slate-800 bg-slate-950/50 text-slate-300'
          }`}
        >
          <p className="font-semibold">
            {lpIsLocked
              ? `🔥 LP Burned On-Chain (${burnedPercent.toFixed(1)}%)`
              : `🔒 Burned Liquidity: ${burnedPercent.toFixed(1)}%`}
          </p>
          <p className="mt-1 opacity-80">
            {lpIsLocked ? (
              <>
                LP permanently transferred to Stellar dead address{' '}
                <a
                  href={explorerAccountUrl(STELLAR_BURN_ADDRESS)}
                  target="_blank"
                  rel="noreferrer"
                  className="underline hover:text-emerald-100"
                >
                  GAAAA...WHF ↗
                </a>
                : zero rug-pull risk.
              </>
            ) : (
              'Initial LP tokens are automatically burned to the dead account on Fair Launch.'
            )}
          </p>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3 text-xs text-slate-300">
          <p className="font-semibold text-slate-200">
            Curve / DEX Reserve:{' '}
            <span className="font-mono text-emerald-400">
              {audit.poolSupplyPercent.toFixed(1)}%
            </span>
          </p>
          <p className="mt-1 text-slate-400">
            79% curve sale + 20% DEX cushion (99% pool) and 1% max creator allocation.
          </p>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3 text-xs text-slate-300">
          <p className="font-semibold text-emerald-300">
            💎 Economics & Earning ({SOROSWAP_SWAP_FEE_PERCENT}% LP fee)
          </p>
          <p className="mt-1 text-slate-400">
            Swaps leave {SOROSWAP_SWAP_FEE_PERCENT}% fee in pool. Protocol:{' '}
            {PROTOCOL_DEPLOY_FEE_XLM} XLM mint · {PROTOCOL_GRADUATION_FEE_XLM}{' '}
            XLM graduation (+{CREATOR_GRADUATION_REWARD_XLM} XLM creator reward).
          </p>
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
              href="https://app.soroswap.finance"
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
