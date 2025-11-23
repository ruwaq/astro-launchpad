# 🛡️ Soroban Smart Contract Best Practices 2025
## Guía Completa para DeFi en Stellar

> Investigación basada en Soroswap, Stellar oficial examples, Veridise audits, y Soroban Security Audit Bank

---

## 📚 Tabla de Contenidos

1. [Arquitectura de Contratos](#arquitectura-de-contratos)
2. [Patrones de Diseño](#patrones-de-diseño)
3. [Storage Best Practices](#storage-best-practices)
4. [Security Checklist](#security-checklist)
5. [Testing & Fuzzing](#testing--fuzzing)
6. [Referencias y Ejemplos](#referencias-y-ejemplos)

---

## 🏗️ Arquitectura de Contratos

### Patrón Factory + Pair (Recomendado para AMM)

Basado en **Soroswap** (UniswapV2 para Soroban):

```
SoroswapFactory (1)
    ↓
    Creates & Maintains Registry
    ↓
SoroswapPair Contracts (N)
    ↓
    Each Pair: Manages Liquidity Pool + AMM Logic
    ↓
SoroswapRouter (1)
    ↓
    User-Facing Operations (Swap, Add/Remove Liquidity)
```

#### **Contratos Core:**

1. **Factory Contract**
   - Crea nuevos Pair contracts
   - Mantiene registro de todos los pares
   - Gestiona configuración global (fees, admin)
   - Una única instancia desplegada

2. **Pair Contract**
   - Una instancia por cada par único de tokens
   - Implementa fórmula de producto constante (x * y = k)
   - Gestiona liquidez del pool
   - Implementa Stellar Token Interface

3. **Router Contract**
   - Abstrae complejidad de interacción con pares
   - Maneja swaps (input/output exactos)
   - Gestiona adición/remoción de liquidez
   - Multi-hop routing

#### **Ventajas del Patrón:**

✅ **Modularidad**: Cada par opera independientemente
✅ **Escalabilidad**: Pares creados on-demand
✅ **Discoverability**: Registro central vía Factory
✅ **Separation of Concerns**: Router (UI) vs Pair (Logic)

---

## 🎨 Patrones de Diseño

### 1. Token Interface Implementation

**Todos los tokens deben implementar Stellar Token Interface:**

```rust
use soroban_sdk::{contract, contractimpl, Address, Env, String, symbol_short};

#[contract]
pub struct TokenContract;

#[contractimpl]
impl TokenContract {
    // Token Interface methods
    pub fn allowance(env: Env, from: Address, spender: Address) -> i128;
    pub fn approve(env: Env, from: Address, spender: Address, amount: i128, expiration_ledger: u32);
    pub fn balance(env: Env, id: Address) -> i128;
    pub fn transfer(env: Env, from: Address, to: Address, amount: i128);
    pub fn transfer_from(env: Env, spender: Address, from: Address, to: Address, amount: i128);

    // Token metadata
    pub fn decimals(env: Env) -> u32;
    pub fn name(env: Env) -> String;
    pub fn symbol(env: Env) -> String;
}
```

**Referencia:** `soroban-examples/token`

### 2. Initialization Pattern

```rust
pub fn initialize(env: Env, admin: Address, treasury: Address) {
    // Verificar que no esté ya inicializado
    if env.storage().instance().has(&DataKey::Initialized) {
        panic!("Already initialized");
    }

    // Guardar configuración
    env.storage().instance().set(&DataKey::Admin, &admin);
    env.storage().instance().set(&DataKey::Treasury, &treasury);
    env.storage().instance().set(&DataKey::Initialized, &true);

    // Extend TTL
    env.storage().instance().extend_ttl(INSTANCE_LIFETIME_THRESHOLD, INSTANCE_BUMP_AMOUNT);
}
```

### 3. Access Control Pattern

```rust
fn require_admin(env: &Env) {
    let admin: Address = env.storage()
        .instance()
        .get(&DataKey::Admin)
        .expect("Admin not set");

    admin.require_auth();
}

pub fn set_fee(env: Env, new_fee: u32) {
    require_admin(&env);

    if new_fee > MAX_FEE {
        panic!("Fee too high");
    }

    env.storage().instance().set(&DataKey::Fee, &new_fee);
}
```

### 4. Event Emission

```rust
use soroban_sdk::contracttype;

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TokenCreatedEvent {
    pub token_id: BytesN<32>,
    pub creator: Address,
    pub name: String,
    pub symbol: String,
}

pub fn create_token(env: Env, name: String, symbol: String) -> Address {
    let creator = env.invoker();

    // ... creation logic ...

    // Emit event
    env.events().publish((symbol_short!("create"),), TokenCreatedEvent {
        token_id,
        creator: creator.clone(),
        name,
        symbol,
    });

    token_address
}
```

---

## 💾 Storage Best Practices

Soroban tiene **3 tipos de storage**, cada uno optimizado para casos específicos:

### 1. **Instance Storage** 🔹

**Uso:** Datos pequeños asociados directamente al contrato

**Casos de Uso:**
- Admin address
- Configuración del contrato
- Tokens que opera el contrato
- Flags de inicialización

**Límites:**
- Tamaño máximo: ~100 KB serializado
- Se carga CADA VEZ que se invoca el contrato

**⚠️ NO USAR PARA:**
- Datos que escalan sin límite (balances de usuarios)
- Vectores/Maps que crecen con usuarios
- Cualquier dato unbounded

```rust
// ✅ CORRECTO - Instance Storage
env.storage().instance().set(&DataKey::Admin, &admin);
env.storage().instance().set(&DataKey::Fee, &300); // 0.3%

// ❌ INCORRECTO - DoS vulnerability!
let mut users = env.storage().instance().get::<_, Vec<Address>>(&DataKey::AllUsers).unwrap();
users.push_back(new_user); // Vector crece sin límite!
env.storage().instance().set(&DataKey::AllUsers, &users);
```

### 2. **Persistent Storage** 🔸

**Uso:** Datos que necesitan persistir a largo plazo

**Casos de Uso:**
- Balances de usuarios (uno por usuario)
- Metadata de tokens
- Decisiones de governance
- Pool reserves
- Cualquier dato que debe existir "forever"

**Best Practice:** **Distribuir datos en slots separados**

```rust
// ✅ CORRECTO - Cada balance en su slot
pub fn set_balance(env: Env, addr: Address, amount: i128) {
    let key = DataKey::Balance(addr.clone());
    env.storage().persistent().set(&key, &amount);
}

// ❌ INCORRECTO - Un solo Map con todos los balances
let mut all_balances = env.storage().persistent()
    .get::<_, Map<Address, i128>>(&DataKey::AllBalances)
    .unwrap();
all_balances.set(addr, amount); // Map crece hasta límite de 64KB!
```

**TTL Management:**

```rust
const BALANCE_LIFETIME_THRESHOLD: u32 = 518400;  // ~30 days
const BALANCE_BUMP_AMOUNT: u32 = 1036800;        // ~60 days

env.storage().persistent().extend_ttl(
    &key,
    BALANCE_LIFETIME_THRESHOLD,
    BALANCE_BUMP_AMOUNT
);
```

### 3. **Temporary Storage** 🔻

**Uso:** Datos de corta duración o fácilmente recreables

**Casos de Uso:**
- Datos de oracle
- Balances reclamables temporales
- Ofertas con expiración
- Cache temporal

**Ventajas:**
- Más económico que Persistent
- Auto-limpieza después de TTL

```rust
// Temporary storage para oracle data
pub fn set_price(env: Env, asset: String, price: i128) {
    let key = DataKey::Price(asset);
    env.storage().temporary().set(&key, &price);

    // TTL más corto para datos temporales
    env.storage().temporary().extend_ttl(&key, 17280, 34560); // ~1-2 días
}
```

### Tabla de Decisión de Storage

| Tipo de Dato | Storage Type | Razón |
|--------------|--------------|-------|
| Admin address | Instance | Pequeño, acceso frecuente |
| Contract config | Instance | Pequeño, inmutable |
| User balances | Persistent (distribuido) | Unbounded, crítico |
| Pool reserves | Persistent | Crítico, long-term |
| Token metadata | Persistent | Inmutable, long-term |
| Oracle prices | Temporary | Short-lived, recreable |
| Active offers | Temporary | Expiran naturalmente |
| Lista de todos los usuarios | ❌ NUNCA | DoS risk! |

---

## 🛡️ Security Checklist

### Vulnerabilities Soroban-Specific

#### 1. **Storage DoS Attack** 🔴 CRÍTICO

**Problema:** Almacenar datos unbounded en Instance/Persistent Storage

```rust
// ❌ VULNERABLE
pub fn add_user(env: Env, user: Address) {
    let mut all_users: Vec<Address> = env.storage()
        .instance()
        .get(&DataKey::AllUsers)
        .unwrap_or(Vec::new(&env));

    all_users.push_back(user); // Vector crece infinitamente!
    env.storage().instance().set(&DataKey::AllUsers, &all_users);
    // Cuando alcanza 64KB → Contract fails permanently!
}

// ✅ SEGURO - Usar Persistent con keys separadas
pub fn register_user(env: Env, user: Address) {
    let key = DataKey::User(user.clone());
    env.storage().persistent().set(&key, &true);
}

// Query users via indexer, NO desde contrato
```

#### 2. **Type Conversion Validation** 🟡 MEDIO

**Problema:** Vec/Map a Val sin validación puede causar panics

```rust
// ❌ VULNERABLE
pub fn store_data(env: Env, data: Vec<u8>) {
    // Se convierte a Val y se guarda sin validar
    env.storage().persistent().set(&DataKey::Data, &data);
}

pub fn get_data(env: Env) -> Vec<u8> {
    // Si data está corrupto, panic aquí!
    env.storage().persistent().get(&DataKey::Data).unwrap()
}

// ✅ SEGURO - Validar antes de guardar
pub fn store_data(env: Env, data: Vec<u8>) {
    if data.len() > MAX_DATA_SIZE {
        panic_with_error!(&env, Error::DataTooLarge);
    }

    // Validar que se puede convertir correctamente
    let val: Val = data.to_val();
    env.storage().persistent().set(&DataKey::Data, &val);
}
```

#### 3. **Dependency Versioning** 🟡 MEDIO

**Problema:** `createimport!` no valida versiones de contratos importados

```rust
// ⚠️ RIESGO
mod token {
    soroban_sdk::contractimport!(
        file = "../../target/wasm32-unknown-unknown/release/token.wasm"
    );
}

// Solución:
// - Pin contract IDs en tests
// - Usar contract address registry
// - Validar versiones en initialize()
```

#### 4. **Reentrancy** ✅ NO POSIBLE

**Soroban NO permite reentrancy attacks** por diseño fundamental.

> "Basic vulnerabilities like reentrancy attacks are simply not possible on Stellar" - Veridise

Pero aún así, seguir el patrón **Checks-Effects-Interactions**:

```rust
pub fn withdraw(env: Env, user: Address, amount: i128) {
    user.require_auth();

    // 1. CHECKS
    let balance = get_balance(&env, &user);
    if balance < amount {
        panic_with_error!(&env, Error::InsufficientBalance);
    }

    // 2. EFFECTS - Actualizar estado ANTES de external calls
    set_balance(&env, &user, balance - amount);

    // 3. INTERACTIONS - External calls AL FINAL
    transfer_token(&env, &user, amount);
}
```

#### 5. **Integer Overflow** ✅ RUST PROTEGE

Rust detecta overflows en modo debug, pero usa `checked_*` en prod:

```rust
// ✅ SEGURO
pub fn add_liquidity(env: Env, amount0: i128, amount1: i128) {
    let reserve0 = get_reserve0(&env);
    let reserve1 = get_reserve1(&env);

    // Usar checked operations
    let new_reserve0 = reserve0.checked_add(amount0)
        .expect("Reserve0 overflow");
    let new_reserve1 = reserve1.checked_add(amount1)
        .expect("Reserve1 overflow");

    set_reserves(&env, new_reserve0, new_reserve1);
}
```

#### 6. **State Archival Handling** 🟡 MEDIO

**Problema:** Datos archived pueden no existir cuando se esperan

```rust
// ❌ VULNERABLE - Asume que data siempre existe
pub fn get_balance(env: &Env, user: &Address) -> i128 {
    env.storage().persistent()
        .get(&DataKey::Balance(user.clone()))
        .unwrap() // Panic si está archived!
}

// ✅ SEGURO - Manejar caso archived
pub fn get_balance(env: &Env, user: &Address) -> i128 {
    env.storage().persistent()
        .get(&DataKey::Balance(user.clone()))
        .unwrap_or(0) // Return 0 si no existe
}

// O restaurar data automáticamente (costo gas)
pub fn get_balance_with_restore(env: &Env, user: &Address) -> i128 {
    let key = DataKey::Balance(user.clone());

    if !env.storage().persistent().has(&key) {
        // Restaurar desde archive si es necesario
        // (usuario paga rent)
        return 0;
    }

    // Extend TTL cuando se accede
    env.storage().persistent().extend_ttl(
        &key,
        BALANCE_LIFETIME_THRESHOLD,
        BALANCE_BUMP_AMOUNT
    );

    env.storage().persistent().get(&key).unwrap_or(0)
}
```

---

## 🧪 Testing & Fuzzing

### Unit Testing

```rust
#[cfg(test)]
mod test {
    use super::*;

    #[test]
    fn test_swap() {
        let env = Env::default();
        let contract_id = env.register_contract(None, PairContract);
        let client = PairContractClient::new(&env, &contract_id);

        // Setup
        let token_a = create_token(&env, "Token A", "TKA");
        let token_b = create_token(&env, "Token B", "TKB");

        client.initialize(&admin, &token_a, &token_b, &30); // 0.3% fee

        // Test swap
        let amount_in = 1_000_000;
        let amount_out = client.swap(&user, &token_a, &amount_in, &0);

        assert!(amount_out > 0);
    }

    #[test]
    #[should_panic(expected = "InsufficientLiquidity")]
    fn test_swap_fails_without_liquidity() {
        // Test error cases
    }
}
```

### Fuzzing Best Practices

**Usar `panic_with_error!` en lugar de `panic!`:**

```rust
// ❌ MAL - Fuzzer trata como bug
if amount == 0 {
    panic!("Amount cannot be zero");
}

// ✅ BIEN - Fuzzer entiende que es error esperado
if amount == 0 {
    panic_with_error!(&env, Error::InvalidAmount);
}
```

**Referencia:** `soroban-examples/fuzzing`, `increment_with_fuzz`

### Budget Testing

```bash
# Medir CPU/Memory usage
cargo test budget -- --nocapture

# En tests:
println!("{}", env.budget());
```

---

## 📖 Referencias y Ejemplos

### Ejemplos Oficiales Relevantes para DeFi

**Repositorio:** https://github.com/stellar/soroban-examples

#### 🔥 Más Relevantes:

1. **`token`** - Token contract implementando Token Interface
   - Base para cualquier token custom
   - Muestra approval, transfer, burn, mint

2. **`liquidity_pool`** - Pool minimalista + swap
   - Implementación básica de AMM
   - Fórmula de producto constante
   - Add/remove liquidity

3. **`atomic_swap`** - Swap atómico entre dos partes
   - Útil para OTC trades
   - Hash time-locked contracts

4. **`mint-lock`** - Minting con autorización
   - Muestra cómo controlar minting
   - Useful para token factory

5. **`timelock`** - Contratos con time-locks
   - Governance delays
   - Vesting schedules

#### Soroswap (Producción)

**Repositorio:** https://github.com/soroswap/core

- Factory + Pair + Router completo
- Implementación de Uniswap V2
- Audited por OtterSec
- **Live en Mainnet**

**Contratos:**
- `SoroswapFactory.wasm`
- `SoroswapPair.wasm`
- `SoroswapRouter.wasm`
- `SoroswapLibrary.wasm`

### Documentación Oficial

- **Stellar Docs:** https://developers.stellar.org/docs/build/smart-contracts
- **Soroban SDK:** https://docs.rs/soroban-sdk/latest/soroban_sdk/
- **Storage Guide:** https://developers.stellar.org/docs/build/guides/storage/choosing-the-right-storage
- **Soroswap Docs:** https://docs.soroswap.finance

### Security Resources

- **Veridise Audit Insights:** https://veridise.com/blog/audit-insights/
- **Soroban Security Audit Bank:** https://stellar.org/grants-and-funding/soroban-audit-bank
- **Security Checklist:** https://veridise.com/blog/audit-insights/building-on-stellar-soroban-grab-this-security-checklist-to-avoid-vulnerabilities/

---

## 🎯 Recomendaciones para AstroShibaPop

### 1. Arquitectura de Contratos

Implementar siguiendo el patrón Soroswap:

```
TokenFactory (1)
    ↓
    Creates Meme Tokens (N)
    ↓
AMMFactory (1) ← Usa Soroswap o deploy propio
    ↓
    Creates Pairs (N)
    ↓
AMMRouter (1)
    ↓
    User swaps, liquidity
```

### 2. Token Factory Design

```rust
pub struct TokenFactory;

#[contractimpl]
impl TokenFactory {
    // Initialize factory
    pub fn initialize(env: Env, admin: Address, treasury: Address);

    // Create new meme token
    pub fn create_token(
        env: Env,
        creator: Address,
        name: String,
        symbol: String,
        total_supply: i128,
        metadata_uri: String,
    ) -> Address;

    // Bonding curve buy
    pub fn buy(env: Env, token_id: Address, amount: i128) -> i128;

    // Bonding curve sell
    pub fn sell(env: Env, token_id: Address, amount: i128) -> i128;

    // Graduate to AMM when threshold reached
    pub fn graduate(env: Env, token_id: Address);
}
```

### 3. Storage Strategy

- **Instance:** Admin, treasury, fee_percent, graduate_threshold
- **Persistent (distributed):** Token metadata (key por token), creator info
- **Temporary:** NO usar (tokens persisten forever)

### 4. Security Priorities

1. ✅ Auditar antes de mainnet (Soroban Audit Bank)
2. ✅ Implementar fuzzing tests
3. ✅ NO guardar arrays unbounded
4. ✅ Validar todos los inputs
5. ✅ Usar checked arithmetic
6. ✅ Emit events para indexer

---

**¿Listo para revisar/mejorar los contratos existentes?** 🚀
