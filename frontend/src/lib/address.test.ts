import { describe, expect, it } from 'vitest'
import { isValidContractAddress, isValidStellarAddress } from './address'

const ZERO_ACCOUNT = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF'
const VALID_CONTRACT = 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4'

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
    expect(isValidStellarAddress(VALID_CONTRACT)).toBe(false)
    expect(
      isValidStellarAddress(
        'SAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      ),
    ).toBe(false)
  })
})

describe('isValidContractAddress', () => {
  it('acepta una dirección de contrato válida', () => {
    expect(isValidContractAddress(VALID_CONTRACT)).toBe(true)
    expect(isValidContractAddress(`  ${VALID_CONTRACT}  `)).toBe(true)
  })

  it('rechaza cuentas G, secretos y strings inválidos', () => {
    expect(isValidContractAddress('')).toBe(false)
    expect(isValidContractAddress(ZERO_ACCOUNT)).toBe(false)
    expect(isValidContractAddress('C123')).toBe(false)
  })
})
