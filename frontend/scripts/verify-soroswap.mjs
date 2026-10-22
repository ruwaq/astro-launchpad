/**
 * Smoke test E2E de la integración Soroswap — testnet real, sin mocks.
 *
 * Depliega una instancia nueva del token del launchpad, aprueba ambos lados,
 * crea el par token/XLM en la factory, añade liquidez vía router, cotiza el
 * swap con las reservas reales y lo ejecuta. Verifica por reservas on-chain,
 * calibrando el orden (token_0/token_1) con los montos aportados.
 *
 * Uso (el mismo camino que la UI): STELLAR_SECRET=S... npm run verify:soroswap
 */
import { Address, Keypair, Operation, TransactionBuilder, nativeToScVal } from '@stellar/stellar-sdk'
import { Client, KeypairSigner } from '@stellar/stellar-sdk/contract'
import { Server } from '@stellar/stellar-sdk/rpc'

const RPC_URL = 'https://soroban-testnet.stellar.org'
const PASSPHRASE = 'Test SDF Network ; September 2015'
const FACTORY = 'CDP3HMUH6SMS3S7NPGNDJLULCOXXEPSHY4JKUKMBNQMATHDHWXRRJTBY'
const ROUTER = 'CCJUD55AG6W5HAI5LRVNKAE5WDP5XGZBUDS5WNTIVDU7O264UZZE7BRD'
const XLM_SAC = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC'
const WASM_HASH = '438d12a79855dd42c353d12bb42e6b57ed513eed47b7008094683ba33f971286'

const DECIMALS = 7
const APPROVAL_WINDOW = 60

const secret = process.env.STELLAR_SECRET
if (!secret) {
  console.error('Falta STELLAR_SECRET')
  process.exit(1)
}

const keypair = Keypair.fromSecret(secret)
const publicKey = keypair.publicKey()
const signer = new KeypairSigner(keypair, PASSPHRASE)
const server = new Server(RPC_URL)

async function clientFor(contractId) {
  const instance = await server.getContractInstance(contractId)
  const hash = instance.executable.wasmHash.toString('hex')
  return Client.fromWasmHash(hash, {
    contractId,
    rpcUrl: RPC_URL,
    networkPassphrase: PASSPHRASE,
    publicKey,
    signTransaction: signer,
  })
}

function unwrap(result, what) {
  const isResult =
    result && typeof result === 'object' && 'isErr' in result && typeof result.isErr === 'function'
  if (!isResult) return result
  if (result.isErr()) {
    throw new Error(`${what}: ${JSON.stringify(result.unwrapErr())}`)
  }
  return result.unwrap()
}

async function send(tx, what) {
  const sent = await tx.signAndSend()
  return unwrap(sent.result, what)
}

async function ledger() {
  return (await server.getLatestLedger()).sequence
}

console.log('cuenta:', publicKey)

// 0. Instancia nueva del token (mismo camino que usa el frontend).
const initialSupply = 1_000_000n * 10n ** BigInt(DECIMALS)
const deployTx = await Client.deploy(
  {
    name: `Soroswap Verify ${Date.now()}`,
    symbol: 'SWRV',
    decimals: DECIMALS,
    owner: publicKey,
    initial_supply: initialSupply,
  },
  {
    wasmHash: WASM_HASH,
    rpcUrl: RPC_URL,
    networkPassphrase: PASSPHRASE,
    publicKey,
    address: publicKey,
    signTransaction: signer,
  },
)
const { result: deployResult } = await deployTx.signAndSend()
const TOKEN = deployResult.options.contractId
console.log('token desplegado:', TOKEN)
const token = await clientFor(TOKEN)
const factory = await clientFor(FACTORY)
const router = await clientFor(ROUTER)

// 1. Allowances (token total + XLM) hacia el router — idempotente y valida
//    también el camino con allowance para AMM futuros (p. ej. V3).
const currentLedger = await ledger()
const amountToken = 10n * 10n ** BigInt(DECIMALS) // 10 tokens
const amountXlm = 5n * 10n ** BigInt(DECIMALS) // 5 XLM
const amountSwap = 1n * 10n ** BigInt(DECIMALS) // 1 token

console.log('aprobar token (10 + 1)…')
await send(
  await token.approve({
    owner: publicKey,
    spender: ROUTER,
    amount: amountToken + amountSwap,
    live_until_ledger: currentLedger + APPROVAL_WINDOW,
  }),
  'approve token',
)

