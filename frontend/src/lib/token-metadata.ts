import { ASTRO_TOKEN_ID } from './network'
import {
  readStorageJson,
  removeStorageKey,
  writeStorageJson,
} from './storage'

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
    website: `https://${import.meta.env.VITE_SITE_ORIGIN ?? 'astrogate.workers.dev'}`,
    telegram: 'https://t.me/AstroGateStellar',
    twitter: 'https://x.com/AstroGateHQ',
  },
}

/** Shape guard for metadata restored from persistence. */
function isEnrichedTokenMetadata(value: unknown): value is EnrichedTokenMetadata {
  if (typeof value !== 'object' || value === null) return false
  const tokenId = (value as { tokenId?: unknown }).tokenId
  if (typeof tokenId !== 'string' || !tokenId.startsWith('C')) return false
  for (const field of ['description', 'logoUrl', 'website', 'telegram', 'twitter']) {
    const item = (value as Record<string, unknown>)[field]
    if (item !== undefined && typeof item !== 'string') return false
  }
  return true
}

/**
 * Reads enriched metadata for a given token from memory defaults or localStorage.
 */
export function getLocalTokenMetadata(tokenId: string): EnrichedTokenMetadata | null {
  if (DEFAULT_TOKEN_METADATA[tokenId]) {
    return DEFAULT_TOKEN_METADATA[tokenId]
  }

  const fromMemory = memoryCache.get(tokenId)
  if (fromMemory) return fromMemory

  const restored = readStorageJson<unknown>(`${METADATA_KEY_PREFIX}${tokenId}`)
  if (isEnrichedTokenMetadata(restored)) {
    return restored
  }
  return null
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

  writeStorageJson(`${METADATA_KEY_PREFIX}${metadata.tokenId}`, payload)
}

/**
 * Clears memory cache and app-owned localStorage keys (tests and resets).
 * Scoped: never touches localStorage entries of other apps on the same origin.
 */
export function clearTokenMetadataCache(): void {
  memoryCache.clear()
  const s = typeof window !== 'undefined' ? window.localStorage : null
  if (!s) return
  const toRemove: string[] = []
  for (let i = 0; i < s.length; i++) {
    const key = s.key(i)
    if (key?.startsWith(METADATA_KEY_PREFIX)) toRemove.push(key)
  }
  for (const key of toRemove) removeStorageKey(key)
}
