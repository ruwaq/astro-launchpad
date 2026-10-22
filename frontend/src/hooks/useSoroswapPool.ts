import { useQuery } from '@tanstack/react-query'
import { fetchPoolState, type PoolState } from '../lib/soroswap'

/**
 * Estado del par token/XLM en Soroswap (reservas leídas on-chain).
 * La red es la fuente de verdad: solo hay caché corta para no martillear el RPC.
 */
export function useSoroswapPool(tokenId: string | null) {
  return useQuery({
    queryKey: ['soroswap-pool', tokenId],
    queryFn: async (): Promise<PoolState> => fetchPoolState(tokenId as string),
    enabled: Boolean(tokenId),
    staleTime: 10_000,
  })
}
