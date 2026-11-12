import { nativeToScVal, rpc } from '@stellar/stellar-sdk'
import { describe, expect, it, vi } from 'vitest'
import { LAUNCHPAD_CONTRACT_ID } from './network'
import {
  classifyTokenEvent,
  fetchTokenEvents,
  parseTokenEvent,
  reconstructSnapshotsFromEvents,
  tokenEventSummary,
  type TokenEvent,
} from './token-events'

const FROM = 'GABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
const TO = 'GZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ'

function event(
  topics: unknown[],
  value: unknown = 100n,
): rpc.Api.EventResponse {
  return {
    id: 'event-1',
    type: 'contract',
    ledger: 123,
    ledgerClosedAt: '2026-11-01T10:00:00Z',
    contractId: 'CTOKEN',
    txHash: 'abc123',
    topic: topics.map((topic) => nativeToScVal(topic)),
    value: nativeToScVal(value),
  } as unknown as rpc.Api.EventResponse
}

function summary(overrides: Partial<TokenEvent>): string {
  return tokenEventSummary({
    id: 'e',
    kind: 'transfer',
    amount: 1n,
    ledger: 1,
    at: '2026-11-01T10:00:00Z',
    ...overrides,
  })
}

describe('parseTokenEvent', () => {
  it('parsea transferencias con from, to y monto', () => {
    expect(parseTokenEvent(event(['transfer', FROM, TO]))).toEqual({
      id: 'event-1',
      kind: 'transfer',
      from: FROM,
      to: TO,
      amount: 100n,
      ledger: 123,
      at: '2026-11-01T10:00:00Z',
      txHash: 'abc123',
    })
  })

  it('parsea emisiones y quemas', () => {
    expect(parseTokenEvent(event(['mint', TO]))).toMatchObject({
      kind: 'mint',
      to: TO,
      amount: 100n,
    })
    expect(parseTokenEvent(event(['burn', FROM]))).toMatchObject({
      kind: 'burn',
      from: FROM,
      amount: 100n,
    })
  })

  it('ignora eventos que no son movimientos del token', () => {
    expect(parseTokenEvent(event(['approve', FROM, TO]))).toBeNull()
    expect(parseTokenEvent(event(['transfer', FROM]))).toBeNull()
    expect(parseTokenEvent(event(['mint', TO], 'no-es-un-monto'))).toBeNull()
    expect(parseTokenEvent(event(['burn', FROM], -1n))).toBeNull()
  })
})

describe('tokenEventSummary y clasificación de trades (buy/sell)', () => {
  it('resume transferencia, emisión y quema', () => {
    expect(summary({ kind: 'transfer', from: FROM, to: TO })).toBe(
      'GABCDE…4567 → GZZZZZ…ZZZZ',
    )
    expect(summary({ kind: 'mint', to: TO })).toBe('Minted to GZZZZZ…ZZZZ')
    expect(summary({ kind: 'burn', from: FROM })).toBe('Burned from GABCDE…4567')
  })

  it('identifica compras (from === pairId) y ventas (to === pairId)', () => {
    const buyEvent: TokenEvent = {
      id: '1',
      kind: 'transfer',
      from: 'CPAIR123456',
      to: TO,
      amount: 500n,
      ledger: 10,
      at: '2026-11-01T10:00:00Z',
    }
    const sellEvent: TokenEvent = {
      id: '2',
      kind: 'transfer',
      from: FROM,
      to: 'CPAIR123456',
      amount: 200n,
      ledger: 11,
      at: '2026-11-01T10:05:00Z',
    }
    expect(classifyTokenEvent(buyEvent, 'CPAIR123456')).toBe('buy')
    expect(classifyTokenEvent(sellEvent, 'CPAIR123456')).toBe('sell')
    expect(tokenEventSummary(buyEvent, 'CPAIR123456')).toContain('Buyer')
    expect(tokenEventSummary(sellEvent, 'CPAIR123456')).toContain('Seller')

    const launchSeedEvent: TokenEvent = {
      id: '3',
      kind: 'transfer',
      from: LAUNCHPAD_CONTRACT_ID,
      to: 'CPAIR123456',
      amount: 9_950_000_000_000_000n,
      ledger: 12,
      at: '2026-11-01T10:06:00Z',
    }
    expect(classifyTokenEvent(launchSeedEvent, 'CPAIR123456')).toBe('transfer')
    expect(tokenEventSummary(launchSeedEvent, 'CPAIR123456')).toBe(
      'Launchpad Seed → Soroswap Pool',
    )
  })

  it('reconstruye la curva histórica de reservas y precios a partir de trades on-chain', () => {
    const pool = {
      exists: true,
      pairId: 'CPAIR123456',
      reserveToken: 900_000n,
      reserveXlm: 100_000n,
    }
    const events: TokenEvent[] = [
      {
        id: 'buy-1',
        kind: 'transfer',
        from: 'CPAIR123456',
        to: TO,
        amount: 100_000n,
        ledger: 100,
        at: '2026-11-01T10:00:00Z',
      },
      // Self-transfer to/from pair contract should be ignored
      {
        id: 'self-1',
        kind: 'transfer',
        from: 'CPAIR123456',
        to: 'CPAIR123456',
        amount: 50_000n,
        ledger: 101,
        at: '2026-11-01T10:02:00Z',
      },
    ]
    const snapshots = reconstructSnapshotsFromEvents(
      events,
      pool,
      Date.parse('2026-11-01T10:10:00Z'),
    )
    expect(snapshots.length).toBeGreaterThanOrEqual(2)
    expect(snapshots[0]?.token).toBe('1000000')
    expect(snapshots[0]?.xlm).toBe('90000')
    expect(snapshots[snapshots.length - 1]?.token).toBe('900000')
    expect(snapshots[snapshots.length - 1]?.xlm).toBe('100000')
  })
})

