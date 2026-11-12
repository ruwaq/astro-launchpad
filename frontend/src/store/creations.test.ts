import { beforeEach, describe, expect, it } from 'vitest'
import { loadTokens, useCreatedTokens } from './creations'
import { clearStorageMemoryFallbackForTests, writeStorageJson } from '../lib/storage'

const TOKEN_A = 'CAI637WCEILQF3ZYOV6BRUCX532XQIVOOJ4CRWFPWHQRJHOH5OKHSXRE'
const TOKEN_B = 'CA32TMZ2AODXI7K7B6T2YPZR52HJKFCY5GT2DNHMOL326DLSNPX55BUP'

describe('useCreatedTokens', () => {
  beforeEach(() => {
    clearStorageMemoryFallbackForTests()
    useCreatedTokens.setState({ tokens: [] })
    writeStorageJson('astrogate.created-tokens.v1', [])
    writeStorageJson('floodgate.created-tokens.v1', null)
  })

  it('adds and removes tokens', () => {
    const { add, remove } = useCreatedTokens.getState()

    add({ id: TOKEN_A, symbol: 'ASTRO', decimals: 7 })
    expect(useCreatedTokens.getState().tokens).toHaveLength(1)
    expect(useCreatedTokens.getState().tokens[0].id).toBe(TOKEN_A)

    remove(TOKEN_A)
    expect(useCreatedTokens.getState().tokens).toHaveLength(0)
  })

  it('transparently migrates legacy floodgate.created-tokens.v1', () => {
    writeStorageJson('floodgate.created-tokens.v1', [
      { id: TOKEN_B, symbol: 'LEGACY', decimals: 7, createdAt: 12345 },
    ])
    // Ensure astrogate key is absent initially so migration occurs
    clearStorageMemoryFallbackForTests()
    writeStorageJson('floodgate.created-tokens.v1', [
      { id: TOKEN_B, symbol: 'LEGACY', decimals: 7, createdAt: 12345 },
    ])

    const loaded = loadTokens()
    expect(loaded).toHaveLength(1)
    expect(loaded[0].id).toBe(TOKEN_B)
    expect(loaded[0].symbol).toBe('LEGACY')
  })
})
