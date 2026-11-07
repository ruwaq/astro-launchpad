import { create } from 'zustand'

/**
 * Tokens creados desde este navegador. Es estado local del usuario, no un
 * backend: sirve para que el portfolio y el panel de liquidez sobrevivan a un
 * refresh sin pedirle permiso a ningún servidor.
 */
export type CreatedToken = {
  id: string
  symbol?: string
  decimals: number
  createdAt: number
}

const STORAGE_KEY = 'floodgate.created-tokens.v1'
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

function loadTokens(): CreatedToken[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isCreatedToken).slice(0, MAX_TOKENS)
  } catch {
    return []
  }
}

function persistTokens(tokens: CreatedToken[]) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens))
  } catch {
    // Modo privado o almacenamiento lleno: la app sigue funcionando en memoria.
  }
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
