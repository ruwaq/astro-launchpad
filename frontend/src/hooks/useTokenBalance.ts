import { useQuery } from '@tanstack/react-query'
import { ASTRO_TOKEN_ID } from '../lib/network'
import { tokenClient } from '../lib/token'

/** Balance SEP-41 de una cuenta para un token (por defecto, el de ejemplo). */
export function useTokenBalance(
  account: string | null,
  contractId: string = ASTRO_TOKEN_ID,
) {
  return useQuery({
    queryKey: ['token-balance', contractId, account],
    queryFn: async (): Promise<bigint> => {
      const client = tokenClient(contractId)
      const tx = await client.balance({ account: account as string })
      return tx.result
    },
    enabled: Boolean(account),
    staleTime: 10_000,
  })
}
