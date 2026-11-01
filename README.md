# Floodgate 🌊 (Launchpad de Stellar, Minimal MVP)

Launchpad + AMM sobre Stellar/Soroban: crea tu token, añádele liquidez contra
XLM, compra o vende y retira tu liquidez, todo on-chain en testnet. Sin backend de
usuarios: la identidad es la wallet y los datos se leen de la red.

**Nombre de la marca:** *Floodgate* viene del código interno de `stellar-core`
(`Floodgate`, `src/overlay/Floodgate.cpp`): la compuerta que inunda la red con
las transacciones de los peers hasta que el ledger cierra. Fuente única de la
marca: `frontend/src/lib/brand.ts`. **El token de ejemplo (ASTRO) no cambia.**

Ver `PLAN.md` para arquitectura y roadmap, `STATUS.md` para el estado actual.

## Qué hay

- `contracts/token/` — contrato de token fungible SEP-41 (OpenZeppelin Stellar),
  compilado a wasm y **ya desplegado en testnet**. El launchpad crea instancias
  nuevas de ese mismo wasm (cada token es su propio contrato).
- `frontend/` — Vite + React 19 + TypeScript. Lee de Soroban RPC público, firma
  con la wallet (`@creit.tech/stellar-wallets-kit`) y usa Soroswap como AMM.
  Incluye rutas compartibles, un listado de mercado que descubre pares
  token/XLM leyendo los eventos `new_pair` de la factory (sin índice ni
  backend), búsqueda/orden, detalle de token con compra/venta contra XLM,
  impacto de precio, liquidez, transferir, quemar y mintear (solo owner),
  portfolio local con tokens creados y holdings
  recientes, gráfico de precio/liquidez con snapshots locales del par,
  historial local de actividad de las operaciones y actividad on-chain reciente
  del token (transfer/mint/burn) leída de `getEvents`.
- **Modo prueba sin wallet**: crea 3 cuentas desechables de testnet fondeadas
  por Friendbot y permite cambiar entre ellas para probar todo el ciclo como
  usuarios distintos, incluido pasar tokens de una cuenta a otra. Sin instalar
  ni conectar ninguna wallet.

## Rutas

- `/` — inicio, guía, modo prueba, mercado reciente y swap del token elegido.
- `/market` — mercado completo con búsqueda y orden.
- `/token/:id` — detalle on-chain del token, sus acciones, gráfico local y
  actividad on-chain reciente.
- `/portfolio` — tokens creados + holdings recientes + actividad local.
- `/create` — crear token SEP-41 y añadir liquidez en Soroswap.

## Dev rápido

```bash
export PATH="$HOME/.local/bin:$HOME/.cargo/bin:$PATH"

cd frontend
npm install
npm run dev          # http://localhost:5173
```

## Comandos

```bash
# Frontend
npm run check          # build + lint + tests + smoke + verify:pwa (sin red)
npm run build          # tsc + vite build + estampado del service worker
npm run lint           # oxlint
npm test               # Vitest (formato, mercado, AMM, eventos, snapshots, actividad)
npm run smoke:render   # render del árbol de componentes (sin navegador)
npm run verify:pwa     # artefactos PWA: manifest, SW estampado y registro
npm run bindings       # regenera los bindings TS desde los contratos on-chain

# Verificaciones on-chain (necesitan STELLAR_SECRET de una cuenta de testnet)
npm run verify:launchpad   # despliega un token nuevo y lo lee
npm run verify:soroswap    # par, liquidez, cotización y swap
npm run verify:frontend    # el mismo código que la UI, de punta a punta

# Solo lectura / cuentas nuevas (sin secret)
npm run verify:discovery     # parser de eventos + descubrimiento real
npm run verify:token-events  # transfer/mint/burn reales del token
npm run verify:demo          # cuentas nuevas: crear, liquidez, vender, comprar, mint y burn

# Contrato
cargo test -p astro-token
cd contracts/token && stellar contract build
```

## Testnet

- RPC: https://soroban-testnet.stellar.org
- Token del launchpad: `CAI637WCEILQF3ZYOV6BRUCX532XQIVOOJ4CRWFPWHQRJHOH5OKHSXRE`
- wasm hash (ya subido a la red): `438d12a79855dd42c353d12bb42e6b57ed513eed47b7008094683ba33f971286`
- Soroswap factory: `CDP3HMUH6SMS3S7NPGNDJLULCOXXEPSHY4JKUKMBNQMATHDHWXRRJTBY`
- Soroswap router: `CCJUD55AG6W5HAI5LRVNKAE5WDP5XGZBUDS5WNTIVDU7O264UZZE7BRD`
- XLM SAC: `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC`

