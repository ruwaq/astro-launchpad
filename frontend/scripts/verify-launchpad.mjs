/**
 * Smoke test del flujo del launchpad contra testnet.
 *
 * Usa exactamente el camino que usa el frontend: `Client.deploy` con el wasm
 * hash ya subido a la red, firma con una clave y lectura del token creado.
 * Comprueba además que los bindings generados en `src/contracts`_embeden el
 * mismo spec que el wasm on-chain.
 *
 * Uso: STELLAR_SECRET=S... npm run verify:launchpad
 */
import { readFileSync } from 'node:fs'
import { Client, KeypairSigner, Spec } from '@stellar/stellar-sdk/contract'
import { Keypair } from '@stellar/stellar-sdk'

const RPC_URL = 'https://soroban-testnet.stellar.org'
const PASSPHRASE = 'Test SDF Network ; September 2015'
const WASM_HASH = 'a47dc064f7a072476fbbd612be98ce13d691b178b81a40ebdf4b2ec78f65c9f7'
const LAUNCHPAD_CONTRACT_ID = 'CB5LMSJ2Y2KEZEO2BXTRNA2OPFALVU6AVIOASVPZTQ66GRT3UEKOQ3O4'

const secret = process.env.STELLAR_SECRET
if (!secret) {
  console.error('Falta STELLAR_SECRET')
  process.exit(1)
}

const keypair = Keypair.fromSecret(secret)
const publicKey = keypair.publicKey()
const signer = new KeypairSigner(keypair, PASSPHRASE)

console.log('cuenta:', publicKey)

// 1. Spec on-chain vs spec embebido en los bindings generados.
const client = await Client.fromWasmHash(WASM_HASH, {
  rpcUrl: RPC_URL,
  networkPassphrase: PASSPHRASE,
  publicKey,
  signTransaction: signer,
})
const onChainSpec = JSON.stringify(client.spec.funcs().map((f) => f.name.toString()))

const generated = readFileSync(new URL('../src/contracts/client.ts', import.meta.url), 'utf8')
const specLiteral = generated.match(/new Spec\((\[[\s\S]*?\])\)/)
if (!specLiteral) {
  console.error('No se encontró el spec embebido en src/contracts/client.ts')
  process.exit(1)
}
const embeddedSpec = new Spec(new Function(`return ${specLiteral[1]}`)())
const embeddedFns = JSON.stringify(embeddedSpec.funcs().map((f) => f.name.toString()))
console.log('spec on-chain  :', onChainSpec === embeddedFns ? 'OK (igual al embebido)' : 'DIFIERE')
if (onChainSpec !== embeddedFns) {
  console.log('  on-chain :', onChainSpec)
  console.log('  embebido :', embeddedFns)
  process.exit(1)
}

// 2. Los args del constructor deben mapear a ScVal con el spec embebido.
const args = {
  name: 'Smoke Test',
  symbol: 'SMOKE',
  decimals: 7,
  owner: publicKey,
  initial_supply: 1000000n,
}
embeddedSpec.funcArgsToScVals('__constructor', args)
console.log('args del constructor: OK')

// 3. Desplegar una instancia nueva (mismo camino que el frontend).
const name = `Smoke ${Date.now()}`
const tx = await Client.deploy(
  { ...args, name },
  {
    wasmHash: WASM_HASH,
    rpcUrl: RPC_URL,
    networkPassphrase: PASSPHRASE,
    publicKey,
    address: publicKey,
    signTransaction: signer,
  },
)
const { result } = await tx.signAndSend()
const contractId = result.options.contractId
console.log('contrato creado:', contractId)

// 4. Leerlo de vuelta on-chain.
const created = await Client.fromWasmHash(WASM_HASH, {
  contractId,
  rpcUrl: RPC_URL,
  networkPassphrase: PASSPHRASE,
  publicKey,
  signTransaction: signer,
})
const readName = (await created.name()).result
const readSymbol = (await created.symbol()).result
const readDecimals = (await created.decimals()).result
const readSupply = (await created.total_supply()).result
const readBalance = (await created.balance({ account: publicKey })).result

console.log('nombre  :', readName)
console.log('símbolo :', readSymbol)
console.log('decimales:', readDecimals)
console.log('supply  :', readSupply.toString())
console.log('balance :', readBalance.toString())

const ok =
  readName === name && readSymbol === 'SMOKE' && readDecimals === 7 && readSupply === 1000000n
console.log(ok ? 'OK: token creado y legible on-chain' : 'FALLO: datos inesperados')

// 5. Spec & lectura en vivo del contrato Launchpad v2
const lpClient = await Client.from({
  contractId: LAUNCHPAD_CONTRACT_ID,
  rpcUrl: RPC_URL,
  networkPassphrase: PASSPHRASE,
  publicKey,
})
const lpOnChainSpec = JSON.stringify(lpClient.spec.funcs().map((f) => f.name.toString()))
const lpGenerated = readFileSync(new URL('../src/contracts/launchpad/client.ts', import.meta.url), 'utf8')
const lpSpecLiteral = lpGenerated.match(/new Spec\((\[[\s\S]*?\])\)/)
if (!lpSpecLiteral) {
  console.error('No se encontró el spec embebido en src/contracts/launchpad/client.ts')
  process.exit(1)
}
const lpEmbeddedSpec = new Spec(new Function(`return ${lpSpecLiteral[1]}`)())
const lpEmbeddedFns = JSON.stringify(lpEmbeddedSpec.funcs().map((f) => f.name.toString()))
const lpSpecMatch = lpOnChainSpec === lpEmbeddedFns
console.log('launchpad spec  :', lpSpecMatch ? 'OK (igual al embebido)' : 'DIFIERE')
const launchCount = (await lpClient.get_launch_count()).result
console.log('launch count    :', launchCount)

const allOk = ok && lpSpecMatch && typeof launchCount === 'number'
process.exit(allOk ? 0 : 1)
