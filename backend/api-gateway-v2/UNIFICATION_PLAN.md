# Plan de Unificación: GraphQL API Gateway

## Estado Actual (Problema)

Existen **dos implementaciones separadas** de GraphQL que no están sincronizadas:

| Archivo | Descripción | Usado por |
|---------|-------------|-----------|
| `api/graphql.js` | Archivo JavaScript standalone (~1200 líneas) | Vercel Serverless Functions |
| `src/graphql/` | Implementación TypeScript modular | Desarrollo local (Express) |

### Por qué es un problema

1. **Duplicación de código**: Cada cambio debe hacerse en dos lugares
2. **Desincronización**: Los cambios en `src/` no afectan producción
3. **Bugs difíciles de detectar**: Como el soft-delete que funcionaba local pero no en producción
4. **No escalable**: A medida que crece el proyecto, mantener dos implementaciones es insostenible

---

## Solución Recomendada

**Eliminar `api/graphql.js` y configurar Vercel para usar el código compilado de `src/`**

### Beneficios

- TypeScript con type-safety
- Código modular y mantenible
- Un solo lugar para hacer cambios
- Tests automatizados
- Middleware de Prisma para soft-delete automático

---

## Pasos de Implementación

### Fase 1: Preparación (30 min)

#### 1.1 Verificar que `src/graphql/` tiene todas las funcionalidades

```bash
# Comparar schemas
diff <(grep -E "type|query|mutation" api/graphql.js) <(grep -E "type|query|mutation" src/graphql/schema.ts)
```

Funcionalidades a verificar:
- [ ] Todas las queries (tokens, token, trendingTokens, pools, users, etc.)
- [ ] Todas las mutations (createToken, syncToken, etc.)
- [ ] Soft-delete filtering en todas las queries de Token y Pool
- [ ] Paginación Relay-style
- [ ] Resolvers de relaciones (Token.pools, Pool.token0, etc.)

#### 1.2 Asegurar que el soft-delete funciona en `src/`

El middleware en `src/lib/prisma.ts` ya implementa soft-delete automático:

```typescript
// Ya implementado en src/lib/prisma.ts
client.$use(async (params, next) => {
  if (SOFT_DELETE_MODELS.includes(params.model)) {
    if (['findMany', 'findFirst', 'count'].includes(params.action)) {
      params.args.where = { ...params.args.where, deletedAt: null }
    }
  }
  return next(params)
})
```

### Fase 2: Configurar Vercel (15 min)

#### 2.1 Modificar `vercel.json`

```json
{
  "version": 2,
  "buildCommand": "pnpm run vercel-build",
  "outputDirectory": "dist",
  "functions": {
    "dist/api/**/*.js": {
      "memory": 1024,
      "maxDuration": 30
    }
  },
  "rewrites": [
    { "source": "/graphql", "destination": "/dist/api/graphql.js" },
    { "source": "/health", "destination": "/dist/api/health.js" }
  ]
}
```

#### 2.2 Crear archivo de entrada para Vercel

Crear `src/api/graphql.ts`:

```typescript
import { createApp } from '../app.js'

// Export handler for Vercel
export default async function handler(req, res) {
  const app = await createApp()
  return app(req, res)
}
```

#### 2.3 Actualizar `tsconfig.json`

```json
{
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
```

### Fase 3: Testing (20 min)

#### 3.1 Test local

```bash
# Build
pnpm run build

# Test endpoint
curl -X POST http://localhost:3001/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ tokens(limit: 5) { totalCount } }"}'
```

#### 3.2 Deploy a preview

```bash
# Deploy sin afectar producción
git checkout -b feat/unify-graphql
git push origin feat/unify-graphql
# Vercel creará un preview deployment automáticamente
```

#### 3.3 Verificar en preview

```bash
# Test preview deployment
curl -X POST https://[preview-url]/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ tokens(limit: 5) { totalCount } }"}'

# Debe retornar totalCount: 9 (sin tokens eliminados)
```

### Fase 4: Migración (10 min)

#### 4.1 Eliminar archivos obsoletos

```bash
# Mover a backup temporal (por seguridad)
mkdir -p .backup
mv api/graphql.js .backup/
mv api/health.js .backup/
mv api/index.js .backup/

# Mantener solo el README
# api/README.md se actualiza con nueva documentación
```

#### 4.2 Actualizar documentación

Actualizar `api/README.md`:

```markdown
# API Gateway - Vercel Serverless Functions

Este directorio ya no contiene código.
El código fuente está en `src/` y se compila a `dist/`.

Ver `src/graphql/` para la implementación de GraphQL.
```

#### 4.3 Commit y deploy a producción

```bash
git add -A
git commit -m "refactor(api): unify GraphQL implementations to src/"
git push origin main
```

### Fase 5: Verificación Post-Deploy (10 min)

```bash
# Verificar producción
curl -X POST https://api-gateway-v2.vercel.app/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ health { status database } }"}'

# Verificar soft-delete
curl -X POST https://api-gateway-v2.vercel.app/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ tokens(limit: 20) { totalCount } }"}'
# Debe retornar 9, no 13
```

---

## Rollback Plan

Si algo falla:

```bash
# Restaurar archivos de backup
cp .backup/graphql.js api/
cp .backup/health.js api/
cp .backup/index.js api/

# Revertir vercel.json
git checkout HEAD~1 -- vercel.json

# Deploy
git add -A
git commit -m "rollback: restore api/ files"
git push origin main
```

---

## Checklist Final

- [ ] Todas las queries funcionan igual que antes
- [ ] Soft-delete filtra correctamente (totalCount = 9)
- [ ] Health check responde correctamente
- [ ] No hay errores en Vercel logs
- [ ] Performance similar o mejor
- [ ] Tests pasan

---

## Tiempo Estimado Total

| Fase | Tiempo |
|------|--------|
| Preparación | 30 min |
| Configurar Vercel | 15 min |
| Testing | 20 min |
| Migración | 10 min |
| Verificación | 10 min |
| **Total** | **~1.5 horas** |

---

## Notas Importantes

1. **Hacer en horario de bajo tráfico**: La migración puede causar breve downtime
2. **Tener acceso a Vercel dashboard**: Para monitorear logs en tiempo real
3. **Backup de DATABASE_URL**: Por si hay que verificar conexión
4. **No borrar `.backup/` hasta verificar que todo funciona por 24h**

---

*Documento creado: 2024-12-16*
*Autor: Claude Code*
