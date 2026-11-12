/**
 * Central localStorage access for AstroGate.
 *
 * - All app keys share the `astrogate.` prefix (brand.ts is the brand source).
 * - Keys that shipped earlier under `floodgate.` (rebrand leftovers) or with
 *   the `astrogate:` colon variant are migrated once, transparently.
 * - Every read/write is guarded: a full or blocked quota must not break the app.
 * - In-memory fallback ensures seamless operation in private browsing, SSR, and Node environments.
 */

const APP_KEY_PREFIX = 'astrogate.'
const LEGACY_KEYS_PREFIX = 'floodgate.'

/** Exact renames where the suffix changed as well. */
const LEGACY_RENAMES: Record<string, string> = {
  'astrogate:xlm-usd-v1': 'astrogate.xlm-price.v1',
}

const memoryFallback = new Map<string, string>()

function storage(): Storage | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage
    }
  } catch {
    return null
  }
  return null
}

/** Legacy key names that must be adopted into the new one on first read. */
function legacyCandidates(key: string): string[] {
  if (!key.startsWith(APP_KEY_PREFIX)) return []
  const suffix = key.slice(APP_KEY_PREFIX.length)
  const candidates = [`${LEGACY_KEYS_PREFIX}${suffix}`]
  // Exact renames recorded when suffix changed too (e.g. `xlm-usd-v1` → `xlm-price.v1`).
  for (const [legacy, target] of Object.entries(LEGACY_RENAMES)) {
    if (target === key) candidates.push(legacy)
  }
  return candidates
}

/** Moves legacy data under each key's current name once, transparently. */
function migrateKey(key: string): void {
  const sources = legacyCandidates(key)
  const s = storage()
  if (s) {
    try {
      if (s.getItem(key) !== null) return
      const legacyValue = sources
        .map((legacy) => s.getItem(legacy))
        .find((entry) => entry !== null)
      if (legacyValue !== undefined && legacyValue !== null) {
        s.setItem(key, legacyValue)
        for (const legacy of sources) s.removeItem(legacy)
      }
    } catch {
      // Storage unavailable or full: keep working in memory.
    }
  } else {
    if (memoryFallback.has(key)) return
    for (const legacy of sources) {
      const val = memoryFallback.get(legacy)
      if (val !== undefined) {
        memoryFallback.set(key, val)
        memoryFallback.delete(legacy)
        break
      }
    }
  }
}

/** Reads a raw string value (migrating legacy keys transparently). */
export function readStorageString(key: string): string | null {
  migrateKey(key)
  const s = storage()
  if (s) {
    try {
      return s.getItem(key) ?? null
    } catch {
      return memoryFallback.get(key) ?? null
    }
  }
  return memoryFallback.get(key) ?? null
}

/** Writes a raw string value; returns true on success. */
export function writeStorageString(key: string, value: string): boolean {
  const s = storage()
  if (s) {
    try {
      s.setItem(key, value)
      return true
    } catch {
      memoryFallback.set(key, value)
      return false
    }
  }
  memoryFallback.set(key, value)
  return true
}

export function removeStorageKey(key: string): void {
  const s = storage()
  if (s) {
    try {
      s.removeItem(key)
    } catch {
      // Ignore
    }
  }
  memoryFallback.delete(key)
}

/** Reads and parses a JSON document, or null when absent/corrupt. */
export function readStorageJson<T>(key: string): T | null {
  const raw = readStorageString(key)
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

/** Serializes and writes a JSON document; returns true on success. */
export function writeStorageJson(key: string, value: unknown): boolean {
  try {
    return writeStorageString(key, JSON.stringify(value))
  } catch {
    return false
  }
}

/** Removes every key owned by the app (prefixed) WITHOUT touching other origins' data. */
export function clearAppScopedStorage(options?: {
  /** Extra prefixes/components to include, e.g. legacy `floodgate.`. */
  extraPrefixes?: string[]
}): void {
  const s = storage()
  const extraPrefixes = options?.extraPrefixes ?? []
  if (s) {
    const targets: string[] = []
    for (let i = 0; i < s.length; i++) {
      const key = s.key(i)
      if (!key) continue
      const scoped =
        key.startsWith(APP_KEY_PREFIX) ||
        key.startsWith(LEGACY_KEYS_PREFIX) ||
        extraPrefixes.some((p) => key.startsWith(p))
      if (scoped) targets.push(key)
    }
    for (const key of targets) {
      try {
        s.removeItem(key)
      } catch {
        // Ignore individual failures.
      }
    }
  }

  for (const key of Array.from(memoryFallback.keys())) {
    const scoped =
      key.startsWith(APP_KEY_PREFIX) ||
      key.startsWith(LEGACY_KEYS_PREFIX) ||
      extraPrefixes.some((p) => key.startsWith(p))
    if (scoped) memoryFallback.delete(key)
  }
}

/** Helper for test cleanup. */
export function clearStorageMemoryFallbackForTests(): void {
  memoryFallback.clear()
}
