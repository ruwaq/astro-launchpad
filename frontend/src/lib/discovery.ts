/**
 * Descubrimiento de tokens desde la red, sin backend.
 *
 * La factory de Soroswap emite un evento `new_pair` por cada par creado:
 *   topics: ["SoroswapFactory", "new_pair"]
 *   value:  { new_pairs_length, pair, token_0, token_1 }
 *
 * Leemos esos eventos con `getEvents` (ventana reciente de ledgers) y nos
 * quedamos con los pares token/XLM. Para cada token leemos metadata SEP-41 y
 * las reservas del par: todo son simulaciones de solo lectura.
 */
import { rpc, scValToNative } from '@stellar/stellar-sdk'
import {
  cachePairId,
  fetchPoolState,
  fetchPoolStateByPair,
  soroswapClients,
  unwrapResult,
  type PoolState,
} from './soroswap'
import { tokenClient } from './token'
import { ASTRO_TOKEN_ID, EVENT_WINDOW_LEDGERS, RPC_URL, SOROSWAP_FACTORY, XLM_SAC } from './network'
import { shortAddress } from './format'
import {
  FACTORY_SYNC_META_KEY,
  getAllStoredTokens,
  putStoredTokens,
  putSyncMeta,
  type StoredTokenRecord,
} from './indexed-db'
import { readStorageJson, writeStorageJson } from './storage'

/** Ventana por defecto: ~14 h de testnet (ledgers de ~5 s). Única fuente: network.ts. */
export const DEFAULT_WINDOW_LEDGERS = EVENT_WINDOW_LEDGERS

/** Tokens que se listan como máximo. */
export const DEFAULT_MAX_TOKENS = 50

/** Tokens que siempre se intentan listar, aunque no estén en la ventana. */
export const DEFAULT_PINNED_TOKENS = [ASTRO_TOKEN_ID]

type EventResponse = rpc.Api.EventResponse

/** Par token/XLM descubierto en los eventos de la factory. */
export type DiscoveredPair = {
  tokenId: string
  pairId: string
  ledger: number
}

/** Token listo para pintar: metadata + estado del par. */
export type TokenListing = {
  id: string
  name: string
  symbol: string
  decimals: number
  /** Ledger en el que se creó el par (para ordenar por novedad). */
  ledger: number
  pool: PoolState
}

/** Convierte un evento crudo en par token/XLM; `null` si no lo es. */
export function parseNewPairEvent(event: EventResponse): DiscoveredPair | null {
  const topics = event.topic.map((topic) => {
    try {
      return scValToNative(topic)
    } catch {
      return null
    }
  })
  if (topics[0] !== 'SoroswapFactory' || topics[1] !== 'new_pair') return null

  let value: unknown
  try {
    value = scValToNative(event.value)
  } catch {
    return null
  }
  if (typeof value !== 'object' || value === null) return null

  const { pair, token_0: token0, token_1: token1 } = value as {
    pair?: unknown
    token_0?: unknown
    token_1?: unknown
  }
  if (typeof pair !== 'string') return null

  const tokens = [token0, token1].filter(
    (token): token is string => typeof token === 'string',
  )
  if (tokens.length !== 2) return null

  // Un lado tiene que ser el SAC de XLM; el otro es el token del launchpad.
  const other = token0 === XLM_SAC ? token1 : token1 === XLM_SAC ? token0 : null
  if (typeof other !== 'string') return null

  return { tokenId: other, pairId: pair, ledger: event.ledger }
}

/** Deja el par más reciente por token, ordenado de nuevo a viejo. */
export function newestPairPerToken(pairs: DiscoveredPair[]): DiscoveredPair[] {
  const byToken = new Map<string, DiscoveredPair>()
  for (const pair of pairs) {
    const known = byToken.get(pair.tokenId)
    if (!known || pair.ledger >= known.ledger) byToken.set(pair.tokenId, pair)
  }
  return [...byToken.values()].sort((a, b) => b.ledger - a.ledger)
}

