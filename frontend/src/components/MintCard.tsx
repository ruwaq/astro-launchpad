import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useTokenInfo } from '../hooks/useTokenInfo'
import { tokenClient, type LaunchpadToken } from '../lib/token'
import { useWallet } from '../store/wallet'
import { recordActivity } from '../store/activity'
import { errorMessage, formatAmount, parseAmount, shortAddress } from '../lib/format'
import { explorerTxUrl } from '../lib/explorer'
import { isValidContractAddress, isValidStellarAddress } from '../lib/address'
import { invalidateTokenData } from '../lib/query'
import { toast } from '../lib/toast'
import { TxProgress } from './TxProgress'

const inputClass =
  'mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 px-3.5 py-3 text-base text-slate-100 outline-none focus:border-emerald-500'

/**
 * Mint additional supply: only the owner can mint.
 */
export function MintCard({ token }: { token: LaunchpadToken }) {
  const { publicKey, demoAccounts, getSigner } = useWallet()
  const queryClient = useQueryClient()
  const info = useTokenInfo(token.id)
  const [to, setTo] = useState('')
  const [amount, setAmount] = useState('')
  const [busy, setBusy] = useState(false)
  const [renouncing, setRenouncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [minted, setMinted] = useState<{
    amount: bigint
    to: string
    hash?: string
  } | null>(null)

  if (info.isPending || info.isError) return null
  if (!publicKey || info.data.owner !== publicKey) return null

  async function onRenounce() {
    setError(null)
    setMinted(null)
    if (!publicKey) return
    const confirmed = window.confirm(
      `Permanently renounce ownership of ${token.symbol ?? 'this token'}?\n\nThis action is irreversible on-chain: minting will be disabled forever.`,
    )
    if (!confirmed) return

    const signer = getSigner()
    if (!signer) {
      setError('Unable to prepare signer for the active account.')
      return
    }

    setRenouncing(true)
    try {
      const client = tokenClient(token.id, signer)
      const tx = await client.renounce_ownership()
      const sentTx = await tx.signAndSend()
      const hash = sentTx.sendTransactionResponse?.hash
      toast.success('Ownership renounced', {
        message: `The supply of ${token.symbol ?? 'token'} is now fixed and immutable.`,
        hash,
      })
      await invalidateTokenData(queryClient, token.id)
    } catch (err) {
      const message = errorMessage(err)
      setError(message)
      toast.error('Failed to renounce ownership', { message })
    } finally {
      setRenouncing(false)
    }
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setMinted(null)

    if (!publicKey) {
      setError('Connect your wallet or activate demo mode to mint tokens.')
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

    const amountBase = parseAmount(amount, token.decimals)
    if (amountBase <= 0n) {
      setError('Enter an amount greater than 0.')
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
      recordActivity({
        kind: 'mint',
        tokenId: token.id,
        tokenSymbol: token.symbol,
        amount: formatAmount(amountBase, token.decimals),
        counterparty: destination,
        account: publicKey,
        hash,
      })
      toast.success('Tokens minted', {
        message: `${formatAmount(amountBase, token.decimals)} ${token.symbol ?? 'token'} → ${shortAddress(destination)}`,
        hash,
      })
      await invalidateTokenData(queryClient, token.id)
    } catch (err) {
      const message = errorMessage(err)
      setError(message)
      recordActivity({
        kind: 'mint',
        status: 'failed',
        tokenId: token.id,
        tokenSymbol: token.symbol,
        amount: formatAmount(amountBase, token.decimals),
        counterparty: destination,
        account: publicKey,
        error: message,
      })
      toast.error('Failed to mint tokens', { message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-xl border border-emerald-900/70 bg-emerald-950/10 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Mint Additional {token.symbol ?? 'tokens'}</h2>
        <span className="rounded-full border border-emerald-800 px-3 py-1 text-xs text-emerald-300">
          owner only
        </span>
      </div>
      <p className="mt-1 text-sm text-slate-400">
        As the contract owner you can increase total supply and distribute it to any account.
        All mints are recorded on-chain.
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

        {publicKey ? (
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <button
              type="button"
              onClick={() => setTo(publicKey)}
              className="inline-flex min-h-[36px] items-center rounded-md border border-slate-700 bg-slate-950/60 px-3 py-1.5 text-emerald-300 hover:border-emerald-500"
            >
              Use My Account
            </button>
            {demoAccounts
              .filter((acc) => acc.publicKey !== publicKey)
              .map((acc) => (
                <button
                  key={acc.publicKey}
                  type="button"
                  onClick={() => setTo(acc.publicKey)}
                  className="inline-flex min-h-[36px] items-center rounded-md border border-slate-700 bg-slate-950/60 px-3 py-1.5 text-slate-300 hover:border-emerald-500 hover:text-emerald-300"
                >
                  Account {acc.label} ({shortAddress(acc.publicKey)})
                </button>
              ))}
          </div>
        ) : null}

        <label className="block text-sm">
          <span className="text-slate-400">
            Amount to Mint ({token.decimals} decimals)
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
          {busy ? 'Minting…' : 'Mint Tokens'}
        </button>
      </form>

      {busy ? (
        <div className="mt-4">
          <TxProgress
            steps={[{ label: 'Signing and minting tokens', status: 'active' }]}
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
            Minted {formatAmount(minted.amount, token.decimals)}{' '}
            {token.symbol ?? 'token'} to {shortAddress(minted.to)} ✓
          </p>
          {minted.hash ? (
            <a
              href={explorerTxUrl(minted.hash)}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-block text-xs underline underline-offset-2"
            >
              View Transaction ↗
            </a>
          ) : null}
        </div>
      ) : null}

      <div className="mt-6 border-t border-emerald-900/50 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="max-w-xl">
            <h3 className="text-sm font-semibold text-slate-200">
              Renounce Ownership (Fixed Supply)
            </h3>
            <p className="mt-0.5 text-xs text-slate-400">
              Permanently disables owner permissions on-chain (`renounce_ownership`).
              No one will ever be able to mint additional {token.symbol ?? 'tokens'}.
            </p>
          </div>
          <button
            type="button"
            disabled={busy || renouncing}
            onClick={() => void onRenounce()}
            className="min-h-[40px] rounded-lg border border-amber-800/80 bg-amber-950/30 px-4 py-2 text-xs font-medium text-amber-200 hover:border-amber-600 hover:bg-amber-950/50 disabled:opacity-50"
          >
            {renouncing ? 'Renouncing…' : 'Renounce Ownership'}
          </button>
        </div>
      </div>
    </section>
  )
}
