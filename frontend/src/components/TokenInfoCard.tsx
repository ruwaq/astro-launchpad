import { useTokenInfo } from '../hooks/useTokenInfo'
import { useTokenBalance } from '../hooks/useTokenBalance'
import { useWallet } from '../store/wallet'
import { ASTRO_TOKEN_ID } from '../lib/network'
import { formatAmount } from '../lib/format'

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/60 px-4 py-3">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 font-mono text-sm text-slate-100">{value}</div>
    </div>
  )
}

export function TokenInfoCard() {
  const { publicKey } = useWallet()
  const info = useTokenInfo()
  const balance = useTokenBalance(publicKey)

  if (info.isPending) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6 text-slate-400">
        Leyendo el token on-chain…
      </div>
    )
  }

  if (info.isError) {
    return (
      <div className="rounded-xl border border-rose-900 bg-rose-950/40 p-6 text-rose-300">
        No se pudo leer el token: {info.error.message}
        <button
          type="button"
          onClick={() => void info.refetch()}
          className="ml-3 rounded border border-rose-800 px-2 py-1 text-xs"
        >
          Reintentar
        </button>
      </div>
    )
  }

  const token = info.data

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">
          {token.name}{' '}
          <span className="text-slate-500">({token.symbol})</span>
        </h2>
        <a
          href={`https://stellar.expert/explorer/testnet/contract/${ASTRO_TOKEN_ID}`}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-emerald-400 hover:underline"
        >
          {ASTRO_TOKEN_ID.slice(0, 8)}…{ASTRO_TOKEN_ID.slice(-4)} ↗
        </a>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Stat label="Supply total" value={formatAmount(token.totalSupply, token.decimals)} />
        <Stat label="Decimales" value={String(token.decimals)} />
        <Stat
          label="Tu balance"
          value={
            publicKey
              ? balance.isPending
                ? '…'
                : formatAmount(balance.data ?? 0n, token.decimals)
              : 'conecta la wallet'
          }
        />
      </div>

      <p className="mt-4 text-xs text-slate-500">
        Datos leídos del contrato en testnet vía Soroban RPC. Sin backend: la red
        es la fuente de verdad.
      </p>
    </section>
  )
}
