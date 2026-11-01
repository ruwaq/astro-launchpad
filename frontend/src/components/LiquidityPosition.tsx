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

const PERCENTS = [25, 50, 100] as const
type Percent = (typeof PERCENTS)[number]

/** Los tokens LP del par usan 7 decimales (los mismos que XLM). */
const LP_DECIMALS = 7

/**
 * Posición de liquidez del usuario en el par del token seleccionado.
 *
 * Solo aparece si la wallet conectada tiene LP tokens. Retirar quema esos LP
 * y devuelve ambos lados del par en proporción a las reservas.
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
      setError('No hay LP disponibles para retirar.')
      return
    }
    const signer = getSigner()
    if (!signer) {
      setError('No se pudo preparar el firmante de la cuenta activa.')
      return
    }

    setBusy(true)
    try {
      const result = await withdrawLiquidity({
        tokenId: token.id,
        lpAmount,
        signer,
      })
      setWithdrawn({ ...result, lpAmount })
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
        // Las reservas cambiaron: el precio del mercado queda stale.
        queryClient.invalidateQueries({
          queryKey: ['token-list'],
          refetchType: 'none',
        }),
        // El retiro devuelve XLM a la cuenta demo.
        queryClient.invalidateQueries({
          queryKey: ['demo-xlm-balances'],
        }),
      ])
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 sm:p-6">
      <h2 className="text-lg font-semibold">
        Tu liquidez · {shortAddress(token.id)}
      </h2>

      {hasPosition && data ? (
        <>
          <p className="mt-1 text-sm text-slate-400">
            Tienes {formatAmount(data.lpBalance, LP_DECIMALS)} LP (
            {share.toFixed(2)} % del pool). Los LP se queman al retirar y
            recibes ambos lados, con las fees acumuladas.
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
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
                {option === 100 ? 'Todo' : `${option} %`}
              </button>
            ))}
          </div>

          <p className="mt-3 text-sm text-slate-300">
            Recibes ≈{' '}
            <span className="font-medium text-emerald-400">
              {formatAmount(preview.tokenAmount, token.decimals)} token +{' '}
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
              ? 'Retirando…'
              : `Retirar ${percent === 100 ? 'todo' : `${percent} %`} · ${formatAmount(lpAmount, LP_DECIMALS)} LP`}
          </button>
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
          <p className="font-medium">Liquidez retirada ✓</p>
          <p>
            Recibiste {formatAmount(withdrawn.tokenAmount, token.decimals)} token
            + {formatAmount(withdrawn.xlmAmount, 7)} XLM · quemados{' '}
            {formatAmount(withdrawn.lpAmount, LP_DECIMALS)} LP
          </p>
          {!hasPosition ? <p>Ya no te quedan LP en este par.</p> : null}
        </div>
      ) : null}
    </section>
  )
}
