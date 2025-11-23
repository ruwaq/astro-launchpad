# Plan de Implementación Técnica - AstroShibaPop

## 📁 Estructura del Proyecto

```
astroshibapop/
├── contracts/                    # Smart Contracts Soroban (Rust)
│   ├── token-factory/
│   │   ├── src/
│   │   │   ├── lib.rs           # Entry point del contrato
│   │   │   ├── token.rs         # Token creation logic
│   │   │   ├── bonding_curve.rs # Bonding curve calculations
│   │   │   ├── metadata.rs      # IPFS integration
│   │   │   └── test.rs          # Unit tests
│   │   ├── Cargo.toml
│   │   └── README.md
│   ├── amm/
│   │   ├── pair/                # Pool contract (x*y=k)
│   │   ├── router/              # Multi-hop routing
│   │   ├── factory/             # Pair deployment
│   │   └── shared/
│   ├── liquidity-mining/
│   │   ├── src/
│   │   │   ├── lib.rs
│   │   │   ├── farm.rs          # Staking logic
│   │   │   ├── rewards.rs       # Reward distribution
│   │   │   └── test.rs
│   │   └── Cargo.toml
│   ├── governance/
│   │   ├── src/
│   │   │   ├── lib.rs
│   │   │   ├── proposal.rs      # Proposal creation/voting
│   │   │   ├── timelock.rs      # Delayed execution
│   │   │   └── test.rs
│   │   └── Cargo.toml
│   ├── staking/
│   └── shared/
│       ├── math/                # Shared math libraries
│       ├── security/            # Reentrancy guards, access control
│       └── interfaces/          # Token standards, common interfaces
├── backend/                      # Backend Services (Node.js/Rust)
│   ├── services/
│   │   ├── indexer/             # Blockchain event listener
│   │   │   ├── src/
│   │   │   ├── Dockerfile
│   │   │   └── package.json
│   │   ├── api-gateway/         # GraphQL/REST API
│   │   ├── token-service/       # Token management
│   │   ├── amm-service/         # Price calculations
│   │   ├── user-service/        # User profiles, gamification
│   │   ├── notification/        # Alerts, emails
│   │   └── analytics/           # Metrics aggregation
│   ├── shared/
│   │   ├── database/            # DB schemas, migrations
│   │   ├── types/               # Shared TypeScript types
│   │   ├── utils/               # Helper functions
│   │   └── config/              # Environment configs
│   └── docker-compose.yml
├── frontend/                     # Web Application (Next.js)
│   ├── app/                     # Next.js 14 App Router
│   │   ├── (marketing)/
│   │   │   ├── page.tsx         # Landing page
│   │   │   └── about/
│   │   ├── (app)/
│   │   │   ├── swap/            # Swap interface
│   │   │   ├── create/          # Token creation
│   │   │   ├── pools/           # Liquidity pools
│   │   │   ├── stake/           # Staking
│   │   │   ├── governance/      # Proposals
│   │   │   └── leaderboard/     # Gamification
│   │   └── api/                 # API routes
│   ├── components/
│   │   ├── ui/                  # Base components (shadcn/ui)
│   │   ├── wallet/              # Wallet connection
│   │   ├── swap/                # Swap-specific
│   │   └── shared/              # Shared components
│   ├── hooks/                   # React hooks
│   ├── lib/
│   │   ├── stellar/             # Stellar SDK wrappers
│   │   ├── graphql/             # GraphQL client
│   │   └── utils/               # Utilities
│   ├── public/
│   ├── styles/
│   ├── package.json
│   └── next.config.js
├── mobile/                       # React Native (Fase 3)
│   ├── src/
│   ├── ios/
│   ├── android/
│   └── package.json
├── infrastructure/               # DevOps
│   ├── kubernetes/
│   │   ├── deployments/
│   │   ├── services/
│   │   └── ingress/
│   ├── terraform/               # Infrastructure as Code
│   ├── monitoring/
│   │   ├── prometheus/
│   │   └── grafana/
│   └── scripts/
├── docs/                         # Documentación
│   ├── architecture/
│   ├── api/
│   ├── smart-contracts/
│   └── user-guides/
├── tests/                        # Integration tests
│   ├── e2e/                     # End-to-end tests
│   └── load/                    # Load testing
├── .github/
│   ├── workflows/               # CI/CD pipelines
│   └── ISSUE_TEMPLATE/
├── package.json                  # Root package.json (workspaces)
├── turbo.json                   # Turborepo config
├── README.md
├── ARCHITECTURE.md
└── LICENSE
```

