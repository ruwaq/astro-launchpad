import { describe, expect, it } from 'vitest'
import {
  AstroGateConstants,
  quoteSwap,
  verifyAntiRug,
} from './index'

describe('AstroGate AI & Developer SDK', () => {
  it('exposes critical network and contract constants', () => {
    expect(AstroGateConstants.NETWORK_NAME).toBe('testnet')
    expect(AstroGateConstants.STELLAR_BURN_ADDRESS).toBe(
      'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
    )
    expect(AstroGateConstants.PROTOCOL_DEPLOY_FEE_USD).toBe(1.11)
  })

  it('fails gracefully when quoting a non-existent token pool', async () => {
    await expect(
      quoteSwap({
        tokenId: 'CNOTEXIST123456789',
        amountIn: 10000000n,
        direction: 'buy',
      }),
    ).rejects.toThrow(/No active AMM liquidity pool found/)
  })

  it('verifies non-existent token anti-rug status correctly', async () => {
    const audit = await verifyAntiRug('CNOTEXIST123')
    expect(audit.isAntiRugVerified).toBe(false)
    expect(audit.pairId).toBeNull()
  })
})
