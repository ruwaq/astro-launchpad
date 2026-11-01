import { create } from 'zustand'

/**
 * Progreso local del onboarding. No se sincroniza con ningún backend: es una
 * ayuda de primera visita, no un requisito para operar.
 */
export type ProgressStep = 'liquidity' | 'swapped'

type ProgressState = {
  liquidity: boolean
  swapped: boolean
  mark: (step: ProgressStep) => void
}

const STORAGE_KEY = 'floodgate.progress.v1'

function loadProgress(): Pick<ProgressState, 'liquidity' | 'swapped'> {
  if (typeof window === 'undefined') return { liquidity: false, swapped: false }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return { liquidity: false, swapped: false }
    const parsed = JSON.parse(raw) as Partial<Record<ProgressStep, unknown>>
    return {
      liquidity: parsed.liquidity === true,
      swapped: parsed.swapped === true,
    }
  } catch {
    return { liquidity: false, swapped: false }
  }
}

function persistProgress(state: Pick<ProgressState, 'liquidity' | 'swapped'>) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ liquidity: state.liquidity, swapped: state.swapped }),
    )
  } catch {
    // Almacenamiento no disponible: el estado en memoria sigue siendo válido.
  }
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
