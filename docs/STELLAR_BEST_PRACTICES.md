# Stellar/Soroban Best Practices Guide

## Resumen Ejecutivo

Este documento consolida las mejores prácticas para desarrollar smart contracts seguros, escalables y robustos en Stellar/Soroban, basado en la documentación oficial de Stellar.

---

## 1. Seguridad

### 1.1 Autorización

**SIEMPRE** usar `require_auth()`:

```rust
pub fn buy_tokens(env: Env, buyer: Address, ...) -> Result<i128, Error> {
    buyer.require_auth();  // ✅ CRÍTICO
    // ... resto del código
}
```

**Beneficios automáticos de Soroban:**
- ✅ Protección contra replay attacks (sin necesidad de nonces)
- ✅ Account abstraction
- ✅ Soporte para multisig

### 1.2 Validación de Inputs

```rust
// ✅ CORRECTO - Validar ANTES de cambios de estado
pub fn create_token(...) -> Result<Address, Error> {
    validate_name(&name)?;
    validate_symbol(&symbol)?;
    validate_supply(initial_supply)?;

    // Ahora sí, cambiar estado
    storage::set_token_info(...);
}
```

### 1.3 Math Seguro

```rust
// ✅ CORRECTO - Usar checked arithmetic
let total = amount.checked_add(fee).ok_or(Error::Overflow)?;

// ❌ EVITAR - Puede causar overflow silencioso
let total = amount + fee;
```

### 1.4 Herramientas de Auditoría

Usar ANTES de mainnet:

1. **Scout: Bug Fighter** (CoinFabrik) - Análisis estático
2. **Certora Sunbeam** - Verificación formal
3. **Almanax** - Detección de vulnerabilidades con IA

**Comando:**
```bash
# Instalar Scout
cargo install cargo-scout-audit

# Ejecutar auditoría
cargo scout-audit
```

---

## 2. Compilación Correcta

### 2.1 Setup Inicial

```bash
# 1. Actualizar Rust (NECESITAS 1.84+)
rustup update

# 2. Agregar target wasm32v1-none (REQUERIDO)
rustup target add wasm32v1-none

# 3. Verificar
rustc --version  # Debe ser 1.84+
rustup target list | grep wasm32v1-none
```

### 2.2 Cargo.toml Óptimo

```toml
[package]
name = "sac-factory"
version = "0.1.0"
edition = "2021"
rust-version = "1.84"  # ✅ Especificar versión mínima

[lib]
crate-type = ["cdylib"]  # ✅ Para WebAssembly

[dependencies]
soroban-sdk = "23"

[profile.release]
opt-level = "z"          # ✅ Optimizar para tamaño
overflow-checks = true   # ✅ Mantener checks de seguridad
debug = 0
strip = "symbols"
debug-assertions = false
panic = "abort"         # ✅ CRÍTICO - Reduce 30% el tamaño
codegen-units = 1       # ✅ Mejor optimización
lto = true             # ✅ Link-time optimization
```

### 2.3 Proceso de Build

```bash
# 1. Build para WebAssembly
cargo build --target wasm32v1-none --release

# 2. Optimizar WASM (CRÍTICO para costos)
stellar contract optimize \
  --wasm target/wasm32v1-none/release/sac_factory.wasm

# 3. Inspeccionar
stellar contract inspect \
  --wasm target/wasm32v1-none/release/sac_factory.wasm

# 4. Verificar tamaño (debe ser < 256KB)
ls -lh target/wasm32v1-none/release/sac_factory.wasm
```

**⚠️ Diferencia Crítica:**
- `wasm32v1-none`: WebAssembly Core 1.0 (determinístico) ✅ USAR
- `wasm32-unknown-unknown`: Propuestas nuevas (no determinístico) ❌ EVITAR

---

## 3. Modularidad & Escalabilidad

### 3.1 Organización de Módulos

```rust
#![no_std]  // ✅ REQUERIDO

// ✅ PATRÓN CORRECTO - Separación de concerns
mod bonding_curve;   // Lógica de pricing
mod storage;         // Capa de persistencia
mod events;          // Definiciones de eventos
mod errors;          // Tipos de error
mod validation;      // Validación de inputs
mod token;           // Operaciones de tokens
```

**Beneficios:**
- ✅ Código reutilizable
- ✅ Testing aislado
- ✅ Fácil mantenimiento

