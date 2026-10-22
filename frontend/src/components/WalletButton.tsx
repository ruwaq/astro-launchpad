import { useWallet } from '../store/wallet'
import { shortAddress } from '../lib/format'

export function WalletButton() {
  const { publicKey, pending, connect, disconnect } = useWallet()

  if (publicKey) {
    return (
      <div className="flex items-center gap-2">
        <code className="rounded bg-slate-800 px-2 py-1 text-xs">
          {shortAddress(publicKey)}
        </code>
        <button
          type="button"
          onClick={() => void disconnect()}
          className="min-h-[44px] rounded-lg border border-slate-700 px-3 py-2 text-sm hover:bg-slate-800"
        >
          Salir
        </button>
      </div>
    )
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => void connect()}
      className="min-h-[44px] rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-medium text-slate-950 hover:bg-emerald-400 disabled:opacity-60"
    >
      {pending ? 'Conectando…' : 'Conectar wallet'}
    </button>
  )
}
