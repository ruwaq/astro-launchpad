# Backend Testing Guide - Testnet

## Quick Start

### Opción 1: Script Automatizado E2E (Recomendado)

```bash
cd backend
./scripts/test-e2e.sh
```

Este script ejecuta:
1. ✅ Verifica pre-requisitos
2. ✅ Configura base de datos
3. ✅ Despliega contrato (si es necesario)
4. ✅ Inicia indexer y API gateway
5. ✅ Ejecuta pruebas
6. ✅ Limpia recursos

### Opción 2: Pruebas Manuales Paso a Paso

#### 1. Preparar Base de Datos

```bash
cd backend/shared
npx prisma db push
npx prisma generate
```

#### 2. Desplegar Contrato (si no está desplegado)

```bash
cd contracts/sac-factory

# Verificar identidad
stellar keys ls

# Desplegar
bash scripts/deploy-testnet.sh
```

Guarda el CONTRACT_ID que se muestra al final.

#### 3. Configurar Variables de Entorno

Crea `backend/.env.test`:

```bash
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/astroshibapop"

# Stellar
STELLAR_NETWORK=testnet
STELLAR_RPC_URL=https://soroban-testnet.stellar.org:443

# Contract (usa el ID del paso 2)
TOKEN_FACTORY_CONTRACT_ID=CXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX

# Opcional: Redis
REDIS_URL=redis://localhost:6379

# Logging
LOG_LEVEL=info
LOG_PRETTY=true

# Metrics
METRICS_PORT=9090
```

#### 4. Iniciar Indexer

```bash
cd backend/indexer
npm run dev
```

Verifica en los logs:
- ✅ "Database connected"
- ✅ "Starting Token Factory stream"
- ✅ "Metrics server listening on port 9090"

Prueba health check:
```bash
curl http://localhost:9090/health
```

#### 5. Iniciar API Gateway (en otra terminal)

```bash
cd backend/api-gateway-v2
npm run dev
```

Verifica:
```bash
curl http://localhost:4000/api/health
```

#### 6. Crear Token de Prueba

```bash
cd contracts/sac-factory

stellar contract invoke \
  --id <TU_CONTRACT_ID> \
  --source testnet-deployer \
  --network testnet \
  -- create_token \
  --name "Test Token" \
  --symbol "TEST" \
  --decimals 7 \
  --initial_supply 1000000000000 \
  --creator $(stellar keys address testnet-deployer)
```

#### 7. Verificar Indexación

Espera 30 segundos y verifica:

```bash
# Ver logs del indexer
# Deberías ver: "Found X Token Factory events"

# Verificar en base de datos
cd backend/shared
npx prisma studio
# Abre http://localhost:5555 y revisa la tabla Token
```

#### 8. Probar API GraphQL

```bash
# Health check
curl -X POST http://localhost:4000/api/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "{ health { status } }"}'

# Obtener tokens
curl -X POST http://localhost:4000/api/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "{ tokens(limit: 5) { edges { node { address name symbol } } totalCount } }"}'

# Obtener estadísticas globales
curl -X POST http://localhost:4000/api/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "{ globalFeeStats { totalFees totalProtocolFees totalLpFees } }"}'
```

## Pruebas Avanzadas

### Test de Compra/Venta de Tokens

```bash
# Comprar tokens
stellar contract invoke \
  --id <CONTRACT_ID> \
  --source testnet-deployer \
  --network testnet \
  -- buy \
  --token <TOKEN_ADDRESS> \
  --amount 1000000 \
  --buyer $(stellar keys address testnet-deployer)

# Vender tokens
stellar contract invoke \
  --id <CONTRACT_ID> \
  --source testnet-deployer \
  --network testnet \
  -- sell \
  --token <TOKEN_ADDRESS> \
  --amount 500000 \
  --seller $(stellar keys address testnet-deployer)
```

### Verificar Fees

```bash
# Ver fees en base de datos
cd backend/shared
npx prisma studio
# Revisar tabla FeeCollection

# Ver fees via API
curl -X POST http://localhost:4000/api/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "{ feeCollectionHistory(limit: 10) { items { type amount timestamp } } }"}'
```

### Monitorear Métricas

```bash
# Métricas del indexer
curl http://localhost:9090/metrics

# Métricas del API Gateway
curl http://localhost:4000/api/metrics
```

## Troubleshooting

### Indexer no detecta eventos

1. Verifica que el CONTRACT_ID sea correcto
2. Verifica conectividad a RPC:
   ```bash
   curl https://soroban-testnet.stellar.org:443/health
   ```
3. Revisa logs del indexer para errores
4. Verifica que el contrato tenga eventos:
   ```bash
   stellar contract events --id <CONTRACT_ID> --network testnet
   ```

### API Gateway no responde

1. Verifica que el puerto 4000 esté libre:
   ```bash
   lsof -i :4000
   ```
2. Verifica conexión a base de datos
3. Revisa logs para errores

### Base de datos vacía

1. Verifica que el indexer esté corriendo
2. Verifica que haya transacciones en el contrato
3. Espera al menos 30 segundos después de crear una transacción
4. Revisa logs del indexer para ver si procesó eventos

### Errores de Prisma

```bash
# Regenerar cliente
cd backend/shared
npx prisma generate

# Resetear base de datos (⚠️ borra todos los datos)
npx prisma db push --force-reset
```

## Verificación de Calidad

### Checklist de Funcionalidad

- [ ] Indexer conecta a Stellar RPC
- [ ] Indexer detecta eventos de contratos
- [ ] Eventos se guardan en base de datos
- [ ] API Gateway responde a queries GraphQL
- [ ] DataLoaders funcionan (no hay N+1 queries)
- [ ] Cache reduce latencia
- [ ] Métricas están disponibles
- [ ] Health checks funcionan
- [ ] Graceful shutdown funciona

### Checklist de Performance

- [ ] Queries GraphQL < 100ms
- [ ] Indexación de eventos < 5 segundos
- [ ] Cache hit rate > 70%
- [ ] Sin memory leaks (monitorear con `top`)
- [ ] CPU usage < 50% en idle

### Checklist de Seguridad

- [ ] Rate limiting funciona
- [ ] Query complexity limits funcionan
- [ ] No hay SQL injection (Prisma protege)
- [ ] Logs no muestran datos sensibles
- [ ] CORS configurado correctamente

## Recursos

- **Stellar Explorer**: https://stellar.expert/explorer/testnet
- **Stellar Laboratory**: https://laboratory.stellar.org
- **Prisma Studio**: http://localhost:5555 (cuando corre)
- **Indexer Metrics**: http://localhost:9090/metrics
- **API GraphQL**: http://localhost:4000/api/graphql
- **API Metrics**: http://localhost:4000/api/metrics

## Próximos Pasos

Después de validar que todo funciona:

1. **Optimizar**: Revisar queries lentas, ajustar índices
2. **Monitorear**: Configurar alertas para errores
3. **Documentar**: Actualizar README con hallazgos
4. **Deploy**: Preparar para producción (Vercel + Railway/Render)
