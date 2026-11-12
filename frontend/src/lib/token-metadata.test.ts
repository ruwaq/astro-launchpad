import { describe, expect, it, beforeEach } from 'vitest'
import {
  DEFAULT_TOKEN_METADATA,
  ONCHAIN_META_MAX_BYTES,
  clearTokenMetadataCache,
  decodeOnChainMeta,
  encodeOnChainMeta,
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

  it('encodes compact on-chain meta JSON, drops insecure logos, and clamps UTF-8 to 512 bytes', () => {
    const oversizedDesc = '🚀'.repeat(200)
    const encoded = encodeOnChainMeta({
      description: oversizedDesc,
      logoUrl: 'http://insecure.example/logo.png',
      website: 'https://astrogate.app',
      telegram: '@astrogate',
      twitter: '@astrogate',
    })
    expect(encoded).not.toBe('')
    expect(new TextEncoder().encode(encoded).length).toBeLessThanOrEqual(
      ONCHAIN_META_MAX_BYTES,
    )

    const decoded = decodeOnChainMeta('CTOKEN1', encoded)
    expect(decoded?.logoUrl).toBeUndefined()
    expect(decoded?.website).toBe('https://astrogate.app/')
    expect(decoded?.telegram).toBe('https://t.me/astrogate')
    expect(decoded?.twitter).toBe('https://x.com/astrogate')
    expect(decoded?.description?.length).toBeGreaterThan(0)
  })

  it('keeps valid https logos and decodes plain-text fallback metadata safely', () => {
    const encoded = encodeOnChainMeta({
      description: 'Fair community token',
      logoUrl: 'https://cdn.astrogate.app/logo.png',
    })
    const decodedJson = decodeOnChainMeta('CTOKEN2', encoded)
    expect(decodedJson?.logoUrl).toBe('https://cdn.astrogate.app/logo.png')
    expect(decodedJson?.description).toBe('Fair community token')

    const decodedPlain = decodeOnChainMeta('CTOKEN3', 'Plain text memo description')
    expect(decodedPlain?.description).toBe('Plain text memo description')

    expect(
      decodeOnChainMeta(
        'CTOKEN4',
        JSON.stringify({ l: 'javascript:alert(1)', w: 'ftp://bad.example' }),
      ),
    ).toBeNull()
  })
})
