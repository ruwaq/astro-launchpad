import { create } from 'zustand'

const STORAGE_KEY = 'astrogate.watchlist.v1'

function loadWatchlist(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : []
  } catch {
    return []
  }
}

function saveWatchlist(favorites: string[]): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites))
  } catch {
    // Storage quota errors
  }
}

type WatchlistState = {
  favorites: string[]
  toggle: (id: string) => void
  isFavorite: (id: string) => boolean
}

export const useWatchlist = create<WatchlistState>((set, get) => ({
  favorites: loadWatchlist(),
  toggle: (id: string) => {
    const current = get().favorites
    const exists = current.includes(id)
    const next = exists ? current.filter((x) => x !== id) : [...current, id]
    set({ favorites: next })
    saveWatchlist(next)
  },
  isFavorite: (id: string) => get().favorites.includes(id),
}))
