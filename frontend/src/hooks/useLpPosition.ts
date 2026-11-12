import { useQuery } from '@tanstack/react-query'
import { fetchLpPosition } from '../lib/soroswap'

/**
 * Account's liquidity position in the token/XLM pair.
 * Refreshes frequently because pool reserves shift with every swap.
 */
export function useLpPosition(tokenId: string | null, account: string | null) {
  return useQuery({
    queryKey: ['lp-position', tokenId, account],
    queryFn: () => fetchLpPosition(tokenId as string, account as string),
    enabled: Boolean(tokenId && account),
    staleTime: 10_000,
  })
}
