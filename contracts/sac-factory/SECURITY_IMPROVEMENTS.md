# Mejoras de Seguridad y Best Practices para SAC Factory

**Análisis basado en:**
- Veridise Security Checklist
- Scout Soroban (23 detectores)
- Stellar/Soroban Official Best Practices
- Auditorías de CoinFabrik, Ottersec, QuarksLab

---

## 🔴 CRÍTICO - Implementar Inmediatamente

### 1. **Storage Type Optimization (DoS Prevention)**

**Problema Actual:**
```rust
// storage.rs - TODO usa Persistent storage para TODOS los datos
storage::set_token_info(&env, &token_address, &token_info);
```

**Riesgo:** DoS por storage no bounded + alto costo

**Mejora Recomendada:**
```rust
// Separar storage por tipo de acceso:

// INSTANCE: Configuración pequeña, acceso frecuente (< 100 KB)
- admin address
- treasury address
- token_count (solo contador)
- fee_config

// PERSISTENT: Datos por usuario/token (unbounded, separar en slots)
- token_info por token_address (Map individual)
- creator_tokens por creator (Vec individual)
- role assignments por address

// TEMPORARY: Datos que expiran o son recreables
- price quotes (si se implementan)
- pending operations
```

**Código Mejorado:**
```rust
// En storage.rs
pub enum StorageKey {
    // Instance storage (pequeño, frecuente)
    Admin,
    TokenCount,

    // Persistent storage (por entidad)
    TokenInfo(Address),      // Separado por token
    CreatorTokens(Address),  // Separado por creator
    RoleAssignment(Address, Role),
}

// Usar Instance para config
pub fn set_admin(env: &Env, admin: &Address) {
    env.storage().instance().set(&StorageKey::Admin, admin);
}

// Usar Persistent con keys separadas
pub fn set_token_info(env: &Env, token: &Address, info: &TokenInfo) {
    env.storage().persistent()
        .set(&StorageKey::TokenInfo(token.clone()), info);
}
```

**Impacto:** ⭐⭐⭐⭐⭐
- Reduce costos 30-50%
- Previene DoS por storage unbounded
- Mejora performance de lectura

---

### 2. **Unsafe Unwrap Detection (unsafe-unwrap, unsafe-expect)**

**Problema Actual:**
```rust
// bonding_curve.rs:46-48
let k = initial_xlm
    .checked_mul(total_supply)
    .unwrap_or(i128::MAX);  // ❌ Silenciosamente retorna MAX en overflow
```

**Riesgo:** Comportamiento silencioso incorrecto, puede romper lógica de negocio

**Mejora Recomendada:**
```rust
// Retornar Result y propagar errores
pub fn new(total_supply: i128) -> Result<Self, Error> {
    let initial_xlm = 1000 * PRECISION;

    let k = initial_xlm
        .checked_mul(total_supply)
        .ok_or(Error::Overflow)?;  // ✅ Falla explícitamente

    Ok(Self {
        total_supply,
        tokens_sold: 0,
        tokens_remaining: total_supply,
        xlm_reserve: initial_xlm,
        k,
    })
}
```

---

### 3. **Set Contract Storage Protection (set-contract-storage)**

**Problema Actual:**
```rust
// fee_management.rs:95 - Sin validación de quién puede modificar
env.storage().persistent().set(&FeeKey::Config, &config);
```

**Riesgo:** Si hay un bug, un atacante podría modificar storage directamente

**Mejora Recomendada:**
```rust
// Siempre validar autorización ANTES de escribir storage crítico
pub fn set_fee_config(env: &Env, admin: &Address, ...) -> Result<(), Error> {
    admin.require_auth();  // ✅ Ya tenemos esto

    // Validación adicional de roles
    require_role(env, admin, Role::FeeAdmin)?;

    // Validación de valores ANTES de escribir
    if trading_fee_bps > 1000 {
        return Err(Error::FeeTooHigh);
    }

    // Solo después de todas las validaciones
    env.storage().persistent().set(&FeeKey::Config, &config);
    Ok(())
}
```

