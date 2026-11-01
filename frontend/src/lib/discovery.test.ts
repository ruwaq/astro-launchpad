import { describe, expect, it } from 'vitest'
import { nativeToScVal } from '@stellar/stellar-sdk'
import { newestPairPerToken, parseNewPairEvent } from './discovery'
import { XLM_SAC } from './network'

type RawEvent = Parameters<typeof parseNewPairEvent>[0]

function pairEvent(
  pair: string,
  token0: string,
  token1: string,
  ledger = 100,
): RawEvent {
  return {
    topic: [
      nativeToScVal('SoroswapFactory'),
      nativeToScVal('new_pair'),
    ],
    value: nativeToScVal({
      new_pairs_length: 1,
      pair,
      token_0: token0,
      token_1: token1,
    }),
    ledger,
    id: `${ledger}-1`,
    pagingToken: `${ledger}-1`,
    contractId: 'CFACTORY',
    inSuccessfulContractCall: true,
    txHash: 'deadbeef',
    type: 'contract',
  } as unknown as RawEvent
}

describe('parseNewPairEvent', () => {
  it('extrae el token distinto de XLM', () => {
    const parsed = parseNewPairEvent(
      pairEvent('CPAIR', XLM_SAC, 'CTOKEN'),
    )
    expect(parsed).toEqual({
      tokenId: 'CTOKEN',
      pairId: 'CPAIR',
      ledger: 100,
    })
  })

  it('detecta el token aunque venga como token_0', () => {
    const parsed = parseNewPairEvent(
      pairEvent('CPAIR', 'CTOKEN', XLM_SAC, 250),
    )
    expect(parsed?.tokenId).toBe('CTOKEN')
    expect(parsed?.ledger).toBe(250)
  })

  it('ignora eventos de otro contrato, otros topics o pares sin XLM', () => {
    expect(parseNewPairEvent(pairEvent('CPAIR', 'CTA', 'CTB'))).toBeNull()

    const otherTopic = {
      ...pairEvent('CPAIR', XLM_SAC, 'CTOKEN'),
      topic: [nativeToScVal('SoroswapFactory'), nativeToScVal('other')],
    } as unknown as RawEvent
    expect(parseNewPairEvent(otherTopic)).toBeNull()

    const otherContract = {
      ...pairEvent('CPAIR', XLM_SAC, 'CTOKEN'),
      contractId: 'COTRA',
    } as unknown as RawEvent
    // El parser no filtra por contrato: el filtro se hace en getEvents.
    expect(parseNewPairEvent(otherContract)?.tokenId).toBe('CTOKEN')
  })
})

describe('newestPairPerToken', () => {
  it('se queda con el par más reciente de cada token y ordena por novedad', () => {
    const pairs = [
      { tokenId: 'CTA', pairId: 'PAIR-A1', ledger: 10 },
      { tokenId: 'CTB', pairId: 'PAIR-B1', ledger: 20 },
      { tokenId: 'CTA', pairId: 'PAIR-A2', ledger: 30 },
    ]
    expect(newestPairPerToken(pairs)).toEqual([
      { tokenId: 'CTA', pairId: 'PAIR-A2', ledger: 30 },
      { tokenId: 'CTB', pairId: 'PAIR-B1', ledger: 20 },
    ])
  })

  it('devuelve una lista vacía sin pares', () => {
    expect(newestPairPerToken([])).toEqual([])
  })
})
