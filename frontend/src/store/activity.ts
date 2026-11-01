import { create } from 'zustand'
import { shortAddress } from '../lib/format'

export const ACTIVITY_KINDS = [
  'create',
  'add-liquidity',
  'remove-liquidity',
  'swap',
  'transfer',
  'mint',
  'burn',
] as const

export type ActivityKind = (typeof ACTIVITY_KINDS)[number]
export type ActivityStatus = 'success' | 'failed'

export type ActivityEntry = {
  id: string
  kind: ActivityKind
  status: ActivityStatus
  tokenId: string
  tokenSymbol?: string
  /** Monto principal ya formateado para mostrar (p. ej. "5"). */
  amount?: string
  /** Segundo monto, típicamente XLM en liquidez/swaps. */
  secondaryAmount?: string
  secondarySymbol?: string
  counterparty?: string
  /** Detalle extra, p. ej. "3.16 LP". */
  detail?: string
  account?: string
  hash?: string
  error?: string
  at: number
}

export type ActivityInput = Omit<ActivityEntry, 'id' | 'at' | 'status'> & {
  status?: ActivityStatus
  at?: number
}

const STORAGE_KEY = 'floodgate.activity.v1'
export const MAX_ACTIVITY = 200

const LABELS: Record<ActivityKind, string> = {
  create: 'Token creado',
  'add-liquidity': 'Liquidez añadida',
  'remove-liquidity': 'Liquidez retirada',
  swap: 'Swap',
  transfer: 'Transferencia',
  mint: 'Emisión',
  burn: 'Quema',
}

export function activityLabel(kind: ActivityKind): string {
  return LABELS[kind]
}

export function activitySummary(entry: ActivityEntry): string {
  const ticker = entry.tokenSymbol ?? 'token'
  const amount = entry.amount ? `${entry.amount} ${ticker}` : ticker
  const second =
    entry.secondaryAmount !== undefined
      ? `${entry.secondaryAmount} ${entry.secondarySymbol ?? 'XLM'}`
      : null
  const counterparty = entry.counterparty
    ? shortAddress(entry.counterparty)
    : 'otra cuenta'
  const suffix = entry.detail ? ` · ${entry.detail}` : ''

  switch (entry.kind) {
    case 'create':
      return entry.amount
        ? `Supply inicial: ${amount}${suffix}`
        : `${ticker} creado${suffix}`
    case 'add-liquidity':
    case 'remove-liquidity':
      return second ? `${amount} + ${second}${suffix}` : `${amount}${suffix}`
    case 'swap':
      return second ? `${amount} → ${second}${suffix}` : `${amount}${suffix}`
    case 'transfer':
    case 'mint':
      return `${amount} → ${counterparty}${suffix}`
    case 'burn':
      return `${amount} quemados${suffix}`
  }
}

/** Las entradas se guardan de más reciente a más antigua. */
export function appendActivity(
  entries: ActivityEntry[],
  entry: ActivityEntry,
  max = MAX_ACTIVITY,
): ActivityEntry[] {
  const limit = Math.max(1, Math.trunc(max))
  return [entry, ...entries.filter((item) => item.id !== entry.id)].slice(
    0,
    limit,
  )
}

function isString(value: unknown): value is string {
  return typeof value === 'string'
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === 'string'
}

function isActivity(value: unknown): value is ActivityEntry {
  if (typeof value !== 'object' || value === null) return false
  const entry = value as Record<string, unknown>
  return (
    isString(entry.id) &&
    typeof entry.at === 'number' &&
    Number.isFinite(entry.at) &&
    ACTIVITY_KINDS.includes(entry.kind as ActivityKind) &&
    (entry.status === 'success' || entry.status === 'failed') &&
    isString(entry.tokenId) &&
    entry.tokenId.startsWith('C') &&
    isOptionalString(entry.tokenSymbol) &&
    isOptionalString(entry.amount) &&
    isOptionalString(entry.secondaryAmount) &&
    isOptionalString(entry.secondarySymbol) &&
    isOptionalString(entry.counterparty) &&
    isOptionalString(entry.detail) &&
    isOptionalString(entry.account) &&
    isOptionalString(entry.hash) &&
    isOptionalString(entry.error)
  )
}

function loadActivity(): ActivityEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isActivity).slice(0, MAX_ACTIVITY)
  } catch {
    return []
  }
}

function persistActivity(entries: ActivityEntry[]) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  } catch {
    // Modo privado o cuota llena: el historial sigue en memoria.
  }
}

function makeId(now: number): string {
  const random = globalThis.crypto?.randomUUID?.()
  return random ?? `${now}-${Math.random().toString(36).slice(2, 10)}`
}

type ActivityState = {
  entries: ActivityEntry[]
  add: (input: ActivityInput) => ActivityEntry
  clear: () => void
}

export const useActivity = create<ActivityState>((set, get) => ({
  entries: loadActivity(),

  add: (input) => {
    const now = input.at ?? Date.now()
    const entry: ActivityEntry = {
      ...input,
      id: input.hash ?? makeId(now),
      at: now,
      status: input.status ?? 'success',
    }
    const next = appendActivity(get().entries, entry)
    persistActivity(next)
    set({ entries: next })
    return entry
  },

  clear: () => {
    persistActivity([])
    set({ entries: [] })
  },
}))

/** Helper para usar desde event handlers sin suscribirse al store. */
export function recordActivity(input: ActivityInput): ActivityEntry {
  return useActivity.getState().add(input)
}
