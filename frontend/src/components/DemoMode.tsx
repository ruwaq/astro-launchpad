import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useWallet } from '../store/wallet'
import {
  DEMO_LABELS,
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

const inputClass =
  'w-full rounded-lg border border-slate-800 bg-slate-950 px-3.5 py-3 text-base text-slate-100 outline-none focus:border-emerald-500'

function formatXlm(value: number): string {
  return value.toLocaleString('es-ES', { maximumFractionDigits: 2 })
}

/**
 * Modo prueba sin wallet: crea 3 cuentas de testnet fondeadas con Friendbot y
 * permite cambiar entre ellas para probar todo el ciclo como usuarios
 * distintos. Las claves son desechables y viven en este navegador.
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
    selectDemo,
    disconnect,
    getSigner,
  } = useWallet()
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
      setError('No se pudo preparar el firmante de la cuenta activa.')
      return
    }
    if (amountBase <= 0n) {
      setError('Introduce un monto mayor que 0.')
      return
    }
    if (balance.data !== undefined && amountBase > balance.data) {
      setError(
        'Esta cuenta no tiene tanto token. Crea el token con ella o recibe una transferencia.',
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
        detail: `cuenta demo ${recipient.account.label}`,
        account: publicKey,
        hash,
      })
      toast.success('Transferencia enviada', {
        message: `${formatAmount(amountBase, token.decimals)} ${token.symbol ?? 'token'} → cuenta ${recipient.account.label}`,
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
        detail: `cuenta demo ${recipient.account.label}`,
        account: publicKey,
        error: message,
      })
      toast.error('No se pudo enviar la transferencia', { message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-xl border border-dashed border-emerald-800/70 bg-emerald-950/10 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">🧪 Modo prueba · sin wallet</h2>
        <span className="rounded-full border border-emerald-800 px-3 py-1 text-xs text-emerald-300">
          testnet · gratis
        </span>
      </div>
      <p className="mt-1 text-sm text-slate-400">
        Crea 3 cuentas nuevas fondeadas con 10 000 XLM cada una (Friendbot).
        Cambia entre ellas para probar crear token, liquidez, swap, retiro y
        transferencias como si fueran usuarios distintos.
      </p>
      <p className="mt-1 text-xs text-amber-400">
        Solo testnet: las claves se guardan en este navegador (localStorage), no
        tienen valor real. No uses fondos reales.
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
              ? 'Preparando cuentas…'
              : demoAccounts.length > 0
                ? 'Entrar en modo prueba'
                : 'Crear 3 cuentas de prueba'}
          </button>
          {demoAccounts.length > 0 ? (
            <span className="text-xs text-slate-500">
              Ya tienes {demoAccounts.length} cuentas guardadas en este
              navegador.
            </span>
          ) : null}
        </div>
      ) : (
        <>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {demoAccounts.map((account: DemoAccount, index: number) => {
              const isActive = index === demoActive
              const xlm = xlmBalances.data?.[index]
              return (
                <button
                  key={account.publicKey}
                  type="button"
                  onClick={() => selectDemo(index)}
                  aria-pressed={isActive}
                  className={`rounded-lg border p-3 text-left ${
                    isActive
                      ? 'border-emerald-500 bg-emerald-500/10'
                      : 'border-slate-700 hover:border-slate-500'
                  }`}
                >
                  <span className="flex items-center justify-between gap-2 text-sm font-medium">
                    Cuenta {account.label}
                    {isActive ? (
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
                        activa
                      </span>
                    ) : null}
                  </span>
                  <code className="mt-1 block text-xs text-slate-400">
                    {shortAddress(account.publicKey)}
                  </code>
                  <span className="mt-1 block text-xs text-slate-300">
                    {xlm !== undefined ? `${formatXlm(xlm)} XLM` : 'leyendo…'}
                  </span>
                </button>
              )
            })}
          </div>

          <div className="mt-2 flex flex-wrap gap-3 text-xs">
            <button
              type="button"
              onClick={() => void xlmBalances.refetch()}
              className="min-h-[44px] text-slate-400 underline underline-offset-2 hover:text-slate-200"
            >
              Actualizar saldos
            </button>
            <button
              type="button"
              onClick={() => void disconnect()}
              className="min-h-[44px] text-slate-400 underline underline-offset-2 hover:text-slate-200"
            >
              Salir del modo prueba
            </button>
          </div>

          {recipient ? (
            <form
              onSubmit={onTransfer}
              aria-busy={busy}
              className="mt-5 rounded-lg border border-emerald-900/60 bg-slate-950/40 p-3"
            >
              <h3 className="text-sm font-semibold">Pasar token a otra cuenta</h3>
              <p className="mt-1 text-xs text-slate-400">
                Envía {token.symbol ?? shortAddress(token.id)} desde la cuenta{' '}
                {DEMO_LABELS[demoActive]} a otra cuenta demo; así puede swapearlo
                como un usuario distinto.
              </p>

              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <label className="text-sm sm:w-40">
                  <span className="sr-only">Cuenta destino</span>
                  <select
                    value={recipient.index}
                    onChange={(event) =>
                      setRecipientIndex(Number(event.target.value))
                    }
                    className={`${inputClass} mt-1`}
                  >
                    {recipients.map(({ account, index }) => (
                      <option key={account.publicKey} value={index}>
                        Cuenta {account.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex-1 text-sm">
                  <span className="sr-only">Monto a enviar</span>
                  <input
                    className={`${inputClass} mt-1`}
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
                    ? 'Enviando…'
                    : `Enviar a cuenta ${recipient.account.label}`}
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
                        label: 'Firmando y enviando la transferencia',
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
                  Enviado ✓ {formatAmount(sent.amount, token.decimals)}{' '}
                  {token.symbol ?? 'token'} a la cuenta {sent.label}.
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
