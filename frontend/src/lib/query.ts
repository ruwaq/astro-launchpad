import type { QueryClient } from '@tanstack/react-query'

/**
 * Invalida los datos que cambian tras transferir, quemar o emitir:
 * balances (de todas las cuentas), metadata/supply y XLM de las cuentas demo
 * (las fees de testnet también se descuentan).
 */
export async function invalidateTokenData(
  queryClient: QueryClient,
  tokenId: string,
) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['token-balance', tokenId] }),
    queryClient.invalidateQueries({ queryKey: ['token-info', tokenId] }),
    queryClient.invalidateQueries({ queryKey: ['token-events', tokenId] }),
    queryClient.invalidateQueries({ queryKey: ['demo-xlm-balances'] }),
  ])
}
