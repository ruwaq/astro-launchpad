# AGENTS.md — Astro Launchpad (Minimal, Descentralizado, Online)

## Contexto del proyecto
Launchpad + AMM sobre Stellar/Soroban. Minimalista, descentralizado, desplegado en testnet online.
Identidad = wallet. Datos = red (Soroban RPC / Horizon). Sin backend de usuarios obligatorio.

## Stack
- Contratos: Rust + Soroban SDK + OpenZeppelin Stellar (fungible SEP-41).
- AMM: Soroswap (factory/router ya desplegados en testnet).
- Frontend: Vite + React 19 + TypeScript (Scaffold Stellar), Tailwind + shadcn/ui.
- Wallet: @creit.tech/stellar-wallets-kit.
- Deploy frontend: Vercel. Datos: RPC público testnet.

## Reglas
1. No reinventar AMM: usar Soroswap factory/router.
2. Login = wallet. No JWT/backend auth tradicional.
3. Obtener datos directamente de la red cuando sea posible (Soroban RPC getEvents, contratos).
4. Todo para producción testnet online: nada dependiente de servicios locales en el flujo de usuario.
5. Servicios locales (Postgres/Redis) son opcionales para dev, no requeridos para el MVP.
6. Usar Stellar CLI + Scaffold Stellar para contratos y bindings TS.
7. No usar `sleep` para esperar procesos; usar background + verificación puntual.

## Red (testnet)
- RPC: https://soroban-testnet.stellar.org
- Horizon: https://horizon-testnet.stellar.org
- Soroswap Factory: CDP3HMUH6SMS3S7NPGNDJLULCOXXEPSHY4JKUKMBNQMATHDHWXRRJTBY
- Soroswap Router: CCJUD55AG6W5HAI5LRVNKAE5WDP5XGZBUDS5WNTIVDU7O264UZZE7BRD
- XLM SAC: CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC
- Token del launchpad: CAI637WCEILQF3ZYOV6BRUCX532XQIVOOJ4CRWFPWHQRJHOH5OKHSXRE
- wasm hash del token (ya subido): 438d12a79855dd42c353d12bb42e6b57ed513eed47b7008094683ba33f971286
- Par ASTRO/XLM: CA32TMZ2AODXI7K7B6T2YPZR52HJKFCY5GT2DNHMOL326DLSNPX55BUP

## Comandos
- PATH: `export PATH="$HOME/.local/bin:$HOME/.cargo/bin:$PATH"`
- Stellar CLI: `stellar` (wrapper en `~/.local/bin/stellar`; binario oficial
  28.1.0 en `~/.local/opt/stellar` + libs glibc en `~/.local/opt/glibc-libs/lib`).
  Verificar: `stellar --version`.
- Frontend (`cd frontend`): `npm run dev` (:5173) · `npm run build` ·
  `npm run lint` · `npm run smoke:render` · `npm run bindings`.
- On-chain (`STELLAR_SECRET` obligatorio): `npm run verify:launchpad` ·
  `npm run verify:soroswap` · `npm run verify:frontend`.
- Contrato: `cargo test -p astro-token` · build wasm:
  `cd contracts/token && stellar contract build` (target `wasm32v1-none`).
- Servicios opcionales: `dev-up` / `dev-down`.

## Trampas de Soroswap (verificadas on-chain)
- Cotizar con `router_get_amount_out(amount_in, reserve_in, reserve_out)`;
  `router_get_amounts_out` devuelve el input sin cotizar.
- No hace falta allowance: el router usa `transfer`, no `transfer_from`.
- `deadline` = unix timestamp + 300 (vale bajo cualquier interpretación).
- `get_reserves` va en el orden `token_0 < token_1`: usar `sort_tokens`.
- Todo contrato de Soroswap devuelve `Result<T, E>`: desenvolver con
  `isErr()`/`unwrap()`, nunca leer `.result` dos veces.


## Procesos largos
- Lanzar en background con `nohup ... &`, guardar PID/log.
- Verificar con `pgrep` / `ls` binario, sin polling con sleep.
- Preferir binarios precompilados o features opcionales en Termux (sin libudev).

## AI Agent Operating Rules (2026)
- Tratar al agente como junior: propone, no decide. Draft PRs only.
- Human-in-the-loop obligatorio; CI ruthlessly (tests, lint, security, format).
- Scope binding antes de ejecutar; no tocar fuera del scope.
- Provenance: etiquetar AI-generated, guardar run record (tarea, ref, permisos, modelo).
- Ground-truth receipts (git/disco), no self-report.
- Código aburrido > clever; funciones pequeñas; sin over-abstraction.
- Separar exploración read-only de acciones state-changing.
- Cambios de dependencias = aprobación distinta.
- Track rework-to-delivery; detener si revalida en vez de ship.

## Verificación (sin sleep)
- Frontend: `cd frontend && npm run build && npm run lint && npm run smoke:render`
- On-chain: `cd frontend && STELLAR_SECRET=... npm run verify:frontend`
- Contrato: `cargo test -p astro-token`
- CLI: `stellar --version`
- Servicios: `pgrep -x postgres; pgrep -x redis-server; redis-cli ping`
