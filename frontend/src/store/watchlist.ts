import { create } from 'zustand'
import { readStorageJson, writeStorageJson } from '../lib/storage'

const STORAGE_KEY = 'astrogate.watchlist.v1'

export function loadWatchlist(): string[] {
  const parsed = readStorageJson<unknown>(STORAGE_KEY)
  if (!Array.isArray(parsed)) return []
  const unique = new Set<string>()
  for (const id of parsed) {
    if (typeof id === 'string' && id.startsWith('C') && id.length > 2) {
      unique.add(id)
    }
  }
  return Array.from(unique)
}

function saveWatchlist(favorites: string[]): void {
  writeStorageJson(STORAGE_KEY, favorites)
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

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY || e.key === 'floodgate.watchlist.v1') {
      useWatchlist.setState({ favorites: loadWatchlist() })
    }
  })
}
