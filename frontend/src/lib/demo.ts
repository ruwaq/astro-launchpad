/**
 * Modo prueba sin wallet: cuentas desechables de testnet, fondeadas con
 * Friendbot y guardadas en el navegador.
 *
 * Aviso de seguridad: las claves viven en `localStorage` del navegador y son
 * públicas para cualquiera con acceso al equipo. Son cuentas de TESTNET sin
 * valor real; este módulo se niega a operar en mainnet. Nunca reutilizar este
 * patrón para fondos reales.
 */
import { Keypair } from '@stellar/stellar-sdk'
import { KeypairSigner } from '@stellar/stellar-sdk/contract'
import type { Signer } from '@stellar/stellar-sdk/contract'
import { NETWORK_NAME, NETWORK_PASSPHRASE } from './network'
import {
  readStorageJson,
  readStorageString,
  removeStorageKey,
  writeStorageJson,
  writeStorageString,
} from './storage'

/** Cuántas cuentas crea inicialmente el modo prueba (usuarios A, B y C). */
export const DEMO_ACCOUNT_COUNT = 3

/** Máximo de cuentas demo que el usuario puede añadir en el navegador (A..H). */
export const MAX_DEMO_ACCOUNTS = 8

/** Todas las etiquetas posibles para cuentas demo (A..H). */
export const DEMO_ALL_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as const

export function demoLabelForIndex(index: number): string {
  return DEMO_ALL_LABELS[index] ?? `#${index + 1}`
}

const ACCOUNTS_KEY = 'astrogate.demo.accounts.v1'
const ACTIVE_KEY = 'astrogate.demo.active.v1'
const MODE_KEY = 'astrogate.demo.mode.v1'

const FRIEND_BOT_URL = 'https://friendbot.stellar.org'
const FRIEND_BOT_TIMEOUT_MS = 18_000

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

/** El modo demo sí o sí es de testnet: nunca firmar en mainnet con estas claves. */
function assertTestnet(): void {
  if (NETWORK_NAME !== 'testnet') {
    throw new Error(
      'Demo mode is only supported on testnet. Set VITE_STELLAR_NETWORK=testnet to use it.',
    )
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
  if (NETWORK_NAME !== 'testnet') return []
  const parsed = readStorageJson<unknown[]>(ACCOUNTS_KEY)
  if (!Array.isArray(parsed)) return []
  return parsed.filter(isDemoAccount).slice(0, MAX_DEMO_ACCOUNTS)
}

export function saveDemoAccounts(accounts: DemoAccount[]): void {
  assertTestnet()
  writeStorageJson(ACCOUNTS_KEY, accounts)
}

export function loadActiveDemo(): number {
  if (NETWORK_NAME !== 'testnet') return 0
  const raw = readStorageString(ACTIVE_KEY)
  const index = raw ? Number.parseInt(raw, 10) : 0
  return Number.isInteger(index) && index >= 0 ? index : 0
}

export function saveActiveDemo(index: number): void {
  writeStorageString(ACTIVE_KEY, String(index))
}

export function loadDemoMode(): boolean {
  if (NETWORK_NAME !== 'testnet') return false
  return readStorageString(MODE_KEY) === '1'
}

export function saveDemoMode(active: boolean): void {
  if (active) writeStorageString(MODE_KEY, '1')
  else removeStorageKey(MODE_KEY)
}

/**
 * Crea y fondea una única cuenta de prueba con 10 000 XLM vía Friendbot
 * con timeout y reintentos.
 */
export async function createSingleDemoAccount(
  label: string,
  maxRetries = 3,
): Promise<DemoAccount> {
  assertTestnet()
  const keypair = Keypair.random()
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), FRIEND_BOT_TIMEOUT_MS)
    try {
      const response = await fetch(
        `${FRIEND_BOT_URL}/?addr=${encodeURIComponent(keypair.publicKey())}`,
        { signal: controller.signal },
      )
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
    } finally {
      clearTimeout(timer)
    }
  }

  throw (
    lastError ??
    new Error(
      `Friendbot faucet timed out for account ${label}. Stellar testnet may be busy.`,
    )
  )
}

export type DemoAccountsResult = {
  accounts: DemoAccount[]
  /** Número de contactos que la faucet no pudo crear. */
  failed: number
}

/**
 * Crea cuentas demo nuevas (por defecto 3) y las fondea con Friendbot.
 * Si alguna cuenta posterior falla por rate limit, preserva las cuentas ya
 * fondeadas e informa cuántas quedaron sin crear (nunca silencia el fallo).
 */
export async function createDemoAccounts(
  onProgress?: DemoProgress,
  count: number = DEMO_ACCOUNT_COUNT,
): Promise<DemoAccountsResult> {
  assertTestnet()
  const total = Math.max(1, Math.min(MAX_DEMO_ACCOUNTS, count))
  const accounts: DemoAccount[] = []
  let failed = 0

  for (let index = 0; index < total; index++) {
    const label = demoLabelForIndex(index)
    onProgress?.({ index, status: 'funding' })
    try {
      const account = await createSingleDemoAccount(label)
      accounts.push(account)
      onProgress?.({ index, status: 'funded' })
    } catch (error) {
      // Si al menos una cuenta fue fondeada, no abortamos el proceso,
      // pero el fallo se propaga en `failed`.
      failed = total - accounts.length
      if (total > 1 && accounts.length > 0) break
      throw error
    }
  }

  return { accounts, failed }
}

/** Firmante de una cuenta demo (mismo `Signer` que usa la UI). */
export function demoSigner(account: DemoAccount): Signer {
  assertTestnet()
  return new KeypairSigner(
    Keypair.fromSecret(account.secret),
    NETWORK_PASSPHRASE,
  )
}

// Re-export para el modo demo y `verify-demo`; la implementación vive en
// `xlm.ts` para reutilizarla en el swap de compra.
export { fetchXlmBalance } from './xlm'
