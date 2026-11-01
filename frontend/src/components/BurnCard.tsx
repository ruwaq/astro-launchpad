import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useTokenBalance } from '../hooks/useTokenBalance'
import { useTokenInfo } from '../hooks/useTokenInfo'
import { tokenClient, type LaunchpadToken } from '../lib/token'
import { useWallet } from '../store/wallet'
import { recordActivity } from '../store/activity'
import { errorMessage, formatAmount, parseAmount } from '../lib/format'
import { invalidateTokenData } from '../lib/query'
import { toast } from '../lib/toast'
import { TxProgress } from './TxProgress'

const inputClass =
  'mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 px-3.5 py-3 text-base text-slate-100 outline-none focus:border-emerald-500'

export function BurnCard({ token }: { token: LaunchpadToken }) {
  const { publicKey, getSigner } = useWallet()
  const queryClient = useQueryClient()
  const balance = useTokenBalance(publicKey, token.id)
  const info = useTokenInfo(token.id)
  const [amount, setAmount] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [burned, setBurned] = useState<{ amount: bigint; hash?: string } | null>(
    null,
  )

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setBurned(null)

    if (!publicKey) {
      setError('Conecta tu wallet o activa el modo prueba para quemar tokens.')
      return
    }
    const signer = getSigner()
    if (!signer) {
      setError('No se pudo preparar el firmante de la cuenta activa.')
      return
    }

    const amountBase = parseAmount(amount, token.decimals)
    if (amountBase <= 0n) {
      setError('Introduce un monto mayor que 0.')
      return
    }
    if (balance.data !== undefined && amountBase > balance.data) {
      setError('No puedes quemar más tokens de los que tienes.')
      return
    }

    setBusy(true)
    let hash: string | undefined
    try {
      const client = tokenClient(token.id, signer)
      const tx = await client.burn({
        from: publicKey,
        amount: amountBase,
      })
      const sentTx = await tx.signAndSend()
      hash = sentTx.sendTransactionResponse?.hash
      setBurned({ amount: amountBase, hash })
      setAmount('')
      recordActivity({
        kind: 'burn',
        tokenId: token.id,
        tokenSymbol: token.symbol,
        amount: formatAmount(amountBase, token.decimals),
        account: publicKey,
        hash,
      })
      toast.success('Tokens quemados', {
        message: `${formatAmount(amountBase, token.decimals)} ${token.symbol ?? 'token'} salen del supply para siempre`,
        hash,
      })
      await invalidateTokenData(queryClient, token.id)
    } catch (err) {
      const message = errorMessage(err)
      setError(message)
      recordActivity({
        kind: 'burn',
        status: 'failed',
        tokenId: token.id,
        tokenSymbol: token.symbol,
        amount: formatAmount(amountBase, token.decimals),
        account: publicKey,
        error: message,
      })
      toast.error('No se pudieron quemar los tokens', { message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 sm:p-6">
      <h2 className="text-lg font-semibold">Quemar {token.symbol ?? 'token'}</h2>
      <p className="mt-1 text-sm text-slate-400">
        Destruye tokens de tu propia cuenta. El supply baja para siempre; nadie
        puede recuperarlos.
      </p>
      {info.data ? (
        <p className="mt-2 text-xs text-slate-500">
          Supply actual: {formatAmount(info.data.totalSupply, token.decimals)}{' '}
          {token.symbol ?? 'token'}
        </p>
      ) : null}

      <form onSubmit={onSubmit} aria-busy={busy} className="mt-4 grid gap-3">
        <label className="block text-sm">
          <span className="text-slate-400">Monto a quemar</span>
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
          className="min-h-[44px] w-full rounded-lg border border-rose-800 bg-rose-950/40 px-6 py-3 text-base font-medium text-rose-200 hover:border-rose-600 disabled:opacity-60 sm:w-auto"
        >
          {busy ? 'Quemando…' : 'Quemar tokens'}
        </button>
      </form>

      {busy ? (
        <div className="mt-4">
          <TxProgress
            steps={[
              { label: 'Firmando y quemando los tokens', status: 'active' },
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

      {burned ? (
        <div
          role="status"
          className="mt-4 rounded-lg border border-emerald-900 bg-emerald-950/40 px-3 py-2 text-sm text-emerald-300"
        >
          <p>
            Quemados {formatAmount(burned.amount, token.decimals)}{' '}
            {token.symbol ?? 'token'} ✓
          </p>
          {burned.hash ? (
            <a
              href={`https://stellar.expert/explorer/testnet/tx/${burned.hash}`}
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
