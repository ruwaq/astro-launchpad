/**
 * Enlaces al explorador Stellar.Expert. La red se deriva de `NETWORK_NAME`
 * (lib/network.ts) para no coser paths de testnet en un deploy mainnet.
 */
import { NETWORK_NAME, HORIZON_URL } from './network'

const EXPLORER_NETWORK_PATH = NETWORK_NAME === 'mainnet' ? 'mainnet' : 'testnet'

const EXPLORER_BASE = `https://stellar.expert/explorer/${EXPLORER_NETWORK_PATH}`

/** Interfaz de la DEX donde el token liquida tras graduarse. */
export const SOROSWAP_APP_URL = 'https://app.soroswap.finance'

export function explorerContractUrl(contractId: string): string {
  return `${EXPLORER_BASE}/contract/${contractId}`
}

export function explorerTxUrl(txHash: string): string {
  return `${EXPLORER_BASE}/tx/${txHash}`
}

export function explorerAccountUrl(account: string): string {
  return `${EXPLORER_BASE}/account/${account}`
}

/**
 * Enlace directo de la cuenta en Horizon (JSON crudo, útil para depuración).
 * OJO: si recibe un contract id (`C...`), Horizon responde 404 — los contratos
 * no son cuentas; sólo usar con claves públicas `G...`.
 */
export function horizonAccountUrl(account: string): string {
  return `${HORIZON_URL}/accounts/${account}`
}
