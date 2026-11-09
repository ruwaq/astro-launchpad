import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useWallet } from '../store/wallet'
import {
  MAX_DEMO_ACCOUNTS,
  demoLabelForIndex,
  fetchXlmBalance,
  type DemoAccount,
} from '../lib/demo'
import { useTokenBalance } from '../hooks/useTokenBalance'
import {
  errorMessage,
  formatAmount,
  parseAmount,
  shortAddress,
} from '../lib/format'
import { tokenClient } from '../lib/token'
import type { LaunchpadToken } from '../lib/token'
import { recordActivity } from '../store/activity'
import { toast } from '../lib/toast'
import { TxProgress } from './TxProgress'
import { useCopy } from '../hooks/useCopy'
import {
  FORM_INPUT_CLASS,
  UNSUPPORTED_SIGNER_MESSAGE,
} from '../lib/constants'

/**
 * Demo mode without a wallet: creates testnet accounts funded with Friendbot.
 */
export function DemoMode({ token }: { token: LaunchpadToken }) {
  const {
    publicKey,
    mode,
    demoAccounts,
    demoActive,
    demoPending,
    demoStage,
    demoError,
    startDemo,
    addDemoAccount,
    resetDemoAccounts,
    selectDemo,
    disconnect,
    getSigner,
  } = useWallet()
  const { lastCopied, copy } = useCopy()
  const queryClient = useQueryClient()
  const [amount, setAmount] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState<{ amount: bigint; label: string } | null>(
    null,
  )
  const [recipientIndex, setRecipientIndex] = useState<number | null>(null)

  const active = mode === 'demo'
  const balance = useTokenBalance(publicKey, token.id)
  const xlmBalances = useQuery({
    queryKey: [
      'demo-xlm-balances',
      demoAccounts.map((account) => account.publicKey).join(','),
    ],
    queryFn: () =>
      Promise.all(demoAccounts.map((account) => fetchXlmBalance(account.publicKey))),
    enabled: active && demoAccounts.length > 0,
    staleTime: 15_000,
  })

  const recipients = demoAccounts
    .map((account, index) => ({ account, index }))
    .filter((item) => item.index !== demoActive)
  const recipient =
    recipients.find((item) => item.index === recipientIndex) ?? recipients[0]

  const amountBase = parseAmount(amount, token.decimals)

  async function onTransfer(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setSent(null)
    if (!publicKey || !recipient) return

    const signer = getSigner()
    if (!signer) {
      setError(UNSUPPORTED_SIGNER_MESSAGE)
      return
    }
    if (amountBase <= 0n) {
      setError('Please enter an amount greater than 0.')
      return
    }
    if (balance.data !== undefined && amountBase > balance.data) {
      setError(
        'This account does not hold enough tokens. Launch the token with this account or receive a transfer.',
      )
      return
    }

    setBusy(true)
    try {
      const client = tokenClient(token.id, signer)
      const tx = await client.transfer({
        from: publicKey,
        to: recipient.account.publicKey,
        amount: amountBase,
      })
      const sentTx = await tx.signAndSend()
      const hash = sentTx.sendTransactionResponse?.hash
      setSent({ amount: amountBase, label: recipient.account.label })
      setAmount('')
      recordActivity({
        kind: 'transfer',
        tokenId: token.id,
        tokenSymbol: token.symbol,
        amount: formatAmount(amountBase, token.decimals),
        counterparty: recipient.account.publicKey,
        detail: `demo account ${recipient.account.label}`,
        account: publicKey,
        hash,
      })
      toast.success('Transfer sent', {
        message: `${formatAmount(amountBase, token.decimals)} ${token.symbol ?? 'token'} → account ${recipient.account.label}`,
        hash,
      })
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['token-balance', token.id],
        }),
        queryClient.invalidateQueries({
          queryKey: ['token-events', token.id],
        }),
        queryClient.invalidateQueries({ queryKey: ['demo-xlm-balances'] }),
      ])
    } catch (err) {
      const message = errorMessage(err)
      setError(message)
      recordActivity({
        kind: 'transfer',
        status: 'failed',
        tokenId: token.id,
        tokenSymbol: token.symbol,
        amount: formatAmount(amountBase, token.decimals),
        counterparty: recipient.account.publicKey,
        detail: `demo account ${recipient.account.label}`,
        account: publicKey,
        error: message,
      })
      toast.error('Transfer failed', { message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-xl border border-dashed border-emerald-800/70 bg-emerald-950/10 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">🧪 Demo Mode · No Wallet Needed</h2>
        <span className="rounded-full border border-emerald-800 px-3 py-1 text-xs text-emerald-300">
          testnet · free
        </span>
      </div>
      <p className="mt-1 text-sm text-slate-400">
        Create disposable testnet accounts funded with 10,000 XLM each (Friendbot, up to{' '}
        {MAX_DEMO_ACCOUNTS} accounts A–H). Switch between them to test fair launches, liquidity,
        swaps, and peer-to-peer transfers.
      </p>
      <p className="mt-1 text-xs text-amber-400">
        Testnet only: keys are saved in this browser (localStorage) and carry zero real value.
      </p>

      {!active ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={demoPending}
            onClick={() => void startDemo()}
            className="w-full rounded-lg bg-emerald-500 px-6 py-3 text-base font-medium text-slate-950 hover:bg-emerald-400 disabled:opacity-60 sm:w-auto"
          >
            {demoPending
              ? 'Preparing accounts…'
              : demoAccounts.length > 0
                ? 'Enter Demo Mode'
                : 'Create 3 Test Accounts'}
          </button>
          {demoAccounts.length > 0 ? (
            <span className="text-xs text-slate-500">
              You already have {demoAccounts.length} test accounts saved in this browser.
            </span>
          ) : null}
        </div>
      ) : (
        <>
          <div className="mt-4 grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {demoAccounts.map((account: DemoAccount, index: number) => {
              const isActive = index === demoActive
              const xlm = xlmBalances.data?.[index]
              const copied = lastCopied === account.publicKey
              return (
                <div
                  key={account.publicKey}
                  className={`flex flex-col justify-between rounded-lg border p-3 transition-colors ${
                    isActive
                      ? 'border-emerald-500 bg-emerald-500/10'
                      : 'border-slate-700 hover:border-slate-500'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => selectDemo(index)}
                    aria-pressed={isActive}
                    className="w-full text-left"
                  >
                    <span className="flex items-center justify-between gap-2 text-sm font-medium">
                      Account {account.label}
                      {isActive ? (
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
                          active
                        </span>
                      ) : null}
                    </span>
                    <code className="mt-1 block text-xs text-slate-400">
                      {shortAddress(account.publicKey)}
                    </code>
                    <span className="mt-1 block text-xs text-slate-300">
                      {xlm !== undefined
                        ? `${xlm.toLocaleString('en-US', { maximumFractionDigits: 2 })} XLM`
                        : 'reading…'}
                    </span>
                  </button>
                  <div className="mt-2 border-t border-slate-800/80 pt-1.5">
                    <button
                      type="button"
                      onClick={() => void copy(account.publicKey)}
                      className="text-[11px] text-slate-400 hover:text-emerald-300"
                    >
                      {copied ? 'Address copied ✓' : 'Copy G… address'}
                    </button>
                  </div>
                </div>
              )
            })}

            {demoAccounts.length < MAX_DEMO_ACCOUNTS ? (
              <button
                type="button"
                disabled={demoPending}
                onClick={() => void addDemoAccount()}
                className="flex min-h-[96px] flex-col items-center justify-center rounded-lg border border-dashed border-emerald-800/70 bg-emerald-950/10 p-3 text-center text-xs font-medium text-emerald-300 hover:border-emerald-500 hover:bg-emerald-950/30 disabled:opacity-50"
              >
                <span className="text-base">+ Add Account {demoLabelForIndex(demoAccounts.length)}</span>
                <span className="mt-0.5 text-[11px] text-slate-400">
                  +10,000 free XLM (Friendbot)
                </span>
              </button>
            ) : null}
          </div>

          <div className="mt-2 flex flex-wrap gap-3 text-xs">
            <button
              type="button"
              onClick={() => void xlmBalances.refetch()}
              className="min-h-[44px] text-slate-400 underline underline-offset-2 hover:text-slate-200"
            >
              Refresh balances
            </button>
            <button
              type="button"
              disabled={demoPending}
              onClick={() => {
                if (
                  window.confirm(
                    'Generate 3 fresh test accounts funded with 10,000 XLM each? Current browser demo accounts will be replaced.',
                  )
                ) {
                  void resetDemoAccounts()
                }
              }}
              className="min-h-[44px] text-slate-400 underline underline-offset-2 hover:text-slate-200 disabled:opacity-50"
            >
              Regenerate fresh accounts
            </button>
            <button
              type="button"
              onClick={() => void disconnect()}
              className="min-h-[44px] text-slate-400 underline underline-offset-2 hover:text-slate-200"
            >
              Exit Demo Mode
            </button>
          </div>

          {recipient ? (
            <form
              onSubmit={onTransfer}
              aria-busy={busy}
              className="mt-5 rounded-lg border border-emerald-900/60 bg-slate-950/40 p-3"
            >
              <h3 className="text-sm font-semibold">Send Tokens to Another Account</h3>
              <p className="mt-1 text-xs text-slate-400">
                Send {token.symbol ?? shortAddress(token.id)} from Account{' '}
                {demoAccounts[demoActive]?.label ?? demoLabelForIndex(demoActive)}{' '}
                to another demo account to test trading as separate users.
              </p>

              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <label className="text-sm sm:w-40">
                  <span className="sr-only">Destination Account</span>
                  <select
                    value={recipient.index}
                    onChange={(event) =>
                      setRecipientIndex(Number(event.target.value))
                    }
                    className={`${FORM_INPUT_CLASS} mt-1`}
                  >
                    {recipients.map(({ account, index }) => (
                      <option key={account.publicKey} value={index}>
                        Account {account.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex-1 text-sm">
                  <span className="sr-only">Amount to send</span>
                  <input
                    className={`${FORM_INPUT_CLASS} mt-1`}
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    placeholder="100"
                    inputMode="decimal"
                  />
                </label>
                <button
                  type="submit"
                  disabled={busy}
                  className="min-h-[44px] rounded-lg bg-emerald-500 px-5 py-3 text-sm font-medium text-slate-950 hover:bg-emerald-400 disabled:opacity-60"
                >
                  {busy
                    ? 'Sending…'
                    : `Send to Account ${recipient.account.label}`}
                </button>
              </div>

              <p className="mt-2 text-xs text-slate-500">
                Balance:{' '}
                {publicKey
                  ? balance.isPending
                    ? '…'
                    : `${formatAmount(balance.data ?? 0n, token.decimals)} ${
                        token.symbol ?? 'token'
                      }`
                  : '—'}
                {publicKey && balance.data !== undefined ? (
                  <button
                    type="button"
                    onClick={() =>
                      setAmount(formatAmount(balance.data, token.decimals))
                    }
                    className="ml-2 rounded-md border border-slate-700 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:border-emerald-500"
                  >
                    MAX
                  </button>
                ) : null}
              </p>

              {busy ? (
                <div className="mt-3">
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

              {sent ? (
                <p
                  role="status"
                  className="mt-3 rounded-lg border border-emerald-900 bg-emerald-950/40 px-3 py-2 text-sm text-emerald-300"
                >
                  Sent ✓ {formatAmount(sent.amount, token.decimals)}{' '}
                  {token.symbol ?? 'token'} to Account {sent.label}.
                </p>
              ) : null}

              {error ? (
                <p
                  role="alert"
                  className="mt-3 rounded-lg border border-rose-900 bg-rose-950/40 px-3 py-2 text-sm text-rose-300"
                >
                  {error}
                </p>
              ) : null}
            </form>
          ) : null}
        </>
      )}

      {demoStage ? (
        <p role="status" className="mt-3 animate-pulse text-sm text-amber-300">
          {demoStage}
        </p>
      ) : null}

      {demoError ? (
        <p
          role="alert"
          className="mt-3 rounded-lg border border-rose-900 bg-rose-950/40 px-3 py-2 text-sm text-rose-300"
        >
          {demoError}
        </p>
      ) : null}
    </section>
  )
}
