import { nativeToScVal, rpc } from '@stellar/stellar-sdk'
import { describe, expect, it } from 'vitest'
import {
  parseTokenEvent,
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

describe('tokenEventSummary', () => {
  it('resume transferencia, emisión y quema', () => {
    expect(summary({ kind: 'transfer', from: FROM, to: TO })).toBe(
      'GABCDE…4567 → GZZZZZ…ZZZZ',
    )
    expect(summary({ kind: 'mint', to: TO })).toBe('Emisión a GZZZZZ…ZZZZ')
    expect(summary({ kind: 'burn', from: FROM })).toBe('Quema de GABCDE…4567')
  })
})
