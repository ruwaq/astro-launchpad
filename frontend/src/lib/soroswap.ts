import type { Signer } from '@stellar/stellar-sdk/contract'
import { Client as FactoryClient } from '../contracts/soroswap-factory'
import { Client as RouterClient } from '../contracts/soroswap-router'
import {
  NETWORK_PASSPHRASE,
  RPC_URL,
  SOROSWAP_FACTORY,
  SOROSWAP_ROUTER,
  XLM_SAC,
} from './network'

/** Slippage por defecto (%). Es el mínimo de salida que exigimos al router. */
export const SLIPPAGE_PERCENT = 2

/** Deadline para las operaciones del router: unix timestamp + 5 minutos. */
const DEADLINE_SECONDS = 300

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

/** Mínimo de salida tras aplicar el slippage. */
export function withSlippage(
  amount: bigint,
  percent: number = SLIPPAGE_PERCENT,
): bigint {
  return (amount * BigInt(100 - percent)) / 100n
}

/**
 * Desenvuelve el `Result` que devuelven todos los contratos de Soroswap.
 * Lanza con el mensaje del error on-chain para poder mostrarlo en la UI.
 */
export function unwrapResult<T>(
  result: {
    isErr(): boolean
    unwrap(): T
    unwrapErr(): { message: string }
  },
  what: string,
): T {
  if (result.isErr()) {
    throw new Error(`${what}: ${result.unwrapErr().message}`)
  }
  return result.unwrap()
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
 * Estado del par token/XLM: si existe, su id y las reservas.
 *
 * El router ordena los tokens (`token_0 < token_1`), así que usamos
 * `sort_tokens` para saber qué reserva es la del token del launchpad.
 */
export async function fetchPoolState(tokenId: string): Promise<PoolState> {
  const { factory, router } = soroswapClients()

  const existsTx = await factory.pair_exists({
    token_a: tokenId,
    token_b: XLM_SAC,
  })
  if (!unwrapResult(existsTx.result, 'pair_exists')) {
    return { exists: false, pairId: null, reserveToken: 0n, reserveXlm: 0n }
  }

  const pairTx = await factory.get_pair({ token_a: tokenId, token_b: XLM_SAC })
  const pairId = unwrapResult(pairTx.result, 'get_pair')

  const [token0] = await sortTokens(router, tokenId)
  const [reserve0, reserve1] = await fetchReserves(router, tokenId)

  const tokenIsFirst = token0 === tokenId
  return {
    exists: true,
    pairId,
    reserveToken: tokenIsFirst ? reserve0 : reserve1,
    reserveXlm: tokenIsFirst ? reserve1 : reserve0,
  }
}

/** Orden de tokens que usa el router: `[token_0, token_1]`. */
async function sortTokens(
  router: RouterClient,
  tokenId: string,
): Promise<[string, string]> {
  const tx = await router.sort_tokens({ token_a: tokenId, token_b: XLM_SAC })
  return unwrapResult(tx.result, 'sort_tokens')
}

/** Reservas del par, en el orden de `sort_tokens`. */
async function fetchReserves(
  router: RouterClient,
  tokenId: string,
): Promise<[bigint, bigint]> {
  const tx = await router.get_reserves({
    factory: SOROSWAP_FACTORY,
    token_a: tokenId,
    token_b: XLM_SAC,
  })
  return unwrapResult(tx.result, 'get_reserves')
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
  if (!pool.exists || amountIn <= 0n) return 0n
  const { router } = soroswapClients()
  const tx = await router.router_get_amount_out({
    amount_in: amountIn,
    reserve_in: pool.reserveToken,
    reserve_out: pool.reserveXlm,
  })
  return unwrapResult(tx.result, 'router_get_amount_out')
}

/**
 * Crea el par token/XLM en la factory (si no existe) y espera a que
 * aparezca. La creación es asíncrona: la factory despliega el par y el
 * router lo inicializa en el ledger siguiente.
 */
export async function ensurePair(
  tokenId: string,
  signer?: Signer,
): Promise<string> {
  const { factory } = soroswapClients(signer)

  const existsTx = await factory.pair_exists({
    token_a: tokenId,
    token_b: XLM_SAC,
  })
  if (!unwrapResult(existsTx.result, 'pair_exists')) {
    const createTx = await factory.create_pair({
      token_a: tokenId,
      token_b: XLM_SAC,
    })
    await createTx.signAndSend()
  }

  // Espera acotada: como mucho 5 intentos, 1,5 s entre ellos.
  for (let attempt = 0; attempt < 5; attempt++) {
    const checkTx = await factory.pair_exists({
      token_a: tokenId,
      token_b: XLM_SAC,
    })
    if (unwrapResult(checkTx.result, 'pair_exists')) {
      const pairTx = await factory.get_pair({
        token_a: tokenId,
        token_b: XLM_SAC,
      })
      return unwrapResult(pairTx.result, 'get_pair')
    }
    await new Promise((resolve) => setTimeout(resolve, 1500))
  }
  throw new Error('El par no apareció en la factory de Soroswap a tiempo')
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
}): Promise<{
  pair: string
  tokenAmount: bigint
  xlmAmount: bigint
  lpAmount: bigint
}> {
  const { tokenId, amountToken, amountXlm, signer } = params
  const { router } = soroswapClients(signer)
  const publicKey = signer.address

  const pair = await ensurePair(tokenId, signer)
  const [token0] = await sortTokens(router, tokenId)

  const tx = await router.add_liquidity({
    token_a: tokenId,
    token_b: XLM_SAC,
    amount_a_desired: amountToken,
    amount_b_desired: amountXlm,
    amount_a_min: withSlippage(amountToken),
    amount_b_min: withSlippage(amountXlm),
    to: publicKey,
    deadline: unixDeadline(),
  })
  const { result } = await tx.signAndSend()
  const [amountA, amountB, lpAmount] = unwrapResult(result, 'add_liquidity')

  // El router devuelve los amounts en el orden en que le pasamos los tokens.
  const tokenIsFirst = token0 === tokenId
  return {
    pair,
    tokenAmount: tokenIsFirst ? amountA : amountB,
    xlmAmount: tokenIsFirst ? amountB : amountA,
    lpAmount,
  }
}

/** Cambia token por XLM con un mínimo de salida (slippage). */
export async function swapTokenForXlm(params: {
  tokenId: string
  amountIn: bigint
  amountOutMin: bigint
  signer: Signer
}): Promise<bigint[]> {
  const { tokenId, amountIn, amountOutMin, signer } = params
  const { router } = soroswapClients(signer)

  const tx = await router.swap_exact_tokens_for_tokens({
    amount_in: amountIn,
    amount_out_min: amountOutMin,
    path: [tokenId, XLM_SAC],
    to: signer.address,
    deadline: unixDeadline(),
  })
  const { result } = await tx.signAndSend()
  return unwrapResult(result, 'swap')
}

/** Deadline del router: unix timestamp + 5 minutos. */
function unixDeadline(): bigint {
  return BigInt(Math.floor(Date.now() / 1000) + DEADLINE_SECONDS)
}
