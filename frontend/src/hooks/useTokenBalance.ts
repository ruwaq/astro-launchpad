import { useQuery } from '@tanstack/react-query'
import { astroTokenClient } from '../lib/token'

/** Balance SEP-41 de una cuenta para el token desplegado. */
export function useTokenBalance(account: string | null) {
  return useQuery({
    queryKey: ['token-balance', account],
    queryFn: async (): Promise<bigint> => {
      const client = astroTokenClient()
      const tx = await client.balance({ account: account as string })
      return tx.result
    },
    enabled: Boolean(account),
    staleTime: 10_000,
  })
}