/**
 * Pares token/XLM creados en la ventana reciente, de nuevo a viejo.
 * Pagina con `cursor` hasta agotar los eventos de la ventana.
 */
export async function discoverPairs(options?: {
  windowLedgers?: number
  maxEvents?: number
}): Promise<DiscoveredPair[]> {
  const windowLedgers = options?.windowLedgers ?? DEFAULT_WINDOW_LEDGERS
  const maxEvents = options?.maxEvents ?? 600

  const server = new rpc.Server(RPC_URL)
  const latest = await server.getLatestLedger()
  const startLedger = Math.max(1, latest.sequence - windowLedgers)
  const endLedger = latest.sequence
  const filters = [{ type: 'contract' as const, contractIds: [SOROSWAP_FACTORY] }]

  const pairs: DiscoveredPair[] = []
  let cursor: string | undefined

  while (pairs.length < maxEvents) {
    const page = await server.getEvents({
      filters,
      ...(cursor ? { cursor } : { startLedger }),
      limit: 200,
    })

    for (const event of page.events) {
      if (event.ledger > endLedger) break
      const pair = parseNewPairEvent(event)
      if (pair) {
        cachePairId(pair.tokenId, pair.pairId)
        pairs.push(pair)
      }
    }

    const lastLedger = page.events.at(-1)?.ledger
    if (page.events.length === 0 || !page.cursor) break
    if (lastLedger !== undefined && lastLedger > endLedger) break
    if (page.events.length < 200) break
    cursor = page.cursor
  }

  return newestPairPerToken(pairs)
}

/** Metadata SEP-41 con fallback legible si el contrato no la implementa. */
const METADATA_TTL_MS = 24 * 60 * 60 * 1000
/** Doble del TTL: al escribir se depuran entradas caducadas para no crecer sin límite. */
const METADATA_PRUNE_AFTER = METADATA_TTL_MS * 2
const METADATA_MAX_ENTRIES = 100
const METADATA_STORAGE_KEY = 'astrogate.token-meta.v1'

export type ImmutableTokenMetadata = {
  name: string
  symbol: string
  decimals: number
}

const metadataCache = new Map<
  string,
  { at: number; meta: ImmutableTokenMetadata }
>()

function loadStoredMetadata(): void {
  if (metadataCache.size > 0) return
  const parsed = readStorageJson<Record<string, unknown>>(METADATA_STORAGE_KEY)
  if (!parsed) return
  const now = Date.now()
  for (const [id, entry] of Object.entries(parsed)) {
    const typed = entry as { at?: unknown; meta?: Partial<ImmutableTokenMetadata> }
    if (
      typed &&
      typeof typed.at === 'number' &&
      now - typed.at < METADATA_TTL_MS &&
      typed.meta &&
      typeof typed.meta.name === 'string' &&
      typeof typed.meta.symbol === 'string' &&
      typeof typed.meta.decimals === 'number'
    ) {
      metadataCache.set(id, typed as { at: number; meta: ImmutableTokenMetadata })
    }
  }
}

export function getCachedTokenMetadata(
  tokenId: string,
): ImmutableTokenMetadata | null {
  loadStoredMetadata()
  const cached = metadataCache.get(tokenId)
  if (cached && Date.now() - cached.at < METADATA_TTL_MS) return cached.meta
  return null
}

export function setCachedTokenMetadata(
  tokenId: string,
  meta: ImmutableTokenMetadata,
): void {
  loadStoredMetadata()
  const now = Date.now()
  metadataCache.set(tokenId, { at: now, meta })

  // Depura entradas caducadas/acotadas ANTES de persistir (evita crecimiento sin límite).
  for (const [id, entry] of metadataCache) {
    if (
      now - entry.at >= METADATA_PRUNE_AFTER ||
      (metadataCache.size > METADATA_MAX_ENTRIES && id !== tokenId)
    ) {
      metadataCache.delete(id)
    }
  }

  writeStorageJson(METADATA_STORAGE_KEY, Object.fromEntries(metadataCache.entries()))
}

