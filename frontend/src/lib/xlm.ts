/** Native XLM decimals: 7 decimals (stroops). */
export const XLM_DECIMALS = 7

/** Minimum fee reserve buffer kept when using MAX in a purchase. */
export const XLM_FEE_BUFFER = 10_000_000n

import { HORIZON_URL } from './network'

/**
 * Fetches native XLM balance of an account from Horizon.
 */
export async function fetchXlmBalance(publicKey: string): Promise<number> {
  const response = await fetch(
    `${HORIZON_URL}/accounts/${encodeURIComponent(publicKey)}`,
  )
  if (!response.ok) return 0
  const data = (await response.json()) as {
    balances?: Array<{ asset_type?: string; balance?: string }>
  }
  const native = data.balances?.find(
    (balance) => balance.asset_type === 'native',
  )
  return native?.balance ? Number(native.balance) : 0
}

/**
 * Converts a Horizon XLM balance (number) to stroops.
 */
export function xlmToStroops(value: number): bigint {
  if (!Number.isFinite(value) || value <= 0) return 0n
  return BigInt(Math.round(value * 10 ** XLM_DECIMALS))
}

/** Spot reference price of 1 XLM in USD if all live oracle queries fail. */
export const DEFAULT_XLM_USD_PRICE = 0.1555

const XLM_PRICE_STORAGE_KEY = 'astrogate:xlm-usd-v1'
const CACHE_TTL_MS = 60 * 1000 // 1 minute live freshness

/**
 * Fetches the real-time spot price of 1 XLM in USD using multi-oracle waterfall:
 * 1. Coinbase spot API (real-time, zero rate limits)
 * 2. Binance ticker price API (real-time, high availability)
 * 3. CoinGecko simple price API
 * 4. CryptoCompare price API
 * Fallback: cached recent price or DEFAULT_XLM_USD_PRICE.
 */
export async function fetchXlmUsdPrice(): Promise<number> {
  // Check local cache first
  if (typeof window !== 'undefined') {
    try {
      const cached = window.localStorage.getItem(XLM_PRICE_STORAGE_KEY)
      if (cached) {
        const parsed = JSON.parse(cached) as { price?: number; ts?: number }
        if (
          typeof parsed.price === 'number' &&
          parsed.price > 0 &&
          typeof parsed.ts === 'number' &&
          Date.now() - parsed.ts < CACHE_TTL_MS
        ) {
          return parsed.price
        }
      }
    } catch {
      // Ignore cache parse errors
    }
  }

  // 1. Try Coinbase
  try {
    const res = await fetch('https://api.coinbase.com/v2/prices/XLM-USD/spot', {
      headers: { Accept: 'application/json' },
    })
    if (res.ok) {
      const json = (await res.json()) as { data?: { amount?: string } }
      const amount = Number(json.data?.amount)
      if (Number.isFinite(amount) && amount > 0) {
        savePriceToCache(amount)
        return amount
      }
    }
  } catch {
    // Continue to next provider
  }

  // 2. Try Binance
  try {
    const res = await fetch(
      'https://api.binance.com/api/v3/ticker/price?symbol=XLMUSDT',
    )
    if (res.ok) {
      const json = (await res.json()) as { price?: string }
      const amount = Number(json.price)
      if (Number.isFinite(amount) && amount > 0) {
        savePriceToCache(amount)
        return amount
      }
    }
  } catch {
    // Continue to next provider
  }

  // 3. Try CoinGecko
  try {
    const res = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=stellar&vs_currencies=usd',
    )
    if (res.ok) {
      const json = (await res.json()) as { stellar?: { usd?: number } }
      const amount = json.stellar?.usd
      if (typeof amount === 'number' && Number.isFinite(amount) && amount > 0) {
        savePriceToCache(amount)
        return amount
      }
    }
  } catch {
    // Continue to next provider
  }

  // 4. Try CryptoCompare
  try {
    const res = await fetch(
      'https://min-api.cryptocompare.com/data/price?fsym=XLM&tsyms=USD',
    )
    if (res.ok) {
      const json = (await res.json()) as { USD?: number }
      const amount = json.USD
      if (typeof amount === 'number' && Number.isFinite(amount) && amount > 0) {
        savePriceToCache(amount)
        return amount
      }
    }
  } catch {
    // Fallback to default
  }

  return DEFAULT_XLM_USD_PRICE
}

function savePriceToCache(price: number): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(
      XLM_PRICE_STORAGE_KEY,
      JSON.stringify({ price, ts: Date.now() }),
    )
  } catch {
    // Ignore storage quota errors
  }
}
