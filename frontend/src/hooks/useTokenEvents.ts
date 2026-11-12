import { useQuery } from '@tanstack/react-query'
import { fetchTokenEvents, type TokenEvent } from '../lib/token-events'

/**
 * Recent movements of the token contract. Direct read from
 * RPC with a limited window; no backend or indexer required.
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
