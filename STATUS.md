# Estado actual (para continuar en la próxima sesión)

## Handoff rápido (Oct 22 2026, sesión 3)
- Entorno activo: Ter Mux — proyecto en `~/projects/astro-launchpad`, todo commiteado en main.
- **Token desplegado en testnet**: `CAI637WCEILQF3ZYOV6BRUCX532XQIVOOJ4CRWFPWHQRJHOH5OKHSXRE`
  (wasm hash `438d12a7…1286` ya subido a la red: el launchpad crea instancias nuevas
  sin resubir binario).
- stellar-cli compilado en `~/.local/opt/stellar`. PENDIENTE: falla 
  `libdbus-1.so.3 not found` → `pkg install dbus` (hubo procesos que sí corrieron,
  revisar tras instalar).
- Bindings TS regenerados desde contratos on-chain: `npm run bindings`
  (token raíz + `soroswap-router/` + `soroswap-factory/`, con patch TS estricto).
- Frontend cableado de punta a punta (ver abajo); `npm run build` verde;
  dev server en `:5173` (nohup, sobrevive al cierre de la app).

## Completado (sesión 3 — hoy 11:20→14:13)
1. **stellar-cli** (`cargo install --locked stellar-cli` terminó OK; binario
   movido a `~/.local/opt/stellar`). Con él: wasm subido + token deployed.
2. **Bindings on-chain** (`frontend/scripts/`):
   - `generate-bindings.mjs`: token + Soroswap router/factory vía CLI del JS SDK,
     aplanado a `out/client.ts|types.ts|index.ts`.
   - `patch-bindings.mjs`: imports de tipos, property-parameter del constructor,
     unused imports, alias `export type X = {message:string}` para enums de error
     (fix de TS2749). Idempotente, integrado en `npm run bindings`.
3. **Frontend** (`frontend/src/`):
   - `store/wallet.ts` (zustand) + `components/WalletButton.tsx` (stellar-wallets-kit).
   - `hooks/useTokenInfo.ts` + `useTokenBalance.ts` (TanStack Query contra RPC).
   - `lib/network.ts` (red + Soroswap + token/wasm-hash), `format.ts`, `signer.ts`,
     `token.ts`.
   - `components/TokenInfoCard.tsx` + `CreateTokenForm.tsx` (despliegue por
     `Client.deploy` con wasm hash, camino igual que el smoke).
   - `App.tsx` reescrita; Trash CSS→Tailwind (App.css eliminado),
     `main.tsx` con QueryClientProvider; título "Astro Launchpad".
   - `package.json`: deps `@stellar/stellar-sdk@17`, `@tanstack/react-query`,
     `zustand`; scripts `bindings` + `verify:launchpad`; oxlint ignora bindings.
4. **Smoke script** `scripts/verify-launchpad.mjs`: compara spec embebido vs
   on-chain, prueba args del constructor, despliega instancia nueva y lee datos.
   Está sin correr aún: necesita `STELLAR_SECRET` (cuenta fondeada).
5. Diagnosis extra: el generador emite enums de error como `const` y el cliente
   los usa como tipo → TS2749; lo parchea `patch-bindings.mjs`.

## Próximos pasos (en orden)
1. **Soroswap** (paso en el que se cortó): crear par token/XLM vía factory +
   `add_liquidity` vía router (bindings nuevos en `src/contracts/soroswap-*`),
   con `increase_allowance` del token al router. UI: panel de liquidez después
   de crear token en `CreateTokenForm`.
2. `npm run verify:launchpad` con `STELLAR_SECRET` fondeado en testnet.
3. Fix stellar CLI: `pkg install dbus` y verificar `stellar --version`.
4. Frontend → Vercel (deploy testnet online).

## Diagnóstico clave (sesión 2, sigue vigente)
- `soroban-sdk 28 build.rs` exige env de stellar-cli v25.2+ para wasm
  (`SOROBAN_SDK_BUILD_SYSTEM_SUPPORTS_SPEC_SHAKING_V2`); NO bypass, build con
  `stellar contract build` y target `wasm32v1-none`.
- Dist oficial de rust no publica rustc/cargo para aarch64-linux-android;
  `rustup` no funciona en Termux (rustls-platform-verifier). Targets con el
  pkg de Termux (`rust-std-wasm32v1-none`).
- stellar-cli prebuilt oficial solo darwin/linux-glibc: no corre nativo en
  Termux (bionic) → por eso va compilado localmente. Alternativas: VM Debian
  (pausa) o CI GitHub Actions (repo `ruwaq/astro-launchpad`, gh sin login).
- Residuales: `frontend/pnpm-workspace.yaml` + `pnpm-lock.yaml` de una prueba
  pnpm sin usarse; npm es el gestor vigente (package-lock.json).

## Comandos útiles
- `vibe` · dev: `cd frontend && npm run dev`
- bindings: `cd frontend && npm run bindings`
- smoke: `cd frontend && STELLAR_SECRET=S... npm run verify:launchpad`
- build/lint: `npm run build` · `npm run lint` · contrato: `cargo test -p astro-token`
- CLI: `~/.local/opt stellar` (si falla libdbus → `pkg install dbus`)
- Verificación puntual sin sleep: `pgrep -af stellar-cli; ls ~/.cargo/bin/stellar`

## Notas
- No usar sleep/polling; verificación puntual, background con nohup + log.
- Datos = red (RPC público testnet). Login = wallet. Sin backend de usuarios.
- Referencias: AGENTS.md (red/direcciones), PLAN.md (roadmap).
