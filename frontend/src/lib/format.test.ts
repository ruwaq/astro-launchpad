import { describe, expect, it } from 'vitest'
import {
  errorMessage,
  formatAmount,
  parseAmount,
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
    expect(parseAmount('0.0000001', 7)).toBe(1n)
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
    expect(errorMessage({ raro: true })).toBe('Error desconocido')
  })
})
