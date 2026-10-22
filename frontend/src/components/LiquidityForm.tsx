import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { addLiquidity } from '../lib/soroswap'
import { errorMessage, formatAmount, parseAmount, shortAddress } from '../lib/format'
import { walletSigner } from '../lib/signer'
import type { LaunchpadToken } from '../lib/token'
import { useWallet } from '../store/wallet'

const inputClass =
  'w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500'

/**
 * Añade liquidez al par token/XLM en Soroswap.
 *
 * Dos pasos on-chain: la factory crea el par (si no existe) y el router
 * aporta ambos lados. El usuario firma cada transacción desde su wallet.
 */
export function LiquidityForm({ token }: { token: LaunchpadToken }) {
  const { publicKey } = useWallet()
  const queryClient = useQueryClient()
  const [amountToken, setAmountToken] = useState('')
  const [amountXlm, setAmountXlm] = useState('')
  const [busy, setBusy] = useState(false)
  const [stage, setStage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [lp, setLp] = useState<
    | { pair: string; tokenAmount: bigint; xlmAmount: bigint; lpAmount: bigint }
    | null
  >(null)

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setLp(null)

    if (!publicKey) {
      setError('Conecta tu wallet para añadir liquidez.')
      return
    }
    const tokenDesired = parseAmount(amountToken, token.decimals)
    const xlmDesired = parseAmount(amountXlm, 7)
    if (tokenDesired <= 0n || xlmDesired <= 0n) {
      setError('Introduce montos mayores que 0 para ambos lados.')
      return
    }

    setBusy(true)
    try {
      setStage('Creando el par y añadiendo liquidez…')
      const result = await addLiquidity({
        tokenId: token.id,
        amountToken: tokenDesired,
        amountXlm: xlmDesired,
        signer: walletSigner(publicKey),
      })
      setLp(result)
      setAmountToken('')
      setAmountXlm('')
      // Las reservas han cambiado: refrescamos el pool.
      await queryClient.invalidateQueries({
        queryKey: ['soroswap-pool', token.id],
      })
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
      setStage(null)
    }
  }

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-6">
      <h2 className="text-lg font-semibold">
        Añade liquidez · {shortAddress(token.id)}
      </h2>
      <p className="mt-1 text-sm text-slate-400">
        Crea el par token/XLM en Soroswap y aporta ambos lados. Tu wallet firma
        cada transacción (testnet).
      </p>

      <form onSubmit={onSubmit} className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="text-slate-400">
            Monto del token ({token.decimals} dec)
          </span>
          <input
            className={`${inputClass} mt-1`}
            value={amountToken}
            onChange={(e) => setAmountToken(e.target.value)}
            placeholder="100"
            inputMode="decimal"
          />
        </label>

        <label className="block text-sm">
          <span className="text-slate-400">Monto en XLM (7 dec)</span>
          <input
            className={`${inputClass} mt-1`}
            value={amountXlm}
            onChange={(e) => setAmountXlm(e.target.value)}
            placeholder="10"
            inputMode="decimal"
          />
        </label>

        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={busy || !publicKey}
            className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-emerald-400 disabled:opacity-60"
          >
            {busy ? 'Liquidez en camino…' : 'Crear par + añadir liquidez'}
          </button>
        </div>
      </form>

      {busy && stage ? (
        <p className="mt-4 animate-pulse text-sm text-amber-300">{stage}</p>
      ) : null}

      {error ? (
        <p className="mt-4 rounded-lg border border-rose-900 bg-rose-950/40 px-3 py-2 text-sm text-rose-300">
          {error}
        </p>
      ) : null}

      {lp ? (
        <div className="mt-4 space-y-1 rounded-lg border border-emerald-900 bg-emerald-950/40 px-3 py-2 text-sm text-emerald-300">
          <p className="font-medium">Liquidez añadida ✓</p>
          <p>
            Par: <span className="font-mono">{lp.pair}</span>
          </p>
          <p>
            token aportado: {formatAmount(lp.tokenAmount, token.decimals)} · xlm
            aportado: {formatAmount(lp.xlmAmount, 7)} · tokens LP minteados:{' '}
            {formatAmount(lp.lpAmount, 7)}
          </p>
        </div>
      ) : null}
    </section>
  )
}
