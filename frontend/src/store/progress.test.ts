import { beforeEach, describe, expect, it } from 'vitest'
import { loadProgress, useProgress } from './progress'
import { clearStorageMemoryFallbackForTests, writeStorageJson } from '../lib/storage'

describe('useProgress', () => {
  beforeEach(() => {
    clearStorageMemoryFallbackForTests()
    useProgress.setState({ liquidity: false, swapped: false })
  })

  it('marks steps as completed', () => {
    expect(useProgress.getState().liquidity).toBe(false)
    useProgress.getState().mark('liquidity')
    expect(useProgress.getState().liquidity).toBe(true)
    expect(useProgress.getState().swapped).toBe(false)

    useProgress.getState().mark('swapped')
    expect(useProgress.getState().swapped).toBe(true)
  })

  it('transparently migrates legacy floodgate.progress.v1', () => {
    clearStorageMemoryFallbackForTests()
    writeStorageJson('floodgate.progress.v1', { liquidity: true, swapped: false })

    const loaded = loadProgress()
    expect(loaded.liquidity).toBe(true)
    expect(loaded.swapped).toBe(false)
  })
})
