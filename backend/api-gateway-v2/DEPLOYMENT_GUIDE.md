# 🚀 Deployment Guide - Astro Shiba Backend API

Esta guía te ayudará a desplegar el backend de Astro Shiba en Vercel.

## 📋 Prerequisitos

- [x] Cuenta de Vercel (https://vercel.com)
- [x] Vercel CLI instalado (`npm install -g vercel`)
- [x] Base de datos PostgreSQL (recomendado: Neon, Supabase, o Railway)
- [x] Redis/KV Store (recomendado: Vercel KV)
- [x] Stellar RPC endpoint
- [x] Token Factory Contract ID

## 🔑 Variables de Entorno Requeridas

### Base de Datos
```bash
DATABASE_URL="postgresql://user:password@host:5432/database?sslmode=require"
DIRECT_DATABASE_URL="postgresql://user:password@host:5432/database?sslmode=require"
```

### Cache (Vercel KV)
```bash
KV_REST_API_URL="https://your-kv-store.vercel-storage.com"
KV_REST_API_TOKEN="your-kv-token"
```

### Stellar/Soroban
```bash
STELLAR_NETWORK="testnet"  # o "mainnet"
STELLAR_RPC_URL="https://soroban-testnet.stellar.org"
TOKEN_FACTORY_CONTRACT_ID="CBGTG6EKTQ3T2AKZJSQ2CDKUUATWRKGCQXVP6QWXXXXXXXXXXXXXXXXXXX"
AMM_FACTORY_CONTRACT_ID="optional-amm-contract-id"  # opcional
```

### Configuración de Producción
```bash
NODE_ENV="production"
LOG_LEVEL="info"
LOG_PRETTY="false"
GRAPHQL_INTROSPECTION="false"
GRAPHQL_PLAYGROUND="false"
```

## 🛠️ Método 1: Deployment Automatizado (Recomendado)

### Paso 1: Ejecutar el Script de Setup

```bash
cd backend/api-gateway-v2
chmod +x scripts/setup-vercel.sh
./scripts/setup-vercel.sh
```

El script te guiará a través de:
1. ✅ Autenticación con Vercel
2. ✅ Creación/vinculación del proyecto
3. ✅ Configuración de variables de entorno
4. ✅ Verificación de configuración
5. ✅ Build y deployment

### Paso 2: Seguir las Instrucciones Interactivas

El script te pedirá:
- Token de Vercel (ya proporcionado: `L2UZQ6dqEvn5Sg8zPoxeEPGO`)
- Variables de entorno (opción de entrada manual o desde .env)
- Tipo de deployment (preview o production)

## 🔧 Método 2: Deployment Manual

### Paso 1: Instalar Vercel CLI

```bash
npm install -g vercel
```

### Paso 2: Autenticarse

```bash
vercel login
```

O usar token directamente:
```bash
export VERCEL_TOKEN="L2UZQ6dqEvn5Sg8zPoxeEPGO"
```

### Paso 3: Navegar al Directorio del Backend

```bash
cd backend/api-gateway-v2
```

### Paso 4: Vincular o Crear Proyecto

```bash
vercel link
```

Configuración sugerida:
- **Scope**: Nunalabs
- **Project Name**: astro-shiba-backend
- **Link to existing project**: No (crear nuevo)

### Paso 5: Configurar Variables de Entorno

Opción A - Desde la terminal:
```bash
# Base de datos
vercel env add DATABASE_URL production
# Pegar tu URL de base de datos cuando se solicite

vercel env add KV_REST_API_URL production
vercel env add KV_REST_API_TOKEN production
vercel env add TOKEN_FACTORY_CONTRACT_ID production
vercel env add STELLAR_RPC_URL production
```

Opción B - Desde el Dashboard:
1. Ir a https://vercel.com/dashboard
2. Seleccionar proyecto "astro-shiba-backend"
3. Settings → Environment Variables
4. Agregar cada variable manualmente

### Paso 6: Build del Proyecto

```bash
pnpm install
pnpm build
```

### Paso 7: Deploy Preview (Testing)

```bash
vercel
```

Esto creará un deployment de preview para probar.

### Paso 8: Verificar Deployment

```bash
# Una vez que tengas la URL de preview
./scripts/verify-deployment.sh https://tu-deployment-preview.vercel.app
```

### Paso 9: Deploy a Producción

Si todo funciona correctamente:
```bash
vercel --prod
```

## 🗄️ Configuración de Base de Datos

### Opción 1: Neon (Recomendado para Vercel)

1. Crear cuenta en https://neon.tech
2. Crear nuevo proyecto
3. Copiar connection string
4. Usar formato: `postgresql://user:password@host/database?sslmode=require`

### Opción 2: Supabase

1. Crear proyecto en https://supabase.com
2. Ir a Settings → Database
3. Copiar Connection String (URI)
4. Usar la versión "Direct connection"

### Opción 3: Railway

1. Crear proyecto en https://railway.app
2. Agregar servicio PostgreSQL
3. Copiar `DATABASE_URL` del dashboard

### Migrar la Base de Datos

```bash
# Desde el directorio raíz del monorepo
cd backend/shared
pnpm prisma migrate deploy
```

O usar Vercel CLI:
```bash
vercel env pull .env.production
pnpm prisma migrate deploy
```

## 💾 Configuración de Vercel KV (Cache)

### Paso 1: Crear KV Store

1. Ir a https://vercel.com/dashboard/stores
2. Clic en "Create Database"
3. Seleccionar "KV" (Redis)
4. Nombrar: `astro-shiba-cache`
5. Seleccionar región (iad1 recomendado)

### Paso 2: Vincular al Proyecto

1. Ir a tu proyecto "astro-shiba-backend"
2. Settings → Environment Variables
3. Clic en "Connect Store"
4. Seleccionar "astro-shiba-cache"
5. Auto-configurará `KV_REST_API_URL` y `KV_REST_API_TOKEN`

## 🔍 Verificación del Deployment

### Health Check

```bash
curl https://tu-deployment.vercel.app/health
```

Respuesta esperada:
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime": 123.45
}
```

### GraphQL Query

```bash
curl -X POST https://tu-deployment.vercel.app/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ health { status version } }"}'
```

### Metrics

```bash
curl https://tu-deployment.vercel.app/metrics
```

### Script Automático

```bash
./scripts/verify-deployment.sh https://tu-deployment.vercel.app
```

## 🔄 Configuración de CI/CD

### GitHub Actions (Opcional)

Crear `.github/workflows/deploy-backend.yml`:

```yaml
name: Deploy Backend to Vercel

