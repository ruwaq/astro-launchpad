import { useQuery } from '@tanstack/react-query'
import { fetchTokenShouts, type TokenShout } from '../lib/token-events'

/**
 * On-chain Burn-to-Chat messages recorded inside Launchpad's persistent log.
 */
export function useTokenShouts(tokenId: string | null) {
  return useQuery({
    queryKey: ['token-shouts', tokenId],
    queryFn: async (): Promise<TokenShout[]> =>
      fetchTokenShouts(tokenId as string),
    enabled: Boolean(tokenId),
    staleTime: 15_000,
    refetchInterval: 45_000,
    refetchIntervalInBackground: false,
    retry: 1,
  })
}