console.log('aprobar XLM (5)…')
{
  const account = await server.getAccount(publicKey)
  const approveOp = Operation.invokeContractFunction({
    contract: XLM_SAC,
    function: 'approve',
    args: [
      Address.fromString(publicKey).toScVal(),
      Address.fromString(ROUTER).toScVal(),
      nativeToScVal(amountXlm, { type: 'i128' }),
      nativeToScVal(currentLedger + APPROVAL_WINDOW, { type: 'u32' }),
    ],
  })
  const tx = new TransactionBuilder(account, { fee: '1000000', networkPassphrase: PASSPHRASE })
    .addOperation(approveOp)
    .setTimeout(60)
    .build()
  const prepared = await server.prepareTransaction(tx)
  prepared.sign(keypair)
  const sent = await server.sendTransaction(prepared)
  let status = 'NOT_FOUND'
  for (let i = 0; i < 20 && (status === 'NOT_FOUND' || status === 'PENDING'); i++) {
    await new Promise((resolve) => setTimeout(resolve, 1500))
    status = (await server.getTransaction(sent.hash)).status
  }
  if (status !== 'SUCCESS') throw new Error(`approve XLM no se aplicó (status=${status})`)
  console.log('XLM aprobado para el router ✓')
}

// 2. Par token/XLM en la factory (el par se registra en la ledger siguiente).
const exists = unwrap(
  (await factory.pair_exists({ token_a: TOKEN, token_b: XLM_SAC })).result,
  'pair_exists',
)
if (!exists) {
  await send(await factory.create_pair({ token_a: TOKEN, token_b: XLM_SAC }), 'create_pair')
  for (let i = 0; i < 10; i++) {
    const check = unwrap(
      (await factory.pair_exists({ token_a: TOKEN, token_b: XLM_SAC })).result,
      'pair_exists',
    )
    if (check === true) break
    await new Promise((resolve) => setTimeout(resolve, 2000))
  }
}
const pair = unwrap((await factory.get_pair({ token_a: TOKEN, token_b: XLM_SAC })).result, 'get_pair')
console.log('par:', pair)

/** Reservas vía router: [x, y] con orientación interna sin garantizar. */
async function reserves() {
  return unwrap(
    (await router.get_reserves({ factory: FACTORY, token_a: TOKEN, token_b: XLM_SAC })).result,
    'get_reserves',
  )
}

// 3. Añadir liquidez (el router mueve con transfer cubierto por la firma).
await send(
  await router.add_liquidity({
    token_a: TOKEN,
    token_b: XLM_SAC,
    amount_a_desired: amountToken,
    amount_b_desired: amountXlm,
    amount_a_min: amountToken,
    amount_b_min: amountXlm,
    to: publicKey,
    deadline: BigInt(Math.floor(Date.now() / 1000) + 300),
  }),
  'add_liquidity',
)
const after = await reserves()

// 4. Calibrar orientación con los montos aportados (conocidos por diseño).
const forward = after[0] === amountToken && after[1] === amountXlm
const reversed = after[1] === amountToken && after[0] === amountXlm
if (!forward && !reversed) {
  throw new Error(`reservas inesperadas: ${after.map((r) => r.toString()).join(' / ')}`)
}
const tokenFirst = forward
console.log(
  'reservas tras addToLiquidez: token =',
  (tokenFirst ? after[0] : after[1]).toString(),
  '· xlm =',
  (tokenFirst ? after[1] : after[0]).toString(),
)

// 5. Cotizar el swap con las reservas reales y ejecutarlo.
const reserveToken = tokenFirst ? after[0] : after[1]
const reserveXlm = tokenFirst ? after[1] : after[0]
const quote = unwrap(
  (
    await router.router_get_amount_out({
      amount_in: amountSwap,
      reserve_in: reserveToken,
      reserve_out: reserveXlm,
    })
  ).result,
  'router_get_amount_out',
)
console.log(`cotización 1 TOKEN -> ${quote.toString()} stroops XLM`)

const swapResult = await send(
  await router.swap_exact_tokens_for_tokens({
    amount_in: amountSwap,
    amount_out_min: (quote * 98n) / 100n, // 2 % de slippage
    path: [TOKEN, XLM_SAC],
    to: publicKey,
    deadline: BigInt(Math.floor(Date.now() / 1000) + 300),
  }),
  'swap_exact_tokens_for_tokens',
)
const outXlm = Array.isArray(swapResult) ? swapResult[1] : quote
console.log('tokens recibidos en el swap:', amountSwap.toString(), '->', outXlm.toString())

// 6. Verificación final por datos on-chain.
const final = await reserves()
const finalToken = tokenFirst ? final[0] : final[1]
const finalXlm = tokenFirst ? final[1] : final[0]
const balance = unwrap((await token.balance({ account: publicKey })).result, 'balance')
console.log(
  'reservas finales: token =',
  finalToken.toString(),
  '· xlm =',
  finalXlm.toString(),
  '· balance token:',
  balance.toString(),
)

const ok =
  finalToken === reserveToken + amountSwap &&
  finalXlm === reserveXlm - outXlm &&
  balance === initialSupply - amountToken - amountSwap

console.log(ok ? 'OK: par + liquidez + swap verificados on-chain' : 'FALLO: los datos no cuadran')
process.exit(ok ? 0 : 1)
