/**
 * Network configuration. Defaults to public Stellar testnet; supports environment overrides.
 *
 * NOTE (RPC como fuente única): todos los clientes Soroban se crean con `RPC_URL`.
 * El failover entre RPCs deliberadamente NO se usa: reenviar una transacción
 * construida sobre un nodo a otro nodo puede fallar por desfase de ledger,
 * y mezclar URLs de redes distintas firmaría con passphrase incorrecta.
 * La healthy-check (`checkRpcHealth`) se usa para diagnóstico en la UI.
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
 * Ventana estándar de lectura de eventos RPC (~14 h de testnet, ledgers de ~5 s).
 * Única fuente para discovery.ts y token-events.ts.
 */
export const EVENT_WINDOW_LEDGERS = 10_000

/**
 * Quick health check for the Soroban RPC node.
 * Returns node availability, latest ledger sequence, and roundtrip latency.
 */
export async function checkRpcHealth(url = RPC_URL): Promise<{
  ok: boolean
  sequence?: number
  latencyMs?: number
  error?: string
}> {
  const start = performance.now()
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getLatestLedger',
      }),
    })
    const data = (await res.json()) as {
      result?: { sequence?: number }
      error?: { message?: string }
    }
    const latencyMs = Math.round(performance.now() - start)
    if (typeof data?.result?.sequence === 'number') {
      return { ok: true, sequence: data.result.sequence, latencyMs }
    }
    return {
      ok: false,
      latencyMs,
      error: data?.error?.message ?? 'Invalid RPC response',
    }
  } catch (err) {
    return { ok: false, error: (err as Error)?.message ?? 'Network unreachable' }
  }
}
