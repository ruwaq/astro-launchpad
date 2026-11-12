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
import {
  EVENT_WINDOW_LEDGERS,
  LAUNCHPAD_CONTRACT_ID,
  executeWithRpcFailover,
} from './network'
import { shortAddress } from './format'
import type { PoolState } from './soroswap'
import { dedupeSnapshots, type ReserveSnapshot } from './snapshots'
import { launchpadClient } from './token'

/**
 * Ventana por defecto compartida con discovery.ts (misma constante en network.ts).
 */
export const TOKEN_EVENT_WINDOW_LEDGERS = EVENT_WINDOW_LEDGERS

/** Max events returned to UI. */
export const TOKEN_EVENT_LIMIT = 50

const PAGE_LIMIT = 200
const MAX_PAGES = 10
/** Milisegundos entre el evento más viejo y el punto inicial reconstruido. */
const SNAPSHOT_GAP_MS = 5_000
/** Ventana de respaldo si la fecha del evento más viejo no se puede parsear. */
const FALLBACK_WINDOW_MS = 60_000

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
      if (event.from === LAUNCHPAD_CONTRACT_ID) {
        return 'Launchpad Seed → Soroswap Pool'
      }
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
 * - If tokens move into pair (`to === pairId`), it's a SELL / LP deposit (`sell`),
 *   except the atomic Fair Launch initial seed from LAUNCHPAD_CONTRACT_ID (`transfer`).
 */
export function classifyTokenEvent(
  event: TokenEvent,
  pairId?: string | null,
): TokenTradeRole {
  if (event.kind === 'transfer' && pairId) {
    if (event.from === pairId) return 'buy'
    if (event.to === pairId) {
      if (event.from === LAUNCHPAD_CONTRACT_ID) return 'transfer'
      return 'sell'
    }
  }
  return event.kind
}

/**
 * Reconstructs reserve and price history from on-chain pair transfers.
 *
 * Approximation with disclosed limitation: Soroswap does not emit `swap`
 * events (verified in testnet, 0 in 10k ledgers), so `buy`/`sell` and
 * `add/remove liquidity` are indistinguishable from token transfers alone.
 * Liquidity adds break the assumed `x * y = k` invariant and can skew the
 * middle of the reconstructed curve; the realtime edge always uses the REAL
 * reserves read from the pair, and discovery/snapshots re-anchor the recent
 * history. A full fix requires an indexer of pair events.
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
      e.from !== e.to &&
      e.from !== LAUNCHPAD_CONTRACT_ID &&
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
      curXlm = curToken > 0n ? k / curToken : curXlm
    } else if (ev.to === pairId && curToken > ev.amount) {
      const nextToken = curToken - ev.amount
      if (nextToken > 1000n) {
        curToken = nextToken
        curXlm = k / curToken
      } else {
        break
      }
    }
  }

  if (poolEvents.length > 0 && curXlm > 0n) {
    const oldestEvent = poolEvents[poolEvents.length - 1]
    const oldestTime = Date.parse(oldestEvent?.at ?? '')
    const startT =
      Number.isFinite(oldestTime) && oldestTime > SNAPSHOT_GAP_MS
        ? oldestTime - SNAPSHOT_GAP_MS
        : now - FALLBACK_WINDOW_MS
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

  return dedupeSnapshots(chronological)
}

/**
 * Reads recent window and returns up to `maxEvents`.
 * Robust against quiet ledgers and Soroban RPC retention window bounds.
 */
export async function fetchTokenEvents(
  tokenId: string,
  options?: { windowLedgers?: number; maxEvents?: number },
): Promise<TokenEvent[]> {
  if (!tokenId) return []

  const windowLedgers = options?.windowLedgers ?? TOKEN_EVENT_WINDOW_LEDGERS
  const maxEvents = Math.max(1, options?.maxEvents ?? TOKEN_EVENT_LIMIT)

  let latestLedgerSeq: number
  try {
    const latest = await executeWithRpcFailover((rpcUrl) =>
      new rpc.Server(rpcUrl).getLatestLedger(),
    )
    latestLedgerSeq = latest.sequence
  } catch {
    return []
  }

  let startLedger = Math.max(1, latestLedgerSeq - windowLedgers)
  const endLedger = latestLedgerSeq
  const filters = [{ type: 'contract' as const, contractIds: [tokenId] }]

  let cursor: string | undefined
  let collected: TokenEvent[] = []
  let emptyPagesCount = 0
  const MAX_EMPTY_PAGES = 5
  let retriedWithClampedLedger = false

  for (
    let pageNumber = 0;
    pageNumber < MAX_PAGES && emptyPagesCount < MAX_EMPTY_PAGES;
    pageNumber++
  ) {
    let page: rpc.Api.GetEventsResponse
    try {
      page = await executeWithRpcFailover((rpcUrl) =>
        new rpc.Server(rpcUrl).getEvents({
          filters,
          ...(cursor ? { cursor } : { startLedger }),
          limit: PAGE_LIMIT,
        }),
      )
    } catch (err: unknown) {
      const errMsg = (err as Error)?.message || String(err)
      const match = errMsg.match(/ledger range:\s*(\d+)\s*-\s*(\d+)/i)
      if (match && match[1] && !retriedWithClampedLedger) {
        const minLedger = parseInt(match[1], 10)
        if (Number.isFinite(minLedger) && minLedger > 0) {
          startLedger = minLedger
          retriedWithClampedLedger = true
          pageNumber-- // Retry without consuming an iteration
          continue
        }
      }
      break
    }

    let reachedEnd = false
    for (const event of page.events) {
      if (event.ledger > endLedger) {
        reachedEnd = true
        break
      }
      const parsed = parseTokenEvent(event)
      if (parsed) collected.push(parsed)
    }

    if (reachedEnd) break

    // Quiet ledger handling: consecutive empty pages increment counter,
    // but a non-empty page resets it without aborting pagination prematurely.
    if (page.events.length === 0) {
      emptyPagesCount++
    } else {
      emptyPagesCount = 0
    }

    if (!page.cursor || page.cursor === cursor) break

    try {
      const cursorToid = BigInt(page.cursor.split('-')[0] || '0')
      const cursorLedger = Number(cursorToid >> 32n)
      if (cursorLedger >= endLedger) {
        break
      }
    } catch {
      // Ignore cursor parsing failure
    }

    cursor = page.cursor

    if (collected.length > maxEvents * 4) {
      collected = collected.slice(-maxEvents * 4)
    }
  }

  return collected.slice(-maxEvents).reverse()
}

export interface TokenShout {
  sender: string
  amount: bigint
  message: string
  ledger: number
  timestamp: bigint
}

/**
 * Fetches newest-first on-chain Burn-to-Chat shouts from Launchpad's
 * persistent `TokenShouts` log (immune to Soroban RPC's 24h event retention).
 */
export async function fetchTokenShouts(
  tokenId: string,
): Promise<TokenShout[]> {
  if (!tokenId) return []
  try {
    const records = await executeWithRpcFailover(async (rpcUrl) => {
      const tx = await launchpadClient(undefined, rpcUrl).get_shouts({
        token: tokenId,
      })
      return tx.result
    })
    if (!Array.isArray(records)) return []
    return records
      .map((item) => ({
        sender: item.sender,
        amount: item.amount,
        message: item.message,
        ledger: item.ledger,
        timestamp: item.timestamp,
      }))
      .reverse()
  } catch {
    return []
  }
}
