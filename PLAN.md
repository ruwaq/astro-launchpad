# Astro Launchpad — Plan de reorientación (Minimalista, Descentralizado, Online)

## Objetivo
Mostrar un proyecto funcional, útil y divertido: **Launchpad + AMM** sobre Stellar/Soroban,
con buena UI/UX, escalable, descentralizado, desplegado en **testnet online**.
Empezar simple y crecer.

## Principios
- Descentralizado: identidad = wallet (Freighter/xBull/etc.), sin backend de auth tradicional.
- No reinventar la rueda: usar primitivas y contratos ya auditados de la comunidad.
- Minimalista primero: MVP pequeño end-to-end, luego iterar.
- Todo para producción testnet online: deploy en Vercel, RPC público, sin dependencias locales.
- Obtener datos directamente de la red (Soroban RPC / Horizon) siempre que sea posible.

## Stack propuesto (2026)
### Contratos (Rust/Soroban)
- Token: OpenZeppelin Stellar `fungible` (SEP-41) con metadata + mint/burn.
- AMM/Liquidez: Soroswap (factory + router ya desplegados en testnet/mainnet). No AMM custom.
- Launchpad: orquestación en frontend (crear token → crear par en Soroswap).
  Más adelante: contrato launchpad ligero para fees/bonding si se requiere.

### Frontend (deploy en Vercel)
- Scaffold Stellar template: Vite + React 19 + TypeScript.
- UI: Tailwind CSS + shadcn/ui.
- Estado: TanStack Query + Zustand.
- Wallet: @creit.tech/stellar-wallets-kit (login con wallet).
- Charts: lightweight-charts.
- Datos: Soroban RPC público + Horizon. Sin backend propio inicialmente.

### Backend (solo si es necesario, serverless/cloud)
- No Postgres/Redis locales. Si se necesita persistencia/indexación:
  - Usar servicios cloud gratuitos (Supabase/Upstash) o indexers existentes (Mercury, Soroswap API).
  - Serverless functions (Vercel) para tareas puntuales.
- Preferir obtener eventos directamente vía Soroban RPC (getEvents) y caché en memoria/IndexedDB.

### Tooling / Dev
- Stellar CLI (instalando) para deploy y generación de bindings TS.
- Scaffold Stellar (`stellar scaffold`).
- Vitest (frontend), cargo test (contratos).
- ESLint + Prettier + rustfmt + clippy.

## Red inicial
- Testnet (Soroswap factory/router ya desplegados).

## Direcciones clave (testnet)
- Soroswap Factory: CDP3HMUH6SMS3S7NPGNDJLULCOXXEPSHY4JKUKMBNQMATHDHWXRRJTBY
- Soroswap Router: CCJUD55AG6W5HAI5LRVNKAE5WDP5XGZBUDS5WNTIVDU7O264UZZE7BRD
- XLM SAC: CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC
- RPC público: https://soroban-testnet.stellar.org
- Horizon público: https://horizon-testnet.stellar.org

## Roadmap incremental
1. Entorno listo: Stellar CLI, Scaffold. — **hecho**
2. Scaffold proyecto base (contracts + frontend) y verificar build/dev. — **hecho**
3. Contrato token (OpenZeppelin fungible) + tests. — **hecho** (6/6)
4. Deploy token en testnet + generar bindings. — **hecho**
   (token `CAI637WCEILQF3ZYOV6BRUCX532XQIVOOJ4CRWFPWHQRJHOH5OKHSXRE`,
   wasm hash `438d12a7…1286` ya subido: el launchpad crea instancias nuevas)
5. Frontend: conectar wallet (login), ver balances desde la red. — **hecho**
6. Integrar Soroswap: crear par token/XLM y swap (todo on-chain). — **hecho**
   (par `CA32TMZ2AODXI7K7B6T2YPZR52HJKFCY5GT2DNHMOL326DLSNPX55BUP`;
   UI de liquidez + swap)
7. UI/UX: listado de tokens (**hecho**: eventos `new_pair` de la factory),
   búsqueda/orden, rutas y detalle de token, portfolio, transferir/quemar/
   mintear, toasts y responsive. — **hecho** (deploy online en Cloudflare
   Workers; `vercel.json` se conserva como alternativa). Charts locales:
   **hecho** en Fase 2a; histórico global: Fase 2b.
8. Indexación ligera para histórico global (eventos RPC o servicio existente)
   solo si se aprueba la infraestructura (Fase 2b).
9. Escalar: monorepo, CI/CD, mainnet.

## Dirección del roadmap tras la sesión 5
- El flujo end-to-end ya funciona on-chain en testnet: crear token → crear par
  → añadir liquidez → cotizar → swap, más un listado de mercado descubierto de
  los eventos `new_pair` de la factory. Lo que falta es producto (gráficos,
  feedback, responsive) y publicación (Vercel).
- Decidido: el listado sale de `getEvents` del RPC, sin backend. Limitación
  asumida: ventana de retención de eventos (~14 h) y 9 tokens por carga. Un
  indexer solo hará falta si se quiere histórico completo.
- CI añadida (GitHub Actions): `npm run check` (build + lint + tests +
  smoke), `cargo fmt --check`, `cargo clippy -D warnings` y
  `cargo test -p astro-token`.


## Estado Nov 2026 (Fase 0/1/2a completadas)

- **Fase 0**: CI + Dependabot, Vitest, toasts accesibles, `TxProgress`,
  `ErrorBoundary`, a11y (skip link, foco, reduced-motion), CSP/security headers
  en Cloudflare y Vercel.
- **Fase 1**: rutas `/`, `/market`, `/token/:id`, `/portfolio`, `/create`;
  búsqueda/orden del mercado; detalle con swap, liquidez, transferir, quemar y
  mintear (solo owner); portfolio v1 con creaciones locales y holdings.
- **Fase 2a**: snapshots de reservas en `localStorage` + gráfico SVG de
  precio/liquidez en el detalle de token. Polling del pool cada 60 s; cambios
  al instante y pulso cada ~5 min. La UI avisa de que es historial local, no
  global.
- **Siguiente (Fase 2b)**: indexer ligero para histórico global. El par de
  Soroswap no emite `swap`; el indexer es necesario para reconstruir precios
  anteriores. Requiere recursos/credenciales Cloudflare y aprobación.

## Entorno local (Termux) — solo para desarrollo
- Proyecto: ~/projects/astro-launchpad (symlink ~/workspace/astro-launchpad)
- Stellar CLI 28.1.0 oficial (glibc) en `~/.local/opt/stellar`, wrapper en
  `~/.local/bin/stellar`; `rustup` con target `wasm32v1-none`.
- Servicios locales (Postgres/Redis) opcionales, no requeridos para el MVP descentralizado.

## Notas
- El monorepo anterior se preservó en la rama `legacy/abandoned-monorepo`.
- Login = wallet. No hay backend de usuarios.
- Datos = red. No hay DB obligatoria.
