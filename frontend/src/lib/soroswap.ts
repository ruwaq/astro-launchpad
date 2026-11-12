import type { Signer } from '@stellar/stellar-sdk/contract'
import { Client as FactoryClient } from '../contracts/soroswap-factory'
import { Client as PairClient } from '../contracts/soroswap-pair'
import { Client as RouterClient } from '../contracts/soroswap-router'
import { isValidContractAddress } from './address'
import {
  NETWORK_PASSPHRASE,
  RPC_URL,
  SOROSWAP_FACTORY,
  SOROSWAP_ROUTER,
  XLM_SAC,
} from './network'
import { STELLAR_BURN_ADDRESS, SOROSWAP_SWAP_FEE_PERCENT } from './tokenomics'

/** Slippage por defecto (%). Es el mínimo de salida que exigimos al router. */
export const SLIPPAGE_PERCENT = 2

/** Opciones rápidas de slippage (%) para el selector de la UI. */
export const SLIPPAGE_OPTIONS = [0.5, 1, 2, 5] as const

/** Deadline para las operaciones del router: unix timestamp + 5 minutos. */
const DEADLINE_SECONDS = 300

/**
 * Precio de 1 token en XLM (stroops enteros) según las reservas del par.
 * NOTA: Para tokens con baja ratio (< 1 stroop por token, típico en fair launch),
 * este valor trunca a 0n. Para visualización y cálculos precisos, usar `tokenPriceInXlmNumber`.
 */
export function tokenPriceInXlm(pool: PoolState, decimals: number): bigint {
  if (!pool.exists || pool.reserveToken <= 0n || pool.reserveXlm <= 0n) return 0n
  const safeDecimals = Math.max(0, Math.trunc(decimals))
  return (pool.reserveXlm * 10n ** BigInt(safeDecimals)) / pool.reserveToken
}

/**
 * Precio de 1 token en XLM como número de coma flotante de alta precisión.
 * Permite representar precios fraccionarios (< 1 stroop, e.g. 0.00000001005 XLM).
 */
export function tokenPriceInXlmNumber(pool: PoolState, decimals: number): number {
  if (!pool.exists || pool.reserveToken <= 0n || pool.reserveXlm <= 0n) return 0
  const safeDecimals = Math.max(0, Math.trunc(decimals))
  const reserveXlm = Number(pool.reserveXlm) / 1e7
  const reserveToken = Number(pool.reserveToken) / 10 ** safeDecimals
  if (!Number.isFinite(reserveXlm) || !Number.isFinite(reserveToken) || reserveToken <= 0) return 0
  return reserveXlm / reserveToken
}

/**
 * Formats a fractional token price in XLM into a human-readable string without scientific notation.
 * e.g. 0.00000001005 XLM
 */
export function formatTokenPrice(priceInXlm: number): string {
  if (!Number.isFinite(priceInXlm) || priceInXlm <= 0) return '0'
  if (priceInXlm >= 1) {
    return priceInXlm.toLocaleString('en-US', { maximumFractionDigits: 4 })
  }
  if (priceInXlm >= 0.0001) {
    return priceInXlm.toFixed(6)
  }
  return priceInXlm.toFixed(9).replace(/0+$/, '')
}

/**
 * Salida a precio spot, sin comisión ni slippage. Sirve solo para estimar el
 * impacto de una operación; la cotización real sale del router.
 */
export function spotAmountOut(
  amountIn: bigint,
  reserveIn: bigint,
  reserveOut: bigint,
): bigint {
  if (amountIn <= 0n || reserveIn <= 0n) return 0n
  return (amountIn * reserveOut) / reserveIn
}

/**
 * Impacto de precio en porcentaje, descontando de la referencia spot la
 * comisión del pool de Soroswap (30 bps). Así un trade pequeño no reporta
 * un "impacto" puramente comisional, y el número refleja el coste real del
 * tamaño de la operación contra el precio de mercado.
 */
export function priceImpactPercent(
  amountIn: bigint,
  amountOut: bigint,
  reserveIn: bigint,
  reserveOut: bigint,
): number {
  const spot = spotAmountOut(amountIn, reserveIn, reserveOut)
  if (spot <= 0n || amountOut <= 0n) return 0
  // Soroswap aplica la fee sobre el amount_in (30 bps, mismo resultado en la
  // salida): la referencia no-comisionada es spot * (1 - fee).
  const feeBps = BigInt(Math.round(SOROSWAP_SWAP_FEE_PERCENT * 100))
  const spotAfterFee = (spot * (10_000n - feeBps)) / 10_000n
  if (spotAfterFee <= 0n) return 0
  const difference = spotAfterFee - amountOut
  if (difference <= 0n) return 0
  return Number((difference * 10_000n) / spotAfterFee) / 100
}

