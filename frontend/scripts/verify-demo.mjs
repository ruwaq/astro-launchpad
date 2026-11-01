/**
 * Verificación del modo prueba: crea las 3 cuentas demo con Friendbot,
 * comprueba firmantes y saldos, paga A -> B y ejecuta el flujo multi-usuario:
 * A crea token + liquidez, transfiere tokens a B y B swapea a XLM.
 *
 * No necesita STELLAR_SECRET: las cuentas son nuevas y desechables. No imprime
 * semillas. Crea cuentas reales en testnet (gratis).
 *
 * Uso: npm run verify:demo
 */
import { createServer } from 'vite'
import {
  Asset,
  Horizon,
  Keypair,
  Networks,
  Operation,
  TransactionBuilder,
} from '@stellar/stellar-sdk'

const HORIZON_URL = 'https://horizon-testnet.stellar.org'

const vite = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
})

let failed = false

try {
  const demo = await vite.ssrLoadModule('/src/lib/demo.ts')
  const horizon = new Horizon.Server(HORIZON_URL)

  console.log('creando 3 cuentas demo con Friendbot (secuencial)…')
  const accounts = await demo.createDemoAccounts(
    ({ index, status }) => {
      // Solo etiqueta y estado: las semillas nunca se imprimen.
      console.log(`  cuenta ${demo.DEMO_LABELS[index]}: ${status}`)
    },
  )

  if (accounts.length !== demo.DEMO_ACCOUNT_COUNT) {
    throw new Error(`esperaba ${demo.DEMO_ACCOUNT_COUNT} cuentas, hay ${accounts.length}`)
  }

  for (const account of accounts) {
    if (!account.publicKey.startsWith('G') || !account.secret.startsWith('S')) {
      throw new Error(`cuenta ${account.label} con formato inválido`)
    }
    const signer = demo.demoSigner(account)
    if (signer.address !== account.publicKey) {
      throw new Error(`el firmante de ${account.label} no corresponde a su cuenta`)
    }
    console.log(`  ${account.label}: ${account.publicKey.slice(0, 8)}… firmante OK`)
  }

  const balances = await Promise.all(
    accounts.map((account) => demo.fetchXlmBalance(account.publicKey)),
  )
  console.log('saldos XLM:', balances)
  if (balances.some((balance) => balance <= 0)) {
    throw new Error('alguna cuenta demo no tiene XLM')
  }

  // Pago real A -> B con la semilla de la cuenta demo: el mismo camino que firma
  // la UI (KeypairSigner) pero con la SDK clásica de Horizon.
  const [sender, receiver] = accounts
  const source = await horizon.loadAccount(sender.publicKey)
  const tx = new TransactionBuilder(source, {
    fee: '100000',
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(
      Operation.payment({
        destination: receiver.publicKey,
        asset: Asset.native(),
        amount: '1',
      }),
    )
    .setTimeout(30)
    .build()

  tx.sign(Keypair.fromSecret(sender.secret))
  await horizon.submitTransaction(tx)

  const receiverBalance = await demo.fetchXlmBalance(receiver.publicKey)
  console.log('pago A -> B de 1 XLM enviado; saldo de B:', receiverBalance)
  if (receiverBalance <= balances[1]) {
    throw new Error('el pago A -> B no se reflejó en el saldo de B')
  }

  // Flujo multi-usuario real: A crea token + liquidez, pasa tokens a B y B
  // swapea. Es el mismo código que usan los componentes de la UI.
  const soroswap = await vite.ssrLoadModule('/src/lib/soroswap.ts')
  const tokenLib = await vite.ssrLoadModule('/src/lib/token.ts')
  const signerA = demo.demoSigner(sender)
  const signerB = demo.demoSigner(receiver)
  const decimals = 7
  const unit = 10n ** BigInt(decimals)

  const token = await tokenLib.deployToken({
    name: `Demo ${Date.now()}`,
    symbol: 'DEMO',
    decimals,
    initialSupply: 1000n * unit,
    signer: signerA,
  })
  console.log('token creado por A:', token)

  const lp = await soroswap.addLiquidity({
    tokenId: token,
    amountToken: 100n * unit,
    amountXlm: 10n * unit,
    signer: signerA,
  })
  console.log('liquidez de A: LP', lp.lpAmount.toString(), '| par', lp.pair)

  const transfer = await tokenLib
    .tokenClient(token, signerA)
    .transfer({
      from: sender.publicKey,
      to: receiver.publicKey,
      amount: 10n * unit,
    })
  await transfer.signAndSend()
  const balanceB = await tokenLib
    .tokenClient(token)
    .balance({ account: receiver.publicKey })
  console.log('B recibio', balanceB.result.toString(), 'base units del token de A')
  if (balanceB.result !== 10n * unit) {
    throw new Error('la transferencia A -> B no llego completa')
  }

  const pool = await soroswap.fetchPoolState(token)
  const quote = await soroswap.quoteTokenForXlm(5n * unit, pool)
  const swap = await soroswap.swapTokenForXlm({
    tokenId: token,
    amountIn: 5n * unit,
    amountOutMin: soroswap.withSlippage(quote),
    signer: signerB,
  })
  console.log('B swapeo 5 DEMO ->', swap[1]?.toString(), 'XLM (base units)')
  if (!swap[1] || swap[1] <= 0n) {
    throw new Error('el swap de B no devolvio XLM')
  }

  const balanceBAfterSwap = await tokenLib
    .tokenClient(token)
    .balance({ account: receiver.publicKey })
  if (balanceBAfterSwap.result !== 5n * unit) {
    throw new Error('el balance de B tras el swap no es el esperado')
  }

  // Emisión: solo el owner A puede mintear; C recibe 1 token.
  const mintTx = await tokenLib.tokenClient(token, signerA).mint({
    to: accounts[2].publicKey,
    amount: 1n * unit,
  })
  await mintTx.signAndSend()
  const balanceC = await tokenLib
    .tokenClient(token)
    .balance({ account: accounts[2].publicKey })
  console.log('C recibio', balanceC.result.toString(), 'base units (mint del owner)')
  if (balanceC.result !== 1n * unit) {
    throw new Error('el mint del owner no llego a C')
  }

  // Quema: B destruye 1 token propio y el supply baja exactamente.
  const supplyBeforeBurn = await tokenLib.tokenClient(token).total_supply()
  const burnTx = await tokenLib.tokenClient(token, signerB).burn({
    from: receiver.publicKey,
    amount: 1n * unit,
  })
  await burnTx.signAndSend()
  const [balanceBAfterBurn, supplyAfterBurn] = await Promise.all([
    tokenLib.tokenClient(token).balance({ account: receiver.publicKey }),
    tokenLib.tokenClient(token).total_supply(),
  ])
  console.log(
    'B quemo 1 DEMO; balance',
    balanceBAfterBurn.result.toString(),
    '| supply',
    supplyAfterBurn.result.toString(),
  )
  if (balanceBAfterBurn.result !== balanceBAfterSwap.result - 1n * unit) {
    throw new Error('el burn no desconto el balance de B')
  }
  if (supplyAfterBurn.result !== supplyBeforeBurn.result - 1n * unit) {
    throw new Error('el burn no desconto el supply total')
  }

  console.log('\nOK: 3 cuentas demo fondeadas, firmantes válidos y pago entre cuentas')
  console.log('OK: A crea token + liquidez -> transfiere a B -> B swapea')
  console.log('OK: owner A mintea a C -> B quema su token y baja el supply')
} catch (err) {
  failed = true
  console.error('\nFALLO:', err?.message ?? err)
} finally {
  await vite.close()
}

process.exit(failed ? 1 : 0)
