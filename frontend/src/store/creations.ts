import { create } from 'zustand'
import { readStorageJson, writeStorageJson } from '../lib/storage'

/**
 * Tokens created from this browser session. User local state, not a backend:
 * enables portfolio and liquidity panels to survive refresh without server requests.
 */
export type CreatedToken = {
  id: string
  symbol?: string
  decimals: number
  createdAt: number
}

const STORAGE_KEY = 'astrogate.created-tokens.v1'
const MAX_TOKENS = 100

function isCreatedToken(value: unknown): value is CreatedToken {
  if (typeof value !== 'object' || value === null) return false
  const token = value as Record<string, unknown>
  return (
    typeof token.id === 'string' &&
    token.id.startsWith('C') &&
    typeof token.decimals === 'number' &&
    Number.isFinite(token.decimals) &&
    (token.symbol === undefined || typeof token.symbol === 'string') &&
    typeof token.createdAt === 'number'
  )
}

export function loadTokens(): CreatedToken[] {
  const parsed = readStorageJson<unknown>(STORAGE_KEY)
  if (!Array.isArray(parsed)) return []
  return parsed.filter(isCreatedToken).slice(0, MAX_TOKENS)
}

function persistTokens(tokens: CreatedToken[]): void {
  writeStorageJson(STORAGE_KEY, tokens)
}

type CreatedTokensState = {
  tokens: CreatedToken[]
  add: (token: Omit<CreatedToken, 'createdAt'>) => void
  remove: (id: string) => void
}

export const useCreatedTokens = create<CreatedTokensState>((set, get) => ({
  tokens: loadTokens(),

  add: (token) => {
    const entry: CreatedToken = { ...token, createdAt: Date.now() }
    const next = [
      entry,
      ...get().tokens.filter((item) => item.id !== token.id),
    ].slice(0, MAX_TOKENS)
    persistTokens(next)
    set({ tokens: next })
  },

  remove: (id) => {
    const next = get().tokens.filter((token) => token.id !== id)
    persistTokens(next)
    set({ tokens: next })
  },
}))

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY || e.key === 'floodgate.created-tokens.v1') {
      useCreatedTokens.setState({ tokens: loadTokens() })
    }
  })
}
