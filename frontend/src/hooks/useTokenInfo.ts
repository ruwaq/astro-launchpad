import { useQuery } from '@tanstack/react-query'
import {
  fetchLaunchpadRecord,
  getCachedTokenMetadata,
  setCachedTokenMetadata,
} from '../lib/discovery'
import { ASTRO_TOKEN_ID, executeWithRpcFailover } from '../lib/network'
import { tokenClient } from '../lib/token'

export type TokenInfo = {
  name: string
  symbol: string
  decimals: number
  totalSupply: bigint
  owner: string | null
  /**
   * `false` cuando el contrato no expone `get_owner()` (SEP-41 estándar de
   * terceros, p. ej. pares descubiertos en la factory de Soroswap). En ese
   * caso `owner === null` NO significa "renunciado", sino "desconocido".
   */
  ownerSupported: boolean
  creator?: string
  verifiedLaunchpad?: boolean
  launchIndex?: number
  launchLedger?: number
}

type TokenReader = ReturnType<typeof tokenClient>

/**
 * Lee el owner sin tumbar la página: un token SEP-41 que no implementa
 * `get_owner()` se marca como `ownerSupported: false` (fail-closed: la UI
 * no puede presumir que la propiedad está renunciada).
 */
async function readOwner(
  client: TokenReader,
): Promise<{ owner: string | null; ownerSupported: boolean }> {
  try {
    const tx = await client.get_owner()
    return { owner: tx.result ?? null, ownerSupported: true }
  } catch {
    return { owner: null, ownerSupported: false }
  }
}

/**
 * Token metadata and state read on-chain.
 * Reuses immutable SEP-41 metadata (`name`, `symbol`, `decimals`) if
 * previously read, saving 3 RPC simulations on each reload.
 */
export function useTokenInfo(contractId: string = ASTRO_TOKEN_ID) {
  return useQuery({
    queryKey: ['token-info', contractId],
    enabled: Boolean(contractId),
    queryFn: async (): Promise<TokenInfo> => {
      const cachedMeta = getCachedTokenMetadata(contractId)
      const [tokenMeta, launch] = await Promise.all([
        executeWithRpcFailover(async (rpcUrl) => {
          const client = tokenClient(contractId, undefined, rpcUrl)
          if (cachedMeta) {
            const [totalSupply, ownerInfo] = await Promise.all([
              client.total_supply(),
              readOwner(client),
            ])
            return {
              ...cachedMeta,
              totalSupply: totalSupply.result,
              ...ownerInfo,
            }
          }

          const [name, symbol, decimals, totalSupply, ownerInfo] =
            await Promise.all([
              client.name(),
              client.symbol(),
              client.decimals(),
              client.total_supply(),
              readOwner(client),
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
            ...ownerInfo,
          }
        }),
        fetchLaunchpadRecord(contractId),
      ])

      return {
        ...tokenMeta,
        ...(launch
          ? {
              creator: launch.creator,
              verifiedLaunchpad: true,
              launchLedger: launch.ledger,
            }
          : {}),
      }
    },
    staleTime: 15_000,
  })
}
