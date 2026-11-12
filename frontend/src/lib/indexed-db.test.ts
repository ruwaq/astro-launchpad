import { describe, expect, it } from 'vitest'
import {
  getAllStoredTokens,
  getSyncMeta,
  isStoredTokenRecord,
  putStoredTokens,
  putSyncMeta,
  type StoredTokenRecord,
} from './indexed-db'

const VALID_TOKEN_ID = 'CAI637WCEILQF3ZYOV6BRUCX532XQIVOOJ4CRWFPWHQRJHOH5OKHSXRE'
const VALID_PAIR_ID = 'CA32TMZ2AODXI7K7B6T2YPZR52HJKFCY5GT2DNHMOL326DLSNPX55BUP'

describe('IndexedDB storage layer (with memory fallback)', () => {
  it('stores and retrieves token records', async () => {
    const record: StoredTokenRecord = {
      id: VALID_TOKEN_ID,
      name: 'Test Astro',
      symbol: 'TASTRO',
      decimals: 7,
      pairId: VALID_PAIR_ID,
      reserveToken: '1000000000',
      reserveXlm: '50000000',
      ledger: 1000,
      updatedAt: Date.now(),
    }

    await putStoredTokens([record])
    const all = await getAllStoredTokens()
    const found = all.find((t) => t.id === VALID_TOKEN_ID)
    expect(found).toBeDefined()
    expect(found?.symbol).toBe('TASTRO')
    expect(found?.reserveXlm).toBe('50000000')
  })

  it('stores and retrieves sync metadata', async () => {
    await putSyncMeta({
      key: 'factory_sync',
      lastScannedIndex: 636,
      totalPairs: 636,
      lastSyncTimestamp: 123456789,
    })

    const meta = await getSyncMeta()
    expect(meta.lastScannedIndex).toBe(636)
    expect(meta.totalPairs).toBe(636)
  })

  it('validates records via isStoredTokenRecord shape guard', () => {
    const valid: StoredTokenRecord = {
      id: VALID_TOKEN_ID,
      name: 'Valid Token',
      symbol: 'VAL',
      decimals: 7,
      pairId: VALID_PAIR_ID,
      reserveToken: '1000000',
      reserveXlm: '500000',
      ledger: 12345,
      updatedAt: 1600000000,
    }
    expect(isStoredTokenRecord(valid)).toBe(true)

    // Negative reserve rejected
    expect(isStoredTokenRecord({ ...valid, reserveToken: '-1000' })).toBe(false)
    expect(isStoredTokenRecord({ ...valid, reserveXlm: '-50' })).toBe(false)

    // Non-numeric reserve rejected
    expect(isStoredTokenRecord({ ...valid, reserveToken: 'abc' })).toBe(false)
    expect(isStoredTokenRecord({ ...valid, reserveToken: '' })).toBe(false)

    // Non-56 char ID rejected
    expect(isStoredTokenRecord({ ...valid, id: 'CTOKEN123' })).toBe(false)
    // Non-C starting ID rejected
    expect(
      isStoredTokenRecord({
        ...valid,
        id: 'GAI637WCEILQF3ZYOV6BRUCX532XQIVOOJ4CRWFPWHQRJHOH5OKHSXRE',
      }),
    ).toBe(false)

    // Negative decimals rejected
    expect(isStoredTokenRecord({ ...valid, decimals: -1 })).toBe(false)
  })
})
