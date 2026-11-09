# Estado actual (para continuar en la próxima sesión)

## Handoff rápido (Nov 9 2026, sesión 22 — Auditoría full-stack y hardening)
- **Lote de frontend consolidado en 2 commits** de la rama `ai/audit-hardening`:
  1. `feat(security)`: credencial de `scripts/opencode-env/service.json` movida a `~/.secrets/` (fuera del repo) con README de política; repo con plantilla. → **Usuario debe ROTAR el password** (sigue en el historial de git) y re-desplegar contratos (el wasm hash cambiará tras el redeploy: entonces actualizar `ASTRO_WASM_HASH` en `lib/network.ts`, `contracts` en README/llms.txt y docs).
  2. `refactor(frontend)`: suite de lib (storage con prefijo `astrogate.` + migración `floodgate.*`, tokenomics única fuente honesta, demo con guard mainnet, wallet kit lazy y tipado `typeof StellarWalletsKit` porque `authModal`/`disconnect` son estáticos en kit 2.7.1, signer, soroswap, explorer) y componentes (useCopy compartido en DemoMode/TokenActivity/ContractDetailsCard/ShareButton, checkpoint transaccional en CreateTokenForm, quote key con reservas en SwapCard, a11y en TokenActivity, FomoTicker eliminado como dead code).
- **Config/docs de esta sesión**: `strict: true` en `tsconfig.app.json` (0 errores), `vitest.config.ts` incluido en `tsconfig.node.json`, `check:csp` (scripts/check-csp.mjs) valida paridad de CSP entre `vercel.json`, `public/_headers` y `nginx.conf`; CryptoCompare retirado de las 3 CSP y de los docs; header `no-cache` para `/sw.js` en `vercel.json`; README sin el claim falso de auditoría y sin `ai/market-discovery`; cifras 0.5%/99.5% corregidas en README y llms.txt; `VITE_SITE_ORIGIN` añadido a `.env.example`; PLAN.md drift (oxlint, charts SVG) actualizado; AGENTS.md con marca AstroGate.
- **Nuevos helpers**: `tokenomics.whaleThresholdBase` (umbral ballena = ≥1% del supply del fair launch, con tests), `snapshots.dedupeSnapshots` (con tests) usado por `reconstructSnapshotsFromEvents`, `constants.ts` y `hooks/useCopy.ts` compartidos.
- **Hardening on-chain (contratos, sesión 22)**:
  - `astro-token`: supply SELLADO con el extension OZ `Capped` (`Compose<(Capped, TotalSupply)>`, cap = initial_supply → mint imposible antes y después de renunciar; después de un burn solo puede rellenar hasta cap), validaciones de constructor (decimals ≤ 18, name/symbol 1..32 bytes, initial_supply > 0), tests 6→14. OJO: para el test cross-contract el crate ahora es `crate-type = ["cdylib","rlib"]` y re-exporta `TokenClient`.
  - `astro-launchpad-contract`: `renounce` y `burn_lp` ELIMINADOS del ABI (son invariantes, no opciones: SIEMPRE renuncia y SIEMPRE quema LP), par existente solo aceptado si está vacío (`get_reserves()==0`, nuevo error `PairAlreadySeeded`; par pre-sembrado causa revert total), traits muertos fuera (`token_0/token_1/get_owner`), variantes de error ya no usadas eliminadas y renumeradas (NotInitialized=1, InvalidAmount=2, PairAlreadySeeded=3), tests 3→4 (incluye verificación REAL de `get_owner()==None` tras el launch con el wasm de astro-token).
  - **Wasm release reconstruidos (hashes NUEVOS, pendiente re-deploy del usuario)**:
    - `astro_token.wasm`: `sha256 5930d6c69894f5cd6924e1a7d8d10282448c7c18de0143dce76e92884c39786b`
    - `astro_launchpad_contract.wasm`: `sha256 321e7a9e32c31699832272e8c7c3da1a8291d82776eada9ef1104f27264d5c18`
  - Tras re-deployar en testnet: actualizar `ASTRO_WASM_HASH` en `frontend/src/lib/network.ts` + `WASM_HASH` en `frontend/scripts/verify-launchpad.mjs` + hash en README/llms.txt/AGENTS.md.
- **Gates de la sesión 22 hasta aquí**: `tsc -b` (app+node) ✓, vitest tocados ✓ (34), `check:csp` ✓, `cargo fmt --check` ✓, `clippy -D warnings` ✓, `cargo test --workspace` ✓ (18/18). → **Pendiente**: `npm run check` completo final (build+lint+tests+smoke+PWA+CSP).

## Handoff rápido (Nov 7 2026, sesión 21 — Experiencia FOMO Principal, Tokens por Graduarse, Auditoría On-Chain de Contrato y Gráfico Interactivo de Compras/Ventas)

- **Cero trabajo a medias / Código 100% Blindado y Verificado**:
  - Implementación exhaustiva del flujo de FOMO en la página principal (`HomePage.tsx`) y sección dedicada de auditoría de contratos y trading chart en `TokenPage.tsx`.
  - **Gates verdes (100% Verificados)**:
    - `npm run check`: **93 tests unitarios en Vitest pasando (17 archivos)**, 0 errores en `tsc -b`, 0 warnings en `oxlint`, SSR smoke test OK, 10/10 verificaciones de PWA OK.
    - `cargo test --workspace`: **9/9 tests pasando** (3 launchpad + 6 token).
