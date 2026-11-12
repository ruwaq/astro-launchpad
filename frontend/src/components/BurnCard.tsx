import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useTokenBalance } from '../hooks/useTokenBalance'
import { useTokenInfo } from '../hooks/useTokenInfo'
import { tokenClient, type LaunchpadToken } from '../lib/token'
import { useWallet } from '../store/wallet'
import { recordActivity } from '../store/activity'
import { errorMessage, formatAmount, parseAmount } from '../lib/format'
import { explorerTxUrl } from '../lib/explorer'
import { invalidateTokenData } from '../lib/query'
import { toast } from '../lib/toast'
import { TxProgress } from './TxProgress'

const inputClass =
  'mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 px-3.5 py-3 text-base text-slate-100 outline-none focus:border-emerald-500'

const AMOUNT_PERCENTS = [25, 50, 75, 100] as const

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
      setError('Connect your wallet or activate demo mode to burn tokens.')
      return
    }
    const signer = getSigner()
    if (!signer) {
      setError('Unable to prepare signer for the active account.')
      return
    }

    const amountBase = parseAmount(amount, token.decimals)
    if (amountBase <= 0n) {
      setError('Please enter an amount greater than 0.')
      return
    }
    if (balance.data !== undefined && amountBase > balance.data) {
      setError('You cannot burn more tokens than your balance.')
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
      toast.success('Tokens burned', {
        message: `${formatAmount(amountBase, token.decimals)} ${token.symbol ?? 'token'} removed from supply permanently`,
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
      toast.error('Failed to burn tokens', { message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 sm:p-6">
      <h2 className="text-lg font-semibold">Burn {token.symbol ?? 'token'}</h2>
      <p className="mt-1 text-sm text-slate-400">
        Destroy tokens from your own balance. Reduces total circulating supply permanently.
      </p>
      {info.data ? (
        <p className="mt-2 text-xs text-slate-400">
          Current Supply: {formatAmount(info.data.totalSupply, token.decimals)}{' '}
          {token.symbol ?? 'token'}
        </p>
      ) : null}

      <form onSubmit={onSubmit} aria-busy={busy} className="mt-4 grid gap-3">
        <label className="block text-sm">
          <span className="text-slate-400">Amount to burn</span>
          <input
            className={inputClass}
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="1"
            inputMode="decimal"
          />
        </label>

        {publicKey && balance.data !== undefined ? (
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
            <span>
              Balance:{' '}
              <span className="font-mono text-slate-300">
                {formatAmount(balance.data, token.decimals)}
              </span>{' '}
              {token.symbol ?? 'token'}
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
                      setAmount(formatAmount(slice, token.decimals))
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

        <button
          type="submit"
          disabled={busy || !publicKey}
          className="min-h-[44px] w-full rounded-lg border border-rose-800 bg-rose-950/40 px-6 py-3 text-base font-medium text-rose-200 hover:border-rose-600 disabled:opacity-60 sm:w-auto"
        >
          {busy ? 'Burning…' : 'Burn Tokens'}
        </button>
      </form>

      {busy ? (
        <div className="mt-4">
          <TxProgress
            steps={[
              { label: 'Signing and burning tokens', status: 'active' },
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
            Burned {formatAmount(burned.amount, token.decimals)}{' '}
            {token.symbol ?? 'token'} ✓
          </p>
          {burned.hash ? (
            <a
              href={explorerTxUrl(burned.hash)}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-block text-xs underline underline-offset-2"
            >
              View Transaction ↗
            </a>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