on:
  push:
    branches:
      - main
    paths:
      - 'backend/api-gateway-v2/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
      
      - name: Install Vercel CLI
        run: npm install -g vercel
      
      - name: Pull Vercel Environment
        run: vercel pull --yes --environment=production --token=${{ secrets.VERCEL_TOKEN }}
        working-directory: backend/api-gateway-v2
      
      - name: Build Project
        run: vercel build --prod --token=${{ secrets.VERCEL_TOKEN }}
        working-directory: backend/api-gateway-v2
      
      - name: Deploy to Vercel
        run: vercel deploy --prebuilt --prod --token=${{ secrets.VERCEL_TOKEN }}
        working-directory: backend/api-gateway-v2
```

Agregar secret en GitHub:
- `VERCEL_TOKEN`: Tu token de Vercel

## 🎯 Conectar Frontend con Backend

### Actualizar Variables de Entorno del Frontend

En tu proyecto frontend (astro-shiba-pop):

```bash
# .env.production
PUBLIC_API_URL="https://astro-shiba-backend.vercel.app/graphql"
```

O en Vercel Dashboard del frontend:
```
PUBLIC_API_URL = https://astro-shiba-backend.vercel.app/graphql
```

### Actualizar CORS en el Backend

El backend ya está configurado para aceptar requests desde:
- `https://astro-shiba-pop.vercel.app`
- `https://www.astroshibapop.com`
- Todos los deployments de Vercel (*.vercel.app)

Si necesitas agregar más orígenes, edita `src/app.ts`:

```typescript
await app.register(cors, {
  origin: [
    'https://astro-shiba-pop.vercel.app',
    'https://www.astroshibapop.com',
    'https://tu-nuevo-dominio.com',
    /\.vercel\.app$/,
  ],
  credentials: true,
})
```

## 📊 Monitoreo y Logs

### Ver Logs en Tiempo Real

```bash
vercel logs astro-shiba-backend --follow
```

### Ver Logs de un Deployment Específico

```bash
vercel logs <deployment-url>
```

### Métricas en Vercel Dashboard

