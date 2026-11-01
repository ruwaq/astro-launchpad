# Revisión del legado Astro-Shiba: qué adoptar en Floodgate

**Fecha:** 2026-11-01
**Alcance:** rama `legacy/abandoned-monorepo`, solo lectura (no se tocó su código).
**Comparación:** Floodgate actual (SPA Vite + React 19 + Soroswap + RPC directo).

## 1. Resumen ejecutivo

El legado es un producto completo: launchpad con bonding curve y graduación, AMM
propio, 8 contratos, indexer con Postgres, API GraphQL, Redis, WebSockets y un
frontend Next.js con portfolio, leaderboard, charts, i18n y PWA.

Floodgate es un MVP distinto y más sano: token SEP-41 de OpenZeppelin, Soroswap
como AMM, SPA estática en Cloudflare, wallet = identidad y la red como fuente de
verdad. **No conviene portar el backend ni el modelo de contratos del legado.**

Sí merece la pena adoptar patrones concretos:

- **Backend/indexer:** cursor persistente, idempotencia, deduplicación, detección
  de gaps, DLQ, snapshots, caché y rate limit.
- **Frontend/producto:** portfolio, historial, página de token, búsqueda/filtros,
  toasts + progreso de transacción, i18n, accesibilidad y Sentry.
- **Calidad:** tests de lógica pura y CI (el legado no tenía CI).
- **Seguridad:** headers/CSP y, más adelante, liquidity locker.

Y evitar: infraestructura obligatoria, auth JWT/passkey como flujo principal,
AMM propio, GraphQL, gamificación prematura y la deuda de tipos del legado
(246 `any` explícitos en backend, 35 en web; Floodgate tiene 0).

### Estado de adopción (Nov 2026)

- **P0 1–6**: hechos (CI, Vitest, toasts/`TxProgress`, `ErrorBoundary`,
  CSP/headers, a11y básica).
- **P1 7–10 y 12**: hechos (transfer/mint/burn, rutas, portfolio v1,
  búsqueda/filtros, actividad local y actividad on-chain reciente vía
  `getEvents`). **P1 11 (indexer)**: pendiente como Fase 2b; snapshots/charts
  locales y actividad on-chain reciente ya existen, pero sin histórico
  completo.
- **P2 13–19**: P2 15 (PWA shell offline) hecho: manifest + service worker con
  precache, network-first y caché versionada por build; no cachea RPC ni
  permite operar offline. Pendientes: metadata/IPFS, i18n, Sentry, Playwright,
  liquidity locker y creator dashboard.

## 2. Inventario del legado

### Backend

- `api-gateway-v2`: Express + Apollo GraphQL (el README dice Fastify/Mercurius:
  documentación desactualizada), Prisma/Postgres, Redis/Upstash, WebSockets,
  DataLoaders, rate limit, validación/complejidad, Sentry, métricas y health
  checks.
- `indexer`: polling cada 30 s, estado en DB, deduplicación, batch processor,
  gap detector, DLQ, reconciliación blockchain-DB y handlers por contrato.
- `shared`: schema Prisma con `Token`, `Pool`, `TokenSnapshot`, `PoolSnapshot`,
  `Transaction`, `Swap`, `LiquidityEvent`, `FeeCollection`, `IndexerState`,
  `FailedEvent`, `LedgerGap`, `User`, `Achievement`.
- Deploy: Vercel + Railway + Docker, varios scripts y configuraciones.

### Frontend

- Next.js App Router: `/`, `/explore`, `/create`, `/portfolio`, `/leaderboard`,
  `/t/[address]`, `/settings`, `/offline`.
- Componentes: trading, charts, holdings, activity feed, búsqueda global,
  historial de transacciones, progreso de transacción, subida de imagen, PWA,
  i18n (en/es/pt), accesibilidad, ErrorBoundary y gamificación.
- Calidad: Vitest, Playwright y Sentry; **sin CI** (no hay `.github`).
- Contratos: AMM propio con bonding curve, factory, launchpad token, liquidity
  locker, fee distributor, treasury vault y staking pool.

