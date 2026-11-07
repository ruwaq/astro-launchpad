import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSoroswapPool } from '../hooks/useSoroswapPool'
import { useTokenBalance } from '../hooks/useTokenBalance'
import { useXlmBalance } from '../hooks/useXlmBalance'
import {
  errorMessage,
  formatAmount,
  parseAmount,
  shortAddress,
} from '../lib/format'
import {
  priceImpactPercent,
  quoteTokenForXlm,
  quoteXlmForToken,
  SLIPPAGE_OPTIONS,
  SLIPPAGE_PERCENT,
  swapTokenForXlm,
  swapXlmForToken,
  withSlippage,
  type PoolState,
} from '../lib/soroswap'
import { explorerTxUrl } from '../lib/explorer'
import { XLM_DECIMALS, XLM_FEE_BUFFER, xlmToStroops } from '../lib/xlm'
import type { LaunchpadToken } from '../lib/token'
import { useWallet } from '../store/wallet'
import { useProgress } from '../store/progress'
import { recordActivity } from '../store/activity'
import { toast } from '../lib/toast'
import { TokenArt } from './TokenArt'
import { TxProgress } from './TxProgress'

const inputClass =
  'w-full rounded-lg border border-slate-800 bg-slate-950 px-3.5 py-3 text-base text-slate-100 outline-none focus:border-emerald-500'

type Direction = 'sell' | 'buy'

type SwapDone = {
  direction: Direction
  in: bigint
  out: bigint
  hash?: string
}

const AMOUNT_PERCENTS = [25, 50, 75, 100] as const
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
}: {
  token: LaunchpadToken
  onSwapped?: () => void
}) {
  const { publicKey, getSigner } = useWallet()
  const queryClient = useQueryClient()
  const markProgress = useProgress((state) => state.mark)
  const [direction, setDirection] = useState<Direction>('sell')
  const [amount, setAmount] = useState('')
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

  const quote = useQuery({
    queryKey: ['soroswap-quote', token.id, direction, amountIn.toString()],
    queryFn: () =>
      isBuy
        ? quoteXlmForToken(amountIn, pool.data as PoolState)
        : quoteTokenForXlm(amountIn, pool.data as PoolState),
    enabled: amountIn > 0n && Boolean(pool.data?.exists),
    staleTime: 5_000,
  })

  const quoted = quote.data
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
      setError('Unable to prepare signer for the active account.')
      return
    }
    if (amountIn <= 0n) {
      setError('Please enter an amount greater than 0.')
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

    const quotedAmount = quote.data ?? 0n
    if (quotedAmount <= 0n) {
      setError(
        'No quote available for that amount (pool may lack sufficient liquidity).',
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
      markProgress('swapped')
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
      recordActivity({
        kind: 'swap',
        status: 'failed',
        tokenId: token.id,
        tokenSymbol: isBuy ? 'XLM' : tokenSymbol,
        amount: formatAmount(amountIn, inputDecimals),
        swapDirection: direction,
        detail: isBuy ? 'failed buy' : 'failed sell',
        account: publicKey,
        error: message,
      })
      toast.error('Swap failed', { message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 sm:p-6">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <TokenArt
          id={token.id}
          symbol={token.symbol}
          className="h-9 w-9 shrink-0 rounded-lg"
        />
        <span className="min-w-0 truncate">
          Swap with XLM · {shortAddress(token.id)}
        </span>
      </h2>
      <p className="mt-1 text-sm text-slate-400">
        Trade {tokenSymbol} against native XLM on Soroswap AMM.
      </p>

      <div
        role="group"
        aria-label="Swap direction"
        className="mt-3 grid grid-cols-2 gap-1.5 rounded-xl border border-slate-800 bg-slate-950/70 p-1.5"
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
      ) : (
        <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-950/20 p-3 text-center">
          <p className="text-xs font-semibold text-amber-200">
            This token has no pair with XLM yet: seed liquidity first.
          </p>
          <p className="mt-1 text-[11px] text-slate-400">
            Be the first player to start the trading game!
          </p>
          <a
            href="#advanced-tools"
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
              <div className="grid gap-1 rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 text-xs">
                <div className="flex flex-wrap justify-between gap-2">
                  <span className="text-slate-500">
                    Minimum after slippage ({slippage}%)
                  </span>
                  <span className="font-mono text-slate-300">
                    {formatAmount(minimum ?? 0n, outputDecimals)} {outputSymbol}
                  </span>
                </div>
                <div className="flex flex-wrap justify-between gap-2">
                  <span className="text-slate-500">
                    Price impact (includes fee)
                  </span>
                  <span className={`font-mono ${impactClass(impact)}`}>
                    {impact.toFixed(2)}%
                  </span>
                </div>
                {impact >= 15 ? (
                  <div className="mt-1 rounded border border-rose-800 bg-rose-950/50 p-2 text-xs text-rose-300">
                    ⚠️ <strong>Extreme price impact ({impact.toFixed(1)}%)!</strong>{' '}
                    Liquidity in this pool is shallow for this order size. You
                    will experience significant slippage.
                  </div>
                ) : impact >= 5 ? (
                  <p className="text-amber-300">
                    Moderate/high price impact: consider a smaller trade size.
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {quote.isError ? (
          <p role="alert" className="text-xs text-rose-300">
            Failed to quote: {errorMessage(quote.error)}
          </p>
        ) : null}

        <div>
          <button
            type="submit"
            disabled={busy || !publicKey || !pool.data?.exists}
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
          <p className="mt-2 text-center text-xs text-slate-400">
            Slippage {slippage}% · Protected by Soroswap Router on Stellar testnet
          </p>
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
