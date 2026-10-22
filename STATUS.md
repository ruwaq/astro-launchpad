# Estado actual (para siguiente sesión)

## VM Debian (AVF Terminal) — armado listo
- Terminal app de Android 16 inicializada (imagen descargada, Oct 2026).
- Repo espejo en storage compartido: `~/storage/shared/Download/astro-launchpad`
  (se sincroniza con `rsync -a --delete --exclude=logs --exclude=target --exclude=node_modules`)
- Bootstrap una vez dentro de la VM:
  `bash /mnt/shared/Download/astro-launchpad/scripts/vm-setup.sh`
  (apt/build-essential/sshd + opencode + proyecto desde /mnt/shared)
- Puente pendiente para ejecutar la VM desde Termux:
  `pkg install -y android-tools` ya hecho (adb 1.0.41 OK).
  1) teléfono: Opciones dev → Depuración inalámbrica ON
  2) `adb pair localhost:PUERTO` (código de emparejamiento en pantalla)
  3) `adb connect localhost:PUERTO`
  4) anti-kill: `adb shell cmd deviceidle whitelist +com.android.virtualization.terminal`
     `adb shell am set-standby-bucket com.android.virtualization.terminal active`
- Nota: build nativo de stellar CLI en Termux falló (SIGABRT en rustc stellar-xdr);
  reintento con `-j2` en curso en background. Alternativa robusta: instalar el
  prebuilt oficial glibc dentro de la VM Debian (segundos).

## Completado
- Repo reseteado a main limpio; legacy preservado en `legacy/abandoned-monorepo`.
- AGENTS.md y PLAN.md actualizados (minimalista, descentralizado, testnet online).
- Prompts generales actualizados en ~/.prompts (AI best practices 2026, process management).
- Entorno Termux:
  - PATH configurado (~/.cargo/bin, ~/bin).
  - Postgres 18 + Redis 8 instalados y corriendo (opcionales).
  - DB `astro_launchpad` user `astro` creada.
  - Scripts `dev-up` / `dev-down` en ~/bin.
  - Workspace symlink ~/workspace/astro-launchpad.

## En progreso
- Frontend `frontend/` creado con `npm create vite@latest (react-ts)`:
  - Tailwind v4 conectado (vite.config.ts + index.css).
  - App mínima con login por wallet (@creit.tech/stellar-wallets-kit,
    Network.TESTNET): conectar/desconectar y mostrar pubkey.
  - deps instalándose en background (stellar-sdk, tanstack-query, zustand).
- stellar CLI: reintento `-j2` en background (ver nota VM arriba).

## Siguiente sesión (sin sleep/polling)
0. VM Debian: correr vm-setup.sh + puente adb (ver arriba).
   Contratos y stellar CLI preferiblemente dentro de la VM (glibc).
1. Frontend: `npm run build` + `npm run dev` OK, commit.
2. Contrato token OpenZeppelin fungible (cargo test con target wasm32).
3. Deploy testnet + bindings.
4. Soroswap: crear par token/XLM y swap on-chain.
5. Deploy Vercel.

## Notas
- No usar sleep para esperar; verificar con comandos puntuales.
- Preferir datos desde la red (RPC) y wallet login.
- **Decisión 2026-10-22**: vibe coding queda en **Termux** (opencode local funciona,
  botones extra-keys ya configurados). `~/bin/vibe` abre opencode en el proyecto.
- VM Debian (AVF): **en pausa**. Estado: opencode v2.0.27 instalado y corriendo
  vía `qemu-aarch64-static -cpu max,sve=off` (kernel invitado Debian 6.1-avf
  no soporta SVE aunque el CPU lo anuncia → SIGILL sin la máscara).
  Boot del server es lento bajo qemu → quedo en `run --standalone` pendiente.
  SSH: `ssh -i ~/.ssh/vm_droid_ed25519 droid@10.230.41.46` (VM encendida).
  Resume: probar versión con kernel nuevo (Debian 13/Android 17) o instalar
  node+npm y correr opencode vía npm con un bun sin SVE.