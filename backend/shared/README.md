# @astroshibapop/shared

Módulo compartido entre api-gateway e indexer del backend de AstroShibaPop.

## 📦 Contenido

- **prisma/** - Schema de Prisma y cliente optimizado con Accelerate
- **types/** - Tipos TypeScript compartidos
- **config/** - Configuración y validación de environment variables
- **utils/** - Utilidades compartidas

## 🚀 Características

### Prisma Client Optimizado

- ✅ **Prisma Accelerate**: Connection pooling global y caching
- ✅ **Singleton Pattern**: Optimizado para serverless (Vercel)
- ✅ **Query Caching**: Estrategias de cache configurables (TTL, SWR)
- ✅ **Connection Management**: Manejo inteligente de conexiones

### Environment Validation

- ✅ **Zod Schema**: Validación de tipos en runtime
- ✅ **Type-safe**: Configuración totalmente tipada
- ✅ **Error Reporting**: Mensajes claros de errores de configuración

### TypeScript Types

- ✅ **GraphQL Context**: Tipos para resolvers
- ✅ **DataLoaders**: Interfaces para batching
- ✅ **Stellar Events**: Tipos para eventos de Soroban
- ✅ **API Responses**: Tipos para respuestas estandarizadas

## 📖 Uso

### Prisma Client

```typescript
import { prisma, CACHE_STRATEGIES } from '@astroshibapop/shared/prisma'

// Query con caching (5 minutos TTL)
const tokens = await prisma.token.findMany({
  cacheStrategy: CACHE_STRATEGIES.MEDIUM_TTL,
  where: { graduated: false }
})

// Query sin cache (para writes)
const newToken = await prisma.token.create({
  data: { /* ... */ }
})
```

### Environment Config

```typescript
import { env, getApiConfig, getStellarConfig } from '@astroshibapop/shared/config'

// Environment variables validadas
console.log(env.DATABASE_URL)
console.log(env.STELLAR_NETWORK)

// Configuraciones específicas
const apiConfig = getApiConfig()
const stellarConfig = getStellarConfig()
```

### Types

```typescript
import type { GraphQLContext, Token, Pool } from '@astroshibapop/shared/types'

// En tus resolvers
export const resolvers = {
  Query: {
    token: async (parent, args, context: GraphQLContext) => {
      return context.prisma.token.findUnique({
        where: { address: args.address }
      })
    }
  }
}
```

## 🛠️ Scripts

```bash
# Generar Prisma Client
pnpm db:generate

# Push schema a la base de datos (desarrollo)
pnpm db:push

# Crear migración
pnpm db:migrate

# Aplicar migraciones (producción)
pnpm db:migrate:deploy

# Abrir Prisma Studio
pnpm db:studio

# Type checking
pnpm typecheck
```

## 🔧 Setup

1. **Copiar .env.example a .env**
   ```bash
   cp .env.example .env
   ```

2. **Configurar variables de entorno**
   - `DATABASE_URL`: URL de conexión a PostgreSQL
   - `DIRECT_DATABASE_URL`: URL directa para migraciones
   - `STELLAR_RPC_URL`: URL del RPC de Soroban
   - Contract IDs y demás configuración

3. **Instalar dependencias**
   ```bash
   pnpm install
   ```

4. **Generar Prisma Client**
   ```bash
   pnpm db:generate
   ```

5. **Aplicar migraciones**
   ```bash
   # Desarrollo
   pnpm db:push

   # Producción
   pnpm db:migrate:deploy
   ```

## 📝 Notas para Prisma Accelerate

### Desarrollo Local

```env
DATABASE_URL="postgresql://user:password@localhost:5432/db"
DIRECT_DATABASE_URL="postgresql://user:password@localhost:5432/db"
```

### Producción (con Accelerate)

```env
# URL de Accelerate (connection pooling + cache)
DATABASE_URL="prisma://accelerate.prisma-data.net/?api_key=YOUR_API_KEY"

# URL directa para migraciones
DIRECT_DATABASE_URL="postgresql://user:password@prod-host:5432/db"
```

### Estrategias de Cache

| Estrategia | TTL | SWR | Uso Recomendado |
|------------|-----|-----|-----------------|
| `SHORT_TTL` | 60s | 30s | Datos volátiles (precios, volúmenes) |
| `MEDIUM_TTL` | 5m | 60s | Datos semi-estáticos (tokens, usuarios) |
| `LONG_TTL` | 30m | 5m | Datos estáticos (achievements, config) |
| `NO_CACHE` | 0 | - | Writes, datos real-time |

### Connection Pooling

Prisma Accelerate maneja el connection pooling automáticamente:

- ✅ Pool global compartido entre todas las funciones serverless
- ✅ No más "connection pool exhausted" en serverless
- ✅ Optimizado para cold starts
- ✅ Escalado automático según demanda

## 🏗️ Arquitectura

```
shared/
├── prisma/
│   ├── schema.prisma       # Schema de base de datos
│   └── client.ts           # Cliente singleton con Accelerate
├── types/
│   └── index.ts            # Tipos TypeScript compartidos
├── config/
│   └── env.ts              # Validación de environment
└── utils/
    └── index.ts            # Utilidades compartidas
```

## 🔒 Best Practices

1. **Usa el singleton**: Siempre importa `prisma` de `@astroshibapop/shared/prisma`
2. **Aplica caching**: Usa `CACHE_STRATEGIES` para queries frecuentes
3. **Valida env**: Usa `env` de `@astroshibapop/shared/config`
4. **Type-safe**: Usa los tipos de `@astroshibapop/shared/types`
5. **No disconnects en serverless**: El cliente maneja conexiones automáticamente
