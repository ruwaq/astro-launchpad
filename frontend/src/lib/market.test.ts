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

  it('ordena por liquidez, graduación, precio y símbolo', () => {
    expect(
      filterAndSortTokens(TOKENS, '', 'liquidity').map((t) => t.symbol),
    ).toEqual(['ZETA', 'ALPHA', 'MOON'])
    expect(
      filterAndSortTokens(TOKENS, '', 'graduation').map((t) => t.symbol),
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

  it('prioritizes tokens actively racing toward graduation over already graduated tokens and puts unseeded at the bottom', () => {
    const graduated = listing('CT_GRAD', 'GRAD', 5, 25_000_000_000n) // 2500 XLM (> 2000 XLM target)
    const inFlight = listing('CT_RACE', 'RACE', 5, 15_000_000_000n) // 1500 XLM (< 2000 XLM target)
    const unseeded = listing('CT_ZERO', 'ZERO', 5, 0n) // 0 XLM unseeded
    const sorted = filterAndSortTokens([unseeded, graduated, inFlight], '', 'graduation')
    expect(sorted.map((t) => t.symbol)).toEqual(['RACE', 'GRAD', 'ZERO'])
  })

  it('correctly sorts low-ratio fair launch tokens by price without integer stroop underflow', () => {
    // 995M supply, both prices < 1 stroop per token
    const tokenLow = listing('CT_LOW', 'LOW', 5, 10n * 10_000_000n, 995_000_000n * 10_000_000n) // 10 XLM
    const tokenHigh = listing('CT_HIGH', 'HIGH', 5, 50n * 10_000_000n, 995_000_000n * 10_000_000n) // 50 XLM
    const sorted = filterAndSortTokens([tokenLow, tokenHigh], '', 'price')
    expect(sorted.map((t) => t.symbol)).toEqual(['HIGH', 'LOW'])
  })

  it('aplica el límite después de ordenar', () => {
    expect(filterAndSortTokens(TOKENS, '', 'recent', 2)).toHaveLength(2)
    expect(filterAndSortTokens(TOKENS, '', 'recent', 2)[0]?.symbol).toBe('MOON')
  })

  it('devuelve vacío si no hay coincidencias', () => {
    expect(filterAndSortTokens(TOKENS, 'nope', 'recent')).toEqual([])
  })
})
