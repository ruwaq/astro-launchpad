import { describe, expect, it } from 'vitest'
import {
  lpSharePercent,
  priceImpactPercent,
  spotAmountOut,
  tokenPriceInXlm,
  unwrapResult,
  withSlippage,
  withdrawPreview,
  type PoolState,
} from './soroswap'

function pool(overrides: Partial<PoolState> = {}): PoolState {
  return {
    exists: true,
    pairId: 'CPAIR',
    reserveToken: 100_000_000n, // 10 tokens con 7 decimales
    reserveXlm: 50_000_000n, // 5 XLM
    ...overrides,
  }
}

describe('tokenPriceInXlm', () => {
  it('calcula el precio con las reservas del par', () => {
    // 5 XLM / 10 tokens = 0.5 XLM = 5_000_000 stroops.
    expect(tokenPriceInXlm(pool(), 7)).toBe(5_000_000n)
  })

  it('devuelve 0 si el par no existe o no hay reserva de token', () => {
    expect(tokenPriceInXlm(pool({ exists: false }), 7)).toBe(0n)
    expect(tokenPriceInXlm(pool({ reserveToken: 0n }), 7)).toBe(0n)
  })
})

describe('impacto de precio', () => {
  it('calcula la salida spot antes de comisión/slippage', () => {
    expect(spotAmountOut(10_000n, 100_000n, 50_000n)).toBe(5_000n)
    expect(spotAmountOut(0n, 100_000n, 50_000n)).toBe(0n)
    expect(spotAmountOut(10_000n, 0n, 50_000n)).toBe(0n)
  })

  it('expresa el impacto contra la salida spot', () => {
    // Spot: 5.000 XLM. Salida real: 4.970 XLM => 0.6% de impacto.
    expect(priceImpactPercent(10_000n, 4_970n, 100_000n, 50_000n)).toBe(0.6)
  })

  it('no inventa impacto si no hay cotización o el precio mejora', () => {
    expect(priceImpactPercent(10_000n, 0n, 100_000n, 50_000n)).toBe(0)
    expect(priceImpactPercent(10_000n, 5_100n, 100_000n, 50_000n)).toBe(0)
    expect(priceImpactPercent(0n, 0n, 100_000n, 50_000n)).toBe(0)
  })
})

describe('withSlippage', () => {
  it('aplica el porcentaje de slippage por defecto y soporta decimales (bps)', () => {
    expect(withSlippage(1_000n)).toBe(980n)
    expect(withSlippage(1_000n, 0.5)).toBe(995n)
    expect(withSlippage(1_000n, 1)).toBe(990n)
    expect(withSlippage(1_000n, 5)).toBe(950n)
    expect(withSlippage(1_000n, 0)).toBe(1_000n)
    expect(withSlippage(1_000n, 100)).toBe(0n)
  })
})

describe('lpSharePercent', () => {
  it('calcula la parte del pool con dos decimales', () => {
    expect(lpSharePercent(250n, 1_000n)).toBe(25)
    expect(lpSharePercent(1n, 3n)).toBe(33.33)
  })

  it('evita dividir por cero', () => {
    expect(lpSharePercent(1n, 0n)).toBe(0)
  })
})

describe('withdrawPreview', () => {
  it('reparte las reservas en proporción a los LP', () => {
    const preview = withdrawPreview(
      { totalSupply: 1_000n, reserveToken: 5_000n, reserveXlm: 2_500n },
      250n,
    )
    expect(preview.tokenAmount).toBe(1_250n)
    expect(preview.xlmAmount).toBe(625n)
  })

  it('devuelve 0 con datos inválidos', () => {
    expect(
      withdrawPreview(
        { totalSupply: 0n, reserveToken: 5_000n, reserveXlm: 2_500n },
        250n,
      ),
    ).toEqual({ tokenAmount: 0n, xlmAmount: 0n })
    expect(
      withdrawPreview(
        { totalSupply: 1_000n, reserveToken: 5_000n, reserveXlm: 2_500n },
        0n,
      ),
    ).toEqual({ tokenAmount: 0n, xlmAmount: 0n })
  })
})

describe('unwrapResult', () => {
  it('desenvuelve un Result OK', () => {
    const ok = {
      isErr: () => false,
      unwrap: () => 42,
    }
    expect(unwrapResult<number>(ok, 'operación')).toBe(42)
  })

  it('lanza el mensaje on-chain en un Result de error', () => {
    const err = {
      isErr: () => true,
      unwrapErr: () => ({ message: 'insufficient liquidity' }),
      unwrap: () => {
        throw new Error('no debería llamarse')
      },
    }
    expect(() => unwrapResult(err, 'swap')).toThrow(
      'swap: insufficient liquidity',
    )
  })

  it('acepta valores ya desenvueltos por el SDK', () => {
    expect(unwrapResult<string>('directo', 'x')).toBe('directo')
  })
})
