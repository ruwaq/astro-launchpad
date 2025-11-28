# 🚀 Deployment Guide - API Gateway V2

## 📋 Pre-requisitos

- Node.js 18+
- Cuenta de GitHub con acceso al repositorio
- Cuenta de Vercel (https://vercel.com)
- Base de datos PostgreSQL (Supabase recomendado)
- Vercel KV o Upstash Redis (para rate limiting)

---

## ✅ Checklist Pre-Deploy (SEGURIDAD)

### Variables Críticas

| Variable | Requerido | Notas |
|----------|-----------|-------|
| `ADMIN_API_KEY` | ✅ Producción | Mínimo 32 caracteres |
| `GRAPHQL_INTROSPECTION` | ✅ | Debe ser `false` en producción |
| `GRAPHQL_PLAYGROUND` | ✅ | Debe ser `false` en producción |
| `CORS_ORIGIN` | ✅ | Solo dominios permitidos |
| `DATABASE_URL` | ✅ | Con SSL y connection pooling |

### Generar ADMIN_API_KEY

```bash
# Generar key segura de 64 caracteres
openssl rand -hex 32
# Ejemplo: a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456
```

**⚠️ IMPORTANTE**: Guarda esta key de forma segura. No la compartas ni la commitees.

---

## 🔧 Paso 1: Configuración Local

### 1.1 Verificar Build

```bash
cd backend/api-gateway-v2

# Limpiar
rm -rf dist .turbo

# Instalar dependencias
npm install --legacy-peer-deps --ignore-scripts

# Generar Prisma
npm run prisma:generate

# Build
npm run build
```

### 1.2 Test Local

```bash
# Iniciar servidor
pnpm dev

# En otra terminal, verificar
curl http://localhost:4000/health
# Esperado: {"status":"healthy"}
```

---

## 🌐 Paso 2: Configurar Vercel

### 2.1 Conectar Repositorio

1. Ve a https://vercel.com/new
2. Importa tu repositorio de GitHub
3. **Root Directory**: `backend/api-gateway-v2`

### 2.2 Build Settings

| Setting | Valor |
|---------|-------|
| Framework Preset | Other |
| Build Command | `echo 'Using pre-compiled JS files'` |
| Output Directory | (vacío) |
| Install Command | `npm install --legacy-peer-deps && npx prisma generate --schema=./prisma/schema.prisma` |

### 2.3 Variables de Entorno

Ve a **Settings > Environment Variables** y agrega:

#### 🔴 Requeridas (Producción)

```bash
NODE_ENV=production

# Database (Supabase con pooling)
DATABASE_URL=postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?sslmode=require

# Stellar
STELLAR_NETWORK=mainnet
STELLAR_RPC_URL=https://soroban.stellar.org
TOKEN_FACTORY_CONTRACT_ID=CXXX...

# Seguridad (CRÍTICO)
ADMIN_API_KEY=<tu-key-de-64-caracteres>
CORS_ORIGIN=https://astroshiba.io,https://app.astroshiba.io

# GraphQL Security
GRAPHQL_INTROSPECTION=false
GRAPHQL_PLAYGROUND=false
GRAPHQL_MAX_DEPTH=10
GRAPHQL_MAX_COMPLEXITY=5000
```

#### 🟡 Cache/Rate Limiting (Vercel KV)

```bash
KV_REST_API_URL=https://your-kv.upstash.io
KV_REST_API_TOKEN=your-token
```

Para configurar Vercel KV:
1. Dashboard > Storage > Create Database
2. Selecciona KV (Redis)
3. Las variables se auto-agregan

#### 🟢 Opcionales

```bash
# Rate limits personalizados
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100

# Logging
LOG_LEVEL=info
LOG_PRETTY=false

# IPFS (para imágenes)
PINATA_JWT=...
```

---

## 🚀 Paso 3: Deploy

### Opción A: Automático (Recomendado)

```bash
# Commit y push
git add .
git commit -m "chore: prepare for production deployment"
git push origin main
```

Vercel detecta el push y despliega automáticamente.

### Opción B: Manual con CLI

```bash
# Instalar Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy preview
vercel

# Deploy producción
vercel --prod
```

### Opción C: Script

```bash
cd backend/api-gateway-v2
./deploy-vercel.sh
```

---

## ✅ Paso 4: Verificar Deploy

### 4.1 Health Check

```bash
curl https://tu-api.vercel.app/health
# Esperado: {"status":"healthy"}
```

### 4.2 GraphQL Query

```bash
curl -X POST https://tu-api.vercel.app/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ globalStats { totalTokens totalVolume } }"}'
```

### 4.3 Verificar Rate Limiting

```bash
# Hacer 150+ requests para triggear rate limit
for i in {1..150}; do
  curl -s -o /dev/null -w "%{http_code}\n" \
    https://tu-api.vercel.app/graphql \
    -H "Content-Type: application/json" \
    -d '{"query":"{ tokens(first:1) { nodes { address } } }"}'
done
# Después de ~100 requests: 429 Too Many Requests
```

### 4.4 Verificar Introspection Deshabilitado

```bash
curl -X POST https://tu-api.vercel.app/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ __schema { types { name } } }"}'
# Esperado: Error (introspection disabled)
```

---

## 🐛 Troubleshooting

### "Cannot find module '@prisma/client'"

```bash
# Verificar que prisma:generate se ejecutó
npm run prisma:generate
vercel --prod
```

### "DATABASE_URL is required"

```bash
# Agregar variable en Vercel
vercel env add DATABASE_URL production
```

### "CORS error" en frontend

1. Verificar `CORS_ORIGIN` incluye tu dominio
2. Incluir protocolo: `https://` no solo el dominio

### "Rate limit exceeded" constantemente

- Sin Redis/KV: Sistema opera en "fail-open" (sin límites)
- Configurar Vercel KV para rate limiting real

### "Function invocation timeout"

- Verificar `maxDuration: 30` en vercel.json
- Revisar queries lentos en logs

---

## 📊 Monitoreo

### Vercel Dashboard

- **Logs**: Ver requests en tiempo real
- **Analytics**: Performance metrics
- **Functions**: Ejecución serverless

### Logs CLI

```bash
vercel logs tu-api.vercel.app
```

### Alertas Recomendadas

| Métrica | Umbral |
|---------|--------|
| Error rate | > 1% |
| Response time | > 2s (P95) |
| Rate limit hits | > 1000/hora |

---

## 🔄 Workflow de Desarrollo

```
dev branch → Preview Deploy → Test → main branch → Production Deploy
```

### Environments Recomendados

| Branch | Environment | Variables |
|--------|-------------|-----------|
| `dev` | Preview | Testnet, playground enabled |
| `staging` | Preview | Mainnet, playground enabled |
| `main` | Production | Mainnet, production settings |

---

## 📁 Estructura del Proyecto

```
backend/api-gateway-v2/
├── api/
│   └── index.js          # Vercel serverless handler
├── dist/                 # Build output
├── prisma/
│   └── schema.prisma     # Database schema
├── src/
│   ├── config/env.ts     # Environment validation
│   ├── graphql/          # GraphQL schema & resolvers
│   ├── lib/              # Rate limiter, prisma client
│   └── index.ts          # Apollo Server entry
├── .env.example          # Environment template
├── vercel.json           # Vercel config
└── DEPLOY.md             # This file
```

---

## 🎯 Comandos Rápidos

```bash
# Build local
pnpm build

# Deploy preview
vercel

# Deploy producción
vercel --prod

# Ver logs
vercel logs

# Agregar env var
vercel env add VARIABLE_NAME production

# Listar deployments
vercel list
```

---

## 📞 Recursos

- [Vercel Docs](https://vercel.com/docs)
- [Prisma Docs](https://www.prisma.io/docs)
- [Apollo Server Docs](https://www.apollographql.com/docs/apollo-server/)
- [Stellar Docs](https://developers.stellar.org)

---

Última actualización: 2025-11-28