/** Estado del par token/XLM en Soroswap. */
export type PoolState = {
  /** ¿Existe el par en la factory? */
  exists: boolean
  /** Id del contrato del par. */
  pairId: string | null
  /** Reserva del token del launchpad (base units). */
  reserveToken: bigint
  /** Reserva de XLM nativo (base units). */
  reserveXlm: bigint
}

/** Mínimo de salida tras aplicar el slippage (soporta decimales como 0.5% con basis points). Protege contra NaN y valores negativos. */
export function withSlippage(
  amount: bigint,
  percent: number = SLIPPAGE_PERCENT,
): bigint {
  if (amount <= 0n) return 0n
  const safe = Number.isFinite(percent) ? Math.max(0, Math.min(100, percent)) : SLIPPAGE_PERCENT
  // Basis points (1% = 100 bps) para evitar operaciones flotantes con BigInt
  const bps = BigInt(Math.round(safe * 100))
  return (amount * (10_000n - bps)) / 10_000n
}

/** Posición de liquidez del usuario en un par token/XLM. */
export type LpPosition = {
  pairId: string
  /** Tokens LP en la wallet (el par usa 7 decimales). */
  lpBalance: bigint
  /** Suministro total de tokens LP del par. */
  totalSupply: bigint
  /** Reserva del token del launchpad (base units). */
  reserveToken: bigint
  /** Reserva de XLM nativo (base units). */
  reserveXlm: bigint
}

/** Parte del pool que representa `lpAmount` sobre el total, en porcentaje. */
export function lpSharePercent(lpAmount: bigint, totalSupply: bigint): number {
  if (totalSupply <= 0n || lpAmount <= 0n) return 0
  // Basis points enteros: dos decimales sin pasar por coma flotante.
  return Math.min(100, Number((lpAmount * 10_000n) / totalSupply) / 100)
}

/** Cantidades estimadas al retirar `lpAmount` (proporción de las reservas). */
export function withdrawPreview(
  position: Pick<LpPosition, 'totalSupply' | 'reserveToken' | 'reserveXlm'>,
  lpAmount: bigint,
): { tokenAmount: bigint; xlmAmount: bigint } {
  if (
    position.totalSupply <= 0n ||
    lpAmount <= 0n ||
    position.reserveToken <= 0n ||
    position.reserveXlm <= 0n
  ) {
    return { tokenAmount: 0n, xlmAmount: 0n }
  }
  return {
    tokenAmount: (lpAmount * position.reserveToken) / position.totalSupply,
    xlmAmount: (lpAmount * position.reserveXlm) / position.totalSupply,
  }
}

/**
 * Desenvuelve el `Result` que devuelven todos los contratos de Soroswap.
 * Lanza con el mensaje del error on-chain para poder mostrarlo en la UI.
 */
export function unwrapResult<T>(
  result: unknown,
  what: string,
): T {
  // Los contratos de Soroswap devuelven Result<T, E>; el SDK ya desenvuelve
  // los métodos cuyo tipo de retorno no es Result. Aceptamos ambas formas.
  if (
    result &&
    typeof result === 'object' &&
    'isErr' in result &&
    typeof (result as { isErr: unknown }).isErr === 'function'
  ) {
    const inner = result as {
      isErr(): boolean
      unwrapErr(): unknown
      unwrap(): T
    }
    if (inner.isErr()) {
      const raw = inner.unwrapErr()
      const message =
        typeof raw === 'string'
          ? raw
          : raw instanceof Error
            ? raw.message
            : typeof raw === 'object' && raw !== null && 'message' in raw
              ? String((raw as { message?: unknown }).message)
              : 'unknown contract error'
      throw new Error(`${what}: ${message}`)
    }
    return inner.unwrap()
  }
  return result as T
}

/**
 * Clientes de la factory y el router de Soroswap.
 * Sin `signer` son de solo lectura (simulación).
 */
