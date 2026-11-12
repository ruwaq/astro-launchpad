import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useSoroswapPool } from '../hooks/useSoroswapPool'
import { useTokenBalance } from '../hooks/useTokenBalance'
import { useXlmBalance } from '../hooks/useXlmBalance'
import {
  errorMessage,
  formatAmount,
  parseAmount,
} from '../lib/format'
import {
  localQuoteTokenForXlm,
  localQuoteXlmForToken,
  priceImpactPercent,
  SLIPPAGE_OPTIONS,
  SLIPPAGE_PERCENT,
  swapTokenForXlm,
  swapXlmForToken,
  withSlippage,
} from '../lib/soroswap'
import { AMOUNT_PERCENTS, FORM_INPUT_CLASS, UNSUPPORTED_SIGNER_MESSAGE } from '../lib/constants'
import { explorerTxUrl } from '../lib/explorer'
import { XLM_DECIMALS, XLM_FEE_BUFFER, xlmToStroops } from '../lib/xlm'
import type { LaunchpadToken } from '../lib/token'
import { useWallet } from '../store/wallet'
import { recordActivity } from '../store/activity'
import { toast } from '../lib/toast'
import { TxProgress } from './TxProgress'

const inputClass = FORM_INPUT_CLASS

type Direction = 'sell' | 'buy'

type SwapDone = {
  direction: Direction
  in: bigint
  out: bigint
  hash?: string
}

const QUICK_XLM_AMOUNTS = ['5', '10', '25', '100'] as const

function impactClass(impact: number): string {
  if (impact >= 5) return 'text-rose-300'
  if (impact >= 2) return 'text-amber-300'
  return 'text-slate-400'
}

/**
 * Buy or Sell a token against XLM using the Soroswap pair.
 */
