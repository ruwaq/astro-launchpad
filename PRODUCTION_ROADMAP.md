# 🚀 ASTRO SHIBA - PRODUCTION ROADMAP

**Fecha de inicio:** 21 Noviembre 2025
**Objetivo:** Implementar TODO el plan con máxima calidad, modularidad, robustez y escalabilidad
**Metodología:** Revisión continua de documentación oficial, testing exhaustivo, sin atajos

---

## 📋 TABLA DE CONTENIDOS

1. [Sprint 1: Fixes Críticos (Semana 1)](#sprint-1-fixes-críticos)
2. [Sprint 2: Seguridad & Testing (Semana 2)](#sprint-2-seguridad--testing)
3. [Sprint 3: Features Core (Semana 3-4)](#sprint-3-features-core)
4. [Sprint 4: Advanced Features (Semana 5-6)](#sprint-4-advanced-features)
5. [Sprint 5: Production Ready (Semana 7)](#sprint-5-production-ready)
6. [Checklist de Verificación](#checklist-de-verificación)

---

## 🔴 SPRINT 1: FIXES CRÍTICOS (Semana 1)

### DÍA 1: Transferencias Reales en Buy/Sell

**Objetivo:** Implementar transferencias reales de XLM y tokens en buy() y sell()

#### Tareas:

**1.1 Actualizar buy() en sac-factory/src/lib.rs**
- [ ] Agregar parámetro `deadline: u64` para MEV protection
- [ ] Implementar transferencia de XLM del buyer al contrato
- [ ] Implementar transferencia de tokens del contrato al buyer
- [ ] Verificar deadline antes de ejecutar
- [ ] Actualizar tests unitarios
- [ ] Verificar con `cargo test`

**Código a implementar:**
```rust
pub fn buy(
    env: Env,
    buyer: Address,
    token: Address,
    xlm_amount: i128,
    min_tokens: i128,
    deadline: u64,
) -> Result<i128, Error> {
    buyer.require_auth();

    // 1. Verificar deadline (MEV protection)
    if env.ledger().timestamp() > deadline {
        return Err(Error::TransactionExpired);
    }

    let mut token_info = storage::get_token_info(&env, &token)
        .ok_or(Error::TokenNotFound)?;

    // 2. Transferir XLM del buyer al contrato
    let xlm_token = token::Client::new(&env, &get_xlm_token_address(&env));
    xlm_token.transfer(&buyer, &env.current_contract_address(), &xlm_amount);

    // 3. Calcular tokens a recibir
    let tokens_gross = token_info.bonding_curve.calculate_buy(xlm_amount)?;
    let (tokens_net, fee_amount) = fee_management::apply_trading_fee(&env, tokens_gross)?;

    // 4. Verificar slippage
    if tokens_net < min_tokens {
        return Err(Error::SlippageExceeded);
    }

    // 5. Transferir tokens del contrato al buyer
    let token_client = token::Client::new(&env, &token);
    token_client.transfer(&env.current_contract_address(), &buyer, &tokens_net);

    // 6. Actualizar estado
    token_info.bonding_curve.execute_buy(xlm_amount, tokens_gross)?;
    token_info.xlm_raised = math::safe_add(token_info.xlm_raised, xlm_amount)?;
    storage::set_token_info(&env, &token, &token_info);

    // 7. Verificar si está listo para graduación
    if token_info.xlm_raised >= GRADUATION_THRESHOLD {
        // Marcar como pendiente de graduación
        token_info.status = TokenStatus::PendingGraduation;
        storage::set_token_info(&env, &token, &token_info);
        events::graduation_pending(&env, &token, token_info.xlm_raised);
    }

    // 8. Emitir evento
    events::token_bought(&env, &buyer, &token, xlm_amount, tokens_net, fee_amount);

    Ok(tokens_net)
}
```

**1.2 Actualizar sell() en sac-factory/src/lib.rs**
- [ ] Agregar parámetro `deadline: u64`
- [ ] Implementar transferencia de tokens del seller al contrato
- [ ] Implementar transferencia de XLM del contrato al seller
- [ ] Verificar deadline
- [ ] Actualizar tests
- [ ] Verificar con `cargo test`

**1.3 Agregar función helper get_xlm_token_address()**
- [ ] Crear función en utils o config
- [ ] Retornar address correcto para XLM en testnet/mainnet

**1.4 Testing Completo**
- [ ] Test: buy() transfiere XLM correctamente
- [ ] Test: buy() transfiere tokens correctamente
- [ ] Test: sell() transfiere tokens correctamente
- [ ] Test: sell() transfiere XLM correctamente
- [ ] Test: deadline expira correctamente
- [ ] Test: slippage protection funciona
- [ ] Ejecutar todos los tests: `cargo test --all`

**Verificación:**
```bash
cd /Users/munay/dev/Astro-Shiba/contracts/sac-factory
cargo test test_buy_transfers_xlm
cargo test test_buy_transfers_tokens
cargo test test_sell_transfers_tokens
cargo test test_sell_transfers_xlm
cargo test test_deadline_protection
cargo test --all
```

**Documentación a revisar:**
- https://developers.stellar.org/docs/tokens/stellar-asset-contract
- https://developers.stellar.org/docs/build/smart-contracts/example-contracts/atomic-swap

---

### DÍA 2: Unificar Versiones SDK & Eliminar Código Muerto

**2.1 Actualizar Soroban SDK**
- [ ] Actualizar `contracts/amm-pair/Cargo.toml` a SDK 23.2.1
- [ ] Actualizar `contracts/sac-factory/Cargo.toml` a SDK 23.2.1
- [ ] Verificar compatibilidad: `cargo check --all`
- [ ] Rebuild: `cargo build --release --all`
- [ ] Re-run tests: `cargo test --all`

**Cargo.toml actualizado:**
```toml
[dependencies]
soroban-sdk = "23.2.1"

[dev-dependencies]
soroban-sdk = { version = "23.2.1", features = ["testutils"] }
```

**2.2 Eliminar Archivos Obsoletos**
- [ ] Eliminar `contracts/sac-factory/src/token_deployment_new.rs`
- [ ] Consolidar código de `token_deployment.rs` en `sac_deployment.rs`
- [ ] Eliminar código comentado en `token_deployment.rs`
- [ ] Eliminar código comentado en `fee_management.rs`
- [ ] Actualizar imports en `lib.rs`

**Comandos:**
```bash
cd /Users/munay/dev/Astro-Shiba/contracts/sac-factory/src
rm token_deployment_new.rs
# Revisar token_deployment.rs y migrar código útil a sac_deployment.rs
# Luego eliminar token_deployment.rs
```

**2.3 Limpiar Frontend**
- [ ] Eliminar todos los `console.log()` en producción
- [ ] Implementar logger apropiado
- [ ] Crear `apps/web/src/lib/logger.ts`

**Logger implementation:**
```typescript
// apps/web/src/lib/logger.ts
const isDev = process.env.NODE_ENV === 'development';

export const logger = {
  debug: (...args: any[]) => {
    if (isDev) console.log('[DEBUG]', ...args);
  },
  info: (...args: any[]) => {
    if (isDev) console.info('[INFO]', ...args);
  },
  warn: (...args: any[]) => {
    console.warn('[WARN]', ...args);
  },
  error: (...args: any[]) => {
    console.error('[ERROR]', ...args);
    // TODO: Enviar a Sentry en producción
  },
};
```

- [ ] Reemplazar todos los `console.log` con `logger.debug`
- [ ] Reemplazar todos los `console.error` con `logger.error`

**Verificación:**
```bash
cd apps/web
grep -r "console\\.log" src/ | wc -l  # Debe ser 0
grep -r "console\\.error" src/ | wc -l  # Debe ser 0
```

---

### DÍA 3: Validación de Addresses & Inputs

**3.1 Implementar validate_address()**
- [ ] Actualizar `sac-factory/src/lib.rs:439`
- [ ] Validar que no sea zero address
- [ ] Validar que no sea test address conocida
- [ ] Agregar tests

**Código:**
```rust
fn validate_address(addr: &Address) -> Result<(), Error> {
    // Convertir a string para validación
    let addr_str = format!("{:?}", addr);

    // Rechazar addresses de test conocidas
    if addr_str.starts_with("GAAAA") ||
       addr_str.starts_with("CAAAA") ||
       addr_str.contains("test") {
        return Err(Error::InvalidAddress);
    }

    // Verificar longitud correcta (56 chars para G addresses, 56 para C)
    if addr_str.len() < 56 {
        return Err(Error::InvalidAddress);
    }

    Ok(())
}
```

**3.2 Validación de Inputs en Frontend**
- [ ] Validar amounts > 0
- [ ] Validar token addresses son válidos
- [ ] Validar deadline futuro
- [ ] Mostrar errores claros al usuario

**Ejemplo en apps/web/src/app/swap/page.tsx:**
```typescript
const validateInputs = () => {
  if (!selectedToken) {
    toast.error('Please select a token');
    return false;
  }

  if (!inputAmount || parseFloat(inputAmount) <= 0) {
    toast.error('Amount must be greater than 0');
    return false;
  }

  if (!Address.isValidAddress(selectedToken)) {
    toast.error('Invalid token address');
    return false;
  }

  return true;
};
```

**3.3 Tests de Validación**
- [ ] Test: rechaza zero address
- [ ] Test: rechaza test addresses
- [ ] Test: rechaza addresses inválidas
- [ ] Test: acepta addresses válidas

---

### DÍA 4: Reentrancy Protection en AMM

**4.1 Implementar Reentrancy Lock**
- [ ] Crear `contracts/amm-pair/src/security.rs`
- [ ] Implementar lock/unlock mechanism
- [ ] Integrar en swap(), add_liquidity(), remove_liquidity()

**Código security.rs:**
```rust
use soroban_sdk::{Env, Symbol};
use crate::errors::Error;

const REENTRANCY_LOCK: Symbol = symbol_short!("RELOCK");

pub fn acquire_lock(env: &Env) -> Result<(), Error> {
    if env.storage().temporary().has(&REENTRANCY_LOCK) {
        return Err(Error::Reentrancy);
    }
    env.storage().temporary().set(&REENTRANCY_LOCK, &true);
    Ok(())
}

pub fn release_lock(env: &Env) {
    env.storage().temporary().remove(&REENTRANCY_LOCK);
}

// Macro helper
#[macro_export]
macro_rules! with_lock {
    ($env:expr, $body:block) => {{
        crate::security::acquire_lock($env)?;
        let result = (|| $body)();
        crate::security::release_lock($env);
        result
    }};
}
```

**4.2 Aplicar Lock en Funciones Críticas**
```rust
// En amm-pair/src/lib.rs
pub fn swap(
    env: Env,
    sender: Address,
    amount_in: i128,
    token_in: Address,
    min_out: i128,
    deadline: u64,
) -> Result<i128, Error> {
    with_lock!(&env, {
        sender.require_auth();

        // Check deadline
        if env.ledger().timestamp() > deadline {
            return Err(Error::TransactionExpired);
        }

        // ... resto de la lógica ...

        Ok(amount_out)
    })
}
```

**4.3 Tests de Reentrancy**
- [ ] Test: swap no permite reentrada
- [ ] Test: add_liquidity no permite reentrada
- [ ] Test: lock se libera después de error

---

### DÍA 5: Optimización & Build

**5.1 Optimizar Contratos**
- [ ] Ejecutar `stellar contract optimize` en ambos contratos
- [ ] Verificar tamaño < 256KB
- [ ] Medir gas con `stellar contract invoke --simulate`

**Comandos:**
```bash
cd /Users/munay/dev/Astro-Shiba/contracts/sac-factory

# Build release
cargo build --target wasm32-unknown-unknown --release

# Optimize
stellar contract optimize \
  --wasm target/wasm32-unknown-unknown/release/sac_factory.wasm

# Inspect
stellar contract inspect \
  --wasm target/wasm32-unknown-unknown/release/sac_factory.optimized.wasm

# Verificar tamaño
ls -lh target/wasm32-unknown-unknown/release/*.wasm
```

**5.2 Deploy a Testnet**
- [ ] Deploy SAC Factory actualizado
- [ ] Deploy AMM Pair actualizado
- [ ] Verificar que todo funcione
- [ ] Actualizar CONTRACT_ID en frontend

**Deploy commands:**
```bash
# Deploy SAC Factory
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/sac_factory.optimized.wasm \
  --source ADMIN_IDENTITY \
  --network testnet

# Actualizar .env.local con nuevo CONTRACT_ID
```

**5.3 Testing End-to-End**
- [ ] Crear token desde frontend
- [ ] Comprar tokens
- [ ] Vender tokens
- [ ] Verificar balances en Stellar Explorer
- [ ] Verificar eventos emitidos

---

## 🟡 SPRINT 2: SEGURIDAD & TESTING (Semana 2)

### DÍA 6-7: Scout Audit & Fixes

**6.1 Ejecutar Scout**
```bash
cd /Users/munay/dev/Astro-Shiba

# Instalar Scout
cargo install cargo-scout-audit

# Ejecutar en sac-factory
cd contracts/sac-factory
cargo scout-audit

# Ejecutar en amm-pair
cd ../amm-pair
cargo scout-audit
```

**6.2 Resolver Todos los Warnings**
- [ ] Categorizar por severidad (Critical, High, Medium, Low)
- [ ] Resolver 100% de Critical
- [ ] Resolver 100% de High
- [ ] Resolver 80%+ de Medium
- [ ] Documentar Low para resolver después

**6.3 Agregar Error Handling Robusto**
- [ ] Reemplazar todos los `panic!()` con `Result<T, Error>`
- [ ] Agregar descriptive error messages
- [ ] Tests para cada error path

**Ejemplo:**
```rust
// ❌ ANTES
if k_new <= k_old {
    panic!("K invariant violated");
}

// ✅ DESPUÉS
let k_new = pair_info.reserve_0
    .checked_mul(pair_info.reserve_1)
    .ok_or(Error::Overflow)?;

if k_new <= k_old {
    return Err(Error::KInvariantViolated);
}
```

---

### DÍA 8-9: Test Coverage

**8.1 Unit Tests**
- [ ] Bonding curve math tests
- [ ] Buy/sell logic tests
- [ ] Fee calculation tests
- [ ] Access control tests
- [ ] Graduation logic tests

**Target: 80%+ code coverage**

```bash
# Ejecutar tests con coverage
cargo tarpaulin --out Html --output-dir coverage
open coverage/index.html
```

**8.2 Integration Tests**
- [ ] Full flow: launch → buy → sell → graduate
- [ ] Multi-user scenarios
- [ ] Edge cases (max amounts, min amounts, etc.)

**Ejemplo test:**
```rust
#[test]
fn test_full_lifecycle() {
    let env = Env::default();
    let contract_id = env.register_contract(None, SacFactory);
    let contract = SacFactoryClient::new(&env, &contract_id);

    // Setup
    let admin = Address::generate(&env);
    let creator = Address::generate(&env);
    let buyer = Address::generate(&env);

    // Initialize
    contract.initialize(&admin, &treasury);

    // Launch token
    let token = contract.launch_token(
        &creator,
        &String::from_slice(&env, "Test"),
        &String::from_slice(&env, "TST"),
        &String::from_slice(&env, ""),
        &String::from_slice(&env, ""),
    );

    // Buy
    let xlm_amount = 100_000_000i128; // 10 XLM
    let tokens = contract.buy(&buyer, &token, &xlm_amount, &1i128, &u64::MAX);
    assert!(tokens > 0);

    // Sell
    let xlm_back = contract.sell(&buyer, &token, &tokens, &1i128, &u64::MAX);
    assert!(xlm_back > 0);

    // Verify state
    let info = contract.get_token_info(&token);
    assert!(info.xlm_raised > 0);
}
```

**8.3 Frontend Tests**
- [ ] Setup Playwright
- [ ] E2E tests para create token
- [ ] E2E tests para swap
- [ ] E2E tests para portfolio

---

### DÍA 10: Security Review

**10.1 Manual Security Checklist**
- [ ] Todos los `require_auth()` en lugar correcto
- [ ] Todas las transferencias verificadas
- [ ] Slippage protection en todos los swaps
- [ ] Deadline checks en todas las funciones públicas
- [ ] No hay integer overflow (usar checked_*)
- [ ] Storage TTL configurado correctamente
- [ ] Events emitidos para todas las acciones importantes

**10.2 External Audit (Opcional)**
- [ ] Contactar auditor (CoinFabrik, OpenZeppelin, etc.)
- [ ] Enviar código para review
- [ ] Implementar fixes de auditoría

**10.3 Bug Bounty Setup**
- [ ] Crear programa en Immunefi o HackerOne
- [ ] Definir rewards: Critical ($5k), High ($2k), Medium ($500)
- [ ] Documentar scope y reglas

---

## 🟢 SPRINT 3: FEATURES CORE (Semana 3-4)

### DÍA 11-13: Graduation Completa

**11.1 Implementar graduate_to_amm()**

**Objetivo:** Cuando un token llega a $69k, deployar automáticamente un par AMM en Soroswap y lockear liquidez.

**Código completo:**
```rust
pub fn graduate_token(
    env: Env,
    token: Address,
) -> Result<Address, Error> {
    // Solo admin puede forzar graduación (o automático si threshold alcanzado)
    let admin = access_control::get_admin(&env)?;
    admin.require_auth();

    let mut token_info = storage::get_token_info(&env, &token)
        .ok_or(Error::TokenNotFound)?;

    // Verificar que cumple threshold
    if token_info.xlm_raised < GRADUATION_THRESHOLD {
        return Err(Error::GraduationThresholdNotMet);
    }

    // Verificar que no está ya graduado
    if token_info.status == TokenStatus::Graduated {
        return Err(Error::AlreadyGraduated);
    }

    // 1. Deploy SAC real (Stellar Asset Contract)
    let sac_address = deploy_sac_for_token(&env, &token_info)?;

    // 2. Mint supply total al contrato factory
    let sac_client = token::StellarAssetClient::new(&env, &sac_address);
    sac_client.mint(&env.current_contract_address(), &token_info.bonding_curve.tokens_remaining)?;

    // 3. Crear par en Soroswap (o deploy propio AMM)
    let pair_address = create_amm_pair(&env, &sac_address, &get_xlm_token_address(&env))?;

    // 4. Depositar toda la liquidez
    let xlm_liquidity = token_info.xlm_raised;
    let token_liquidity = token_info.bonding_curve.tokens_remaining;

    // Transferir al pair
    let xlm_client = token::Client::new(&env, &get_xlm_token_address(&env));
    xlm_client.transfer(&env.current_contract_address(), &pair_address, &xlm_liquidity);

    sac_client.transfer(&env.current_contract_address(), &pair_address, &token_liquidity);

    // 5. Mintear LP tokens
    let lp_tokens = add_initial_liquidity(&env, &pair_address, xlm_liquidity, token_liquidity)?;

    // 6. QUEMAR LP tokens (lock forever)
    burn_lp_tokens(&env, &pair_address, lp_tokens)?;

    // 7. Actualizar estado
    token_info.status = TokenStatus::Graduated;
    token_info.amm_pair = Some(pair_address.clone());
    storage::set_token_info(&env, &token, &token_info);

    // 8. Emitir evento
    events::token_graduated(
        &env,
        &token,
        &sac_address,
        &pair_address,
        xlm_liquidity,
        token_liquidity,
        lp_tokens,
    );

    Ok(pair_address)
}

fn deploy_sac_for_token(env: &Env, token_info: &TokenInfo) -> Result<Address, Error> {
    // Deploy Stellar Asset Contract
    let contract_id_preimage = soroban_sdk::ContractIdPreimage::StellarAssetContract(
        token_info.creator.clone(),
    );

    let sac_address = env.deployer().deploy_contract(
        symbol_short!("stellar_asset_contract"),
        contract_id_preimage.into_val(env),
    );

    // Initialize SAC
    let sac_client = token::StellarAssetClient::new(env, &sac_address);
    sac_client.set_admin(&env.current_contract_address());

    Ok(sac_address)
}

fn create_amm_pair(env: &Env, token_a: &Address, token_b: &Address) -> Result<Address, Error> {
    // Opción A: Usar Soroswap Factory
    let soroswap_factory = SoroswapFactoryClient::new(env, &SOROSWAP_FACTORY_ADDRESS);
    let pair = soroswap_factory.create_pair(token_a, token_b)?;

    // Opción B: Deploy nuestro propio AMM pair
    // let wasm = include_bytes!("../../amm-pair/target/wasm32-unknown-unknown/release/amm_pair.wasm");
    // let pair = env.deployer().upload_contract_wasm(wasm).deploy();

    Ok(pair)
}

fn add_initial_liquidity(
    env: &Env,
    pair: &Address,
    amount_a: i128,
    amount_b: i128,
) -> Result<i128, Error> {
    let pair_client = AMMPairClient::new(env, pair);

    let (_, _, lp_tokens) = pair_client.add_liquidity(
        &env.current_contract_address(),
        &amount_a,
        &amount_b,
        &0,  // min_a
        &0,  // min_b
        &u64::MAX,  // deadline
    )?;

    Ok(lp_tokens)
}

fn burn_lp_tokens(env: &Env, pair: &Address, amount: i128) -> Result<(), Error> {
    // Transfer LP tokens to dead address (locked forever)
    let dead_address = Address::from_contract_id(env, &[0u8; 32]);

    let pair_client = AMMPairClient::new(env, pair);
    // Nota: LP tokens están en el pair contract, necesitamos quemar desde ahí
    // Esto depende de la implementación del AMM

    Ok(())
}
```

**11.2 Tests de Graduación**
- [ ] Test: gradúa cuando alcanza threshold
- [ ] Test: no gradúa antes del threshold
- [ ] Test: SAC deployado correctamente
- [ ] Test: LP tokens quemados
- [ ] Test: liquidez locked forever

---

### DÍA 14-16: Oracle de Precios

**14.1 Integración con Pyth Network**

**Investigar documentación:**
- https://docs.pyth.network/price-feeds
- https://github.com/pyth-network/pyth-crosschain

**Implementar PriceOracle contract:**
```rust
// contracts/price-oracle/src/lib.rs

use soroban_sdk::{contract, contractimpl, Address, Env, Symbol};

#[contract]
pub struct PriceOracle;

#[contractimpl]
impl PriceOracle {
    pub fn initialize(env: Env, admin: Address) -> Result<(), Error> {
        admin.require_auth();

        env.storage().instance().set(&DataKey::Admin, &admin);
        Ok(())
    }

    pub fn update_price(
        env: Env,
        updater: Address,
        xlm_usd_price: i128,  // Price with 7 decimals
        timestamp: u64,
    ) -> Result<(), Error> {
        updater.require_auth();

        // Verificar que updater está autorizado
        let authorized = env.storage()
            .persistent()
            .get(&DataKey::AuthorizedUpdater(updater.clone()))
            .unwrap_or(false);

        if !authorized {
            return Err(Error::Unauthorized);
        }

        // Guardar precio
        let price_data = PriceData {
            price: xlm_usd_price,
            timestamp,
        };

        env.storage()
            .temporary()
            .set(&DataKey::XLMPrice, &price_data);

        // TTL: 1 hora (debe actualizarse cada hora)
        env.storage()
            .temporary()
            .extend_ttl(&DataKey::XLMPrice, 720, 720);

        // Emitir evento
        env.events().publish(
            ("price_update",),
            PriceUpdateEvent {
                price: xlm_usd_price,
                timestamp,
            },
        );

        Ok(())
    }

    pub fn get_price(env: Env) -> Result<PriceData, Error> {
        env.storage()
            .temporary()
            .get(&DataKey::XLMPrice)
            .ok_or(Error::PriceStale)
    }

    pub fn add_authorized_updater(
        env: Env,
        admin: Address,
        updater: Address,
    ) -> Result<(), Error> {
        admin.require_auth();

        // Verificar que es admin
        let stored_admin: Address = env.storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(Error::NotInitialized)?;

        if admin != stored_admin {
            return Err(Error::Unauthorized);
        }

        env.storage()
            .persistent()
            .set(&DataKey::AuthorizedUpdater(updater), &true);

        Ok(())
    }
}

#[contracttype]
pub struct PriceData {
    pub price: i128,
    pub timestamp: u64,
}

#[contracttype]
pub enum DataKey {
    Admin,
    XLMPrice,
    AuthorizedUpdater(Address),
}
```

**14.2 Backend: Price Updater Bot**
```typescript
// backend/price-updater/src/index.ts

import { SorobanRpc, Keypair, TransactionBuilder } from '@stellar/stellar-sdk';

interface PythPriceData {
  price: string;
  conf: string;
  expo: number;
  timestamp: number;
}

class PriceUpdater {
  private rpc: SorobanRpc.Server;
  private updaterKeypair: Keypair;
  private oracleContractId: string;

  constructor(rpcUrl: string, updaterSecret: string, oracleId: string) {
    this.rpc = new SorobanRpc.Server(rpcUrl);
    this.updaterKeypair = Keypair.fromSecret(updaterSecret);
    this.oracleContractId = oracleId;
  }

  async fetchPythPrice(): Promise<PythPriceData> {
    // Fetch from Pyth Network
    const response = await fetch(
      'https://hermes.pyth.network/api/latest_price_feeds?ids[]=' +
      'ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d' // XLM/USD
    );

    const data = await response.json();
    return data[0].price;
  }

  async updateOraclePrice() {
    try {
      // 1. Fetch precio de Pyth
      const pythPrice = await this.fetchPythPrice();

      // 2. Convertir a formato Soroban (7 decimals)
      const price = Math.floor(
        parseFloat(pythPrice.price) * Math.pow(10, 7 + pythPrice.expo)
      );

      // 3. Build transaction
      const account = await this.rpc.getAccount(this.updaterKeypair.publicKey());

      const tx = new TransactionBuilder(account, {
        fee: '10000000',
        networkPassphrase: Networks.TESTNET,
      })
        .addOperation(
          // Call update_price()
          contractInvoke({
            contractId: this.oracleContractId,
            functionName: 'update_price',
            args: [
              nativeToScVal(this.updaterKeypair.publicKey(), { type: 'address' }),
              nativeToScVal(price, { type: 'i128' }),
              nativeToScVal(pythPrice.timestamp, { type: 'u64' }),
            ],
          })
        )
        .setTimeout(300)
        .build();

      // 4. Simulate
      const simulated = await this.rpc.simulateTransaction(tx);

      // 5. Sign & Submit
      const prepared = SorobanRpc.assembleTransaction(tx, simulated).build();
      prepared.sign(this.updaterKeypair);

      const result = await this.rpc.sendTransaction(prepared);

      console.log(`Price updated: ${price} (${result.hash})`);
    } catch (error) {
      console.error('Failed to update price:', error);
    }
  }

  startPeriodicUpdates(intervalMinutes: number = 5) {
    // Update every 5 minutes
    setInterval(() => {
      this.updateOraclePrice();
    }, intervalMinutes * 60 * 1000);

    // Update immediately
    this.updateOraclePrice();
  }
}

// Start
const updater = new PriceUpdater(
  process.env.RPC_URL!,
  process.env.UPDATER_SECRET!,
  process.env.ORACLE_CONTRACT_ID!,
);

updater.startPeriodicUpdates(5);
```

**14.3 Integrar Oracle en SAC Factory**
```rust
// En get_market_cap_usd()
pub fn get_market_cap_usd(env: Env, token: Address) -> Result<i128, Error> {
    let token_info = storage::get_token_info(&env, &token)
        .ok_or(Error::TokenNotFound)?;

    // Market cap en XLM (stroops)
    let mc_xlm = token_info.xlm_raised;

    // Obtener precio de XLM en USD desde oracle
    let oracle = PriceOracleClient::new(&env, &PRICE_ORACLE_ADDRESS);
    let price_data = oracle.get_price()?;

    // Verificar que el precio no sea muy viejo (max 1 hora)
    let current_time = env.ledger().timestamp();
    if current_time - price_data.timestamp > 3600 {
        return Err(Error::PriceStale);
    }

    // Market cap en USD = (xlm_raised / 10^7) * xlm_price_usd
    let mc_usd = mc_xlm
        .checked_mul(price_data.price)
        .ok_or(Error::Overflow)?
        .checked_div(10_000_000)
        .ok_or(Error::DivisionByZero)?;

    Ok(mc_usd)
}
```

---

### DÍA 17-18: Event Indexer Mejorado

**17.1 Optimizar Backend Indexer**

**Archivo:** `backend/indexer/src/services/optimized-event-indexer.ts`

```typescript
import { SorobanRpc, xdr } from '@stellar/stellar-sdk';
import { PrismaClient } from '@prisma/client';
import { EventEmitter } from 'events';

interface TokenLaunchedEvent {
  creator: string;
  token_address: string;
  name: string;
  symbol: string;
  timestamp: number;
}

interface BuyEvent {
  buyer: string;
  token: string;
  xlm_in: string;
  tokens_out: string;
  fee: string;
  timestamp: number;
}

export class OptimizedEventIndexer extends EventEmitter {
  private rpc: SorobanRpc.Server;
  private prisma: PrismaClient;
  private contractId: string;
  private isRunning: boolean = false;
  private lastProcessedLedger: number = 0;

  constructor(rpcUrl: string, contractId: string) {
    super();
    this.rpc = new SorobanRpc.Server(rpcUrl);
    this.prisma = new PrismaClient();
    this.contractId = contractId;
  }

  async start() {
    this.isRunning = true;

    // Obtener último ledger procesado
    const lastIndexed = await this.prisma.indexerState.findUnique({
      where: { id: 'main' },
    });

    this.lastProcessedLedger = lastIndexed?.lastLedger || await this.getLatestLedger();

    console.log(`Starting indexer from ledger ${this.lastProcessedLedger}`);

    // Poll cada 5 segundos
    while (this.isRunning) {
      try {
        await this.processNewLedgers();
        await this.sleep(5000);
      } catch (error) {
        console.error('Indexer error:', error);
        await this.sleep(10000); // Retry after 10s
      }
    }
  }

  async processNewLedgers() {
    const currentLedger = await this.getLatestLedger();

    if (currentLedger <= this.lastProcessedLedger) {
      return; // No new ledgers
    }

    // Process ledgers in batches of 100
    const batchSize = 100;
    const startSeq = this.lastProcessedLedger + 1;
    const endSeq = Math.min(startSeq + batchSize - 1, currentLedger);

    console.log(`Processing ledgers ${startSeq} to ${endSeq}`);

    // Fetch events for this range
    const events = await this.rpc.getEvents({
      filters: [
        {
          contractIds: [this.contractId],
        },
      ],
      startLedger: startSeq,
      cursor: '',
      limit: 10000,
    });

    // Process events in transaction
    await this.prisma.$transaction(async (tx) => {
      for (const event of events.events) {
        await this.processEvent(event, tx);
      }

      // Update state
      await tx.indexerState.upsert({
        where: { id: 'main' },
        create: {
          id: 'main',
          lastLedger: endSeq,
          lastUpdated: new Date(),
        },
        update: {
          lastLedger: endSeq,
          lastUpdated: new Date(),
        },
      });
    });

    this.lastProcessedLedger = endSeq;
    this.emit('ledgersProcessed', { start: startSeq, end: endSeq });
  }

  async processEvent(event: any, tx: any) {
    const eventType = event.topic[0];

    switch (eventType) {
      case 'token_launched':
        await this.handleTokenLaunched(event, tx);
        break;
      case 'token_bought':
        await this.handleBuy(event, tx);
        break;
      case 'token_sold':
        await this.handleSell(event, tx);
        break;
      case 'token_graduated':
        await this.handleGraduation(event, tx);
        break;
    }
  }

  async handleTokenLaunched(event: any, tx: any) {
    const data: TokenLaunchedEvent = this.decodeEvent(event.value);

    await tx.token.create({
      data: {
        address: data.token_address,
        creator: data.creator,
        name: data.name,
        symbol: data.symbol,
        status: 'Bonding',
        xlmRaised: '0',
        marketCap: '0',
        holdersCount: 0,
        tradesCount: 0,
        volume24h: '0',
        createdAt: new Date(data.timestamp * 1000),
      },
    });

    this.emit('tokenLaunched', data);
  }

  async handleBuy(event: any, tx: any) {
    const data: BuyEvent = this.decodeEvent(event.value);

    // Create transaction record
    await tx.transaction.create({
      data: {
        type: 'BUY',
        user: data.buyer,
        tokenAddress: data.token,
        xlmAmount: data.xlm_in,
        tokenAmount: data.tokens_out,
        fee: data.fee,
        timestamp: new Date(data.timestamp * 1000),
      },
    });

    // Update token stats
    await this.updateTokenStats(data.token, tx);

    this.emit('buy', data);
  }

  async updateTokenStats(tokenAddress: string, tx: any) {
    // Get all trades for this token
    const trades = await tx.transaction.findMany({
      where: { tokenAddress },
    });

    // Calculate 24h volume
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const volume24h = trades
      .filter(t => t.timestamp > oneDayAgo)
      .reduce((sum, t) => sum + parseFloat(t.xlmAmount), 0);

    // Total XLM raised (buy - sell)
    const xlmRaised = trades.reduce((sum, t) => {
      const amount = parseFloat(t.xlmAmount);
      return sum + (t.type === 'BUY' ? amount : -amount);
    }, 0);

    // Unique holders
    const holders = new Set(trades.map(t => t.user));

    // Update token
    await tx.token.update({
      where: { address: tokenAddress },
      data: {
        xlmRaised: xlmRaised.toString(),
        volume24h: volume24h.toString(),
        holdersCount: holders.size,
        tradesCount: trades.length,
      },
    });
  }

  private decodeEvent(value: xdr.ScVal): any {
    // Decode XDR to JSON
    // Implementation depends on event structure
    return {};
  }

  private async getLatestLedger(): Promise<number> {
    const health = await this.rpc.getHealth();
    return health.ledgerSeq;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  stop() {
    this.isRunning = false;
  }
}

// Start indexer
const indexer = new OptimizedEventIndexer(
  process.env.RPC_URL!,
  process.env.CONTRACT_ID!,
);

indexer.on('tokenLaunched', (data) => {
  console.log('New token launched:', data.name);
});

indexer.on('buy', (data) => {
  console.log('Token bought:', data.tokens_out);
});

indexer.start();
```

**17.2 Prisma Schema Completo**
```prisma
// backend/shared/prisma/schema.prisma

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model Token {
  id            String        @id @default(cuid())
  address       String        @unique
  creator       String
  name          String
  symbol        String
  imageUrl      String?
  description   String?
  status        TokenStatus   @default(Bonding)
  xlmRaised     String        @default("0")
  marketCap     String        @default("0")
  holdersCount  Int           @default(0)
  tradesCount   Int           @default(0)
  volume24h     String        @default("0")
  ammPair       String?
  sacAddress    String?
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt

  transactions  Transaction[]

  @@index([status])
  @@index([createdAt])
  @@index([volume24h])
}

enum TokenStatus {
  Bonding
  PendingGraduation
  Graduated
}

model Transaction {
  id           String          @id @default(cuid())
  type         TransactionType
  user         String
  tokenAddress String
  xlmAmount    String
  tokenAmount  String
  fee          String?
  pricePerToken String?
  timestamp    DateTime
  txHash       String?

  token        Token           @relation(fields: [tokenAddress], references: [address])

  @@index([tokenAddress])
  @@index([user])
  @@index([timestamp])
}

enum TransactionType {
  BUY
  SELL
  LAUNCH
  GRADUATE
}

model IndexerState {
  id          String   @id
  lastLedger  Int
  lastUpdated DateTime @updatedAt
}

model PriceHistory {
  id         String   @id @default(cuid())
  token      String
  price      String
  volume     String
  timestamp  DateTime

  @@index([token, timestamp])
}
```

**17.3 GraphQL API Mejorado**
```graphql
# backend/api-gateway-v2/src/schema/schema.graphql

type Token {
  id: ID!
  address: String!
  creator: String!
  name: String!
  symbol: String!
  imageUrl: String
  description: String
  status: TokenStatus!
  xlmRaised: String!
  marketCap: String!
  marketCapUSD: String!
  holdersCount: Int!
  tradesCount: Int!
  volume24h: String!
  volumeChange24h: Float!
  currentPrice: String!
  priceChange24h: Float!
  ammPair: String
  sacAddress: String
  createdAt: DateTime!
  updatedAt: DateTime!

  transactions(first: Int, offset: Int, type: TransactionType): [Transaction!]!
  priceHistory(interval: String!, limit: Int): [PricePoint!]!
}

type Transaction {
  id: ID!
  type: TransactionType!
  user: String!
  token: Token!
  xlmAmount: String!
  tokenAmount: String!
  fee: String
  pricePerToken: String
  timestamp: DateTime!
  txHash: String
}

type PricePoint {
  price: String!
  volume: String!
  timestamp: DateTime!
}

enum TokenStatus {
  Bonding
  PendingGraduation
  Graduated
}

enum TransactionType {
  BUY
  SELL
  LAUNCH
  GRADUATE
}

type Query {
  # Single token
  token(address: String!): Token

  # List tokens
  tokens(
    first: Int = 20
    offset: Int = 0
    orderBy: TokenOrderBy = CREATED_AT_DESC
    filter: TokenFilter
  ): TokenConnection!

  # Trending tokens (by volume)
  trending(limit: Int = 10, timeframe: String = "24h"): [Token!]!

  # Recently launched
  recentTokens(limit: Int = 20): [Token!]!

  # Near graduation
  nearGraduation(limit: Int = 10): [Token!]!

  # Recent trades
  recentTrades(limit: Int = 50): [Transaction!]!

  # User trades
  userTrades(address: String!, first: Int = 50, offset: Int = 0): [Transaction!]!

  # Global stats
  globalStats: GlobalStats!
}

type TokenConnection {
  edges: [TokenEdge!]!
  pageInfo: PageInfo!
  totalCount: Int!
}

type TokenEdge {
  node: Token!
  cursor: String!
}

type PageInfo {
  hasNextPage: Boolean!
  hasPreviousPage: Boolean!
  startCursor: String
  endCursor: String
}

input TokenFilter {
  status: TokenStatus
  minMarketCap: String
  maxMarketCap: String
  minVolume24h: String
  creator: String
}

enum TokenOrderBy {
  CREATED_AT_DESC
  CREATED_AT_ASC
  VOLUME_24H_DESC
  VOLUME_24H_ASC
  MARKET_CAP_DESC
  MARKET_CAP_ASC
  HOLDERS_DESC
}

type GlobalStats {
  totalTokens: Int!
  totalVolume24h: String!
  totalVolumeChange24h: Float!
  totalLiquidity: String!
  totalLiquidityChange24h: Float!
  totalUsers: Int!
  totalTransactions: Int!
}

scalar DateTime
```

---

## 🚀 SPRINT 4: ADVANCED FEATURES (Semana 5-6)

### DÍA 19-21: Flash Loans

**19.1 Implementar Flash Loan Contract**

**Nuevo contrato:** `contracts/flash-loans/`

```rust
// contracts/flash-loans/src/lib.rs

use soroban_sdk::{contract, contractimpl, token, Address, Env, Symbol, Vec};

#[contract]
pub struct FlashLoanPool;

#[contractimpl]
impl FlashLoanPool {
    pub fn initialize(
        env: Env,
        admin: Address,
        token: Address,
    ) -> Result<(), Error> {
        admin.require_auth();

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Token, &token);
        env.storage().instance().set(&DataKey::TotalDeposits, &0i128);
        env.storage().instance().set(&DataKey::TotalBorrowed, &0i128);

        Ok(())
    }

    pub fn deposit(
        env: Env,
        depositor: Address,
        amount: i128,
    ) -> Result<(), Error> {
        depositor.require_auth();

        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }

        let token: Address = env.storage().instance().get(&DataKey::Token).unwrap();

        // Transfer tokens to pool
        token::Client::new(&env, &token).transfer(
            &depositor,
            &env.current_contract_address(),
            &amount,
        );

        // Update depositor balance
        let current_balance = get_balance(&env, &depositor);
        set_balance(&env, &depositor, current_balance + amount)?;

        // Update total
        let total: i128 = env.storage().instance().get(&DataKey::TotalDeposits).unwrap();
        env.storage().instance().set(&DataKey::TotalDeposits, &(total + amount));

        // Emit event
        env.events().publish(
            ("deposit",),
            DepositEvent { depositor, amount },
        );

        Ok(())
    }

    pub fn flash_loan(
        env: Env,
        borrower: Address,
        amount: i128,
        receiver: Address,
        callback_fn: Symbol,
        callback_data: Vec<u8>,
    ) -> Result<(), Error> {
        borrower.require_auth();

        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }

        let token: Address = env.storage().instance().get(&DataKey::Token).unwrap();
        let token_client = token::Client::new(&env, &token);

        // Get initial balance
        let initial_balance = token_client.balance(&env.current_contract_address());

        if initial_balance < amount {
            return Err(Error::InsufficientLiquidity);
        }

        // Calculate fee (0.05%)
        let fee = (amount * 5) / 10000;

        // Transfer loan to receiver
        token_client.transfer(&env.current_contract_address(), &receiver, &amount);

        // Call receiver's callback function
        // The receiver must implement execute_flash_loan()
        // and repay amount + fee

        // In Soroban, we can't directly call arbitrary functions
        // The borrower must manually call repay_flash_loan()

        // Store flash loan state
        env.storage().temporary().set(
            &DataKey::ActiveLoan(borrower.clone()),
            &FlashLoan {
                amount,
                fee,
                borrower: borrower.clone(),
                timestamp: env.ledger().timestamp(),
            },
        );

        // Mark that repayment is required
        env.storage().temporary().set(&DataKey::RepaymentRequired, &true);

        Ok(())
    }

    pub fn repay_flash_loan(
        env: Env,
        borrower: Address,
    ) -> Result<(), Error> {
        borrower.require_auth();

        // Check that there's an active loan
        let repayment_required: bool = env.storage()
            .temporary()
            .get(&DataKey::RepaymentRequired)
            .unwrap_or(false);

        if !repayment_required {
            return Err(Error::NoActiveLoan);
        }

        let loan: FlashLoan = env.storage()
            .temporary()
            .get(&DataKey::ActiveLoan(borrower.clone()))
            .ok_or(Error::NoActiveLoan)?;

        let token: Address = env.storage().instance().get(&DataKey::Token).unwrap();
        let token_client = token::Client::new(&env, &token);

        // Get current balance
        let current_balance = token_client.balance(&env.current_contract_address());

        // Calculate expected balance (initial + fee)
        let initial_balance = current_balance - loan.amount;
        let expected_balance = initial_balance + loan.fee;

        // Verify repayment
        if current_balance < expected_balance {
            return Err(Error::FlashLoanNotRepaid);
        }

        // Clear loan state
        env.storage().temporary().remove(&DataKey::ActiveLoan(borrower.clone()));
        env.storage().temporary().remove(&DataKey::RepaymentRequired);

        // Update total borrowed (for stats)
        let total: i128 = env.storage().instance().get(&DataKey::TotalBorrowed).unwrap_or(0);
        env.storage().instance().set(&DataKey::TotalBorrowed, &(total + loan.amount));

        // Emit event
        env.events().publish(
            ("flash_loan_repaid",),
            FlashLoanRepaidEvent {
                borrower: loan.borrower,
                amount: loan.amount,
                fee: loan.fee,
            },
        );

        Ok(())
    }

    pub fn withdraw(
        env: Env,
        depositor: Address,
        amount: i128,
    ) -> Result<(), Error> {
        depositor.require_auth();

        let balance = get_balance(&env, &depositor);

        if balance < amount {
            return Err(Error::InsufficientBalance);
        }

        let token: Address = env.storage().instance().get(&DataKey::Token).unwrap();

        // Transfer tokens back
        token::Client::new(&env, &token).transfer(
            &env.current_contract_address(),
            &depositor,
            &amount,
        );

        // Update balance
        set_balance(&env, &depositor, balance - amount)?;

        // Update total
        let total: i128 = env.storage().instance().get(&DataKey::TotalDeposits).unwrap();
        env.storage().instance().set(&DataKey::TotalDeposits, &(total - amount));

        Ok(())
    }
}

#[contracttype]
struct FlashLoan {
    amount: i128,
    fee: i128,
    borrower: Address,
    timestamp: u64,
}

#[contracttype]
enum DataKey {
    Admin,
    Token,
    TotalDeposits,
    TotalBorrowed,
    Balance(Address),
    ActiveLoan(Address),
    RepaymentRequired,
}

fn get_balance(env: &Env, address: &Address) -> i128 {
    env.storage()
        .persistent()
        .get(&DataKey::Balance(address.clone()))
        .unwrap_or(0)
}

fn set_balance(env: &Env, address: &Address, amount: i128) -> Result<(), Error> {
    env.storage()
        .persistent()
        .set(&DataKey::Balance(address.clone()), &amount);
    Ok(())
}
```

**19.2 Ejemplo de Uso: Arbitrage Bot**
```rust
// Example contract that uses flash loans for arbitrage

#[contract]
pub struct ArbitrageBot;

#[contractimpl]
impl ArbitrageBot {
    pub fn execute_arbitrage(
        env: Env,
        executor: Address,
        amount: i128,
    ) -> Result<i128, Error> {
        executor.require_auth();

        // 1. Request flash loan
        let flash_pool = FlashLoanPoolClient::new(&env, &FLASH_POOL_ADDRESS);

        flash_pool.flash_loan(
            &executor,
            &amount,
            &env.current_contract_address(),
            &Symbol::new(&env, "execute"),
            &Vec::new(&env),
        )?;

        // 2. Execute arbitrage
        // - Buy on Astro Shiba at lower price
        // - Sell on Soroswap at higher price
        let profit = Self::do_arbitrage(&env, amount)?;

        // 3. Repay flash loan
        flash_pool.repay_flash_loan(&executor)?;

        Ok(profit)
    }

    fn do_arbitrage(env: &Env, amount: i128) -> Result<i128, Error> {
        // Buy cheap on platform A
        let tokens = buy_on_platform_a(env, amount)?;

        // Sell expensive on platform B
        let xlm_back = sell_on_platform_b(env, tokens)?;

        // Profit = xlm_back - amount - fee
        let fee = (amount * 5) / 10000;
        let profit = xlm_back - amount - fee;

        Ok(profit)
    }
}
```

---

### DÍA 22-24: Staking & Yield Farming

**22.1 Staking Contract**

**Nuevo contrato:** `contracts/staking/`

```rust
// contracts/staking/src/lib.rs

use soroban_sdk::{contract, contractimpl, token, Address, Env};

const REWARD_RATE_PER_SECOND: i128 = 100; // Rewards per second
const PRECISION: i128 = 1_000_000_000; // For fixed-point math

#[contract]
pub struct StakingPool;

#[contractimpl]
impl StakingPool {
    pub fn initialize(
        env: Env,
        admin: Address,
        staking_token: Address,
        reward_token: Address,
    ) -> Result<(), Error> {
        admin.require_auth();

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::StakingToken, &staking_token);
        env.storage().instance().set(&DataKey::RewardToken, &reward_token);
        env.storage().instance().set(&DataKey::TotalStaked, &0i128);
        env.storage().instance().set(&DataKey::RewardPerTokenStored, &0i128);
        env.storage().instance().set(&DataKey::LastUpdateTime, &env.ledger().timestamp());

        Ok(())
    }

    pub fn stake(
        env: Env,
        user: Address,
        amount: i128,
    ) -> Result<(), Error> {
        user.require_auth();

        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }

        // Update rewards before staking
        Self::update_reward(&env, &user)?;

        let staking_token: Address = env.storage().instance().get(&DataKey::StakingToken).unwrap();

        // Transfer tokens to contract
        token::Client::new(&env, &staking_token).transfer(
            &user,
            &env.current_contract_address(),
            &amount,
        );

        // Update user stake
        let current_stake = get_stake(&env, &user);
        set_stake(&env, &user, current_stake + amount)?;

        // Update total staked
        let total: i128 = env.storage().instance().get(&DataKey::TotalStaked).unwrap();
        env.storage().instance().set(&DataKey::TotalStaked, &(total + amount));

        // Emit event
        env.events().publish(
            ("stake",),
            StakeEvent { user, amount },
        );

        Ok(())
    }

    pub fn unstake(
        env: Env,
        user: Address,
        amount: i128,
    ) -> Result<(), Error> {
        user.require_auth();

        let current_stake = get_stake(&env, &user);

        if current_stake < amount {
            return Err(Error::InsufficientStake);
        }

        // Update rewards before unstaking
        Self::update_reward(&env, &user)?;

        let staking_token: Address = env.storage().instance().get(&DataKey::StakingToken).unwrap();

        // Transfer tokens back
        token::Client::new(&env, &staking_token).transfer(
            &env.current_contract_address(),
            &user,
            &amount,
        );

        // Update user stake
        set_stake(&env, &user, current_stake - amount)?;

        // Update total staked
        let total: i128 = env.storage().instance().get(&DataKey::TotalStaked).unwrap();
        env.storage().instance().set(&DataKey::TotalStaked, &(total - amount));

        Ok(())
    }

    pub fn claim_rewards(
        env: Env,
        user: Address,
    ) -> Result<i128, Error> {
        user.require_auth();

        // Update rewards
        Self::update_reward(&env, &user)?;

        let rewards = get_rewards(&env, &user);

        if rewards == 0 {
            return Err(Error::NoRewards);
        }

        // Reset user rewards
        set_rewards(&env, &user, 0)?;

        let reward_token: Address = env.storage().instance().get(&DataKey::RewardToken).unwrap();

        // Mint rewards (or transfer from treasury)
        token::StellarAssetClient::new(&env, &reward_token).mint(&user, &rewards);

        // Emit event
        env.events().publish(
            ("rewards_claimed",),
            RewardsClaimedEvent { user, amount: rewards },
        );

        Ok(rewards)
    }

    pub fn get_pending_rewards(env: Env, user: Address) -> i128 {
        let current_stake = get_stake(&env, &user);

        if current_stake == 0 {
            return 0;
        }

        let reward_per_token = Self::reward_per_token(&env);
        let user_reward_per_token_paid = get_user_reward_per_token_paid(&env, &user);
        let rewards = get_rewards(&env, &user);

        let new_rewards = (current_stake * (reward_per_token - user_reward_per_token_paid)) / PRECISION;

        rewards + new_rewards
    }

    fn update_reward(env: &Env, user: &Address) -> Result<(), Error> {
        let reward_per_token = Self::reward_per_token(env);
        env.storage().instance().set(&DataKey::RewardPerTokenStored, &reward_per_token);
        env.storage().instance().set(&DataKey::LastUpdateTime, &env.ledger().timestamp());

        let pending = Self::get_pending_rewards(env.clone(), user.clone());
        set_rewards(env, user, pending)?;
        set_user_reward_per_token_paid(env, user, reward_per_token)?;

        Ok(())
    }

    fn reward_per_token(env: &Env) -> i128 {
        let total_staked: i128 = env.storage().instance().get(&DataKey::TotalStaked).unwrap();

        if total_staked == 0 {
            return env.storage().instance().get(&DataKey::RewardPerTokenStored).unwrap();
        }

        let last_update: u64 = env.storage().instance().get(&DataKey::LastUpdateTime).unwrap();
        let current_time = env.ledger().timestamp();
        let time_elapsed = (current_time - last_update) as i128;

        let reward_per_token_stored: i128 = env.storage()
            .instance()
            .get(&DataKey::RewardPerTokenStored)
            .unwrap();

        let new_rewards = (REWARD_RATE_PER_SECOND * time_elapsed * PRECISION) / total_staked;

        reward_per_token_stored + new_rewards
    }
}

#[contracttype]
enum DataKey {
    Admin,
    StakingToken,
    RewardToken,
    TotalStaked,
    RewardPerTokenStored,
    LastUpdateTime,
    Stake(Address),
    Rewards(Address),
    UserRewardPerTokenPaid(Address),
}

fn get_stake(env: &Env, user: &Address) -> i128 {
    env.storage().persistent().get(&DataKey::Stake(user.clone())).unwrap_or(0)
}

fn set_stake(env: &Env, user: &Address, amount: i128) -> Result<(), Error> {
    env.storage().persistent().set(&DataKey::Stake(user.clone()), &amount);
    Ok(())
}

fn get_rewards(env: &Env, user: &Address) -> i128 {
    env.storage().persistent().get(&DataKey::Rewards(user.clone())).unwrap_or(0)
}

fn set_rewards(env: &Env, user: &Address, amount: i128) -> Result<(), Error> {
    env.storage().persistent().set(&DataKey::Rewards(user.clone()), &amount);
    Ok(())
}

fn get_user_reward_per_token_paid(env: &Env, user: &Address) -> i128 {
    env.storage()
        .persistent()
        .get(&DataKey::UserRewardPerTokenPaid(user.clone()))
        .unwrap_or(0)
}

fn set_user_reward_per_token_paid(env: &Env, user: &Address, amount: i128) -> Result<(), Error> {
    env.storage()
        .persistent()
        .set(&DataKey::UserRewardPerTokenPaid(user.clone()), &amount);
    Ok(())
}
```

**22.2 Frontend: Staking Page**
```typescript
// apps/web/src/app/stake/page.tsx

'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '@/contexts/WalletContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';

export default function StakePage() {
  const { address, isConnected } = useWallet();
  const [stakeAmount, setStakeAmount] = useState('');
  const [userStake, setUserStake] = useState('0');
  const [pendingRewards, setPendingRewards] = useState('0');
  const [totalStaked, setTotalStaked] = useState('0');
  const [apy, setApy] = useState(0);

  useEffect(() => {
    if (isConnected && address) {
      fetchStakingData();
    }
  }, [isConnected, address]);

  const fetchStakingData = async () => {
    // Fetch from contract
    const stakingService = await import('@/lib/stellar/services/staking.service');

    const [stake, rewards, total] = await Promise.all([
      stakingService.getUserStake(address),
      stakingService.getPendingRewards(address),
      stakingService.getTotalStaked(),
    ]);

    setUserStake(stake);
    setPendingRewards(rewards);
    setTotalStaked(total);

    // Calculate APY
    const rewardRate = 100; // per second
    const yearlyRewards = rewardRate * 365 * 24 * 60 * 60;
    const calculatedApy = (yearlyRewards / parseFloat(total)) * 100;
    setApy(calculatedApy);
  };

  const handleStake = async () => {
    // Implementation
  };

  const handleUnstake = async () => {
    // Implementation
  };

  const handleClaimRewards = async () => {
    // Implementation
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Staking</h1>
          <p className="text-gray-600">Stake your tokens to earn rewards</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-6 rounded-xl border">
            <p className="text-sm text-gray-600">Your Stake</p>
            <p className="text-2xl font-bold">{userStake} ASTRO</p>
          </div>

          <div className="bg-white p-6 rounded-xl border">
            <p className="text-sm text-gray-600">Pending Rewards</p>
            <p className="text-2xl font-bold text-green-600">{pendingRewards} ASTRO</p>
          </div>

          <div className="bg-white p-6 rounded-xl border">
            <p className="text-sm text-gray-600">APY</p>
            <p className="text-2xl font-bold text-blue-600">{apy.toFixed(2)}%</p>
          </div>
        </div>

        {/* Staking Interface */}
        <div className="bg-white p-8 rounded-xl border">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Amount to Stake
              </label>
              <input
                type="number"
                value={stakeAmount}
                onChange={(e) => setStakeAmount(e.target.value)}
                className="w-full px-4 py-3 border rounded-lg"
                placeholder="0.0"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={handleStake}
                className="bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700"
              >
                Stake
              </button>

              <button
                onClick={handleUnstake}
                className="bg-gray-600 text-white py-3 rounded-lg font-semibold hover:bg-gray-700"
              >
                Unstake
              </button>
            </div>

            <button
              onClick={handleClaimRewards}
              className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700"
            >
              Claim Rewards ({pendingRewards} ASTRO)
            </button>
          </div>
        </div>

        {/* Info */}
        <div className="bg-blue-50 p-6 rounded-xl border border-blue-200">
          <h3 className="font-semibold mb-2">How Staking Works</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Stake your ASTRO tokens to earn rewards</li>
            <li>• Rewards are distributed continuously (per second)</li>
            <li>• Unstake anytime - no lock period</li>
            <li>• APY varies based on total staked amount</li>
          </ul>
        </div>
      </div>
    </DashboardLayout>
  );
}
```

---

### DÍA 25-27: Governance & DAO

**25.1 Governance Contract**

**Nuevo contrato:** `contracts/governance/`

```rust
// contracts/governance/src/lib.rs

use soroban_sdk::{contract, contractimpl, Address, Env, String, Vec};

const VOTING_PERIOD: u64 = 7 * 24 * 60 * 60; // 7 days
const PROPOSAL_THRESHOLD: i128 = 100_000 * 10_000_000; // 100k tokens to propose
const QUORUM: i128 = 10; // 10% of total supply

#[contract]
pub struct Governance;

#[contractimpl]
impl Governance {
    pub fn initialize(
        env: Env,
        admin: Address,
        governance_token: Address,
    ) -> Result<(), Error> {
        admin.require_auth();

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::GovernanceToken, &governance_token);
        env.storage().instance().set(&DataKey::ProposalCount, &0u64);

        Ok(())
    }

    pub fn create_proposal(
        env: Env,
        proposer: Address,
        title: String,
        description: String,
        actions: Vec<ProposalAction>,
    ) -> Result<u64, Error> {
        proposer.require_auth();

        // Verificar que el proposer tiene suficientes tokens
        let governance_token: Address = env.storage().instance().get(&DataKey::GovernanceToken).unwrap();
        let balance = token::Client::new(&env, &governance_token).balance(&proposer);

        if balance < PROPOSAL_THRESHOLD {
            return Err(Error::InsufficientBalance);
        }

        // Create proposal
        let proposal_id: u64 = env.storage().instance().get(&DataKey::ProposalCount).unwrap();
        let new_id = proposal_id + 1;

        let proposal = Proposal {
            id: new_id,
            proposer: proposer.clone(),
            title,
            description,
            actions,
            votes_for: 0,
            votes_against: 0,
            start_time: env.ledger().timestamp(),
            end_time: env.ledger().timestamp() + VOTING_PERIOD,
            executed: false,
            canceled: false,
        };

        env.storage().persistent().set(&DataKey::Proposal(new_id), &proposal);
        env.storage().instance().set(&DataKey::ProposalCount, &new_id);

        // Emit event
        env.events().publish(
            ("proposal_created",),
            ProposalCreatedEvent {
                id: new_id,
                proposer,
            },
        );

        Ok(new_id)
    }

    pub fn vote(
        env: Env,
        voter: Address,
        proposal_id: u64,
        support: bool,
    ) -> Result<(), Error> {
        voter.require_auth();

        let mut proposal: Proposal = env.storage()
            .persistent()
            .get(&DataKey::Proposal(proposal_id))
            .ok_or(Error::ProposalNotFound)?;

        // Verificar que la votación está activa
        let current_time = env.ledger().timestamp();
        if current_time < proposal.start_time || current_time > proposal.end_time {
            return Err(Error::VotingClosed);
        }

        // Verificar que no ha votado ya
        if has_voted(&env, proposal_id, &voter) {
            return Err(Error::AlreadyVoted);
        }

        // Obtener voting power (= token balance al inicio de la propuesta)
        let governance_token: Address = env.storage().instance().get(&DataKey::GovernanceToken).unwrap();
        let voting_power = token::Client::new(&env, &governance_token).balance(&voter);

        // Registrar voto
        if support {
            proposal.votes_for += voting_power;
        } else {
            proposal.votes_against += voting_power;
        }

        // Marcar como votado
        mark_voted(&env, proposal_id, &voter)?;

        // Guardar propuesta
        env.storage().persistent().set(&DataKey::Proposal(proposal_id), &proposal);

        // Emit event
        env.events().publish(
            ("vote_cast",),
            VoteCastEvent {
                proposal_id,
                voter,
                support,
                voting_power,
            },
        );

        Ok(())
    }

    pub fn execute_proposal(
        env: Env,
        executor: Address,
        proposal_id: u64,
    ) -> Result<(), Error> {
        executor.require_auth();

        let mut proposal: Proposal = env.storage()
            .persistent()
            .get(&DataKey::Proposal(proposal_id))
            .ok_or(Error::ProposalNotFound)?;

        // Verificar que la votación terminó
        if env.ledger().timestamp() <= proposal.end_time {
            return Err(Error::VotingStillOpen);
        }

        // Verificar que no está ejecutada
        if proposal.executed {
            return Err(Error::AlreadyExecuted);
        }

        // Verificar quorum
        let governance_token: Address = env.storage().instance().get(&DataKey::GovernanceToken).unwrap();
        let total_supply = token::Client::new(&env, &governance_token).total_supply();
        let total_votes = proposal.votes_for + proposal.votes_against;

        if total_votes < (total_supply * QUORUM) / 100 {
            return Err(Error::QuorumNotReached);
        }

        // Verificar que ganó
        if proposal.votes_for <= proposal.votes_against {
            return Err(Error::ProposalRejected);
        }

        // Ejecutar acciones
        for action in proposal.actions.iter() {
            execute_action(&env, &action)?;
        }

        // Marcar como ejecutada
        proposal.executed = true;
        env.storage().persistent().set(&DataKey::Proposal(proposal_id), &proposal);

        // Emit event
        env.events().publish(
            ("proposal_executed",),
            ProposalExecutedEvent { proposal_id },
        );

        Ok(())
    }

    pub fn get_proposal(env: Env, proposal_id: u64) -> Option<Proposal> {
        env.storage().persistent().get(&DataKey::Proposal(proposal_id))
    }
}

#[contracttype]
pub struct Proposal {
    pub id: u64,
    pub proposer: Address,
    pub title: String,
    pub description: String,
    pub actions: Vec<ProposalAction>,
    pub votes_for: i128,
    pub votes_against: i128,
    pub start_time: u64,
    pub end_time: u64,
    pub executed: bool,
    pub canceled: bool,
}

#[contracttype]
pub enum ProposalAction {
    ChangeFee(i128),             // Cambiar trading fee
    ChangeThreshold(i128),       // Cambiar graduation threshold
    AddAdmin(Address),           // Agregar admin
    RemoveAdmin(Address),        // Remover admin
    TransferFunds(Address, i128), // Transferir del treasury
    PauseContract,               // Pausar contrato
    UnpauseContract,             // Despausar contrato
}

#[contracttype]
enum DataKey {
    Admin,
    GovernanceToken,
    ProposalCount,
    Proposal(u64),
    HasVoted(u64, Address),
}

fn has_voted(env: &Env, proposal_id: u64, voter: &Address) -> bool {
    env.storage()
        .persistent()
        .get(&DataKey::HasVoted(proposal_id, voter.clone()))
        .unwrap_or(false)
}

fn mark_voted(env: &Env, proposal_id: u64, voter: &Address) -> Result<(), Error> {
    env.storage()
        .persistent()
        .set(&DataKey::HasVoted(proposal_id, voter.clone()), &true);
    Ok(())
}

fn execute_action(env: &Env, action: &ProposalAction) -> Result<(), Error> {
    match action {
        ProposalAction::ChangeFee(new_fee) => {
            // Call SAC Factory to change fee
            let factory = SacFactoryClient::new(env, &FACTORY_ADDRESS);
            factory.set_trading_fee(&env.current_contract_address(), new_fee)?;
        }
        ProposalAction::ChangeThreshold(new_threshold) => {
            // Implementation
        }
        ProposalAction::AddAdmin(admin) => {
            // Implementation
        }
        // ... otras acciones
    }
    Ok(())
}
```

---

## 📅 SPRINT 5: PRODUCTION READY (Semana 7)

### DÍA 28: Security Hardening

**28.1 Multisig Admin**
- [ ] Implementar multisig con Stellar accounts
- [ ] 2-of-3 o 3-of-5 para acciones críticas
- [ ] Documentar proceso de multisig

**28.2 Time Locks**
- [ ] Implementar timelock para cambios importantes
- [ ] Mínimo 24-48 horas delay
- [ ] Notificación a comunidad antes de ejecutar

**28.3 Circuit Breakers**
- [ ] Pausar trading si detecta actividad sospechosa
- [ ] Limites diarios de volumen
- [ ] Auto-pause en eventos anómalos

### DÍA 29: Monitoring & Alerting

**29.1 Metrics Dashboard**
```typescript
// backend/monitoring/src/metrics.ts

import { Gauge, Counter, Histogram } from 'prom-client';

export const metrics = {
  // Token metrics
  totalTokens: new Gauge({
    name: 'astro_shiba_total_tokens',
    help: 'Total number of tokens created',
  }),

  // Trading metrics
  totalVolume24h: new Gauge({
    name: 'astro_shiba_volume_24h',
    help: '24h trading volume in XLM',
  }),

  tradeCount: new Counter({
    name: 'astro_shiba_trades_total',
    help: 'Total number of trades',
    labelNames: ['type'], // buy, sell
  }),

  // Performance metrics
  txLatency: new Histogram({
    name: 'astro_shiba_tx_latency_seconds',
    help: 'Transaction latency in seconds',
    buckets: [0.1, 0.5, 1, 2, 5, 10],
  }),

  // Error metrics
  errors: new Counter({
    name: 'astro_shiba_errors_total',
    help: 'Total errors',
    labelNames: ['type'],
  }),
};

// Update metrics
export function updateMetrics() {
  setInterval(async () => {
    const stats = await getGlobalStats();

    metrics.totalTokens.set(stats.totalTokens);
    metrics.totalVolume24h.set(parseFloat(stats.volume24h));
  }, 60000); // Every minute
}
```

**29.2 Alerting**
- [ ] Setup Prometheus + Grafana
- [ ] Alerts para: volumen anormal, errores, downtime
- [ ] Telegram/Discord notifications

### DÍA 30: Documentation

**30.1 User Documentation**
- [ ] Cómo crear token
- [ ] Cómo comprar/vender
- [ ] Cómo hacer stake
- [ ] Cómo participar en governance
- [ ] FAQ

**30.2 Developer Documentation**
- [ ] Contract APIs
- [ ] GraphQL schema
- [ ] Frontend integration guide
- [ ] Examples

**30.3 Security Documentation**
- [ ] Audit reports
- [ ] Bug bounty program
- [ ] Security best practices
- [ ] Incident response plan

### DÍA 31-35: Final Testing & Deploy

**31.1 Testnet Marathon**
- [ ] 5 días de testing continuo en testnet
- [ ] Invitar beta testers
- [ ] Simular carga alta
- [ ] Fix todos los bugs encontrados

**31.2 Mainnet Deploy**
- [ ] Deploy todos los contratos a mainnet
- [ ] Verificar en Stellar Explorer
- [ ] Initialize con admin multisig
- [ ] Deploy frontend a producción
- [ ] Deploy backend services
- [ ] Enable monitoring

**31.3 Post-Launch**
- [ ] Monitor 24/7 primeros 3 días
- [ ] Community support activo
- [ ] Quick response a issues
- [ ] Publicar post-mortem si hay incidentes

---

## ✅ CHECKLIST DE VERIFICACIÓN

### Pre-Mainnet Checklist

#### Contratos
- [ ] SAC Factory: transferencias reales implementadas
- [ ] SAC Factory: graduation completa implementada
- [ ] SAC Factory: deadline checks en todas las funciones
- [ ] SAC Factory: validación de addresses
- [ ] AMM Pair: reentrancy protection
- [ ] AMM Pair: K invariant checks
- [ ] Todos los contratos: SDK 23.2.1
- [ ] Todos los contratos: Scout audit passed
- [ ] Todos los contratos: optimizados (<256KB)
- [ ] Todos los contratos: 80%+ test coverage

#### Backend
- [ ] Event indexer funcionando
- [ ] GraphQL API completa
- [ ] Price oracle actualizado
- [ ] Database migrations aplicadas
- [ ] Rate limiting implementado
- [ ] Monitoring activo
- [ ] Logs configurados
- [ ] Health checks implementados

#### Frontend
- [ ] No console.logs en producción
- [ ] Error handling robusto
- [ ] Loading states en todos los flows
- [ ] Responsive design
- [ ] Wallet connect funciona con 6+ wallets
- [ ] Real-time updates (WebSockets)
- [ ] E2E tests passed
- [ ] Performance optimized (Lighthouse >90)

#### Security
- [ ] Scout audit: 0 Critical, 0 High
- [ ] External audit completed (opcional)
- [ ] Bug bounty program live
- [ ] Multisig admin configured
- [ ] Time locks en acciones críticas
- [ ] Circuit breakers implementados
- [ ] Incident response plan documented

#### Operations
- [ ] Monitoring dashboard
- [ ] Alerting configured
- [ ] Runbook para incidentes
- [ ] Backup strategy
- [ ] Disaster recovery plan
- [ ] 24/7 on-call rotation

#### Documentation
- [ ] User guides completos
- [ ] Developer docs completos
- [ ] API documentation
- [ ] Security docs
- [ ] FAQ actualizado

#### Legal & Compliance
- [ ] Terms of Service
- [ ] Privacy Policy
- [ ] Disclaimers claros
- [ ] Regulatory research completed

---

## 📊 MÉTRICAS DE ÉXITO

### Week 1 Post-Launch
- [ ] >100 tokens creados
- [ ] >$10k volumen total
- [ ] >50 usuarios activos
- [ ] 0 incidentes de seguridad
- [ ] <0.1% error rate

### Month 1
- [ ] >1,000 tokens creados
- [ ] >$100k volumen total
- [ ] >500 usuarios activos
- [ ] >10 tokens graduados
- [ ] Listed en DeFiLlama

### Month 3
- [ ] >5,000 tokens
- [ ] >$1M volumen total
- [ ] >2,000 usuarios activos
- [ ] Partnerships con otros proyectos Stellar
- [ ] Mobile app beta

---

## 🚀 EMPEZAMOS YA

**Próximo comando a ejecutar:**
```bash
cd /Users/munay/dev/Astro-Shiba/contracts/sac-factory
git checkout -b sprint-1-critical-fixes
```

**Primera tarea:** Implementar transferencias reales en buy() (Día 1)

¿Estás listo para empezar? 🔥
