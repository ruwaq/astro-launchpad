import { useOnlineStatus } from '../hooks/useOnlineStatus'

/**
 * Aviso explícito cuando no hay red. El shell puede abrir desde caché y el
 * historial local sigue visible, pero RPC/wallet no funcionan offline.
 */
export function OfflineBanner() {
  const online = useOnlineStatus()
  if (online) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="border-b border-amber-900/60 bg-amber-950/60 px-4 py-2 text-center text-xs text-amber-200"
    >
      Sin conexión: puedes abrir la app y ver tu historial local, pero los datos
      on-chain y las operaciones necesitan red.
    </div>
  )
}
