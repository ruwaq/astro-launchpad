import { describe, expect, it } from 'vitest'
import { xlmToStroops } from './xlm'

describe('xlmToStroops', () => {
  it('convierte XLM a stroops sin decimales flotantes', () => {
    expect(xlmToStroops(1)).toBe(10_000_000n)
    expect(xlmToStroops(0.1)).toBe(1_000_000n)
    expect(xlmToStroops(0.29)).toBe(2_900_000n)
    expect(xlmToStroops(0.0000001)).toBe(1n)
    expect(xlmToStroops(10_000)).toBe(100_000_000_000n)
  })

  it('devuelve 0 para valores inválidos o no positivos', () => {
    expect(xlmToStroops(0)).toBe(0n)
    expect(xlmToStroops(-1)).toBe(0n)
    expect(xlmToStroops(Number.NaN)).toBe(0n)
    expect(xlmToStroops(Number.POSITIVE_INFINITY)).toBe(0n)
  })
})
