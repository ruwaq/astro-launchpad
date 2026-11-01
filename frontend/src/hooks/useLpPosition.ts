import { useQuery } from '@tanstack/react-query'
import { fetchLpPosition } from '../lib/soroswap'

/**
 * Posición de liquidez de la cuenta en el par token/XLM.
 * Se refresca a menudo porque las reservas cambian con cada swap.
 */
export function useLpPosition(tokenId: string | null, account: string | null) {
  return useQuery({
    queryKey: ['lp-position', tokenId, account],
    queryFn: () => fetchLpPosition(tokenId as string, account as string),
    enabled: Boolean(tokenId && account),
    staleTime: 10_000,
  })
}
