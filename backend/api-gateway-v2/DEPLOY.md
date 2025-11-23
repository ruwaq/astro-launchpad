# 🚀 Deployment Guide - API Gateway V2

## Solución al Problema de Prisma en Vercel

### ✅ Cambios Realizados

1. **Prisma Client Local**: Movido de workspace compartido a local
2. **Config Local**: Copiado `env.ts` al proyecto
3. **Dependencies Actualizadas**: Todas las dependencias necesarias están en `package.json`
4. **Build Optimizado**: Script `postinstall` genera Prisma Client automáticamente

### 📋 Pre-requisitos

- Node.js 18+
- Vercel CLI: `npm install -g vercel`
- Variables de entorno configuradas en Vercel

### 🔧 Variables de Entorno Requeridas en Vercel

```bash
# Database
DATABASE_URL=postgresql://...
DIRECT_DATABASE_URL=postgresql://... (opcional)

# Redis/KV
KV_REST_API_URL=https://...
KV_REST_API_TOKEN=...

# Stellar (opcional para health check)
STELLAR_NETWORK=testnet
STELLAR_RPC_URL=https://...
TOKEN_FACTORY_CONTRACT_ID=C...

# Node
NODE_ENV=production
```

### 🚀 Deployment Rápido

#### Opción 1: Automatic (Recomendado)

```bash
cd backend/api-gateway-v2
./deploy-vercel.sh
```

#### Opción 2: Manual

```bash
cd backend/api-gateway-v2

# 1. Limpiar
rm -rf dist .turbo

# 2. Instalar dependencias
npm install --legacy-peer-deps --ignore-scripts

# 3. Generar Prisma
npm run prisma:generate

# 4. Build
npm run build

# 5. Deploy
vercel --prod
```

#### Opción 3: Desde Git (Push to Deploy)

```bash
git add .
git commit -m "fix: prisma deployment configuration"
git push origin main
```

Vercel detectará el push y desplegará automáticamente.

### 🔍 Verificar Deployment

```bash
# Health check
curl https://tu-backend.vercel.app/health

# GraphQL endpoint
curl https://tu-backend.vercel.app/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ __typename }"}'
```

### 🐛 Troubleshooting

#### Error: "Cannot find module '@prisma/client'"

**Solución**: Asegurar que `postinstall` script se ejecute:
```bash
npm run prisma:generate
```

#### Error: "DATABASE_URL is required"

**Solución**: Configurar variable en Vercel:
```bash
vercel env add DATABASE_URL
```

#### Error: "Function invocation failed"

**Causas comunes**:
1. Prisma Client no generado → Verificar logs de build
2. Variables de entorno faltantes → Revisar Vercel dashboard
3. Timeout → Aumentar `maxDuration` en vercel.json

**Verificar logs**:
```bash
vercel logs <deployment-url>
```

### 📊 Estructura Actualizada

```
backend/api-gateway-v2/
├── api/
│   └── index.js          # Handler de Vercel (actualizado)
├── dist/                 # Build output (auto-generado)
├── prisma/
│   └── schema.prisma     # Schema local (copiado de shared)
├── src/
│   ├── config/
│   │   └── env.ts        # Config local (copiado de shared)
│   ├── lib/
│   │   └── prisma.ts     # Cliente Prisma local (nuevo)
│   └── app.ts            # App principal
├── package.json          # Con scripts de prisma
├── vercel.json           # Configuración optimizada
└── deploy-vercel.sh      # Script de deployment
```

### ✨ Mejores Prácticas Implementadas

1. **Singleton Pattern**: Prisma Client reutilizado en warm starts
2. **Prisma Accelerate**: Connection pooling para serverless
3. **Error Handling**: Logs detallados en desarrollo, sanitizados en producción
4. **Memory Management**: 1024MB para funciones serverless
5. **Build Optimization**: Solo archivos necesarios en deployment

### 🎯 Next Steps

1. Deployar a Vercel
2. Verificar endpoints
3. Monitorear logs
4. Configurar custom domain (opcional)

### 📞 Soporte

Si el deployment falla:
1. Revisar logs: `vercel logs`
2. Verificar variables de entorno en Vercel dashboard
3. Asegurar que el build local funciona: `npm run build`
