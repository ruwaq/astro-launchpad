import { useQuery } from '@tanstack/react-query'
import {
  getCachedTokenMetadata,
  setCachedTokenMetadata,
} from '../lib/discovery'
import { ASTRO_TOKEN_ID } from '../lib/network'
import { tokenClient } from '../lib/token'

export type TokenInfo = {
  name: string
  symbol: string
  decimals: number
  totalSupply: bigint
  owner: string | null
}

/**
 * Metadata y estado del token leídos on-chain.
 * Reutiliza la metadata inmutable SEP-41 (`name`, `symbol`, `decimals`) si ya
 * se leyó antes, ahorrando 3 simulaciones RPC en cada recarga.
 */
export function useTokenInfo(contractId: string = ASTRO_TOKEN_ID) {
  return useQuery({
    queryKey: ['token-info', contractId],
    enabled: Boolean(contractId),
    queryFn: async (): Promise<TokenInfo> => {
      const client = tokenClient(contractId)
      const cachedMeta = getCachedTokenMetadata(contractId)

      if (cachedMeta) {
        const [totalSupply, owner] = await Promise.all([
          client.total_supply(),
          client.get_owner(),
        ])
        return {
          ...cachedMeta,
          totalSupply: totalSupply.result,
          owner: owner.result,
        }
      }

      const [name, symbol, decimals, totalSupply, owner] = await Promise.all([
        client.name(),
        client.symbol(),
        client.decimals(),
        client.total_supply(),
        client.get_owner(),
      ])
      const meta = {
        name: name.result,
        symbol: symbol.result,
        decimals: decimals.result,
      }
      setCachedTokenMetadata(contractId, meta)
      return {
        ...meta,
        totalSupply: totalSupply.result,
        owner: owner.result,
      }
    },
    staleTime: 15_000,
  })
}