---

## 🔧 Configuración del Entorno de Desarrollo

### Prerrequisitos

```bash
# Versiones requeridas
- Node.js >= 20.x
- Rust >= 1.75
- Soroban CLI >= 20.0.0
- Docker >= 24.x
- PostgreSQL >= 15.x
- Redis >= 7.x
```

### Instalación Inicial

```bash
# 1. Instalar Soroban CLI
cargo install --locked soroban-cli

# 2. Configurar Stellar Testnet
soroban network add testnet \
  --rpc-url https://soroban-testnet.stellar.org \
  --network-passphrase "Test SDF Network ; September 2015"

# 3. Crear identidad de desarrollo
soroban keys generate dev --network testnet

# 4. Fondear cuenta (obtener XLM testnet)
curl "https://friendbot.stellar.org?addr=$(soroban keys address dev)"

# 5. Instalar dependencias del proyecto
npm install  # En root (instala todos los workspaces)

# 6. Setup local database
docker-compose up -d postgres redis

# 7. Ejecutar migraciones
cd backend/services/indexer
npm run migrate

# 8. Iniciar desarrollo local
npm run dev  # Inicia todos los servicios en modo watch
```

---

## 🏗️ Implementación de Smart Contracts

### Fase 1: Token Factory

#### Contrato Principal

