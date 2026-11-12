import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearAppScopedStorage,
  clearStorageMemoryFallbackForTests,
  readStorageJson,
  readStorageString,
  removeStorageKey,
  writeStorageJson,
  writeStorageString,
} from './storage'

describe('Centralized storage abstraction (storage.ts)', () => {
  beforeEach(() => {
    clearStorageMemoryFallbackForTests()
    if (typeof localStorage !== 'undefined') {
      localStorage.clear()
    }
  })

  it('reads and writes strings and JSON documents safely', () => {
    expect(writeStorageString('astrogate.test-str', 'hello')).toBe(true)
    expect(readStorageString('astrogate.test-str')).toBe('hello')

    const doc = { foo: 'bar', count: 42 }
    expect(writeStorageJson('astrogate.test-json', doc)).toBe(true)
    expect(readStorageJson('astrogate.test-json')).toEqual(doc)

    removeStorageKey('astrogate.test-str')
    expect(readStorageString('astrogate.test-str')).toBeNull()
  })

  it('transparently migrates legacy floodgate.* keys to astrogate.*', () => {
    writeStorageJson('floodgate.legacy-key', { migrated: true })

    const result = readStorageJson<{ migrated: boolean }>('astrogate.legacy-key')
    expect(result).toEqual({ migrated: true })

    // Legacy key should have been removed and migrated to current key
    expect(readStorageJson('floodgate.legacy-key')).toBeNull()
    expect(readStorageJson('astrogate.legacy-key')).toEqual({ migrated: true })
  })

  it('transparently migrates exact rename legacy keys', () => {
    writeStorageString('astrogate:xlm-usd-v1', '0.125')

    const val = readStorageString('astrogate.xlm-price.v1')
    expect(val).toBe('0.125')
  })

  it('clears only app-scoped keys in clearAppScopedStorage', () => {
    writeStorageString('astrogate.key1', 'val1')
    writeStorageString('floodgate.key2', 'val2')
    writeStorageString('other_app_key', 'keep_me')

    clearAppScopedStorage()

    expect(readStorageString('astrogate.key1')).toBeNull()
    expect(readStorageString('floodgate.key2')).toBeNull()
    expect(readStorageString('other_app_key')).toBe('keep_me')
  })
})
