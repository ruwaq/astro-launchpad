import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useTokenBalance } from '../hooks/useTokenBalance'
import { tokenClient, type LaunchpadToken } from '../lib/token'
import { useWallet } from '../store/wallet'
import { recordActivity } from '../store/activity'
import {
  errorMessage,
  formatAmount,
  parseAmount,
  shortAddress,
} from '../lib/format'
import { explorerTxUrl } from '../lib/explorer'
import { isValidContractAddress, isValidStellarAddress } from '../lib/address'
import { invalidateTokenData } from '../lib/query'
import { toast } from '../lib/toast'
import { TxProgress } from './TxProgress'

const inputClass =
  'mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 px-3.5 py-3 text-base text-slate-100 outline-none focus:border-emerald-500'

const AMOUNT_PERCENTS = [25, 50, 75, 100] as const

export function TransferCard({ token }: { token: LaunchpadToken }) {
  const { publicKey, demoAccounts, getSigner } = useWallet()
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
      setError('Connect your wallet or activate demo mode to transfer tokens.')
      return
    }
    const signer = getSigner()
    if (!signer) {
      setError('Unable to prepare signer for the active account.')
      return
    }

    const destination = to.trim()
    if (isValidContractAddress(destination)) {
      setError(
        'Contract address detected (starts with C). Please enter a Stellar user account (starts with G).',
      )
      return
    }
    if (!isValidStellarAddress(destination)) {
      setError('Please enter a valid Stellar public key (starts with G).')
      return
    }
    if (destination === publicKey) {
      setError('Destination account cannot be the same as source account.')
      return
    }

    const amountBase = parseAmount(amount, token.decimals)
    if (amountBase <= 0n) {
      setError('Please enter an amount greater than 0.')
      return
    }
    if (balance.data !== undefined && amountBase > balance.data) {
      setError('Insufficient token balance.')
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
      recordActivity({
        kind: 'transfer',
        tokenId: token.id,
        tokenSymbol: token.symbol,
        amount: formatAmount(amountBase, token.decimals),
        counterparty: destination,
        account: publicKey,
        hash,
      })
      toast.success('Transfer sent', {
        message: `${formatAmount(amountBase, token.decimals)} ${token.symbol ?? 'token'} → ${shortAddress(destination)}`,
        hash,
      })
      await invalidateTokenData(queryClient, token.id)
    } catch (err) {
      const message = errorMessage(err)
      setError(message)
      recordActivity({
        kind: 'transfer',
        status: 'failed',
        tokenId: token.id,
        tokenSymbol: token.symbol,
        amount: formatAmount(amountBase, token.decimals),
        counterparty: destination,
        account: publicKey,
        error: message,
      })
      toast.error('Transfer failed', { message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 sm:p-6">
      <h2 className="text-lg font-semibold">Transfer {token.symbol ?? 'token'}</h2>
      <p className="mt-1 text-sm text-slate-400">
        Send tokens to another Stellar account. Direct peer-to-peer on-chain transfer.
      </p>

      <form onSubmit={onSubmit} aria-busy={busy} className="mt-4 grid gap-3">
        <label className="block text-sm">
          <span className="text-slate-400">Destination Account</span>
          <input
            className={inputClass}
            value={to}
            onChange={(event) => setTo(event.target.value)}
            placeholder="G…"
            autoComplete="off"
            spellCheck={false}
          />
        </label>

        {demoAccounts.filter((acc) => acc.publicKey !== publicKey).length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
            <span>Demo accounts:</span>
            {demoAccounts
              .filter((acc) => acc.publicKey !== publicKey)
              .map((acc) => (
                <button
                  key={acc.publicKey}
                  type="button"
                  onClick={() => setTo(acc.publicKey)}
                  className="inline-flex min-h-[36px] items-center rounded-md border border-slate-700 bg-slate-950/60 px-3 py-1.5 text-xs text-emerald-300 hover:border-emerald-500"
                >
                  Account {acc.label} ({shortAddress(acc.publicKey)})
                </button>
              ))}
          </div>
        ) : null}

        <label className="block text-sm">
          <span className="text-slate-400">
            Amount ({token.decimals} decimals)
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
          className="min-h-[44px] w-full rounded-lg bg-emerald-500 px-6 py-3 text-base font-medium text-slate-950 hover:bg-emerald-400 disabled:opacity-60 sm:w-auto"
        >
          {busy ? 'Sending…' : 'Send Tokens'}
        </button>
      </form>

      {busy ? (
        <div className="mt-4">
          <TxProgress
            steps={[
              {
                label: 'Signing and submitting transfer',
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
            Sent {formatAmount(sent.amount, token.decimals)}{' '}
            {token.symbol ?? 'token'} to {shortAddress(sent.to)} ✓
          </p>
          {sent.hash ? (
            <a
              href={explorerTxUrl(sent.hash)}
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
