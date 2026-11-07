/**
 * Transactional Checkpoint Manager for Token Fair Launches.
 * Protects against stranded funds, network dropouts, and browser crashes during multi-step on-chain operations.
 */

export type LaunchStep = 'deploy' | 'liquidity' | 'burn' | 'renounce' | 'dev-buy' | 'completed'

export interface LaunchCheckpoint {
  sessionId: string
  tokenId: string
  name: string
  symbol: string
  decimals: number
  initialSupply: string
  seedXlm: string
  creatorBuyXlm?: string
  publicKey: string
  step: LaunchStep
  pairId?: string
  lpAmount?: string
  txHash?: string
  updatedAt: number
}

const CHECKPOINT_STORAGE_KEY = 'astrogate.launch.checkpoint.v1'
let memoryCheckpoint: LaunchCheckpoint | null = null

export function saveCheckpoint(checkpoint: LaunchCheckpoint): void {
  memoryCheckpoint = checkpoint
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(CHECKPOINT_STORAGE_KEY, JSON.stringify(checkpoint))
  } catch (err) {
    console.warn('Failed to save launch checkpoint to localStorage:', err)
  }
}

export function getCheckpoint(): LaunchCheckpoint | null {
  if (typeof window === 'undefined') {
    return memoryCheckpoint && memoryCheckpoint.step !== 'completed' ? memoryCheckpoint : null
  }
  try {
    const raw = window.localStorage.getItem(CHECKPOINT_STORAGE_KEY)
    if (!raw) return memoryCheckpoint && memoryCheckpoint.step !== 'completed' ? memoryCheckpoint : null
    const parsed = JSON.parse(raw) as LaunchCheckpoint
    if (parsed && parsed.sessionId && parsed.step && parsed.step !== 'completed') {
      memoryCheckpoint = parsed
      return parsed
    }
    return null
  } catch {
    return memoryCheckpoint && memoryCheckpoint.step !== 'completed' ? memoryCheckpoint : null
  }
}

export function clearCheckpoint(): void {
  memoryCheckpoint = null
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(CHECKPOINT_STORAGE_KEY)
  } catch {
    // Ignore storage errors
  }
}
