# Estado actual (para continuar en la próxima sesión)

## Handoff rápido (Oct 22 2026, sesión 5)

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
     Vite SSR y ejecuta en testnet: pool → cotización → swap → liquidez, y el
     camino completo token nuevo → par → liquidez → swap.
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
| Render UI | `npm run smoke:render` | OK |
| Contrato | `cargo test -p astro-token` | 6/6 |
| Deploy + spec | `npm run verify:launchpad` | OK |
| AMM on-chain | `npm run verify:soroswap` | OK |
| Camino del frontend | `npm run verify:frontend` | OK |

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
   en `:5173` hay que probar con wallet (Freighter) el flujo completo.
2. **Deploy en Vercel** (testnet online, es el objetivo del proyecto).
3. UI/UX del roadmap: charts, toasts, responsive. (El listado de tokens ya
   está: `MarketList`, descubierto de eventos de la factory.)
4. Mint/transfer de tokens desde la UI (el contrato ya los soporta).
5. CI en GitHub Actions (el repo no tiene workflows).

## Comandos

```bash
export PATH="$HOME/.local/bin:$HOME/.cargo/bin:$PATH"

# Frontend
cd frontend
npm run dev                 # :5173
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
