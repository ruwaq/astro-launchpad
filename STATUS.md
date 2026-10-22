# Estado actual (para siguiente sesión)

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
- Stellar CLI instalando desde fuente (sin default features) en background.
  - PID: ver `pgrep -af "cargo install"`.
  - Log: ~/logs/stellar-install.log
  - Verificar: `pgrep -af "cargo install" | grep -v pgrep || echo finished; ls -la ~/.cargo/bin/stellar`
  - Si termina, ejecutar `stellar --version` y luego scaffold.

## Siguiente sesión (sin sleep/polling)
1. Verificar CLI (comando puntual).
2. Si OK: `stellar scaffold init . --template react` (o crear proyecto).
3. Crear contrato token OpenZeppelin fungible.
4. Deploy testnet + bindings.
5. Frontend: wallet login, token mint/transfer, Soroswap swap.
6. Deploy Vercel.

## Notas
- No usar sleep para esperar; verificar con comandos puntuales.
- Preferir datos desde la red (RPC) y wallet login.
EOF
echo "STATUS.md written"