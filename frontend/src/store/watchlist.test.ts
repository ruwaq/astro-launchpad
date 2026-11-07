import { describe, expect, it } from 'vitest'
import { useWatchlist } from './watchlist'

describe('useWatchlist', () => {
  it('toggles favorites on and off correctly', () => {
    const { toggle, isFavorite } = useWatchlist.getState()
    const testId = 'CTOKEN123'

    expect(isFavorite(testId)).toBe(false)
    toggle(testId)
    expect(useWatchlist.getState().isFavorite(testId)).toBe(true)
    toggle(testId)
    expect(useWatchlist.getState().isFavorite(testId)).toBe(false)
  })
})
