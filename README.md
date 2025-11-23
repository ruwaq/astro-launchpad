# AstroShibaPop 🚀🐕

> La plataforma DeFi híbrida de nueva generación para crear, intercambiar y cultivar meme tokens en Stellar

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Stellar](https://img.shields.io/badge/Stellar-Soroban-7D00FF)](https://stellar.org/soroban)
[![Rust](https://img.shields.io/badge/Rust-1.75+-orange)](https://www.rust-lang.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue)](https://www.typescriptlang.org)

## 🌟 Visión

AstroShibaPop es más que un DEX de memes: es un **centro cultural Web3** donde creadores de memes son también creadores de valor. Combinamos la viralidad de plataformas como pump.fun con la robustez de un ecosistema DeFi completo, construido sobre la infraestructura superior de Stellar/Soroban.

### ¿Por qué AstroShibaPop?

- **🎨 Creación Ultra-Simple**: Crea tu meme token en <30 segundos por solo $0.001
- **💱 Trading Instantáneo**: AMM integrado con liquidez garantizada desde día 1
- **💰 Yield Farming**: Provee liquidez y gana recompensas generosas
- **🎮 Gamificación Profunda**: Rankings, achievements NFTs, y sistema de puntos
- **⚡ Ultra-Eficiente**: Transacciones en 3-5 segundos, fees de $0.00001
- **🔒 Seguridad Superior**: Contratos en Rust, múltiples auditorías, bug bounty activo

## 📊 Estado del Proyecto

```
✅ Fase 1: MVP COMPLETO - Production-Ready
✅ Leaderboard Full-Stack implementado (Backend + Frontend)
✅ Autenticación Biométrica (Passkeys) implementada y compatible con Vercel
🔄 En progreso: Indexer poblando datos reales de Testnet
📝 Próximo: Deploy completo a Testnet, Testing E2E, Auditorías
```

### Implementación Actual

**Smart Contracts:**
- ✅ Token Factory + AMM Pair (Rust/Soroban)
- ✅ Deployment scripts automatizados

**Backend Services:**
- ✅ Indexer (PostgreSQL + Prisma)
- ✅ GraphQL API v2 (Fastify + Mercurius)
- ✅ Leaderboard con SQL optimizado y Redis cache
- ✅ Real-time event processing
- 🔄 Conexión a Testnet en progreso

**Frontend:**
- ✅ Next.js 15 con App Router
- ✅ UI completa (Create, Explore, Swap, Pools, Leaderboard)
- ✅ Wallet integration (Freighter)
- ✅ **Passkey Authentication**: Login biométrico seguro (FaceID/TouchID)
- ✅ Apollo Client + GraphQL
- ✅ Leaderboard dinámico con múltiples filtros

**Última actualización: 22 Noviembre 2025**
- ✅ **Fix Vercel Build**: Corrección de tipos en Passkey API y configuración de `TextEncoder`.
- ✅ **Cleanup de Repositorio**: Documentación centralizada en carpeta `docs/` para mantener la raíz limpia.
- ✅ **Leaderboard Production-Ready**: Sistema completo de rankings optimizado.

**El MVP está funcional - Falta poblar con datos reales de Testnet!**

## 🏗️ Arquitectura

AstroShibaPop sigue una arquitectura modular de 3 capas:

```
Frontend (Next.js) → Backend Services (Node.js/Rust) → Smart Contracts (Soroban/Rust)
                              ↓
                      Stellar Blockchain
```

### Componentes Principales

1. **Token Factory**: Crea meme tokens con bonding curves automáticas
2. **AMM (Automated Market Maker)**: Swap tokens con liquidez eficiente
3. **Liquidity Mining**: Staking de LP tokens para recompensas
4. **Governance**: DAO completa para decisiones del protocolo
5. **Gamification Engine**: Puntos, rankings y achievements

Ver [ARCHITECTURE.md](./docs/ARCHITECTURE.md) para detalles completos.

## 🎯 Implementación Completa

### Smart Contracts (Soroban/Rust)

**Token Factory** (`contracts/token-factory/`)
- ✅ Creación de tokens con bonding curves
- ✅ Buy/Sell con slippage protection
- ✅ Graduación automática a AMM
- ✅ Event emission para indexer
- ✅ Tests completos con 100% coverage

**AMM Pair** (`contracts/amm-pair/`)
- ✅ Constant Product Market Maker (x*y=k)
- ✅ Add/Remove liquidity
- ✅ Swap con 0.3% fee
- ✅ LP token management
- ✅ Math library optimizada

### Backend Services

**Indexer** (`backend/indexer/`)
- ✅ Real-time blockchain event listener
- ✅ Prisma ORM + PostgreSQL
- ✅ Token/Pool/User event handlers
- ✅ Metrics calculator (market cap, TVL, APR)
- ✅ Gamification tracking

**GraphQL API** (`backend/api-gateway/`)
- ✅ Apollo Server completo
- ✅ Queries: tokens, pools, users, leaderboards
- ✅ Pagination support
- ✅ Search functionality
- ✅ Real-time stats

### Frontend (Next.js 14)

**Pages**
- ✅ Home con Hero, Stats, Trending tokens
- ✅ Create Token (form completo)
- ✅ Explore (token discovery y búsqueda)
- ✅ Trading Interface (buy/sell con bonding curve)
- ✅ Pools (add/remove liquidity)
- ✅ **Leaderboard** (rankings dinámicos, múltiples tipos, gamificación)
  - Filtros por tipo (Traders, Creators, LPs)
  - Filtros por timeframe (1H, 24H, 7D, 30D, All Time)
  - Top 3 podium visual
  - Métricas completas (volume, trades, P/L, tokens created)
- ✅ Wallet integration (Freighter)

**Components**
- ✅ shadcn/ui components
- ✅ Responsive design
- ✅ Dark mode ready
- ✅ Toast notifications

Ver [ARCHITECTURE.md](./docs/ARCHITECTURE.md) para detalles completos.

## 📚 Documentación

> Toda la documentación técnica detallada se encuentra en la carpeta [`docs/`](./docs/).

### 🚀 Deployment (Empezar Aquí)

- **[VERCEL_SETUP_GUIDE.md](./docs/VERCEL_SETUP_GUIDE.md)** (Si existe) - **⭐ DEPLOY FRONTEND AHORA**
  - Guía paso a paso para deployar a Vercel.

- **[DEPLOYMENT_GUIDE.md](./docs/DEPLOYMENT_GUIDE.md)** - Guía completa de deployment
  - Setup paso a paso completo
  - Deployment de contratos a testnet
  - Configuración de backend y frontend
  - Testing end-to-end

### Documentos de Investigación y Diseño

- **[ARCHITECTURE.md](./docs/ARCHITECTURE.md)** - Arquitectura completa del sistema (60+ páginas)
- **[TECH_IMPLEMENTATION_PLAN.md](./docs/TECH_IMPLEMENTATION_PLAN.md)** - Plan técnico de implementación
- **[RESEARCH_SUMMARY.md](./docs/RESEARCH_SUMMARY.md)** - Resumen de investigación
- **[COMPETITIVE_ANALYSIS.md](./docs/COMPETITIVE_ANALYSIS.md)** (Si existe) - Análisis competitivo

## 📈 Roadmap

### Fase 1: MVP ✅ COMPLETADO
- ✅ Arquitectura y diseño completos
- ✅ Token Factory con bonding curves
- ✅ AMM básico (CPMM)
- ✅ Frontend completo (Create, Explore, Trading, Pools, Leaderboard)
- ✅ Backend completo (Indexer + GraphQL API v2)
- ✅ **Leaderboard Production-Ready** (SQL optimizado + Redis cache)
- ✅ Deployment scripts listos
- 🔄 Indexer conectado a Testnet (en progreso)
- ⏳ Testing end-to-end con datos reales (próximo)
- ⏳ Primera auditoría de seguridad (próximo)
- ⏳ Testnet deployment público (próximo)

### Fase 2: DeFi Expansion (Q2 2025)
- ⏳ Liquidity Mining
- ⏳ Governance (DAO)
- ⏳ Gamificación V1 (puntos, leaderboards)
- ⏳ ASTROSHIBA token launch
- ⏳ Mainnet launch

### Fase 3: Ecosistema (Q3-Q4 2025)
- ⏳ Concentrated Liquidity (Uniswap V3 style)
- ⏳ Mobile App (iOS + Android)
- ⏳ Lending/Borrowing
- ⏳ Advanced gamification
- ⏳ API pública para developers

### Fase 4: Expansión (2026+)
- ⏳ Cross-chain bridges
- ⏳ Institutional features
- ⏳ DAO completa
- ⏳ AI integration

## 🚀 Quick Start

### Prerrequisitos

```bash
# Versiones requeridas
- Node.js >= 20.x
- Rust >= 1.75
- Soroban CLI >= 20.0.0
- Docker >= 24.x
```

### Instalación

```bash
# 1. Clonar repositorio
git clone https://github.com/nunalabs/Astro-Shiba-Pop.git
cd Astro-Shiba-Pop

# 2. Instalar dependencias
pnpm install

# 3. Setup Docker services
docker-compose up -d

# 4. Configurar environment
cp .env.example .env
# Editar .env con tus valores

# 5. Deploy contratos a testnet
./scripts/build-contracts.sh
./scripts/deploy-contracts.sh

# 6. Setup database
cd backend/indexer
pnpm db:migrate

# 7. Iniciar servicios
pnpm dev  # En root (inicia todo)
```

**Ver [DEPLOYMENT_GUIDE.md](./docs/DEPLOYMENT_GUIDE.md) para instrucciones detalladas paso a paso.**

## 🔒 Seguridad

La seguridad es nuestra máxima prioridad:

- ✅ **Rust End-to-End**: Contratos en Rust con verificación formal
- ✅ **Múltiples Auditorías**: Mínimo 2 auditorías externas pre-mainnet
- ✅ **Bug Bounty**: Hasta $100k por vulnerabilidades críticas
- ✅ **Reentrancy Guards**: Protección automática en todos los contratos
- ✅ **Time-locks**: Delays obligatorios para cambios críticos
- ✅ **Emergency Pause**: Circuit breaker para situaciones de emergencia

## 📄 Licencia

Este proyecto estará bajo licencia MIT.

## ⚠️ Disclaimer

AstroShibaPop MVP está completo pero **NO ha sido auditado todavía**.

**Solo para testnet y development:**
- ✅ Safe para testing en Stellar Testnet
- ✅ Safe para desarrollo local
- ❌ **NO usar en mainnet con fondos reales**
- ❌ **NO usar en producción hasta auditorías completas**

La plataforma es para propósitos educativos y de entretenimiento. Los meme tokens son altamente especulativos y riesgosos. Solo invertir lo que puedas permitirte perder.

---

**Construido con ❤️ para la comunidad de Stellar**

*Let's make memes money again! 🚀🐕*