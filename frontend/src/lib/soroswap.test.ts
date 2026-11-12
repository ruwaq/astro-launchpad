import { describe, expect, it } from 'vitest'
import {
  formatTokenPrice,
  formatUsdPrice,
  isLpFullyBurned,
  localAmountOut,
  localQuoteTokenForXlm,
  localQuoteXlmForToken,
  lpSharePercent,
  priceImpactPercent,
  SOROSWAP_MINIMUM_LIQUIDITY,
  spotAmountOut,
  tokenPriceInXlm,
  tokenPriceInXlmNumber,
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

  it('devuelve 0 si el par no existe o no hay reserva de token o xlm', () => {
    expect(tokenPriceInXlm(pool({ exists: false }), 7)).toBe(0n)
    expect(tokenPriceInXlm(pool({ reserveToken: 0n }), 7)).toBe(0n)
    expect(tokenPriceInXlm(pool({ reserveXlm: 0n }), 7)).toBe(0n)
  })

  it('calcula el precio flotante con tokenPriceInXlmNumber para fair launches de baja ratio', () => {
    // Fair launch: 10 XLM y 995M tokens
    const fairPool = pool({
      reserveToken: 995_000_000n * 10_000_000n,
      reserveXlm: 10n * 10_000_000n,
    })
    // Integer stroops trunca a 0n
    expect(tokenPriceInXlm(fairPool, 7)).toBe(0n)
    // Float representation mantiene la precisión
    const priceFloat = tokenPriceInXlmNumber(fairPool, 7)
    expect(priceFloat).toBeCloseTo(10 / 995_000_000, 12)
    expect(formatTokenPrice(priceFloat)).toBe('0.0000000101')
  })
})

describe('formato de precios sub-stroop', () => {
  it('mantiene ~3 cifras significativas sin notación científica', () => {
    expect(formatTokenPrice(5 / 995_000_000)).toBe('0.00000000503')
    expect(formatTokenPrice(1e-11)).toBe('0.00000000001')
    expect(formatTokenPrice(0.5)).toBe('0.500000')
    expect(formatTokenPrice(0)).toBe('0')
    expect(formatTokenPrice(Number.NaN)).toBe('0')
  })

  it('formatea USD sin colapsar a 0.000000 los precios de fair launch', () => {
    // 1.005e-8 XLM * 0.1555 USD ≈ 1.56e-9 USD
    expect(formatUsdPrice((10 / 995_000_000) * 0.1555)).toBe('0.00000000156')
    expect(formatUsdPrice(0.5)).toBe('0.5000')
    expect(formatUsdPrice(-1)).toBe('0')
  })
})

describe('quema de LP con MINIMUM_LIQUIDITY', () => {
  it('acepta como 100% quemado el total menos los 1000 LP bloqueados por el par', () => {
    const total = 99_498_743_710n
    expect(SOROSWAP_MINIMUM_LIQUIDITY).toBe(1_000n)
    expect(isLpFullyBurned(total - 1_000n, total)).toBe(true)
    expect(isLpFullyBurned(total, total)).toBe(true)
  })

  it('rechaza cualquier LP retirable fuera de la burn address', () => {
    const total = 99_498_743_710n
    expect(isLpFullyBurned(total - 1_001n, total)).toBe(false)
    expect(isLpFullyBurned(total / 2n, total)).toBe(false)
    expect(isLpFullyBurned(0n, total)).toBe(false)
    expect(isLpFullyBurned(0n, 0n)).toBe(false)
  })
})

describe('impacto de precio', () => {
  it('calcula la salida spot antes de comisión/slippage', () => {
    expect(spotAmountOut(10_000n, 100_000n, 50_000n)).toBe(5_000n)
    expect(spotAmountOut(0n, 100_000n, 50_000n)).toBe(0n)
    expect(spotAmountOut(10_000n, 0n, 50_000n)).toBe(0n)
  })

  it('expresa el impacto contra la salida spot SIN mezclar la comisión (30 bps)', () => {
    // Spot: 5.000 b. Spot tras fee (0.3%): 4.985 b. Salida real: 4.970 b
    // => impacto = (4.985 - 4.970) / 4.985 ≈ 0.30%. La fee sola no cuenta
    // como impacto: un trade mínimo reporta ~0 en vez de 0.3% falso.
    expect(priceImpactPercent(10_000n, 4_970n, 100_000n, 50_000n)).toBe(0.3)
    // Un trade mínimo con salida igual al spot-no-comisionado: antes reportaba
    // 0.2% de impacto falso (solo fee); ahora la fee no cuenta como impacto.
    expect(priceImpactPercent(1n, 5n, 1_000_000n, 5_000_000n)).toBe(0)
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

  it('protege contra NaN y valores negativos sin lanzar excepción', () => {
    expect(withSlippage(1_000n, Number.NaN)).toBe(980n) // Cae a default SLIPPAGE_PERCENT
    expect(withSlippage(0n, 1)).toBe(0n)
    expect(withSlippage(-500n, 1)).toBe(0n)
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

describe('local 0ms AMM quote formula', () => {
  it('matches Soroswap 997/1000 constant-product output exactly', () => {
    const p = pool({
      reserveToken: 9_950_000_000_000_000n,
      reserveXlm: 200_000_000n,
    })
    // 10 XLM (100_000_000 stroops) into 200M XLM / 9.95e15 tokens
    const buy = localQuoteXlmForToken(100_000_000n, p)
    const expected =
      (100_000_000n * 997n * 9_950_000_000_000_000n) /
      (200_000_000n * 1000n + 100_000_000n * 997n)
    expect(buy).toBe(expected)

    const sell = localQuoteTokenForXlm(10_000_000_000n, p)
    const expectedSell =
      (10_000_000_000n * 997n * 200_000_000n) /
      (9_950_000_000_000_000n * 1000n + 10_000_000_000n * 997n)
    expect(sell).toBe(expectedSell)
  })

  it('returns 0n on missing pool or non-positive amounts/reserves', () => {
    expect(localAmountOut(0n, 100n, 100n)).toBe(0n)
    expect(localAmountOut(10n, 0n, 100n)).toBe(0n)
    expect(localQuoteXlmForToken(10n, pool({ exists: false }))).toBe(0n)
    expect(localQuoteTokenForXlm(-1n, pool())).toBe(0n)
  })
})