Direcciones y trampas de Soroswap: `AGENTS.md`.

## Modo prueba sin wallet

El panel **Modo prueba · sin wallet** crea 3 cuentas nuevas de testnet
fondeadas con 10 000 XLM cada una (Friendbot) y permite cambiar entre A/B/C.
Cada cuenta firma con `KeypairSigner`, así que se puede probar crear token,
liquidez, compra/venta, retiro y transferencias entre usuarios sin instalar
wallet. `verify:demo` ejecuta el ciclo completo, incluida una compra real de
tokens pagando XLM por el router de Soroswap.

**Seguridad:** son claves de testnet sin valor real, guardadas en
`localStorage` de este navegador (visibles para cualquiera con acceso a él).
No reutilizar este patrón para fondos reales.

## Swap: compra y venta

El detalle de token permite las dos direcciones contra XLM: **vender token**
(token → XLM) y **comprar token** (XLM → token). La cotización sale del router
con las reservas reales, se exige un mínimo de salida con slippage del 2% y se
muestra el impacto de precio contra la salida spot (incluye la comisión). En
compras, MAX deja 1 XLM para fees/reserva y se valida el balance nativo antes
de firmar.

## Historial de precio y liquidez (local)

El par de Soroswap **no emite eventos `swap`**, así que el RPC no permite
reconstruir el histórico. Mientras no haya un indexer, el detalle de token
guarda snapshots de las reservas en `localStorage` mientras abres esa página:
los cambios se apuntan al instante, hay un pulso cada ~5 min y se conservan
como máximo 288 snapshots por token (30 tokens). El gráfico muestra precio o
liquidez y avisa de que solo cubre lo que ha visto este navegador; no es un
histórico global ni sustituye a un indexer.

## Actividad local

Las operaciones firmadas (crear token, añadir/retirar liquidez, swap,
transferir, mintear y quemar) se guardan en `localStorage` con tipo, estado,
token, montos, cuenta, hash, fecha y error si falló. `/portfolio` muestra las
últimas 200 y enlaza cada hash a `stellar.expert`. También es local: sirve como
historial de este navegador, no como feed global (eso requiere indexer).

## Actividad on-chain reciente

El detalle de token lee `getEvents` del contrato para mostrar transferencias,
emisiones y quemas de la ventana reciente del RPC (~14 h), con monto, cuentas,
fecha y enlace a la transacción. Es actividad global, no del usuario, pero
sigue siendo una ventana: no reconstruye el histórico. El par de Soroswap no
emite `swap`, así que los swaps no aparecen como tales (sí sus transferencias
de token). El histórico completo sigue necesitando un indexer (Fase 2b).

## Móvil y deploy (Cloudflare Workers)

- **PWA instalable + shell offline**: manifest
  (`frontend/public/manifest.webmanifest`), `theme-color` e iconos PNG
  (`icon-192.png`/`icon-512.png`, rasterizados con ImageMagick desde
  `frontend/scripts/assets/brand-icon.svg`). El service worker
  (`frontend/public/sw.js`) precarga index/assets y usa navegación
  network-first con fallback al shell; los assets llevan cache-first y **nunca**
  se cachean RPC, Horizon ni wallet. `stamp-sw.mjs` versiona la caché por build
  y `register-sw.ts` solo registra en producción. Si no hay red, un banner
  avisa: el shell y el historial local abren, pero las operaciones necesitan
  conexión. En el teléfono: menú del navegador → *Añadir a la pantalla de
  inicio*.
- **Wallets móviles (WalletConnect v2)**: activar con `VITE_WC_PROJECT_ID`
  (proyecto gratis en <https://cloud.reown.com>); ver `.env.example`. La app
  firma con `signTransaction`, que el módulo WC cubre.
- **Deploy actual** (assets estáticos en un Worker; el fallback SPA lo da
  `not_found_handling` en `frontend/wrangler.jsonc`):
  ```bash
  export CLOUDFLARE_API_TOKEN=...   # token con permiso de Workers
  cd frontend
  npm run deploy                    # build + wrangler deploy
  ```
  Producción: <https://floodgate-stellar.pepepop2000.workers.dev>.
  `vercel.json` se conserva como alternativa (framework vite, output `dist`).
- **Seguridad de despliegue**: `public/_headers` (Cloudflare) y `vercel.json`
  aplican CSP, HSTS, `nosniff`, `frame-ancestors`, Permissions-Policy y caché
  inmutable para `/assets/*`.

## Servicios locales

Opcionales y no requeridos: el flujo de usuario no depende de ellos.
