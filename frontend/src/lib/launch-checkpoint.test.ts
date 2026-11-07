import { describe, expect, it, beforeEach } from 'vitest'
import {
  clearCheckpoint,
  getCheckpoint,
  saveCheckpoint,
  type LaunchCheckpoint,
} from './launch-checkpoint'

describe('Launch Checkpoint Manager', () => {
  beforeEach(() => {
    clearCheckpoint()
  })

  it('saves and retrieves active checkpoints', () => {
    const cp: LaunchCheckpoint = {
      sessionId: 'session-123',
      tokenId: 'CAI637WCEILQF3ZYOV6BRUCX532XQIVOOJ4CRWFPWHQRJHOH5OKHSXRE',
      name: 'Resilient Token',
      symbol: 'RES',
      decimals: 7,
      initialSupply: '1000000000',
      seedXlm: '10',
      publicKey: 'GAAATEST',
      step: 'liquidity',
      updatedAt: Date.now(),
    }

    saveCheckpoint(cp)
    const retrieved = getCheckpoint()
    expect(retrieved).not.toBeNull()
    expect(retrieved?.symbol).toBe('RES')
    expect(retrieved?.step).toBe('liquidity')
  })

  it('ignores completed checkpoints', () => {
    const cp: LaunchCheckpoint = {
      sessionId: 'session-456',
      tokenId: 'CAI637WCEILQF3ZYOV6BRUCX532XQIVOOJ4CRWFPWHQRJHOH5OKHSXRE',
      name: 'Completed Token',
      symbol: 'DONE',
      decimals: 7,
      initialSupply: '1000000000',
      seedXlm: '10',
      publicKey: 'GAAATEST',
      step: 'completed',
      updatedAt: Date.now(),
    }

    saveCheckpoint(cp)
    expect(getCheckpoint()).toBeNull()
  })

  it('clears checkpoint on demand', () => {
    saveCheckpoint({
      sessionId: 'session-789',
      tokenId: 'CAI637WCEILQF3ZYOV6BRUCX532XQIVOOJ4CRWFPWHQRJHOH5OKHSXRE',
      name: 'Clear Token',
      symbol: 'CLR',
      decimals: 7,
      initialSupply: '1000000000',
      seedXlm: '10',
      publicKey: 'GAAATEST',
      step: 'burn',
      updatedAt: Date.now(),
    })

    clearCheckpoint()
    expect(getCheckpoint()).toBeNull()
  })
})
