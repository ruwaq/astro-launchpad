import { describe, expect, it } from 'vitest'
import {
  activityLabel,
  activitySummary,
  appendActivity,
  type ActivityEntry,
} from './activity'

function entry(overrides: Partial<ActivityEntry> = {}): ActivityEntry {
  return {
    id: 'tx-1',
    kind: 'swap',
    status: 'success',
    tokenId: 'CTOKEN',
    tokenSymbol: 'MOON',
    at: 1,
    ...overrides,
  }
}

describe('activityLabel', () => {
  it('etiqueta cada tipo de operación', () => {
    expect(activityLabel('create')).toBe('Token Created')
    expect(activityLabel('add-liquidity')).toBe('Liquidity Added')
    expect(activityLabel('remove-liquidity')).toBe('Liquidity Removed')
    expect(activityLabel('swap')).toBe('Swap')
    expect(activityLabel('transfer')).toBe('Transfer')
    expect(activityLabel('mint')).toBe('Mint')
    expect(activityLabel('burn')).toBe('Burn')
  })
})

describe('activitySummary', () => {
  it('resume un swap con sus dos lados', () => {
    expect(
      activitySummary(
        entry({ amount: '5', secondaryAmount: '4.7', secondarySymbol: 'XLM' }),
      ),
    ).toBe('5 MOON → 4.7 XLM')
  })

  it('invierte la dirección visible en una compra', () => {
    expect(
      activitySummary(
        entry({
          amount: '10',
          secondaryAmount: '1',
          secondarySymbol: 'XLM',
          swapDirection: 'buy',
          detail: 'buy',
        }),
      ),
    ).toBe('1 XLM → 10 MOON · buy')
  })

  it('resume liquidez con detalle de LP', () => {
    expect(
      activitySummary(
        entry({
          kind: 'add-liquidity',
          amount: '100',
          secondaryAmount: '10',
          secondarySymbol: 'XLM',
          detail: '31.62 LP',
        }),
      ),
    ).toBe('100 MOON + 10 XLM · 31.62 LP')
  })

  it('resume transferencias con la contraparte corta', () => {
    expect(
      activitySummary(
        entry({
          kind: 'transfer',
          amount: '2',
          counterparty: 'GABCDEFGHIJKLMNOPQRSTUVWXYZ234567',
        }),
      ),
    ).toBe('2 MOON → GABCDE…4567')
  })

  it('resume creación y quema', () => {
    expect(
      activitySummary(entry({ kind: 'create', amount: '1000' })),
    ).toBe('Initial supply: 1000 MOON')
    expect(
      activitySummary(entry({ kind: 'burn', amount: '1' })),
    ).toBe('1 MOON burned')
  })

  it('cae al símbolo cuando no hay monto', () => {
    expect(activitySummary(entry())).toBe('MOON')
  })
})

describe('appendActivity', () => {
  it('pone la más reciente primero y deduplica por id', () => {
    const first = entry({ id: 'a' })
    const second = entry({ id: 'b' })
    const next = appendActivity([first], second)
    expect(next.map((item) => item.id)).toEqual(['b', 'a'])

    const duplicate = entry({ id: 'a', amount: '9' })
    expect(appendActivity(next, duplicate).map((item) => item.id)).toEqual([
      'a',
      'b',
    ])
    expect(appendActivity(next, duplicate)[0]?.amount).toBe('9')
  })

  it('recorta al máximo', () => {
    const entries = [entry({ id: 'a' }), entry({ id: 'b' })]
    const next = appendActivity(entries, entry({ id: 'c' }), 2)
    expect(next.map((item) => item.id)).toEqual(['c', 'a'])
  })
})
