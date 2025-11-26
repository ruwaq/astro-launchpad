# Backend Real Testing Plan - Testnet

## Objetivo
Realizar pruebas end-to-end del backend en testnet de Stellar para validar:
- Contratos desplegados y funcionando
- Indexer capturando eventos
- API Gateway respondiendo correctamente
- Base de datos sincronizada
- Caché funcionando
- Métricas y monitoreo

## Pre-requisitos

### 1. Contratos Desplegados
- [ ] Token Factory desplegado en testnet
- [ ] AMM Factory desplegado en testnet (opcional)
- [ ] Contract IDs guardados en variables de entorno

### 2. Infraestructura
- [ ] PostgreSQL corriendo (local o remoto)
- [ ] Redis/Vercel KV configurado (opcional pero recomendado)
- [ ] Base de datos migrada con Prisma

### 3. Configuración
- [ ] Variables de entorno configuradas
- [ ] Network = testnet
- [ ] RPC URL = https://soroban-testnet.stellar.org:443

## Plan de Pruebas

### Fase 1: Verificación de Infraestructura
```bash
# 1. Verificar PostgreSQL
cd backend/shared
npx prisma db push

# 2. Verificar contratos desplegados
stellar contract info --id <CONTRACT_ID> --network testnet

# 3. Verificar conectividad RPC
curl https://soroban-testnet.stellar.org:443/health
```

### Fase 2: Pruebas del Indexer
```bash
# 1. Iniciar indexer
cd backend/indexer
npm run dev

# Verificar:
# - ✅ Conexión a base de datos
# - ✅ Conexión a Stellar RPC
# - ✅ Polling de eventos iniciado
# - ✅ Métricas disponibles en :9090/metrics
```

### Fase 3: Crear Transacciones de Prueba
```bash
# 1. Crear un token (desde frontend o CLI)
stellar contract invoke \
  --id <TOKEN_FACTORY_ID> \
  --network testnet \
  -- create_token \
  --name "Test Token" \
  --symbol "TEST" \
  --creator <YOUR_ADDRESS>

# 2. Comprar tokens
stellar contract invoke \
  --id <TOKEN_FACTORY_ID> \
  --network testnet \
  -- buy \
  --token <TOKEN_ADDRESS> \
  --amount 1000000

# 3. Vender tokens
stellar contract invoke \
  --id <TOKEN_FACTORY_ID> \
  --network testnet \
  -- sell \
  --token <TOKEN_ADDRESS> \
  --amount 500000
```

### Fase 4: Verificar Indexación
```bash
# 1. Verificar eventos en base de datos
psql $DATABASE_URL -c "SELECT * FROM \"Token\" ORDER BY \"createdAt\" DESC LIMIT 5;"
psql $DATABASE_URL -c "SELECT * FROM \"Transaction\" ORDER BY timestamp DESC LIMIT 10;"
psql $DATABASE_URL -c "SELECT * FROM \"FeeCollection\" ORDER BY timestamp DESC LIMIT 10;"

# 2. Verificar métricas del indexer
curl http://localhost:9090/metrics | grep indexer_events

# 3. Verificar health del indexer
curl http://localhost:9090/health
```

### Fase 5: Pruebas del API Gateway
```bash
# 1. Iniciar API Gateway
cd backend/api-gateway-v2
npm run dev

# 2. Verificar health
curl http://localhost:4000/api/health

# 3. Probar GraphQL queries
curl -X POST http://localhost:4000/api/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "{ health { status timestamp } }"
  }'

# 4. Obtener tokens
curl -X POST http://localhost:4000/api/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "{ tokens(limit: 5) { edges { node { address name symbol } } } }"
  }'

# 5. Obtener estadísticas de fees
curl -X POST http://localhost:4000/api/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "{ globalFeeStats { totalProtocolFees totalLpFees totalFees } }"
  }'
```

### Fase 6: Pruebas de Carga
```bash
# 1. Múltiples queries simultáneas
for i in {1..10}; do
  curl -X POST http://localhost:4000/api/graphql \
    -H "Content-Type: application/json" \
    -d '{"query": "{ tokens(limit: 10) { edges { node { address } } } }"}' &
done
wait

# 2. Verificar cache hits
curl http://localhost:4000/api/metrics | grep cache_hits

# 3. Verificar rate limiting
for i in {1..60}; do
  curl -X POST http://localhost:4000/api/graphql \
    -H "Content-Type: application/json" \
    -d '{"query": "{ health { status } }"}' \
    -w "%{http_code}\n" -o /dev/null -s
done
```

### Fase 7: Pruebas de Resiliencia
```bash
# 1. Simular desconexión de RPC
# - Detener indexer
# - Esperar 1 minuto
# - Reiniciar indexer
# - Verificar que retoma desde último ledger

# 2. Simular error de base de datos
# - Detener PostgreSQL
# - Verificar circuit breaker se activa
# - Reiniciar PostgreSQL
# - Verificar recuperación automática

# 3. Verificar graceful shutdown
# - Enviar SIGTERM al indexer
# - Verificar que procesa eventos pendientes
# - Verificar que cierra conexiones limpiamente
```

## Criterios de Éxito

### Indexer
- ✅ Conecta a Stellar RPC testnet
- ✅ Detecta eventos de contratos
- ✅ Guarda eventos en base de datos
- ✅ Actualiza métricas (volumen, holders, etc.)
- ✅ Calcula estadísticas de fees
- ✅ Maneja reconexiones automáticamente
- ✅ Circuit breaker funciona
- ✅ Graceful shutdown funciona

### API Gateway
- ✅ GraphQL endpoint responde
- ✅ Queries retornan datos correctos
- ✅ DataLoaders previenen N+1
- ✅ Cache reduce latencia
- ✅ Rate limiting funciona
- ✅ Security headers presentes
- ✅ Métricas Prometheus disponibles

### Base de Datos
- ✅ Schema correcto
- ✅ Índices optimizados
- ✅ Relaciones funcionan
- ✅ Queries rápidas (<100ms)

### Integración
- ✅ Evento en blockchain → Indexer → DB → API → Cliente
- ✅ Latencia total <5 segundos
- ✅ Sin pérdida de eventos
- ✅ Datos consistentes

## Próximos Pasos

1. **Desplegar contratos en testnet** (si no están desplegados)
2. **Configurar variables de entorno** con contract IDs
3. **Ejecutar migraciones de base de datos**
4. **Iniciar servicios** (indexer + API gateway)
5. **Ejecutar plan de pruebas** paso a paso
6. **Documentar resultados** y métricas
