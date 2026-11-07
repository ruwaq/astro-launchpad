import { describe, expect, it, beforeEach } from 'vitest'
import {
  DEFAULT_TOKEN_METADATA,
  clearTokenMetadataCache,
  getLocalTokenMetadata,
  saveLocalTokenMetadata,
} from './token-metadata'
import { ASTRO_TOKEN_ID } from './network'

describe('Enriched Token Metadata', () => {
  beforeEach(() => {
    clearTokenMetadataCache()
  })

  it('retrieves default metadata for ASTRO genesis token', () => {
    const meta = getLocalTokenMetadata(ASTRO_TOKEN_ID)
    expect(meta).toBeDefined()
    expect(meta?.tokenId).toBe(ASTRO_TOKEN_ID)
    expect(meta?.website).toBe(DEFAULT_TOKEN_METADATA[ASTRO_TOKEN_ID].website)
    expect(meta?.description).toContain('genesis insignia')
  })

  it('saves and reads custom token metadata', () => {
    const dummyId = 'CCUSTOMTOKEN123456789'
    saveLocalTokenMetadata({
      tokenId: dummyId,
      description: 'A test community token for stellar memes',
      website: 'https://memecoin.stellar',
      telegram: 'https://t.me/memecoin',
      twitter: 'https://x.com/memecoin',
      logoUrl: 'https://memecoin.stellar/logo.png',
    })

    const retrieved = getLocalTokenMetadata(dummyId)
    expect(retrieved).not.toBeNull()
    expect(retrieved?.description).toBe('A test community token for stellar memes')
    expect(retrieved?.website).toBe('https://memecoin.stellar')
    expect(retrieved?.telegram).toBe('https://t.me/memecoin')
    expect(retrieved?.logoUrl).toBe('https://memecoin.stellar/logo.png')
    expect(retrieved?.updatedAt).toBeGreaterThan(0)
  })

  it('returns null for unknown token with no stored metadata', () => {
    const retrieved = getLocalTokenMetadata('CNOTFOUND')
    expect(retrieved).toBeNull()
  })
})
