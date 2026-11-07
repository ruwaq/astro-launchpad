/**
 * Recent SEP-41 token activity read directly from RPC.
 *
 * OpenZeppelin emits:
 *   transfer: topics ["transfer", from, to], value amount
 *   mint:     topics ["mint", to],            value amount
 *   burn:     topics ["burn", from],          value amount
 *
 * Recent window from RPC without external indexing. Soroswap AMM does not
 * emit swap events directly; trades are detected by tracking pair transfers.
 */
import { rpc, scValToNative } from '@stellar/stellar-sdk'
import { RPC_URL } from './network'
import { shortAddress } from './format'
import type { PoolState } from './soroswap'
import type { ReserveSnapshot } from './snapshots'

/** Default window: ~14 h of testnet (~5 s ledgers). */
export const TOKEN_EVENT_WINDOW_LEDGERS = 10_000

/** Max events returned to UI. */
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
  /** ISO 8601 string. */
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

/** Converts raw event into token movement. */
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

/** Short descriptive text for event row. */
export function tokenEventSummary(
  event: TokenEvent,
  pairId?: string | null,
): string {
  if (event.kind === 'transfer') {
    if (pairId && event.from === pairId) {
      return `Buyer ${shortAddress(event.to ?? '')} ← Soroswap Pool`
    }
    if (pairId && event.to === pairId) {
      return `Seller / LP ${shortAddress(event.from ?? '')} → Soroswap Pool`
    }
    return `${shortAddress(event.from ?? '')} → ${shortAddress(event.to ?? '')}`
  }
  if (event.kind === 'mint') {
    return `Minted to ${shortAddress(event.to ?? '')}`
  }
  return `Burned from ${shortAddress(event.from ?? '')}`
}

export type TokenTradeRole = 'buy' | 'sell' | 'transfer' | 'mint' | 'burn'

/**
 * Classifies SEP-41 event relative to pairId:
 * - If tokens move out of pair (`from === pairId`), it's a BUY (`buy`).
 * - If tokens move into pair (`to === pairId`), it's a SELL / LP deposit (`sell`).
 */
export function classifyTokenEvent(
  event: TokenEvent,
  pairId?: string | null,
): TokenTradeRole {
  if (event.kind === 'transfer' && pairId) {
    if (event.from === pairId) return 'buy'
    if (event.to === pairId) return 'sell'
  }
  return event.kind
}

/**
 * Reconstructs reserve and price history from on-chain pair transfers using x * y = k invariant.
 */
export function reconstructSnapshotsFromEvents(
  events: TokenEvent[],
  pool: PoolState | undefined,
  now = Date.now(),
): ReserveSnapshot[] {
  if (
    !pool ||
    !pool.exists ||
    !pool.pairId ||
    pool.reserveToken <= 0n ||
    pool.reserveXlm <= 0n
  ) {
    return []
  }

  const pairId = pool.pairId
  const k = pool.reserveToken * pool.reserveXlm

  const poolEvents = events.filter(
    (e) =>
      e.kind === 'transfer' &&
      e.amount > 0n &&
      (e.from === pairId || e.to === pairId),
  )

  let curToken = pool.reserveToken
  let curXlm = pool.reserveXlm
  const reversedPoints: ReserveSnapshot[] = []

  for (const ev of poolEvents) {
    const parsedTime = Date.parse(ev.at)
    const t = Number.isFinite(parsedTime) && parsedTime > 0 ? parsedTime : now
    reversedPoints.push({
      t,
      xlm: curXlm.toString(),
      token: curToken.toString(),
    })

    if (ev.from === pairId) {
      curToken = curToken + ev.amount
      curXlm = k / curToken
    } else if (ev.to === pairId && curToken > ev.amount) {
      curToken = curToken - ev.amount
      curXlm = k / curToken
    }
  }

  if (poolEvents.length > 0 && curXlm > 0n) {
    const oldestEvent = poolEvents[poolEvents.length - 1]
    const oldestTime = Date.parse(oldestEvent?.at ?? '')
    const startT =
      Number.isFinite(oldestTime) && oldestTime > 5_000
        ? oldestTime - 5_000
        : now - 60_000
    reversedPoints.push({
      t: startT,
      xlm: curXlm.toString(),
      token: curToken.toString(),
    })
  }

  const chronological = reversedPoints.reverse()
  chronological.push({
    t: now,
    xlm: pool.reserveXlm.toString(),
    token: pool.reserveToken.toString(),
  })

  return chronological
}

/**
 * Reads recent window and returns up to `maxEvents`.
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

    if (collected.length > maxEvents * 4) {
      collected = collected.slice(-maxEvents * 4)
    }
  }

  return collected.slice(-maxEvents).reverse()
}