export function soroswapClients(signer?: Signer) {
  const options = {
    rpcUrl: RPC_URL,
    networkPassphrase: NETWORK_PASSPHRASE,
    publicKey: signer?.address,
    signTransaction: signer,
    signAuthEntry: signer,
  }
  return {
    factory: new FactoryClient({ contractId: SOROSWAP_FACTORY, ...options }),
    router: new RouterClient({ contractId: SOROSWAP_ROUTER, ...options }),
  }
}

/**
 * Caché en memoria de datos inmutables de la factory y de cada par:
 * - Un par creado en la factory para `(tokenId, XLM_SAC)` nunca cambia de `pairId`.
 * - `token_0` y `token_1` de un contrato par nunca cambian tras su despliegue.
 * Esto ahorra hasta 4 simulaciones RPC secuenciales en cada lectura de reservas.
 */
const pairIdCache = new Map<string, string>()
const pairTokensCache = new Map<string, { token0: string; token1: string }>()

/** Pre-popula la caché de pairId cuando el id del par ya es conocido (ej. eventos de factory). */
export function cachePairId(tokenId: string, pairId: string): void {
  if (isValidContractAddress(tokenId) && isValidContractAddress(pairId)) {
    pairIdCache.set(tokenId, pairId)
  }
}

/**
 * Estado del par token/XLM: si existe, su id y las reservas.
 *
 * Tras confirmar la existencia en la factory, el orden y las reservas se
 * leen del contrato del par (`token_0`/`token_1`), que es la única verdad.
 */
export async function fetchPoolState(tokenId: string): Promise<PoolState> {
  if (!isValidContractAddress(tokenId)) {
    return { exists: false, pairId: null, reserveToken: 0n, reserveXlm: 0n }
  }
  let pairId = pairIdCache.get(tokenId) ?? null

  if (!pairId) {
    const { factory } = soroswapClients()
    const existsTx = await factory.pair_exists({
      token_a: tokenId,
      token_b: XLM_SAC,
    })
    if (!unwrapResult<boolean>(existsTx.result, 'pair_exists')) {
      return { exists: false, pairId: null, reserveToken: 0n, reserveXlm: 0n }
    }

    const pairTx = await factory.get_pair({ token_a: tokenId, token_b: XLM_SAC })
    pairId = unwrapResult<string>(pairTx.result, 'get_pair')
    pairIdCache.set(tokenId, pairId)
  }

  // La única verdad sobre el orden y las reservas es el contrato del par:
  // `sort_tokens` del router puede no coincidir con `token_0`/`token_1`.
  const { token0, reserves } = await pairLayout(pairId)

  const tokenIsFirst = token0 === tokenId
  return {
    exists: true,
    pairId,
    reserveToken: tokenIsFirst ? reserves[0] : reserves[1],
    reserveXlm: tokenIsFirst ? reserves[1] : reserves[0],
  }
}

/**
 * Posición de liquidez de `account` en el par token/XLM, o `null` si el par
 * no existe. Todo se lee del contrato del par: LP, suministro y reservas.
 */
export async function fetchLpPosition(
  tokenId: string,
  account: string,
): Promise<LpPosition | null> {
  const pool = await fetchPoolState(tokenId)
  if (!pool.exists || !pool.pairId) return null

  const pair = pairClientFor(pool.pairId)
  const [balanceTx, supplyTx] = await Promise.all([
    pair.balance({ id: account }),
    pair.total_supply(),
  ])
  return {
    pairId: pool.pairId,
    lpBalance: unwrapResult<bigint>(balanceTx.result, 'balance'),
    totalSupply: unwrapResult<bigint>(supplyTx.result, 'total_supply'),
    reserveToken: pool.reserveToken,
    reserveXlm: pool.reserveXlm,
  }
}

/** Cliente del contrato del par (fuente de verdad de orden y reservas). */
function pairClientFor(pairId: string, signer?: Signer): PairClient {
  return new PairClient({
    contractId: pairId,
    rpcUrl: RPC_URL,
    networkPassphrase: NETWORK_PASSPHRASE,
    publicKey: signer?.address,
    signTransaction: signer,
    signAuthEntry: signer,
  })
}

