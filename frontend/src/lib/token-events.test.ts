import { nativeToScVal, rpc } from '@stellar/stellar-sdk'
import { describe, expect, it } from 'vitest'
import {
  classifyTokenEvent,
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
