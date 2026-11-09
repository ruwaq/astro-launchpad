# opencode-env

Configuración local para entornos OpenCode.

## `service.json`

Ejemplo sin credenciales: este repositorio contiene solo una plantilla.

- La credencial real **nunca** vive en el repo. Guardarla en
  `~/.secrets/opencode-env/service.json` (chmod 600).
  `scripts/opencode-env/llevar-credencial.mjs` la copia automáticamente.
- Si una credencial llegó alguna vez a git, **rotarla** siempre (el historial
  conserva bytes borrados).
