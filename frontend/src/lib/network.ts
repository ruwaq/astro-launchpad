/**
 * Network configuration. Defaults to public Stellar testnet; supports environment overrides.
 *
 * NOTE (RPC and Failover Architecture):
 * - Transaction submission is pinned to `RPC_URL` to avoid sequence/ledger desync.
 * - Read-only queries, health checks, and event polling use `RPC_POOL` and `executeWithRpcFailover`
 *   with exponential backoff against rate limits (HTTP 429) and transient downtime.
 */
export const NETWORK_NAME =
  (import.meta.env.VITE_STELLAR_NETWORK as string | undefined) || 'testnet'

export const NETWORK_PASSPHRASE =
  NETWORK_NAME === 'mainnet'
    ? 'Public Global Stellar Network ; September 2015'
    : 'Test SDF Network ; September 2015'

export const RPC_URL =
  (import.meta.env.VITE_SOROBAN_RPC_URL as string | undefined) ||
  'https://soroban-testnet.stellar.org'

/**
 * High-availability RPC failover pool for read-only simulations and event queries.
 * Orders primary endpoint first, followed by official and fallback nodes for the same network.
 */
export const RPC_POOL: string[] = Array.from(
  new Set(
    [
      import.meta.env.VITE_SOROBAN_RPC_URL,
      RPC_URL,
      NETWORK_NAME === 'mainnet'
        ? 'https://soroban-rpc.mainnet.stellar.org'
        : 'https://rpc-testnet.stellar.org',
    ].filter(Boolean) as string[],
  ),
)

export const HORIZON_URL =
  (import.meta.env.VITE_HORIZON_URL as string | undefined) ||
  'https://horizon-testnet.stellar.org'

/** Soroswap deployed on testnet (canonical AMM contracts). */
export const SOROSWAP_FACTORY = 'CDP3HMUH6SMS3S7NPGNDJLULCOXXEPSHY4JKUKMBNQMATHDHWXRRJTBY'
export const SOROSWAP_ROUTER = 'CCJUD55AG6W5HAI5LRVNKAE5WDP5XGZBUDS5WNTIVDU7O264UZZE7BRD'
export const XLM_SAC = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC'

/** Flagship genesis meme token deployed on testnet (ASTRO). */
export const ASTRO_TOKEN_ID = 'CAI637WCEILQF3ZYOV6BRUCX532XQIVOOJ4CRWFPWHQRJHOH5OKHSXRE'

/**
 * SHA-256 hash of the token contract bytecode already deployed on testnet.
 * The launchpad deploys new instances with this hash without re-uploading the binary.
 */
export const ASTRO_WASM_HASH =
  '5930d6c69894f5cd6924e1a7d8d10282448c7c18de0143dce76e92884c39786b'

/**
 * Atomic Launchpad contract deployed on testnet.
 */
export const LAUNCHPAD_CONTRACT_ID =
  'CASO42JQGKYLATUDXHUZFBBHC2XKZ5XI732MVRLQC4MT664X7JVJGS52'

/**
 * SHA-256 hash of the launchpad contract bytecode deployed on testnet.
 */
export const LAUNCHPAD_WASM_HASH =
  '321e7a9e32c31699832272e8c7c3da1a8291d82776eada9ef1104f27264d5c18'

/**
 * Standard event polling ledger window (~14h on testnet, 5s ledgers).
 * Single source of truth for discovery.ts and token-events.ts.
 */
export const EVENT_WINDOW_LEDGERS = 10_000

/**
 * Quick health check for the Soroban RPC node with timeout protection and HTTP status verification.
 * Returns node availability, latest ledger sequence, and roundtrip latency.
 */
export async function checkRpcHealth(
  url = RPC_URL,
  timeoutMs = 5000,
): Promise<{
  ok: boolean
  sequence?: number
  latencyMs?: number
  error?: string
}> {
  const start = performance.now()
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    let res: Response
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getLatestLedger',
        }),
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timer)
    }

    const latencyMs = Math.round(performance.now() - start)
    if (!res.ok) {
      return {
        ok: false,
        latencyMs,
        error: `HTTP ${res.status}: ${res.statusText || 'Error'}`,
      }
    }

    const data = (await res.json()) as {
      result?: { sequence?: number }
      error?: { message?: string }
    }

    if (typeof data?.result?.sequence === 'number') {
      return { ok: true, sequence: data.result.sequence, latencyMs }
    }
    return {
      ok: false,
      latencyMs,
      error: data?.error?.message ?? 'Invalid RPC response',
    }
  } catch (err) {
    const latencyMs = Math.round(performance.now() - start)
    const isTimeout = (err as Error)?.name === 'AbortError'
    return {
      ok: false,
      latencyMs,
      error: isTimeout ? `Request timed out after ${timeoutMs}ms` : ((err as Error)?.message ?? 'Network unreachable'),
    }
  }
}

/**
 * Determines whether an error is transient and retryable (e.g. rate limit 429, 502/503/504, timeout).
 */
export function isRetryableRpcError(error: unknown): boolean {
  if (!error) return false
  const msg = (error instanceof Error ? error.message : String(error)).toLowerCase()
  return (
    msg.includes('429') ||
    msg.includes('rate limit') ||
    msg.includes('too many requests') ||
    msg.includes('502') ||
    msg.includes('503') ||
    msg.includes('504') ||
    msg.includes('timeout') ||
    msg.includes('aborted') ||
    msg.includes('econnrefused') ||
    msg.includes('network unreachable') ||
    msg.includes('fetch failed')
  )
}

/**
 * Executes a read-only RPC query with automatic failover and exponential backoff across RPC pool nodes.
 */
export async function executeWithRpcFailover<T>(
  action: (rpcUrl: string) => Promise<T>,
  pool: string[] = RPC_POOL,
  options?: {
    maxRetries?: number
    initialDelayMs?: number
  },
): Promise<T> {
  const maxRetries = options?.maxRetries ?? 2
  const initialDelay = options?.initialDelayMs ?? 150
  let lastError: unknown

  for (const url of pool) {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await action(url)
      } catch (err) {
        lastError = err
        if (!isRetryableRpcError(err) || attempt === maxRetries) {
          break
        }
        // Exponential backoff with jitter
        const delay = initialDelay * Math.pow(2, attempt) + Math.random() * 50
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }
  }

  throw lastError
}