/** Orden interno `[token_0, token_1]` y reservas, tal como las guarda el par. */
async function pairLayout(
  pairId: string,
  signer?: Signer,
): Promise<{ token0: string; token1: string; reserves: [bigint, bigint] }> {
  const pair = pairClientFor(pairId, signer)
  const cachedTokens = pairTokensCache.get(pairId)

  if (cachedTokens) {
    const reservesTx = await pair.get_reserves()
    const reserves = unwrapResult<[bigint, bigint]>(
      reservesTx.result,
      'get_reserves',
    )
    return { ...cachedTokens, reserves }
  }

  const [token0Tx, token1Tx, reservesTx] = await Promise.all([
    pair.token_0(),
    pair.token_1(),
    pair.get_reserves(),
  ])
  const token0 = unwrapResult<string>(token0Tx.result, 'token_0')
  const token1 = unwrapResult<string>(token1Tx.result, 'token_1')
  const reserves = unwrapResult<[bigint, bigint]>(
    reservesTx.result,
    'get_reserves',
  )
  pairTokensCache.set(pairId, { token0, token1 })
  return { token0, token1, reserves }
}

/** Estado y token de un par Soroswap a partir de su ID de contrato. */
export async function fetchPoolStateByPair(pairId: string): Promise<{
  exists: boolean
  tokenId: string | null
  reserveToken: bigint
  reserveXlm: bigint
} | null> {
  try {
    const layout = await pairLayout(pairId)
    const { token0, token1, reserves } = layout
    if (token0 === XLM_SAC) {
      return {
        exists: true,
        tokenId: token1,
        reserveToken: reserves[1],
        reserveXlm: reserves[0],
      }
    }
    if (token1 === XLM_SAC) {
      return {
        exists: true,
        tokenId: token0,
        reserveToken: reserves[0],
        reserveXlm: reserves[1],
      }
    }
    return null
  } catch {
    return null
  }
}

/**
 * Cotiza cuánto XLM sale por una cantidad de token.
 *
 * Ojo: `router_get_amounts_out` de este despliegue de Soroswap devuelve el
 * input sin cotizar; la cotización real es `router_get_amount_out` con las
 * reservas del par (comisión del 30 bps).
 */
export async function quoteTokenForXlm(
  amountIn: bigint,
  pool: PoolState,
): Promise<bigint> {
  if (
    !pool.exists ||
    amountIn <= 0n ||
    pool.reserveToken <= 0n ||
    pool.reserveXlm <= 0n
  ) {
    return 0n
  }
  const { router } = soroswapClients()
  const tx = await router.router_get_amount_out({
    amount_in: amountIn,
    reserve_in: pool.reserveToken,
    reserve_out: pool.reserveXlm,
  })
  return unwrapResult(tx.result, 'router_get_amount_out')
}

/** Cotiza cuántos tokens salen por una cantidad de XLM. */
export async function quoteXlmForToken(
  amountIn: bigint,
  pool: PoolState,
): Promise<bigint> {
  if (
    !pool.exists ||
    amountIn <= 0n ||
    pool.reserveToken <= 0n ||
    pool.reserveXlm <= 0n
  ) {
    return 0n
  }
  const { router } = soroswapClients()
  const tx = await router.router_get_amount_out({
    amount_in: amountIn,
    reserve_in: pool.reserveXlm,
    reserve_out: pool.reserveToken,
  })
  return unwrapResult(tx.result, 'router_get_amount_out')
}

/**
 * Crea el par token/XLM en la factory (si no existe) y espera a que
 * las reservas respondan. La creación es asíncrona: la factory despliega el
 * par y el router lo inicializa en el ledger siguiente; añadir liquidez
 * antes de esa inicialización falla con "insufficient a/b amount", así que
 * comprobamos que `get_reserves()` responde antes de dar el par por listo.
 */
async function ensurePair(
  tokenId: string,
  signer?: Signer,
): Promise<string> {
  const { factory } = soroswapClients(signer)

  const existsTx = await factory.pair_exists({
    token_a: tokenId,
    token_b: XLM_SAC,
  })
  if (!unwrapResult<boolean>(existsTx.result, 'pair_exists')) {
    const createTx = await factory.create_pair({
      token_a: tokenId,
      token_b: XLM_SAC,
    })
    await createTx.signAndSend()
  }

  // Espera acotada: como mucho 5 intentos, 1,5 s entre ellos.
  // Se considera listo cuando el par existe Y sus reservas ya se leen.
  for (let attempt = 0; attempt < 5; attempt++) {
    const checkTx = await factory.pair_exists({
      token_a: tokenId,
      token_b: XLM_SAC,
    })
    if (unwrapResult<boolean>(checkTx.result, 'pair_exists')) {
      const pairTx = await factory.get_pair({
        token_a: tokenId,
        token_b: XLM_SAC,
      })
      const pairId = unwrapResult<string>(pairTx.result, 'get_pair')
      pairIdCache.set(tokenId, pairId)
      try {
        await pairClientFor(pairId, signer).get_reserves()
        return pairId
      } catch {
        // El router ya desplegó el par pero sus reservas aún no responden.
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 1500))
  }
  throw new Error('Pair did not appear in Soroswap factory in time')
}

