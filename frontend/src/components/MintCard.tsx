import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useTokenInfo } from '../hooks/useTokenInfo'
import { tokenClient, type LaunchpadToken } from '../lib/token'
import { useWallet } from '../store/wallet'
import { errorMessage, formatAmount, parseAmount, shortAddress } from '../lib/format'
import { isValidStellarAddress } from '../lib/address'
import { invalidateTokenData } from '../lib/query'
import { toast } from '../lib/toast'
import { TxProgress } from './TxProgress'

const inputClass =
  'mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 px-3.5 py-3 text-base text-slate-100 outline-none focus:border-emerald-500'

/**
 * Emisión adicional: solo el owner del contrato puede mintear. La UI se
 * oculta si la cuenta conectada no es el owner; el contrato lo verifica
 * igualmente on-chain.
 */
export function MintCard({ token }: { token: LaunchpadToken }) {
  const { publicKey, getSigner } = useWallet()
  const queryClient = useQueryClient()
  const info = useTokenInfo(token.id)
  const [to, setTo] = useState('')
  const [amount, setAmount] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [minted, setMinted] = useState<{
    amount: bigint
    to: string
    hash?: string
  } | null>(null)

  if (info.isPending || info.isError) return null
  if (!publicKey || info.data.owner !== publicKey) return null

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setMinted(null)

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

    const amountBase = parseAmount(amount, token.decimals)
    if (amountBase <= 0n) {
      setError('Introduce un monto mayor que 0.')
      return
    }

    setBusy(true)
    let hash: string | undefined
    try {
      const client = tokenClient(token.id, signer)
      const tx = await client.mint({
        to: destination,
        amount: amountBase,
      })
      const sentTx = await tx.signAndSend()
      hash = sentTx.sendTransactionResponse?.hash
      setMinted({ amount: amountBase, to: destination, hash })
      setAmount('')
      toast.success('Tokens emitidos', {
        message: `${formatAmount(amountBase, token.decimals)} ${token.symbol ?? 'token'} → ${shortAddress(destination)}`,
        hash,
      })
      await invalidateTokenData(queryClient, token.id)
    } catch (err) {
      const message = errorMessage(err)
      setError(message)
      toast.error('No se pudieron emitir los tokens', { message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-xl border border-emerald-900/70 bg-emerald-950/10 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Emitir más {token.symbol ?? 'tokens'}</h2>
        <span className="rounded-full border border-emerald-800 px-3 py-1 text-xs text-emerald-300">
          solo owner
        </span>
      </div>
      <p className="mt-1 text-sm text-slate-400">
        Como owner puedes aumentar el supply y enviarlo a cualquier cuenta. La
        emisión queda registrada on-chain y es visible para todos.
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

        {publicKey ? (
          <button
            type="button"
            onClick={() => setTo(publicKey)}
            className="w-fit text-xs text-emerald-400 underline underline-offset-2 hover:text-emerald-300"
          >
            Usar mi cuenta
          </button>
        ) : null}

        <label className="block text-sm">
          <span className="text-slate-400">
            Monto a emitir ({token.decimals} decimales)
          </span>
          <input
            className={inputClass}
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="1000"
            inputMode="decimal"
          />
        </label>

        <button
          type="submit"
          disabled={busy}
          className="min-h-[44px] w-full rounded-lg bg-emerald-500 px-6 py-3 text-base font-medium text-slate-950 hover:bg-emerald-400 disabled:opacity-60 sm:w-auto"
        >
          {busy ? 'Emitiendo…' : 'Emitir tokens'}
        </button>
      </form>

      {busy ? (
        <div className="mt-4">
          <TxProgress
            steps={[{ label: 'Firmando y emitiendo los tokens', status: 'active' }]}
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

      {minted ? (
        <div
          role="status"
          className="mt-4 rounded-lg border border-emerald-900 bg-emerald-950/40 px-3 py-2 text-sm text-emerald-300"
        >
          <p>
            Emitidos {formatAmount(minted.amount, token.decimals)}{' '}
            {token.symbol ?? 'token'} a {shortAddress(minted.to)} ✓
          </p>
          {minted.hash ? (
            <a
              href={`https://stellar.expert/explorer/testnet/tx/${minted.hash}`}
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