## 3. Qué adoptar (priorizado)

### P0 — Calidad y UX básica (2–4 días, sin backend)

1. **CI en GitHub Actions**: `npm ci`, `npm run check`, `cargo test -p
   astro-token`, `cargo fmt --check` y `clippy`; caché de npm/cargo. Deploy
   manual. Es la brecha más grande del proyecto actual.
2. **Vitest para lógica pura**: parser `new_pair`, `newestPairPerToken`,
   cotización/slippage, porcentaje de LP, `parseAmount`/`formatAmount` y estados
   de error. Añadir `npm test`.
3. **Toasts + progreso de transacción**: crear token (deploy → par → liquidez),
   swap, retiro y transferencia, con link a `stellar.expert`. Referencia:
   `TransactionProgress.tsx` del legado, sin framer-motion.
4. **ErrorBoundary + estados skeleton/empty/error** con mensajes accionables.
5. **Headers de seguridad/CSP en el Worker**: adaptar el CSP del legado
   (`default-src 'self'`, RPC/Horizon/WalletConnect, `frame-ancestors 'none'`,
   `nosniff`, `Referrer-Policy`, `Permissions-Policy`).
6. **Accesibilidad**: SkipLink, `aria-live` para el estado de las tx, foco en
   modales y navegación por teclado en las tarjetas del mercado.

### P1 — Producto (1–2 semanas)

7. **Transfer/mint/burn desde la UI**: el contrato ya lo soporta; hoy solo el
   modo demo transfiere. Añadir “Transferir” para wallet real y “Mint/Burn”
   solo para el owner, con confirmación.
8. **Routing y página de token**: `/market`, `/token/:id`, `/portfolio`,
   `/create` (React Router o TanStack Router). Deep links para compartir; el
   `ShareButton` actual gana sentido. La landing puede seguir siendo la
   experiencia guiada.
9. **Portfolio v1**: “Mis tokens” (creados), holdings (balance por token del
   mercado) y posiciones LP. Sin backend: `localStorage` para tokens creados +
   `useTokenBalance`/`useLpPosition` por token; con indexer, escala.
10. **Mercado**: búsqueda por nombre/símbolo/dirección, filtro “con liquidez” /
    “mis tokens” y orden por nuevo/liquidez/precio. Guardar filtros en la URL.
11. **Indexer ligero opcional** (ver §5): resolver la ventana de ~14 h y el
    límite de 9 tokens, y habilitar snapshots/histórico.
12. **Historial de actividad**: al menos local (localStorage) para operaciones
    del usuario; con indexer, global. Mostrar hash, tipo, token, monto, fecha y
    estado.

### P2 — Crecimiento y robustez

13. **Metadata off-chain** (imagen/descripción/socials): el token on-chain solo
    tiene name/symbol/decimals. Opciones: registro en el indexer verificado por
    firma del owner e imágenes en IPFS/Pinata vía Worker (nunca un JWT en el
    cliente).
14. **i18n es/en/pt**: centralizar strings ya; migrar a `react-i18next` cuando
    el producto esté estable.
15. **PWA completa**: manifest, iconos y shell offline con service worker ya
    hechos; falta un install prompt explícito y E2E offline en navegador. No se
    cachea RPC.
16. **Sentry + analytics**: Sentry opcional con DSN por env y
    `sendDefaultPii: false`; Cloudflare Web Analytics. Medir éxito de
    create/swap/liquidity/withdraw.
17. **E2E Playwright**: flujos con modo demo y RPC mockeado para CI; los
    `verify:*` on-chain siguen siendo manuales.
18. **Liquidity locker**: el legado tiene lock temporal/permanente. Es la mejora
    de seguridad más valiosa (reduce rug), pero requiere contrato nuevo, tests y
    auditoría; no antes de cerrar el MVP.
19. **Creator dashboard**: supply, owner, mint/burn, LP y fees. Depende de
    metadata/indexer.

## 4. Qué NO copiar

