# 🚀 Deploy del Backend - Astro Shiba

## ⚡ Deploy en 3 Pasos

### 1️⃣ Preparación (5 minutos)

```bash
# Navegar al directorio del backend
cd backend/api-gateway-v2

# Instalar Vercel CLI si no lo tienes
npm install -g vercel

# Configurar token de Vercel
export VERCEL_TOKEN="L2UZQ6dqEvn5Sg8zPoxeEPGO"
```

### 2️⃣ Configurar Variables de Entorno (10 minutos)

#### Crear Vercel KV Store (Redis)
1. Ir a: https://vercel.com/dashboard/stores
2. Click "Create Database" → Seleccionar "KV"
3. Nombre: `astro-shiba-cache`
4. Región: `iad1` (Washington DC)
5. Guardar las credenciales: `KV_REST_API_URL` y `KV_REST_API_TOKEN`

#### Configurar Base de Datos (elige uno)

**Opción A - Neon (Recomendado):**
1. Crear cuenta: https://neon.tech
2. Crear proyecto nuevo
3. Copiar Connection String
4. Formato: `postgresql://user:pass@host/db?sslmode=require`

**Opción B - Supabase:**
1. Crear proyecto: https://supabase.com
2. Settings → Database → Connection String
3. Usar "Direct connection"

**Opción C - Railway:**
1. Crear proyecto: https://railway.app
2. Agregar PostgreSQL
3. Copiar DATABASE_URL

#### Agregar Variables en Vercel

```bash
# Base de datos
vercel env add DATABASE_URL production
# Pegar tu connection string de PostgreSQL

vercel env add DIRECT_DATABASE_URL production
# Pegar la misma URL (o Prisma Accelerate si lo usas)

# Vercel KV (Redis)
vercel env add KV_REST_API_URL production
# Pegar desde dashboard de KV Store

vercel env add KV_REST_API_TOKEN production
# Pegar desde dashboard de KV Store

# Stellar/Soroban
vercel env add TOKEN_FACTORY_CONTRACT_ID production
# Pegar tu contract ID: CBGTG6EKTQ3T2AKZJSQ2CDKUUATWRKGCQXVP6QW...

vercel env add STELLAR_RPC_URL production
# Pegar: https://soroban-testnet.stellar.org

vercel env add STELLAR_NETWORK production
# Pegar: testnet

# Configuración de producción (automático)
vercel env add NODE_ENV production
# Pegar: production

vercel env add LOG_LEVEL production
# Pegar: info

vercel env add GRAPHQL_INTROSPECTION production
# Pegar: false

vercel env add GRAPHQL_PLAYGROUND production
# Pegar: false
```

### 3️⃣ Deploy (2 minutos)

```bash
# Opción A: Deploy Automático (RECOMENDADO)
chmod +x scripts/quick-deploy.sh
./scripts/quick-deploy.sh preview    # Primero prueba
./scripts/quick-deploy.sh production # Cuando esté listo

# Opción B: Deploy Manual
pnpm install
pnpm build
vercel link --yes    # Solo primera vez
vercel               # Preview
vercel --prod        # Production
```

---

## ✅ Verificación Post-Deploy

```bash
# Obtén tu URL de deployment
BACKEND_URL="https://tu-deployment.vercel.app"

# Health check
curl $BACKEND_URL/health

# Test GraphQL
curl -X POST $BACKEND_URL/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ health { status } }"}'

# Verificación automática
./scripts/verify-deployment.sh $BACKEND_URL
```

**Respuesta esperada del health check:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime": 123.45
}
```

---

## 🔄 Migrar Base de Datos

```bash
# Desde el directorio backend/shared
cd ../shared

# Migrar schema a producción
DATABASE_URL="tu-database-url" pnpm prisma migrate deploy

# O si tienes variables configuradas localmente
vercel env pull .env.production --cwd=../api-gateway-v2
pnpm prisma migrate deploy
```

---

## 🌐 Conectar Frontend

### Actualizar Variables del Frontend

```bash
# En tu proyecto frontend
cd ../../apps/web

# Agregar URL del backend
vercel env add PUBLIC_API_URL production
# Valor: https://astro-shiba-backend.vercel.app/graphql

# O desde Vercel Dashboard:
# 1. Ir a proyecto "astro-shiba-pop"
# 2. Settings → Environment Variables
# 3. Agregar: PUBLIC_API_URL = https://tu-backend.vercel.app/graphql
```

### CORS ya está configurado para:
- ✅ `https://astro-shiba-pop.vercel.app`
- ✅ `https://www.astroshibapop.com`
- ✅ `*.vercel.app` (todos los preview deployments)

---

## 📊 Monitoreo

### Ver Logs en Tiempo Real
```bash
vercel logs --follow
```

### Ver Logs de Deployment Específico
```bash
vercel logs https://tu-deployment.vercel.app
```

### Dashboard de Vercel
```bash
vercel dashboard
# O visitar: https://vercel.com/dashboard
```

### Endpoints de Monitoreo
- **Health**: `https://tu-backend.vercel.app/health`
- **Metrics** (Prometheus): `https://tu-backend.vercel.app/metrics`
- **GraphQL**: `https://tu-backend.vercel.app/graphql`

---

## 🐛 Troubleshooting Común

### ❌ Error: "Environment variables not found"
```bash
# Verificar variables configuradas
vercel env ls

# Pull variables para verificar
vercel env pull .env.check
cat .env.check
```

