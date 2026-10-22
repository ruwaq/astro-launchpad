/**
 * Smoke test de render: monta el árbol de componentes y lo serializa con
 * `react-dom/server`. No hace falta navegador (no hay ninguno disponible en
 * el entorno) y sirve para detectar errores de render en la UI.
 *
 * La wallet se sustituye por un stub: `@creit.tech/stellar-wallets-kit` solo
 * funciona en navegador y aquí solo queremos pintar el árbol.
 *
 * Uso: npm run smoke:render
 */
import { createServer } from 'vite'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fileURLToPath } from 'node:url'

/**
 * La wallet se sustituye por un stub: `@creit.tech/stellar-wallets-kit` solo
 * funciona en navegador y aquí solo queremos pintar el árbol.
 */
const walletsKitStub = fileURLToPath(
  new URL('./fixtures/wallets-kit-stub.ts', import.meta.url),
)

const vite = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
  resolve: {
    alias: [
      {
        find: /^@creit\.tech\/stellar-wallets-kit(\/.*)?$/,
        replacement: walletsKitStub,
      },
    ],
  },
})

let failed = false
try {
  const { default: App } = await vite.ssrLoadModule('/src/App.tsx')

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, enabled: false } },
  })
  const html = renderToString(
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(App),
    ),
  )

  const checks = ['Floodgate', 'Mercado', 'Crea tu token', 'Swap a XLM']
  for (const text of checks) {
    if (!html.includes(text)) {
      throw new Error(`el render no contiene "${text}"`)
    }
  }

  // El panel de liquidez solo aparece tras crear un token: se monta aparte.
  const { LiquidityForm } = await vite.ssrLoadModule(
    '/src/components/LiquidityForm.tsx',
  )
  const liquidityHtml = renderToString(
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(LiquidityForm, {
        token: { id: 'CTOKEN', decimals: 7 },
      }),
    ),
  )
  if (!liquidityHtml.includes('Añade liquidez')) {
    throw new Error('el render de LiquidityForm no contiene "Añade liquidez"')
  }

  // Detección de wallet: ambas ramas (detectada / por instalar), con datos
  // deterministas porque los effects no corren en SSR.
  const { WalletInstallHint } = await vite.ssrLoadModule(
    '/src/components/WalletInstallHint.tsx',
  )
  const walletFound = renderToString(
    createElement(WalletInstallHint, { preview: 'found' }),
  )
  if (!walletFound.includes('Wallet detectada')) {
    throw new Error('el hint de wallet no muestra la detección')
  }
  const walletMissing = renderToString(
    createElement(WalletInstallHint, { preview: 'missing' }),
  )
  if (!walletMissing.includes('Descargar') || !walletMissing.includes('Freighter')) {
    throw new Error('el hint de wallet no muestra las tarjetas de descarga')
  }

  // Guía paso a paso: expandida (bienvenida) y tira compacta, con estados
  // de preview porque localStorage no existe en SSR.
  const { Onboarding } = await vite.ssrLoadModule('/src/components/Onboarding.tsx')
  const stepsProps = { created: false, liquidity: false, swapped: false }
  const guideOpen = renderToString(
    createElement(Onboarding, { ...stepsProps, preview: 'open' }),
  )
  if (!guideOpen.includes('Bienvenido a Floodgate') || !guideOpen.includes('Conecta tu wallet')) {
    throw new Error('la guía no muestra la bienvenida con los pasos')
  }
  const guideMini = renderToString(
    createElement(Onboarding, { ...stepsProps, preview: 'collapsed' }),
  )
  if (!guideMini.includes('siguiente:')) {
    throw new Error('la guía no muestra la tira de progreso')
  }

  // Arte generativo: spec variado por contrato + SVG renderizado.
  const { tokenArtSpec } = await vite.ssrLoadModule('/src/lib/art.ts')
  const specA = tokenArtSpec('CBASE1000')
  const specB = tokenArtSpec('COTRO2000')
  if (
    specA.seed === specB.seed ||
    specA.from === specA.to ||
    specA.shapes.length !== 3 ||
    specB.shapes.length !== 3
  ) {
    throw new Error('el spec del arte no es válido o determinista por hash')
  }
  if (tokenArtSpec('CBASE1000').seed !== specA.seed) {
    throw new Error('el arte no es determinista para el mismo contrato')
  }
  const { TokenArt } = await vite.ssrLoadModule('/src/components/TokenArt.tsx')
  const artHtml = renderToString(
    createElement(TokenArt, { id: 'CBASE1000', symbol: 'MOON' }),
  )
  if (!artHtml.includes('MOON') || !artHtml.includes('linearGradient')) {
    throw new Error('el SVG del arte no renderiza el monograma')
  }

  console.log(
    `render OK (${html.length} + ${liquidityHtml.length} + ${walletFound.length} + ${walletMissing.length} + ${guideOpen.length} + ${guideMini.length} + ${artHtml.length} chars) · ${checks.length + 7} secciones`,
  )
} catch (err) {
  failed = true
  console.error('FALLO:', err?.stack?.slice(0, 1200) ?? err)
} finally {
  await vite.close()
}

process.exit(failed ? 1 : 0)
