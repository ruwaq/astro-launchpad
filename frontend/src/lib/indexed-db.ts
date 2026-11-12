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
  if (typeof window === 'undefined') {
    return Promise.resolve(null)
  }

  let idb: IDBFactory | undefined
  try {
    idb = window.indexedDB
  } catch {
    return Promise.resolve(null)
  }
  if (!idb) return Promise.resolve(null)

  if (!dbPromise) {
    dbPromise = new Promise((resolve) => {
      try {
        const req = idb.open(DB_NAME, DB_VERSION)

        req.onblocked = () => {
          console.warn('IndexedDB blocked by another open tab; falling back to in-memory cache')
          dbPromise = null
          resolve(null)
        }

        req.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result
          if (!db.objectStoreNames.contains(TOKENS_STORE)) {
            const tokenStore = db.createObjectStore(TOKENS_STORE, { keyPath: 'id' })
            tokenStore.createIndex('by_symbol', 'symbol', { unique: false })
            tokenStore.createIndex('by_ledger', 'ledger', { unique: false })
            tokenStore.createIndex('by_updatedAt', 'updatedAt', { unique: false })
          } else {
            const tokenStore = (event.target as IDBOpenDBRequest).transaction?.objectStore(TOKENS_STORE)
            if (tokenStore) {
              if (!tokenStore.indexNames.contains('by_symbol')) {
                tokenStore.createIndex('by_symbol', 'symbol', { unique: false })
              }
              if (!tokenStore.indexNames.contains('by_ledger')) {
                tokenStore.createIndex('by_ledger', 'ledger', { unique: false })
              }
              if (!tokenStore.indexNames.contains('by_updatedAt')) {
                tokenStore.createIndex('by_updatedAt', 'updatedAt', { unique: false })
              }
            }
          }
          if (!db.objectStoreNames.contains(META_STORE)) {
            db.createObjectStore(META_STORE, { keyPath: 'key' })
          }
        }

        req.onsuccess = () => {
          const db = req.result
          db.onversionchange = () => {
            db.close()
            dbPromise = null
          }
          db.onclose = () => {
            dbPromise = null
          }
          resolve(db)
        }

        req.onerror = () => {
          console.warn('IndexedDB failed to open, falling back to in-memory cache')
          dbPromise = null
          resolve(null)
        }
      } catch {
        dbPromise = null
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
 * Shape guard: validates stored records from disk (IndexedDB) against corruption.
 * Contract IDs must be valid 56-char Stellar C-addresses.
 * Reserves must be non-negative digit strings.
 */
export function isStoredTokenRecord(value: unknown): value is StoredTokenRecord {
  if (typeof value !== 'object' || value === null) return false
  const r = value as Partial<StoredTokenRecord>
  return (
    typeof r.id === 'string' &&
    r.id.startsWith('C') &&
    r.id.length === 56 &&
    typeof r.name === 'string' &&
    typeof r.symbol === 'string' &&
    typeof r.decimals === 'number' &&
    Number.isFinite(r.decimals) &&
    r.decimals >= 0 &&
    typeof r.pairId === 'string' &&
    typeof r.reserveToken === 'string' &&
    /^\d+$/.test(r.reserveToken) &&
    typeof r.reserveXlm === 'string' &&
    /^\d+$/.test(r.reserveXlm) &&
    typeof r.ledger === 'number' &&
    Number.isFinite(r.ledger) &&
    typeof r.updatedAt === 'number' &&
    Number.isFinite(r.updatedAt)
  )
}

/**
 * Evicts oldest tokens when quota is exceeded or storage reaches high watermark.
 */
async function pruneOldTokens(db: IDBDatabase, keepCount = 500): Promise<void> {
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(TOKENS_STORE, 'readwrite')
      const store = tx.objectStore(TOKENS_STORE)
      const index = store.index('by_updatedAt')
      const countReq = store.count()
      countReq.onsuccess = () => {
        const total = countReq.result
        if (total <= keepCount) {
          resolve()
          return
        }
        const toDelete = total - keepCount
        let deleted = 0
        const cursorReq = index.openKeyCursor() // oldest first
        cursorReq.onsuccess = () => {
          const cursor = cursorReq.result
          if (cursor && deleted < toDelete) {
            store.delete(cursor.primaryKey)
            deleted++
            cursor.continue()
          } else {
            resolve()
          }
        }
        cursorReq.onerror = () => resolve()
      }
      countReq.onerror = () => resolve()
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
      tx.onabort = () => resolve()
    } catch {
      resolve()
    }
  })
}

export async function putStoredTokens(tokens: StoredTokenRecord[]): Promise<void> {
  for (const t of tokens) {
    if (isStoredTokenRecord(t)) {
      memoryTokenCache.set(t.id, t)
    }
  }

  const db = await getDB()
  if (!db) return

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(TOKENS_STORE, 'readwrite')
      const store = tx.objectStore(TOKENS_STORE)
      for (const token of tokens) {
        if (isStoredTokenRecord(token)) {
          store.put(token)
        }
      }
      tx.oncomplete = () => resolve()
      tx.onerror = (event) => {
        event.preventDefault()
        if (tx.error?.name === 'QuotaExceededError') {
          pruneOldTokens(db, 300).catch(() => {})
        }
        resolve()
      }
      tx.onabort = () => resolve()
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'QuotaExceededError') {
        pruneOldTokens(db, 300).catch(() => {})
      }
      resolve()
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
      tx.onerror = () =>
        resolve(Array.from(memoryTokenCache.values()).filter(isStoredTokenRecord))
      tx.onabort = () =>
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
      tx.onerror = () => resolve(memorySyncMeta)
      tx.onabort = () => resolve(memorySyncMeta)
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
      tx.onerror = (event) => {
        event.preventDefault()
        resolve()
      }
      tx.onabort = () => resolve()
    } catch {
      resolve()
    }
  })
}
