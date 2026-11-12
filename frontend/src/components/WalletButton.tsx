import { useWallet } from '../store/wallet'
import { MAX_DEMO_ACCOUNTS } from '../lib/demo'
import { errorMessage, shortAddress } from '../lib/format'
import { toast } from '../lib/toast'

export function WalletButton() {
  const {
    publicKey,
    pending,
    mode,
    demoAccounts,
    demoActive,
    demoPending,
    selectDemo,
    addDemoAccount,
    connect,
    disconnect,
  } = useWallet()

  async function onConnect() {
    try {
      await connect()
    } catch (err) {
      toast.error('Failed to connect wallet', {
        message: errorMessage(err),
      })
    }
  }

  async function onDisconnect() {
    try {
      await disconnect()
    } catch (err) {
      toast.error('Failed to disconnect wallet', {
        message: errorMessage(err),
      })
    }
  }

  if (publicKey) {
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        {mode === 'demo' ? (
          <div
            role="group"
            aria-label="Switch test account"
            className="flex items-center gap-1 rounded-lg border border-emerald-800/70 bg-emerald-950/30 p-0.5"
          >
            <span className="px-1.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
              demo
            </span>
            {demoAccounts.map((acc, idx) => (
              <button
                key={acc.publicKey}
                type="button"
                onClick={() => selectDemo(idx)}
                aria-pressed={idx === demoActive}
                aria-label={`Use test account ${acc.label} (${shortAddress(acc.publicKey)})`}
                title={`Use account ${acc.label} (${shortAddress(acc.publicKey)})`}
                className={`min-h-[36px] min-w-[36px] rounded px-2 text-xs font-semibold transition-colors ${
                  idx === demoActive
                    ? 'bg-emerald-500 text-slate-950 font-bold'
                    : 'text-emerald-200 hover:bg-emerald-500/20'
                }`}
              >
                {acc.label}
              </button>
            ))}
            {demoAccounts.length < MAX_DEMO_ACCOUNTS ? (
              <button
                type="button"
                disabled={demoPending}
                onClick={() => void addDemoAccount()}
                aria-label="Add another test account (+10,000 XLM)"
                title="Add another test account (+10,000 XLM)"
                className="min-h-[36px] min-w-[36px] rounded px-2 text-xs font-bold text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-40"
              >
                {demoPending ? '…' : '+'}
              </button>
            ) : null}
          </div>
        ) : null}
        <code className="hidden rounded bg-slate-800 px-2 py-1 text-xs sm:inline-block">
          {shortAddress(publicKey)}
        </code>
        <button
          type="button"
          onClick={() => void onDisconnect()}
          className="min-h-[44px] rounded-lg border border-slate-700 px-3 py-1.5 text-xs hover:bg-slate-800 sm:px-3.5 sm:text-sm"
        >
          Disconnect
        </button>
      </div>
    )
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => void onConnect()}
      className="min-h-[44px] rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-medium text-slate-950 hover:bg-emerald-400 disabled:opacity-60"
    >
      {pending ? 'Connecting…' : 'Connect Wallet'}
    </button>
  )
}
