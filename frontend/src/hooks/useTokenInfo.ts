import { useQuery } from '@tanstack/react-query'
import { ASTRO_TOKEN_ID } from '../lib/network'
import { tokenClient } from '../lib/token'

export type TokenInfo = {
  name: string
  symbol: string
  decimals: number
  totalSupply: bigint
  owner: string | null
}

/** Metadata del token leída on-chain (sin caché propia: la red es la fuente). */
export function useTokenInfo(contractId: string = ASTRO_TOKEN_ID) {
  return useQuery({
    queryKey: ['token-info', contractId],
    enabled: Boolean(contractId),
    queryFn: async (): Promise<TokenInfo> => {
      const client = tokenClient(contractId)
      const [name, symbol, decimals, totalSupply, owner] = await Promise.all([
        client.name(),
        client.symbol(),
        client.decimals(),
        client.total_supply(),
        client.get_owner(),
      ])
      return {
        name: name.result,
        symbol: symbol.result,
        decimals: decimals.result,
        totalSupply: totalSupply.result,
        owner: owner.result,
      }
    },
    staleTime: 15_000,
  })
}
