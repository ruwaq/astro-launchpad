import { create } from 'zustand'
import { shortAddress } from '../lib/format'
import { readStorageJson, writeStorageJson } from '../lib/storage'

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
  /** Formatted main amount (e.g. "5"). */
  amount?: string
  /** Secondary amount (e.g. XLM in swaps/liquidity). */
  secondaryAmount?: string
  secondarySymbol?: string
  /** In swaps: `buy` = XLM → token; `sell` = token → XLM. */
  swapDirection?: 'buy' | 'sell'
  counterparty?: string
  /** Extra detail (e.g. "3.16 LP"). */
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

const STORAGE_KEY = 'astrogate.activity.v1'
export const MAX_ACTIVITY = 200

const LABELS: Record<ActivityKind, string> = {
  create: 'Token Created',
  'add-liquidity': 'Liquidity Added',
  'remove-liquidity': 'Liquidity Removed',
  swap: 'Swap',
  transfer: 'Transfer',
  mint: 'Mint',
  burn: 'Burn',
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
    : 'other account'
  const suffix = entry.detail ? ` · ${entry.detail}` : ''

  switch (entry.kind) {
    case 'create':
      return entry.amount
        ? `Initial supply: ${amount}${suffix}`
        : `${ticker} created${suffix}`
    case 'add-liquidity':
    case 'remove-liquidity':
      return second ? `${amount} + ${second}${suffix}` : `${amount}${suffix}`
    case 'swap':
      if (!second) return `${amount}${suffix}`
      return entry.swapDirection === 'buy'
        ? `${second} → ${amount}${suffix}`
        : `${amount} → ${second}${suffix}`
    case 'transfer':
    case 'mint':
      return `${amount} → ${counterparty}${suffix}`
    case 'burn':
      return `${amount} burned${suffix}`
  }
}

/** Prepends newest entry and limits max retained records. */
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
    (entry.status === 'success' || entry.status === 'failed') &&
    ACTIVITY_KINDS.includes(entry.kind as ActivityKind) &&
    isString(entry.tokenId) &&
    isOptionalString(entry.tokenSymbol) &&
    isOptionalString(entry.amount) &&
    isOptionalString(entry.secondaryAmount) &&
    isOptionalString(entry.secondarySymbol) &&
    (entry.swapDirection === undefined ||
      entry.swapDirection === 'buy' ||
      entry.swapDirection === 'sell') &&
    isOptionalString(entry.counterparty) &&
    isOptionalString(entry.detail) &&
    isOptionalString(entry.account) &&
    isOptionalString(entry.hash) &&
    isOptionalString(entry.error)
  )
}

export function loadActivity(): ActivityEntry[] {
  const parsed = readStorageJson<unknown>(STORAGE_KEY)
  if (!Array.isArray(parsed)) return []
  return parsed.filter(isActivity).slice(0, MAX_ACTIVITY)
}

export function saveActivity(entries: ActivityEntry[]): void {
  writeStorageJson(STORAGE_KEY, entries)
}

type ActivityStore = {
  entries: ActivityEntry[]
  record: (input: ActivityInput) => ActivityEntry
  clear: () => void
}

let seedCounter = 0
function makeId(): string {
  seedCounter++
  return `${Date.now()}-${seedCounter}-${Math.random().toString(36).slice(2, 8)}`
}

export const useActivity = create<ActivityStore>((set, get) => ({
  entries: loadActivity(),
  record: (input) => {
    const entry: ActivityEntry = {
      id: makeId(),
      at: Date.now(),
      status: 'success',
      ...input,
    }
    const next = appendActivity(get().entries, entry)
    set({ entries: next })
    saveActivity(next)
    return entry
  },
  clear: () => {
    set({ entries: [] })
    saveActivity([])
  },
}))

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY || e.key === 'floodgate.activity.v1') {
      useActivity.setState({ entries: loadActivity() })
    }
  })
}

export function recordActivity(input: ActivityInput): ActivityEntry {
  return useActivity.getState().record(input)
}

/** Formats local entries as readable, pretty-printed JSON. */
export function exportActivityAsJson(entries: ActivityEntry[]): string {
  return JSON.stringify(entries, null, 2)
}

/**
 * Escapes a single CSV cell according to RFC 4180 and protects against
 * CSV / Spreadsheet Formula Injection (=, +, -, @, \t, \r).
 */
export function escapeCsvCell(raw: unknown): string {
  if (raw === undefined || raw === null) return ''
  let val = String(raw)
  // Prevent spreadsheet formula execution
  if (/^[=+\-@\t\r]/.test(val)) {
    val = `'${val}`
  }
  // RFC 4180: quote if contains quotes, commas, or newlines
  if (/[",\n\r]/.test(val)) {
    return `"${val.replace(/"/g, '""')}"`
  }
  return val
}

/** Exports local entries as a standard CSV spreadsheet for auditing / tax. */
export function exportActivityAsCsv(entries: ActivityEntry[]): string {
  const headers = [
    'Date (ISO)',
    'Type',
    'Status',
    'Token ID',
    'Symbol',
    'Amount',
    'Secondary Amount',
    'Summary',
    'Account',
    'Transaction Hash',
  ]
  const rows = entries.map((e) => [
    escapeCsvCell(new Date(e.at).toISOString()),
    escapeCsvCell(e.kind),
    escapeCsvCell(e.status),
    escapeCsvCell(e.tokenId),
    escapeCsvCell(e.tokenSymbol ?? ''),
    escapeCsvCell(e.amount ?? ''),
    escapeCsvCell(e.secondaryAmount ?? ''),
    escapeCsvCell(activitySummary(e)),
    escapeCsvCell(e.account ?? ''),
    escapeCsvCell(e.hash ?? ''),
  ])

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
}

/** Triggers a browser download of a given text file payload. */
export function triggerDownload(
  content: string,
  filename: string,
  mimeType = 'text/plain',
): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
