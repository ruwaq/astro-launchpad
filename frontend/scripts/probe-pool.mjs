/**
 * Sonda de solo lectura del par de Soroswap (testnet).
 *
 * Imprime el estado del par (reservas), la cotización real y la de
 * `router_get_amounts_out`, que en este despliegue devuelve el input sin
 * cotizar (por eso la UI usa `router_get_amount_out`).
 *
 * Uso: node scripts/probe-pool.mjs
 */
import { Client } from '@stellar/stellar-sdk/contract'
import { Server } from '@stellar/stellar-sdk/rpc'

const RPC_URL = 'https://soroban-testnet.stellar.org'
const PASSPHRASE = 'Test SDF Network ; September 2015'
const FACTORY = 'CDP3HMUH6SMS3S7NPGNDJLULCOXXEPSHY4JKUKMBNQMATHDHWXRRJTBY'
const ROUTER = 'CCJUD55AG6W5HAI5LRVNKAE5WDP5XGZBUDS5WNTIVDU7O264UZZE7BRD'
const XLM_SAC = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC'
const ASTRO = 'CAI637WCEILQF3ZYOV6BRUCX532XQIVOOJ4CRWFPWHQRJHOH5OKHSXRE'
const DECIMALS = 7

const server = new Server(RPC_URL)

async function clientFor(contractId) {
  const instance = await server.getContractInstance(contractId)
  return Client.fromWasmHash(instance.executable.wasmHash.toString('hex'), {
    contractId,
    rpcUrl: RPC_URL,
    networkPassphrase: PASSPHRASE,
  })
}

const factory = await clientFor(FACTORY)
const router = await clientFor(ROUTER)

const exists = (await factory.pair_exists({ token_a: ASTRO, token_b: XLM_SAC }))
  .result
if (exists.isErr()) {
  console.error('pair_exists:', exists.unwrapErr().message)
  process.exit(1)
}
if (!exists.unwrap()) {
  console.log('el par ASTRO/XLM no existe todavia')
  process.exit(0)
}

const pair = (await factory.get_pair({ token_a: ASTRO, token_b: XLM_SAC })).result
const [token0] = (
  await router.sort_tokens({ token_a: ASTRO, token_b: XLM_SAC })
).result.unwrap()
const [r0, r1] = (
  await router.get_reserves({
    factory: FACTORY,
    token_a: ASTRO,
    token_b: XLM_SAC,
  })
).result.unwrap()

const reserveToken = token0 === ASTRO ? r0 : r1
const reserveXlm = token0 === ASTRO ? r1 : r0

console.log('par      :', pair.unwrap())
console.log(
  'reservas :',
  reserveToken.toString(),
  'token /',
  reserveXlm.toString(),
  'XLM',
)

const amountIn = 10n ** BigInt(DECIMALS)
const real = (await router.router_get_amount_out({
  amount_in: amountIn,
  reserve_in: reserveToken,
  reserve_out: reserveXlm,
})).result
const broken = (await router.router_get_amounts_out({
  amount_in: amountIn,
  path: [ASTRO, XLM_SAC],
})).result

console.log('router_get_amount_out  :', real.isErr() ? 'ERR' : real.unwrap())
console.log(
  'router_get_amounts_out :',
  broken.isErr() ? 'ERR' : broken.unwrap()[0],
  '(devuelve el input: no sirve para cotizar)',
)
