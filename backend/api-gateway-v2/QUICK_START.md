# ⚡ Quick Start - Deploy Backend a Vercel

## 🚀 Comandos Rápidos (Copy & Paste)

### Opción 1: Deploy Automático (Recomendado)

```bash
# Navegar al backend
cd backend/api-gateway-v2

# Dar permisos de ejecución
chmod +x scripts/quick-deploy.sh

# Deploy a Preview (prueba primero)
./scripts/quick-deploy.sh preview

# Si todo funciona, deploy a Production
./scripts/quick-deploy.sh production
```

### Opción 2: Deploy Manual con Vercel CLI

```bash
# 1. Instalar Vercel CLI (si no lo tienes)
npm install -g vercel

# 2. Login con tu token
export VERCEL_TOKEN="L2UZQ6dqEvn5Sg8zPoxeEPGO"

# 3. Navegar al backend
cd backend/api-gateway-v2

# 4. Instalar dependencias
pnpm install

# 5. Build
pnpm build

# 6. Link proyecto (primera vez)
vercel link --yes

# 7. Deploy Preview
vercel

# 8. Deploy Production (cuando esté listo)
vercel --prod
```

---

## 📝 Configuración de Variables de Entorno

### Paso 1: Crear Vercel KV Store

```bash
# 1. Ir a: https://vercel.com/dashboard/stores
# 2. Click "Create Database" → "KV" (Redis)
# 3. Nombre: astro-shiba-cache
# 4. Región: iad1
# 5. Copiar KV_REST_API_URL y KV_REST_API_TOKEN
```

### Paso 2: Configurar Variables en Vercel

Opción A - Desde CLI:

```bash
cd backend/api-gateway-v2

# Database
vercel env add DATABASE_URL production
# Pegar: postgresql://user:password@host:5432/database?sslmode=require

vercel env add DIRECT_DATABASE_URL production
# Pegar la misma URL o la URL de Prisma Accelerate

# Vercel KV
vercel env add KV_REST_API_URL production
# Pegar: https://your-kv-xxxx.upstash.io

vercel env add KV_REST_API_TOKEN production
# Pegar: tu token de KV

# Stellar
vercel env add TOKEN_FACTORY_CONTRACT_ID production
# Pegar: CBGTG6EKTQ3T2AKZJSQ2CDKUUATWRKGCQXVP6QWXXXXXXXXXXXXXXXXXXX

vercel env add STELLAR_RPC_URL production
# Pegar: https://soroban-testnet.stellar.org

vercel env add STELLAR_NETWORK production
# Pegar: testnet

# Configuración de producción
vercel env add NODE_ENV production
# Pegar: production

vercel env add LOG_LEVEL production
# Pegar: info

vercel env add LOG_PRETTY production
# Pegar: false

vercel env add GRAPHQL_INTROSPECTION production
# Pegar: false

vercel env add GRAPHQL_PLAYGROUND production
# Pegar: false
```

Opción B - Desde Dashboard:

```bash
# 1. Ir a: https://vercel.com/dashboard
# 2. Seleccionar proyecto "astro-shiba-backend"
# 3. Settings → Environment Variables
# 4. Agregar cada variable con el botón "Add New"
```

---

## ✅ Verificación Rápida

```bash
# Reemplaza con tu URL de deployment
DEPLOY_URL="https://tu-deployment.vercel.app"

# Health Check
curl $DEPLOY_URL/health

# GraphQL Query
curl -X POST $DEPLOY_URL/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ health { status version } }"}'

# Metrics
curl $DEPLOY_URL/metrics

# O usa el script automático
./scripts/verify-deployment.sh $DEPLOY_URL
```

---

## 🔧 Setup Base de Datos

### Opción 1: Neon (Recomendado)

```bash
# 1. Crear cuenta en: https://neon.tech
# 2. Crear nuevo proyecto
# 3. Copiar Connection String
# 4. Formato: postgresql://user:password@host/database?sslmode=require
```

### Opción 2: Supabase

```bash
# 1. Crear proyecto en: https://supabase.com
# 2. Settings → Database → Connection String
# 3. Usar "Direct connection" (no Pooling)
```

