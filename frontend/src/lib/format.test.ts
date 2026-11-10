import { describe, expect, it } from 'vitest'
import {
  errorMessage,
  formatAmount,
  parseAmount,
  sanitizeHttpUrl,
  sanitizeTelegramUrl,
  sanitizeTwitterUrl,
  shortAddress,
} from './format'

describe('formatAmount', () => {
  it('convierte base units a decimal legible', () => {
    expect(formatAmount(12_345_670n, 7)).toBe('1.234567')
    expect(formatAmount(10_000_000n, 7)).toBe('1')
    expect(formatAmount(1n, 7)).toBe('0.0000001')
    expect(formatAmount(0n, 7)).toBe('0')
  })

  it('respeta tokens sin decimales', () => {
    expect(formatAmount(42n, 0)).toBe('42')
  })
})

describe('parseAmount', () => {
  it('convierte decimales a base units', () => {
    expect(parseAmount('1.5', 7)).toBe(15_000_000n)
    expect(parseAmount('1,5', 7)).toBe(15_000_000n)
    expect(parseAmount('0.0000001', 7)).toBe(1n)
    expect(parseAmount('0,0000001', 7)).toBe(1n)
    expect(parseAmount('100', 7)).toBe(1_000_000_000n)
  })

  it('trunca decimales sobrantes y tolera vacío', () => {
    expect(parseAmount('1.12345678', 7)).toBe(11_234_567n)
    expect(parseAmount('', 7)).toBe(0n)
    expect(parseAmount('   ', 7)).toBe(0n)
  })

  it('devuelve 0 con entradas inválidas en vez de lanzar', () => {
    expect(parseAmount('abc', 7)).toBe(0n)
    expect(parseAmount('1.2.3', 7)).toBe(0n)
    expect(parseAmount('-1', 7)).toBe(0n)
    expect(parseAmount('1e3', 7)).toBe(0n)
  })
})

describe('shortAddress', () => {
  it('recorta direcciones largas sin perder los extremos', () => {
    expect(shortAddress('GABCDEFGHIJKLMNOPQRSTUVWXYZ')).toBe('GABCDE…WXYZ')
  })
})

describe('errorMessage', () => {
  it('extrae mensajes de Error, string y desconocidos', () => {
    expect(errorMessage(new Error('boom'))).toBe('boom')
    expect(errorMessage('texto')).toBe('texto')
    expect(errorMessage({ raro: true })).toBe('Unknown error')
  })

  it('traduce errores crudos de Soroban, RPC y wallet a mensajes claros', () => {
    expect(errorMessage(new Error('User declined access'))).toBe(
      'Transaction cancelled in wallet.',
    )
    expect(
      errorMessage(new Error('HostError: Error(Contract, #100)')),
    ).toBe('Insufficient balance to complete transaction.')
    expect(
      errorMessage(new Error('HostError: Error(Auth, InvalidAction)')),
    ).toBe(
      'Authorization denied by contract (check active account or permissions).',
    )
    expect(
      errorMessage(new Error('SoroswapRouter: insufficient output amount')),
    ).toBe(
      'Price moved beyond your allowed slippage. Increase slippage tolerance or reduce amount.',
    )
    expect(errorMessage(new Error('swap: insufficient liquidity'))).toBe(
      'Insufficient liquidity in the pool for this transaction.',
    )
    expect(errorMessage(new Error('TypeError: Failed to fetch'))).toBe(
      'Testnet RPC node is overloaded or unreachable. Please try again in a few seconds.',
    )
    expect(
      errorMessage(new Error('HostError: Error(Contract, #302)')),
    ).toBe(
      'Token and XLM ratio does not match pool reserves. Enable "Maintain pool ratio" and try again.',
    )
    expect(errorMessage(new Error('Transaction failed: txBadSeq'))).toBe(
      'Account sequence currently in use by another pending transaction. Wait 5 seconds and retry.',
    )
  })
})

describe('url sanitizers', () => {
  it('sanitizeHttpUrl permite http y https y rechaza javascript y protocolos peligrosos', () => {
    expect(sanitizeHttpUrl('https://example.com/test')).toBe('https://example.com/test')
    expect(sanitizeHttpUrl('http://example.com')).toBe('http://example.com/')
    expect(sanitizeHttpUrl('example.com/token')).toBe('https://example.com/token')
    expect(sanitizeHttpUrl('javascript:alert(1)')).toBeNull()
    expect(sanitizeHttpUrl('data:text/html,bad')).toBeNull()
    expect(sanitizeHttpUrl('')).toBeNull()
    expect(sanitizeHttpUrl(null)).toBeNull()
  })

  it('sanitizeTelegramUrl convierte handles o valida URLs de t.me', () => {
    expect(sanitizeTelegramUrl('@astro_stellar')).toBe('https://t.me/astro_stellar')
    expect(sanitizeTelegramUrl('astro_stellar')).toBe('https://t.me/astro_stellar')
    expect(sanitizeTelegramUrl('https://t.me/mygroup')).toBe('https://t.me/mygroup')
    expect(sanitizeTelegramUrl('javascript:alert(1)')).toBeNull()
    expect(sanitizeTelegramUrl('')).toBeNull()
  })

  it('sanitizeTwitterUrl convierte handles o valida URLs de twitter/x', () => {
    expect(sanitizeTwitterUrl('@astro_token')).toBe('https://x.com/astro_token')
    expect(sanitizeTwitterUrl('astro_token')).toBe('https://x.com/astro_token')
    expect(sanitizeTwitterUrl('https://x.com/astro_hq')).toBe('https://x.com/astro_hq')
    expect(sanitizeTwitterUrl('https://twitter.com/astro_hq')).toBe('https://twitter.com/astro_hq')
    expect(sanitizeTwitterUrl('javascript:alert(1)')).toBeNull()
    expect(sanitizeTwitterUrl('')).toBeNull()
  })
})
