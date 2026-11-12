import { useQuery } from '@tanstack/react-query'
import { fetchXlmBalance } from '../lib/xlm'

/** Native XLM balance of the active account (real wallet or demo). */
export function useXlmBalance(account: string | null) {
  return useQuery({
    queryKey: ['xlm-balance', account],
    queryFn: () => fetchXlmBalance(account as string),
    enabled: Boolean(account),
    staleTime: 15_000,
  })
}