export function SwapCard({
  token,
  onSwapped,
  onOpenLiquidityTools,
}: {
  token: LaunchpadToken
  onSwapped?: () => void
  onOpenLiquidityTools?: () => void
}) {
  const { publicKey, getSigner, connect, startDemo, demoPending, pending } = useWallet()
  const queryClient = useQueryClient()
  const [direction, setDirection] = useState<Direction>('buy')
  const [amount, setAmount] = useState('10')
  const [slippage, setSlippage] = useState<number>(SLIPPAGE_PERCENT)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [swapped, setSwapped] = useState<SwapDone | null>(null)

  const isBuy = direction === 'buy'
  const tokenSymbol = token.symbol ?? 'TOKEN'
  const inputDecimals = isBuy ? XLM_DECIMALS : token.decimals
  const outputDecimals = isBuy ? token.decimals : XLM_DECIMALS
  const inputSymbol = isBuy ? 'XLM' : tokenSymbol
  const outputSymbol = isBuy ? tokenSymbol : 'XLM'

  const pool = useSoroswapPool(token.id)
  const tokenBalance = useTokenBalance(publicKey, token.id)
  const xlmBalance = useXlmBalance(publicKey)

  const xlmBase =
    xlmBalance.data !== undefined
      ? xlmToStroops(xlmBalance.data)
      : undefined
  const inputBalanceBase = isBuy ? xlmBase : tokenBalance.data
  const maxInput =
    isBuy && xlmBase !== undefined
      ? xlmBase > XLM_FEE_BUFFER
        ? xlmBase - XLM_FEE_BUFFER
        : 0n
      : inputBalanceBase

  const amountIn = parseAmount(amount, inputDecimals)

  // Instant deterministic 0ms AMM quote matching Soroswap router (997/1000 fee).
  const quoted =
    amountIn > 0n && pool.data?.exists
      ? isBuy
        ? localQuoteXlmForToken(amountIn, pool.data)
        : localQuoteTokenForXlm(amountIn, pool.data)
      : undefined
  const minimum = quoted !== undefined ? withSlippage(quoted, slippage) : null
  const impact =
    pool.data?.exists && quoted !== undefined && amountIn > 0n
      ? priceImpactPercent(
          amountIn,
          quoted,
          isBuy ? pool.data.reserveXlm : pool.data.reserveToken,
          isBuy ? pool.data.reserveToken : pool.data.reserveXlm,
        )
      : null

  function changeDirection(next: Direction) {
    if (busy || next === direction) return
    setDirection(next)
    setAmount('')
    setError(null)
    setSwapped(null)
  }

  async function onSwap(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setSwapped(null)

    if (!publicKey) {
      setError('Connect your wallet or activate demo mode to execute a swap.')
      return
    }
    const signer = getSigner()
    if (!signer) {
      setError(UNSUPPORTED_SIGNER_MESSAGE)
      return
    }
    if (amountIn <= 0n) {
      setError('Please enter an amount greater than 0.')
      return
    }
    const MAX_SAFE_SWAP_AMOUNT = 10n ** 30n
    if (amountIn > MAX_SAFE_SWAP_AMOUNT) {
      setError('Amount is too large. Please enter a smaller trade amount.')
      return
    }
    if (inputBalanceBase !== undefined && amountIn > inputBalanceBase) {
      setError(
        isBuy
          ? 'Insufficient XLM balance for this purchase.'
          : `Insufficient ${tokenSymbol} balance for this sale.`,
      )
      return
    }
    if (
      isBuy &&
      inputBalanceBase !== undefined &&
      amountIn + XLM_FEE_BUFFER > inputBalanceBase
    ) {
      setError('Leave at least 1 XLM for transaction fees and minimum balance.')
      return
    }
    if (!isBuy && xlmBase !== undefined && xlmBase < XLM_FEE_BUFFER) {
      setError('Leave at least 1 XLM in your wallet to cover transaction fees.')
      return
    }

    const quotedAmount = quoted ?? 0n
    if (quotedAmount <= 0n) {
      setError(
        pool.isPending
          ? 'Loading pool reserves; please wait a moment.'
          : 'No quote available for that amount (pool may lack sufficient liquidity).',
      )
      return
    }

    setBusy(true)
    let hash: string | undefined
    try {
      const amounts = isBuy
        ? await swapXlmForToken({
            tokenId: token.id,
            amountIn,
            amountOutMin: withSlippage(quotedAmount, slippage),
            signer,
            onHash: (value) => {
              hash = value
            },
          })
        : await swapTokenForXlm({
            tokenId: token.id,
            amountIn,
            amountOutMin: withSlippage(quotedAmount, slippage),
            signer,
            onHash: (value) => {
              hash = value
            },
          })

      const received = amounts[1] ?? quotedAmount
      const inFormatted = formatAmount(amountIn, inputDecimals)
      const outFormatted = formatAmount(received, outputDecimals)
      setSwapped({ direction, in: amountIn, out: received, hash })
      setAmount('')
      recordActivity({
        kind: 'swap',
        tokenId: token.id,
        tokenSymbol,
        amount: isBuy ? outFormatted : inFormatted,
        secondaryAmount: isBuy ? inFormatted : outFormatted,
        secondarySymbol: 'XLM',
        swapDirection: direction,
        detail: isBuy ? 'buy' : 'sell',
        account: publicKey,
        hash,
      })
      toast.success('Swap completed', {
        message: `${inFormatted} ${inputSymbol} → ${outFormatted} ${outputSymbol}`,
        hash,
      })
      onSwapped?.()
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['soroswap-pool', token.id],
        }),
        queryClient.invalidateQueries({
          queryKey: ['token-events', token.id],
        }),
        queryClient.invalidateQueries({
          queryKey: ['token-balance', token.id],
        }),
        queryClient.invalidateQueries({
          queryKey: ['xlm-balance', publicKey],
        }),
        queryClient.invalidateQueries({
          queryKey: ['token-list'],
          refetchType: 'none',
        }),
        queryClient.invalidateQueries({ queryKey: ['demo-xlm-balances'] }),
      ])
    } catch (err) {
      const message = errorMessage(err)
      setError(message)
      if (message === 'Transaction cancelled in wallet.') {
        toast.info('Swap cancelled', {
          message: 'You cancelled the transaction in your wallet.',
        })
      } else {
        recordActivity({
          kind: 'swap',
          status: 'failed',
          tokenId: token.id,
          tokenSymbol,
          amount: formatAmount(amountIn, inputDecimals),
          swapDirection: direction,
          detail: isBuy ? 'failed buy' : 'failed sell',
          account: publicKey,
          error: message,
        })
        toast.error('Swap failed', { message })
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 sm:p-5">
      <h2 className="sr-only">Swap with XLM</h2>

      <div
        role="group"
        aria-label="Swap direction"
        className="grid grid-cols-2 gap-1.5 rounded-xl border border-slate-800 bg-slate-950/70 p-1.5"
      >
        <button
          type="button"
          aria-pressed={isBuy}
          disabled={busy}
          onClick={() => changeDirection('buy')}
          className={`min-h-[44px] rounded-lg text-sm font-bold transition-all ${
            isBuy
              ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/25'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
          }`}
        >
          Buy with XLM 🟢
        </button>
        <button
          type="button"
          aria-pressed={!isBuy}
          disabled={busy}
          onClick={() => changeDirection('sell')}
          className={`min-h-[44px] rounded-lg text-sm font-bold transition-all ${
            !isBuy
              ? 'bg-rose-500 text-slate-950 shadow-md shadow-rose-500/25'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
          }`}
        >
          Sell Token 🔴
        </button>
      </div>

      {pool.data?.exists ? (
        <p className="mt-3 text-xs text-slate-400 flex items-center justify-between">
          <span>Pool Reserves:</span>
          <span className="font-mono text-slate-300">
            {formatAmount(pool.data.reserveToken, token.decimals)} {tokenSymbol} ·{' '}
            {formatAmount(pool.data.reserveXlm, 7)} XLM
          </span>
        </p>
      ) : pool.isPending ? (
        <p className="mt-3 text-xs text-slate-400 animate-pulse">
          Checking Soroswap pool reserves…
        </p>
      ) : (
        <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-950/20 p-3 text-center">
          <p className="text-xs font-semibold text-amber-200">
            This token has no pair with XLM yet: seed liquidity first.
          </p>
          <p className="mt-1 text-[11px] text-slate-400">
            Be the first participant to initialize the AMM pool.
          </p>
          <a
            href="#advanced-tools"
            onClick={() => onOpenLiquidityTools?.()}
            className="mt-2 inline-flex min-h-[36px] items-center gap-1.5 rounded-lg bg-amber-400 px-3.5 py-1 text-xs font-bold text-slate-950 hover:bg-amber-300"
          >
            ⚡ Open Seed Liquidity Tool
          </a>
        </div>
      )}

      <form onSubmit={onSwap} aria-busy={busy} className="mt-4 grid gap-3">
        <label className="block text-sm">
          <div className="flex items-center justify-between">
            <span className="text-slate-300 font-medium">
              {isBuy ? 'Amount in XLM' : `Amount in ${tokenSymbol}`}
            </span>
            {amount ? (
              <button
                type="button"
                onClick={() => setAmount('')}
                className="text-[11px] text-slate-400 hover:text-slate-200 underline"
              >
                Clear
              </button>
            ) : null}
          </div>
          <input
            className={`${inputClass} mt-1`}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={isBuy ? 'e.g. 10' : 'e.g. 500000'}
            inputMode="decimal"
          />
        </label>

        {/* Quick Amount Chips */}
        <div className="flex flex-wrap items-center justify-between gap-1.5 text-xs text-slate-400">
          <span>
            {isBuy ? 'Balance' : 'Your Token'}:{' '}
            <span className="font-mono text-slate-200 font-semibold">
              {publicKey && inputBalanceBase !== undefined
                ? formatAmount(inputBalanceBase, inputDecimals)
                : '—'}
            </span>
          </span>

          <div className="flex flex-wrap gap-1">
            {isBuy ? (
              <>
                {QUICK_XLM_AMOUNTS.map((quickXlm) => (
                  <button
                    key={quickXlm}
                    type="button"
                    disabled={busy}
                    onClick={() => setAmount(quickXlm)}
                    className="inline-flex min-h-[32px] items-center rounded-md border border-slate-800 bg-slate-950/80 px-2 py-1 text-xs font-semibold text-emerald-300 hover:border-emerald-500 hover:bg-emerald-950/30 transition-colors"
                  >
                    {quickXlm} XLM
                  </button>
                ))}
                {maxInput !== undefined && maxInput > 0n ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setAmount(formatAmount(maxInput, inputDecimals))}
                    className="inline-flex min-h-[32px] items-center rounded-md border border-emerald-800/80 bg-emerald-950/40 px-2 py-1 text-xs font-bold text-emerald-200 hover:border-emerald-500 transition-colors"
                  >
                    MAX
                  </button>
                ) : null}
              </>
            ) : (
              AMOUNT_PERCENTS.map((pct) => {
                const slice =
                  maxInput !== undefined ? (maxInput * BigInt(pct)) / 100n : 0n
                return (
                  <button
                    key={pct}
                    type="button"
                    disabled={maxInput === undefined || maxInput <= 0n || busy}
                    onClick={() => {
                      if (slice > 0n) {
                        setAmount(formatAmount(slice, inputDecimals))
                      }
                    }}
                    className="inline-flex min-h-[32px] items-center rounded-md border border-slate-800 bg-slate-950/80 px-2 py-1 text-xs font-semibold text-rose-300 hover:border-rose-500 hover:bg-rose-950/30 transition-colors disabled:opacity-50"
                  >
                    {pct === 100 ? 'MAX' : `${pct}%`}
                  </button>
                )
              })
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
          <span>Slippage Tolerance</span>
          <div
            role="group"
            aria-label="Slippage tolerance"
            className="flex gap-1"
          >
            {SLIPPAGE_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={slippage === option}
                disabled={busy}
                onClick={() => setSlippage(option)}
                className={`min-h-[32px] rounded-md border px-2.5 py-1 font-mono text-xs transition-colors ${
                  slippage === option
                    ? 'border-emerald-500 bg-emerald-500/15 font-medium text-emerald-300'
                    : 'border-slate-800 bg-slate-950/40 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                {option}%
              </button>
            ))}
          </div>
        </div>

        {amountIn > 0n && pool.data?.exists ? (
          <div className="grid gap-1 text-sm text-slate-300">
            <p>
              You receive ≈{' '}
              <span className="font-medium text-emerald-400">
                {quoted !== undefined
                  ? `${formatAmount(quoted, outputDecimals)} ${outputSymbol}`
                  : 'quoting…'}
              </span>
            </p>

            {quoted !== undefined && quoted > 0n && impact !== null ? (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800/80 bg-slate-950/40 px-3 py-2 text-xs">
                <span className="text-slate-400">
                  Min received: <strong className="font-mono text-slate-200">{formatAmount(minimum ?? 0n, outputDecimals)} {outputSymbol}</strong>
                </span>
                <span className="text-slate-400">
                  Impact: <strong className={`font-mono ${impactClass(impact)}`}>{impact.toFixed(1)}%</strong>
                  {impact >= 15 ? (
                    <span className="ml-1 text-rose-400 font-bold">⚠️ High</span>
                  ) : null}
                </span>
              </div>
            ) : null}
          </div>
        ) : null}

        <div>
          {!publicKey ? (
            <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
              <button
                type="button"
                disabled={pending}
                onClick={() => void connect().catch((err) => toast.error('Failed to connect wallet', { message: errorMessage(err) }))}
                className="min-h-[48px] w-full rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 px-6 py-3.5 text-base font-black text-slate-950 shadow-lg shadow-amber-500/25 transition-all active:scale-[0.99] disabled:opacity-60"
              >
                {pending ? 'Connecting…' : '🔌 Connect Wallet to Trade'}
              </button>
              <button
                type="button"
                disabled={demoPending || pending}
                onClick={() => void startDemo().catch((err) => toast.error('Failed to start demo', { message: errorMessage(err) }))}
                className="min-h-[48px] rounded-xl border border-sky-500/40 bg-sky-500/10 px-4 py-3 text-xs font-bold text-sky-200 hover:bg-sky-500/20 disabled:opacity-60"
              >
                {demoPending ? 'Funding…' : 'Testnet Demo'}
              </button>
            </div>
          ) : !pool.data?.exists ? null : (
            <button
              type="submit"
              disabled={busy || amountIn <= 0n}
              className={`min-h-[48px] w-full rounded-xl px-6 py-3.5 text-base font-black transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed ${
                isBuy
                  ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/25 active:scale-[0.99]'
                  : 'bg-rose-500 hover:bg-rose-400 text-slate-950 shadow-rose-500/25 active:scale-[0.99]'
              }`}
            >
              {busy
                ? 'Executing on-chain…'
                : isBuy
                  ? `🚀 Quick Buy ${tokenSymbol} Now`
                  : `💰 Quick Sell ${tokenSymbol} for XLM`}
            </button>
          )}
          <div className="mt-2.5 flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span>Slippage: {slippage}%</span>
            <span className="text-emerald-400 font-semibold">Soroswap Protected</span>
          </div>
        </div>

        {busy ? (
          <TxProgress
            steps={[
              {
                label: isBuy
                  ? 'Signing and submitting buy order to router'
                  : 'Signing and submitting sell order to router',
                status: 'active',
              },
            ]}
          />
        ) : null}
      </form>

      {error ? (
        <p
          role="alert"
          className="mt-4 rounded-lg border border-rose-900 bg-rose-950/40 px-3 py-2 text-sm text-rose-300"
        >
          {error}
        </p>
      ) : null}

      {swapped ? (
        <div className="mt-4 rounded-lg border border-emerald-900 bg-emerald-950/40 px-3 py-2 text-sm text-emerald-300">
          <p>
            Swap executed ✓{' '}
            {formatAmount(
              swapped.in,
              swapped.direction === 'buy' ? XLM_DECIMALS : token.decimals,
            )}{' '}
            {swapped.direction === 'buy' ? 'XLM' : tokenSymbol} →{' '}
            {formatAmount(
              swapped.out,
              swapped.direction === 'buy' ? token.decimals : XLM_DECIMALS,
            )}{' '}
            {swapped.direction === 'buy' ? tokenSymbol : 'XLM'}
          </p>
          {swapped.hash ? (
            <a
              href={explorerTxUrl(swapped.hash)}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-block text-xs underline underline-offset-2"
            >
              View on Stellar Explorer ↗
            </a>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