```rust
// contracts/token-factory/src/lib.rs
#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, Address, Env, String, Vec,
    Symbol, token, BytesN
};

mod bonding_curve;
mod metadata;
mod test;

use bonding_curve::BondingCurve;

#[contracttype]
pub enum DataKey {
    TokenCount,
    TokensByCreator(Address),
    TokenInfo(Address),
    Admin,
}

#[contracttype]
#[derive(Clone)]
pub struct TokenInfo {
    pub creator: Address,
    pub token_address: Address,
    pub name: String,
    pub symbol: String,
    pub total_supply: i128,
    pub metadata_uri: String,
    pub created_at: u64,
    pub bonding_curve: BondingCurve,
}

#[contract]
pub struct TokenFactory;

#[contractimpl]
impl TokenFactory {

    /// Inicializa el contrato
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("Already initialized");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::TokenCount, &0u32);
    }

    /// Crea un nuevo meme token
    pub fn create_token(
        env: Env,
        creator: Address,
        name: String,
        symbol: String,
        initial_supply: i128,
        metadata_uri: String,
    ) -> Address {
        creator.require_auth();

        // 1. Validaciones
        Self::validate_token_params(&env, &name, &symbol, initial_supply);

        // 2. Cobrar fee de creación
        Self::charge_creation_fee(&env, &creator);

        // 3. Deploy del nuevo token usando Stellar Asset Contract
        let token_address = Self::deploy_token(
            &env,
            &name,
            &symbol,
            initial_supply,
        );

        // 4. Setup bonding curve inicial
        let bonding_curve = BondingCurve::new(
            initial_supply,
            1_000_000, // base_price: 0.001 XLM
            10_000,    // k constant
        );

        // 5. Guardar información del token
        let token_info = TokenInfo {
            creator: creator.clone(),
            token_address: token_address.clone(),
            name: name.clone(),
            symbol: symbol.clone(),
            total_supply: initial_supply,
            metadata_uri,
            created_at: env.ledger().timestamp(),
            bonding_curve,
        };

        env.storage().persistent().set(
            &DataKey::TokenInfo(token_address.clone()),
            &token_info
        );

        // 6. Actualizar índices
        Self::update_creator_index(&env, &creator, &token_address);
        Self::increment_token_count(&env);

        // 7. Emitir evento
        env.events().publish(
            (Symbol::new(&env, "token_created"),),
            (creator.clone(), token_address.clone())
        );

        token_address
    }

    /// Compra tokens usando bonding curve
    pub fn buy_tokens(
        env: Env,
        buyer: Address,
        token_address: Address,
        xlm_amount: i128,
        min_tokens_out: i128,
    ) -> i128 {
        buyer.require_auth();

        // Obtener info del token
        let mut token_info: TokenInfo = env.storage()
            .persistent()
            .get(&DataKey::TokenInfo(token_address.clone()))
            .unwrap();

        // Calcular tokens a recibir según bonding curve
        let tokens_out = token_info.bonding_curve.calculate_buy(xlm_amount);

        // Validar slippage
        if tokens_out < min_tokens_out {
            panic!("Slippage too high");
        }

        // Transferir XLM al contrato
        let xlm_token = token::Client::new(&env, &Self::get_xlm_address(&env));
        xlm_token.transfer(&buyer, &env.current_contract_address(), &xlm_amount);

        // Mint tokens al comprador
        let token = token::Client::new(&env, &token_address);
        token.mint(&buyer, &tokens_out);

        // Actualizar bonding curve
        token_info.bonding_curve.update_on_buy(tokens_out);
        env.storage().persistent().set(
            &DataKey::TokenInfo(token_address),
            &token_info
        );

        tokens_out
    }

    /// Vende tokens usando bonding curve
    pub fn sell_tokens(
        env: Env,
        seller: Address,
        token_address: Address,
        token_amount: i128,
        min_xlm_out: i128,
    ) -> i128 {
        seller.require_auth();

        let mut token_info: TokenInfo = env.storage()
            .persistent()
            .get(&DataKey::TokenInfo(token_address.clone()))
            .unwrap();

        // Calcular XLM a recibir
        let xlm_out = token_info.bonding_curve.calculate_sell(token_amount);

        if xlm_out < min_xlm_out {
            panic!("Slippage too high");
        }

        // Burn tokens del vendedor
        let token = token::Client::new(&env, &token_address);
        token.burn(&seller, &token_amount);

        // Transferir XLM al vendedor
        let xlm_token = token::Client::new(&env, &Self::get_xlm_address(&env));
        xlm_token.transfer(&env.current_contract_address(), &seller, &xlm_out);

        // Actualizar bonding curve
        token_info.bonding_curve.update_on_sell(token_amount);
        env.storage().persistent().set(
            &DataKey::TokenInfo(token_address),
            &token_info
        );

        xlm_out
    }

    // === Helper Functions ===

    fn validate_token_params(
        env: &Env,
        name: &String,
        symbol: &String,
        initial_supply: i128,
    ) {
        if name.len() < 3 || name.len() > 32 {
            panic!("Name must be 3-32 characters");
        }
        if symbol.len() < 2 || symbol.len() > 12 {
            panic!("Symbol must be 2-12 characters");
        }
        if initial_supply <= 0 || initial_supply > 1_000_000_000_000_000 {
            panic!("Invalid supply");
        }
    }

    fn charge_creation_fee(env: &Env, creator: &Address) {
        let fee: i128 = 100_000; // 0.01 XLM
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();

        let xlm_token = token::Client::new(env, &Self::get_xlm_address(env));
        xlm_token.transfer(creator, &admin, &fee);
    }

    fn deploy_token(
        env: &Env,
        name: &String,
        symbol: &String,
        initial_supply: i128,
    ) -> Address {
        // Usar Stellar Asset Contract (SAC) para deploy
        // Implementación simplificada - en producción usar SAC factory
        todo!("Deploy using SAC")
    }

    fn get_xlm_address(env: &Env) -> Address {
        // Obtener dirección de XLM nativo
        todo!("Get native XLM address")
    }

    fn update_creator_index(env: &Env, creator: &Address, token: &Address) {
        let mut tokens: Vec<Address> = env.storage()
            .persistent()
            .get(&DataKey::TokensByCreator(creator.clone()))
            .unwrap_or(Vec::new(env));

        tokens.push_back(token.clone());
        env.storage().persistent().set(
            &DataKey::TokensByCreator(creator.clone()),
            &tokens
        );
    }

    fn increment_token_count(env: &Env) {
        let mut count: u32 = env.storage().instance().get(&DataKey::TokenCount).unwrap();
        count += 1;
        env.storage().instance().set(&DataKey::TokenCount, &count);
    }
}
```

