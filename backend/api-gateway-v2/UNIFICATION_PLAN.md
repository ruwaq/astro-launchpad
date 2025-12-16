# Plan de Unificacion: GraphQL API Gateway v2

> **Estado**: Revisado y corregido
> **Fecha**: 2024-12-16
> **Autor**: Claude Code

## Estado Actual (Problema)

Existen **dos implementaciones separadas** de GraphQL que no estan sincronizadas:

| Archivo | Descripcion | Lineas | Usado por |
|---------|-------------|--------|-----------|
| `api/graphql.js` | JavaScript monolitico con schema inline | ~1150 | Vercel Serverless |
| `src/graphql/` | TypeScript modular con DataLoaders | ~2500 | Desarrollo local (Express) |

### Por que es un problema critico

1. **Duplicacion de logica**: Cada cambio debe hacerse en dos lugares
2. **Feature gap**: `src/` tiene features que `api/` no tiene:
   - DataLoaders (prevencion N+1)
   - Rate limiting
   - Fee management completo
   - Validacion con Zod
   - Logging estructurado (Pino)
   - Sentry monitoring
3. **Bugs en produccion**: El soft-delete funcionaba local pero no en produccion
4. **No escalable**: Mantener dos implementaciones es insostenible

### Analisis del Problema Raiz

| Implementacion | Framework | Serverless Compatible |
|----------------|-----------|----------------------|
| `api/graphql.js` | `@as-integrations/next` | ✅ Si - diseñado para serverless |
| `src/app.ts` | Express + `@as-integrations/express4` | ❌ No - Express es para servidores siempre activos |

**El error del plan original**: Intentaba usar Express compilado en Vercel, pero Express no es compatible con el modelo serverless de Vercel.

---

## Solucion: Handler Hibrido con @as-integrations/next

### Arquitectura Propuesta

```
src/graphql/              <- SINGLE SOURCE OF TRUTH (ya existe)
├── schema.ts             <- Schema GraphQL completo
├── resolvers/            <- Resolvers modulares con validacion
├── context.ts            <- Context factory con auth
├── loaders.ts            <- DataLoaders para N+1
├── validation.ts         <- Rate limiting, complexity
└── cache-helpers.ts      <- Redis caching

src/handlers/             <- NUEVO: Handlers por entorno
├── vercel.ts             <- Handler para Vercel (usa @as-integrations/next)
└── express.ts            <- Handler para desarrollo local (Express)

api/                      <- SE ELIMINA (despues de migracion)
└── graphql.js            <- OBSOLETO - reemplazado por dist/handlers/vercel.js
```

### Beneficios

| Antes | Despues |
|-------|---------|
| 2 schemas duplicados | 1 schema en `src/graphql/schema.ts` |
| 2 sets de resolvers | 1 set en `src/graphql/resolvers/` |
| Cambios en 2 lugares | Cambios en 1 lugar |
| Sin DataLoaders en prod | DataLoaders en todos los entornos |
| Sin rate limiting en prod | Rate limiting unificado |

---

## Implementacion Paso a Paso

### Fase 1: Crear Handler Vercel (30 min)

#### 1.1 Crear `src/handlers/vercel.ts`

