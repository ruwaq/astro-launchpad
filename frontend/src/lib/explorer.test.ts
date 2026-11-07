import { describe, expect, it } from 'vitest'
import {
  explorerAccountUrl,
  explorerContractUrl,
  explorerTxUrl,
  horizonAccountUrl,
} from './explorer'

describe('explorer URLs', () => {
  it('genera URLs para contratos en testnet', () => {
    expect(explorerContractUrl('C123')).toBe(
      'https://stellar.expert/explorer/testnet/contract/C123',
    )
  })

  it('genera URLs para transacciones en testnet', () => {
    expect(explorerTxUrl('tx_abc')).toBe(
      'https://stellar.expert/explorer/testnet/tx/tx_abc',
    )
  })

  it('genera URLs para cuentas en testnet', () => {
    expect(explorerAccountUrl('G123')).toBe(
      'https://stellar.expert/explorer/testnet/account/G123',
    )
  })

  it('genera URLs para cuentas en Horizon testnet', () => {
    expect(horizonAccountUrl('G123')).toBe(
      'https://horizon-testnet.stellar.org/accounts/G123',
    )
  })
})
