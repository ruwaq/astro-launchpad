import { useQuery } from '@tanstack/react-query'
import { discoverTokens, type TokenListing } from '../lib/discovery'

/**
 * Tokens recientes con par en XLM, descubiertos desde los eventos de la
 * factory de Soroswap. Sin backend: la red es la fuente de verdad.
 */
export function useTokenList() {
  return useQuery<TokenListing[]>({
    queryKey: ['token-list'],
    queryFn: () => discoverTokens(),
    staleTime: 60_000,
    retry: 1,
  })
}