```typescript
/**
 * Vercel Serverless Handler for GraphQL API
 * Uses @as-integrations/next for serverless compatibility
 *
 * This is the PRODUCTION handler - uses all features from src/graphql/
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { ApolloServer } from '@apollo/server';
import { startServerAndCreateNextHandler } from '@as-integrations/next';
import { schema } from '../graphql/schema.js';
import { resolvers } from '../graphql/resolvers/index.js';
import { createContext, GraphQLContext } from '../graphql/context.js';
import { validationRules, createComplexityPlugin } from '../graphql/validation.js';
import { createRateLimitPlugin } from '../lib/rate-limiter.js';
import { logger } from '../lib/logger.js';

// Environment
const isProduction = process.env.NODE_ENV === 'production';

// CORS Configuration
const ALLOWED_ORIGINS = [
  'https://astroshiba.io',
  'https://app.astroshiba.io',
  'https://www.astroshiba.io',
  'https://staging.astroshiba.io',
  'https://astro-launchpad-topaz.vercel.app',
  ...(isProduction ? [] : [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3000',
  ]),
];

function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return false;
  return ALLOWED_ORIGINS.some(allowed =>
    origin === allowed || origin.endsWith('.vercel.app')
  );
}

// Create Apollo Server with all production features
const server = new ApolloServer<GraphQLContext>({
  typeDefs: schema,
  resolvers: resolvers as any,
  introspection: !isProduction || process.env.GRAPHQL_INTROSPECTION === 'true',
  includeStacktraceInErrorResponses: !isProduction,
  validationRules,
  plugins: [
    createComplexityPlugin(),
    createRateLimitPlugin(),
  ],
  formatError: (formattedError, error) => {
    if (isProduction) {
      logger.error({ error }, 'GraphQL Error');
      return {
        message: formattedError.message,
        path: formattedError.path,
        extensions: {
          code: formattedError.extensions?.code || 'INTERNAL_SERVER_ERROR',
        },
      };
    }
    logger.error({ error }, 'GraphQL Error');
    return formattedError;
  },
});

// Create Next.js compatible handler
const handler = startServerAndCreateNextHandler(server, {
  context: async (req) => createContext(req),
});

// Export handler with CORS
export default async function graphqlHandler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const requestOrigin = req.headers.origin;

  // Set CORS headers
  if (requestOrigin && isOriginAllowed(requestOrigin)) {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', requestOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers',
      'Content-Type, Authorization, X-Request-ID, X-Stellar-Address, X-Stellar-Signature, X-Stellar-Timestamp, X-Admin-Key'
    );
    res.setHeader('Vary', 'Origin');
  }

  // Handle preflight
  if (req.method === 'OPTIONS') {
    if (requestOrigin && isOriginAllowed(requestOrigin)) {
      res.status(204).end();
    } else {
      res.status(403).json({ error: 'CORS origin not allowed' });
    }
    return;
  }

  return handler(req, res);
}

// Disable body parser (Apollo handles it)
export const config = {
  api: {
    bodyParser: false,
  },
};
```

#### 1.2 Crear `src/handlers/health.ts`

```typescript
/**
 * Health Check Handler for Vercel
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../lib/prisma.js';

export default async function healthHandler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  let dbHealthy = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbHealthy = true;
  } catch (e) {
    console.error('DB health check failed:', e);
  }

  res.json({
    status: dbHealthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    version: '2.1.0',
    database: dbHealthy,
    environment: process.env.NODE_ENV || 'development',
  });
}
```

### Fase 2: Actualizar Configuracion (15 min)

#### 2.1 Actualizar `tsconfig.json`

```json
{
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "target": "ES2022",
    "lib": ["ES2022"],
    "types": ["node"],
    "esModuleInterop": true,
    "skipLibCheck": true,
    "strict": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", ".turbo", "api"]
}
```

#### 2.2 Actualizar `vercel.json`

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "version": 2,
  "installCommand": "npx pnpm@9 install",
  "buildCommand": "pnpm run vercel-build",
  "outputDirectory": ".",
  "cleanUrls": true,
  "trailingSlash": false,
  "regions": ["iad1"],
  "functions": {
    "dist/handlers/*.js": {
      "memory": 1024,
      "maxDuration": 30
    }
  },
  "rewrites": [
    {
      "source": "/graphql",
      "destination": "/dist/handlers/vercel.js"
    },
    {
      "source": "/health",
      "destination": "/dist/handlers/health.js"
    }
  ],
  "headers": [
    {
      "source": "/graphql",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "X-XSS-Protection", "value": "1; mode=block" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Content-Security-Policy", "value": "default-src 'self'; script-src 'none'; object-src 'none'" }
      ]
    }
  ]
}
```

#### 2.3 Actualizar `package.json` scripts

```json
{
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "rm -rf dist && tsc",
    "vercel-build": "prisma generate && rm -rf dist && tsc",
    "start": "node dist/index.js",
    "typecheck": "tsc --noEmit"
  }
}
```

### Fase 3: Testing (20 min)

#### 3.1 Test Local con Build

```bash
# Build TypeScript
pnpm run build

# Verificar que los handlers se compilaron
ls -la dist/handlers/
# Debe mostrar: vercel.js, health.js

# Test con Vercel CLI (simula entorno serverless)
npx vercel dev
```

#### 3.2 Test Queries Criticas

```bash
# Health check
curl http://localhost:3000/health

# Tokens (debe excluir soft-deleted)
curl -X POST http://localhost:3000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ tokens(limit: 5) { totalCount edges { node { name symbol } } } }"}'

# Token individual
curl -X POST http://localhost:3000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ token(address: \"CXXXX...\") { name symbol graduated xlmRaised } }"}'
```

#### 3.3 Checklist de Paridad

- [ ] `tokens` query devuelve mismo `totalCount` (sin soft-deleted)
- [ ] `token` query devuelve `xlmRaised` para graduation progress
- [ ] `trendingTokens` query funciona con cache
- [ ] `leaderboard` query funciona con agregaciones SQL
- [ ] `syncToken` mutation funciona con rate limiting
- [ ] `deleteToken` mutation requiere X-Admin-Key header
- [ ] Fee queries (`globalFeeStats`, `feeDashboard`) funcionan

### Fase 4: Deploy Preview (15 min)

```bash
# Crear branch de feature
git checkout -b feat/unify-graphql-handlers

