import { useEffect, useState } from 'react'

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISS_KEY = 'floodgate.pwa.install.dismissed.v1'

function wasDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1'
  } catch {
    return false
  }
}

/**
 * Instalación de la PWA con el prompt nativo de Chromium.
 *
 * No se muestra en SSR ni si la app ya corre en modo standalone. El aviso es
 * descartable y no bloquea ninguna operación; el service worker sigue siendo
 * el que habilita el shell offline.
 */
export function PwaInstallPrompt() {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(
    null,
  )
  const [visible, setVisible] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (wasDismissed()) return
    if (window.matchMedia('(display-mode: standalone)').matches) return

    function onBeforeInstall(event: Event) {
      event.preventDefault()
      setPromptEvent(event as InstallPromptEvent)
      setVisible(true)
    }

    function onInstalled() {
      setVisible(false)
      setPromptEvent(null)
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  function dismiss() {
    setVisible(false)
    setPromptEvent(null)
    try {
      localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      // Sin storage el aviso simplemente vuelve a aparecer en otra visita.
    }
  }

  async function install() {
    if (!promptEvent) return
    setBusy(true)
    try {
      await promptEvent.prompt()
      const choice = await promptEvent.userChoice
      if (choice.outcome === 'accepted') {
        setVisible(false)
        setPromptEvent(null)
      } else {
        dismiss()
      }
    } catch {
      dismiss()
    } finally {
      setBusy(false)
    }
  }

  if (!visible || !promptEvent) return null

  return (
    <aside
      role="region"
      aria-label="Instalar Floodgate"
      className="fixed inset-x-4 bottom-4 z-[90] mx-auto max-w-md rounded-xl border border-slate-700 bg-slate-900 p-4 shadow-2xl shadow-slate-950/60 sm:left-auto sm:right-4 sm:mx-0"
    >
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="text-2xl">
          🌊
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-slate-100">
            Instala Floodgate
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Acceso rápido desde tu pantalla de inicio. El shell funciona
            offline; firmar transacciones necesita red.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void install()}
              disabled={busy}
              className="min-h-[44px] rounded-lg bg-emerald-500 px-4 text-sm font-medium text-slate-950 hover:bg-emerald-400 disabled:opacity-60"
            >
              {busy ? 'Instalando…' : 'Instalar'}
            </button>
            <button
              type="button"
              onClick={dismiss}
              className="min-h-[44px] rounded-lg border border-slate-700 px-4 text-sm text-slate-300 hover:border-slate-500"
            >
              Ahora no
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Cerrar aviso de instalación"
          className="-mr-1 -mt-1 inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-lg text-slate-500 hover:text-slate-200"
        >
          ×
        </button>
      </div>
    </aside>
  )
}
