import {
  sanitizeHttpUrl,
  sanitizeTelegramUrl,
  sanitizeTwitterUrl,
} from './format'
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

export const ONCHAIN_META_MAX_BYTES = 512

const utf8Encoder = new TextEncoder()

function utf8ByteLength(text: string): number {
  return utf8Encoder.encode(text).length
}

function sanitizeHttpsLogoUrl(url?: string | null): string | undefined {
  const safe = sanitizeHttpUrl(url)
  if (!safe) return undefined
  return safe.startsWith('https://') ? safe : undefined
}

/**
 * Encodes optional launch metadata into compact UTF-8 JSON (≤512 bytes) for
 * on-chain `LaunchRecord.meta` storage. Trims description to fit budget.
 */
export function encodeOnChainMeta(input: {
  description?: string
  logoUrl?: string
  website?: string
  telegram?: string
  twitter?: string
}): string {
  const payload: Record<string, string> = {}
  const logo = sanitizeHttpsLogoUrl(input.logoUrl)
  const web = sanitizeHttpUrl(input.website)
  const tg = sanitizeTelegramUrl(input.telegram)
  const tw = sanitizeTwitterUrl(input.twitter)

  if (logo) payload.l = logo
  if (web) payload.w = web
  if (tg) payload.t = tg
  if (tw) payload.x = tw

  let desc = input.description?.trim() ?? ''
  if (desc) {
    payload.d = desc
    // Shrink description cleanly by Unicode code points until JSON ≤ 512 bytes.
    while (utf8ByteLength(JSON.stringify(payload)) > ONCHAIN_META_MAX_BYTES && desc.length > 0) {
      const chars = Array.from(desc)
      chars.pop()
      desc = chars.join('').trimEnd()
      if (desc) {
        payload.d = desc
      } else {
        delete payload.d
      }
    }
  }

  if (Object.keys(payload).length === 0) return ''
  const encoded = JSON.stringify(payload)
  return utf8ByteLength(encoded) <= ONCHAIN_META_MAX_BYTES ? encoded : ''
}

/**
 * Decodes compact on-chain `LaunchRecord.meta` JSON (or plain text) into
 * sanitized `EnrichedTokenMetadata`.
 */
export function decodeOnChainMeta(
  tokenId: string,
  rawMeta?: string | null,
): EnrichedTokenMetadata | null {
  const trimmed = rawMeta?.trim()
  if (!trimmed) return null

  if (!trimmed.startsWith('{')) {
    return {
      tokenId,
      description: trimmed.slice(0, ONCHAIN_META_MAX_BYTES),
    }
  }

  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>
    const description =
      typeof parsed.d === 'string' && parsed.d.trim()
        ? parsed.d.trim()
        : undefined
    const logoUrl =
      typeof parsed.l === 'string' ? sanitizeHttpsLogoUrl(parsed.l) : undefined
    const website =
      typeof parsed.w === 'string'
        ? sanitizeHttpUrl(parsed.w) ?? undefined
        : undefined
    const telegram =
      typeof parsed.t === 'string'
        ? sanitizeTelegramUrl(parsed.t) ?? undefined
        : undefined
    const twitter =
      typeof parsed.x === 'string'
        ? sanitizeTwitterUrl(parsed.x) ?? undefined
        : undefined

    if (!description && !logoUrl && !website && !telegram && !twitter) {
      return null
    }

    return {
      tokenId,
      description,
      logoUrl,
      website,
      telegram,
      twitter,
    }
  } catch {
    return null
  }
}
