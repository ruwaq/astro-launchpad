# /primetime - Validación Completa para Producción

Ejecuta una validación exhaustiva del proyecto para asegurar que está listo para producción.

**Mantra: Código Robusto, Escalable, Modular**

## Secuencia de Validación

### Fase 1: Backend & Contracts
Ejecuta los siguientes agentes en secuencia:

1. **Code Quality Agent** - Revisa patrones TypeScript/React
   - Buscar anti-patterns en `backend/` y `apps/web/src/`
   - Verificar tipado estricto
   - Detectar código duplicado

2. **Security Auditor Agent** - Auditoría de seguridad
   - Revisar contratos en `contracts/`
   - Verificar OWASP Top 10 en API GraphQL
   - Buscar secretos expuestos

3. **Contract Validator Agent** - Validación de contratos Soroban
   - Verificar bonding curve math
   - Validar sistema de fees
   - Comprobar integración Oracle

4. **Test Generator Agent** - Verificar cobertura
   - Ejecutar `pnpm test` en todos los packages
   - Verificar cobertura >80%
   - Identificar código sin tests

### Fase 2: Frontend & UX
Ejecuta los siguientes agentes:

5. **UI Architect Agent** - Arquitectura de componentes
   - Analizar `apps/web/src/components/`
   - Detectar prop drilling
   - Verificar Server vs Client components

6. **UX Enhancer Agent** - Experiencia de usuario
   - Analizar flujos principales
   - Verificar estados de loading/error/empty
   - Revisar microcopy

7. **Accessibility Guardian Agent** - WCAG 2.1 AA
   - Auditar ARIA labels
   - Verificar contraste de colores
   - Revisar navegación por teclado

8. **Animation Wizard Agent** - Animaciones
   - Verificar uso de Framer Motion
   - Detectar animaciones que causan jank
   - Sugerir micro-interactions

9. **Design System Agent** - Consistencia visual
   - Buscar valores hardcodeados
   - Verificar uso de tokens
   - Estado de dark mode

### Fase 3: Deploy & Performance

10. **Performance Optimizer Agent** - Rendimiento
    - Analizar bundle size
    - Detectar N+1 queries
    - Verificar Core Web Vitals

11. **Deploy Guardian Agent** - Pre-deployment
    - Ejecutar build completo
    - Verificar migraciones
    - Validar variables de entorno

## Output Esperado

```markdown
# 🚀 PRIMETIME REPORT

## Summary
- **Status:** READY / NOT READY
- **Score:** X/100
- **Critical Issues:** X
- **Warnings:** X

## Phase 1: Backend & Contracts
| Agent | Status | Score | Issues |
|-------|--------|-------|--------|
| Code Quality | ✅/❌ | X/100 | X |
| Security | ✅/❌ | X/100 | X |
| Contracts | ✅/❌ | X/100 | X |
| Tests | ✅/❌ | X% coverage | X |

## Phase 2: Frontend & UX
| Agent | Status | Score | Issues |
|-------|--------|-------|--------|
| UI Architect | ✅/❌ | X/100 | X |
| UX | ✅/❌ | X/100 | X |
| Accessibility | ✅/❌ | X/100 | X |
| Animation | ✅/❌ | X/100 | X |
| Design System | ✅/❌ | X/100 | X |

## Phase 3: Deploy
| Agent | Status | Score | Issues |
|-------|--------|-------|--------|
| Performance | ✅/❌ | X/100 | X |
| Deploy | ✅/❌ | X/100 | X |

## Critical Issues (Must Fix)
1. [Issue description]
2. [Issue description]

## Recommendations
1. [Recommendation]
2. [Recommendation]

## Next Steps
- [ ] Fix critical issues
- [ ] Address warnings
- [ ] Re-run /primetime
```

## Commands to Execute
```bash
# Build all packages
pnpm build

# Type check
pnpm typecheck

# Run tests
pnpm test

# Lint
pnpm lint
```

## Success Criteria
- ✅ Build passes without errors
- ✅ TypeScript has no errors
- ✅ Tests pass with >80% coverage
- ✅ No critical security issues
- ✅ Accessibility score >90
- ✅ Performance score >80
- ✅ All contracts validated
