import { useQuery } from '@tanstack/react-query'
import { fetchTokenEvents, type TokenEvent } from '../lib/token-events'

/**
 * Movimientos recientes del contrato del token. Es una lectura directa del
 * RPC con ventana limitada; no hay backend ni indexer.
 */
export function useTokenEvents(tokenId: string | null) {
  return useQuery({
    queryKey: ['token-events', tokenId],
    queryFn: async (): Promise<TokenEvent[]> =>
      fetchTokenEvents(tokenId as string),
    enabled: Boolean(tokenId),
    staleTime: 30_000,
    refetchInterval: 120_000,
    refetchIntervalInBackground: false,
    retry: 1,
  })
}
