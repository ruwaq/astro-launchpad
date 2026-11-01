# Estado actual (para continuar en la próxima sesión)

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
  P2 (metadata/IPFS, i18n, PWA offline, Sentry/analytics, E2E, locker). El
  indexer requiere recursos/credenciales Cloudflare y aprobación.

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
- **PWA instalable**: `public/manifest.webmanifest`, `theme-color`,
  `apple-touch-icon` e iconos `icon-192.png`/`icon-512.png` rasterizados con
  ImageMagick desde `scripts/assets/brand-icon.svg` (olsa emerald/cyan).
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