# Commit cambios
git add -A
git commit -m "feat(api): unify GraphQL to single TypeScript source"

# Push (Vercel creara preview automaticamente)
git push origin feat/unify-graphql-handlers

# Test preview deployment
curl -X POST https://[preview-url]/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ health { status database tokenStats { totalTokens activeTokens } } }"}'
```

### Fase 5: Migracion a Produccion (10 min)

#### 5.1 Backup del codigo actual

```bash
mkdir -p .backup/api-legacy
mv api/graphql.js .backup/api-legacy/
mv api/health.js .backup/api-legacy/
mv api/index.js .backup/api-legacy/
```

#### 5.2 Actualizar api/README.md

```markdown
# API Directory (Legacy)

Este directorio ya no contiene codigo de produccion.

El codigo fuente esta en `src/` y se compila a `dist/`.

## Estructura

- `src/graphql/` - Schema y resolvers (SINGLE SOURCE OF TRUTH)
- `src/handlers/vercel.ts` - Handler para Vercel serverless
- `src/handlers/health.ts` - Health check endpoint
- `dist/` - Codigo compilado (generado por `pnpm build`)

## Endpoints

| Endpoint | Handler |
|----------|---------|
| `/graphql` | `dist/handlers/vercel.js` |
| `/health` | `dist/handlers/health.js` |
```

#### 5.3 Merge a main

```bash
git checkout main
git merge feat/unify-graphql-handlers
git push origin main
```

---

## Rollback Plan

Si algo falla en produccion:

```bash
# 1. Restaurar archivos legacy
cp .backup/api-legacy/* api/

# 2. Revertir vercel.json
git checkout HEAD~1 -- vercel.json

# 3. Deploy de emergencia
git add -A
git commit -m "rollback: restore api/ legacy handlers"
git push origin main

# 4. Verificar
curl https://api-gateway-v2.vercel.app/health
```

---

## Verificacion Post-Deploy

```bash
# 1. Health check completo
curl -s https://api-gateway-v2.vercel.app/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ health { status database tokenStats { totalTokens activeTokens deletedTokens } } }"}' | jq

# 2. Tokens count (debe ser 9, no 13)
curl -s https://api-gateway-v2.vercel.app/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ tokens(limit: 1) { totalCount } }"}' | jq '.data.tokens.totalCount'

# 3. Fee dashboard (feature nueva)
curl -s https://api-gateway-v2.vercel.app/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ feeDashboard { revenue { totalRevenue { total day } } } }"}' | jq

# 4. Leaderboard con cache
curl -s https://api-gateway-v2.vercel.app/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ leaderboard(type: TRADERS, limit: 5) { rank address volume24h } }"}' | jq
```

---

## Checklist Final

- [ ] Todos los queries funcionan igual o mejor que antes
- [ ] Soft-delete filtra correctamente (`totalCount` = tokens activos)
- [ ] Health check muestra `tokenStats` para debugging
- [ ] DataLoaders previenen N+1 queries
- [ ] Rate limiting funciona en `syncToken`
- [ ] Admin mutations requieren X-Admin-Key header
- [ ] Fee management queries funcionan
- [ ] No hay errores en Vercel logs
- [ ] Tests pasan
- [ ] Preview deployment verificado

---

## Tiempo Estimado

| Fase | Tiempo |
|------|--------|
| Crear handlers | 30 min |
| Actualizar config | 15 min |
| Testing local | 20 min |
| Deploy preview | 15 min |
| Migracion prod | 10 min |
| Verificacion | 10 min |
| **Total** | **~1.5 horas** |

---

## Referencias

- [Apollo Server Integration for Next.js](https://github.com/apollo-server-integrations/apollo-server-integration-next)
- [Vercel Serverless Functions](https://vercel.com/docs/functions/serverless-functions)
- [Deploy Apollo GraphQL to Vercel](https://gebna.gg/blog/how-to-deploy-apollo-graphql-api-on-vercel-serverless-functions)
- [TypeScript Path Aliases in Vercel](https://dev.to/ozanbolel/deploying-apollo-server-with-typescript-path-aliases-to-vercel-4k5l)

---

*Documento actualizado: 2024-12-16*
*Revision: v2.0 - Solucion con @as-integrations/next*
