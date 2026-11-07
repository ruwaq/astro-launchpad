import { describe, expect, it } from 'vitest'
import { filterAndSortTokens } from './market'
import type { TokenListing } from './discovery'

function listing(
  id: string,
  symbol: string,
  ledger: number,
  reserveXlm: bigint,
  reserveToken = 100_000_000n,
): TokenListing {
  return {
    id,
    name: `Token ${symbol}`,
    symbol,
    decimals: 7,
    ledger,
    pool: {
      exists: true,
      pairId: `PAIR-${id}`,
      reserveToken,
      reserveXlm,
    },
  }
}

const TOKENS = [
  listing('CTA', 'ALPHA', 10, 50_000_000n),
  listing('CTB', 'MOON', 30, 10_000_000n),
  listing('CTC', 'ZETA', 20, 100_000_000n),
]

describe('filterAndSortTokens', () => {
  it('ordena por novedad por defecto', () => {
    expect(filterAndSortTokens(TOKENS, '', 'recent').map((t) => t.symbol)).toEqual([
      'MOON',
      'ZETA',
      'ALPHA',
    ])
  })

  it('filtra por símbolo, nombre o contrato sin distinguir mayúsculas', () => {
    expect(filterAndSortTokens(TOKENS, 'moon', 'recent')).toHaveLength(1)
    expect(filterAndSortTokens(TOKENS, 'ZETA', 'recent')[0]?.id).toBe('CTC')
    expect(filterAndSortTokens(TOKENS, 'CTA', 'recent')[0]?.symbol).toBe('ALPHA')
    expect(filterAndSortTokens(TOKENS, '  moon  ', 'recent')).toHaveLength(1)
  })

  it('ordena por liquidez, precio y símbolo', () => {
    expect(
      filterAndSortTokens(TOKENS, '', 'liquidity').map((t) => t.symbol),
    ).toEqual(['ZETA', 'ALPHA', 'MOON'])
    expect(filterAndSortTokens(TOKENS, '', 'price').map((t) => t.symbol)).toEqual([
      'ZETA',
      'ALPHA',
      'MOON',
    ])
    expect(filterAndSortTokens(TOKENS, '', 'symbol').map((t) => t.symbol)).toEqual([
      'ALPHA',
      'MOON',
      'ZETA',
    ])
  })

  it('aplica el límite después de ordenar', () => {
    expect(filterAndSortTokens(TOKENS, '', 'recent', 2)).toHaveLength(2)
    expect(filterAndSortTokens(TOKENS, '', 'recent', 2)[0]?.symbol).toBe('MOON')
  })

  it('devuelve vacío si no hay coincidencias', () => {
    expect(filterAndSortTokens(TOKENS, 'nope', 'recent')).toEqual([])
  })
})
