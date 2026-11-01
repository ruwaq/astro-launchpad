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
    // El gráfico local necesita lecturas periódicas mientras la pestaña está
    // abierta. TanStack solo refresca queries activas, así que no hay polling
    // de fondo en otras páginas.
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  })
}
