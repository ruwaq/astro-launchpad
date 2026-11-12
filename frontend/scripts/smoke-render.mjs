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
import { MemoryRouter } from 'react-router'
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

  function renderApp(path) {
    return renderToString(
      createElement(
        QueryClientProvider,
        { client: queryClient },
        createElement(
          MemoryRouter,
          { initialEntries: [path] },
          createElement(App),
        ),
      ),
    )
  }

  const html = renderApp('/')
  const checks = [
    'AstroGate',
    'Market',
    'Launch Token',
    'Single-Tx Atomic Deploy',
  ]
  for (const text of checks) {
    if (!html.includes(text)) {
      throw new Error(`el render no contiene "${text}"`)
    }
  }

  const createHtml = renderApp('/create')
  if (!createHtml.includes('Launch Your Token')) {
    throw new Error('la ruta /create no muestra el formulario de creación')
  }

  const marketHtml = renderApp('/market')
  if (
    !marketHtml.includes('Search by name') ||
    !marketHtml.includes('Sort by')
  ) {
    throw new Error('la ruta /market no muestra búsqueda y orden')
  }

  const portfolioHtml = renderApp('/portfolio')
  if (
    !portfolioHtml.includes('Your Portfolio') ||
    !portfolioHtml.includes('Recent Activity') ||
    !portfolioHtml.includes('No activity recorded yet')
  ) {
    throw new Error('la ruta /portfolio no renderiza su actividad vacía')
  }

  const tokenHtml = renderApp('/token/CTOKEN')
  if (!tokenHtml.includes('Reading token')) {
    throw new Error('la ruta /token/:id no renderiza su estado de carga')
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
  if (!liquidityHtml.includes('Add Liquidity')) {
    throw new Error('el render de LiquidityForm no contiene "Add Liquidity"')
  }

  // Swap terminal render
  const { SwapCard } = await vite.ssrLoadModule('/src/components/SwapCard.tsx')
  const swapHtml = renderToString(
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(SwapCard, {
        token: { id: 'CTOKEN', decimals: 7, symbol: 'TEST' },
      }),
    ),
  )
  if (!swapHtml.includes('Swap with XLM') || !swapHtml.includes('Buy with XLM')) {
    throw new Error('el render de SwapCard no contiene los controles de swap')
  }

  // Detección de wallet: ambas ramas (detectada / por instalar), con datos
  // deterministas porque los effects no corren en SSR.
  const { WalletInstallHint } = await vite.ssrLoadModule(
    '/src/components/WalletInstallHint.tsx',
  )
  const walletFound = renderToString(
    createElement(WalletInstallHint, { preview: 'found' }),
  )
  if (!walletFound.includes('Wallet detected')) {
    throw new Error('el hint de wallet no muestra la detección')
  }
  const walletMissing = renderToString(
    createElement(WalletInstallHint, { preview: 'missing' }),
  )
  if (!walletMissing.includes('Download') || !walletMissing.includes('Freighter')) {
    throw new Error('el hint de wallet no muestra las tarjetas de descarga')
  }

  // Guía paso a paso: expandida (bienvenida) y tira compacta, con estados
  // de preview porque localStorage no existe en SSR.
  const { Onboarding } = await vite.ssrLoadModule('/src/components/Onboarding.tsx')
  const stepsProps = { created: false, liquidity: false, swapped: false }
  const guideOpen = renderToString(
    createElement(
      MemoryRouter,
      null,
      createElement(Onboarding, { ...stepsProps, preview: 'open' }),
    ),
  )
  if (
    !guideOpen.includes('Welcome to') ||
    !guideOpen.includes('AstroGate') ||
    !guideOpen.includes('Connect Wallet')
  ) {
    throw new Error('la guía no muestra la bienvenida con los pasos')
  }
  const guideMini = renderToString(
    createElement(
      MemoryRouter,
      null,
      createElement(Onboarding, { ...stepsProps, preview: 'collapsed' }),
    ),
  )
  if (!guideMini.includes('Next:')) {
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

  // Retiro de liquidez: reparto proporcional de reservas + guarda sin wallet.
  const soroswap = await vite.ssrLoadModule('/src/lib/soroswap.ts')
  const preview = soroswap.withdrawPreview(
    { totalSupply: 1000n, reserveToken: 5000n, reserveXlm: 2500n },
    250n,
  )
  if (preview.tokenAmount !== 1250n || preview.xlmAmount !== 625n) {
    throw new Error('withdrawPreview no reparte las reservas en proporción')
  }
  if (soroswap.lpSharePercent(250n, 1000n) !== 25) {
    throw new Error('lpSharePercent no calcula la parte del pool')
  }
  const { LiquidityPosition } = await vite.ssrLoadModule(
    '/src/components/LiquidityPosition.tsx',
  )
  const positionHtml = renderToString(
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(LiquidityPosition, { token: { id: 'CTOKEN', decimals: 7 } }),
    ),
  )
  if (positionHtml !== '') {
    throw new Error('LiquidityPosition sin wallet debería no pintar nada')
  }

  // Gráfico local: renderiza sin navegador y no promete un histórico global.
  const { ReserveChart } = await vite.ssrLoadModule(
    '/src/components/ReserveChart.tsx',
  )
  const chartHtml = renderToString(
    createElement(ReserveChart, {
      snapshots: [
        {
          t: Date.parse('2026-11-01T10:00:00Z'),
          xlm: '10000000',
          token: '100000000',
        },
        {
          t: Date.parse('2026-11-01T10:05:00Z'),
          xlm: '12000000',
          token: '100000000',
        },
      ],
      decimals: 7,
      symbol: 'MOON',
    }),
  )
  if (
    !chartHtml.includes('Pair History') ||
    !chartHtml.includes('<svg') ||
    !chartHtml.includes('MOON')
  ) {
    throw new Error('el gráfico de reservas no renderiza')
  }

  // Actividad on-chain: se renderiza en estado de carga con QueryClient.
  const { TokenActivity } = await vite.ssrLoadModule(
    '/src/components/TokenActivity.tsx',
  )
  const tokenActivityHtml = renderToString(
    createElement(
      QueryClientProvider,
      { client: new QueryClient() },
      createElement(TokenActivity, {
        token: { id: 'CTOKEN', decimals: 7, symbol: 'MOON' },
      }),
    ),
  )
  if (!tokenActivityHtml.includes('Recent On-Chain Activity')) {
    throw new Error('la actividad on-chain no renderiza su sección')
  }

  // Modo prueba: estado inicial sin cuentas, invita a crearlas.
  const { DemoMode } = await vite.ssrLoadModule('/src/components/DemoMode.tsx')
  const demoHtml = renderToString(
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(DemoMode, { token: { id: 'CTOKEN', decimals: 7 } }),
    ),
  )
  if (
    !demoHtml.includes('Demo Mode') ||
    !demoHtml.includes('Create 3 Test Accounts')
  ) {
    throw new Error('el modo prueba no muestra el estado inicial')
  }

  console.log(
    `render OK (${html.length} + ${createHtml.length} + ${marketHtml.length} + ${portfolioHtml.length} + ${tokenHtml.length} + ${liquidityHtml.length} + ${walletFound.length} + ${walletMissing.length} + ${guideOpen.length} + ${guideMini.length} + ${artHtml.length} + ${chartHtml.length} + ${tokenActivityHtml.length} + ${demoHtml.length} chars) · rutas y componentes`,
  )
} catch (err) {
  failed = true
  console.error('FALLO:', err?.stack?.slice(0, 1200) ?? err)
} finally {
  await vite.close()
}

process.exit(failed ? 1 : 0)
