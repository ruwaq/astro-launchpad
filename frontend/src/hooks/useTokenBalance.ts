import { useQuery } from '@tanstack/react-query'
import { ASTRO_TOKEN_ID } from '../lib/network'
import { fetchTokenBalance } from '../lib/token'

/** SEP-41 token balance for an account (defaults to the example ASTRO token). */
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
