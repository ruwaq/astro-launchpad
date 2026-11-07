import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react'
import {
  getSnapshots,
  recordSnapshot,
  subscribeSnapshots,
  SNAPSHOT_BUCKET_MS,
  type ReserveSnapshot,
} from '../lib/snapshots'
import { reconstructSnapshotsFromEvents } from '../lib/token-events'
import { useTokenEvents } from './useTokenEvents'
import type { PoolState } from '../lib/soroswap'

const EMPTY_SNAPSHOTS: ReserveSnapshot[] = []

/**
 * Historial del par combinando:
 * 1. Reconstrucción on-chain de compras y ventas contra el contrato del par
 *    usando los eventos SEP-41 `transfer` + invariante x * y = k.
 * 2. Snapshots locales guardados en este navegador (`localStorage`).
 */
export function useReserveHistory(
  tokenId: string,
  pool: PoolState | undefined,
): ReserveSnapshot[] {
  const events = useTokenEvents(tokenId)
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

  return useMemo(() => {
    const onChain = reconstructSnapshotsFromEvents(events.data ?? [], pool)
    if (onChain.length >= 2 && onChain.length >= snapshots.length) {
      return onChain
    }
    return snapshots.length > 0 ? snapshots : onChain
  }, [events.data, pool, snapshots])
}