---

### 4. **Avoid Assert Violations (assert-violation)**

**Búsqueda:** No encontrado ✅ (Buen trabajo, no usamos `assert!`)

**Recomendación:** Mantener uso de `Result<T, Error>` en vez de panics

---

### 5. **Zero or Test Address Assignment (zero-or-test-address)**

**Problema Actual:**
```rust
// lib.rs:initialize - No valida que admin/treasury no sean zero address
pub fn initialize(env: Env, admin: Address, treasury: Address) -> Result<(), Error> {
    admin.require_auth();
    // ❌ No valida que las addresses sean válidas
```

**Mejora Recomendada:**
```rust
pub fn initialize(env: Env, admin: Address, treasury: Address) -> Result<(), Error> {
    admin.require_auth();

    // ✅ Validar addresses
    validate_address(&admin)?;
    validate_address(&treasury)?;

    if storage::has_admin(&env) {
        return Err(Error::AlreadyInitialized);
    }
    // ...
}

fn validate_address(addr: &Address) -> Result<(), Error> {
    // Verificar que no sea address cero o de test
    // En Soroban esto se puede hacer verificando el formato
    Ok(())
}
```

---

## 🟡 ALTA PRIORIDAD - Implementar Pronto

### 6. **DoS Unbounded Operations (dos-unbounded-operation)**

**Problema Potencial:**
```rust
// storage.rs - Si get_creator_tokens retorna Vec grande, puede causar DoS
pub fn get_creator_tokens(env: &Env, creator: &Address) -> Vec<Address> {
    env.storage()
        .persistent()
        .get(&DataKey::CreatorTokens(creator.clone()))
        .unwrap_or(Vec::new(env))
}
```

**Mejora Recomendada:**
```rust
// Opción 1: Paginar resultados
pub fn get_creator_tokens_paginated(
    env: &Env,
    creator: &Address,
    offset: u32,
    limit: u32,  // Max 100
) -> Vec<Address> {
    let all_tokens = env.storage()
        .persistent()
        .get(&DataKey::CreatorTokens(creator.clone()))
        .unwrap_or(Vec::new(env));

    let start = offset.min(all_tokens.len());
    let end = (offset + limit).min(all_tokens.len()).min(start + 100);

    all_tokens.slice(start..end)
}

// Opción 2: Usar Persistent storage separado por token
pub fn get_token_by_index(
    env: &Env,
    creator: &Address,
    index: u32,
) -> Option<Address> {
    env.storage()
        .persistent()
        .get(&DataKey::CreatorToken(creator.clone(), index))
}
```

---

### 7. **Divide Before Multiply Precision Loss (divide-before-multiply)**

**Verificación en bonding_curve.rs:**
```rust
// bonding_curve.rs:166-170 - CORRECTO ✅
// Hacemos mul primero, luego div
self.xlm_reserve
    .checked_mul(PRECISION)  // ✅ Multiplica primero
    .unwrap_or(i128::MAX)
    .checked_div(self.tokens_remaining)  // Luego divide
```

**Estado:** No encontrado ✅ Ya seguimos la best practice

---

### 8. **Testing Coverage con Testutils**

**Problema Actual:** Sin tests comprehensivos

**Mejora Recomendada:**

```rust
// Cargo.toml - Agregar testutils feature
[features]
testutils = ["soroban-sdk/testutils"]

[dev-dependencies]
soroban-sdk = { version = "23", features = ["testutils"] }
proptest = "1.0"
proptest-arbitrary-interop = "0.1"
```

