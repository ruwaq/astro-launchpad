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
  key: 'factory_sync',
  lastScannedIndex: 0,
  totalPairs: 0,
  lastSyncTimestamp: 0,
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
    return Array.from(memoryTokenCache.values())
  }

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(TOKENS_STORE, 'readonly')
      const store = tx.objectStore(TOKENS_STORE)
      const req = store.getAll()
      req.onsuccess = () => {
        const records = req.result as StoredTokenRecord[]
        for (const r of records) {
          memoryTokenCache.set(r.id, r)
        }
        resolve(records)
      }
      req.onerror = () => resolve(Array.from(memoryTokenCache.values()))
    } catch {
      resolve(Array.from(memoryTokenCache.values()))
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
      const req = store.get('factory_sync')
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