#### Bonding Curve Logic

```rust
// contracts/token-factory/src/bonding_curve.rs
use soroban_sdk::contracttype;

#[contracttype]
#[derive(Clone, Debug)]
pub struct BondingCurve {
    pub current_supply: i128,
    pub base_price: i128,      // Precio base en stroops (0.0000001 XLM)
    pub k: i128,               // Constante de curvatura
    pub reserve_xlm: i128,     // XLM acumulado en reserva
}

impl BondingCurve {
    pub fn new(initial_supply: i128, base_price: i128, k: i128) -> Self {
        Self {
            current_supply: initial_supply,
            base_price,
            k,
            reserve_xlm: 0,
        }
    }

    /// Calcula tokens a recibir por X XLM
    /// Formula: tokens = k * sqrt(xlm_amount / base_price)
    pub fn calculate_buy(&self, xlm_amount: i128) -> i128 {
        // Precio actual = base_price * (1 + supply/k)^2
        let current_price = self.get_current_price();

        // Aproximación: tokens ≈ xlm_amount / current_price
        // (En producción usar integral de la curva)
        xlm_amount / current_price
    }

    /// Calcula XLM a recibir por vender X tokens
    pub fn calculate_sell(&self, token_amount: i128) -> i128 {
        let current_price = self.get_current_price();

        // Aplicar un pequeño descuento (ej: 2%) para prevenir arb
        let sell_price = current_price * 98 / 100;

        token_amount * sell_price
    }

    /// Obtiene precio actual por token
    pub fn get_current_price(&self) -> i128 {
        self.base_price * (10_000 + self.current_supply / self.k).pow(2) / 10_000_000
    }

    /// Actualiza estado después de compra
    pub fn update_on_buy(&mut self, tokens_bought: i128) {
        self.current_supply += tokens_bought;
        self.reserve_xlm += tokens_bought * self.get_current_price();
    }

    /// Actualiza estado después de venta
    pub fn update_on_sell(&mut self, tokens_sold: i128) {
        self.current_supply -= tokens_sold;
        self.reserve_xlm -= tokens_sold * self.get_current_price();
    }
}
```

#### Tests

```rust
// contracts/token-factory/src/test.rs
#![cfg(test)]

use super::*;
use soroban_sdk::{testutils::Address as _, Env};

#[test]
fn test_create_token() {
    let env = Env::default();
    let contract_id = env.register_contract(None, TokenFactory);
    let client = TokenFactoryClient::new(&env, &contract_id);

    let admin = Address::random(&env);
    let creator = Address::random(&env);

    // Initialize
    client.initialize(&admin);

    // Create token
    let token_address = client.create_token(
        &creator,
        &String::from_str(&env, "TestMeme"),
        &String::from_str(&env, "MEME"),
        &1_000_000_000_000,
        &String::from_str(&env, "ipfs://Qm..."),
    );

    assert!(token_address != Address::random(&env));
}

#[test]
fn test_bonding_curve_buy() {
    let env = Env::default();
    // ... setup ...

    let xlm_amount = 1_000_000; // 0.1 XLM
    let tokens_received = client.buy_tokens(
        &buyer,
        &token_address,
        &xlm_amount,
        &0, // No slippage protection
    );

    assert!(tokens_received > 0);
}

#[test]
#[should_panic(expected = "Name must be 3-32 characters")]
fn test_invalid_name() {
    let env = Env::default();
    // ... setup ...

    client.create_token(
        &creator,
        &String::from_str(&env, "AB"), // Too short
        &String::from_str(&env, "MEME"),
        &1_000_000,
        &String::from_str(&env, "ipfs://"),
    );
}
```

### Deployment a Testnet