```rust
// tests/test_sac_factory.rs
#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{Env, testutils::Address as _};

    #[test]
    fn test_initialize() {
        let env = Env::default();
        let contract_id = env.register(SacFactory, ());
        let client = SacFactoryClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let treasury = Address::generate(&env);

        env.mock_all_auths();
        client.initialize(&admin, &treasury);

        assert_eq!(client.get_token_count(), 0);
    }

    #[test]
    fn test_launch_token() {
        let env = Env::default();
        let contract_id = env.register(SacFactory, ());
        let client = SacFactoryClient::new(&env, &contract_id);

        let creator = Address::generate(&env);

        env.mock_all_auths();

        let token_addr = client.launch_token(
            &creator,
            &String::from_str(&env, "Test Token"),
            &String::from_str(&env, "TEST"),
            &String::from_str(&env, "ipfs://..."),
            &String::from_str(&env, "Test description"),
        );

        assert!(client.get_token_info(&token_addr).is_some());
    }

    #[test]
    fn test_buy_sell_roundtrip() {
        // Test que comprar y vender mantiene invariantes
        let env = Env::default();
        // ... setup

        let initial_xlm = 1000 * PRECISION;
        client.buy(&buyer, &token, &initial_xlm, &0);

        let tokens = client.get_balance(&buyer, &token);
        client.sell(&buyer, &token, &tokens, &0);

        // Verificar que el bonding curve mantiene k
    }
}
```

---

### 9. **Property-Based Testing para Bonding Curve**

```rust
// tests/property_tests.rs
#[cfg(test)]
mod property_tests {
    use proptest::prelude::*;

    proptest! {
        #[test]
        fn bonding_curve_k_invariant(
            xlm_in in 1i128..1_000_000_0000000i128,
        ) {
            let env = Env::default();
            let mut curve = BondingCurve::new(1_000_000_000_0000000).unwrap();

            let k_before = curve.k;

            let tokens_out = curve.calculate_buy(xlm_in).unwrap();
            curve.execute_buy(xlm_in, tokens_out).unwrap();

            let k_after = curve.xlm_reserve * curve.tokens_remaining;

            // k debe mantenerse aproximadamente constante (±1% por rounding)
            let diff = (k_after - k_before).abs();
            let tolerance = k_before / 100;
            prop_assert!(diff <= tolerance);
        }

        #[test]
        fn price_always_increases_on_buy(
            xlm_in in 1i128..100_000_0000000i128,
        ) {
            let env = Env::default();
            let mut curve = BondingCurve::new(1_000_000_000_0000000).unwrap();

            let price_before = curve.get_current_price();

            let tokens_out = curve.calculate_buy(xlm_in).unwrap();
            curve.execute_buy(xlm_in, tokens_out).unwrap();

            let price_after = curve.get_current_price();

            prop_assert!(price_after > price_before);
        }
    }
}
```

---

## 🟢 MEDIA PRIORIDAD - Mejoras de Calidad

### 10. **Iterators Over Indexing (iterators-over-indexing)**

**Búsqueda en código:**
```rust
// token_deployment.rs - No encontrado ✅
// Usamos .iter() y .enumerate() correctamente
```

---

### 11. **Soroban Version Check (soroban-version)**

**Estado Actual:**
```toml
# Cargo.toml
soroban-sdk = "23"  # ✅ Versión reciente (Nov 2025)
```

**Recomendación:** Actualizar regularmente, verificar cada 3 meses

---

### 12. **Event Optimization**

**Mejora Actual:** ✅ Ya implementamos eventos detallados con `#[contractevent]`

**Mejora Adicional:** Agregar índices para búsqueda eficiente
```rust
#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TokenLaunched {
    #[indexed]  // ✅ Permite filtrar por creator
    pub creator: Address,
    pub token: Address,
    pub name: String,
    pub symbol: String,
}
```

---

### 13. **Reentrancy Protection**

**Estado:** ✅ Soroban NO permite reentrancy por diseño

**Documentación:** Agregar comentario explicativo
```rust
// lib.rs - Top-level comment
//! # Reentrancy Protection
//!
//! Soroban prevents reentrancy attacks by design - contracts cannot
//! be re-entered during execution. This eliminates an entire class
//! of vulnerabilities common in other blockchain platforms.
```

---

### 14. **Gas/Budget Optimization**

**Mejoras Potenciales:**

