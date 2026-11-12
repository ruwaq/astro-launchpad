/**
 * Transactional Checkpoint Manager for Token Fair Launches.
 * Protects against stranded funds, network dropouts, and browser crashes during on-chain operations.
 *
 * Features:
 * - Scoped per wallet public key (prevents cross-account contamination).
 * - Automatic TTL expiration (24h) to prevent permanent stale nag banners.
 * - Strict runtime schema validation.
 * - Resilient storage access via centralized storage abstraction.
 */

import { readStorageJson, removeStorageKey, writeStorageJson } from './storage'

export type LaunchStep =
  | 'deploy'
  | 'liquidity'
  | 'burn'
  | 'renounce'
  | 'dev-buy'
  | 'submitting'
  | 'submitted'
  | 'completed'

const VALID_STEPS: readonly LaunchStep[] = [
  'deploy',
  'liquidity',
  'burn',
  'renounce',
  'dev-buy',
  'submitting',
  'submitted',
  'completed',
]

export interface LaunchCheckpoint {
  sessionId: string
  tokenId?: string
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
  saltHex?: string
  error?: string
  updatedAt: number
}

const CHECKPOINT_STORAGE_PREFIX = 'astrogate.launch.checkpoint.v1'
export const CHECKPOINT_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

const memoryCheckpoints = new Map<string, LaunchCheckpoint>()

function checkpointKey(publicKey?: string | null): string {
  return publicKey ? `${CHECKPOINT_STORAGE_PREFIX}.${publicKey}` : CHECKPOINT_STORAGE_PREFIX
}

export function isLaunchCheckpoint(value: unknown): value is LaunchCheckpoint {
  if (typeof value !== 'object' || value === null) return false
  const cp = value as Partial<LaunchCheckpoint>
  return (
    typeof cp.sessionId === 'string' &&
    cp.sessionId.length > 0 &&
    typeof cp.publicKey === 'string' &&
    cp.publicKey.startsWith('G') &&
    typeof cp.name === 'string' &&
    typeof cp.symbol === 'string' &&
    typeof cp.decimals === 'number' &&
    Number.isFinite(cp.decimals) &&
    typeof cp.initialSupply === 'string' &&
    typeof cp.seedXlm === 'string' &&
    typeof cp.step === 'string' &&
    VALID_STEPS.includes(cp.step as LaunchStep) &&
    cp.step !== 'completed' &&
    typeof cp.updatedAt === 'number' &&
    Number.isFinite(cp.updatedAt)
  )
}

export function saveCheckpoint(checkpoint: LaunchCheckpoint): void {
  if (!checkpoint.publicKey) return
  memoryCheckpoints.set(checkpoint.publicKey, checkpoint)
  memoryCheckpoints.set('__default__', checkpoint)
  writeStorageJson(checkpointKey(checkpoint.publicKey), checkpoint)
  // Also write un-scoped key for backwards compatibility
  writeStorageJson(CHECKPOINT_STORAGE_PREFIX, checkpoint)
}

export function getCheckpoint(publicKey?: string | null): LaunchCheckpoint | null {
  const now = Date.now()

  // 1. Check scoped key if publicKey provided
  if (publicKey) {
    const memory = memoryCheckpoints.get(publicKey)
    if (memory && isLaunchCheckpoint(memory)) {
      if (now - memory.updatedAt <= CHECKPOINT_TTL_MS) return memory
      clearCheckpoint(publicKey)
      return null
    }

    const stored = readStorageJson<unknown>(checkpointKey(publicKey))
    if (isLaunchCheckpoint(stored)) {
      if (now - stored.updatedAt <= CHECKPOINT_TTL_MS) {
        memoryCheckpoints.set(publicKey, stored)
        return stored
      }
      clearCheckpoint(publicKey)
      return null
    }
  }

  // 2. Fall back to un-scoped key / memory
  const fallbackMemory = memoryCheckpoints.get('__default__')
  if (fallbackMemory && isLaunchCheckpoint(fallbackMemory)) {
    if (publicKey && fallbackMemory.publicKey !== publicKey) {
      return null // Wallet mismatch: prevent account leakage
    }
    if (now - fallbackMemory.updatedAt <= CHECKPOINT_TTL_MS) return fallbackMemory
    clearCheckpoint()
    return null
  }

  const fallbackStored = readStorageJson<unknown>(CHECKPOINT_STORAGE_PREFIX)
  if (isLaunchCheckpoint(fallbackStored)) {
    if (publicKey && fallbackStored.publicKey !== publicKey) {
      return null // Wallet mismatch: prevent account leakage
    }
    if (now - fallbackStored.updatedAt <= CHECKPOINT_TTL_MS) {
      memoryCheckpoints.set('__default__', fallbackStored)
      return fallbackStored
    }
    clearCheckpoint()
    return null
  }

  return null
}

export function clearCheckpoint(publicKey?: string | null): void {
  if (publicKey) {
    memoryCheckpoints.delete(publicKey)
    removeStorageKey(checkpointKey(publicKey))
  }
  memoryCheckpoints.delete('__default__')
  removeStorageKey(CHECKPOINT_STORAGE_PREFIX)
}
