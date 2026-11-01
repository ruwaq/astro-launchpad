# Floodgate 🌊 (Launchpad de Stellar, Minimal MVP)

Launchpad + AMM sobre Stellar/Soroban: crea tu token, añádele liquidez contra
XLM, swapea y retira tu liquidez, todo on-chain en testnet. Sin backend de
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
  Incluye un listado de mercado que descubre pares token/XLM leyendo los
  eventos `new_pair` de la factory (sin índice ni backend), swap y gestión de
  la posición de liquidez (añadir, ver LP y retirar).

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
npm run check          # build + lint + smoke de render (sin red)
npm run build          # tsc + vite build
npm run lint           # oxlint
npm run smoke:render   # render del árbol de componentes (sin navegador)
npm run bindings       # regenera los bindings TS desde los contratos on-chain

# Verificaciones on-chain (necesitan STELLAR_SECRET de una cuenta de testnet)
npm run verify:launchpad   # despliega un token nuevo y lo lee
npm run verify:soroswap    # par, liquidez, cotización y swap
npm run verify:frontend    # el mismo código que la UI, de punta a punta

# Solo lectura (sin secret): parser de eventos + descubrimiento real
npm run verify:discovery

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

## Móvil y deploy (Cloudflare Workers)

- **PWA instalable**: manifest (`frontend/public/manifest.webmanifest`),
  `theme-color` e iconos PNG (`icon-192.png`/`icon-512.png`, rasterizados con
  ImageMagick desde `frontend/scripts/assets/brand-icon.svg`). En el teléfono:
  menú del navegador → *Añadir a la pantalla de inicio*.
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

## Servicios locales

Opcionales y no requeridos: el flujo de usuario no depende de ellos.