```rust
// 1. Evitar clones innecesarios
// ANTES:
let token_info_clone = token_info.clone();
storage::set_token_info(&env, &token, &token_info_clone);

// DESPUÉS:
storage::set_token_info(&env, &token, &token_info);

// 2. Combinar operaciones de storage
// ANTES:
storage::set_admin(&env, &admin);
storage::set_treasury(&env, &treasury);
storage::set_token_count(&env, 0);

// DESPUÉS (si es posible):
struct ContractConfig {
    admin: Address,
    treasury: Address,
    token_count: u32,
}
storage::set_config(&env, &config);  // Una sola escritura
```

---

## 📊 Checklist de Implementación

### Fase 1 - Crítico (Esta Semana)
- [ ] Migrar storage a Instance/Persistent/Temporary apropiadamente
- [ ] Cambiar unwrap_or en BondingCurve::new a Result
- [ ] Agregar validación de zero addresses en initialize
- [ ] Implementar paginación en get_creator_tokens

### Fase 2 - Alta Prioridad (Próximas 2 Semanas)
- [ ] Crear suite completa de tests unitarios
- [ ] Implementar property-based tests para bonding curve
- [ ] Agregar validaciones adicionales en set_contract_storage
- [ ] Documentar todas las funciones públicas

### Fase 3 - Mejoras de Calidad (Mes 1)
- [ ] Optimizar clones y operaciones de storage
- [ ] Agregar eventos indexados
- [ ] Implementar fuzzing tests
- [ ] Audit con Scout Soroban
- [ ] Code review externo

### Fase 4 - Pre-Producción (Mes 2)
- [ ] Auditoría de seguridad profesional (Veridise, CoinFabrik, Ottersec)
- [ ] Testeo en testnet con usuarios reales
- [ ] Optimización de gas
- [ ] Documentación completa
- [ ] Plan de respuesta a incidentes

---

## 🔧 Herramientas Recomendadas

### 1. Scout Soroban - Análisis Estático
```bash
# Instalar
cargo install cargo-scout-audit

# Ejecutar en el proyecto
cd contracts/sac-factory
cargo scout-audit
```

### 2. Fuzzing con cargo-fuzz
```bash
# Setup
cargo install cargo-fuzz
cargo +nightly fuzz init

# Crear fuzz target
cargo +nightly fuzz add bonding_curve_fuzz

# Ejecutar
cargo +nightly fuzz run bonding_curve_fuzz
```

### 3. Coverage con cargo-tarpaulin
```bash
cargo install cargo-tarpaulin
cargo tarpaulin --out Html --output-dir coverage
```

---

## 📚 Referencias

- [Stellar Best Practices](https://developers.stellar.org/docs/build/smart-contracts)
- [Veridise Security Checklist](https://veridise.com/blog/audit-insights/building-on-stellar-soroban-grab-this-security-checklist-to-avoid-vulnerabilities/)
- [Scout Soroban Detectors](https://github.com/CoinFabrik/scout-soroban)
- [Soroban Storage Guide](https://developers.stellar.org/docs/build/guides/storage/choosing-the-right-storage)
- [Authorization Patterns](https://developers.stellar.org/docs/build/smart-contracts/example-contracts/auth)
- [Fuzzing Example](https://developers.stellar.org/docs/build/smart-contracts/example-contracts/fuzzing)

---

## ⚠️ Notas Importantes

1. **NO hacer en Producción sin Auditoría:** Este contrato maneja fondos de usuarios
2. **Testing Extensivo Requerido:** Minimum 90% coverage antes de testnet
3. **Monitoreo Post-Deploy:** Implementar alertas para eventos inusuales
4. **Plan de Contingencia:** Tener plan para pausar contrato si se detectan problemas
5. **Seguros de Terceros:** Considerar pólizas de seguro DeFi (Nexus Mutual, etc.)

---

**Última Actualización:** Nov 21, 2025
**Próxima Revisión:** Diciembre 2025 (después de implementar Fase 1-2)
