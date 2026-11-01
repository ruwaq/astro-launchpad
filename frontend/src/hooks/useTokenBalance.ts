import { useQuery } from '@tanstack/react-query'
import { ASTRO_TOKEN_ID } from '../lib/network'
import { fetchTokenBalance } from '../lib/token'

/** Balance SEP-41 de una cuenta para un token (por defecto, el de ejemplo). */
export function useTokenBalance(
  account: string | null,
  contractId: string = ASTRO_TOKEN_ID,
) {
  return useQuery({
    queryKey: ['token-balance', contractId, account],
    queryFn: () => fetchTokenBalance(contractId, account as string),
    enabled: Boolean(account && contractId),
    staleTime: 10_000,
  })
}
