import { tokenPriceInXlm } from './soroswap'
import type { TokenListing } from './discovery'

export type MarketSortKey = 'recent' | 'liquidity' | 'price' | 'symbol'

export const MARKET_SORT_OPTIONS: Array<{
  value: MarketSortKey
  label: string
}> = [
  { value: 'recent', label: 'Most Recent' },
  { value: 'liquidity', label: 'Highest Liquidity' },
  { value: 'price', label: 'Highest Price' },
  { value: 'symbol', label: 'Symbol A–Z' },
]

function compareBigInt(a: bigint, b: bigint): number {
  if (a === b) return 0
  return a > b ? -1 : 1
}

/**
 * Pure filter & sort logic in memory.
 */
export function filterAndSortTokens(
  tokens: TokenListing[],
  query: string,
  sort: MarketSortKey,
  limit?: number,
): TokenListing[] {
  const search = query.trim().toLowerCase()
  const filtered = search
    ? tokens.filter((token) =>
        `${token.symbol} ${token.name} ${token.id}`
          .toLowerCase()
          .includes(search),
      )
    : tokens

  const sorted = [...filtered].sort((a, b) => {
    switch (sort) {
      case 'liquidity':
        return compareBigInt(a.pool.reserveXlm, b.pool.reserveXlm)
      case 'price':
        return compareBigInt(
          tokenPriceInXlm(a.pool, a.decimals),
          tokenPriceInXlm(b.pool, b.decimals),
        )
      case 'symbol':
        return a.symbol.localeCompare(b.symbol)
      case 'recent':
      default:
        return b.ledger - a.ledger
    }
  })

  return limit ? sorted.slice(0, limit) : sorted
}
