/** Native XLM decimals: 7 decimals (stroops). */
export const XLM_DECIMALS = 7

/** Minimum fee reserve buffer kept when using MAX in a purchase. */
export const XLM_FEE_BUFFER = 10_000_000n

import { HORIZON_URL } from './network'
import { readStorageJson, writeStorageJson } from './storage'
import { parseAmount } from './format'

/** Horizon account not yet funded/created resolves to zero balance (not an error). */
export async function fetchXlmBalance(publicKey: string): Promise<number> {
  const raw = await fetchXlmBalanceRaw(publicKey)
  return Number(raw)
}

/**
 * Fetches the lossless raw string balance from Horizon.
 * Resolves to "0" for 404 unfunded accounts.
 */
export async function fetchXlmBalanceRaw(publicKey: string): Promise<string> {
  const response = await fetch(
    `${HORIZON_URL}/accounts/${encodeURIComponent(publicKey)}`,
  )
  if (response.status === 404) return '0'
  if (!response.ok) {
    throw new Error(`Horizon responded ${response.status} for ${publicKey}`)
  }
  const data = (await response.json()) as {
    balances?: Array<{ asset_type?: string; balance?: string }>
  }
  const native = data.balances?.find(
    (balance) => balance.asset_type === 'native',
  )
  return native?.balance ?? '0'
}

/**
 * Fetches the native XLM balance directly in Stroops without passing through Number float.
 */
export async function fetchXlmBalanceStroops(publicKey: string): Promise<bigint> {
  const raw = await fetchXlmBalanceRaw(publicKey)
  return parseAmount(raw, XLM_DECIMALS)
}

/**
 * Converts a Horizon XLM balance (number or string) to stroops.
 * Uses integer string parsing without floating point inaccuracies.
 */
export function xlmToStroops(value: number | string): bigint {
  if (typeof value === 'string') {
    return parseAmount(value, XLM_DECIMALS)
  }
  if (!Number.isFinite(value) || value <= 0) return 0n
  return parseAmount(value.toFixed(XLM_DECIMALS), XLM_DECIMALS)
}

/** Spot reference price of 1 XLM in USD if all live oracle queries fail. */
export const DEFAULT_XLM_USD_PRICE = 0.1555

const XLM_PRICE_STORAGE_KEY = 'astrogate.xlm-price.v1'
const CACHE_TTL_MS = 60 * 1000 // 1 minute live freshness

/**
 * Live oracles for the XLM/USD spot price, in waterfall order.
 * - Coinbase: real-time, no rate limits.
 * - Binance: real-time, high availability.
 * - CoinGecko: simple price endpoint.
 * CryptoCompare is intentionally excluded: its public API blocks browser CORS.
 */
const XLM_USD_ORACLES: Array<{
  url: string
  parse: (json: unknown) => number | undefined
}> = [
  {
    url: 'https://api.coinbase.com/v2/prices/XLM-USD/spot',
    parse: (json) => {
      const amount = Number(
        (json as { data?: { amount?: string } }).data?.amount,
      )
      return Number.isFinite(amount) && amount > 0 ? amount : undefined
    },
  },
  {
    url: 'https://api.binance.com/api/v3/ticker/price?symbol=XLMUSDT',
    parse: (json) => {
      const amount = Number((json as { price?: string }).price)
      return Number.isFinite(amount) && amount > 0 ? amount : undefined
    },
  },
  {
    url: 'https://api.coingecko.com/api/v3/simple/price?ids=stellar&vs_currencies=usd',
    parse: (json) => {
      const amount = (json as { stellar?: { usd?: number } }).stellar?.usd
      return typeof amount === 'number' && Number.isFinite(amount) && amount > 0
        ? amount
        : undefined
    },
  },
]

/**
 * Fetches the real-time spot price of 1 XLM in USD using a multi-oracle
 * waterfall. Fallback: cached recent price or DEFAULT_XLM_USD_PRICE.
 */
export async function fetchXlmUsdPrice(): Promise<number> {
  const cached = readStorageJson<{ price?: number; ts?: number }>(
    XLM_PRICE_STORAGE_KEY,
  )
  if (
    cached &&
    typeof cached.price === 'number' &&
    cached.price > 0 &&
    typeof cached.ts === 'number' &&
    Date.now() - cached.ts < CACHE_TTL_MS
  ) {
    return cached.price
  }

  for (const oracle of XLM_USD_ORACLES) {
    try {
      const res = await fetch(oracle.url, {
        headers: { Accept: 'application/json' },
      })
      if (!res.ok) continue
      const json = await res.json()
      const amount = oracle.parse(json)
      if (amount !== undefined) {
        savePriceToCache(amount)
        return amount
      }
    } catch {
      // Continue to next provider
    }
  }

  return DEFAULT_XLM_USD_PRICE
}

function savePriceToCache(price: number): void {
  writeStorageJson(XLM_PRICE_STORAGE_KEY, { price, ts: Date.now() })
}