```bash
# Build del contrato
cd contracts/token-factory
soroban contract build

# Optimize WASM
soroban contract optimize --wasm target/wasm32-unknown-unknown/release/token_factory.wasm

# Deploy
TOKEN_FACTORY_ID=$(soroban contract deploy \
  --wasm target/wasm32-unknown-unknown/release/token_factory.optimized.wasm \
  --source dev \
  --network testnet)

echo "Token Factory deployed: $TOKEN_FACTORY_ID"

# Initialize
soroban contract invoke \
  --id $TOKEN_FACTORY_ID \
  --source dev \
  --network testnet \
  -- \
  initialize \
  --admin $(soroban keys address dev)
```

---

## 💾 Backend Services

### Indexer Service (Blockchain Event Listener)

```typescript
// backend/services/indexer/src/index.ts
import { Server, Horizon } from 'stellar-sdk';
import { PrismaClient } from '@prisma/client';

const server = new Server('https://horizon-testnet.stellar.org');
const prisma = new PrismaClient();

// Direcciones de contratos (de .env)
const TOKEN_FACTORY_ADDRESS = process.env.TOKEN_FACTORY_ADDRESS!;

async function indexEvents() {
  console.log('Starting indexer...');

  // Escuchar eventos del Token Factory
  const eventStream = server.events()
    .forContract(TOKEN_FACTORY_ADDRESS)
    .cursor('now')
    .stream({
      onmessage: async (event) => {
        try {
          await handleEvent(event);
        } catch (error) {
          console.error('Error handling event:', error);
        }
      },
      onerror: (error) => {
        console.error('Stream error:', error);
      },
    });
}

async function handleEvent(event: Horizon.ServerApi.EventRecord) {
  const { type, topic, value } = event;

  // Parse evento
  const eventType = topic[0]; // 'token_created', 'token_bought', etc.

  switch (eventType) {
    case 'token_created':
      await handleTokenCreated(event);
      break;
    case 'token_bought':
      await handleTokenBought(event);
      break;
    case 'token_sold':
      await handleTokenSold(event);
      break;
    default:
      console.log('Unknown event type:', eventType);
  }
}

async function handleTokenCreated(event: Horizon.ServerApi.EventRecord) {
  const { value } = event;

  // Parse datos del evento
  const creator = value[0]; // Address
  const tokenAddress = value[1]; // Address

  // Obtener metadata del contrato
  const tokenInfo = await fetchTokenInfo(tokenAddress);

  // Guardar en DB
  await prisma.token.create({
    data: {
      address: tokenAddress,
      creator: creator,
      name: tokenInfo.name,
      symbol: tokenInfo.symbol,
      totalSupply: tokenInfo.total_supply,
      metadataUri: tokenInfo.metadata_uri,
      createdAt: new Date(tokenInfo.created_at * 1000),
    },
  });

  // Fetch metadata de IPFS
  const metadata = await fetchFromIPFS(tokenInfo.metadata_uri);

  // Actualizar con imagen y descripción
  await prisma.token.update({
    where: { address: tokenAddress },
    data: {
      imageUrl: metadata.image,
      description: metadata.description,
    },
  });

  console.log(`Token created: ${tokenInfo.name} (${tokenInfo.symbol})`);
}

async function fetchTokenInfo(tokenAddress: string) {
  // Llamar al contrato para obtener TokenInfo
  // Implementación depende de soroban-client
  // ...
}

indexEvents().catch(console.error);
```

### GraphQL API

