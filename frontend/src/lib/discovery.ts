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
import { fetchPoolState, type PoolState } from './soroswap'
import { tokenClient } from './token'
import { ASTRO_TOKEN_ID, RPC_URL, SOROSWAP_FACTORY, XLM_SAC } from './network'
import { shortAddress } from './format'

/** Ventana por defecto: ~14 h de testnet (ledgers de ~5 s). */
export const DEFAULT_WINDOW_LEDGERS = 10_000

/** Tokens que se listan como máximo (cada uno cuesta varias simulaciones). */
export const DEFAULT_MAX_TOKENS = 9

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
      if (pair) pairs.push(pair)
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
const METADATA_STORAGE_KEY = 'floodgate.token-meta.v1'

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
  if (typeof window === 'undefined' || metadataCache.size > 0) return
  try {
    const raw = window.localStorage.getItem(METADATA_STORAGE_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw) as Record<
      string,
      { at: number; meta: ImmutableTokenMetadata }
    >
    const now = Date.now()
    for (const [id, entry] of Object.entries(parsed)) {
      if (
        entry &&
        typeof entry.at === 'number' &&
        now - entry.at < METADATA_TTL_MS &&
        entry.meta &&
        typeof entry.meta.name === 'string' &&
        typeof entry.meta.symbol === 'string' &&
        typeof entry.meta.decimals === 'number'
      ) {
        metadataCache.set(id, entry)
      }
    }
  } catch {
    // Modo privado o JSON corrupto: seguimos con la caché en memoria.
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
  metadataCache.set(tokenId, { at: Date.now(), meta })
  if (typeof window === 'undefined') return
  try {
    const serialized = Object.fromEntries(metadataCache.entries())
    window.localStorage.setItem(METADATA_STORAGE_KEY, JSON.stringify(serialized))
  } catch {
    // Cuota llena o modo privado.
  }
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

/**
 * Listado de tokens recientes con par en XLM. Tolera fallos individuales:
 * un token roto no tumba el listado.
 */
export async function discoverTokens(options?: {
  windowLedgers?: number
  maxTokens?: number
  pinned?: string[]
}): Promise<TokenListing[]> {
  const maxTokens = options?.maxTokens ?? DEFAULT_MAX_TOKENS
  const pinned = options?.pinned ?? DEFAULT_PINNED_TOKENS
  const pairs = await discoverPairs(options)

  // Los tokens fijados van primero; si no están en la ventana se listan igual
  // (su metadata y reservas se leen del contrato, no del evento).
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

  // Concurrency 3 medida: 5 dispara throttling del RPC público y sale peor.
  const listings = await mapLimit(selected, 3, fetchTokenListing)
  return listings.filter((listing): listing is TokenListing => listing !== null)
}
