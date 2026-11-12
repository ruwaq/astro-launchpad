import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_XLM_USD_PRICE,
  fetchXlmBalance,
  fetchXlmBalanceRaw,
  fetchXlmBalanceStroops,
  xlmToStroops,
} from './xlm'

afterEach(() => {
  vi.unstubAllGlobals()
  if (typeof localStorage !== 'undefined') localStorage.clear()
})

describe('xlmToStroops', () => {
  it('convierte XLM a stroops sin decimales flotantes', () => {
    expect(xlmToStroops(1)).toBe(10_000_000n)
    expect(xlmToStroops('1')).toBe(10_000_000n)
    expect(xlmToStroops(0.1)).toBe(1_000_000n)
    expect(xlmToStroops('0.1')).toBe(1_000_000n)
    expect(xlmToStroops(0.29)).toBe(2_900_000n)
    expect(xlmToStroops('0.29')).toBe(2_900_000n)
    expect(xlmToStroops(0.0000001)).toBe(1n)
    expect(xlmToStroops('0.0000001')).toBe(1n)
    expect(xlmToStroops(10_000)).toBe(100_000_000_000n)
    expect(xlmToStroops('10,000')).toBe(100_000_000_000n)
  })

  it('devuelve 0 para valores inválidos o no positivos', () => {
    expect(xlmToStroops(0)).toBe(0n)
    expect(xlmToStroops(-1)).toBe(0n)
    expect(xlmToStroops(Number.NaN)).toBe(0n)
    expect(xlmToStroops(Number.POSITIVE_INFINITY)).toBe(0n)
  })
})

describe('fetchXlmBalance', () => {
  it('resuelve 0 para cuentas aún inexistentes (Horizon 404)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('resource missing', { status: 404 })),
    )
    await expect(fetchXlmBalance('GTEST')).resolves.toBe(0)
  })

  it('lanza error para fallos de Horizon distintos de 404 (no simula balance 0)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('server error', { status: 500 })),
    )
    await expect(fetchXlmBalance('GTEST')).rejects.toThrow('500')
  })

  it('extrae el balance nativo sobre una respuesta 200', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            balances: [
              { asset_type: 'credit_alphanum4', balance: '1.0' },
              { asset_type: 'native', balance: '42.5' },
            ],
          }),
          { status: 200 },
        ),
      ),
    )
    await expect(fetchXlmBalance('GTEST')).resolves.toBe(42.5)
    await expect(fetchXlmBalanceRaw('GTEST')).resolves.toBe('42.5')
    await expect(fetchXlmBalanceStroops('GTEST')).resolves.toBe(425_000_000n)
  })
})

describe('fetchXlmUsdPrice', () => {
  it('cae al precio por defecto cuando todos los oracles fallan', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('boom', { status: 503 })),
    )
    const { fetchXlmUsdPrice } = await import('./xlm')
    await expect(fetchXlmUsdPrice()).resolves.toBe(DEFAULT_XLM_USD_PRICE)
  })
})
