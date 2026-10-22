import { useState } from 'react'
import { deployToken } from '../lib/token'
import { walletSigner } from '../lib/signer'
import { useWallet } from '../store/wallet'
import { errorMessage, parseAmount } from '../lib/format'

const inputClass =
  'w-full rounded-lg border border-slate-800 bg-slate-950 px-3.5 py-3 text-base text-slate-100 outline-none focus:border-emerald-500'

/**
 * Creación de tokens "GasPump-style": dos campos y los valores estándar se
 * ocupan solos. El modo experto restaura el control fino (decimales/supply).
 *
 * Defaults con buenas prácticas (estándar de memes en Stellar):
 * - 7 decimales: la precisión nativa de la red (XLM/ASTRO/etc. usan 7).
 * - Supply 1B: el estándar de los memes (pump.fun/GasPump) y suficiente para
 *   el futuro si el token escala.
 * - Estándar SEP-41: cualquier wallet/DEX/bot de Stellar ya lo entiende.
 */
export function CreateTokenForm({
  onCreated,
}: {
  onCreated?: (token: { id: string; decimals: number }) => void
}) {
  const { publicKey } = useWallet()
  const [expert, setExpert] = useState(false)
  const [name, setName] = useState('')
  const [symbol, setSymbol] = useState('')
  const [decimals, setDecimals] = useState(7)
  const [supply, setSupply] = useState('1000000000')
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
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Crea tu token</h2>
        <button
          type="button"
          onClick={() => setExpert((value) => !value)}
          className="min-h-[44px] rounded px-2 text-xs text-slate-400 underline underline-offset-2 hover:text-slate-300"
        >
          {expert ? '← modo simple' : 'modo experto'}
        </button>
      </div>
      <p className="mt-1 text-sm text-slate-400">
        Lanzas con el estándar de los memes: <span className="text-slate-200">1 000
        000 000 tokens</span>, 7 decimales, supply fijo. En modo experto decides
        todo.
      </p>

      <form onSubmit={onSubmit} className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="text-slate-400">Nombre</span>
          <input
            className={`${inputClass} mt-1`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Moon Rocket"
            maxLength={32}
          />
        </label>

        <label className="block text-sm">
          <span className="text-slate-400">Símbolo</span>
          <input
            className={`${inputClass} mt-1`}
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            placeholder="MOON"
            maxLength={12}
          />
        </label>

        {expert ? (
          <>
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
          </>
        ) : (
          <p className="text-xs text-slate-500 sm:col-span-2">
            Lanzarás:{' '}
            <span className="font-mono text-slate-300">
              {symbol.trim() || 'TU_TOKEN'}
            </span>{' '}
            · 1 000 000 000 tokens · 7 dec
          </p>
        )}

        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-emerald-500 px-6 py-3 text-base font-medium text-slate-950 hover:bg-emerald-400 disabled:opacity-60 sm:w-auto"
          >
            {busy ? 'Creando en testnet…' : 'Crear token (gratis)'}
          </button>
        </div>
      </form>

      <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-xs text-slate-400">
        <p className="font-medium text-slate-300">Reglas claras del launchpad</p>
        <p className="mt-1">
          · Supply fijo al desplegar (por defecto 1B). Emitir más solo puede tu
          wallet (owner) — queda visible on-chain.
        </p>
        <p className="mt-0.5">
          · Estándar SEP-41 (OpenZeppelin Stellar): wallets, exploradores y DEX
          lo leen sin integraciones.
        </p>
        <p className="mt-0.5">
          · La liquidez son LP tokens tuyos: cada swap acumula fees en tu parte
          mientras sostengas el pool.
        </p>
        <p className="mt-0.5">
          · Burn disponible: los holders quemar token reduce el supply para
          siempre.
        </p>
        <p className="mt-0.5 text-amber-400">
          · Estamos en testnet: todo es gratis y sin valor real — perfecto para
          practicar antes de un lanzamiento serio.
        </p>
      </div>

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
          {' · '}
          <span className="text-emerald-200">
            siguiente paso: añade liquidez con el panel de abajo
          </span>
        </p>
      ) : null}
    </section>
  )
}