/**
 * Añade liquidez al par token/XLM.
 *
 * El router mueve los tokens con `transfer` (no `transfer_from`), así que no
 * hace falta allowance previo: la autorización del usuario la cubre la
 * firma de la transacción, porque es la cuenta que invoca.
 */
export async function addLiquidity(params: {
  tokenId: string
  amountToken: bigint
  amountXlm: bigint
  signer: Signer
  to?: string
  /** Se invoca al entrar en cada fase, para pintar progreso real. */
  onStep?: (step: 'pair' | 'liquidity') => void
  /** Se invoca con el hash en cuanto la tx de liquidez se envía. */
  onHash?: (hash: string) => void
}): Promise<{
  pair: string
  tokenAmount: bigint
  xlmAmount: bigint
  lpAmount: bigint
}> {
  const { tokenId, amountToken, amountXlm, signer, to: recipient, onStep, onHash } = params
  const { router } = soroswapClients(signer)
  const publicKey = signer.address

  onStep?.('pair')
  const pair = await ensurePair(tokenId, signer)
  // La orientación real es la del par: montamos los amounts en el orden
  // interno (token_0, token_1) para que el router no cruce los lados.
  const { token0, token1 } = await pairLayout(pair, signer)
  const tokenFirst = token0 === tokenId
  if (!tokenFirst && token1 !== tokenId) {
    throw new Error('Pair does not contain the launchpad token')
  }

  onStep?.('liquidity')
  const tx = await router.add_liquidity({
    token_a: tokenFirst ? tokenId : XLM_SAC,
    token_b: tokenFirst ? XLM_SAC : tokenId,
    amount_a_desired: tokenFirst ? amountToken : amountXlm,
    amount_b_desired: tokenFirst ? amountXlm : amountToken,
    amount_a_min: tokenFirst ? withSlippage(amountToken) : withSlippage(amountXlm),
    amount_b_min: tokenFirst ? withSlippage(amountXlm) : withSlippage(amountToken),
    to: recipient ?? publicKey,
    deadline: unixDeadline(),
  })
  const sent = await tx.signAndSend()
  const hash = sent.sendTransactionResponse?.hash
  if (hash) onHash?.(hash)
  const [amountA, amountB, lpAmount] = unwrapResult<[bigint, bigint, bigint]>(
    sent.result,
    'add_liquidity',
  )

  // El router devuelve los amounts en el orden en que le pasamos los tokens,
  // que aquí es el orden real (token_0, token_1) del par.
  return {
    pair,
    tokenAmount: tokenFirst ? amountA : amountB,
    xlmAmount: tokenFirst ? amountB : amountA,
    lpAmount,
  }
}

/**
 * Retira liquidez del par token/XLM con el router (atómico).
 *
 * `remove_liquidity` toma los LP del usuario, los quema y devuelve ambos
 * lados en una sola transacción: si algo falla no quedan LP atrapados.
 */
