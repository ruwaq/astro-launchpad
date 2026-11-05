import { useOnlineStatus } from '../hooks/useOnlineStatus'

/**
 * Banner shown when offline.
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
      Offline mode: cached app and local history are accessible, but on-chain transactions require an active network connection.
    </div>
  )
}
