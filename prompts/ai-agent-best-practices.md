---
title: AI Agent Best Practices (2026)
desc: Guardrails modernos para usar agentes de IA en producción
category: arch
---
# AI Agent Operating Rules (modern, 2026)

## Core
- Tratar al agente como ingeniero junior con super velocidad: propone, no decide.
- Draft PRs only; no push directo a main/release.
- Human-in-the-loop obligatorio; revisión real, no rubber-stamping.
- CI ruthlessly: tests + lint + security scans + format; gates extra para código AI.

## Security
- Asumir que el agente es overconfident.
- CodeQL/SAST en cada PR AI.
- Escanear explícitamente auth, input validation, secrets, crypto.
- No permitir que el agente diseñe auth/crypto/infra sin revisión senior.

## Multi-agent
- Un agente = una responsabilidad (scaffold/tests/refactor).
- Áreas de escritura acotadas; re-aprobación si otro agente cambia supuestos.
- Humanos resuelven conflictos entre agentes.

## Maintainability
- Código aburrido > clever: funciones pequeñas, abstracciones superficiales, nombres claros.
- Rechazar over-abstraction, meta-programming, frameworks internos.

## Provenance & Run Records
- Etiquetar PRs `ai-generated`.
- Guardar prompt, tool versions, model/provider, permisos.
- Run record: tarea inicial, repo/ref, permisos, excepciones.
- Ground-truth receipts (git/disco), no self-report.

## Scope & Process
- Scope binding antes de la ejecución; prompts se sobrescriben si el agente se auto-convence.
- Separar exploración read-only de acciones state-changing.
- Cambios de dependencias = punto de aprobación distinto.
- Track rework-to-delivery ratio por run; detener si revalida en vez de ship.

## Prompting
- Instrucciones claras y específicas; few-shot examples; contexto suficiente.
- Constraints explícitos ("no tocar X", "preferir utils existentes").
- Narrow scope: resolver un problema bien.

## Long-running processes
- Background + log; sin sleep/polling; verificar con comando puntual.
- Deshabilitar features nativas opcionales en entornos limitados (Termux).
EOF
echo "created ai-agent-best-practices"