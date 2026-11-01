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
  SLIPPAGE_PERCENT,
  swapTokenForXlm,
  swapXlmForToken,
  withSlippage,
  type PoolState,
} from '../lib/soroswap'
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
}

function impactClass(impact: number): string {
  if (impact >= 5) return 'text-rose-300'
  if (impact >= 2) return 'text-amber-300'
  return 'text-slate-400'
}

/**
 * Compra o venta de un token contra XLM en el par de Soroswap.
 *
 * Las dos direcciones usan `router_get_amount_out` con las reservas reales y
 * firman un mínimo de salida con slippage. El impacto se calcula contra la
 * salida spot para que el usuario vea el coste real de su tamaño.
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
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [swapped, setSwapped] = useState<SwapDone | null>(null)

  const isBuy = direction === 'buy'
  const tokenSymbol = token.symbol ?? 'token'
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
  const minimum = quoted !== undefined ? withSlippage(quoted) : null
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
      setError('Conecta tu wallet o activa el modo prueba para hacer el swap.')
      return
    }
    const signer = getSigner()
    if (!signer) {
      setError('No se pudo preparar el firmante de la cuenta activa.')
      return
    }
    if (amountIn <= 0n) {
      setError('Introduce un monto mayor que 0.')
      return
    }
    if (inputBalanceBase !== undefined && amountIn > inputBalanceBase) {
      setError(
        isBuy
          ? 'No tienes suficiente XLM para esta compra.'
          : 'No tienes suficiente token para esta venta.',
      )
      return
    }
    if (
      isBuy &&
      inputBalanceBase !== undefined &&
      amountIn + XLM_FEE_BUFFER > inputBalanceBase
    ) {
      setError('Deja al menos 1 XLM para fees y reserva mínima.')
      return
    }

    const quotedAmount = quote.data ?? 0n
    if (quotedAmount <= 0n) {
      setError(
        'No hay cotización para ese monto (el par puede no tener liquidez).',
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
            amountOutMin: withSlippage(quotedAmount),
            signer,
            onHash: (value) => {
              hash = value
            },
          })
        : await swapTokenForXlm({
            tokenId: token.id,
            amountIn,
            amountOutMin: withSlippage(quotedAmount),
            signer,
            onHash: (value) => {
              hash = value
            },
          })

      const received = amounts[1] ?? quotedAmount
      const inFormatted = formatAmount(amountIn, inputDecimals)
      const outFormatted = formatAmount(received, outputDecimals)
      setSwapped({ direction, in: amountIn, out: received })
      setAmount('')
      markProgress('swapped')
      recordActivity({
        kind: 'swap',
        tokenId: token.id,
        tokenSymbol,
        // En compra el monto principal es el token recibido; el XLM va como
        // secundario. En venta, al revés. `swapDirection` ordena la UI.
        amount: isBuy ? outFormatted : inFormatted,
        secondaryAmount: isBuy ? inFormatted : outFormatted,
        secondarySymbol: 'XLM',
        swapDirection: direction,
        detail: isBuy ? 'compra' : 'venta',
        account: publicKey,
        hash,
      })
      toast.success('Swap completado', {
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
        // El precio del mercado y el XLM demo cambiaron; se marcan stale.
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
        detail: isBuy ? 'compra fallida' : 'venta fallida',
        account: publicKey,
        error: message,
      })
      toast.error('No se pudo completar el swap', { message })
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
          Swap con XLM · {shortAddress(token.id)}
        </span>
      </h2>
      <p className="mt-1 text-sm text-slate-400">
        Compra o vende {tokenSymbol} contra XLM en el par de Soroswap.
      </p>

      <div
        role="group"
        aria-label="Dirección del swap"
        className="mt-3 grid grid-cols-2 gap-1 rounded-lg border border-slate-800 bg-slate-950/40 p-1"
      >
        <button
          type="button"
          aria-pressed={!isBuy}
          disabled={busy}
          onClick={() => changeDirection('sell')}
          className={`min-h-[44px] rounded-md text-sm disabled:opacity-60 ${
            !isBuy
              ? 'bg-emerald-500/15 font-medium text-emerald-300'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Vender token
        </button>
        <button
          type="button"
          aria-pressed={isBuy}
          disabled={busy}
          onClick={() => changeDirection('buy')}
          className={`min-h-[44px] rounded-md text-sm disabled:opacity-60 ${
            isBuy
              ? 'bg-emerald-500/15 font-medium text-emerald-300'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Comprar con XLM
        </button>
      </div>

      {pool.data?.exists ? (
        <p className="mt-3 text-xs text-slate-500">
          Reservas: {formatAmount(pool.data.reserveToken, token.decimals)} token ·{' '}
          {formatAmount(pool.data.reserveXlm, 7)} XLM
        </p>
      ) : (
        <p className="mt-3 text-xs text-amber-400">
          Este token todavía no tiene par con XLM: añade liquidez primero.
        </p>
      )}

      <form onSubmit={onSwap} aria-busy={busy} className="mt-4 grid gap-3">
        <label className="block text-sm">
          <span className="text-slate-400">
            {isBuy ? 'Monto en XLM' : `Monto del token (${token.decimals} dec)`}
          </span>
          <input
            className={`${inputClass} mt-1`}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={isBuy ? '5' : '1'}
            inputMode="decimal"
          />
        </label>

        {publicKey && inputBalanceBase !== undefined ? (
          <p className="text-xs text-slate-500">
            {isBuy ? 'Tu XLM' : 'Tu balance'}:{' '}
            {formatAmount(inputBalanceBase, inputDecimals)}
            <button
              type="button"
              disabled={maxInput === undefined || maxInput <= 0n}
              onClick={() => {
                if (maxInput !== undefined && maxInput > 0n) {
                  setAmount(formatAmount(maxInput, inputDecimals))
                }
              }}
              className="ml-2 -mt-1 inline-flex min-h-[44px] items-center rounded-md border border-slate-700 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:border-emerald-500 disabled:opacity-50"
            >
              MAX
            </button>
          </p>
        ) : null}

        {amountIn > 0n && pool.data?.exists ? (
          <div className="grid gap-1 text-sm text-slate-300">
            <p>
              Recibes ≈{' '}
              <span className="font-medium text-emerald-400">
                {quoted !== undefined
                  ? `${formatAmount(quoted, outputDecimals)} ${outputSymbol}`
                  : 'cotizando…'}
              </span>
            </p>

            {quoted !== undefined && quoted > 0n && impact !== null ? (
              <div className="grid gap-1 rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 text-xs">
                <div className="flex flex-wrap justify-between gap-2">
                  <span className="text-slate-500">
                    Mínimo tras slippage {SLIPPAGE_PERCENT}%
                  </span>
                  <span className="font-mono text-slate-300">
                    {formatAmount(minimum ?? 0n, outputDecimals)} {outputSymbol}
                  </span>
                </div>
                <div className="flex flex-wrap justify-between gap-2">
                  <span className="text-slate-500">
                    Impacto de precio (incluye fee)
                  </span>
                  <span className={`font-mono ${impactClass(impact)}`}>
                    {impact.toFixed(2)}%
                  </span>
                </div>
                {impact >= 5 ? (
                  <p className="text-rose-300">
                    Impacto alto: considera un monto menor o más liquidez.
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {quote.isError ? (
          <p role="alert" className="text-xs text-rose-300">
            No se pudo cotizar: {quote.error.message}
          </p>
        ) : null}

        <div>
          <button
            type="submit"
            disabled={busy || !publicKey || !pool.data?.exists}
            className="w-full rounded-lg bg-emerald-500 px-6 py-3 text-base font-medium text-slate-950 hover:bg-emerald-400 disabled:opacity-60"
          >
            {busy
              ? 'Cambiando…'
              : isBuy
                ? 'Comprar token'
                : 'Vender token'}
          </button>
          <p className="mt-2 text-xs text-slate-500">
            Slippage {SLIPPAGE_PERCENT}% · mínimo de salida aplicado por el
            router.
          </p>
        </div>

        {busy ? (
          <TxProgress
            steps={[
              {
                label: isBuy
                  ? 'Firmando y enviando la compra al router'
                  : 'Firmando y enviando la venta al router',
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
        <p className="mt-4 rounded-lg border border-emerald-900 bg-emerald-950/40 px-3 py-2 text-sm text-emerald-300">
          Swap hecho ✓{' '}
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
      ) : null}
    </section>
  )
}
