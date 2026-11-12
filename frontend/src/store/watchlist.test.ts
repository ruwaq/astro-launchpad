import { beforeEach, describe, expect, it } from 'vitest'
import { loadWatchlist, useWatchlist } from './watchlist'
import { clearStorageMemoryFallbackForTests, writeStorageJson } from '../lib/storage'

describe('useWatchlist', () => {
  beforeEach(() => {
    clearStorageMemoryFallbackForTests()
    useWatchlist.setState({ favorites: [] })
  })

  it('toggles favorites on and off correctly', () => {
    const { toggle, isFavorite } = useWatchlist.getState()
    const testId = 'CAI637WCEILQF3ZYOV6BRUCX532XQIVOOJ4CRWFPWHQRJHOH5OKHSXRE'

    expect(isFavorite(testId)).toBe(false)
    toggle(testId)
    expect(useWatchlist.getState().isFavorite(testId)).toBe(true)
    toggle(testId)
    expect(useWatchlist.getState().isFavorite(testId)).toBe(false)
  })

  it('deduplicates and validates on load', () => {
    const validId = 'CAI637WCEILQF3ZYOV6BRUCX532XQIVOOJ4CRWFPWHQRJHOH5OKHSXRE'
    writeStorageJson('astrogate.watchlist.v1', [
      validId,
      validId, // duplicate
      'invalid-id',
      12345,
    ])

    const loaded = loadWatchlist()
    expect(loaded).toEqual([validId])
  })
})
