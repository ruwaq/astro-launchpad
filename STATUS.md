# Estado actual (para continuar en la próxima sesión)

## Handoff rápido (Oct 2026)
- **Entorno activo: Termux** — el proyecto vive en `~/projects/astro-launchpad`,
  opencode local funciona (TUI con botones extra-keys ya configurados).
  Ejecutar: `vibe` (= entra al repo y abre opencode).
- **VM Debian (AVF Terminal): en pausa** (ver "Notas" abajo). No bloquea nada del MVP.
- Último commit: `bf071f5` — repo limpio en main.

## Completado (esta sesión)
1. **Frontend** (`frontend/`):
   - Vite 8 + React 19 + TS + Tailwind v4 (`@tailwindcss/vite`).
   - Login por wallet: `@creit.tech/stellar-wallets-kit` v2.7
     → API: `StellarWalletsKit.init({modules: defaultModules(), network: Networks.TESTNET})`
       + `authModal()` / `disconnect()` (¡la API cambió respecto a versiones viejas!).
   - `npm run build` verdecito (bundle 471 KB → 145 KB gzip). Sin TanStack ni Zustand cableados aún.
2. **Infra VM Debian (AVF)**:
   - Terminal app de Android 16: imagen descargada; SSH activo.
     `ssh -i ~/.ssh/vm_droid_ed25519 droid@10.230.41.46` (IP cambia por sesión; buscarla
     en la subred `avf_tap_fixed`, hoy 10.230.41.0/24, VM en 10.230.41.46).
   - Repo espejo: `~/storage/shared/Download/astro-launchpad` (layout flat en la VM =
     `/mnt/shared/astro-launchpad`; Download de Android = /mnt/shared directo).
   - `scripts/vm-setup.sh` + `scripts/opencode-env/` + `scripts/vm-keys/termux.pub`.
   - `~/.opencode/bin/` en la VM: launcher `opencode` → `qemu-aarch64-static -cpu max,sve=off opencode.elf`.
3. **Comandos rápidos**: `~/bin/vibe`, `~/bin/sync-vm`. android-tools/adb instalado.

## Diagnosis clave (por si se retoca)
- Kernel invitado Debian 6.1-avf-arm64 **no soporta SVE pero el vCPU lo anuncia**
  (`/proc/sys/abi/sve` no existe; cpuinfo sí lo lista) → cualquier binario bun-compiled
  (opencode 2.0.27 y 2.1.2) SIG-ILL al inicio. Con `qemu -cpu max,sve=off` corre.
- `opencode run --standalone` bajo qemu: el server interno arranca lento y sigue sin
  completarse (pendiente); versión no-resuelta, quedó en pausa.
- stellar-cli nativo en Termux: compila SIGABRT (rustc crash) — usar el prebuilt
  glibc dentro de la VM Debian cuando se reanude, o compilar en CI.

## Próxima sesión (en orden)
1. **Contrato token** (`contracts/token/`): OpenZeppelin Stellar fungible (SEP-41)
   + `cargo test` con target wasm32-unknown-unknown (ya instalado en Termux).
2. Integración Soroswap testnet: factory `CDP3...TTBY` / router `CCJUD...7BRD`/ XLM SAC
   (vAGENTS.md para direcciones completas).
3. Frontend: conectar datos reales (TanStack Query), Vercel deploy.
4. (Opcional) VM: `vm-setup.sh` + acabar server bajo qemu o kernel nuevo.

## Comandos útiles
- `vibe` · `sync-vm` · frontend dev: `cd frontend && npm run dev`
- Sync espejo: `rsync -a --delete --exclude=logs --exclude=target --exclude=node_modules
  --exclude=dist ~/projects/astro-launchpad/ ~/storage/shared/Download/astro-launchpad/`
- VM (si encendida): `ssh -i ~/.ssh/vm_droid_ed25519 droid@10.230.41.46`
- opencode en la VM: PATH ya incluye `~/.opencode/bin` (bashrc/profile).

## Notas
- No usar sleep/polling; verificación puntual.
- Datos = red (RPC público testnet). Login = wallet. Sin backend de usuarios.
- Página del repo: AGENTS.md (red/direcciones), PLAN.md (roadmap).
