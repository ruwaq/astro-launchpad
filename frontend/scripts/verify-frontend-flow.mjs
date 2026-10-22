/**
 * Prueba de integración del camino real del frontend contra testnet.
 *
 * Carga `src/lib/soroswap.ts` con Vite (el mismo módulo que usa la UI) y
 * ejecuta: estado del par -> cotización -> swap -> añadir liquidez.
 * Cada paso se comprueba contra el estado on-chain.
 *
 * Uso: STELLAR_SECRET=S... npm run verify:frontend
 */
import { createServer } from 'vite'
import { Keypair } from '@stellar/stellar-sdk'
import { KeypairSigner } from '@stellar/stellar-sdk/contract'

const PASSPHRASE = 'Test SDF Network ; September 2015'
const ASTRO = 'CAI637WCEILQF3ZYOV6BRUCX532XQIVOOJ4CRWFPWHQRJHOH5OKHSXRE'
const DECIMALS = 7

const secret = process.env.STELLAR_SECRET
if (!secret) {
  console.error('Falta STELLAR_SECRET')
  process.exit(1)
}

const keypair = Keypair.fromSecret(secret)
const signer = new KeypairSigner(keypair, PASSPHRASE)
console.log('cuenta:', keypair.publicKey())

const vite = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
})

let failed = false

try {
  const soroswap = await vite.ssrLoadModule('/src/lib/soroswap.ts')
  const tokenLib = await vite.ssrLoadModule('/src/lib/token.ts')

  // 1. Estado del par (lectura).
  const pool = await soroswap.fetchPoolState(ASTRO)
  console.log('par:', pool.pairId, '| existe:', pool.exists)
  console.log(
    'reservas:',
    pool.reserveToken.toString(),
    'token /',
    pool.reserveXlm.toString(),
    'XLM',
  )
  if (!pool.exists) throw new Error('el par ASTRO/XLM no existe')
  if (pool.reserveToken <= 0n || pool.reserveXlm <= 0n) {
    throw new Error('el par no tiene reservas')
  }

  // 2. Cotizacion.
  const amountIn = 10n ** BigInt(DECIMALS) // 1 ASTRO
  const quote = await soroswap.quoteTokenForXlm(amountIn, pool)
  console.log('cotizacion 1 ASTRO ->', quote.toString(), 'XLM (base units)')
  if (quote <= 0n) throw new Error('la cotizacion es 0')

  // 3. Swap con slippage del 2 %.
  const minOut = soroswap.withSlippage(quote)
  const amounts = await soroswap.swapTokenForXlm({
    tokenId: ASTRO,
    amountIn,
    amountOutMin: minOut,
    signer,
  })
  console.log('swap -> in:', amounts[0]?.toString(), 'out:', amounts[1]?.toString())
  if (!amounts[1] || amounts[1] < minOut) {
    throw new Error('la salida del swap es menor que el minimo')
  }

  const poolAfterSwap = await soroswap.fetchPoolState(ASTRO)
  if (poolAfterSwap.reserveToken === pool.reserveToken) {
    throw new Error('las reservas no cambiaron tras el swap')
  }
  console.log(
    'reservas tras el swap:',
    poolAfterSwap.reserveToken.toString(),
    '/',
    poolAfterSwap.reserveXlm.toString(),
  )

  // 4. Anadir liquidez en proporcion con el pool (10 % de cada reserva).
  const addToken = poolAfterSwap.reserveToken / 10n
  const addXlm = poolAfterSwap.reserveXlm / 10n
  const lp = await soroswap.addLiquidity({
    tokenId: ASTRO,
    amountToken: addToken,
    amountXlm: addXlm,
    signer,
  })
  console.log(
    'liquidez:',
    lp.tokenAmount.toString(),
    'token /',
    lp.xlmAmount.toString(),
    'XLM / LP',
    lp.lpAmount.toString(),
  )
  if (lp.lpAmount <= 0n) throw new Error('no se mintearon tokens LP')

  const poolAfterLp = await soroswap.fetchPoolState(ASTRO)
  if (poolAfterLp.reserveToken <= poolAfterSwap.reserveToken) {
    throw new Error('las reservas no grew')
  }
  console.log(
    'reservas finales:',
    poolAfterLp.reserveToken.toString(),
    '/',
    poolAfterLp.reserveXlm.toString(),
  )

  // 5. Camino completo de un token nuevo: desplegar -> par -> liquidez -> swap.
  const token = await tokenLib.deployToken({
    name: `Flow ${Date.now()}`,
    symbol: 'FLOW',
    decimals: DECIMALS,
    initialSupply: 1000n * 10n ** BigInt(DECIMALS),
    signer,
  })
  console.log('\ntoken nuevo:', token)

  const freshPool = await soroswap.fetchPoolState(token)
  if (freshPool.exists) throw new Error('el token nuevo ya tenia par')
  console.log('sin par todavia: OK')

  const newLp = await soroswap.addLiquidity({
    tokenId: token,
    amountToken: 100n * 10n ** BigInt(DECIMALS),
    amountXlm: 10n * 10n ** BigInt(DECIMALS),
    signer,
  })
  console.log(
    'liquidez del par nuevo:',
    newLp.tokenAmount.toString(),
    'token /',
    newLp.xlmAmount.toString(),
    'XLM / par',
    newLp.pair,
  )

  const newPool = await soroswap.fetchPoolState(token)
  if (!newPool.exists) throw new Error('el par nuevo no se creo')
  const newQuote = await soroswap.quoteTokenForXlm(
    10n ** BigInt(DECIMALS),
    newPool,
  )
  console.log('cotizacion 1 token ->', newQuote.toString(), 'XLM (base units)')
  if (newQuote <= 0n) throw new Error('la cotizacion del par nuevo es 0')

  const newSwap = await soroswap.swapTokenForXlm({
    tokenId: token,
    amountIn: 10n ** BigInt(DECIMALS),
    amountOutMin: soroswap.withSlippage(newQuote),
    signer,
  })
  console.log('swap del par nuevo -> out:', newSwap[1]?.toString())

  console.log('\nOK: pool + cotizacion + swap + liquidez (mismo codigo que la UI)')
  console.log('OK: token nuevo -> par -> liquidez -> swap')
} catch (err) {
  failed = true
  console.error('\nFALLO:', err?.message ?? err)
} finally {
  await vite.close()
}

process.exit(failed ? 1 : 0)
