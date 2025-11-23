# 🚀 Workflow de Desarrollo y Deployment

## 📋 Tabla de Contenidos

1. [Desarrollo Local](#desarrollo-local)
2. [Testing Antes de Deploy](#testing-antes-de-deploy)
3. [Deployment a Vercel](#deployment-a-vercel)
4. [Troubleshooting](#troubleshooting)
5. [Mejores Prácticas](#mejores-prácticas)

---

## 🛠️ Desarrollo Local

### Instalación Inicial

```bash
# 1. Instalar dependencias
npm install --legacy-peer-deps

# 2. Generar Prisma Client
npx prisma generate --schema=./prisma/schema.prisma

# 3. Configurar variables de entorno
cp .env.example .env.local
# Editar .env.local con tus credenciales
```

### Desarrollo Diario

```bash
# Opción 1: Desarrollo con hot-reload (TypeScript directo)
npm run dev

# Opción 2: Simular ambiente de Vercel localmente
vercel dev --listen 4000
```

### Variables de Entorno Locales

```bash
# Descargar variables de Vercel (requiere vercel CLI)
vercel env pull .env.local

# O crear manualmente .env.local con:
# - DATABASE_URL
# - KV_REST_API_URL
# - KV_REST_API_TOKEN
# - STELLAR_RPC_URL
# - TOKEN_FACTORY_CONTRACT_ID
```

---

## ✅ Testing Antes de Deploy

### ⚠️ IMPORTANTE: Evitar Rate Limits de Vercel

Vercel limita deployments a **100 por día** en plan Hobby.
**SIEMPRE** testea localmente antes de hacer push.

### Script de Test Completo

```bash
# Ejecutar test completo (simula build de Vercel)
./test-local.sh
```

Este script ejecuta:
1. ✅ Install dependencies
2. ✅ Generate Prisma Client
3. ✅ Build TypeScript
4. ✅ Verify outputs
5. ✅ Simulate Vercel build

### Test Manual Paso a Paso

```bash
# 1. Limpiar y compilar
rm -rf dist
npm run build

# 2. Verificar que compila sin errores
echo $?  # Debe retornar 0

# 3. Verificar archivos generados
ls -la dist/api/graphql.js
ls -la api/graphql.ts

# 4. Test con curl (si tienes servidor corriendo)
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ __typename }"}'
```

### Checklist Pre-Deploy

- [ ] `npm run build` compila sin errores
- [ ] `npm run typecheck` pasa sin errores
- [ ] Archivos `.js` compilados existen en `dist/`
- [ ] Prisma Client genera correctamente
- [ ] Variables de entorno configuradas
- [ ] Test local funciona correctamente

---

## 🚀 Deployment a Vercel

### Método 1: Git Push (Recomendado)

```bash
# 1. Compilar localmente
npm run build

# 2. Agregar archivos compilados
git add dist/ api/ src/

# 3. Commit descriptivo
git commit -m "feat: descripción del cambio"

# 4. Push (trigger automático en Vercel)
git push origin main
```

### Método 2: Vercel CLI (Para testing)

```bash
# Preview deployment (no afecta producción)
vercel

# Production deployment
vercel --prod

# Build local + deploy precompilado
vercel build
vercel deploy --prebuilt
```

### ⏱️ Esperar Rate Limit

Si ves error "Deployment rate limited":

```bash
# Ver cuánto tiempo falta
# El mensaje indica: "retry in XX minutes"

# Mientras tanto, sigue desarrollando localmente
npm run dev

# O hacer cambios y commitear (sin push)
git add .
git commit -m "cambios mientras esperamos"
```

---

## 🐛 Troubleshooting

### Error: TypeScript Compilation Failed

```bash
# Limpiar cache y recompilar
rm -rf dist node_modules/.cache
npm run build
```

### Error: Prisma Client Not Generated

```bash
# Regenerar Prisma Client
npx prisma generate --schema=./prisma/schema.prisma

# Verificar generación
ls -la node_modules/.prisma/client/
```

### Error: Module Not Found en Vercel

**Causa**: Archivos compilados no están en el repositorio

**Solución**:
```bash
# 1. Asegurar que dist/ NO está en .gitignore
cat .gitignore | grep -v dist

# 2. Agregar dist/ al repo
git add -f dist/
git commit -m "chore: add compiled dist files"
git push origin main
```

### Error: Environment Variables Missing

```bash
# 1. Verificar localmente
cat .env.local

# 2. Verificar en Vercel Dashboard
# Settings → Environment Variables

# 3. Agregar variable faltante via CLI
vercel env add VARIABLE_NAME production
```

### Vercel Build Logs

```bash
# Ver logs del último deployment
vercel logs

# Ver logs de un deployment específico
vercel logs [deployment-url]
```

---

## 💡 Mejores Prácticas

### 1. Desarrollo

✅ **DO:**
- Usa `npm run dev` para desarrollo diario
- Compila localmente con `npm run build` antes de commit
- Commitea archivos compilados (`dist/`) al repo
- Usa mensajes de commit descriptivos
- Testea GraphQL queries localmente

❌ **DON'T:**
- No hagas push sin compilar localmente primero
- No confíes en que Vercel compile correctamente
- No ignores errores de TypeScript
- No despliegues directamente sin testear

### 2. TypeScript

✅ **DO:**
- Usa `// @ts-nocheck` solo cuando sea absolutamente necesario
- Mantén `strict: false` en tsconfig para pragmatismo
- Compila localmente SIEMPRE antes de deploy

❌ **DON'T:**
- No uses `any` excesivamente
- No ignores errores de tipos críticos
- No dejes código TypeScript sin compilar

### 3. Prisma

✅ **DO:**
- Genera el client después de cambios en schema
- Usa connection pooling (`max: 1` para serverless)
- Implementa proper error handling en queries

❌ **DON'T:**
- No modifiques archivos generados en `node_modules/.prisma`
- No uses conexiones directas sin pooling
- No olvides las migraciones en producción

### 4. Git Workflow

✅ **DO:**
- Branch para features: `git checkout -b feature/nombre`
- Commit frecuente con mensajes claros
- Pull antes de push: `git pull origin main`
- Review cambios: `git diff` antes de commit

❌ **DON'T:**
- No hagas force push a main: `git push -f`
- No commites `node_modules/`
- No commites `.env` (solo `.env.example`)

### 5. Deployment

✅ **DO:**
- Testea localmente primero SIEMPRE
- Usa preview deployments para testing
- Monitorea logs después de deploy
- Mantén un changelog de deployments

❌ **DON'T:**
- No deploys sin testear (rate limit!)
- No deploys a producción sin preview
- No ignores warnings en build logs

---

## 📚 Comandos Rápidos

```bash
# Desarrollo
npm run dev              # Hot-reload development
npm run build            # Compile TypeScript
npm run typecheck        # Check types without compiling
npm test                 # Run tests

# Prisma
npm run prisma:generate  # Generate Prisma Client
npm run prisma:push      # Push schema changes (dev)
npm run prisma:migrate   # Deploy migrations (prod)

# Vercel
vercel dev               # Local Vercel environment
vercel                   # Preview deployment
vercel --prod            # Production deployment
vercel logs              # View deployment logs

# Testing
./test-local.sh          # Full local test suite
npm run typecheck        # TypeScript validation
```

---

## 🔗 Links Útiles

- [Vercel CLI Docs](https://vercel.com/docs/cli)
- [Vercel Functions](https://vercel.com/docs/functions)
- [Prisma Docs](https://www.prisma.io/docs)
- [Apollo Server Docs](https://www.apollographql.com/docs/apollo-server)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

---

## 📝 Notas Importantes

### Rate Limits de Vercel

- **Hobby Plan**: 100 deployments/día
- **Pro Plan**: 3000 deployments/día
- **Enterprise**: Ilimitado

### Arquitectura del Proyecto

```
backend/api-gateway-v2/
├── api/                    # Vercel Functions (archivos .ts)
│   └── graphql.ts         # Main GraphQL handler
├── src/                    # Source code
│   ├── config/            # Configuration
│   ├── graphql/           # GraphQL schema, resolvers, loaders
│   └── lib/               # Utilities (Prisma, cache, etc.)
├── dist/                   # Compiled JavaScript (COMMITED)
│   ├── api/               # Compiled Vercel Functions
│   └── src/               # Compiled source
├── prisma/                 # Prisma schema
└── vercel.json            # Vercel configuration
```

### Por Qué Commiteamos `dist/`

**Razón**: Vercel tiene problemas compilando TypeScript complejo con monorepos.

**Solución**: Compilamos localmente y deployamos archivos `.js` precompilados.

**Ventajas**:
- ✅ Build 100% reproducible
- ✅ Sin errores de compilación en Vercel
- ✅ Deployment más rápido
- ✅ Control total sobre outputs

---

## 🎯 Workflow Ideal

```
1. git pull origin main
2. git checkout -b feature/mi-feature
3. npm run dev (desarrolla tu feature)
4. npm run build (compila localmente)
5. ./test-local.sh (valida todo)
6. git add .
7. git commit -m "feat: descripción"
8. git push origin feature/mi-feature
9. Crear PR en GitHub
10. Vercel crea preview deployment automático
11. Review + merge a main
12. Vercel deploya a producción automático
```

---

## ✨ Tips Pro

1. **Usa aliases de git**:
   ```bash
   git config --global alias.ac '!git add -A && git commit -m'
   git ac "feat: mi feature"  # Shortcut
   ```

2. **Script de pre-commit**:
   ```bash
   # .git/hooks/pre-commit
   #!/bin/bash
   npm run build || exit 1
   git add dist/
   ```

3. **Watch mode para desarrollo**:
   ```bash
   # Terminal 1
   npm run dev
   
   # Terminal 2
   npm run build -- --watch
   ```

4. **Monitoreo de logs en tiempo real**:
   ```bash
   vercel logs --follow
   ```

---

**Última actualización**: Noviembre 2024
**Versión**: 1.0.0
**Mantenido por**: Nunalabs Team