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
 * Pool history combining:
 * 1. On-chain reconstruction of buys and sells against the pair contract
 *    using SEP-41 `transfer` events + constant product invariant x * y = k.
 * 2. Local snapshots stored in browser storage.
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

    // Immediate snapshot upon opening or whenever reserves update.
    recordSnapshot(tokenId, reserveXlm, reserveToken)

    // Periodic pulse every bucket while the token page is active, even if
    // reserves remain constant. This ensures flatline periods show historical span.
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
