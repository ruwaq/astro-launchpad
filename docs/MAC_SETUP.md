# Empezar en macOS — Floodgate 🌊

Guía para pasar este proyecto de Termux (Android) a un Mac y saber en qué punto
está sin reconstruir contexto.

## Dónde vive el proyecto

| Dato | Valor |
|---|---|
| Cuenta GitHub | `ruwaq` |
| Repo | <https://github.com/ruwaq/astro-launchpad> |
| Remoto | `origin` → `https://github.com/ruwaq/astro-launchpad.git` |
| Rama de trabajo | `ai/market-discovery` |
| PR abierto | #1, base `floodgate/testnet-base` |
| Autor de los commits | `Ruwaq <pepepop2000@gmail.com>` |

`main` en GitHub es el monorepo legacy sin ancestro común: **no** hacer merge ni
reset contra `main`. Todo el trabajo vive en `ai/market-discovery`.

Estado detallado y decisiones de cada sesión: `STATUS.md` (el handoff más
reciente está arriba). Arquitectura y roadmap: `PLAN.md`.

## Prerequisites (una sola vez)

```bash
xcode-select --install
brew install node@22
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup target add wasm32v1-none
brew install stellar-cli
```

Comprobar: `node -v` (v22.x), `cargo -V`, `rustup target list --installed`
(incluye `wasm32v1-none`) y `stellar --version` (28.x).

## Clonar y arrancar

```bash
git clone https://github.com/ruwaq/astro-launchpad.git
cd astro-launchpad
git checkout ai/market-discovery

cd frontend
npm ci              # usa package-lock.json; no npm install
npm run check       # build + lint + 60 tests + smoke + verify:pwa
npm run dev         # http://localhost:5173
```

Contrato (solo si vas a tocarlo):

```bash
cargo test -p astro-token
cd contracts/token && stellar contract build   # wasm32v1-none
```

## Qué NO viaja en el repo (rehacer en el Mac)

| Cosa | Por qué | Cómo |
|---|---|---|
| `frontend/node_modules/`, `target/`, `dist/` | ignorados | `npm ci` / `cargo test` / `npm run build` |
| Cuentas del **modo prueba** | semillas en `localStorage` | crear 3 cuentas desde la app, o `npm run verify:demo` |
| `frontend/.env.local` | no versionado (solo `.env.example`) | `VITE_WC_PROJECT_ID=...` si usas WalletConnect |
| `frontend/.vercel/` | link local del proyecto | `npx vercel link` si despliegas desde el Mac |
| `STELLAR_SECRET` | nunca al repo | `STELLAR_SECRET=S... npm run verify:frontend` |
| Wallet (Freighter/xBull) | llaves del navegador | importar la semilla de testnet en el Mac |

⚠️ Nunca pongas el secret en `frontend/.env*` ni con prefijo `VITE_`: Vite mete
esas variables en el bundle público. Usa solo cuentas de testnet desechables.

## Verificación mínima tras clonar

```bash
cd frontend
npm run check            # debe pasar entero, sin red
npm run verify:discovery # solo lectura contra el RPC de testnet
```

Las verificaciones con red y sin secretos (`verify:demo`,
`verify:token-events`) crean cuentas nuevas con Friendbot: no necesitan nada
del Termux.

## Contexto de la última sesión (Nov 2 2026)

Objetivo: que se entienda el flujo **crear token → añadir liquidez → mercado**.

- `CreatePage`: stepper de 3 pasos (crear, liquidez, mercado).
- `CreateTokenForm`: tras desplegar, CTA "Añadir liquidez ahora" (ancla
  `#add-liquidity`), enlace "Ver el token" y share con la URL de la app.
- `LiquidityForm`: ancla `add-liquidity` con `scroll-mt-20`.
- Se quitó un `import { Link }` sin usar en `LiquidityForm` que rompía `tsc`.
- Gates: `npm run check` verde (60 tests).

Pendiente inmediato:
1. Probar el flujo completo en navegador real (modo prueba o wallet).
2. Decidir si tras añadir liquidez se muestra un enlace a `/token/:id` y a
   `/market` (la intención original del import retirado).
3. `wrangler login` para el Worker real; GitHub Actions sigue deshabilitado.
