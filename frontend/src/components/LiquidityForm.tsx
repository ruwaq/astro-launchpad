import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { addLiquidity } from '../lib/soroswap'
import { errorMessage, formatAmount, parseAmount, shortAddress } from '../lib/format'
import { explorerContractUrl } from '../lib/explorer'
import { useTokenBalance } from '../hooks/useTokenBalance'
import { useSoroswapPool } from '../hooks/useSoroswapPool'
import { useXlmBalance } from '../hooks/useXlmBalance'
import { XLM_DECIMALS, XLM_FEE_BUFFER, xlmToStroops } from '../lib/xlm'
import { ShareButton } from './ShareButton'
import type { LaunchpadToken } from '../lib/token'
import { useWallet } from '../store/wallet'
import { recordActivity } from '../store/activity'
import { toast } from '../lib/toast'
import { TxProgress } from './TxProgress'

const inputClass =
  'w-full rounded-lg border border-slate-800 bg-slate-950 px-3.5 py-3 text-base text-slate-100 outline-none focus:border-emerald-500'

const AMOUNT_PERCENTS = [25, 50, 75, 100] as const

/**
 * Adds liquidity to the token/XLM pair on Soroswap AMM.
 */
export function LiquidityForm({
  token,
  onAdded,
}: {
  token: LaunchpadToken
  onAdded?: () => void
}) {
  const { publicKey, getSigner } = useWallet()
  const queryClient = useQueryClient()
  const balance = useTokenBalance(publicKey, token.id)
  const pool = useSoroswapPool(token.id)
  const xlmBalance = useXlmBalance(publicKey)
  const xlmBase =
    xlmBalance.data !== undefined ? xlmToStroops(xlmBalance.data) : undefined
  const maxXlm =
    xlmBase !== undefined
      ? xlmBase > XLM_FEE_BUFFER
        ? xlmBase - XLM_FEE_BUFFER
        : 0n
      : undefined
  const hasExistingPool = Boolean(
    pool.data?.exists &&
      pool.data.reserveToken > 0n &&
      pool.data.reserveXlm > 0n,
  )
  const [syncRatio, setSyncRatio] = useState(true)
  const [amountToken, setAmountToken] = useState('')
  const [amountXlm, setAmountXlm] = useState('')
  const [busy, setBusy] = useState(false)
  const [phase, setPhase] = useState<'pair' | 'liquidity' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [lp, setLp] = useState<
    | { pair: string; tokenAmount: bigint; xlmAmount: bigint; lpAmount: bigint }
    | null
  >(null)

  function updateTokenAmount(next: string) {
    setAmountToken(next)
    if (hasExistingPool && syncRatio && pool.data) {
      const parsed = parseAmount(next, token.decimals)
      if (parsed > 0n) {
        const matchingXlm =
          (parsed * pool.data.reserveXlm) / pool.data.reserveToken
        setAmountXlm(formatAmount(matchingXlm, XLM_DECIMALS))
      } else if (!next.trim()) {
        setAmountXlm('')
      }
    }
  }

  function updateXlmAmount(next: string) {
    setAmountXlm(next)
    if (hasExistingPool && syncRatio && pool.data) {
      const parsed = parseAmount(next, XLM_DECIMALS)
      if (parsed > 0n) {
        const matchingToken =
          (parsed * pool.data.reserveToken) / pool.data.reserveXlm
        setAmountToken(formatAmount(matchingToken, token.decimals))
      } else if (!next.trim()) {
        setAmountToken('')
      }
    }
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setLp(null)

    if (!publicKey) {
      setError('Connect your wallet or activate demo mode to add liquidity.')
      return
    }
    const signer = getSigner()
    if (!signer) {
      setError('Unable to prepare signer for the active account.')
      return
    }
    const tokenDesired = parseAmount(amountToken, token.decimals)
    const xlmDesired = parseAmount(amountXlm, 7)
    if (tokenDesired <= 0n || xlmDesired <= 0n) {
      setError('Enter amounts greater than 0 for both assets.')
      return
    }
    if (balance.data !== undefined && tokenDesired > balance.data) {
      setError('Insufficient token balance.')
      return
    }
    if (xlmBase !== undefined && xlmDesired > xlmBase) {
      setError('Insufficient XLM balance.')
      return
    }
    if (xlmBase !== undefined && xlmDesired + XLM_FEE_BUFFER > xlmBase) {
      setError('Leave at least 1 XLM free for transaction fees and minimum network reserve.')
      return
    }

    setBusy(true)
    setPhase('pair')
    let hash: string | undefined
    try {
      const result = await addLiquidity({
        tokenId: token.id,
        amountToken: tokenDesired,
        amountXlm: xlmDesired,
        signer,
        onStep: setPhase,
        onHash: (value) => {
          hash = value
        },
      })
      setLp(result)
      setAmountToken('')
      setAmountXlm('')
      recordActivity({
        kind: 'add-liquidity',
        tokenId: token.id,
        tokenSymbol: token.symbol,
        amount: formatAmount(result.tokenAmount, token.decimals),
        secondaryAmount: formatAmount(result.xlmAmount, 7),
        secondarySymbol: 'XLM',
        detail: `${formatAmount(result.lpAmount, 7)} LP`,
        account: publicKey,
        hash,
      })
      toast.success('Liquidity added', {
        message: `${formatAmount(result.lpAmount, 7)} LP · pair ${shortAddress(result.pair)}`,
        hash,
      })
      onAdded?.()
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['soroswap-pool', token.id],
        }),
        queryClient.invalidateQueries({ queryKey: ['token-list'] }),
        queryClient.invalidateQueries({
          queryKey: ['token-balance', token.id],
        }),
        queryClient.invalidateQueries({
          queryKey: ['token-events', token.id],
        }),
        queryClient.invalidateQueries({
          queryKey: ['lp-position', token.id],
        }),
        queryClient.invalidateQueries({
          queryKey: ['demo-xlm-balances'],
        }),
      ])
    } catch (err) {
      const message = errorMessage(err)
      setError(message)
      recordActivity({
        kind: 'add-liquidity',
        status: 'failed',
        tokenId: token.id,
        tokenSymbol: token.symbol,
        amount: formatAmount(tokenDesired, token.decimals),
        secondaryAmount: formatAmount(xlmDesired, 7),
        secondarySymbol: 'XLM',
        account: publicKey,
        error: message,
      })
      toast.error('Failed to add liquidity', { message })
    } finally {
      setBusy(false)
      setPhase(null)
    }
  }

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 sm:p-6">
      <h2 className="text-lg font-semibold">
        Add Liquidity · {shortAddress(token.id)}
      </h2>
      <p className="mt-1 text-sm text-slate-400">
        Seed the token/XLM pair on Soroswap. Your wallet signs each step on testnet.
      </p>
      <p className="mt-2 text-xs text-emerald-300">
        🔥 You own LP tokens: every trade yields a 0.30% swap fee accrued directly to pool reserves.
      </p>

      {hasExistingPool && pool.data ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2 text-xs text-slate-400">
          <span>
            Active Pool:{' '}
            <span className="font-mono text-slate-300">
              {formatAmount(pool.data.reserveToken, token.decimals)}{' '}
              {token.symbol ?? 'TOKEN'}
            </span>{' '}
            ·{' '}
            <span className="font-mono text-slate-300">
              {formatAmount(pool.data.reserveXlm, XLM_DECIMALS)} XLM
            </span>
          </span>
          <label className="inline-flex cursor-pointer items-center gap-1.5 text-emerald-300">
            <input
              type="checkbox"
              checked={syncRatio}
              onChange={(e) => setSyncRatio(e.target.checked)}
              className="rounded border-slate-700 bg-slate-900 text-emerald-500"
            />
            <span>Maintain pool ratio</span>
          </label>
        </div>
      ) : null}

      <form
        onSubmit={onSubmit}
        aria-busy={busy}
        className="mt-4 grid gap-4 sm:grid-cols-2"
      >
        <div className="space-y-2">
          <label className="block text-sm">
            <span className="text-slate-400">
              Token Amount ({token.decimals} dec)
            </span>
            <input
              className={`${inputClass} mt-1`}
              value={amountToken}
              onChange={(e) => updateTokenAmount(e.target.value)}
              placeholder="100"
              inputMode="decimal"
            />
          </label>

          {publicKey && balance.data !== undefined ? (
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
              <span>
                Balance:{' '}
                <span className="font-mono text-slate-300">
                  {formatAmount(balance.data, token.decimals)}
                </span>
              </span>
              <div className="flex flex-wrap gap-1">
                {AMOUNT_PERCENTS.map((pct) => {
                  const slice = ((balance.data ?? 0n) * BigInt(pct)) / 100n
                  return (
                    <button
                      key={pct}
                      type="button"
                      disabled={busy || slice <= 0n}
                      onClick={() =>
                        updateTokenAmount(formatAmount(slice, token.decimals))
                      }
                      className="inline-flex min-h-[36px] items-center rounded-md border border-slate-800 bg-slate-950/60 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:border-emerald-500 disabled:opacity-50"
                    >
                      {pct === 100 ? 'MAX' : `${pct}%`}
                    </button>
                  )
                })}
              </div>
            </div>
          ) : null}
        </div>

        <div className="space-y-2">
          <label className="block text-sm">
            <span className="text-slate-400">XLM Amount (7 dec)</span>
            <input
              className={`${inputClass} mt-1`}
              value={amountXlm}
              onChange={(e) => updateXlmAmount(e.target.value)}
              placeholder="10"
              inputMode="decimal"
            />
          </label>

          {publicKey && xlmBase !== undefined ? (
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
              <span>
                Your XLM:{' '}
                <span className="font-mono text-slate-300">
                  {formatAmount(xlmBase, XLM_DECIMALS)}
                </span>
              </span>
              <div className="flex flex-wrap gap-1">
                {AMOUNT_PERCENTS.map((pct) => {
                  const slice =
                    maxXlm !== undefined ? (maxXlm * BigInt(pct)) / 100n : 0n
                  return (
                    <button
                      key={pct}
                      type="button"
                      disabled={busy || slice <= 0n}
                      onClick={() =>
                        updateXlmAmount(formatAmount(slice, XLM_DECIMALS))
                      }
                      className="inline-flex min-h-[36px] items-center rounded-md border border-slate-800 bg-slate-950/60 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:border-emerald-500 disabled:opacity-50"
                    >
                      {pct === 100 ? 'MAX' : `${pct}%`}
                    </button>
                  )
                })}
              </div>
            </div>
          ) : null}
        </div>

        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={busy || !publicKey}
            className="w-full rounded-lg bg-emerald-500 px-6 py-3 text-base font-medium text-slate-950 hover:bg-emerald-400 disabled:opacity-60 sm:w-auto"
          >
            {busy ? 'Adding liquidity…' : 'Create Pair + Deposit Liquidity'}
          </button>
        </div>
      </form>

      {busy && phase ? (
        <div className="mt-4">
          <TxProgress
            steps={[
              {
                label: 'Verifying or creating token/XLM pair',
                status: phase === 'liquidity' ? 'done' : 'active',
              },
              {
                label: 'Signing and depositing liquidity via router',
                status: phase === 'liquidity' ? 'active' : 'pending',
              },
            ]}
          />
        </div>
      ) : null}

      {error ? (
        <p
          role="alert"
          className="mt-4 rounded-lg border border-rose-900 bg-rose-950/40 px-3 py-2 text-sm text-rose-300"
        >
          {error}
        </p>
      ) : null}

      {lp ? (
        <div className="mt-4 space-y-1 rounded-lg border border-emerald-900 bg-emerald-950/40 px-3 py-2 text-sm text-emerald-300">
          <p className="font-medium">Liquidity Added ✓</p>
          <p>
            Pair: <span className="font-mono">{lp.pair}</span>
          </p>
          <p>
            Token deposited: {formatAmount(lp.tokenAmount, token.decimals)} · XLM
            deposited: {formatAmount(lp.xlmAmount, 7)} · LP tokens minted:{' '}
            {formatAmount(lp.lpAmount, 7)}
          </p>
          <div className="pt-1">
            <ShareButton
              text={`🚀 Live liquidity active on AstroGate 🌊🚀 (Stellar testnet)!`}
              url={explorerContractUrl(lp.pair)}
            />
          </div>
        </div>
      ) : null}
    </section>
  )
}