### Migrar Schema

```bash
# Desde la raíz del monorepo
cd backend/shared

# Pull variables de producción
vercel env pull .env.production --cwd=../api-gateway-v2

# Migrar
DATABASE_URL="tu-database-url" pnpm prisma migrate deploy

# O si tienes .env configurado
pnpm prisma migrate deploy
```

---

## 🎯 Conectar Frontend con Backend

### Actualizar Frontend

```bash
# En el proyecto frontend (apps/web)
cd ../../apps/web

# Agregar variable de entorno en Vercel
vercel env add PUBLIC_API_URL production
# Valor: https://astro-shiba-backend.vercel.app/graphql

# O editarlo localmente y redeploy
echo "PUBLIC_API_URL=https://tu-backend.vercel.app/graphql" >> .env.production
```

---

## 🐛 Troubleshooting Rápido

### Error: "Environment variables not found"

```bash
# Listar variables configuradas
vercel env ls

# Verificar que todas las requeridas estén presentes
vercel env pull .env.check
cat .env.check
```

### Error: "Build failed"

```bash
# Limpiar y reinstalar
rm -rf node_modules dist .turbo
pnpm install
pnpm build
```

### Error: "Cannot connect to database"

```bash
# Probar conexión local
vercel env pull .env.test
source .env.test
psql $DATABASE_URL -c "SELECT 1"
```

### Ver Logs

```bash
# Logs en tiempo real
vercel logs --follow

# Logs de deployment específico
vercel logs https://tu-deployment.vercel.app
```

---

## 📊 Comandos Útiles

```bash
# Ver deployments
vercel ls

# Ver deployment actual
vercel inspect

# Promover preview a production
vercel promote https://preview-url.vercel.app

# Rollback
vercel rollback

# Ver logs
vercel logs

# Abrir dashboard
vercel dashboard

# Listar variables de entorno
vercel env ls

# Pull variables localmente
vercel env pull .env.local

# Remover proyecto
vercel remove astro-shiba-backend
```

---

## 📋 Checklist Completo

### Antes del Deploy

- [ ] Vercel CLI instalado (`npm install -g vercel`)
- [ ] Base de datos PostgreSQL creada (Neon/Supabase/Railway)
- [ ] Vercel KV Store creado
- [ ] Stellar RPC URL disponible
- [ ] Token Factory Contract ID conocido
- [ ] Variables de entorno preparadas

### Durante el Deploy

- [ ] `pnpm install` exitoso
- [ ] `pnpm build` exitoso
- [ ] Variables de entorno configuradas en Vercel
- [ ] Deploy preview funciona
- [ ] Health check pasa
- [ ] GraphQL queries funcionan

### Después del Deploy

- [ ] Migrar schema de base de datos
- [ ] Actualizar URL en frontend
- [ ] Configurar CORS si es necesario
- [ ] Monitorear logs iniciales
- [ ] Verificar métricas
- [ ] Probar desde frontend

---

## 🎉 Todo Listo!

Tu backend debería estar corriendo en:
```
https://astro-shiba-backend.vercel.app
```

Endpoints disponibles:
- **API Info**: `/`
- **Health**: `/health`
- **GraphQL**: `/graphql`
- **Metrics**: `/metrics`

---

## 🆘 Ayuda Rápida

### Links Útiles
- **Vercel Dashboard**: https://vercel.com/dashboard
- **Vercel Docs**: https://vercel.com/docs
- **Neon Database**: https://neon.tech
- **Vercel KV**: https://vercel.com/docs/storage/vercel-kv

### Contacto
- **Team**: Nunalabs
- **Project**: Astro Shiba Pop
- **Token**: L2UZQ6dqEvn5Sg8zPoxeEPGO

### Scripts Disponibles
```bash
./scripts/quick-deploy.sh           # Deploy rápido
./scripts/setup-vercel.sh           # Setup completo guiado
./scripts/pre-deploy-check.sh       # Verificar antes de deploy
./scripts/verify-deployment.sh URL  # Verificar deployment
```

---

**¿Problemas?** Revisa `DEPLOYMENT_GUIDE.md` para guía detallada.