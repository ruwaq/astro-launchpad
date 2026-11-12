import { useQuery } from '@tanstack/react-query'
import { discoverTokens, type TokenListing } from '../lib/discovery'

/**
 * Recent tokens paired with XLM, discovered via Soroswap
 * Factory events. Zero-backend: network is the source of truth.
 */
export function useTokenList() {
  return useQuery<TokenListing[]>({
    queryKey: ['token-list'],
    queryFn: () => discoverTokens(),
    staleTime: 60_000,
    retry: 1,
  })
}
