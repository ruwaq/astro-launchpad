import { describe, expect, it } from 'vitest'
import {
  AstroGateConstants,
  getTokenDetails,
  quoteSwap,
  verifyAntiRug,
} from './index'

describe('AstroGate AI & Developer SDK', () => {
  it('exposes critical network and contract constants', () => {
    expect(AstroGateConstants.NETWORK_NAME).toBe('testnet')
    expect(AstroGateConstants.STELLAR_BURN_ADDRESS).toBe(
      'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
    )
    expect(AstroGateConstants.LAUNCHPAD_CONTRACT_ID.startsWith('C')).toBe(true)
    expect(AstroGateConstants.ASTRO_WASM_HASH.length).toBe(64)
    expect(AstroGateConstants.LAUNCHPAD_WASM_HASH.length).toBe(64)
  })

  it('validates amountIn > 0 for quoteSwap', async () => {
    await expect(
      quoteSwap({
        tokenId: 'CAI637WCEILQF3ZYOV6BRUCX532XQIVOOJ4CRWFPWHQRJHOH5OKHSXRE',
        amountIn: 0n,
        direction: 'buy',
      }),
    ).rejects.toThrow(/amountIn must be greater than zero/)
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

  it('validates contract address in getTokenDetails', async () => {
    await expect(getTokenDetails('not-a-valid-contract')).rejects.toThrow(
      /Invalid Stellar contract address/,
    )
  })

  it('verifies non-existent token anti-rug status correctly', async () => {
    const audit = await verifyAntiRug('CNOTEXIST123')
    expect(audit.isAntiRugVerified).toBe(false)
    expect(audit.lpBurned).toBe(false)
    expect(audit.pairId).toBeNull()
  })
})
