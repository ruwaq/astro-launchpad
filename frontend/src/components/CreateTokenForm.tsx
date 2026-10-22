import { useState } from 'react'
import { deployToken } from '../lib/token'
import { walletSigner } from '../lib/signer'
import { useWallet } from '../store/wallet'
import { errorMessage, parseAmount } from '../lib/format'

const inputClass =
  'w-full rounded-lg border border-slate-800 bg-slate-950 px-3.5 py-3 text-base text-slate-100 outline-none focus:border-emerald-500'

export function CreateTokenForm({
  onCreated,
}: {
  onCreated?: (token: { id: string; decimals: number }) => void
}) {
  const { publicKey } = useWallet()
  const [name, setName] = useState('')
  const [symbol, setSymbol] = useState('')
  const [decimals, setDecimals] = useState(7)
  const [supply, setSupply] = useState('1000000')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createdId, setCreatedId] = useState<string | null>(null)

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setCreatedId(null)

    if (!publicKey) {
      setError('Conecta tu wallet para crear el token.')
      return
    }
    if (!name.trim() || !symbol.trim()) {
      setError('Nombre y símbolo son obligatorios.')
      return
    }

    setBusy(true)
    try {
      const newId = await deployToken({
        name: name.trim(),
        symbol: symbol.trim().toUpperCase(),
        decimals,
        initialSupply: parseAmount(supply, decimals),
        signer: walletSigner(publicKey),
      })
      setCreatedId(newId)
      onCreated?.({ id: newId, decimals })
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 sm:p-6">
      <h2 className="text-lg font-semibold">Crea tu token</h2>
      <p className="mt-1 text-sm text-slate-400">
        Se despliega una instancia nueva del contrato del launchpad en testnet.
        Tu wallet firma la transacción y queda como owner.
      </p>

      <form onSubmit={onSubmit} className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="text-slate-400">Nombre</span>
          <input
            className={`${inputClass} mt-1`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Astro Coin"
            maxLength={32}
          />
        </label>

        <label className="block text-sm">
          <span className="text-slate-400">Símbolo</span>
          <input
            className={`${inputClass} mt-1`}
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            placeholder="ASTRO"
            maxLength={12}
          />
        </label>

        <label className="block text-sm">
          <span className="text-slate-400">Decimales</span>
          <input
            className={`${inputClass} mt-1`}
            type="number"
            min={0}
            max={18}
            value={decimals}
            onChange={(e) => setDecimals(Number(e.target.value))}
          />
        </label>

        <label className="block text-sm">
          <span className="text-slate-400">Supply inicial</span>
          <input
            className={`${inputClass} mt-1`}
            type="number"
            min={0}
            step="any"
            value={supply}
            onChange={(e) => setSupply(e.target.value)}
          />
        </label>

        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-emerald-500 px-6 py-3 text-base font-medium text-slate-950 hover:bg-emerald-400 disabled:opacity-60 sm:w-auto"
          >
            {busy ? 'Creando en testnet…' : 'Crear token'}
          </button>
        </div>
      </form>

      {error ? (
        <p className="mt-4 rounded-lg border border-rose-900 bg-rose-950/40 px-3 py-2 text-sm text-rose-300">
          {error}
        </p>
      ) : null}

      {createdId ? (
        <p className="mt-4 rounded-lg border border-emerald-900 bg-emerald-950/40 px-3 py-2 text-sm text-emerald-300">
          Token creado:{' '}
          <a
            href={`https://stellar.expert/explorer/testnet/contract/${createdId}`}
            target="_blank"
            rel="noreferrer"
            className="font-mono underline"
          >
            {createdId}
          </a>
        </p>
      ) : null}
    </section>
  )
}
