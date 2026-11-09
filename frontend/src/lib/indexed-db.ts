/**
 * IndexedDB storage layer for AstroGate.
 * Provides high-performance persistent client-side storage for thousands of tokens,
 * pair mappings, and sync state without 24-hour retention limitations.
 */

export interface StoredTokenRecord {
  id: string
  name: string
  symbol: string
  decimals: number
  pairId: string
  reserveToken: string // BigInt serialized as string for IDB safety
  reserveXlm: string
  ledger: number
  creator?: string
  isAntiRugVerified?: boolean
  updatedAt: number
}

export interface SyncMeta {
  key: string
  lastScannedIndex: number
  totalPairs: number
  lastSyncTimestamp: number
}

/** Clave única del registro de sincronización de la factory (compartida con discovery.ts). */
export const FACTORY_SYNC_META_KEY = 'factory_sync'

const DB_NAME = 'astrogate_db'
const DB_VERSION = 1
const TOKENS_STORE = 'tokens'
const META_STORE = 'sync_meta'

let dbPromise: Promise<IDBDatabase | null> | null = null

function getDB(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.resolve(null)
  }

  if (!dbPromise) {
    dbPromise = new Promise((resolve) => {
      try {
        const req = window.indexedDB.open(DB_NAME, DB_VERSION)

        req.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result
          if (!db.objectStoreNames.contains(TOKENS_STORE)) {
            const tokenStore = db.createObjectStore(TOKENS_STORE, { keyPath: 'id' })
            tokenStore.createIndex('by_symbol', 'symbol', { unique: false })
            tokenStore.createIndex('by_ledger', 'ledger', { unique: false })
            tokenStore.createIndex('by_updatedAt', 'updatedAt', { unique: false })
          }
          if (!db.objectStoreNames.contains(META_STORE)) {
            db.createObjectStore(META_STORE, { keyPath: 'key' })
          }
        }

        req.onsuccess = () => resolve(req.result)
        req.onerror = () => {
          console.warn('IndexedDB failed to open, falling back to memory/localStorage')
          resolve(null)
        }
      } catch {
        resolve(null)
      }
    })
  }

  return dbPromise
}

// In-memory fallback if IndexedDB is disabled or in private mode with restrictions
const memoryTokenCache = new Map<string, StoredTokenRecord>()
let memorySyncMeta: SyncMeta = {
  key: FACTORY_SYNC_META_KEY,
  lastScannedIndex: 0,
  totalPairs: 0,
  lastSyncTimestamp: 0,
}

/**
 * Guard de forma: los registros vienen de disco (IndexedDB) y pueden estar
 * corruptos o de una versión vieja. Un registro inválido no debe entrar a
 * memoria ni a la UI (un `reserveToken` no numérico lanzaría en BigInt()).
 */
export function isStoredTokenRecord(value: unknown): value is StoredTokenRecord {
  if (typeof value !== 'object' || value === null) return false
  const r = value as Partial<StoredTokenRecord>
  return (
    typeof r.id === 'string' &&
    r.id.length > 2 &&
    typeof r.name === 'string' &&
    typeof r.symbol === 'string' &&
    typeof r.decimals === 'number' &&
    Number.isFinite(r.decimals) &&
    typeof r.pairId === 'string' &&
    typeof r.reserveToken === 'string' &&
    /^-?\d+$/.test(r.reserveToken || '0') &&
    typeof r.reserveXlm === 'string' &&
    /^-?\d+$/.test(r.reserveXlm || '0') &&
    typeof r.ledger === 'number' &&
    Number.isFinite(r.ledger) &&
    typeof r.updatedAt === 'number' &&
    Number.isFinite(r.updatedAt)
  )
}

export async function putStoredTokens(tokens: StoredTokenRecord[]): Promise<void> {
  for (const t of tokens) {
    memoryTokenCache.set(t.id, t)
  }

  const db = await getDB()
  if (!db) return

  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(TOKENS_STORE, 'readwrite')
      const store = tx.objectStore(TOKENS_STORE)
      for (const token of tokens) {
        store.put(token)
      }
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    } catch {
      resolve() // Non-blocking
    }
  })
}

export async function getAllStoredTokens(): Promise<StoredTokenRecord[]> {
  const db = await getDB()
  if (!db) {
    return Array.from(memoryTokenCache.values()).filter(isStoredTokenRecord)
  }

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(TOKENS_STORE, 'readonly')
      const store = tx.objectStore(TOKENS_STORE)
      const req = store.getAll()
      req.onsuccess = () => {
        const valid = (req.result as unknown[]).filter(isStoredTokenRecord)
        for (const r of valid) {
          memoryTokenCache.set(r.id, r)
        }
        resolve(valid)
      }
      req.onerror = () =>
        resolve(Array.from(memoryTokenCache.values()).filter(isStoredTokenRecord))
    } catch {
      resolve(Array.from(memoryTokenCache.values()).filter(isStoredTokenRecord))
    }
  })
}

export async function getSyncMeta(): Promise<SyncMeta> {
  const db = await getDB()
  if (!db) return memorySyncMeta

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(META_STORE, 'readonly')
      const store = tx.objectStore(META_STORE)
      const req = store.get(FACTORY_SYNC_META_KEY)
      req.onsuccess = () => {
        if (req.result) {
          memorySyncMeta = req.result
          resolve(req.result)
        } else {
          resolve(memorySyncMeta)
        }
      }
      req.onerror = () => resolve(memorySyncMeta)
    } catch {
      resolve(memorySyncMeta)
    }
  })
}

export async function putSyncMeta(meta: SyncMeta): Promise<void> {
  memorySyncMeta = meta
  const db = await getDB()
  if (!db) return

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(META_STORE, 'readwrite')
      const store = tx.objectStore(META_STORE)
      store.put(meta)
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
    } catch {
      resolve()
    }
  })
}
