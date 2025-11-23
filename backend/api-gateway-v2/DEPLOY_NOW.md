# 🚀 DEPLOY AHORA - 5 MINUTOS

## ✅ PROBLEMA RESUELTO

- ✅ Prisma Client ahora es LOCAL (no depende de workspace)
- ✅ Config es LOCAL (no depende de shared)
- ✅ Build funciona correctamente
- ✅ Vercel.json optimizado

## 📋 PASO 1: VARIABLES DE ENTORNO EN VERCEL

Ve a: https://vercel.com/tu-proyecto/settings/environment-variables

Agrega estas variables (si no las tienes):

```bash
DATABASE_URL=postgresql://...
KV_REST_API_URL=https://...
KV_REST_API_TOKEN=...
NODE_ENV=production
```

## 🚀 PASO 2: DEPLOY (ELIGE UNO)

### Opción A: Automático (Recomendado)

```bash
cd backend/api-gateway-v2
./deploy-vercel.sh
```

### Opción B: Git Push (Si tienes GitHub conectado)

```bash
git add .
git commit -m "fix: prisma local deployment"
git push origin main
```

Vercel desplegará automáticamente.

### Opción C: Manual Rápido

```bash
cd backend/api-gateway-v2
npm run build
vercel --prod
```

### Opción D: Desde Vercel Dashboard

1. Ve a https://vercel.com/dashboard
2. Selecciona tu proyecto
3. Click "Deployments"
4. Click "Redeploy" en el último deployment
5. Marca "Use existing Build Cache" = OFF
6. Click "Redeploy"

## 🔍 PASO 3: VERIFICAR

```bash
# Copia la URL de tu deployment y prueba:
curl https://tu-backend.vercel.app/health

# Debería responder:
# {"status":"ok","timestamp":"...","uptime":...}
```

## 🎯 SI FALLA

### Ver logs en tiempo real:

```bash
vercel logs tu-deployment-url --follow
```

### Errores comunes:

1. **"Cannot find module @prisma/client"**
   - Solución: El build debe ejecutar `npm run prisma:generate`
   - Verifica logs de build en Vercel

2. **"DATABASE_URL is required"**
   - Solución: Agrega la variable en Vercel dashboard

3. **"Function timeout"**
   - Solución: Ya está configurado con 10s timeout en vercel.json

## ✨ QUÉ CAMBIÓ

### Antes (❌ No funcionaba):
```
@astroshibapop/shared/prisma → No se generaba en Vercel
```

### Ahora (✅ Funciona):
```
./lib/prisma.ts → Generado localmente en build
./config/env.ts → Config local
prisma/schema.prisma → Schema local
```

## 📊 ESTRUCTURA FINAL

```
backend/api-gateway-v2/
├── api/index.js          ✅ Handler optimizado
├── dist/                 ✅ Build output
├── prisma/schema.prisma  ✅ Schema local
├── src/
│   ├── config/env.ts     ✅ Config local
│   └── lib/prisma.ts     ✅ Cliente local
└── vercel.json           ✅ Configuración optimizada
```

## 🎉 DEPLOY COMANDO ÚNICO

Si tienes prisa y todo está configurado:

```bash
cd backend/api-gateway-v2 && npm run build && vercel --prod
```

## 📞 TROUBLESHOOTING RÁPIDO

```bash
# Test local primero
cd backend/api-gateway-v2
npm install --legacy-peer-deps --ignore-scripts
npm run prisma:generate
npm run build
node dist/src/index.js

# Si local funciona, deploy directo
vercel --prod
```

## ⚡ COMANDOS ÚTILES

```bash
# Ver deployments
vercel list

# Ver logs
vercel logs

# Rollback si algo sale mal
vercel rollback

# Abrir proyecto en dashboard
vercel open
```

## 🔥 RESUMEN EJECUTIVO

1. **Los cambios YA están hechos** ✅
2. **Solo necesitas deployar** 🚀
3. **Usa opción A, B, C o D de arriba** 📋
4. **Verifica con /health** 🔍
5. **Listo!** 🎉

---

**TIEMPO ESTIMADO: 2-5 minutos**