import { ASTRO_TOKEN_ID } from './network'

export interface EnrichedTokenMetadata {
  tokenId: string
  description?: string
  logoUrl?: string
  website?: string
  telegram?: string
  twitter?: string
  updatedAt?: number
}

const METADATA_KEY_PREFIX = 'astrogate.token.meta.'
const memoryCache = new Map<string, EnrichedTokenMetadata>()

/**
 * Built-in default metadata for genesis / canonical tokens on testnet.
 */
export const DEFAULT_TOKEN_METADATA: Record<string, EnrichedTokenMetadata> = {
  [ASTRO_TOKEN_ID]: {
    tokenId: ASTRO_TOKEN_ID,
    description:
      'The genesis insignia and community meme token of AstroGate on Stellar Soroban. Fair-launched with locked liquidity and renounced ownership.',
    website: 'https://astrogate.workers.dev',
    telegram: 'https://t.me/AstroGateStellar',
    twitter: 'https://x.com/AstroGateHQ',
  },
}

/**
 * Reads enriched metadata for a given token from memory defaults or localStorage.
 */
export function getLocalTokenMetadata(tokenId: string): EnrichedTokenMetadata | null {
  if (DEFAULT_TOKEN_METADATA[tokenId]) {
    return DEFAULT_TOKEN_METADATA[tokenId]
  }

  if (typeof window === 'undefined') {
    return memoryCache.get(tokenId) ?? null
  }

  try {
    const raw = window.localStorage.getItem(`${METADATA_KEY_PREFIX}${tokenId}`)
    if (!raw) return memoryCache.get(tokenId) ?? null
    return JSON.parse(raw) as EnrichedTokenMetadata
  } catch {
    return memoryCache.get(tokenId) ?? null
  }
}

/**
 * Saves enriched metadata for a token to localStorage and memory.
 */
export function saveLocalTokenMetadata(metadata: EnrichedTokenMetadata): void {
  const payload: EnrichedTokenMetadata = {
    ...metadata,
    updatedAt: Date.now(),
  }
  memoryCache.set(metadata.tokenId, payload)

  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(
      `${METADATA_KEY_PREFIX}${metadata.tokenId}`,
      JSON.stringify(payload),
    )
  } catch (err) {
    console.warn('Failed to save token metadata:', err)
  }
}

/**
 * Clears memory cache and localStorage (useful for tests and resets).
 */
export function clearTokenMetadataCache(): void {
  memoryCache.clear()
  if (typeof window === 'undefined') return
  try {
    window.localStorage.clear()
  } catch {
    // Ignore
  }
}