| Anti-patrón | Por qué |
|---|---|
| Postgres + Redis + GraphQL + WebSockets obligatorios | Convierte un MVP estático en un sistema con ops, coste y puntos de fallo; rompe el principio “sin backend”. |
| Auth JWT/passkey/API key como flujo principal | Wallet = identidad. El legado añade una segunda identidad y secretos de servidor. Passkey secp256r1 es interesante, pero es otra ruta y más complejidad. |
| Middleware de API key en producción sin que el cliente lo envíe | En el legado, el handler de Vercel no usa el middleware del Express y hay dos caminos de entrada con controles distintos: fragilidad y confusión. |
| AMM propio/bonding curve/graduación | Soroswap ya está desplegado y auditado; el AMM propio son 8 contratos y mucha superficie de auditoría. |
| GraphQL con 909 líneas de schema y 1.315 de resolvers | Overkill para el producto actual; REST/tRPC o endpoints D1 bastan. |
| 246 `any` backend / 35 web, doc drift | El legado es grande pero no es un modelo de type safety. Floodgate tiene 0 `any` explícitos: mantenerlo. |
| 4 configs de deploy, Docker/Railway/Render, scripts duplicados | Complejidad operativa sin retorno para una SPA. |
| Leaderboard, badges, streaks, sonidos, confetti | Gamificación prematura; primero el ciclo crear → liquidez → swap → portfolio. |
| Migrar a Next.js solo por SEO | Se puede resolver OG/SEO con Worker + pre-render de rutas sin cambiar de stack. |
| Config fail-open en producción | El `env.ts` del legado usa defaults si falta configuración; mejor fallar cerrado. |

## 5. Indexer ligero recomendado (si se decide)

**Objetivo:** persistir lo que el RPC olvida, sin ser fuente de verdad ni punto
único de fallo.

**Stack:** Cloudflare Worker (Cron Trigger) + D1 (SQLite) o KV; cero servidores
siempre encendidos. Alternativa: Neon/Supabase Postgres + Worker si se prefiere
SQL más cómodo.

**Tablas mínimas:**

```sql
tokens(id TEXT PRIMARY KEY, symbol, name, decimals, creator,
       created_ledger, created_at, image_url, description, website, twitter, telegram)
pairs(id TEXT PRIMARY KEY, token_id, token0, token1,
      created_ledger, reserve0, reserve1, updated_at)
reserve_snapshots(pair_id, ledger, reserve0, reserve1, price_xlm, tvl_xlm,
                  created_at, PRIMARY KEY (pair_id, ledger))
indexer_state(stream TEXT PRIMARY KEY, cursor TEXT, last_ledger INTEGER, updated_at)
failed_events(id, stream, payload, error, attempts, next_retry_at, created_at)
-- opcional: transactions/activity
```

**Flujo:**

1. Cron cada 1–5 min (testnet) o 1 min (mainnet).
2. Leer `indexer_state.cursor`; `getEvents` con cursor + filtro de la factory;
   paginar hasta agotar. Si no hay cursor, `startLedger = latest - retención +
   margen` y backfill.
3. Parsear `new_pair` (mismo `parseNewPairEvent` actual); para cada par leer
   metadata SEP-41 + `get_reserves`; upsert idempotente.
4. Insertar snapshot de reservas (dedupe por `pair_id + ledger`).
5. Detectar gaps: si `latest - last_ledger` supera el umbral o el cursor salta,
   backfill dentro de la retención; si el gap es irrecuperable, registrar en
   `failed_events`/log y avanzar.
6. Reintentos con backoff y DLQ para eventos que fallan N veces; nunca bloquear
   el cursor por un token roto.
7. API REST de solo lectura: `/api/tokens`, `/api/tokens/:id`,
   `/api/tokens/:id/history`, `/api/stats`; `Cache-Control: public, max-age=30,
   stale-while-revalidate=300`; CORS solo al dominio; rate limit de Cloudflare.
8. Frontend: intenta el indexer; si falla o está vacío, cae a `discoverPairs`
   (comportamiento actual). El indexer nunca firma ni custodia.

**Límite importante (verificado):** el par de Soroswap **no emite eventos
`swap`** (0 en 10k ledgers). Por tanto:

