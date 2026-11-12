import { useQuery } from '@tanstack/react-query'
import { fetchPoolState, type PoolState } from '../lib/soroswap'

/**
 * State of the token/XLM pair on Soroswap (reserves read directly on-chain).
 * Network is the source of truth: uses a short cache to avoid hammering the RPC.
 */
export function useSoroswapPool(tokenId: string | null) {
  return useQuery({
    queryKey: ['soroswap-pool', tokenId],
    queryFn: async (): Promise<PoolState> => fetchPoolState(tokenId as string),
    enabled: Boolean(tokenId),
    staleTime: 10_000,
    // The local chart needs periodic readings while the tab is active.
    // TanStack only refreshes active queries, avoiding background polling
    // on inactive pages.
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  })
}