### 3.2 Cargo Workspace (Múltiples Contratos)

```toml
# En root Cargo.toml
[workspace]
members = [
    "contracts/sac-factory",
    "contracts/amm-pair",
    "contracts/governance",
]
```

**Beneficios:**
- ✅ Dependencias compartidas
- ✅ Single `cargo test`
- ✅ Versionado consistente

### 3.3 Cross-Contract Calls

```rust
use soroban_sdk::contractimport;

// Importar contrato externo
contractimport!(
    file = "../amm-pair/target/wasm32v1-none/release/amm_pair.wasm"
);

// Usar cliente generado
let amm = AMMPairClient::new(&env, &amm_address);
let reserves = amm.get_reserves();
```

---

## 4. SAC (Stellar Asset Contracts)

### 4.1 Deployment de SAC

**Opción A: Asset Existente (CLI)**
```bash
stellar contract asset deploy \
  --source SECRET_KEY \
  --network testnet \
  --asset USDC:ISSUER_ADDRESS
```

**Opción B: Nuevo Token (In-Contract)**
```rust
use soroban_sdk::token;

// Durante graduation, deployar SAC real
pub fn graduate_token(env: Env, token: Address) -> Result<(), Error> {
    // 1. Deploy SAC
    let sac_address = deploy_stellar_asset_contract(&env, &issuer);

    // 2. Mint supply
    let sac_client = token::StellarAssetClient::new(&env, &sac_address);
    sac_client.mint(&recipient, &amount);

    // 3. Create AMM pair
    // 4. Lock liquidity
}
```

### 4.2 Interacción con SAC

```rust
use soroban_sdk::token;

// TokenClient - Funciones estándar (SEP-41)
let token = token::Client::new(&env, &token_address);
token.transfer(&from, &to, &amount);
token.balance(&account);

// StellarAssetClient - Funciones SAC específicas
let sac = token::StellarAssetClient::new(&env, &token_address);
sac.mint(&to, &amount);      // Solo admin
sac.burn(&from, &amount);
sac.set_admin(&new_admin);
```

### 4.3 Conversión de Unidades

```rust
// CRÍTICO: Stellar usa 7 decimales (stroops)
const STROOP_MULTIPLIER: i128 = 10_000_000;  // 10^7

// XLM a stroops
let xlm_amount = 100;
let stroops = xlm_amount * STROOP_MULTIPLIER;

// Stroops a XLM
let xlm = stroops / STROOP_MULTIPLIER;
```

---

## 5. Optimización de Performance

### 5.1 Minimizar Operaciones de Storage

```rust
// ❌ INEFICIENTE - Múltiples reads/writes
for i in 0..10 {
    let mut info = storage::get_token_info(&env, &token);
    info.count += 1;
    storage::set_token_info(&env, &token, &info);
}

// ✅ EFICIENTE - Single read/write
let mut token_info = storage::get_token_info(&env, &token)?;
for i in 0..10 {
    token_info.count += 1;
}
storage::set_token_info(&env, &token, &token_info);
```

### 5.2 Eventos vs Storage

```rust
// ❌ CARO - Guardar todo en storage
storage::set_trade_history(&env, &trade);

// ✅ BARATO - Emitir eventos (indexables)
events::trade_executed(&env, &trader, &amount, &price);
```

### 5.3 Batch Operations

```rust
// ❌ INEFICIENTE - Múltiples llamadas externas
for recipient in recipients {
    sac_client.transfer(&from, &recipient, &amount);
}

// ✅ EFICIENTE - Single transfer, distribute internamente
let total = recipients.len() as i128 * amount;
sac_client.transfer(&from, &contract_address, &total);
// Distribuir internamente (mucho más barato)
```

### 5.4 Medir Costos

```bash
# Simular transacción para ver costos
stellar contract invoke \
  --id CONTRACT_ID \
  --source SECRET \
  --fn buy_tokens \
  --arg ... \
  --rpc-url https://soroban-testnet.stellar.org:443 \
  --simulate  # ← Ver costos sin ejecutar
```

---

## 6. Constraints de Rust/Soroban

### 6.1 No Floating Point

```rust
// ✅ CORRECTO - Solo integers
let price: i128 = xlm_raised * PRECISION / tokens_sold;

// ❌ PROHIBIDO
let price: f64 = xlm_raised as f64 / tokens_sold as f64;
```

