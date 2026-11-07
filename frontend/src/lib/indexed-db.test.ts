import { describe, expect, it } from 'vitest'
import {
  getAllStoredTokens,
  getSyncMeta,
  putStoredTokens,
  putSyncMeta,
  type StoredTokenRecord,
} from './indexed-db'

describe('IndexedDB storage layer (with memory fallback)', () => {
  it('stores and retrieves token records', async () => {
    const record: StoredTokenRecord = {
      id: 'CTOKEN123',
      name: 'Test Astro',
      symbol: 'TASTRO',
      decimals: 7,
      pairId: 'CPAIR123',
      reserveToken: '1000000000',
      reserveXlm: '50000000',
      ledger: 1000,
      updatedAt: Date.now(),
    }

    await putStoredTokens([record])
    const all = await getAllStoredTokens()
    const found = all.find((t) => t.id === 'CTOKEN123')
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
})
