import { useSyncExternalStore } from 'react'
import {
  dismissToast,
  getToastsSnapshot,
  subscribeToasts,
  type ToastKind,
} from '../lib/toast'
import { explorerTxUrl } from '../lib/explorer'

const styles: Record<
  ToastKind,
  { container: string; icon: string; title: string }
> = {
  success: {
    container: 'border-emerald-800 bg-emerald-950/95 text-emerald-100',
    icon: '✓',
    title: 'text-emerald-200',
  },
  error: {
    container: 'border-rose-800 bg-rose-950/95 text-rose-100',
    icon: '!',
    title: 'text-rose-200',
  },
  info: {
    container: 'border-slate-700 bg-slate-900/95 text-slate-100',
    icon: 'i',
    title: 'text-slate-200',
  },
}

/** Región global de notificaciones: accesible y sin dependencias externas. */
export function Toaster() {
  const toasts = useSyncExternalStore(
    subscribeToasts,
    getToastsSnapshot,
    getToastsSnapshot,
  )

  if (toasts.length === 0) return null

  return (
    <div className="pointer-events-none fixed inset-x-4 bottom-4 z-[100] flex flex-col items-end gap-2 sm:left-auto sm:right-4 sm:w-full sm:max-w-sm">
      {toasts.map((toast) => {
        const style = styles[toast.kind]
        return (
          <div
            key={toast.id}
            role={toast.kind === 'error' ? 'alert' : 'status'}
            aria-live={toast.kind === 'error' ? 'assertive' : 'polite'}
            aria-atomic="true"
            className={`pointer-events-auto flex w-full items-start gap-3 rounded-xl border p-3 shadow-2xl shadow-black/40 ${style.container}`}
          >
            <span
              aria-hidden="true"
              className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-bold"
            >
              {style.icon}
            </span>

            <div className="min-w-0 flex-1">
              <p className={`text-sm font-semibold ${style.title}`}>{toast.title}</p>
              {toast.message ? (
                <p className="mt-0.5 break-words text-xs opacity-80">
                  {toast.message}
                </p>
              ) : null}
              {toast.hash ? (
                <a
                  href={explorerTxUrl(toast.hash)}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-block text-xs underline underline-offset-2 opacity-80 hover:opacity-100"
                >
                  Ver transacción ↗
                </a>
              ) : null}
            </div>

            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              aria-label="Cerrar notificación"
              className="-mr-1 -mt-1 flex min-h-[32px] min-w-[32px] items-center justify-center rounded-lg text-lg leading-none opacity-60 hover:bg-white/10 hover:opacity-100"
            >
              ×
            </button>
          </div>
        )
      })}
    </div>
  )
}
