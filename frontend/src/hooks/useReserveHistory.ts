import { useCallback, useEffect, useSyncExternalStore } from 'react'
import {
  getSnapshots,
  recordSnapshot,
  subscribeSnapshots,
  SNAPSHOT_BUCKET_MS,
  type ReserveSnapshot,
} from '../lib/snapshots'
import type { PoolState } from '../lib/soroswap'

const EMPTY_SNAPSHOTS: ReserveSnapshot[] = []

/**
 * Historial local del par. No es un indexer: solo registra las lecturas que
 * esta pestaña ha hecho del pool. El gráfico lo dice explícitamente.
 */
export function useReserveHistory(
  tokenId: string,
  pool: PoolState | undefined,
): ReserveSnapshot[] {
  const subscribe = useCallback(
    (onChange: () => void) => subscribeSnapshots(tokenId, onChange),
    [tokenId],
  )
  const getSnapshot = useCallback(() => getSnapshots(tokenId), [tokenId])
  const snapshots = useSyncExternalStore(
    subscribe,
    getSnapshot,
    () => EMPTY_SNAPSHOTS,
  )

  const exists = pool?.exists ?? false
  const reserveXlm = pool?.reserveXlm
  const reserveToken = pool?.reserveToken

  useEffect(() => {
    if (
      !tokenId.startsWith('C') ||
      !exists ||
      reserveXlm === undefined ||
      reserveToken === undefined ||
      reserveToken <= 0n
    ) {
      return
    }

    // Registro inmediato al abrir o al cambiar las reservas.
    recordSnapshot(tokenId, reserveXlm, reserveToken)

    // Y un pulso cada bucket mientras el token siga montado, aunque las
    // reservas no cambien. Así una línea plana también tiene historia.
    const timer = window.setInterval(() => {
      recordSnapshot(tokenId, reserveXlm, reserveToken)
    }, SNAPSHOT_BUCKET_MS)
    return () => window.clearInterval(timer)
  }, [tokenId, exists, reserveXlm, reserveToken])

  return snapshots
}
