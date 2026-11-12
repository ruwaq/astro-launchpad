import { describe, expect, it, beforeEach } from 'vitest'
import {
  CHECKPOINT_TTL_MS,
  clearCheckpoint,
  getCheckpoint,
  isLaunchCheckpoint,
  saveCheckpoint,
  type LaunchCheckpoint,
} from './launch-checkpoint'

const WALLET_ALICE = 'GBZXN7PIRZGNMHGA728R466712345678901234567890123456789012'
const WALLET_BOB = 'GCOPN7PIRZGNMHGA728R466712345678901234567890123456789012'
const TOKEN_ID = 'CAI637WCEILQF3ZYOV6BRUCX532XQIVOOJ4CRWFPWHQRJHOH5OKHSXRE'

describe('Launch Checkpoint Manager', () => {
  beforeEach(() => {
    clearCheckpoint()
    clearCheckpoint(WALLET_ALICE)
    clearCheckpoint(WALLET_BOB)
  })

  it('saves and retrieves active checkpoints', () => {
    const cp: LaunchCheckpoint = {
      sessionId: 'session-123',
      tokenId: TOKEN_ID,
      name: 'Resilient Token',
      symbol: 'RES',
      decimals: 7,
      initialSupply: '1000000000',
      seedXlm: '10',
      publicKey: WALLET_ALICE,
      step: 'liquidity',
      updatedAt: Date.now(),
    }

    saveCheckpoint(cp)
    const retrieved = getCheckpoint(WALLET_ALICE)
    expect(retrieved).not.toBeNull()
    expect(retrieved?.symbol).toBe('RES')
    expect(retrieved?.step).toBe('liquidity')
  })

  it('scopes checkpoints by wallet to prevent cross-account leakage', () => {
    const cp: LaunchCheckpoint = {
      sessionId: 'session-alice',
      tokenId: TOKEN_ID,
      name: 'Alice Token',
      symbol: 'ALICE',
      decimals: 7,
      initialSupply: '1000000000',
      seedXlm: '10',
      publicKey: WALLET_ALICE,
      step: 'deploy',
      updatedAt: Date.now(),
    }

    saveCheckpoint(cp)

    // Alice sees her checkpoint
    expect(getCheckpoint(WALLET_ALICE)?.symbol).toBe('ALICE')

    // Bob does NOT see Alice's checkpoint
    expect(getCheckpoint(WALLET_BOB)).toBeNull()
  })

  it('expires checkpoints older than TTL (24h)', () => {
    const staleTime = Date.now() - CHECKPOINT_TTL_MS - 1000
    const cp: LaunchCheckpoint = {
      sessionId: 'session-stale',
      tokenId: TOKEN_ID,
      name: 'Old Token',
      symbol: 'OLD',
      decimals: 7,
      initialSupply: '1000000000',
      seedXlm: '10',
      publicKey: WALLET_ALICE,
      step: 'deploy',
      updatedAt: staleTime,
    }

    saveCheckpoint(cp)
    // Should be expired and return null
    expect(getCheckpoint(WALLET_ALICE)).toBeNull()
  })

  it('ignores completed checkpoints', () => {
    const cp: LaunchCheckpoint = {
      sessionId: 'session-456',
      tokenId: TOKEN_ID,
      name: 'Completed Token',
      symbol: 'DONE',
      decimals: 7,
      initialSupply: '1000000000',
      seedXlm: '10',
      publicKey: WALLET_ALICE,
      step: 'completed',
      updatedAt: Date.now(),
    }

    saveCheckpoint(cp)
    expect(getCheckpoint(WALLET_ALICE)).toBeNull()
  })

  it('clears checkpoint on demand', () => {
    saveCheckpoint({
      sessionId: 'session-789',
      tokenId: TOKEN_ID,
      name: 'Clear Token',
      symbol: 'CLR',
      decimals: 7,
      initialSupply: '1000000000',
      seedXlm: '10',
      publicKey: WALLET_ALICE,
      step: 'burn',
      updatedAt: Date.now(),
    })

    clearCheckpoint(WALLET_ALICE)
    expect(getCheckpoint(WALLET_ALICE)).toBeNull()
  })

  it('validates checkpoints with isLaunchCheckpoint shape guard', () => {
    const valid: LaunchCheckpoint = {
      sessionId: 'sess-1',
      name: 'Test',
      symbol: 'TST',
      decimals: 7,
      initialSupply: '1000000',
      seedXlm: '10',
      publicKey: WALLET_ALICE,
      step: 'submitting',
      updatedAt: Date.now(),
    }

    expect(isLaunchCheckpoint(valid)).toBe(true)

    // Missing required fields
    expect(isLaunchCheckpoint({ ...valid, sessionId: '' })).toBe(false)
    expect(isLaunchCheckpoint({ ...valid, publicKey: 'invalid' })).toBe(false)
    expect(isLaunchCheckpoint({ ...valid, step: 'unknown' as any })).toBe(false)
    expect(isLaunchCheckpoint({ ...valid, step: 'completed' })).toBe(false)
    expect(isLaunchCheckpoint({ ...valid, decimals: NaN })).toBe(false)
  })
})
