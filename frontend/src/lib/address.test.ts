import { describe, expect, it } from 'vitest'
import { isValidStellarAddress } from './address'

const ZERO_ACCOUNT = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF'

describe('isValidStellarAddress', () => {
  it('acepta una cuenta G válida', () => {
    expect(isValidStellarAddress(ZERO_ACCOUNT)).toBe(true)
    expect(isValidStellarAddress(`  ${ZERO_ACCOUNT}  `)).toBe(true)
  })

  it('rechaza direcciones incompletas o con checksum inválido', () => {
    expect(isValidStellarAddress('')).toBe(false)
    expect(isValidStellarAddress('GABC')).toBe(false)
    expect(
      isValidStellarAddress(
        'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      ),
    ).toBe(false)
  })

  it('rechaza contratos y secretos', () => {
    expect(isValidStellarAddress('CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4')).toBe(
      false,
    )
    expect(
      isValidStellarAddress(
        'SAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      ),
    ).toBe(false)
  })
})
