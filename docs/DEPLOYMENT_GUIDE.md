# 🚀 AstroShibaPop Deployment Guide

Guía completa paso a paso para deployar AstroShibaPop en Stellar Testnet y ejecutar la plataforma localmente.

## 📋 Tabla de Contenidos

1. [Prerrequisitos](#prerrequisitos)
2. [Setup Inicial](#setup-inicial)
3. [Deploy de Smart Contracts](#deploy-de-smart-contracts)
4. [Setup de Backend](#setup-de-backend)
5. [Setup de Frontend](#setup-de-frontend)
6. [Testing](#testing)
7. [Troubleshooting](#troubleshooting)

---

## Prerrequisitos

### Software Requerido

```bash
# Node.js >= 20.0.0
node --version

# pnpm >= 8.0.0
pnpm --version

# Rust >= 1.75
rustc --version

# Soroban CLI >= 20.0.0
soroban --version

# Docker >= 24.x
docker --version

# PostgreSQL >= 15.x (via Docker)
```

### Instalación de Dependencias

#### 1. Instalar Node.js y pnpm

```bash
# Install Node.js 20 (usando nvm)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 20
nvm use 20

# Install pnpm
npm install -g pnpm
```

#### 2. Instalar Rust

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env
rustup target add wasm32-unknown-unknown
```

#### 3. Instalar Soroban CLI

```bash
cargo install --locked soroban-cli --features opt
```

#### 4. Instalar Docker

```bash
# MacOS
brew install docker

# Ubuntu/Debian
sudo apt-get update
sudo apt-get install docker.io docker-compose

# Verify
docker --version
docker-compose --version
```

---

## Setup Inicial

### 1. Clonar el Repositorio

```bash
git clone https://github.com/nunalabs/Astro-Shiba-Pop.git
cd Astro-Shiba-Pop
```

### 2. Instalar Dependencias del Proyecto

```bash
# Instalar todas las dependencias del monorepo
pnpm install
```

### 3. Configurar Variables de Entorno

```bash
# Copiar archivo de ejemplo
cp .env.example .env

# Editar con tus valores
nano .env
```

**Contenido de `.env`:**

```bash
# Stellar Network Configuration
STELLAR_NETWORK=testnet
STELLAR_RPC_URL=https://soroban-testnet.stellar.org
STELLAR_NETWORK_PASSPHRASE=Test SDF Network ; September 2015
STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org

# Contract Addresses (se llenarán después del deployment)
TOKEN_FACTORY_CONTRACT_ID=
AMM_FACTORY_CONTRACT_ID=

# Database
DATABASE_URL=postgresql://astro:shibapop_dev_password@localhost:5432/astroshibapop

# Redis
REDIS_URL=redis://localhost:6379

# API
API_PORT=4000
API_HOST=0.0.0.0

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:4000/graphql
NEXT_PUBLIC_NETWORK=testnet

# Security
JWT_SECRET=your-super-secret-jwt-key-change-in-production

# Deployer (generar con: soroban keys generate deployer)
DEPLOYER_SECRET_KEY=
```

### 4. Configurar Stellar CLI

```bash
# Agregar la red testnet
soroban network add testnet \
  --rpc-url https://soroban-testnet.stellar.org \
  --network-passphrase "Test SDF Network ; September 2015"

# Generar identidad para deployment
soroban keys generate deployer --network testnet

# Ver la dirección pública
soroban keys address deployer

# Fondear la cuenta con XLM testnet
curl "https://friendbot.stellar.org?addr=$(soroban keys address deployer)"
```

---

## Deploy de Smart Contracts

### 1. Build de Contratos

```bash
# Construir todos los contratos
./scripts/build-contracts.sh
```

**Esto compilará:**
- `token-factory` → `token_factory.optimized.wasm`
- `amm-pair` → `amm_pair.optimized.wasm`

### 2. Deploy a Testnet

```bash
# Deploy y inicializar contratos
./scripts/deploy-contracts.sh
```

**El script:**
1. Despliega Token Factory
2. Inicializa con admin y treasury
3. Despliega AMM Factory
4. Inicializa AMM
5. Guarda direcciones en `.env`

### 3. Verificar Deployment

```bash
# Ver contratos deployados
cat .env | grep CONTRACT_ID

# Ejemplo de output:
# TOKEN_FACTORY_CONTRACT_ID=CA...XYZ
# AMM_FACTORY_CONTRACT_ID=CB...ABC
```

### 4. Test de Contratos (Opcional)

```bash
# Ejecutar tests
./scripts/test-contracts.sh

# Esto ejecuta:
# - Unit tests de bonding curve
# - Tests de AMM math
# - Integration tests
```

---

## Setup de Backend

### 1. Iniciar Servicios Docker

```bash
# Iniciar PostgreSQL + Redis
docker-compose up -d

# Verificar que están corriendo
docker-compose ps

# Deberías ver:
# astroshibapop-postgres   Up
# astroshibapop-redis      Up
# astroshibapop-adminer    Up (opcional)
```

### 2. Setup de Database

```bash
# Entrar al directorio del indexer
cd backend/indexer

# Generar Prisma client
pnpm db:generate

# Ejecutar migraciones
pnpm db:migrate

# Verificar tablas (opcional)
pnpm db:studio
# Abre http://localhost:5555
```

### 3. Iniciar Indexer Service

```bash
# En backend/indexer
pnpm dev

# Output esperado:
# 🚀 Starting AstroShibaPop Indexer...
# ✓ Database connected
# ✓ Indexer running
# Indexing Token Factory from cursor: now
```

### 4. Iniciar API Gateway

```bash
# En nueva terminal
cd backend/api-gateway

# Iniciar servidor GraphQL
pnpm dev

# Output esperado:
# 🚀 GraphQL API running at http://localhost:4000/graphql
# 📊 Health check at http://localhost:4000/health
```

### 5. Verificar API

```bash
# Health check
curl http://localhost:4000/health

# Output: {"status":"ok","timestamp":"2025-01-15T..."}

# GraphQL Playground
# Abrir en browser: http://localhost:4000/graphql
```

**Query de prueba:**

```graphql
query {
  globalStats {
    totalTokens
    totalPools
    totalUsers
    totalVolume24h
    totalTVL
  }
}
```

---

## Setup de Frontend

### 1. Instalar Dependencias

```bash
cd frontend
pnpm install
```

### 2. Configurar Environment

Asegurarse que `.env` tenga:

```bash
NEXT_PUBLIC_API_URL=http://localhost:4000/graphql
NEXT_PUBLIC_NETWORK=testnet
```

### 3. Iniciar Frontend

```bash
pnpm dev

# Output:
# ▲ Next.js 14.1.0
# - Local:        http://localhost:3000
# - Ready in 2.3s
```

### 4. Instalar Freighter Wallet

**Browser Extension:**
- [Chrome/Brave](https://chrome.google.com/webstore/detail/freighter/bcacfldlkkdogcmkkibnjlakofdplcbk)
- [Firefox](https://addons.mozilla.org/en-US/firefox/addon/freighter/)

**Configurar Freighter:**
1. Instalar extensión
2. Crear nueva wallet o importar
3. Cambiar a "Testnet" en configuración
4. Fondear con: https://laboratory.stellar.org/#account-creator?network=test

### 5. Verificar Frontend

Abrir http://localhost:3000

Deberías ver:
- ✅ Landing page
- ✅ Botón "Connect Wallet"
- ✅ Stats globales
- ✅ Trending tokens (vacío inicialmente)

---

## Testing Completo

### 1. Test de Token Creation

```bash
# En frontend (http://localhost:3000/create)

1. Conectar wallet con Freighter
2. Llenar formulario:
   - Nombre: "My Test Meme"
   - Símbolo: "TEST"
   - Supply: 1000000
   - Imagen: (subir o URL)
3. Click "Create Token"
4. Aprobar transacción en Freighter
5. Esperar confirmación
```

**Verificar en Indexer:**

```bash
# Los logs del indexer deberían mostrar:
# Token created: My Test Meme (TEST) by G...
```

**Verificar en API:**

```graphql
query {
  tokens(limit: 10) {
    edges {
      name
      symbol
      creator
      createdAt
    }
  }
}
```

### 2. Test de Buy Tokens

```bash
# En frontend (http://localhost:3000/tokens/[address])

1. Ir a página del token creado
2. Ingresar cantidad de XLM a gastar
3. Ver cantidad de tokens a recibir
4. Click "Buy Tokens"
5. Aprobar transacción
6. Verificar balance
```

### 3. Test de Add Liquidity

```bash
# En frontend (http://localhost:3000/pools)

1. Seleccionar dos tokens
2. Ingresar amounts
3. Ver LP tokens a recibir
4. Click "Add Liquidity"
5. Aprobar transacción
```

### 4. Test de Swap

```bash
# En frontend (http://localhost:3000/swap)

1. Seleccionar token de input
2. Seleccionar token de output
3. Ingresar cantidad
4. Ver precio y slippage
5. Click "Swap"
6. Aprobar transacción
```

---

## Monitoring y Debugging

### Logs

```bash
# Indexer logs
cd backend/indexer
pnpm dev | pino-pretty

# API logs
cd backend/api-gateway
pnpm dev | pino-pretty

# Frontend logs
cd frontend
pnpm dev
# Logs en browser console
```

### Database Inspection

```bash
# Prisma Studio
cd backend/indexer
pnpm db:studio

# O usar Adminer
# http://localhost:8080
# Sistema: PostgreSQL
# Servidor: postgres
# Usuario: astro
# Password: shibapop_dev_password
# Base de datos: astroshibapop
```

### Stellar Explorer

**Verificar transacciones:**
- Testnet Explorer: https://stellar.expert/explorer/testnet

**Buscar por:**
- Contract ID
- Transaction hash
- Account address

---

## Troubleshooting

### Problema: "soroban: command not found"

```bash
# Solución: Agregar Cargo bin a PATH
echo 'export PATH="$HOME/.cargo/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

### Problema: "Database connection failed"

```bash
# Verificar que Docker está corriendo
docker-compose ps

# Si no está up:
docker-compose down
docker-compose up -d

# Verificar logs
docker-compose logs postgres
```

### Problema: "Freighter not detected"

```bash
# Soluciones:
1. Refrescar página
2. Verificar que extensión está instalada
3. Abrir popup de Freighter primero
4. Verificar que estás en Testnet
```

### Problema: "Insufficient XLM balance"

```bash
# Fondear cuenta con friendbot
curl "https://friendbot.stellar.org?addr=TU_DIRECCION_PUBLICA"

# O usar el laboratory
# https://laboratory.stellar.org/#account-creator?network=test
```

### Problema: "Contract not found"

```bash
# Verificar que contratos están deployados
cat .env | grep CONTRACT_ID

# Si están vacíos, re-deployar
./scripts/deploy-contracts.sh
```

### Problema: "GraphQL errors"

```bash
# Verificar que API está corriendo
curl http://localhost:4000/health

# Ver logs de API
cd backend/api-gateway
pnpm dev

# Verificar Prisma client
cd backend/indexer
pnpm db:generate
```

---

## Production Deployment

### Preparación

```bash
# 1. Cambiar a Mainnet en .env
STELLAR_NETWORK=mainnet
STELLAR_RPC_URL=https://soroban-mainnet.stellar.org
STELLAR_NETWORK_PASSPHRASE=Public Global Stellar Network ; September 2015

# 2. Generar nueva identidad para production
soroban keys generate mainnet-deployer

# 3. Fondear con XLM real

# 4. Deploy contratos
./scripts/deploy-contracts.sh
```

### Build de Production

```bash
# Backend
cd backend/api-gateway
pnpm build
pnpm start

# Frontend
cd frontend
pnpm build
pnpm start
```

### Hosting Recomendado

- **Frontend**: Vercel / Netlify
- **Backend**: Railway / Render / AWS
- **Database**: Supabase / Railway
- **Monitoring**: Datadog / Sentry

---

## 🎉 Success!

Si llegaste hasta aquí y todo funciona:

✅ Smart contracts deployados en Stellar Testnet
✅ Indexer escuchando eventos en tiempo real
✅ GraphQL API funcionando
✅ Frontend conectado y funcional
✅ Wallet integration working
✅ Puedes crear tokens, hacer swap, y proveer liquidez

**Next Steps:**

1. Crear tu primer meme token
2. Invitar amigos a testear
3. Iterar basado en feedback
4. Preparar para mainnet launch

**Support:**
- GitHub Issues: https://github.com/nunalabs/Astro-Shiba-Pop/issues
- Discord: [Coming soon]
- Telegram: [Coming soon]

---

**Built with ❤️ for the Stellar community**

*Let's make memes money again! 🚀🐕*