```typescript
// backend/services/api-gateway/src/schema.ts
import { gql } from 'apollo-server-express';

export const typeDefs = gql`
  type Token {
    address: String!
    creator: String!
    name: String!
    symbol: String!
    totalSupply: String!
    imageUrl: String
    description: String
    createdAt: DateTime!
    marketCap: String
    holders: Int!
    volume24h: String
    priceChange24h: Float
  }

  type Pool {
    address: String!
    tokenA: Token!
    tokenB: Token!
    reserveA: String!
    reserveB: String!
    totalSupply: String!
    volume24h: String!
    fee: Float!
  }

  type User {
    address: String!
    tokensCreated: [Token!]!
    points: Int!
    level: Int!
    achievements: [Achievement!]!
  }

  type Achievement {
    id: String!
    name: String!
    description: String!
    imageUrl: String!
    unlockedAt: DateTime
  }

  type Query {
    # Tokens
    token(address: String!): Token
    tokens(
      limit: Int = 20
      offset: Int = 0
      orderBy: TokenOrderBy = CREATED_AT_DESC
    ): [Token!]!
    trendingTokens(limit: Int = 10): [Token!]!

    # Pools
    pool(address: String!): Pool
    pools(limit: Int = 20): [Pool!]!

    # User
    user(address: String!): User
    leaderboard(type: LeaderboardType!, limit: Int = 100): [User!]!
  }

  enum TokenOrderBy {
    CREATED_AT_DESC
    MARKET_CAP_DESC
    VOLUME_DESC
    HOLDERS_DESC
  }

  enum LeaderboardType {
    CREATORS
    TRADERS
    LIQUIDITY_PROVIDERS
  }

  scalar DateTime
`;
```

```typescript
// backend/services/api-gateway/src/resolvers.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const resolvers = {
  Query: {
    token: async (_: any, { address }: { address: string }) => {
      return prisma.token.findUnique({
        where: { address },
      });
    },

    tokens: async (
      _: any,
      { limit, offset, orderBy }: any
    ) => {
      const orderByMap = {
        CREATED_AT_DESC: { createdAt: 'desc' },
        MARKET_CAP_DESC: { marketCap: 'desc' },
        VOLUME_DESC: { volume24h: 'desc' },
        HOLDERS_DESC: { holders: 'desc' },
      };

      return prisma.token.findMany({
        take: limit,
        skip: offset,
        orderBy: orderByMap[orderBy] || { createdAt: 'desc' },
      });
    },

    trendingTokens: async (_: any, { limit }: { limit: number }) => {
      // Trending = alto volumen 24h + crecimiento en holders
      return prisma.$queryRaw`
        SELECT *
        FROM tokens
        WHERE created_at > NOW() - INTERVAL '7 days'
        ORDER BY
          (volume_24h / NULLIF(volume_24h_prev, 0)) *
          (holders / NULLIF(holders_prev, 0))
        DESC
        LIMIT ${limit}
      `;
    },

    user: async (_: any, { address }: { address: string }) => {
      return prisma.user.findUnique({
        where: { address },
        include: {
          tokensCreated: true,
          achievements: true,
        },
      });
    },

    leaderboard: async (
      _: any,
      { type, limit }: { type: string; limit: number }
    ) => {
      const orderByMap = {
        CREATORS: { tokensCreatedCount: 'desc' },
        TRADERS: { volume30d: 'desc' },
        LIQUIDITY_PROVIDERS: { liquidityProvided: 'desc' },
      };

      return prisma.user.findMany({
        take: limit,
        orderBy: orderByMap[type],
      });
    },
  },

  Token: {
    marketCap: async (token: any) => {
      // Calcular market cap = price * total supply
      const price = await getCurrentPrice(token.address);
      return (BigInt(token.totalSupply) * BigInt(price)).toString();
    },

    holders: async (token: any) => {
      // Contar holders únicos
      const result = await prisma.$queryRaw`
        SELECT COUNT(DISTINCT holder)
        FROM token_balances
        WHERE token_address = ${token.address}
          AND balance > 0
      `;
      return result[0].count;
    },
  },
};

async function getCurrentPrice(tokenAddress: string): Promise<number> {
  // Obtener precio de pools o bonding curve
  // ...
  return 0;
}
```

---

## 🎨 Frontend Implementation

### Swap Interface

