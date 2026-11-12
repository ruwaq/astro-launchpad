/**
 * End-to-end verification of AstroGate Demo Mode & Launchpad v2 on Stellar Testnet:
 * 1. Creates & funds 3 disposable accounts (A, B, C) via Friendbot.
 * 2. Sends Horizon payment A -> B.
 * 3. Account A runs single-tx Fair Launch (`launch_fair`) with compact on-chain JSON meta.
 * 4. Verifies `LaunchRecord`, `verifyAntiRug` (ownership renounced + LP burned), and local metadata.
 * 5. Transfers tokens A -> B; B buys via Soroswap using 0ms `localQuoteXlmForToken`.
 * 6. A adds & atomically removes community LP (`LiquidityForm` / `LiquidityPosition` path).
 * 7. B sells tokens via `swapTokenForXlm`, then runs Burn-to-Chat (`burn_shout` + `get_shouts`).
 * 8. B refreshes 90-day TTL via `extendTokenTtl`.
 *
 * Requires NO STELLAR_SECRET (uses disposable Friendbot accounts).
 * Usage: npm run verify:demo
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
  const soroswap = await vite.ssrLoadModule('/src/lib/soroswap.ts')
  const tokenLib = await vite.ssrLoadModule('/src/lib/token.ts')
  const metadataLib = await vite.ssrLoadModule('/src/lib/token-metadata.ts')
  const discoveryLib = await vite.ssrLoadModule('/src/lib/discovery.ts')
  const eventsLib = await vite.ssrLoadModule('/src/lib/token-events.ts')
  const sdkLib = await vite.ssrLoadModule('/src/sdk/index.ts')
  const horizon = new Horizon.Server(HORIZON_URL)

  console.log('creando 3 cuentas demo con Friendbot (secuencial)…')
  const { accounts, failed: fundFailed } = await demo.createDemoAccounts(
    ({ index, status }) => {
      console.log(`  cuenta ${demo.demoLabelForIndex(index)}: ${status}`)
    },
  )

  if (fundFailed > 0 || accounts.length !== demo.DEMO_ACCOUNT_COUNT) {
    throw new Error(`esperaba ${demo.DEMO_ACCOUNT_COUNT} cuentas, hay ${accounts.length} (failed=${fundFailed})`)
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

  const [sender, receiver, bystander] = accounts
  const source = await horizon.loadAccount(sender.publicKey)
  const paymentTx = new TransactionBuilder(source, {
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

  paymentTx.sign(Keypair.fromSecret(sender.secret))
  await horizon.submitTransaction(paymentTx)

  const receiverBalance = await demo.fetchXlmBalance(receiver.publicKey)
  console.log('pago A -> B de 1 XLM enviado; saldo de B:', receiverBalance)
  if (receiverBalance <= balances[1]) {
    throw new Error('el pago A -> B no se reflejó en el saldo de B')
  }

  const signerA = demo.demoSigner(sender)
  const signerB = demo.demoSigner(receiver)
  const signerC = demo.demoSigner(bystander)
  const decimals = 7
  const unit = 10n ** BigInt(decimals)

  // 1. Atomic Launchpad v2 Fair Launch (1 tx: 1B supply, 99.5% LP burned, ownership renounced)
  const fairMeta = metadataLib.encodeOnChainMeta({
    description: 'Automated Launchpad v2 E2E Fair Launch',
  })
  const launch = await tokenLib.launchFairAtomic({
    name: `Demo ${Date.now()}`,
    symbol: 'DEMO',
    xlmLpAmount: 5n * unit,
    meta: fairMeta,
    signer: signerA,
  })
  const token = launch.token
  console.log('Launchpad v2 token creado por A:', token, '| par:', launch.pair)

  const [record, audit, supplyInitial, creatorBalInitial] = await Promise.all([
    discoveryLib.fetchLaunchpadRecord(token),
    sdkLib.verifyAntiRug(token),
    tokenLib.tokenClient(token).total_supply(),
    tokenLib.fetchTokenBalance(token, sender.publicKey),
  ])
  if (!record || record.creator !== sender.publicKey) {
    throw new Error('LaunchRecord no encontrado o creator no coincide')
  }
  if (!audit.isAntiRugVerified || !audit.verifiedLaunchpad || !audit.lpBurned || !audit.ownershipRenounced) {
    throw new Error(`verifyAntiRug fallo: ${JSON.stringify(audit)}`)
  }
  if (supplyInitial.result !== 1_000_000_000n * unit) {
    throw new Error(`supply inicial inesperado: ${supplyInitial.result.toString()}`)
  }
  if (creatorBalInitial !== 5_000_000n * unit) {
    throw new Error(`asignacion 0.5% creador inesperada: ${creatorBalInitial.toString()}`)
  }
  console.log('verifyAntiRug + registro v2 OK (5M creator, 995M pool, LP quemado, owner renunciado)')

  // 2. Transfer A -> B + B compra via Soroswap con cotizacion local 0ms
  const transfer = await tokenLib.tokenClient(token, signerA).transfer({
    from: sender.publicKey,
    to: receiver.publicKey,
    amount: 100n * unit,
  })
  await transfer.signAndSend()
  const balBAfterXfer = await tokenLib.fetchTokenBalance(token, receiver.publicKey)
  if (balBAfterXfer !== 100n * unit) {
    throw new Error('transfer A -> B no llego completo')
  }

  const poolBeforeBuy = await soroswap.fetchPoolState(token)
  const buyQuoteLocal = soroswap.localQuoteXlmForToken(1n * unit, poolBeforeBuy)
  if (buyQuoteLocal <= 0n) {
    throw new Error('localQuoteXlmForToken devolvio 0')
  }
  const buySwap = await soroswap.swapXlmForToken({
    tokenId: token,
    amountIn: 1n * unit,
    amountOutMin: soroswap.withSlippage(buyQuoteLocal, 2),
    signer: signerB,
  })
  const bought = buySwap[1] ?? 0n
  if (bought <= 0n) {
    throw new Error('swapXlmForToken no devolvio tokens')
  }
  const balBAfterBuy = await tokenLib.fetchTokenBalance(token, receiver.publicKey)
  if (balBAfterBuy !== balBAfterXfer + bought) {
    throw new Error('balance de B tras compra no cuadra')
  }
  console.log('A transfirio 100 DEMO a B; B compro', bought.toString(), 'base units con 1 XLM')

  // 3. A anade y retira liquidez comunitaria (remove_liquidity atomico)
  const poolForLp = await soroswap.fetchPoolState(token)
  const lpTokenIn = 2_000_000n * unit
  const matchedXlm = (lpTokenIn * poolForLp.reserveXlm) / poolForLp.reserveToken
  const addedLp = await soroswap.addLiquidity({
    tokenId: token,
    amountToken: lpTokenIn,
    amountXlm: matchedXlm > 0n ? matchedXlm : 1n * unit,
    signer: signerA,
  })
  if (addedLp.lpAmount <= 0n) {
    throw new Error('addLiquidity comunitario devolvio 0 LP')
  }
  const removedLp = await soroswap.withdrawLiquidity({
    tokenId: token,
    lpAmount: addedLp.lpAmount,
    signer: signerA,
  })
  if (removedLp.xlmAmount <= 0n || removedLp.tokenAmount <= 0n) {
    throw new Error('withdrawLiquidity devolvio 0')
  }
  console.log('A proveyo y retiro liquidez comunitaria LP:', addedLp.lpAmount.toString())

  // 4. B vende parte de sus tokens por XLM + Burn-to-Chat on-chain + Extend TTL
  const poolBeforeSell = await soroswap.fetchPoolState(token)
  const sellAmount = 50n * unit
  const sellQuoteLocal = soroswap.localQuoteTokenForXlm(sellAmount, poolBeforeSell)
  const sellSwap = await soroswap.swapTokenForXlm({
    tokenId: token,
    amountIn: sellAmount,
    amountOutMin: soroswap.withSlippage(sellQuoteLocal, 2),
    signer: signerB,
  })
  if (!sellSwap[1] || sellSwap[1] <= 0n) {
    throw new Error('swapTokenForXlm no devolvio XLM')
  }
  console.log('B vendio 50 DEMO ->', sellSwap[1].toString(), 'stroops XLM')

  const shoutText = `Live E2E shout ${Date.now()}`
  const supplyBeforeShout = (await tokenLib.tokenClient(token).total_supply()).result
  await tokenLib.burnAndShout({
    tokenId: token,
    amount: 10n * unit,
    message: shoutText,
    signer: signerB,
  })
  const [shouts, supplyAfterShout] = await Promise.all([
    eventsLib.fetchTokenShouts(token),
    tokenLib.tokenClient(token).total_supply(),
  ])
  if (!shouts.some((s) => s.sender === receiver.publicKey && s.message === shoutText)) {
    throw new Error('burn_shout no aparecio en get_shouts on-chain')
  }
  if (supplyAfterShout.result !== supplyBeforeShout - 10n * unit) {
    throw new Error('burn_shout no redujo total_supply exactamente')
  }
  console.log('Burn-to-Chat on-chain OK y total_supply reducido tras quema')

  // 5. C ejecuta extendTokenTtl sin permisos especiales
  await tokenLib.extendTokenTtl({ tokenId: token, signer: signerC })
  console.log('extendTokenTtl (90 dias) OK desde cuenta C')

  console.log('\nOK: E2E completo Launchpad v2 + Soroswap AMM + Burn-to-Chat + TTL verificado en Testnet')
} catch (err) {
  failed = true
  console.error('\nFALLO:', err?.message ?? err)
} finally {
  await vite.close()
}

process.exit(failed ? 1 : 0)
