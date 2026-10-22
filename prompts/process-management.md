---
title: Process Management (No Sleep/Polling)
desc: Gestión moderna de procesos largos sin bloquear ni hacer polling
category: dev
---
# Process Management Best Practices

## Reglas
1. Lanzar en background con `nohup ... > log 2>&1 &` y guardar PID.
2. NO usar `sleep` loops ni polling repetitivo.
3. Verificar con un comando puntual (pgrep, ls artifact, curl health).
4. Preferir binarios precompilados o features opcionales para evitar deps nativas.
5. Logs en ~/logs o raíz del proyecto; tail solo últimas líneas.
6. Documentar comando y artifact esperado en AGENTS.md/PLAN.md.

## Verificación rápida (sin sleep)
```bash
pgrep -af "cargo install" | grep -v pgrep || echo "finished"
ls -la ~/.cargo/bin/stellar 2>&1
```

## Termux
- Sin libudev: instalar con `--no-default-features`.
- Servicios opcionales: Postgres/Redis solo si el flujo lo requiere.
EOF
echo "created process-management"