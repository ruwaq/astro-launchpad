import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSoroswapPool } from '../hooks/useSoroswapPool'
import { useTokenBalance } from '../hooks/useTokenBalance'
import { errorMessage, formatAmount, parseAmount, shortAddress } from '../lib/format'
import {
  quoteTokenForXlm,
  SLIPPAGE_PERCENT,
  swapTokenForXlm,
  withSlippage,
  type PoolState,
} from '../lib/soroswap'
import type { LaunchpadToken } from '../lib/token'
import { useWallet } from '../store/wallet'
import { useProgress } from '../store/progress'
import { recordActivity } from '../store/activity'
import { toast } from '../lib/toast'
import { TokenArt } from './TokenArt'
import { TxProgress } from './TxProgress'

const inputClass =
  'w-full rounded-lg border border-slate-800 bg-slate-950 px-3.5 py-3 text-base text-slate-100 outline-none focus:border-emerald-500'

/**
 * Intercambio de token por XLM contra el par de Soroswap.
 *
 * La cotización se lee del router (`router_get_amount_out` con las reservas
 * on-chain) y el swap se firma con un mínimo de salida con slippage.
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
  const [amount, setAmount] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [swapped, setSwapped] = useState<{ in: bigint; out: bigint } | null>(
    null,
  )

  const pool = useSoroswapPool(token.id)
  const balance = useTokenBalance(publicKey, token.id)

  const amountIn = parseAmount(amount, token.decimals)
  const quote = useQuery({
    queryKey: ['soroswap-quote', token.id, amountIn.toString()],
    queryFn: () => quoteTokenForXlm(amountIn, pool.data as PoolState),
    enabled: amountIn > 0n && Boolean(pool.data?.exists),
    staleTime: 5_000,
  })

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
    const quoted = quote.data ?? 0n
    if (quoted <= 0n) {
      setError('No hay cotización para ese monto (el par puede no tener liquidez).')
      return
    }

    setBusy(true)
    let hash: string | undefined
    try {
      const amounts = await swapTokenForXlm({
        tokenId: token.id,
        amountIn,
        amountOutMin: withSlippage(quoted),
        signer,
        onHash: (value) => {
          hash = value
        },
      })
      const received = amounts[1] ?? quoted
      setSwapped({ in: amountIn, out: received })
      setAmount('')
      markProgress('swapped')
      recordActivity({
        kind: 'swap',
        tokenId: token.id,
        tokenSymbol: token.symbol,
        amount: formatAmount(amountIn, token.decimals),
        secondaryAmount: formatAmount(received, 7),
        secondarySymbol: 'XLM',
        account: publicKey,
        hash,
      })
      toast.success('Swap completado', {
        message: `${formatAmount(amountIn, token.decimals)} token → ${formatAmount(received, 7)} XLM`,
        hash,
      })
      onSwapped?.()
      await queryClient.invalidateQueries({
        queryKey: ['soroswap-pool', token.id],
      })
      await queryClient.invalidateQueries({
        queryKey: ['token-balance', token.id],
      })
      // El precio del mercado cambia: se marca stale sin refetch inmediato.
      await queryClient.invalidateQueries({
        queryKey: ['token-list'],
        refetchType: 'none',
      })
      // El XLM de la cuenta demo cambió con el swap.
      await queryClient.invalidateQueries({
        queryKey: ['demo-xlm-balances'],
      })
    } catch (err) {
      const message = errorMessage(err)
      setError(message)
      recordActivity({
        kind: 'swap',
        status: 'failed',
        tokenId: token.id,
        tokenSymbol: token.symbol,
        amount: formatAmount(amountIn, token.decimals),
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
          Swap a XLM · {shortAddress(token.id)}
        </span>
      </h2>
      <p className="mt-1 text-sm text-slate-400">
        Cotiza y cambia tu token por XLM nativo en el par de Soroswap.
      </p>

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
            Monto del token ({token.decimals} dec)
          </span>
          <input
            className={`${inputClass} mt-1`}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="1"
            inputMode="decimal"
          />
        </label>

        {publicKey && balance.data !== undefined ? (
          <p className="text-xs text-slate-500">
            Tu balance: {formatAmount(balance.data, token.decimals)}
            <button
              type="button"
              onClick={() =>
                setAmount(formatAmount(balance.data, token.decimals))
              }
              className="ml-2 -mt-1 inline-flex min-h-[44px] items-center rounded-md border border-slate-700 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:border-emerald-500"
            >
              MAX
            </button>
          </p>
        ) : null}

        {amountIn > 0n && pool.data?.exists ? (
          <p className="text-sm text-slate-300">
            Recibes ≈{' '}
            <span className="font-medium text-emerald-400">
              {quote.data !== undefined
                ? `${formatAmount(quote.data, 7)} XLM`
                : 'cotizando…'}
            </span>
          </p>
        ) : null}

        <div>
          <button
            type="submit"
            disabled={busy || !publicKey || !pool.data?.exists}
            className="w-full rounded-lg bg-emerald-500 px-6 py-3 text-base font-medium text-slate-950 hover:bg-emerald-400 disabled:opacity-60"
          >
            {busy ? 'Cambiando…' : 'Cambiar por XLM'}
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
                label: 'Firmando y enviando el swap al router',
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
          Swap hecho ✓ {formatAmount(swapped.in, token.decimals)} token →{' '}
          {formatAmount(swapped.out, 7)} XLM
        </p>
      ) : null}
    </section>
  )
}
