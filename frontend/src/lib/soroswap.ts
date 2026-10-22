import type { Signer } from '@stellar/stellar-sdk/contract'
import { Client as FactoryClient } from '../contracts/soroswap-factory'
import { Client as PairClient } from '../contracts/soroswap-pair'
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

/** Precio de 1 token en XLM (base units) según las reservas del par. */
export function tokenPriceInXlm(pool: PoolState, decimals: number): bigint {
  if (!pool.exists || pool.reserveToken === 0n) return 0n
  return (pool.reserveXlm * 10n ** BigInt(decimals)) / pool.reserveToken
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
    const inner = result as { isErr(): boolean; unwrapErr(): { message: string }; unwrap(): T }
    if (inner.isErr()) {
      throw new Error(`${what}: ${inner.unwrapErr().message}`)
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
 * Estado del par token/XLM: si existe, su id y las reservas.
 *
 * El router ordena los tokens (`token_0 < token_1`), así que usamos
 * `sort_tokens` para saber qué reserva es la del token del launchpad.
 */
export async function fetchPoolState(tokenId: string): Promise<PoolState> {
  const { factory } = soroswapClients()

  const existsTx = await factory.pair_exists({
    token_a: tokenId,
    token_b: XLM_SAC,
  })
  if (!unwrapResult<boolean>(existsTx.result, 'pair_exists')) {
    return { exists: false, pairId: null, reserveToken: 0n, reserveXlm: 0n }
  }

  const pairTx = await factory.get_pair({ token_a: tokenId, token_b: XLM_SAC })
  const pairId = unwrapResult<string>(pairTx.result, 'get_pair')

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

/** Cliente del contrato del par (fuente de verdad de orden y reservas). */
function pairClientFor(pairId: string, signer?: Signer): PairClient {
  return new PairClient({
    contractId: pairId,
    rpcUrl: RPC_URL,
    networkPassphrase: NETWORK_PASSPHRASE,
    publicKey: signer?.address,
    signTransaction: signer,
  })
}

/** Orden interno `[token_0, token_1]` y reservas, tal como las guarda el par. */
async function pairLayout(
  pairId: string,
  signer?: Signer,
): Promise<{ token0: string; token1: string; reserves: [bigint, bigint] }> {
  const pair = pairClientFor(pairId, signer)
  const token0 = unwrapResult<string>((await pair.token_0()).result, 'token_0')
  const token1 = unwrapResult<string>((await pair.token_1()).result, 'token_1')
  const reserves = unwrapResult<[bigint, bigint]>((await pair.get_reserves()).result, 'get_reserves')
  return { token0, token1, reserves }
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
  if (!unwrapResult<boolean>(existsTx.result, 'pair_exists')) {
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
    if (unwrapResult<boolean>(checkTx.result, 'pair_exists')) {
      const pairTx = await factory.get_pair({
        token_a: tokenId,
        token_b: XLM_SAC,
      })
      return unwrapResult<string>(pairTx.result, 'get_pair')
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
  // La orientación real es la del par: montamos los amounts en el orden
  // interno (token_0, token_1) para que el router no cruce los lados.
  const { token0, token1 } = await pairLayout(pair, signer)
  const tokenFirst = token0 === tokenId
  if (!tokenFirst && token1 !== tokenId) {
    throw new Error('El par no contiene el token del launchpad')
  }

  const tx = await router.add_liquidity({
    token_a: tokenFirst ? tokenId : XLM_SAC,
    token_b: tokenFirst ? XLM_SAC : tokenId,
    amount_a_desired: tokenFirst ? amountToken : amountXlm,
    amount_b_desired: tokenFirst ? amountXlm : amountToken,
    amount_a_min: tokenFirst ? withSlippage(amountToken) : withSlippage(amountXlm),
    amount_b_min: tokenFirst ? withSlippage(amountXlm) : withSlippage(amountToken),
    to: publicKey,
    deadline: unixDeadline(),
  })
  const { result } = await tx.signAndSend()
  const [amountA, amountB, lpAmount] = unwrapResult<[bigint, bigint, bigint]>(result, 'add_liquidity')

  // El router devuelve los amounts en el orden en que le pasamos los tokens,
  // que aquí es el orden real (token_0, token_1) del par.
  return {
    pair,
    tokenAmount: tokenFirst ? amountA : amountB,
    xlmAmount: tokenFirst ? amountB : amountA,
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
  return unwrapResult<bigint[]>(result, 'swap')
}

/** Deadline del router: unix timestamp + 5 minutos. */
function unixDeadline(): bigint {
  return BigInt(Math.floor(Date.now() / 1000) + DEADLINE_SECONDS)
}