```typescript
// frontend/app/(app)/swap/page.tsx
'use client';

import { useState } from 'react';
import { useWallet } from '@/hooks/useWallet';
import { SwapCard } from '@/components/swap/SwapCard';
import { TokenSelector } from '@/components/swap/TokenSelector';
import { PriceChart } from '@/components/swap/PriceChart';

export default function SwapPage() {
  const { address, isConnected } = useWallet();
  const [tokenIn, setTokenIn] = useState(null);
  const [tokenOut, setTokenOut] = useState(null);
  const [amountIn, setAmountIn] = useState('');

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Swap Card */}
        <div className="lg:col-span-2">
          <SwapCard
            tokenIn={tokenIn}
            tokenOut={tokenOut}
            amountIn={amountIn}
            onTokenInChange={setTokenIn}
            onTokenOutChange={setTokenOut}
            onAmountInChange={setAmountIn}
          />
        </div>

        {/* Price Chart */}
        <div className="lg:col-span-1">
          <PriceChart
            tokenA={tokenIn}
            tokenB={tokenOut}
          />
        </div>
      </div>
    </div>
  );
}
```

```typescript
// frontend/components/swap/SwapCard.tsx
'use client';

import { useState } from 'react';
import { useSwap } from '@/hooks/useSwap';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';

export function SwapCard({
  tokenIn,
  tokenOut,
  amountIn,
  onAmountInChange,
}: any) {
  const { swap, isLoading, estimateOutput } = useSwap();
  const [amountOut, setAmountOut] = useState('0');

  const handleAmountChange = async (value: string) => {
    onAmountInChange(value);

    if (value && tokenIn && tokenOut) {
      const estimated = await estimateOutput(
        tokenIn.address,
        tokenOut.address,
        value
      );
      setAmountOut(estimated);
    }
  };

  const handleSwap = async () => {
    await swap({
      tokenIn: tokenIn.address,
      tokenOut: tokenOut.address,
      amountIn,
      minAmountOut: amountOut * 0.99, // 1% slippage tolerance
    });
  };

  return (
    <Card className="p-6">
      <div className="space-y-4">
        {/* Token In */}
        <div>
          <label className="text-sm text-gray-500">You pay</label>
          <div className="flex items-center gap-2 mt-2">
            <Input
              type="number"
              value={amountIn}
              onChange={(e) => handleAmountChange(e.target.value)}
              placeholder="0.0"
              className="text-2xl"
            />
            <TokenSelector
              selected={tokenIn}
              onChange={onTokenInChange}
            />
          </div>
        </div>

        {/* Swap Direction Arrow */}
        <div className="flex justify-center">
          <button className="p-2 rounded-full bg-gray-100">
            ↓
          </button>
        </div>

        {/* Token Out */}
        <div>
          <label className="text-sm text-gray-500">You receive</label>
          <div className="flex items-center gap-2 mt-2">
            <Input
              type="number"
              value={amountOut}
              readOnly
              placeholder="0.0"
              className="text-2xl"
            />
            <TokenSelector
              selected={tokenOut}
              onChange={onTokenOutChange}
            />
          </div>
        </div>

        {/* Swap Button */}
        <Button
          onClick={handleSwap}
          disabled={!tokenIn || !tokenOut || !amountIn || isLoading}
          className="w-full"
        >
          {isLoading ? 'Swapping...' : 'Swap'}
        </Button>

        {/* Details */}
        {amountOut !== '0' && (
          <div className="text-sm text-gray-500 space-y-1">
            <div className="flex justify-between">
              <span>Rate</span>
              <span>1 {tokenIn?.symbol} = {(amountOut / amountIn).toFixed(6)} {tokenOut?.symbol}</span>
            </div>
            <div className="flex justify-between">
              <span>Fee (0.3%)</span>
              <span>{(amountIn * 0.003).toFixed(4)} {tokenIn?.symbol}</span>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
```

### Custom Hooks