async function fetchTokenMetadata(
  tokenId: string,
): Promise<ImmutableTokenMetadata> {
  // Indexado ligero: la metadata SEP-41 no cambia; la caché evita
  // 3 simulaciones RPC por token en cada visita o refresh del feed.
  const cached = getCachedTokenMetadata(tokenId)
  if (cached) return cached

  const client = tokenClient(tokenId)
  const fallback = {
    name: 'Token sin metadata',
    symbol: shortAddress(tokenId),
    decimals: 7,
  }

  try {
    const [nameTx, symbolTx, decimalsTx] = await Promise.all([
      client.name(),
      client.symbol(),
      client.decimals(),
    ])
    const meta = {
      name: nameTx.result || fallback.name,
      symbol: symbolTx.result || fallback.symbol,
      decimals: decimalsTx.result,
    }
    setCachedTokenMetadata(tokenId, meta)
    return meta
  } catch {
    // Sin cachear el fallback: puede ser un fallo transitorio del RPC.
    return fallback
  }
}

/** Un token con metadata + reservas; `null` si el par no responde. */
export async function fetchTokenListing(
  pair: DiscoveredPair,
): Promise<TokenListing | null> {
  try {
    if (pair.pairId) {
      cachePairId(pair.tokenId, pair.pairId)
    }
    const [metadata, pool] = await Promise.all([
      fetchTokenMetadata(pair.tokenId),
      fetchPoolState(pair.tokenId),
    ])
    if (!pool.exists) return null
    return { id: pair.tokenId, ...metadata, ledger: pair.ledger, pool }
  } catch {
    return null
  }
}

/** Ejecuta `fn` sobre `items` con concurrencia acotada. */
async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let next = 0

  async function worker() {
    while (next < items.length) {
      const index = next++
      results[index] = await fn(items[index])
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker()),
  )
  return results
}

/** Convierte un StoredTokenRecord de IndexedDB a TokenListing (tolerante a registros corruptos). */
export function recordToListing(record: StoredTokenRecord): TokenListing {
  // Los reserves vienen de disco; un registro corrupto con texto no numérico
  // degrade a 0n en lugar de lanzar (BigInt SyntaxError) y tirar el feed.
  const toBase = (raw: string): bigint => {
    try {
      return BigInt(raw || '0')
    } catch {
      return 0n
    }
  }
  return {
    id: record.id,
    name: record.name,
    symbol: record.symbol,
    decimals: record.decimals,
    ledger: record.ledger,
    pool: {
      exists: true,
      pairId: record.pairId,
      reserveToken: toBase(record.reserveToken),
      reserveXlm: toBase(record.reserveXlm),
    },
  }
}

/** Convierte un TokenListing a StoredTokenRecord para IndexedDB */
export function listingToRecord(listing: TokenListing): StoredTokenRecord {
  return {
    id: listing.id,
    name: listing.name,
    symbol: listing.symbol,
    decimals: listing.decimals,
    pairId: listing.pool.pairId ?? '',
    reserveToken: listing.pool.reserveToken.toString(),
    reserveXlm: listing.pool.reserveXlm.toString(),
    ledger: listing.ledger,
    updatedAt: Date.now(),
  }
}

/**
 * Escanea pares de la Factory de Soroswap directamente on-chain.
 * Garantiza que tokens creados hace más de 24 horas jamás se pierdan del mercado.
 */
