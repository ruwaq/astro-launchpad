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
1. Entorno listo: Stellar CLI, Scaffold.
2. Scaffold proyecto base (contracts + frontend) y verificar build/dev.
3. Contrato token (OpenZeppelin fungible) + tests.
4. Deploy token en testnet + generar bindings.
5. Frontend: conectar wallet (login), mint/transfer token, ver balances desde la red.
6. Integrar Soroswap: crear par token/XLM y swap (todo on-chain).
7. UI/UX: listado de tokens, trading, charts, toasts, responsive, deploy Vercel.
8. Indexación ligera (eventos RPC o servicio existente) solo si se necesita.
9. Escalar: monorepo, CI/CD, mainnet.

## Entorno local (Termux) — solo para desarrollo
- Proyecto: ~/projects/astro-launchpad (symlink ~/workspace/astro-launchpad)
- Stellar CLI: instalando vía cargo (~/.cargo/bin).
- PATH configurado en ~/.zshrc.
- Servicios locales (Postgres/Redis) opcionales, no requeridos para el MVP descentralizado.

## Notas
- El monorepo anterior se preservó en la rama `legacy/abandoned-monorepo`.
- Login = wallet. No hay backend de usuarios.
- Datos = red. No hay DB obligatoria.
EOF
echo "PLAN updated"