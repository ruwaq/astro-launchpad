/**
 * Actividad reciente de un token SEP-41 leída directamente del RPC.
 *
 * OpenZeppelin emite:
 *   transfer: topics ["transfer", from, to], value amount
 *   mint:     topics ["mint", to],            value amount
 *   burn:     topics ["burn", from],          value amount
 *
 * Es una ventana reciente del RPC, no un indexer: los eventos caducan. El par
 * de Soroswap no emite `swap`, así que esto muestra movimientos del token, no
 * el histórico completo del mercado.
 */
import { rpc, scValToNative } from '@stellar/stellar-sdk'
import { RPC_URL } from './network'
import { shortAddress } from './format'

/** Ventana por defecto: ~14 h de testnet (ledgers de ~5 s). */
export const TOKEN_EVENT_WINDOW_LEDGERS = 10_000

/** Eventos que devuelve la UI (los más recientes). */
export const TOKEN_EVENT_LIMIT = 50

const PAGE_LIMIT = 200
const MAX_PAGES = 10

export type TokenEventKind = 'transfer' | 'mint' | 'burn'

export type TokenEvent = {
  id: string
  kind: TokenEventKind
  from?: string
  to?: string
  amount: bigint
  ledger: number
  /** ISO 8601, tal como lo devuelve el RPC. */
  at: string
  txHash?: string
}

type EventResponse = rpc.Api.EventResponse

function toBigInt(value: unknown): bigint | null {
  if (typeof value === 'bigint') return value
  if (typeof value === 'number' && Number.isSafeInteger(value)) {
    return BigInt(value)
  }
  if (typeof value === 'string' && /^-?\d+$/.test(value)) return BigInt(value)
  return null
}

function nativeTopic(topic: unknown): unknown {
  try {
    return scValToNative(topic as Parameters<typeof scValToNative>[0])
  } catch {
    return null
  }
}

/** Convierte un evento crudo en movimiento del token; `null` si no aplica. */
export function parseTokenEvent(event: EventResponse): TokenEvent | null {
  const topics = event.topic.map(nativeTopic)
  const kind = topics[0]
  if (kind !== 'transfer' && kind !== 'mint' && kind !== 'burn') return null

  let amount: bigint | null
  try {
    amount = toBigInt(scValToNative(event.value))
  } catch {
    return null
  }
  if (amount === null || amount < 0n) return null

  const base = {
    id: event.id,
    amount,
    ledger: event.ledger,
    at: event.ledgerClosedAt || new Date(0).toISOString(),
    txHash: event.txHash,
  }

  if (kind === 'transfer') {
    const from = topics[1]
    const to = topics[2]
    if (typeof from !== 'string' || typeof to !== 'string') return null
    return { ...base, kind, from, to }
  }

  if (kind === 'mint') {
    const to = topics[1]
    if (typeof to !== 'string') return null
    return { ...base, kind, to }
  }

  const from = topics[1]
  if (typeof from !== 'string') return null
  return { ...base, kind, from }
}

/** Texto corto para una fila: quién manda a quién, o emisión/quema. */
export function tokenEventSummary(event: TokenEvent): string {
  if (event.kind === 'transfer') {
    return `${shortAddress(event.from ?? '')} → ${shortAddress(event.to ?? '')}`
  }
  if (event.kind === 'mint') {
    return `Emisión a ${shortAddress(event.to ?? '')}`
  }
  return `Quema de ${shortAddress(event.from ?? '')}`
}

/**
 * Lee la ventana reciente y se queda con los últimos `maxEvents` movimientos.
 * Pagina con cursor; el RPC devuelve los eventos de viejo a nuevo.
 */
export async function fetchTokenEvents(
  tokenId: string,
  options?: { windowLedgers?: number; maxEvents?: number },
): Promise<TokenEvent[]> {
  const windowLedgers = options?.windowLedgers ?? TOKEN_EVENT_WINDOW_LEDGERS
  const maxEvents = Math.max(1, options?.maxEvents ?? TOKEN_EVENT_LIMIT)
  const server = new rpc.Server(RPC_URL)
  const latest = await server.getLatestLedger()
  const startLedger = Math.max(1, latest.sequence - windowLedgers)
  const endLedger = latest.sequence
  const filters = [{ type: 'contract' as const, contractIds: [tokenId] }]

  let cursor: string | undefined
  let collected: TokenEvent[] = []

  for (let pageNumber = 0; pageNumber < MAX_PAGES; pageNumber++) {
    const page = await server.getEvents({
      filters,
      ...(cursor ? { cursor } : { startLedger }),
      limit: PAGE_LIMIT,
    })

    let reachedEnd = false
    for (const event of page.events) {
      if (event.ledger > endLedger) {
        reachedEnd = true
        break
      }
      const parsed = parseTokenEvent(event)
      if (parsed) collected.push(parsed)
    }

    if (reachedEnd || page.events.length === 0 || !page.cursor) break
    if (page.events.length < PAGE_LIMIT) break
    cursor = page.cursor

    // Nunca guardamos toda la ventana si hay muchísimo tráfico: los eventos
    // nuevos quedan al final, así que podemos descartar los más viejos.
    if (collected.length > maxEvents * 4) {
      collected = collected.slice(-maxEvents * 4)
    }
  }

  return collected.slice(-maxEvents).reverse()
}