- Con snapshots de reservas se puede mostrar **precio/TVL en el tiempo**, no
  volumen ni trades.
- Para historial de swaps/volumen haría falta indexar operaciones
  `invoke_host_function` de Horizon (decodificar args) o un indexer externo
  (Mercury/Soroswap API). Validar disponibilidad en testnet antes de prometerlo.
- Etiquetar el chart como “precio por reservas” si es snapshot.

**Coste:** el free tier de Workers/D1 sobra para testnet; sin DB local ni Redis.

## 6. Frontend propuesto

- **Rutas:** `/` (landing actual), `/market`, `/token/:id`, `/portfolio`,
  `/create`. La landing puede seguir siendo la experiencia guiada.
- **Datos:** `lib/api.ts` con `indexerFirst` + fallback RPC; `lib/soroswap.ts` y
  `lib/discovery.ts` siguen siendo la verdad on-chain para operaciones.
- **Estado:** TanStack Query (server state) + Zustand (wallet/demo) + URL
  (token/filtros). Evitar un store global para datos on-chain.
- **UX:** toasts + `TxProgress`, skeletons, empty states, errores accionables,
  links al explorer y confirmaciones para mint/burn/transfer.
- **Seguridad:** sanear metadata (nombres/símbolos/URLs), no renderizar HTML de
  tokens, `rel="noreferrer"`, CSP, validar address/amount y no meter secretos en
  el bundle.
- **SEO/PWA:** manifest y service worker offline shell ya existen; añadir
  `robots.txt`, `sitemap.xml` generado desde el indexer y OG meta por token vía
  Worker. No migrar a Next.
- **Tests:** Vitest para lógica; Playwright para flujos UI con RPC mock; los
  `verify:*` on-chain siguen siendo manuales.

## 7. Roadmap sugerido

| Fase | Entregables | Criterio de salida |
|---|---|---|
| 0 (2–4 días) | CI, Vitest, ErrorBoundary, toasts/tx progress, CSP, a11y básica | `check` + tests en CI; flujo demo con feedback claro |
| 1 (1–2 semanas) | Transfer/mint UI, routing, token detail, portfolio v1, búsqueda/filtros | Crear → transferir → swap → portfolio sin backend |
| 2 (2–3 semanas) | Indexer Worker+D1, snapshots, API, charts de reservas, Sentry/analytics | Mercado >14 h/9 tokens; fallback RPC intacto |
| 3 (después) | Metadata/IPFS, i18n, install prompt/E2E PWA, E2E, liquidity locker, creator dashboard | Producto listo para mainnet/auditoría |

## 8. Decisiones pendientes

- **¿Indexer ya o esperar?** Si el objetivo es demo/testnet, el mercado actual de
  14 h/9 tokens puede bastar; el indexer añade valor cuando haya más tokens o se
  quieran charts/portfolio global.
- **¿Charts?** Sin swap events, decidir si se acepta “precio por reservas” o se
  invierte en indexar Horizon/Mercury.
- **¿Metadata?** Es la feature que más “se ve” (imagen/descripción), pero
  requiere decidir dónde vive (indexer/IPFS) y cómo se verifica al owner.
- **¿Liquidity locker?** Buen diferenciador de seguridad, pero es contrato nuevo
  + auditoría.

## 9. Referencias del legado

- `backend/indexer/src/lib/{state-manager,event-deduplication,ledger-gap-detector}.ts`
- `backend/indexer/src/services/{dead-letter-queue,batch-processor}.ts`
- `backend/shared/prisma/schema.prisma`
- `backend/api-gateway-v2/src/lib/{cache,rate-limiter,loaders}.ts`
- `apps/web/src/components/{TransactionProgress,portfolio/HoldingsSection,search/GlobalSearch,activity/LiveActivityFeed}.tsx`
- `apps/web/src/app/{portfolio,leaderboard,t/[address]}/page.tsx`
- `contracts/liquidity-locker/src/lib.rs`, `contracts/fee-distributor/src/lib.rs`
- `apps/web/FRONTEND_AUDIT_REPORT.md`, `backend/AUDIT_REPORT.md`