### ❌ Error: "Build failed"
```bash
# Limpiar y reinstalar
rm -rf node_modules dist .turbo
pnpm install
pnpm build
```

### ❌ Error: "Cannot connect to database"
```bash
# Verificar connection string
vercel env get DATABASE_URL

# Probar conexión (requiere psql)
psql "tu-connection-string" -c "SELECT 1"
```

### ❌ Error: "Function timeout"
```bash
# Ya configurado en vercel.json:
# maxDuration: 30 segundos
# memory: 3008 MB
# Si persiste, contactar soporte de Vercel
```

### 🔍 Ver Logs Detallados
```bash
# Temporalmente aumentar nivel de logs
vercel env add LOG_LEVEL production
# Valor: debug

# Ver logs
vercel logs --follow

# Restaurar a info después
vercel env rm LOG_LEVEL production
vercel env add LOG_LEVEL production
# Valor: info
```

---

## 🔄 Comandos Útiles

```bash
# Listar deployments
vercel ls

# Información del deployment
vercel inspect

# Promover preview a production
vercel promote https://preview-url.vercel.app

# Rollback a deployment anterior
vercel rollback

# Abrir dashboard
vercel dashboard

# Remover proyecto (¡cuidado!)
vercel remove astro-shiba-backend
```

---

## 📋 Checklist Post-Deploy

- [ ] Backend deployado en Vercel
- [ ] Health check responde correctamente
- [ ] GraphQL endpoint funciona
- [ ] Base de datos migrada
- [ ] Frontend conectado al backend
- [ ] Variables de entorno configuradas
- [ ] CORS configurado
- [ ] Logs monitoreados
- [ ] Métricas disponibles

---

## 📦 Estructura del Proyecto

```
backend/api-gateway-v2/
├── api/
│   └── graphql.ts          # Vercel serverless handler
├── src/
│   ├── app.ts              # Aplicación Fastify principal
│   ├── index.ts            # Entry point (dev)
│   ├── graphql/            # Schema, resolvers, context
│   └── lib/                # Utilidades, cache, seguridad
├── scripts/
│   ├── quick-deploy.sh     # 🚀 Deploy rápido
│   ├── setup-vercel.sh     # Setup completo
│   ├── pre-deploy-check.sh # Verificación pre-deploy
│   └── verify-deployment.sh # Verificación post-deploy
├── vercel.json             # Configuración de Vercel
├── package.json            # Dependencias y scripts
└── tsconfig.json           # TypeScript config
```

---

## 🎯 URLs Importantes

### Tu Proyecto
- **Backend API**: `https://astro-shiba-backend.vercel.app`
- **Frontend**: `https://astro-shiba-pop.vercel.app`
- **Dashboard**: https://vercel.com/dashboard

### Servicios
- **Vercel KV**: https://vercel.com/dashboard/stores
- **Neon Database**: https://console.neon.tech
- **Stellar RPC**: https://soroban-testnet.stellar.org

### Documentación
- **Vercel Docs**: https://vercel.com/docs
- **Prisma Docs**: https://www.prisma.io/docs
- **Fastify Docs**: https://www.fastify.io/docs
- **GraphQL Docs**: https://graphql.org/learn

---

## 🔐 Seguridad

### ✅ Configurado Automáticamente
- Helmet security headers
- CORS restricción de orígenes
- Rate limiting (100 req/min anónimo, 10 req/min operaciones caras)
- GraphQL query complexity limits
- SQL injection protection
- XSS protection
- HTTPS enforced
- GraphQL introspection deshabilitado en producción

### 🔑 Rotar Secrets
```bash
# Si necesitas rotar tokens
vercel env rm KV_REST_API_TOKEN production
vercel env add KV_REST_API_TOKEN production
# Pegar nuevo token

# Redeploy para aplicar
vercel --prod
```

---

## 📈 Performance

### Optimizaciones Incluidas
- ✅ Vercel Edge Network (CDN global)
- ✅ Serverless functions (auto-scaling)
- ✅ Connection pooling (Prisma)
- ✅ Redis caching (Vercel KV)
- ✅ DataLoader batching
- ✅ GraphQL JIT compilation
- ✅ Gzip compression

### Métricas Disponibles
```bash
# Ver métricas Prometheus
curl https://tu-backend.vercel.app/metrics

# Dashboard de Vercel
vercel dashboard
```

---

## 🆘 Soporte

### Recursos
- **Documentación Completa**: `DEPLOYMENT_GUIDE.md`
- **Quick Start**: `QUICK_START.md`
- **Scripts**: `scripts/`

### Team Info
- **Organization**: Nunalabs
- **Project**: Astro Shiba Pop
- **API Token**: L2UZQ6dqEvn5Sg8zPoxeEPGO

### ¿Necesitas Ayuda?
1. Revisa `DEPLOYMENT_GUIDE.md` para guía detallada
2. Ejecuta `./scripts/pre-deploy-check.sh` para diagnóstico
3. Verifica logs: `vercel logs --follow`
4. Contacta Vercel Support: https://vercel.com/support

---

## ✨ ¡Listo para Deploy!

Ejecuta simplemente:

```bash
cd backend/api-gateway-v2
./scripts/quick-deploy.sh preview
```

**¡Eso es todo!** 🎉

El script se encargará del resto. Si hay algún problema, los mensajes de error te guiarán sobre qué hacer.

---

**Última actualización**: Noviembre 2024  
**Versión**: 0.2.0  
**Maintainer**: Nunalabs Team