import { create } from 'zustand'
import { readStorageJson, writeStorageJson } from '../lib/storage'

/**
 * Local onboarding progress. Not synced with any backend: helps first-time
 * visitors discover key workflows.
 */
export type ProgressStep = 'liquidity' | 'swapped'

type ProgressState = {
  liquidity: boolean
  swapped: boolean
  mark: (step: ProgressStep) => void
}

const STORAGE_KEY = 'astrogate.progress.v1'

export function loadProgress(): Pick<ProgressState, 'liquidity' | 'swapped'> {
  const parsed = readStorageJson<Partial<Record<ProgressStep, unknown>>>(STORAGE_KEY)
  if (!parsed || typeof parsed !== 'object') {
    return { liquidity: false, swapped: false }
  }
  return {
    liquidity: parsed.liquidity === true,
    swapped: parsed.swapped === true,
  }
}

function persistProgress(state: Pick<ProgressState, 'liquidity' | 'swapped'>): void {
  writeStorageJson(STORAGE_KEY, {
    liquidity: state.liquidity,
    swapped: state.swapped,
  })
}

export const useProgress = create<ProgressState>((set, get) => ({
  ...loadProgress(),

  mark: (step) => {
    const next = { liquidity: get().liquidity, swapped: get().swapped }
    next[step] = true
    persistProgress(next)
    set(next)
  },
}))

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY || e.key === 'floodgate.progress.v1') {
      useProgress.setState(loadProgress())
    }
  })
}
