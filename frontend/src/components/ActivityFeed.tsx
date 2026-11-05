import {
  activityLabel,
  activitySummary,
  useActivity,
  type ActivityEntry,
  type ActivityKind,
} from '../store/activity'
import { shortAddress } from '../lib/format'

const KIND_CLASSES: Record<ActivityKind, string> = {
  create: 'border-emerald-800 bg-emerald-950/40 text-emerald-300',
  'add-liquidity': 'border-teal-800 bg-teal-950/40 text-teal-300',
  'remove-liquidity': 'border-amber-800 bg-amber-950/40 text-amber-300',
  swap: 'border-sky-800 bg-sky-950/40 text-sky-300',
  transfer: 'border-indigo-800 bg-indigo-950/40 text-indigo-300',
  mint: 'border-emerald-800 bg-emerald-950/40 text-emerald-300',
  burn: 'border-rose-800 bg-rose-950/40 text-rose-300',
}

function formatWhen(at: number): string {
  return new Date(at).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function ActivityRow({ entry }: { entry: ActivityEntry }) {
  return (
    <li className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${KIND_CLASSES[entry.kind]}`}
          >
            {activityLabel(entry.kind)}
          </span>
          <span
            className={`text-[11px] ${
              entry.status === 'failed' ? 'text-rose-300' : 'text-emerald-400'
            }`}
          >
            {entry.status === 'failed' ? 'failed' : 'ok'}
          </span>
          <span className="font-mono text-[11px] text-slate-500">
            {formatWhen(entry.at)}
          </span>
        </div>

        <p className="mt-1 break-words text-sm text-slate-200">
          {activitySummary(entry)}
        </p>
        <p className="mt-0.5 text-xs text-slate-500">
          {entry.account ? `account ${shortAddress(entry.account)}` : 'local'} ·
          saved in this browser
        </p>
        {entry.error ? (
          <p className="mt-1 break-words text-xs text-rose-300">{entry.error}</p>
        ) : null}
      </div>

      {entry.hash ? (
        <a
          href={`https://stellar.expert/explorer/testnet/tx/${entry.hash}`}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 text-xs text-slate-400 underline underline-offset-2 hover:text-slate-200"
        >
          tx {shortAddress(entry.hash)} ↗
        </a>
      ) : null}
    </li>
  )
}

/**
 * Local transaction history signed from this browser. Not a replacement
 * for a global indexer: does not include other sessions, devices, or users.
 */
export function ActivityFeed({ limit = 20 }: { limit?: number }) {
  const entries = useActivity((state) => state.entries)
  const clear = useActivity((state) => state.clear)
  const visible = entries.slice(0, limit)

  function onClear() {
    if (window.confirm('Clear local activity for this browser?')) {
      clear()
    }
  }

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Recent Activity</h2>
          <p className="mt-1 text-xs text-slate-500">
            Transactions signed from this browser. Stored locally, zero
            backend.
          </p>
        </div>
        {entries.length > 0 ? (
          <button
            type="button"
            onClick={onClear}
            className="min-h-[44px] rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-400 hover:border-slate-500 hover:text-slate-200"
          >
            Clear history
          </button>
        ) : null}
      </div>

      {visible.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-slate-700 bg-slate-950/30 p-4 text-sm text-slate-400">
          No activity recorded yet. Launch a token, add liquidity, execute a swap, or
          transfer tokens to see it here.
        </p>
      ) : (
        <ul className="mt-2 divide-y divide-slate-800">
          {visible.map((entry) => (
            <ActivityRow key={entry.id} entry={entry} />
          ))}
        </ul>
      )}

      {entries.length > visible.length ? (
        <p className="mt-3 text-xs text-slate-500">
          Showing latest {visible.length} of {entries.length}. Up to 200
          transactions kept locally.
        </p>
      ) : null}
    </section>
  )
}
