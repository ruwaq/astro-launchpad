import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useTokenBalance } from '../hooks/useTokenBalance'
import { tokenClient, type LaunchpadToken } from '../lib/token'
import { useWallet } from '../store/wallet'
import {
  errorMessage,
  formatAmount,
  parseAmount,
  shortAddress,
} from '../lib/format'
import { isValidStellarAddress } from '../lib/address'
import { invalidateTokenData } from '../lib/query'
import { toast } from '../lib/toast'
import { TxProgress } from './TxProgress'

const inputClass =
  'mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 px-3.5 py-3 text-base text-slate-100 outline-none focus:border-emerald-500'

export function TransferCard({ token }: { token: LaunchpadToken }) {
  const { publicKey, getSigner } = useWallet()
  const queryClient = useQueryClient()
  const balance = useTokenBalance(publicKey, token.id)
  const [to, setTo] = useState('')
  const [amount, setAmount] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState<{
    amount: bigint
    to: string
    hash?: string
  } | null>(null)

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setSent(null)

    if (!publicKey) {
      setError('Conecta tu wallet o activa el modo prueba para transferir.')
      return
    }
    const signer = getSigner()
    if (!signer) {
      setError('No se pudo preparar el firmante de la cuenta activa.')
      return
    }

    const destination = to.trim()
    if (!isValidStellarAddress(destination)) {
      setError('Introduce una cuenta Stellar válida (empieza por G).')
      return
    }
    if (destination === publicKey) {
      setError('La cuenta destino es la misma que la de origen.')
      return
    }

    const amountBase = parseAmount(amount, token.decimals)
    if (amountBase <= 0n) {
      setError('Introduce un monto mayor que 0.')
      return
    }
    if (balance.data !== undefined && amountBase > balance.data) {
      setError('No tienes suficiente balance de este token.')
      return
    }

    setBusy(true)
    let hash: string | undefined
    try {
      const client = tokenClient(token.id, signer)
      const tx = await client.transfer({
        from: publicKey,
        to: destination,
        amount: amountBase,
      })
      const sentTx = await tx.signAndSend()
      hash = sentTx.sendTransactionResponse?.hash
      setSent({ amount: amountBase, to: destination, hash })
      setAmount('')
      toast.success('Transferencia enviada', {
        message: `${formatAmount(amountBase, token.decimals)} ${token.symbol ?? 'token'} → ${shortAddress(destination)}`,
        hash,
      })
      await invalidateTokenData(queryClient, token.id)
    } catch (err) {
      const message = errorMessage(err)
      setError(message)
      toast.error('No se pudo enviar la transferencia', { message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 sm:p-6">
      <h2 className="text-lg font-semibold">Transferir {token.symbol ?? 'token'}</h2>
      <p className="mt-1 text-sm text-slate-400">
        Envía tokens a otra cuenta Stellar. La red cobra una fee mínima de
        testnet; no hay intermediarios.
      </p>

      <form onSubmit={onSubmit} aria-busy={busy} className="mt-4 grid gap-3">
        <label className="block text-sm">
          <span className="text-slate-400">Cuenta destino</span>
          <input
            className={inputClass}
            value={to}
            onChange={(event) => setTo(event.target.value)}
            placeholder="G…"
            autoComplete="off"
            spellCheck={false}
          />
        </label>

        <label className="block text-sm">
          <span className="text-slate-400">
            Monto ({token.decimals} decimales)
          </span>
          <input
            className={inputClass}
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="1"
            inputMode="decimal"
          />
        </label>

        {publicKey && balance.data !== undefined ? (
          <p className="text-xs text-slate-500">
            Balance: {formatAmount(balance.data, token.decimals)}{' '}
            {token.symbol ?? 'token'}
            <button
              type="button"
              onClick={() =>
                setAmount(formatAmount(balance.data, token.decimals))
              }
              className="ml-2 min-h-[44px] rounded-md border border-slate-700 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:border-emerald-500"
            >
              MAX
            </button>
          </p>
        ) : null}

        <button
          type="submit"
          disabled={busy || !publicKey}
          className="min-h-[44px] w-full rounded-lg bg-emerald-500 px-6 py-3 text-base font-medium text-slate-950 hover:bg-emerald-400 disabled:opacity-60 sm:w-auto"
        >
          {busy ? 'Enviando…' : 'Enviar tokens'}
        </button>
      </form>

      {busy ? (
        <div className="mt-4">
          <TxProgress
            steps={[
              {
                label: 'Firmando y enviando la transferencia',
                status: 'active',
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

      {sent ? (
        <div
          role="status"
          className="mt-4 rounded-lg border border-emerald-900 bg-emerald-950/40 px-3 py-2 text-sm text-emerald-300"
        >
          <p>
            Enviados {formatAmount(sent.amount, token.decimals)}{' '}
            {token.symbol ?? 'token'} a {shortAddress(sent.to)} ✓
          </p>
          {sent.hash ? (
            <a
              href={`https://stellar.expert/explorer/testnet/tx/${sent.hash}`}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-block text-xs underline underline-offset-2"
            >
              Ver transacción ↗
            </a>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
