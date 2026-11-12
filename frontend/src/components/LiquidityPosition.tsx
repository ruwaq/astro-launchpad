import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useLpPosition } from '../hooks/useLpPosition'
import { errorMessage, formatAmount, shortAddress } from '../lib/format'
import {
  lpSharePercent,
  withdrawLiquidity,
  withdrawPreview,
} from '../lib/soroswap'
import type { LaunchpadToken } from '../lib/token'
import { useWallet } from '../store/wallet'
import { recordActivity } from '../store/activity'
import { toast } from '../lib/toast'
import { TxProgress } from './TxProgress'

const PERCENTS = [25, 50, 100] as const
type Percent = (typeof PERCENTS)[number]

const LP_DECIMALS = 7

/**
 * User's liquidity position in the selected token pair.
 */
export function LiquidityPosition({ token }: { token: LaunchpadToken }) {
  const { publicKey, getSigner } = useWallet()
  const queryClient = useQueryClient()
  const position = useLpPosition(token.id, publicKey)
  const [percent, setPercent] = useState<Percent>(100)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [withdrawn, setWithdrawn] = useState<{
    tokenAmount: bigint
    xlmAmount: bigint
    lpAmount: bigint
  } | null>(null)

  const data = position.data
  const hasPosition = Boolean(publicKey && data && data.lpBalance > 0n)
  if (!hasPosition && !withdrawn) return null

  const lpAmount = data ? (data.lpBalance * BigInt(percent)) / 100n : 0n
  const preview = data
    ? withdrawPreview(data, lpAmount)
    : { tokenAmount: 0n, xlmAmount: 0n }
  const share = data ? lpSharePercent(data.lpBalance, data.totalSupply) : 0

  async function onWithdraw() {
    setError(null)
    setWithdrawn(null)
    if (!publicKey || !data) return
    if (lpAmount <= 0n) {
      setError('No LP tokens available to withdraw.')
      return
    }
    const signer = getSigner()
    if (!signer) {
      setError('Unable to prepare signer for the active account.')
      return
    }

    setBusy(true)
    let hash: string | undefined
    try {
      const result = await withdrawLiquidity({
        tokenId: token.id,
        lpAmount,
        signer,
        onHash: (value) => {
          hash = value
        },
      })
      setWithdrawn({ ...result, lpAmount })
      recordActivity({
        kind: 'remove-liquidity',
        tokenId: token.id,
        tokenSymbol: token.symbol,
        amount: formatAmount(result.tokenAmount, token.decimals),
        secondaryAmount: formatAmount(result.xlmAmount, 7),
        secondarySymbol: 'XLM',
        detail: `${formatAmount(lpAmount, LP_DECIMALS)} LP burned`,
        account: publicKey,
        hash,
      })
      toast.success('Liquidity withdrawn', {
        message: `${formatAmount(result.tokenAmount, token.decimals)} ${token.symbol ?? 'TOKEN'} + ${formatAmount(result.xlmAmount, 7)} XLM`,
        hash,
      })
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['soroswap-pool', token.id],
        }),
        queryClient.invalidateQueries({
          queryKey: ['lp-position', token.id],
        }),
        queryClient.invalidateQueries({
          queryKey: ['token-balance', token.id],
        }),
        queryClient.invalidateQueries({
          queryKey: ['token-events', token.id],
        }),
        queryClient.invalidateQueries({
          queryKey: ['token-list'],
          refetchType: 'none',
        }),
        queryClient.invalidateQueries({
          queryKey: ['demo-xlm-balances'],
        }),
      ])
    } catch (err) {
      const message = errorMessage(err)
      setError(message)
      recordActivity({
        kind: 'remove-liquidity',
        status: 'failed',
        tokenId: token.id,
        tokenSymbol: token.symbol,
        amount: formatAmount(preview.tokenAmount, token.decimals),
        secondaryAmount: formatAmount(preview.xlmAmount, 7),
        secondarySymbol: 'XLM',
        detail: `${formatAmount(lpAmount, LP_DECIMALS)} LP`,
        account: publicKey,
        error: message,
      })
      toast.error('Failed to withdraw liquidity', { message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section
      aria-busy={busy}
      className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 sm:p-6"
    >
      <h2 className="text-lg font-semibold">
        Your Liquidity · {shortAddress(token.id)}
      </h2>

      {hasPosition && data ? (
        <>
          <p className="mt-1 text-sm text-slate-400">
            You hold {formatAmount(data.lpBalance, LP_DECIMALS)} LP (
            {share.toFixed(2)}% of the pool). LP tokens are burned on withdrawal
            to return both assets along with accrued fees.
          </p>

          <div role="group" aria-label="Withdrawal percentage" className="mt-4 flex flex-wrap gap-2">
            {PERCENTS.map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={percent === option}
                onClick={() => setPercent(option)}
                className={`min-h-[44px] rounded-lg border px-4 py-2 text-sm font-medium ${
                  percent === option
                    ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300'
                    : 'border-slate-700 text-slate-300 hover:border-slate-500'
                }`}
              >
                {option === 100 ? '100% (Max)' : `${option}%`}
              </button>
            ))}
          </div>

          <p className="mt-3 text-sm text-slate-300">
            You receive ≈{' '}
            <span className="font-medium text-emerald-400">
              {formatAmount(preview.tokenAmount, token.decimals)} {token.symbol ?? 'TOKEN'} +{' '}
              {formatAmount(preview.xlmAmount, 7)} XLM
            </span>
          </p>

          <button
            type="button"
            onClick={onWithdraw}
            disabled={busy}
            className="mt-4 w-full rounded-lg bg-emerald-500 px-6 py-3 text-base font-medium text-slate-950 hover:bg-emerald-400 disabled:opacity-60 sm:w-auto"
          >
            {busy
              ? 'Withdrawing…'
              : `Withdraw ${percent === 100 ? '100%' : `${percent}%`} · ${formatAmount(lpAmount, LP_DECIMALS)} LP`}
          </button>

          {busy ? (
            <div className="mt-4">
              <TxProgress
                steps={[
                  {
                    label: 'Burning LP tokens and returning underlying assets',
                    status: 'active',
                  },
                ]}
              />
            </div>
          ) : null}
        </>
      ) : null}

      {error ? (
        <p
          role="alert"
          className="mt-4 rounded-lg border border-rose-900 bg-rose-950/40 px-3 py-2 text-sm text-rose-300"
        >
          {error}
        </p>
      ) : null}

      {withdrawn ? (
        <div
          role="status"
          className="mt-4 space-y-1 rounded-lg border border-emerald-900 bg-emerald-950/40 px-3 py-2 text-sm text-emerald-300"
        >
          <p className="font-medium">Liquidity Withdrawn ✓</p>
          <p>
            Received {formatAmount(withdrawn.tokenAmount, token.decimals)} {token.symbol ?? 'TOKEN'}
            + {formatAmount(withdrawn.xlmAmount, 7)} XLM · burned{' '}
            {formatAmount(withdrawn.lpAmount, LP_DECIMALS)} LP
          </p>
          {!hasPosition ? <p>You have no remaining LP tokens in this pair.</p> : null}
        </div>
      ) : null}
    </section>
  )
}