export async function syncFactoryPairs(options?: {
  maxScan?: number
}): Promise<TokenListing[]> {
  try {
    const { factory } = soroswapClients()
    const lengthTx = await factory.all_pairs_length()
    const totalPairs = unwrapResult<number>(lengthTx.result, 'all_pairs_length')
    if (typeof totalPairs !== 'number' || totalPairs <= 0) return []

    const maxScan = options?.maxScan ?? 5
    const startIndex = Math.max(0, totalPairs - maxScan)
    const indices: number[] = []
    for (let i = totalPairs - 1; i >= startIndex; i--) {
      indices.push(i)
    }

    const discoveredListings = (
      await mapLimit(indices, 3, async (i) => {
        try {
          const pairTx = await factory.all_pairs({ n: i })
          const pairId = unwrapResult<string>(pairTx.result, 'all_pairs')
          if (!pairId) return null

          const pool = await fetchPoolStateByPair(pairId)
          if (!pool || !pool.exists || !pool.tokenId) return null

          cachePairId(pool.tokenId, pairId)
          const metadata = await fetchTokenMetadata(pool.tokenId)
          return {
            id: pool.tokenId,
            name: metadata.name,
            symbol: metadata.symbol,
            decimals: metadata.decimals,
            // Escaneo histórico, no eventos: no hay ledger real. 0 lo ordena
            // al final (más viejo) sin inventar ledgers que falseen novedad.
            ledger: 0,
            pool: {
              exists: true,
              pairId,
              reserveToken: pool.reserveToken,
              reserveXlm: pool.reserveXlm,
            },
          } as TokenListing
        } catch {
          return null
        }
      })
    ).filter((item): item is TokenListing => item !== null)

    if (discoveredListings.length > 0) {
      await putStoredTokens(discoveredListings.map(listingToRecord))
      await putSyncMeta({
        key: FACTORY_SYNC_META_KEY,
        lastScannedIndex: totalPairs,
        totalPairs,
        lastSyncTimestamp: Date.now(),
      })
    }

    return discoveredListings
  } catch (err) {
    console.warn('Factory sync notice:', err)
    return []
  }
}

/**
 * Listado de tokens recientes y permanentes con par en XLM.
 * Carga instantánea desde IndexedDB + sincronización en tiempo real.
 */
export async function discoverTokens(options?: {
  windowLedgers?: number
  maxTokens?: number
  pinned?: string[]
}): Promise<TokenListing[]> {
  const maxTokens = options?.maxTokens ?? DEFAULT_MAX_TOKENS
  const pinned = options?.pinned ?? DEFAULT_PINNED_TOKENS

  // 1. Carga instantánea desde almacenamiento local persistente (0ms)
  const storedRecords = await getAllStoredTokens()
  const storedListings: TokenListing[] = []
  for (const record of storedRecords) {
    try {
      storedListings.push(recordToListing(record))
    } catch {
      // Registro inválido: se ignora; getAllStored ya valida forma, esto es defensa extra.
    }
  }

  // 2. Traer pares de eventos en vivo
  try {
    const pairs = await discoverPairs(options)
    const discovered = pairs.filter((pair) => !pinned.includes(pair.tokenId))
    const pinnedPairs: DiscoveredPair[] = pinned.map(
      (tokenId) =>
        pairs.find((pair) => pair.tokenId === tokenId) ?? {
          tokenId,
          pairId: '',
          ledger: 0,
        },
    )
    const selected = [...pinnedPairs, ...discovered].slice(0, maxTokens)

    // Concurrencia acotada a 3 para no saturar RPC
    const freshEventListings = (await mapLimit(selected, 3, fetchTokenListing)).filter(
      (listing): listing is TokenListing => listing !== null,
    )

    if (freshEventListings.length > 0) {
      await putStoredTokens(freshEventListings.map(listingToRecord))
    }

    // Si no había registros almacenados, lanzamos sync de factory sin bloquear
    if (storedListings.length === 0 && typeof window !== 'undefined') {
      syncFactoryPairs({ maxScan: 10 }).catch(() => {})
    }

    // Fusión por id de token
    const map = new Map<string, TokenListing>()
    for (const item of storedListings) map.set(item.id, item)
    for (const item of freshEventListings) map.set(item.id, item)

    const merged = Array.from(map.values())
    merged.sort((a, b) => {
      const aPinned = pinned.includes(a.id)
      const bPinned = pinned.includes(b.id)
      if (aPinned && !bPinned) return -1
      if (!aPinned && bPinned) return 1
      return b.ledger - a.ledger
    })

    return merged.slice(0, maxTokens)
  } catch {
    return storedListings.slice(0, maxTokens)
  }
}