describe('fetchTokenEvents pagination & quiet ledgers', () => {
  it('continues pagination across quiet ledgers for tokens', async () => {
    const latestSpy = vi
      .spyOn(rpc.Server.prototype, 'getLatestLedger')
      .mockResolvedValue({ sequence: 1000 } as rpc.Api.GetLatestLedgerResponse)

    let call = 0
    const eventsSpy = vi
      .spyOn(rpc.Server.prototype, 'getEvents')
      .mockImplementation(async () => {
        call++
        if (call === 1) {
          return {
            events: [],
            cursor: '0000000100000000-0',
            latestLedger: 1000,
            oldestLedger: 100,
          } as unknown as rpc.Api.GetEventsResponse
        }
        return {
          events: [event(['transfer', FROM, TO], 500n)],
          cursor: '4294967296000-0',
          latestLedger: 1000,
          oldestLedger: 100,
        } as unknown as rpc.Api.GetEventsResponse
      })

    const result = await fetchTokenEvents('CTOKEN123')
    expect(result.length).toBe(1)
    expect(result[0]?.amount).toBe(500n)

    latestSpy.mockRestore()
    eventsSpy.mockRestore()
  })

  it('clamps startLedger and retries on retention limit error', async () => {
    const latestSpy = vi
      .spyOn(rpc.Server.prototype, 'getLatestLedger')
      .mockResolvedValue({ sequence: 8000 } as rpc.Api.GetLatestLedgerResponse)

    let call = 0
    const eventsSpy = vi
      .spyOn(rpc.Server.prototype, 'getEvents')
      .mockImplementation(async (req) => {
        call++
        if (call === 1) {
          throw new Error('startLedger must be within the ledger range: 7500 - 8000')
        }
        expect(req.startLedger).toBe(7500)
        return {
          events: [event(['mint', TO], 1000n)],
          cursor: '0000000800000000-0',
          latestLedger: 8000,
          oldestLedger: 7500,
        } as unknown as rpc.Api.GetEventsResponse
      })

    const result = await fetchTokenEvents('CTOKEN123')
    expect(result.length).toBe(1)
    expect(result[0]?.kind).toBe('mint')

    latestSpy.mockRestore()
    eventsSpy.mockRestore()
  })

  it('returns empty array when network is unreachable without throwing', async () => {
    const latestSpy = vi
      .spyOn(rpc.Server.prototype, 'getLatestLedger')
      .mockRejectedValue(new Error('Network offline'))

    const result = await fetchTokenEvents('CTOKEN123')
    expect(result).toEqual([])

    latestSpy.mockRestore()
  })
})
