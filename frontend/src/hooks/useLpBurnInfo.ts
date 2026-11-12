import { useQuery } from '@tanstack/react-query'
import { fetchBurnedLpInfo } from '../lib/soroswap'

/**
 * LP del par quemados en la burn address canónica. Es la única prueba
 * on-chain de que la liquidez no se puede retirar (ver `rugProofStatus`).
 */
export function useLpBurnInfo(pairId: string | null | undefined) {
  return useQuery({
    queryKey: ['lp-burn', pairId],
    queryFn: () => fetchBurnedLpInfo(pairId ?? ''),
    enabled: Boolean(pairId),
    staleTime: 60_000,
  })
}
