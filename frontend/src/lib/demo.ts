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

/** Cuántas cuentas crea el modo prueba (usuarios A, B y C). */
export const DEMO_ACCOUNT_COUNT = 3

/** Etiquetas para distinguir las cuentas en la UI. */
export const DEMO_LABELS = ['A', 'B', 'C'] as const

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
    return parsed.filter(isDemoAccount).slice(0, DEMO_ACCOUNT_COUNT)
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
 * Crea `DEMO_ACCOUNT_COUNT` cuentas nuevas y las fondea con Friendbot
 * (10 000 XLM de testnet cada una). Secuencial a propósito: el faucet público
 * limita peticiones concurrentes.
 */
export async function createDemoAccounts(
  onProgress?: DemoProgress,
): Promise<DemoAccount[]> {
  const accounts: DemoAccount[] = []

  for (let index = 0; index < DEMO_ACCOUNT_COUNT; index++) {
    const keypair = Keypair.random()
    onProgress?.({ index, status: 'funding' })

    const response = await fetch(
      `${FRIEND_BOT_URL}/?addr=${encodeURIComponent(keypair.publicKey())}`,
    )
    if (!response.ok) {
      throw new Error(
        `Friendbot no pudo fondear la cuenta ${DEMO_LABELS[index]} (HTTP ${response.status})`,
      )
    }

    accounts.push({
      label: DEMO_LABELS[index],
      publicKey: keypair.publicKey(),
      secret: keypair.secret(),
    })
    onProgress?.({ index, status: 'funded' })
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
