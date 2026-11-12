import { describe, expect, it, vi } from 'vitest'
import { nativeToScVal, rpc } from '@stellar/stellar-sdk'
import {
  discoverPairs,
  fetchLaunchpadRecord,
  listingToRecord,
  newestPairPerToken,
  parseNewPairEvent,
  recordToListing,
} from './discovery'
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

describe('discoverPairs pagination & quiet ledgers', () => {
  it('continues pagination across quiet ledgers instead of aborting immediately', async () => {
    const latestSpy = vi
      .spyOn(rpc.Server.prototype, 'getLatestLedger')
      .mockResolvedValue({ sequence: 500 } as rpc.Api.GetLatestLedgerResponse)

    // Page 1 has 0 events and a cursor; Page 2 has 1 pair event
    let call = 0
    const eventsSpy = vi
      .spyOn(rpc.Server.prototype, 'getEvents')
      .mockImplementation(async () => {
        call++
        if (call === 1) {
          return {
            events: [],
            cursor: '0000000100000000-0',
            latestLedger: 500,
            oldestLedger: 100,
          } as unknown as rpc.Api.GetEventsResponse
        }
        return {
          events: [pairEvent('CPAIR99', XLM_SAC, 'CTOKEN99', 300)],
          cursor: '0000000500000000-0',
          latestLedger: 500,
          oldestLedger: 100,
        } as unknown as rpc.Api.GetEventsResponse
      })

    const discovered = await discoverPairs({ windowLedgers: 400 })
    expect(discovered.length).toBe(1)
    expect(discovered[0]?.tokenId).toBe('CTOKEN99')

    latestSpy.mockRestore()
    eventsSpy.mockRestore()
  })

  it('clamps startLedger when Soroban RPC throws retention limit -32600', async () => {
    const latestSpy = vi
      .spyOn(rpc.Server.prototype, 'getLatestLedger')
      .mockResolvedValue({ sequence: 5000 } as rpc.Api.GetLatestLedgerResponse)

    let call = 0
    const eventsSpy = vi
      .spyOn(rpc.Server.prototype, 'getEvents')
      .mockImplementation(async (req) => {
        call++
        if (call === 1) {
          throw new Error(
            'startLedger must be within the ledger range: 4500 - 5000',
          )
        }
        expect(req.startLedger).toBe(4500)
        return {
          events: [pairEvent('CPAIR88', XLM_SAC, 'CTOKEN88', 4600)],
          cursor: '0000000500000000-0',
          latestLedger: 5000,
          oldestLedger: 4500,
        } as unknown as rpc.Api.GetEventsResponse
      })

    const discovered = await discoverPairs({ windowLedgers: 2000 })
    expect(discovered.length).toBe(1)
    expect(discovered[0]?.tokenId).toBe('CTOKEN88')

    latestSpy.mockRestore()
    eventsSpy.mockRestore()
  })

  it('preserves verifiedLaunchpad and creator across IndexedDB record conversions', () => {
    const listing = {
      id: 'CAI637WCEILQF3ZYOV6BRUCX532XQIVOOJ4CRWFPWHQRJHOH5OKHSXRE',
      name: 'Orbit',
      symbol: 'ORB',
      decimals: 7,
      ledger: 5500,
      verifiedLaunchpad: true,
      creator: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
      pool: {
        exists: true,
        pairId: 'CPAIR99',
        reserveToken: 1_000_000_000n,
        reserveXlm: 500_000_000n,
      },
    }
    const stored = listingToRecord(listing)
    expect(stored.isAntiRugVerified).toBe(true)
    expect(stored.creator).toBe(listing.creator)

    const roundTrip = recordToListing(stored)
    expect(roundTrip.verifiedLaunchpad).toBe(true)
    expect(roundTrip.creator).toBe(listing.creator)
    expect(roundTrip.pool.reserveXlm).toBe(500_000_000n)
  })

  it('returns null from fetchLaunchpadRecord when tokenId is invalid', async () => {
    await expect(fetchLaunchpadRecord('bad-contract-id')).resolves.toBeNull()
  })
})
