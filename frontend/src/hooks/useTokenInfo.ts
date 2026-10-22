import { useQuery } from '@tanstack/react-query'
import { astroTokenClient } from '../lib/token'

export type TokenInfo = {
  name: string
  symbol: string
  decimals: number
  totalSupply: bigint
}

/** Metadata del token leída on-chain (sin caché propia: la red es la fuente). */
export function useTokenInfo() {
  return useQuery({
    queryKey: ['token-info'],
    queryFn: async (): Promise<TokenInfo> => {
      const client = astroTokenClient()
      const [name, symbol, decimals, totalSupply] = await Promise.all([
        client.name(),
        client.symbol(),
        client.decimals(),
        client.total_supply(),
      ])
      return {
        name: name.result,
        symbol: symbol.result,
        decimals: decimals.result,
        totalSupply: totalSupply.result,
      }
    },
    staleTime: 15_000,
  })
}
