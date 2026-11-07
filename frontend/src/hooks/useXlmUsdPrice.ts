import { useQuery } from '@tanstack/react-query'
import { DEFAULT_XLM_USD_PRICE, fetchXlmUsdPrice } from '../lib/xlm'

export function useXlmUsdPrice() {
  return useQuery({
    queryKey: ['xlm-usd-price'],
    queryFn: fetchXlmUsdPrice,
    staleTime: 5 * 60_000,
    placeholderData: DEFAULT_XLM_USD_PRICE,
  })
}