export async function withdrawLiquidity(params: {
  tokenId: string
  lpAmount: bigint
  signer: Signer
  /** Se invoca con el hash en cuanto la tx se envía a la red. */
  onHash?: (hash: string) => void
}): Promise<{ pair: string; tokenAmount: bigint; xlmAmount: bigint }> {
  const { tokenId, lpAmount, signer, onHash } = params
  if (lpAmount <= 0n) {
    throw new Error('LP amount to withdraw must be greater than 0')
  }

  const pool = await fetchPoolState(tokenId)
  if (!pool.exists || !pool.pairId) {
    throw new Error('Token/XLM pair does not exist')
  }

  // Orden real del par y suministro LP para fijar los mínimos de salida.
  const pair = pairClientFor(pool.pairId)
  const [token0Tx, supplyTx] = await Promise.all([
    pair.token_0(),
    pair.total_supply(),
  ])
  const tokenFirst =
    unwrapResult<string>(token0Tx.result, 'token_0') === tokenId
  const totalSupply = unwrapResult<bigint>(supplyTx.result, 'total_supply')
  const expected = withdrawPreview(
    {
      totalSupply,
      reserveToken: pool.reserveToken,
      reserveXlm: pool.reserveXlm,
    },
    lpAmount,
  )

  const { router } = soroswapClients(signer)
  const tx = await router.remove_liquidity({
    token_a: tokenFirst ? tokenId : XLM_SAC,
    token_b: tokenFirst ? XLM_SAC : tokenId,
    liquidity: lpAmount,
    amount_a_min: withSlippage(
      tokenFirst ? expected.tokenAmount : expected.xlmAmount,
    ),
    amount_b_min: withSlippage(
      tokenFirst ? expected.xlmAmount : expected.tokenAmount,
    ),
    to: signer.address,
    deadline: unixDeadline(),
  })
  const sent = await tx.signAndSend()
  const hash = sent.sendTransactionResponse?.hash
  if (hash) onHash?.(hash)
  const [amountA, amountB] = unwrapResult<[bigint, bigint]>(
    sent.result,
    'remove_liquidity',
  )

  // El router devuelve los amounts en el orden token_a/token_b que le dimos.
  return {
    pair: pool.pairId,
    tokenAmount: tokenFirst ? amountA : amountB,
    xlmAmount: tokenFirst ? amountB : amountA,
  }
}

/** Compra tokens pagando XLM, con un mínimo de tokens de salida. */
export async function swapXlmForToken(params: {
  tokenId: string
  amountIn: bigint
  amountOutMin: bigint
  signer: Signer
  /** Se invoca con el hash en cuanto la tx se envía a la red. */
  onHash?: (hash: string) => void
}): Promise<bigint[]> {
  const { tokenId, amountIn, amountOutMin, signer, onHash } = params
  const { router } = soroswapClients(signer)

  const tx = await router.swap_exact_tokens_for_tokens({
    amount_in: amountIn,
    amount_out_min: amountOutMin,
    path: [XLM_SAC, tokenId],
    to: signer.address,
    deadline: unixDeadline(),
  })
  const sent = await tx.signAndSend()
  const hash = sent.sendTransactionResponse?.hash
  if (hash) onHash?.(hash)
  return unwrapResult<bigint[]>(sent.result, 'swap')
}

/** Cambia token por XLM con un mínimo de salida (slippage). */
export async function swapTokenForXlm(params: {
  tokenId: string
  amountIn: bigint
  amountOutMin: bigint
  signer: Signer
  /** Se invoca con el hash en cuanto la tx se envía a la red. */
  onHash?: (hash: string) => void
}): Promise<bigint[]> {
  const { tokenId, amountIn, amountOutMin, signer, onHash } = params
  const { router } = soroswapClients(signer)

  const tx = await router.swap_exact_tokens_for_tokens({
    amount_in: amountIn,
    amount_out_min: amountOutMin,
    path: [tokenId, XLM_SAC],
    to: signer.address,
    deadline: unixDeadline(),
  })
  const sent = await tx.signAndSend()
  const hash = sent.sendTransactionResponse?.hash
  if (hash) onHash?.(hash)
  return unwrapResult<bigint[]>(sent.result, 'swap')
}

/**
 * Lee on-chain cuántos LP tokens están quemados permanentemente en la dirección
 * blackhole de Stellar (`STELLAR_BURN_ADDRESS`), impidiendo cualquier rug-pull.
 */
export async function fetchBurnedLpInfo(pairId: string): Promise<{
  burnedLp: bigint
  totalSupply: bigint
  burnedPercent: number
}> {
  const pair = pairClientFor(pairId)
  const [burnedTx, supplyTx] = await Promise.all([
    pair.balance({ id: STELLAR_BURN_ADDRESS }),
    pair.total_supply(),
  ])
  const burnedLp = unwrapResult<bigint>(burnedTx.result, 'balance')
  const totalSupply = unwrapResult<bigint>(supplyTx.result, 'total_supply')
  return {
    burnedLp,
    totalSupply,
    burnedPercent: lpSharePercent(burnedLp, totalSupply),
  }
}

/** Deadline del router: unix timestamp + 5 minutos. */
function unixDeadline(): bigint {
  return BigInt(Math.floor(Date.now() / 1000) + DEADLINE_SECONDS)
}