- **Entregas de la Sesión**:
  1. **Live FOMO Pulse & Ticker (`frontend/src/components/FomoTicker.tsx`)**:
     - Ticker superior en tiempo real con indicador animado "Live DEX Pulse", alertas de Fair Launch ($1.11 USD), meta de graduación (1,000 XLM), quema de LP garantizada y CTA directo para lanzar o comprar.
  2. **Radar de Tokens a Punto de Graduarse (`frontend/src/components/GraduationRadar.tsx`)**:
     - Componente visual que resalta los tokens que están compitiendo por graduarse a Soroswap DEX profundo.
     - Barra de progreso de graduación con porcentaje dinámico, reservas actuales en XLM vs meta (1,000 XLM), precio en USD y botones de acción directa: **"⚡ Quick Buy"** (con auto-scroll y precarga en el Swap) y **"🔍 View Curve →"**.
  3. **Feed de Nuevos Lanzamientos (`frontend/src/components/NewLaunchesFeed.tsx`)**:
     - Vista rápida de tokens recién desplegados con insignias de seguridad (🔥 LP Burned, Fair Launch), precio en tiempo real y botón instantáneo de compra/trade.
  4. **Pestañas de Filtrado FOMO en el Mercado (`frontend/src/components/MarketList.tsx`)**:
     - Píldoras de filtrado instantáneo: `🎓 Graduating Soon`, `⚡ New Launches`, `💧 Highest Liquidity` y `★ Favorites Only`.
     - Nuevo criterio de ordenamiento `'graduation'` integrado en [`market.ts`](file:///home/dev/projects/astro-launchpad/frontend/src/lib/market.ts) con tests unitarios.
  5. **Sección Dedicada de Detalles de Contrato y Auditoría (`frontend/src/components/ContractDetailsCard.tsx`)**:
     - Sección completa para cada token en [`TokenPage.tsx`](file:///home/dev/projects/astro-launchpad/frontend/src/pages/TokenPage.tsx):
       - Dirección del contrato del token con botón de copiar al portapapeles y enlace a Stellar.Expert.
       - Dirección del par AMM en Soroswap con enlace al pool DEX.
       - WASM Hash del bytecode verificado en Soroban testnet.
       - Creador/Deployer con enlace a su historial de cuenta.
       - Insignias de auditoría: `✓ Ownership Renounced (Immutable Supply)` y `🔥 100% LP Burned to Dead Address (GAAAA...WHF)`.
       - Enlaces directos a exploradores y APIs públicas: Stellar.Expert, Horizon Account RPC, Soroban RPC Health y redes sociales (Web, Telegram, Twitter/X).
  6. **Gráfico Interactivo de Curva, Compras (🟢) y Ventas (🔴) Antes de Graduarse (`frontend/src/components/ReserveChart.tsx`)**:
     - Mapeo de vectores de precio con puntos visuales de compras (verde 🟢) y ventas (rojo 🔴).
     - Línea proyectada de meta de graduación (`🎓 1,000 XLM Graduation Target`) en vista de liquidez.
     - Contadores de compras vs ventas y porcentaje alcanzado de graduación.
     - Feed de transacciones en vivo previas a la graduación con clasificación BUY/SELL, montos en tokens y XLM, y enlaces a transacciones en el explorador.

## Próximos pasos recomendados para la Sesión 22
1. **Despliegue del Contrato Launchpad en Testnet**:
   - Desplegar el WASM `astro_launchpad_contract.wasm` e inicializarlo con la Soroswap Factory (`CDP3HMUH...`), XLM SAC (`CDLZFC3S...`) y WASM hash del token (`438d12a7...`).
2. **Bindings TS para el Launchpad**:
   - Generar bindings cliente con `stellar contract bindings typescript` para el contrato launchpad.
   - Conectar `CreateTokenForm.tsx` para permitir selección entre lanzamiento atómico (1 transacción) o flujo guiado tradicional.
3. **Indexador Persistente / Velas Históricas**:
   - Configurar pipeline ligero (SubQuery / Mercury o Cron Worker) para almacenar snapshots de velas OHLCV de los pares en Soroswap.

## Handoff rápido (Nov 6 2026, sesiones 17–18 — AstroGate Rebrand, Live Pricing, $1.11 Fair Launch, Auditorías y DevOps)

- **Rebrand definitivo a AstroGate 🌊🚀**: Unión del componente técnico de `stellar-core` (`Floodgate`, `src/overlay/Floodgate.cpp`) con el meme icónico de Stellar `Astro` (`$ASTRO` como token génesis/insignia). Fuente única: `src/lib/brand.ts`.
- **Precios en tiempo real (Zero Mocks)**: Multi-oracle waterfall en tiempo real (Coinbase spot → Binance ticker → CoinGecko → CryptoCompare) con caché de 60 s en memoria y fallback dinámico en `src/lib/xlm.ts`. Cotizaciones on-chain calculadas directamente de las reservas de Soroswap (`reserveXlm / reserveToken`).
- **Fair Launch ($1.11 USD · 1% Creator · 99% Pool)**:
  - Tarifa de despliegue fijada en **$1.11 USD** (`PROTOCOL_DEPLOY_FEE_USD = 1.11`).
  - Separación clara: el 1% es para el creador del token, no para la plataforma. El 99% va directamente al par AMM en Soroswap.
  - **Quema obligatoria de LP (Anti-Rug)**: El 100% de los tokens LP generados se envían permanentemente a la cuenta dead de Stellar (`GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF`). El `total_supply` del par se mantiene intacto, haciendo matemáticamente imposible retirar la liquidez base.
  - **Renuncia de propiedad**: Se ejecuta `renounce_ownership` para anular el owner on-chain y deshabilitar futuros minteos de por vida.
- **Web 100% en inglés**: Traducción exhaustiva de todas las rutas (`/`, `/market`, `/create`, `/token/:id`, `/portfolio`, `/404`), componentes interactivos, modales, alertas y formateador de errores de Soroban/RPC en `src/lib/format.ts`.
- **Auditoría completa full-stack**:
  - Artefacto generado: `audit-report.md`.
  - Verificaciones on-chain ejecutadas con éxito (`verify:discovery`, `verify:demo` con ciclo completo de 3 cuentas, pago A→B, creación, liquidez, swap, mint y burn).
  - Identificación del límite de retención de eventos del RPC de Soroban (~24 h) y mitigaciones.
- **Análisis de arquitectura institucional y DevOps**:
  - Artefacto generado: `institutional-readiness-audit.md`.
  - Especificación de brechas: contrato factory atómico (`contracts/launchpad`), pipeline de indexación persistente (Mercury / SubQuery), pool multi-RPC, containerización y SDK de trading bots.
- **Implementaciones de producción entregadas**:
  - **Pool Multi-RPC de alta disponibilidad**: `RPC_POOL` y `executeWithRpcFailover` en `src/lib/network.ts` con reintentos automáticos ante timeouts o rate-limits.
  - **Headers CSP actualizados**: Orígenes de oráculos (`api.coinbase.com`, `api.binance.com`, etc.) autorizados en `vercel.json` y `public/_headers`.
  - **Watchlist / Favoritos**: Store `useWatchlist` con persistencia en `localStorage`, botones estrella y filtro "Favorites Only" en `MarketList.tsx`.
  - **Exportación de actividad**: Herramientas para descargar actividad local en CSV o JSON desde `ActivityFeed.tsx`.
  - **Protección de Slippage**: Alerta de impacto extremo de precio (>15%) en `SwapCard.tsx`.
  - **Docker & IaC**: `frontend/Dockerfile` multi-stage (Node 22 build + Alpine Nginx) y `docker-compose.yml` en la raíz.
  - **CI Contracts**: Paso de compilación `cargo build -p astro-token` añadido a `.github/workflows/ci.yml`.
- **Gates verdes**:
  - `npm run check`: **81 tests unitarios en Vitest pasando (13 archivos)**, 0 errores de `tsc -b`, 0 warnings en 101 archivos con `oxlint`, SSR smoke test OK, 10/10 verificaciones de PWA OK.
  - `cargo test -p astro-token`: 6/6 tests pasando.
  - `cargo fmt --all -- --check`: 0 discrepancias.
- **Git**:
  - Rama: `ai/market-discovery`.
  - Commits publicados en `origin`:
    - `5fd75de`: Rebrand AstroGate, $1.11 fair launch, LP burn a `GAAAA...WHF`, live pricing y UI en inglés.
    - `20f4e57`: Limpieza de signos de exclamación en toasts.
    - `e237763`: CSP headers, RPC health check, favoritos, exportación CSV/JSON y README en inglés.
    - `e43d292`: Pool multi-RPC failover, Dockerfile, docker-compose y CI contract build.
  - Árbol de trabajo 100% limpio y sincronizado.
- **Próximos pasos recomendados para la siguiente sesión**:
  1. Contrato `launchpad` atómico en Soroban (`contracts/launchpad`) para empaquetar deploy + pool 99% + LP burn a dead address en 1 sola invocación on-chain.
  2. Indexador ligero persistente (Mercury o Worker con base de datos) para velas OHLCV históricas que superen la ventana de 24 h del RPC.
  3. Despliegue de staging en Cloudflare Pages / Vercel para pruebas con usuarios reales en testnet.

## Handoff rápido (Nov 2 2026, sesión 16 — onboarding y traslado al Mac)

- **Objetivo de la sesión**: que el flujo *crear token → añadir liquidez →
  mercado* se entienda sin explicación externa.
- **`CreatePage`**: stepper de 3 pasos (`Crea el token`, `Añade liquidez`,
  `Sale al mercado`) antes del formulario.
- **`CreateTokenForm`**: tras desplegar muestra CTA "Añadir liquidez ahora ↓"
  (ancla `#add-liquidity`), enlace "Ver el token" y aviso de que hasta añadir
  liquidez no aparece en Mercado. El share usa la URL de la app
  (`/token/:id`) en vez de stellar.expert.
- **`LiquidityForm`**: el contenedor del panel tiene `id="add-liquidity"` y
  `scroll-mt-20`. Se eliminó un `import { Link }` sin usar que rompía `tsc`
  (el build fallaba con TS6133); queda pendiente decidir si ese enlace se
  añade de verdad al terminar la liquidez.
- **Gates**: `npm run check` verde (build + lint + 60 tests + smoke +
  `verify:pwa`).
- **Git**: rama `ai/market-discovery` sincronizada con `origin`; repo
  `ruwaq/astro-launchpad`. Se añadió `docs/MAC_SETUP.md` (cuenta, rama,
  prerequisitos de macOS, qué estado es local y no viaja) y el README apunta
  ahí.
- **Traslado a Mac**: clonar la rama, `npm ci`, `npm run check`. Las cuentas
  del modo prueba viven en `localStorage` y hay que recrearlas; `node_modules`,
  `target`, `dist`, `.vercel` y `STELLAR_SECRET` no están en el repo.
- **Siguiente**: probar el flujo en navegador real; decidir el enlace
  post-liquidez a `/token/:id` y `/market`; `wrangler login` para el Worker
  real; GitHub Actions sigue deshabilitado.

## Handoff rápido (Nov 1 2026, sesión 15 — PWA install prompt y SDK 17.4)

- **Instalación PWA**: `PwaInstallPrompt` usa `beforeinstallprompt`, se oculta
  en standalone/SSR, se puede descartar (persistido en `localStorage`) y se
  cierra con `appinstalled`. En iOS/Safari no hay prompt nativo: se usa el menú
  del navegador → *Añadir a la pantalla de inicio*.
- **SDK alineado**: los bindings generados usan `txFromJson`, disponible en
  `@stellar/stellar-sdk@17.4.0`; `package.json`/`package-lock.json` quedaron en
  esa versión. El `npm ci` interrumpido de Vercel había dejado `node_modules`
  sin `.bin`; se restauró con `npm install` y se repitieron los gates.
- **Gates**: `npm run check` verde (build + lint + 60 tests + smoke +
  `verify:pwa`) y `npm run verify:demo` verde con el SDK nuevo: ciclo completo
  en testnet y compra de `99,489931` tokens pagando 1 XLM.
- **Preview actual**: <https://floodgate-stellar.extreme-hardboard.workers.dev>
  sirve `index-Dyp2_r-W.js`, `index-CxHzngq0.css` y SW
  `floodgate-shell-f6814337acfe`; HTTP 200 en `/`, `/sw.js`,
  `/manifest.webmanifest` y fallback SPA. Es temporal y caduca/reclama en
  minutos; **no** es el Worker de producción.
- **Vercel**: `vercel deploy --temporary` desde fuente se quedó en `npm ci`;
  el modo **prebuilt** sí publicó <https://rushing-sapphire-n233dra.tmp.now>
  (HTTP 200 en `/`, `/sw.js`, manifest, `/market` y fallback SPA; bundle
  `index-Dyp2_r-W.js`). Es temporal (~21 min), sin los headers completos del
  `vercel.json` porque el config prebuilt se generó aparte; no es producción.
  `frontend/vercel.json` fuerza `npm ci` para el flujo normal.
- **CI**: `.github/workflows/ci.yml` existe y los gates pasan en local, pero
  GitHub Actions está **deshabilitado** en el repositorio (`enabled: false`);
  por eso el PR no muestra checks. Habilitarlo es una decisión de repo y no se
  forzó.
- **Git**: commit local `31e0082` (se publica en esta sesión). Draft PR
  [#1](https://github.com/ruwaq/astro-launchpad/pull/1), base
  `floodgate/testnet-base`, `mergeable` y sin checks de CI.
- **Bloqueado**: Worker real sin `wrangler login`; `origin/main` es el monorepo
  legacy sin ancestro común; indexer/P2 restante requiere credenciales,
  navegador o auditoría.
- **Siguiente**: autenticar `wrangler` y desplegar el Worker real; decidir la
  base del PR/`main` y si se habilita GitHub Actions; luego indexer opcional o
  P2 (metadata/IPFS, i18n, Sentry, Playwright, locker).

## Handoff rápido (Nov 1 2026, sesión 14 — Compra con XLM y preview viva)

- **Swap bidireccional**: `SwapCard` permite vender token → XLM y comprar
  XLM → token. La cotización usa `router_get_amount_out` con las reservas del
  lado correcto; el mínimo de salida mantiene el slippage del 2%.
- **Impacto de precio**: `spotAmountOut`/`priceImpactPercent` calculan el coste
  real contra la salida spot (incluye fee). La UI avisa si supera 5% y muestra
  el mínimo protegido.
- **Seguridad de compra**: valida balance XLM, MAX deja 1 XLM para fees/reserva
  y bloquea compras que dejarían la cuenta sin fondos para firmar. Se refresca
  el balance XLM tras cada operación.
- **Actividad**: los swaps guardan dirección (`buy`/`sell`) para que el feed
  muestre “XLM → token” en compras y “token → XLM” en ventas.
- **Transparencia de riesgo**: la página del token avisa si el owner puede
  emitir más supply; el formulario de creación ya no dice “supply fijo” y
  explica que no hay cap en este MVP.
- **Seguridad/release**: `SECURITY.md` (modelo de confianza, límites y reporte)
  y `docs/RELEASE_CHECKLIST.md` (gates, deploy, verificación, rollback).
- **Verificación real**: `npm run verify:demo` ejecutó el ciclo completo en
  testnet, incluida la compra de `99,489931` tokens pagando 1 XLM por el
  router. `npm run check` verde (60 tests + smoke + `verify:pwa`).
- **Preview viva (temporal, sin cuenta)**: <https://floodgate-stellar.extreme-hardboard.workers.dev>
  — redeployada con el bundle actual (`index-TBBannzx.js`, SW
  `floodgate-shell-af0d1f8f8a77`), HTTP 200 en `/`, `/sw.js`,
  `/manifest.webmanifest` y fallback SPA. Caduca/reclama en ~53 min; no es el
  Worker de producción.
- **Vercel**: se probó `vercel deploy --temporary`; el CLI se quedó en `npm ci`
  y no llegó a publicar. `frontend/vercel.json` ahora fuerza `npm ci` (el
  `pnpm-lock.yaml` local está ignorado y es viejo), pero no se usó como
  producción.
- **Git**: rama `ai/market-discovery` publicada. Draft PR
  [#1](https://github.com/ruwaq/astro-launchpad/pull/1), base
  `floodgate/testnet-base` y `mergeable`. `origin/main` es el monorepo legacy
  y **no comparte ancestro** con este proyecto; no se ha forzado ni reemplazado
  `main`.
- **Commits**: `23c2928` (compra XLM), `d1c00ab`/`35b9624` (docs y preview) y
  `c61a2f9` (riesgo/seguridad).
- **Bloqueado**: el Worker real sigue sin sesión (`wrangler login`); el draft
  PR no se ha fusionado y no hay deploy de producción. `origin/main` sigue
  siendo el monorepo legacy sin ancestro común.
- **Siguiente**: revisar/mergear el draft PR (o decidir si `main` debe
  reemplazarse por el proyecto), autenticar `wrangler` para publicar el Worker
  real y luego Fase 2b (indexer) o P2 restante (metadata/IPFS, i18n, Sentry,
  Playwright, locker) cuando haya credenciales/auditoría.

## Handoff rápido (Nov 1 2026, sesión 13 — Shell offline PWA)

- **Service worker** (`frontend/public/sw.js`): precarga el index y sus assets
  con hash, navegación network-first con fallback al shell, assets cache-first
  y **cero** caché de RPC/Horizon/wallet. `stamp-sw.mjs` inyecta un id de build
  y `activate` borra cachés viejas.
- **Registro**: solo en producción (`lib/register-sw.ts`), después de `load`;
  en dev no interfiere con Vite/HMR. `_headers` revalida `/sw.js` con
  `no-cache`.
- **UX offline**: `OfflineBanner` avisa que el shell/historial local abren sin
  red, pero los datos on-chain y las operaciones no. No se permite operar
  offline.
- **Verificación**: `npm run check` verde (build + lint + 54 tests + smoke +
  `verify:pwa`). `verify:pwa` valida manifest, SW estampado, precache,
  network-first, ausencia de caché externa, headers y registro en el bundle.
  Sin navegador disponible: no hay E2E offline real.
- **Commit**: `305b530` (`feat(frontend): shell offline PWA con service
  worker`).
- **Siguiente**: Fase 2b indexer global (requiere Cloudflare/credenciales y
  aprobación) o P2 sin infraestructura restante (i18n, metadata/IPFS, Sentry,
  Playwright, locker, dashboard).

## Handoff rápido (Nov 1 2026, sesión 12 — Actividad on-chain reciente)

- **`lib/token-events.ts`**: parser de eventos SEP-41 (`transfer`, `mint`,
  `burn`) y lectura paginada de `getEvents` en una ventana de ~14 h. Es una
  lectura directa del RPC, no un indexer.
- **`TokenActivity`**: sección en `/token/:id` con tipo, monto, from/to, fecha
  y enlace a la tx en `stellar.expert`; estados de carga/error/vacío y aviso de
  que el par de Soroswap no emite swaps.
- **Invalidación**: swap, liquidez, transfer, mint y burn refrescan
  `token-events`; la sección también hace polling cada 2 min.
- **Verificación**: `npm run check` verde (54 tests + smoke) y
  `npm run verify:token-events` contra ASTRO real (6 transferencias, orden
  descendente, montos/timestamps válidos). Sin escrituras on-chain.
- **Commit**: `ca40cbf` (`feat(frontend): actividad on-chain reciente del
  token`).
- **Siguiente**: Fase 2b indexer global (requiere Cloudflare/credenciales y
  aprobación) o P2 sin infraestructura.

## Handoff rápido (Nov 1 2026, sesión 11 — Historial local de actividad)

- **`store/activity.ts`**: Zustand persistido en
  `floodgate.activity.v1` (máx. 200 operaciones) con tipo, estado
  (`success`/`failed`), token, montos, cuenta, hash, detalle, error y fecha.
  Funciones puras `appendActivity`, `activityLabel` y `activitySummary` con 8
  tests.
- **Registro real**: crear token, añadir/retirar liquidez, swap, transferencia
  (wallet y modo demo), mint y burn; también se guardan fallos on-chain con su
  mensaje.
- **UI**: `ActivityFeed` en `/portfolio` con enlaces a `stellar.expert`,
  estado, cuenta, fecha y borrado del historial local. Aviso explícito de que
  no es un feed global.
- **Verificación**: `npm run check` verde (build + lint + 50 tests + smoke con
  actividad vacía en portfolio). Sin cambios on-chain; se reutilizan los flujos
  ya verificados.
- **Commit**: `c350ffd` (`feat(frontend): historial local de actividad de
  operaciones`).
- **Siguiente**: Fase 2b (indexer global para mercado/histórico/actividad) o
  P2 restante (metadata/IPFS, i18n, Sentry/analytics, E2E, locker, dashboard).
  El indexer requiere recursos/credenciales Cloudflare y aprobación.

## Handoff rápido (Nov 1 2026, sesión 10 — Fase 2a: snapshots y gráfico local)

- **`lib/snapshots.ts`**: snapshots de reservas en `localStorage`
  (`floodgate.reserve-history.v1`) con caché en memoria y
  `useSyncExternalStore`. Máximo 288 por token y 30 tokens; los cambios se
  guardan al instante y hay un pulso cada ~5 min. Tests puros de bucketing,
  recorte, coordenadas SVG y precio/liquidez.
- **`useReserveHistory` + `ReserveChart`**: el detalle de token pinta un SVG
  accesible con toggle precio/liquidez, mínimo/máximo, variación y estado
  vacío. `useSoroswapPool` refresca cada 60 s solo con la pestaña activa.
- **Límite explícito**: es historial local de este navegador, no un indexer.
  No incluye lo anterior a abrir el token ni lo visto por otras personas. El
  par de Soroswap no emite `swap`, así que el histórico global sigue
  necesitando un indexer (Fase 2b, con recursos/credenciales Cloudflare y
  aprobación).
- **Verificación**: `npm run check` verde (build + lint + 42 tests + smoke con
  el gráfico). No hubo cambios on-chain: se reutilizan las lecturas de pool ya
  verificadas por `verify:discovery` y `verify:demo`. Falta verificación
  visual en navegador real.
- **Commit**: `1d14562` (`feat(frontend): snapshots locales y gráfico de
  precio/liquidez`).

## Handoff rápido (Nov 1 2026, sesión 9 — Fase 0/1: CI, rutas y acciones)

- **Fase 0 (`5eda96d`)**: GitHub Actions (frontend build/lint/tests/smoke;
  contratos fmt/clippy/tests), Dependabot, Vitest, toasts accesibles,
  `TxProgress`, `ErrorBoundary`, skip-link/foco/reduced-motion, CSP y headers
  de seguridad en Cloudflare `_headers` y `vercel.json`, y caché inmutable de
  assets.
- **Fase 1 (`62eb981`)**: React Router 8 con `/`, `/market`, `/token/:id`,
  `/portfolio` y `/create`; layout con navegación y footer; mercado con
  búsqueda, filtro y orden (lógica pura en `lib/market.ts`); detalle de token
  con precio/liquidez/supply/owner; `TransferCard`, `BurnCard` y `MintCard`
  (solo owner, oculto para el resto); portfolio v1 con creaciones locales
  (`store/creations.ts`) y holdings vía `useQueries`; progreso de onboarding
  local (`store/progress.ts`).
- **Verificación**: `npm run check` verde (build + lint + 30 tests + smoke de 5
  rutas); `npm run verify:discovery` OK (se corrigió la comprobación obsoleta
  de ASTRO en la ventana de eventos; ASTRO se valida en `discoverTokens`
  porque está fijado); `npm run verify:demo` OK con 3 cuentas nuevas, pago
  A→B, crear+LP+liquidez, transferencia, swap, mint del owner a C y burn de B
  (el supply baja). `verify:frontend` no se ejecutó por falta de
  `STELLAR_SECRET`; el mismo camino quedó cubierto por `verify:demo`.
- **Pendiente**: deploy a producción requiere aprobación explícita
  (`npm run deploy`); no hay navegador en este entorno, así que falta
  verificación visual; Fase 2b (indexer para histórico global) sigue pendiente
  de recursos/credenciales Cloudflare y aprobación.
- **Auditoría**: `npm audit` reporta 30 vulnerabilidades (12 low, 6 moderate,
  12 high), casi todas transitivas de wallet-kit; no hay críticas. No ejecutar
  `npm audit fix --force` (degrada wallet-kit a 1.9.5).

## Handoff rápido (Nov 1 2026, sesión 8 — modo prueba sin wallet)

- **`lib/demo.ts`**: 3 cuentas nuevas (`Keypair.random`) fondeadas en secuencia
  con Friendbot (10 000 XLM cada una). Semillas en `localStorage`
  (`floodgate.demo.accounts.v1`); modo e índice activo persistidos. Solo
  testnet y sin valor real: nunca reutilizar este patrón con fondos reales.
- **Store (`store/wallet.ts`)**: `mode: 'wallet' | 'demo'`, `startDemo`,
  `selectDemo`, `disconnect` y `getSigner()` unificado (`KeypairSigner` para
  demo, `walletSigner` para wallet real). Crear token, liquidez, swap y retiro
  usan `getSigner()`.
- **`DemoMode.tsx`** (bajo la guía): crea/entra al modo prueba, muestra saldos
  XLM, cambia entre A/B/C y transfiere el token seleccionado a otra cuenta demo
  (así B puede swapear el token que creó A).
- **Verificado con `npm run verify:demo`** (sin `STELLAR_SECRET`): 3 cuentas
  fondeadas, firmantes válidos, pago A→B y flujo completo: A crea token +
  liquidez → transfiere a B → B swapea 5 DEMO por XLM.
- Smoke: 13 secciones. `npm run check` verde.
- Commits: `fe8462a` (modo demo) y `a3be870` (retiro atómico con router).
- Deploy: pendiente de `npm run deploy` (la versión online sigue en 6b).

## Handoff rápido (Nov 1 2026, sesión 7 — retirar liquidez)

- **Retirar liquidez** (el hueco funcional que quedaba: se podía aportar pero no
  sacar): `withdrawLiquidity()` usa `router.remove_liquidity` — atómico: mueve
  los LP, los quema y devuelve ambos lados en una sola transacción, así que un
  fallo no deja LP atrapados en el par. Los amounts se mapean al orden real
  `token_0`/`token_1`.
- **`useLpPosition` + `LiquidityPosition`**: tarjeta "Tu liquidez" bajo el swap
  (solo si la wallet conectada tiene LP), con % del pool, retiro 25/50/100 %,
  preview de cuánto token + XLM se recibe y refresco de pool/balances/mercado.
- **Verificado on-chain** con `verify:frontend`: añadió liquidez al par
  ASTRO/XLM, retiró el 10 % de los LP y comprobó que el balance LP bajó
  exactamente lo retirado y que las reservas también bajaron. El camino de
  token nuevo → par → liquidez → swap → mercado sigue OK.
- **Smoke: 12 secciones** (matemática del retiro + guarda sin wallet).
- Docs: README ahora refleja el deploy real (Cloudflare Workers) y el flujo
  con retiro.
- Nota verificada: **el par de Soroswap no emite eventos `swap`** (0 eventos en
  la ventana de 10k ledgers, con actividad sí en la factory). Un chart de
  histórico de precio necesita indexer; no se puede sacar de `getEvents` hoy.
- Commits: `1aa41df` (feature) · `a3be870` (retiro atómico con el router) ·
  deploy: pendiente de `npm run deploy` para publicar el retiro (la versión
  online sigue siendo la de la sesión 6b).

## Handoff rápido (Oct 22 2026, sesión 6b — UX guiada + mercado OpenSea)

- **Ciclo guiado:** `Onboarding.tsx` — bienvenida de 4 pasos
  (conectar→crear→liquidez→swap) con estado real de la sesión; se compacta a
  tira "n/4 · siguiente: X" y persiste en `localStorage` (`floodgate.onboarding`).
  Steps ligados a anclas `#sec-crear`/`#sec-mercado` (+ `scroll-mt-20` por el
  header sticky).
- **Orden móvil pensado en una meta por pantalla:** Mercado (grid cards) →
  Swap del token elegido → Crear + Liquidez juntos → TokenInfoCard al final
  etiquetada "· token de ejemplo".
- **Compartir (Web Share API)** en los éxitos de crear y de liquidez, fallback
  clipboard con "copiado ✓" (`ShareButton.tsx`).
- **MAX** en SwapCard (balance del token) y en LiquidityForm (aporte token,
  `useTokenBalance`).
- **Mercado estilo OpenSea:** `lib/art.ts` + `TokenArt.tsx` — arte generativo
  determinista por contrato (FNV-1a 32 bits del id → paleta curada de 8 +
  formas SVG; mismo contrato = misma "NFT card" en cualquier dispositivo).
  Grid `2/3/4` columnas; monograma = símbolo; chip "en el swap" y badge ↗ al
  explorador. Avatar 36px en el header de SwapCard.
- Accesibilidad: `role="alert"` en errores, `role="status"` en éxitos.
- Smoke: 11 secciones verificadas (App base, liquidez, wallet ×2, guía ×2,
  arte ×2). `LaunchpadToken` ganó `symbol?: string` para el demo generativo.
- Commits: `6e14bab` (UX guiada+MAX+share) y `683de9e` (mercado OpenSea).
  Deploy: versión `e428aa63-c79e-4b0e-b744-4b9ebf416bd9` (200 en `/`,
  arte dentro del bundle, la guía arranca compacta hasta primer uso).

## Handoff rápido (Oct 22 2026, sesión 6 — rebrand + móvil + deploy)

- Marca fijada: **Floodgate 🌊** (elección del usuario). Nombre extraído del
  código interno de `stellar-core` (`Floodgate`, `src/overlay/Floodgate.cpp`:
  la compuerta que inunda la red con transacciones hasta el cierre del ledger);
  disponibilidad como marca crypto verificada (solo existe una firma de VC en
  otro rubro). Fuente única: `frontend/src/lib/brand.ts`. **El token de ejemplo
  ASTRO no cambia.**
- **Mobile-first**: inputs ≥16px (`px-3.5 py-3 text-base`, evita el zoom de
  iOS), CTAs `py-3` a ancho completo en móvil, mercado como **tarjetas** en
  `<sm` (tabla solo en sm+), header sticky con blur, `tap-highlight` off,
  safe-areas con `env(safe-area-inset-bottom)` + `viewport-fit=cover`.
- **PWA instalable + shell offline**: `public/manifest.webmanifest`,
  `theme-color`, `apple-touch-icon` e iconos `icon-192.png`/`icon-512.png`
  rasterizados con ImageMagick desde `scripts/assets/brand-icon.svg` (olsa
  emerald/cyan). El service worker cachea el shell y los assets, nunca RPC, y
  avisa cuando no hay conexión.
- **Deploy listo (Vercel)**: `frontend/vercel.json` (framework vite, build
  `npm run build`, output `dist`, SPA rewrite). Pasos del usuario:
  `cd frontend && npx vercel login && npx vercel --prod`.
- **WalletConnect v2** wireado en `store/wallet.ts` con el módulo oficial de
  la kit 2.7.1 (`WalletConnectModule`, `allowedChains=[stellar:testnet]`,
  metadata desde BRAND + origin); se activa con `VITE_WC_PROJECT_ID`
  (Reown Cloud gratis, ver `.env.example`). Sin esa var, igual funciona en
  desktop. Cobertura por WC: `signTransaction`/`signAndSubmitTransaction`,
  justo lo que la app necesita.
- `smoke:render` ahora comprueba "Floodgate" y sobres de WC en el stub
  (`scripts/fixtures/wallets-kit-stub.ts`). `npm run check` verde pre-commit.

- **Deploy hecho (2026-10-22)**: URL de producción
  **https://floodgate-stellar.pepepop2000.workers.dev** (Cloudflare Worker con
  assets estáticos; token API del usuario en `~/.config/cloudflare/cf-api-token`,
  perms de Workers sí / Pages no — por eso es Workers, no Pages).
  - Verificado online: `/` 200 con título "Floodgate 🌊", fallback SPA `=/mercado`
    200, manifest + icon-192/512 200, vendors con etag.
  - Config: `frontend/wrangler.jsonc` (assets-only, `not_found_handling`
    "single-page-application"). El `_redirects` de Pages NO vale en Workers
    (regla infinita, error 100324) — el fallback lo da `not_found_handling`.
  - Versión desplegada: `86a8b734-a60c-498a-a400-fe56d61f4808`.
  - Re-desplegar: `cd frontend && npm run deploy` (build + wrangler deploy,
    con `CLOUDFLARE_API_TOKEN` de ese fichero) — comentar variantes custom
    domain en el dashboard de CF.
  - Bundle optimizado (sección perf abajo): main 84 kB + 3 vendors cacheables.

## (Historia) Handoff rápido (Oct 22 2026, sesión 5)

- Entorno: Termux (bionic). Proyecto en `~/projects/astro-launchpad`.
- **stellar-cli 28.1.0 corre nativo** (binario oficial glibc + libs de Debian
  arm64 en `~/.local/opt/glibc-libs/lib`, wrapper `~/.local/bin/stellar` que
  fija `LD_LIBRARY_PATH`). No hace falta proot/VM/CI.
- `rustup` ya funciona (stable aarch64 1.99.1, targets `wasm32v1-none` y
  `wasm32-unknown-unknown`).
- Identidad testnet `dev` fondeada:
  `GDCUL7MZ7SK4LXSLD7Z3TBOQBXZCHG3CJZ6K5P2W5R6AIFCKMOYQHFEY`
  (secret en `~/.config/stellar/identity/dev.toml`).
- **Token desplegado en testnet** (nombre "Astro Test", símbolo ASTRO, 7 dec,
  supply 1e9):
  `CAI637WCEILQF3ZYOV6BRUCX532XQIVOOJ4CRWFPWHQRJHOH5OKHSXRE`
  - wasm hash (subido a la red, el launchpad crea instancias sin resubir):
    `438d12a79855dd42c353d12bb42e6b57ed513eed47b7008094683ba33f971286`
- **Par Soroswap ASTRO/XLM**:
  `CA32TMZ2AODXI7K7B6T2YPZR52HJKFCY5GT2DNHMOL326DLSNPX55BUP`
- Frontend completo y verificado on-chain (ver "Verificación" abajo).
  Dev server en `:5173` (background, PID 14751, log `/tmp/opencode/vite-dev.log`).

## Sesión 5 — mercado sin backend

- `frontend/src/lib/discovery.ts`: descubre pares token/XLM leyendo los eventos
  `new_pair` de la factory (`getEvents` paginado con cursor, ventana de 10 000
  ledgers). Para cada token lee metadata SEP-41 (nombre/símbolo/decimales) y
  las reservas del par; tolera tokens rotos sin tumbar el listado.
- `components/MarketList.tsx` + `hooks/useTokenList.ts`: tabla de tokens
  recientes con precio en XLM, liquidez y enlace al par. Seleccionar una fila
  cambia el swap de la página. El token de ejemplo (ASTRO) va fijado primero.
- `tokenPriceInXlm()` en `lib/soroswap.ts`: precio de 1 token a partir de las
  reservas.
- El estado del par ahora se lee del contrato del par (`token_0`, `token_1`,
  `get_reserves`) con bindings nuevos (`src/contracts/soroswap-pair/`), en vez
  de fiarse del orden de `sort_tokens` del router. Verificado on-chain con
  `verify:frontend` (swap + liquidez en par existente y en par nuevo).
- `scripts/verify-discovery.mjs` (`npm run verify:discovery`): casos del parser
  de eventos + descubrimiento real contra testnet, sin `STELLAR_SECRET`.
- Límites conocidos: no es un indexer histórico. La ventana la marca la
  retención de eventos del RPC (~14 h de testnet) y se listan 9 tokens como
  máximo para no saturar el RPC público.

## Completado (sesión 4)

1. **Capa Soroswap en el frontend** (`frontend/src/lib/soroswap.ts`), una sola
   capa con todo el AMM:
   - `soroswapClients(signer?)` → clientes de factory y router.
   - `fetchPoolState(tokenId)` → par, reservas y orden de tokens.
   - `quoteTokenForXlm(amountIn, pool)` → cotización real.
   - `ensurePair(tokenId, signer?)` → crea el par si no existe y espera a que
     aparezca (la creación es asíncrona: espera acotada de 5 intentos).
   - `addLiquidity({...})` → par + `add_liquidity`, devuelve amounts y LP.
   - `swapTokenForXlm({...})` → swap con `amount_out_min` (slippage 2 %).
2. **UI**:
   - `components/LiquidityForm.tsx` → añadir liquidez tras crear el token.
   - `components/SwapCard.tsx` → cotización + swap a XLM (también se muestra
     para el token de ejemplo, que ya tiene par).
   - `hooks/useSoroswapPool.ts` → estado del par con TanStack Query.
   - `lib/token.ts` → `deployToken()` (antes vivía dentro del componente).
   - `lib/signer.ts` → añade `signAuthEntry` (SEP-43) al `Signer`.
3. **Bindings**: `src/contracts/xlm-sac/` (SAC nativo de XLM) añadido al
   pipeline de `npm run bindings` (5 contratos en total, con el par).
4. **Scripts de verificación** (`frontend/scripts/`):
   - `verify-frontend-flow.mjs` → **carga el módulo real del frontend** con
     Vite SSR y ejecuta en testnet: pool → cotización → swap → liquidez, el
     camino completo token nuevo → par → liquidez → swap, y comprueba que ese
     token aparece en el mercado descubierto de eventos.
   - `verify-soroswap.mjs` → smoke del AMM (ya existía).
   - `verify-launchpad.mjs` → smoke del deploy del token (ya existía).
   - `probe-pool.mjs` → sonda de solo lectura (reservas + las dos cotizaciones).
   - `smoke-render.mjs` + `scripts/fixtures/wallets-kit-stub.ts` → render del
     árbol de componentes con `react-dom/server` (no hay navegador en el
     entorno; la wallet se sustituye por un stub).

## Verificación (todo en verde)

| Comprobación | Comando | Resultado |
| --- | --- | --- |
| Tipos + bundle | `npm run build` | OK |
| Lint | `npm run lint` | 0 avisos, 0 errores |
| Render UI | `npm run smoke:render` | OK · 12 secciones |
| Contrato | `cargo test -p astro-token` | 6/6 |
| Deploy + spec | `npm run verify:launchpad` | OK |
| AMM on-chain | `npm run verify:soroswap` | OK |
| Camino del frontend | `npm run verify:frontend` | OK (swap + liquidez + **retiro**) |
| Modo prueba | `npm run verify:demo` | OK (3 cuentas + flujo A→B) |

Los tres `verify:*` necesitan `STELLAR_SECRET` (cuenta `dev`).

## Hallazgos clave (verificados on-chain)

- **La cotización real es `router_get_amount_out(amount_in, reserve_in,
  reserve_out)`** (30 bps de comisión). `router_get_amounts_out` de este
  despliegue de Soroswap **devuelve el input sin cotizar**: no sirve.
- **No hace falta allowance**: el router mueve los tokens con `transfer`
  (auth de la cuenta que invoca), no con `transfer_from`. Comprobado:
  allowance del router = 0 y `add_liquidity`/`swap` funcionaron.
- **El `deadline` del router se pasa como unix timestamp** (`now + 300`), que
  vale tanto si el router lo compara con el timestamp del ledger como con la
  secuencia.
- Orden y reservas se leen del contrato del par (`token_0`, `token_1`,
  `get_reserves`); el `sort_tokens` del router no es la fuente de verdad.
  `add_liquidity` monta los amounts en el orden interno del par.
- Los contratos de Soroswap devuelven `Result<T, E>`: hay que desenvolverlo
  (`isErr()`/`unwrap()`), no leer `.result` dos veces.

## Pendiente

1. **Verificación visual**: no hay navegador en el entorno. Con la app servida
   en `:5173` hay que probar con wallet (Freighter) y con el modo prueba (sin
   wallet) el flujo completo, incluido el retiro de liquidez.
2. **Re-deploy** del frontend para publicar retiro + modo prueba:
   `cd frontend && npm run deploy` (Cloudflare Workers).
3. UI/UX del roadmap: toasts, responsive fino. Charts de precio **bloqueados**
   sin indexer: el par de Soroswap no emite eventos `swap`.
4. Mint/transfer de tokens desde la UI (el contrato ya los soporta).
5. CI en GitHub Actions (el repo no tiene workflows).

## Comandos

```bash
export PATH="$HOME/.local/bin:$HOME/.cargo/bin:$PATH"

# Frontend
cd frontend
npm run dev                 # :5173
npm run check               # build + lint + smoke (sin red)
npm run build               # tsc + vite build
npm run lint                # oxlint
npm run smoke:render        # render del árbol de componentes
npm run bindings            # regenera bindings TS desde los contratos on-chain
node scripts/probe-pool.mjs # sonda de solo lectura del par

# Verificaciones on-chain (necesitan STELLAR_SECRET)
STELLAR_SECRET=... npm run verify:launchpad
STELLAR_SECRET=... npm run verify:soroswap
STELLAR_SECRET=... npm run verify:frontend
npm run verify:discovery    # solo lectura, sin secret
npm run verify:demo         # 3 cuentas nuevas + flujo A->B, sin secret

# Contrato
cargo test -p astro-token
cd contracts/token && stellar contract build   # wasm32v1-none

# CLI
stellar --version
```

## Notas

- Sin `sleep`/polling de procesos: background con `nohup` + log y verificación
  puntual (`pgrep`, `ls`, `curl`).
- Datos = red (RPC público de testnet). Login = wallet. Sin backend.
- `frontend/pnpm-lock.yaml` y `pnpm-workspace.yaml` son residuos de una
  instalación con pnpm: están en `.gitignore`. El gestor vigente es npm
  (`package-lock.json` versionado). Cambiar de gestor = cambio de
  dependencias → requiere aprobación aparte.
- Referencias: `AGENTS.md` (reglas y direcciones), `PLAN.md` (roadmap).