```typescript
// frontend/hooks/useSwap.ts
import { useState } from 'react';
import { useStellarWallet } from '@/hooks/useStellarWallet';
import { Contract, SorobanRpc } from 'soroban-client';

const AMM_ROUTER_ADDRESS = process.env.NEXT_PUBLIC_AMM_ROUTER_ADDRESS!;

export function useSwap() {
  const { wallet, signTransaction } = useStellarWallet();
  const [isLoading, setIsLoading] = useState(false);

  const estimateOutput = async (
    tokenIn: string,
    tokenOut: string,
    amountIn: string
  ): Promise<string> => {
    // Llamar a get_amounts_out del router
    const contract = new Contract(AMM_ROUTER_ADDRESS);

    const server = new SorobanRpc.Server(
      'https://soroban-testnet.stellar.org'
    );

    const result = await server.simulateTransaction(
      contract.call(
        'get_amounts_out',
        amountIn,
        [tokenIn, tokenOut]
      )
    );

    return result.result.retval; // Amount out
  };

  const swap = async ({
    tokenIn,
    tokenOut,
    amountIn,
    minAmountOut,
  }: any) => {
    setIsLoading(true);

    try {
      const contract = new Contract(AMM_ROUTER_ADDRESS);

      // Build transaction
      const tx = contract.call(
        'swap_exact_tokens_for_tokens',
        amountIn,
        minAmountOut,
        [tokenIn, tokenOut],
        wallet.address,
        Math.floor(Date.now() / 1000) + 600 // 10 min deadline
      );

      // Sign & submit
      const signedTx = await signTransaction(tx);
      const result = await submitTransaction(signedTx);

      console.log('Swap successful:', result);
      return result;
    } catch (error) {
      console.error('Swap failed:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    swap,
    estimateOutput,
    isLoading,
  };
}
```

---

## 🔐 Security Checklist

### Pre-Deployment

- [ ] Múltiples auditorías de seguridad completadas
- [ ] Bug bounty program configurado
- [ ] Fuzz testing con 1M+ inputs ejecutado
- [ ] Formal verification de invariantes críticos
- [ ] Reentrancy guards en todos los contratos
- [ ] Access control correctamente implementado
- [ ] Time-locks para funciones admin
- [ ] Emergency pause mechanism testeado
- [ ] Max transaction limits configurados
- [ ] Rate limiting en API
- [ ] Input validation exhaustiva
- [ ] CORS y CSP headers configurados
- [ ] SSL/TLS certificates válidos
- [ ] Environment secrets en vault (no en .env)
- [ ] Monitoring y alerting activo
- [ ] Incident response plan documentado

### Post-Deployment

- [ ] Monitoreo 24/7 de métricas
- [ ] Alertas configuradas para anomalías
- [ ] Multisig wallet para admin functions
- [ ] Backup de contratos y datos
- [ ] Disaster recovery plan testeado
- [ ] Security team on-call
- [ ] Regular security reviews
- [ ] Community bug reports monitoreados

---

## 📊 Monitoreo y Observabilidad

### Métricas Clave

```yaml
# Prometheus metrics
- contract_calls_total{contract, function}
- transaction_success_rate
- token_creations_total
- swap_volume_usd
- tvl_total
- active_users_24h
- api_request_duration_seconds
- database_query_duration_seconds
- error_rate
```

### Dashboards (Grafana)

1. **Platform Overview**:
   - TVL trend
   - Daily active users
   - Transaction volume
   - Revenue

2. **Smart Contracts**:
   - Calls per contract
   - Gas usage
   - Error rates
   - Upgrade history

3. **API Performance**:
   - Request rate
   - Latency (P50, P95, P99)
   - Error rate by endpoint
   - Database connection pool

4. **Security**:
   - Failed transactions
   - Large transactions (>$100k)
   - Unusual patterns
   - Admin actions log

---

## 🚀 Próximos Pasos

### Esta Semana (Setup Inicial)

1. **Día 1-2: Repositorio y Estructura**
   ```bash
   # Crear estructura de directorios
   mkdir -p contracts/{token-factory,amm,shared}
   mkdir -p backend/services/{indexer,api-gateway}
   mkdir -p frontend/{app,components,hooks}

   # Inicializar workspaces
   npm init -w contracts -w backend -w frontend

   # Setup CI/CD
   # Crear .github/workflows/ci.yml
   ```

2. **Día 3-4: Token Factory MVP**
   - Implementar contrato base
   - Tests unitarios
   - Deploy a testnet local

3. **Día 5-7: Testing & Iteración**
   - Testing manual
   - Refinamiento basado en feedback
   - Documentación

### Próxima Semana

- Frontend básico (token creation wizard)
- Indexer para eventos
- Primera demo funcional end-to-end

---

*Este es un documento vivo que se actualizará conforme avance el desarrollo.*
