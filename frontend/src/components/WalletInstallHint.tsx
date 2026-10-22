import { useEffect, useState } from 'react'
import { detectWallets, withRecommendation } from '../lib/wallets'
import type { ISupportedWallet } from '@creit.tech/stellar-wallets-kit'
import { useWallet } from '../store/wallet'

type DetectionState = {
  done: boolean
  available: ISupportedWallet[]
  notInstalled: ISupportedWallet[]
}

const initial: DetectionState = { done: false, available: [], notInstalled: [] }

/** Datos deterministas para el smoke de render (los effects no corren en SSR). */
const PREVIEW_FOUND: DetectionState = {
  done: true,
  available: [
    {
      id: 'freighter',
      name: 'Freighter',
      type: 'HOT_WALLET',
      isAvailable: true,
      isPlatformWrapper: false,
      icon: '',
      url: 'https://freighter.app',
    },
  ],
  notInstalled: [],
}

const PREVIEW_MISSING: DetectionState = {
  done: true,
  available: [],
  notInstalled: [
    {
      id: 'freighter',
      name: 'Freighter',
      type: 'HOT_WALLET',
      isAvailable: false,
      isPlatformWrapper: false,
      icon: '',
      url: 'https://freighter.app',
    },
    {
      id: 'xbull',
      name: 'xBull',
      type: 'HOT_WALLET',
      isAvailable: false,
      isPlatformWrapper: false,
      icon: '',
      url: 'https://xbull.app',
    },
    {
      id: 'lobstr',
      name: 'LOBSTR',
      type: 'HOT_WALLET',
      isAvailable: false,
      isPlatformWrapper: false,
      icon: '',
      url: 'https://lobstr.co',
    },
  ],
}

type Props = {
  /** Solo para tests: fuerza el estado y salta la detección real. */
  preview?: 'found' | 'missing'
}

/**
 * Detección de wallet al cargar + recomendación de instalación.
 *
 * - Si hay wallet detectada: aviso verde con su nombre (conectar con el
 *   botón del header).
 * - Si no hay: tarjetas con el link oficial de descarga (Freighter
 *   recomendada, xBull, LOBSTR…) y nota móvil vía WalletConnect.
 */
export function WalletInstallHint({ preview }: Props) {
  const { publicKey } = useWallet()
  const [state, setState] = useState<DetectionState>(
    preview === 'found'
      ? PREVIEW_FOUND
      : preview === 'missing'
        ? PREVIEW_MISSING
        : initial,
  )

  useEffect(() => {
    if (preview) return
    let alive = true
    detectWallets()
      .then((detection) => {
        if (alive) setState({ done: true, ...detection })
      })
      .catch(() => {
        if (alive) setState({ done: true, available: [], notInstalled: [] })
      })
    return () => {
      alive = false
    }
  }, [preview])

  if (publicKey || !state.done) return null

  if (state.available.length > 0) {
    const first = withRecommendation(state.available)[0]
    return (
      <p className="inline-flex w-fit items-center gap-2 rounded-lg border border-emerald-900 bg-emerald-950/30 px-3 py-2 text-sm text-emerald-300">
        ✓ Wallet detectada: <strong>{first.label}</strong> — lista para
        conectar.
      </p>
    )
  }

  const recommended = withRecommendation(state.notInstalled).slice(0, 3)
  if (recommended.length === 0) return null

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
      <p className="text-sm text-slate-300">
        No detectamos ninguna wallet en este navegador. Instala una para firmar
        en testnet:
      </p>
      <ul className="mt-2 grid gap-2 sm:grid-cols-3">
        {recommended.map((wallet) => (
          <li key={wallet.id}>
            <a
              href={wallet.url}
              target="_blank"
              rel="noreferrer"
              className="block h-full min-h-[52px] rounded-lg border border-slate-800 p-3 text-left transition-colors hover:border-emerald-700"
            >
              <span className="text-sm font-medium text-slate-100">
                {wallet.label}
              </span>
              <span className="mt-0.5 block text-xs text-slate-400">
                {wallet.why}
              </span>
              <span className="mt-1 block text-xs text-emerald-400">
                Descargar ↗
              </span>
            </a>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-slate-500">
        En el móvil, las apps como Freighter Mobile se conectan vía
        WalletConnect (QR) — se activa con un projectId de Reown.
      </p>
    </div>
  )
}
