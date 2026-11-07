/**
 * Modo prueba sin wallet: cuentas desechables de testnet, fondeadas con
 * Friendbot y guardadas en el navegador.
 *
 * Aviso de seguridad: las claves viven en `localStorage` y son públicas para
 * cualquiera con acceso a este navegador. Son cuentas de TESTNET sin valor
 * real; nunca reutilizar este patrón para fondos reales.
 */
import { Keypair } from '@stellar/stellar-sdk'
import { KeypairSigner } from '@stellar/stellar-sdk/contract'
import type { Signer } from '@stellar/stellar-sdk/contract'
import { NETWORK_PASSPHRASE } from './network'

/** Cuántas cuentas crea inicialmente el modo prueba (usuarios A, B y C). */
export const DEMO_ACCOUNT_COUNT = 3

/** Máximo de cuentas demo que el usuario puede añadir en el navegador (A..H). */
export const MAX_DEMO_ACCOUNTS = 8

/** Etiquetas iniciales (compatibilidad con scripts de verificación). */
export const DEMO_LABELS = ['A', 'B', 'C'] as const

/** Todas las etiquetas posibles para cuentas demo (A..H). */
export const DEMO_ALL_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as const

export function demoLabelForIndex(index: number): string {
  return DEMO_ALL_LABELS[index] ?? `#${index + 1}`
}

const ACCOUNTS_KEY = 'floodgate.demo.accounts.v1'
const ACTIVE_KEY = 'floodgate.demo.active.v1'
const MODE_KEY = 'floodgate.demo.mode.v1'

const FRIEND_BOT_URL = 'https://friendbot.stellar.org'

export type DemoAccount = {
  label: string
  publicKey: string
  /** Semilla de testnet. Solo se guarda en este navegador. */
  secret: string
}

export type DemoProgress = (step: {
  index: number
  status: 'funding' | 'funded'
}) => void

function safeStorage(): Storage | null {
  try {
    if (typeof localStorage === 'undefined') return null
    return localStorage
  } catch {
    return null
  }
}

function isDemoAccount(value: unknown): value is DemoAccount {
  if (typeof value !== 'object' || value === null) return false
  const account = value as Partial<DemoAccount>
  return (
    typeof account.label === 'string' &&
    typeof account.publicKey === 'string' &&
    account.publicKey.startsWith('G') &&
    typeof account.secret === 'string' &&
    account.secret.startsWith('S')
  )
}

export function loadDemoAccounts(): DemoAccount[] {
  const raw = safeStorage()?.getItem(ACCOUNTS_KEY)
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isDemoAccount).slice(0, MAX_DEMO_ACCOUNTS)
  } catch {
    return []
  }
}

export function saveDemoAccounts(accounts: DemoAccount[]): void {
  try {
    safeStorage()?.setItem(ACCOUNTS_KEY, JSON.stringify(accounts))
  } catch {
    // localStorage lleno o bloqueado: la sesión sigue en memoria.
  }
}

export function loadActiveDemo(): number {
  const raw = safeStorage()?.getItem(ACTIVE_KEY)
  const index = raw ? Number.parseInt(raw, 10) : 0
  return Number.isInteger(index) && index >= 0 ? index : 0
}

export function saveActiveDemo(index: number): void {
  try {
    safeStorage()?.setItem(ACTIVE_KEY, String(index))
  } catch {
    // Sin persistencia: el índice sigue en memoria.
  }
}

export function loadDemoMode(): boolean {
  return safeStorage()?.getItem(MODE_KEY) === '1'
}

export function saveDemoMode(active: boolean): void {
  const storage = safeStorage()
  if (!storage) return
  try {
    if (active) storage.setItem(MODE_KEY, '1')
    else storage.removeItem(MODE_KEY)
  } catch {
    // Sin persistencia: el modo sigue en memoria.
  }
}

/**
 * Crea y fondea una única cuenta de prueba con 10 000 XLM vía Friendbot con timeout y reintentos.
 */
export async function createSingleDemoAccount(
  label: string,
  maxRetries = 3,
): Promise<DemoAccount> {
  const keypair = Keypair.random()
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 18_000)
      const response = await fetch(
        `${FRIEND_BOT_URL}/?addr=${encodeURIComponent(keypair.publicKey())}`,
        { signal: controller.signal },
      )
      clearTimeout(timer)
      if (response.ok) {
        return {
          label,
          publicKey: keypair.publicKey(),
          secret: keypair.secret(),
        }
      }
      if (response.status === 429 && attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 1500 * attempt))
        continue
      }
      lastError = new Error(
        `Friendbot could not fund account ${label} (HTTP ${response.status})`,
      )
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 1500 * attempt))
      }
    }
  }

  throw (
    lastError ??
    new Error(
      `Friendbot faucet timed out for account ${label}. Stellar testnet may be busy.`,
    )
  )
}

/**
 * Crea cuentas demo nuevas (por defecto 3) y las fondea con Friendbot.
 * Si alguna cuenta posterior falla por rate limit, preserva las cuentas ya fondeadas.
 */
export async function createDemoAccounts(
  onProgress?: DemoProgress,
  count: number = DEMO_ACCOUNT_COUNT,
): Promise<DemoAccount[]> {
  const total = Math.max(1, Math.min(MAX_DEMO_ACCOUNTS, count))
  const accounts: DemoAccount[] = []

  for (let index = 0; index < total; index++) {
    const label = demoLabelForIndex(index)
    onProgress?.({ index, status: 'funding' })
    try {
      const account = await createSingleDemoAccount(label)
      accounts.push(account)
      onProgress?.({ index, status: 'funded' })
    } catch (error) {
      // Si al menos una cuenta fue fondeada, no abortamos todo el proceso
      if (accounts.length > 0) {
        break
      }
      throw error
    }
  }

  return accounts
}

/** Firmante de una cuenta demo (mismo `Signer` que usa la UI). */
export function demoSigner(account: DemoAccount): Signer {
  return new KeypairSigner(
    Keypair.fromSecret(account.secret),
    NETWORK_PASSPHRASE,
  )
}

// Se mantiene el re-export para el modo demo y `verify-demo`; la
// implementación vive en `xlm.ts` para reutilizarla en el swap de compra.
export { fetchXlmBalance } from './xlm'
