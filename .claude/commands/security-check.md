# /security-check - Auditoría de Seguridad

Ejecuta una auditoría de seguridad completa del proyecto.

## Agentes Involucrados

### 1. Security Auditor Agent
Análisis completo de:
- Smart contracts (Rust/Soroban)
- Backend API (GraphQL)
- Frontend (React/Next.js)
- Configuración de infraestructura

### 2. Contract Validator Agent
Validación específica de:
- Vulnerabilidades de contratos
- Access control
- Manejo de fondos

## Áreas de Análisis

### Smart Contracts
```
contracts/
├── sac-factory/src/
│   ├── lib.rs
│   ├── bonding_curve.rs
│   ├── access_control.rs
│   ├── fee_management.rs
│   └── ...
└── amm-pair/src/
    ├── lib.rs
    ├── reentrancy.rs
    └── ...
```

Verificar:
- [ ] Reentrancy protection
- [ ] Integer overflow/underflow
- [ ] Access control (RBAC)
- [ ] Input validation
- [ ] State manipulation
- [ ] Oracle manipulation
- [ ] Flash loan attacks
- [ ] Front-running

### Backend API
```
backend/api-gateway-v2/src/
├── graphql/
│   ├── schema.ts
│   └── resolvers/
└── lib/
```

Verificar:
- [ ] SQL/NoSQL injection
- [ ] GraphQL depth limiting
- [ ] Query complexity limits
- [ ] Rate limiting
- [ ] Authentication bypass
- [ ] Authorization flaws
- [ ] CORS configuration

### Frontend
```
apps/web/src/
├── app/
├── components/
├── lib/
└── contexts/
```

Verificar:
- [ ] XSS vulnerabilities
- [ ] CSRF protection
- [ ] Sensitive data exposure
- [ ] Open redirects
- [ ] Insecure dependencies

### Configuration
- [ ] Environment variables
- [ ] Hardcoded secrets
- [ ] API keys exposure
- [ ] HTTPS enforcement

## Commands
```bash
# Check for secrets
npx secretlint "**/*"

# Audit npm dependencies
pnpm audit

# Cargo audit for Rust
cd contracts/sac-factory && cargo audit

# Check for vulnerable patterns
grep -rn "eval\|innerHTML\|dangerouslySetInnerHTML" apps/web/src/
```

## Output Esperado

```markdown
# 🔒 SECURITY AUDIT REPORT

## Overall Risk Level: LOW / MEDIUM / HIGH / CRITICAL

## Summary
| Area | Critical | High | Medium | Low |
|------|----------|------|--------|-----|
| Contracts | 0 | 0 | 1 | 2 |
| Backend | 0 | 1 | 2 | 3 |
| Frontend | 0 | 0 | 1 | 4 |
| Config | 0 | 0 | 0 | 1 |

## Critical Issues
(None found / List if any)

## High Risk Issues
| ID | Type | Location | Description |
|----|------|----------|-------------|
| H-01 | Auth Bypass | resolver.ts:45 | Missing auth check |

## Medium Risk Issues
| ID | Type | Location | Description |
|----|------|----------|-------------|

## Low Risk Issues
| ID | Type | Location | Description |
|----|------|----------|-------------|

## Recommendations
1. [Priority fix]
2. [Security improvement]

## Dependency Audit
| Package | Severity | Fix Available |
|---------|----------|---------------|

## Security Score: X/100
```

## Severity Definitions

### Critical
- Direct financial loss possible
- Remote code execution
- Authentication bypass

### High
- Significant data exposure
- Privilege escalation
- Denial of service

### Medium
- Limited data exposure
- Session management issues
- Information disclosure

### Low
- Minor information leaks
- Best practice violations
- Cosmetic security issues