1. Ir a https://vercel.com/dashboard
2. Seleccionar "astro-shiba-backend"
3. Ver Analytics, Speed Insights, y Logs

### Prometheus Metrics

Endpoint disponible en: `https://tu-deployment.vercel.app/metrics`

Métricas incluidas:
- HTTP request duration
- GraphQL operation metrics
- Error rates
- Cache hit/miss ratios

## 🐛 Troubleshooting

### Error: "Environment variables not found"

**Solución**: Configurar variables de entorno en Vercel Dashboard o via CLI

```bash
vercel env ls
vercel env add VARIABLE_NAME production
```

### Error: "Build failed"

**Solución**: Verificar que todas las dependencias estén instaladas

```bash
rm -rf node_modules
pnpm install
pnpm build
```

### Error: "Function timeout"

**Solución**: Aumentar timeout en `vercel.json`

```json
{
  "builds": [{
    "config": {
      "maxDuration": 60  // Aumentar a 60 segundos
    }
  }]
}
```

### Error: "Cannot connect to database"

**Solución**: Verificar connection string y allowlist de IPs

```bash
# Probar conexión
vercel env pull .env.test
DATABASE_URL=$(cat .env.test | grep DATABASE_URL | cut -d '=' -f2) psql $DATABASE_URL
```

### Error: "GraphQL query complexity too high"

**Solución**: Ajustar limits en variables de entorno

```bash
vercel env add GRAPHQL_MAX_COMPLEXITY production
# Valor: 2000
```

### Logs no muestran información detallada

**Solución**: Aumentar LOG_LEVEL temporalmente

```bash
vercel env add LOG_LEVEL production
# Valor: debug
```

## 🔐 Seguridad

### Checklist de Seguridad

- [x] Helmet security headers habilitados
- [x] CORS configurado correctamente
- [x] Rate limiting activado
- [x] GraphQL query complexity limits
- [x] GraphQL introspection deshabilitado en producción
- [x] Logs sanitizados (sin datos sensibles)
- [x] HTTPS enforced
- [x] Environment variables en Vercel (no en código)

### Rotar Secrets

```bash
# Generar nuevo token de KV
# 1. Crear nuevo token en Vercel Dashboard
# 2. Actualizar en environment variables
vercel env rm KV_REST_API_TOKEN production
vercel env add KV_REST_API_TOKEN production
```

## 📈 Performance Optimization

### Configuración Recomendada

```json
{
  "regions": ["iad1"],  // Washington DC - cercano a Stellar
  "builds": [{
    "config": {
      "maxDuration": 30,
      "memory": 3008  // Máxima memoria disponible
    }
  }]
}
```

### Caching Strategy

El backend usa:
- Vercel KV para rate limiting y caching
- DataLoaders para batch/cache de queries
- Prisma Accelerate para connection pooling

### Cold Start Optimization

- Usa `includeFiles` en vercel.json
- Mantiene dependencias al mínimo
- Usa warmup requests (opcional)

## 🔄 Rollback

### Rollback a Deployment Anterior

```bash
# Listar deployments
vercel ls

# Promover deployment anterior a producción
vercel promote <deployment-url>
```

O desde Dashboard:
1. Ir a Deployments
2. Seleccionar deployment anterior
3. Clic en "..." → "Promote to Production"

## 📞 Soporte

### Recursos Útiles

- **Vercel Docs**: https://vercel.com/docs
- **Vercel Support**: https://vercel.com/support
- **Prisma Docs**: https://www.prisma.io/docs
- **Fastify Docs**: https://www.fastify.io/docs

### Contacto del Equipo

- **Team**: Nunalabs
- **Project**: Astro Shiba Pop

---

## ✅ Quick Start Commands

```bash
# Setup completo
cd backend/api-gateway-v2
chmod +x scripts/setup-vercel.sh
./scripts/setup-vercel.sh

# O manual
vercel login
cd backend/api-gateway-v2
vercel link
vercel env add DATABASE_URL production
vercel env add KV_REST_API_URL production
vercel env add KV_REST_API_TOKEN production
vercel env add TOKEN_FACTORY_CONTRACT_ID production
vercel env add STELLAR_RPC_URL production
pnpm build
vercel --prod

# Verificar
./scripts/verify-deployment.sh https://tu-deployment.vercel.app
```

¡Deployment exitoso! 🎉