### 6.2 No Heap Allocation Ilimitado

```rust
// ✅ CORRECTO - Estructuras fijas
pub struct TokenInfo {
    creator: Address,
    supply: i128,
    // ... campos fijos
}

// ⚠️ CUIDADO - Puede crecer sin límite
let mut trades = Vec::new();
for trade in all_trades {  // Si all_trades es enorme...
    trades.push(trade);
}
```

### 6.3 No Standard I/O

```rust
// ✅ CORRECTO - Usar Soroban logging
env.logs().debug("Token created", ());

// ❌ PROHIBIDO
println!("Token created");
```

### 6.4 No Multi-threading

```rust
// ✅ Single-threaded (lo que ya tienes)

// ❌ PROHIBIDO
std::thread::spawn(|| { ... });
```

---

## 7. Checklist de Deployment

### Pre-Deployment

- [ ] Tests pasan: `cargo test --all`
- [ ] Build exitoso: `stellar contract build`
- [ ] WASM optimizado: `stellar contract optimize`
- [ ] Tamaño < 256KB
- [ ] Auditoría con Scout
- [ ] Verificación formal (Certora)
- [ ] Validaciones habilitadas
- [ ] Error handling completo
- [ ] Events en todas las funciones críticas

### Testnet Deployment

```bash
# 1. Deploy
CONTRACT_ID=$(stellar contract deploy \
  --wasm target/wasm32v1-none/release/sac_factory.wasm \
  --source SECRET_KEY \
  --network testnet)

# 2. Initialize
stellar contract invoke \
  --id $CONTRACT_ID \
  --source SECRET_KEY \
  --network testnet \
  -- initialize \
  --admin ADMIN_ADDRESS \
  --treasury TREASURY_ADDRESS

# 3. Test exhaustivamente
# - Crear tokens
# - Comprar/vender
# - Graduación
# - Edge cases
```

### Mainnet Deployment

- [ ] Testnet funcionando > 2 semanas
- [ ] Auditoría externa completa
- [ ] Bug bounty activo
- [ ] Documentación completa
- [ ] Plan de respuesta a incidentes
- [ ] Multisig para admin
- [ ] Time-locks para cambios críticos

---

## 8. Ventajas Únicas de Stellar

### 8.1 Multi-Currency Support

```rust
// Stellar permite pagos en cualquier asset
pub fn buy_with_usdc(
    env: Env,
    buyer: Address,
    token: Address,
    usdc_amount: i128,
) -> Result<i128, Error> {
    // Path payment: USDC → XLM → Token
    // TODO en 1 transacción!
}
```

### 8.2 Fiat On/Off Ramps

- 475,000+ puntos de acceso worldwide
- Direct fiat → Stellar sin exchanges
- USDC/EURC nativos (Circle, Visa)

### 8.3 Path Payments

```rust
// Usuario paga en USD, creador recibe EUR
// Conversión automática en 1 tx
path_payment_strict_receive(
    send_asset: USDC,
    destination: creator,
    dest_asset: EURC,
    dest_amount: 100
)
```

---

## 9. Referencias Oficiales

- **Overview**: https://developers.stellar.org/docs/build/smart-contracts/overview
- **Setup**: https://developers.stellar.org/docs/build/smart-contracts/getting-started/setup
- **Authorization**: https://developers.stellar.org/docs/learn/fundamentals/contract-development/authorization
- **SAC**: https://developers.stellar.org/docs/build/guides/tokens/stellar-asset-contract
- **Security Tools**: https://developers.stellar.org/docs/tools/developer-tools/security-tools
- **Cost Analysis**: https://developers.stellar.org/docs/build/guides/fees/analyzing-smart-contract-cost

---

## 10. Próximos Pasos para Este Proyecto

1. ✅ Solucionar build issues (Rust 1.84+)
2. ⏳ Compilar todos los contratos
3. ⏳ Optimizar WASM binaries
4. ⏳ Habilitar validaciones en producción
5. ⏳ Implementar SAC migration en graduate_token()
6. ⏳ Tests exhaustivos
7. ⏳ Auditoría de seguridad
8. ⏳ Deployment a testnet
9. ⏳ 2+ semanas de testing
10. ⏳ Auditoría externa
11. ⏳ Mainnet launch

---

**Recuerda:** La seguridad y robustez son más importantes que la velocidad de lanzamiento. Sigue este checklist religiosamente.
