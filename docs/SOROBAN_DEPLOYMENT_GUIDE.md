# Soroban Contract Deployment & Best Practices Guide

> Guía completa para el deployment de contratos Soroban basada en documentación oficial de Stellar

## 📋 Tabla de Contenidos

1. [Pre-requisitos](#pre-requisitos)
2. [Build & Testing](#build--testing)
3. [Contract Deployment](#contract-deployment)
4. [Frontend Integration](#frontend-integration)
5. [Monitoring & Error Handling](#monitoring--error-handling)
6. [Security Checklist](#security-checklist)
7. [Performance Optimization](#performance-optimization)

---

## Pre-requisitos

### Rust Toolchain Setup

```bash
# Instalar Rustup (si no está instalado)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Instalar Rust stable y nightly
rustup install stable
rustup +stable target add wasm32v1-none

rustup install nightly
rustup +nightly target add wasm32v1-none

# Instalar herramientas de desarrollo
cargo install --locked cargo-hack
```

### Stellar CLI

```bash
# Verificar versión instalada
stellar --version
soroban --version

# Verificar que Rust tenga el target wasm32
rustup target list | grep wasm32
```

---

## Build & Testing

### 1. Build del Contrato

```bash
# Build con profile optimizado
CARGO_PROFILE_RELEASE_WITHOUT_LTO_OFF=
CARGO_PROFILE_RELEASE_WITHOUT_LTO_DEBUG=false
CARGO_PROFILE_RELEASE_WITHOUT_LTO_LTO=false

make build
```

### 2. Inspeccionar WASM Metadata

```bash
# Inspeccionar env-meta del contrato
stellar contract info env-meta --wasm target/wasm32-unknown-unknown/release/your_contract.wasm

# Inspeccionar contract meta (versión SDK, etc.)
stellar contract info meta --wasm target/wasm32-unknown-unknown/release/your_contract.wasm
```

**Por qué es importante**: Verificar que el SDK meta está correctamente embebido en el WASM previene problemas de compatibilidad en runtime.

### 3. Testing Strategy

```bash
# Ejecutar todos los tests
make test

# Watch mode para desarrollo continuo
make watch

# Format code antes de commit
make fmt
```

### Estructura de Test Recomendada

```rust
use soroban_sdk::{contract, contractimpl, vec, symbol_short, Env, Symbol, Vec};

#[contract]
pub struct YourContract;

#[contractimpl]
impl YourContract {
    pub fn your_function(env: Env, param: Symbol) -> Vec<Symbol> {
        vec![&env, symbol_short!("Result"), param]
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_your_function() {
        let env = Env::default();
        let contract_id = env.register(YourContract, ());
        let client = YourContractClient::new(&env, &contract_id);

        let result = client.your_function(&symbol_short!("Test"));

        assert_eq!(
            result,
            vec![&env, symbol_short!("Result"), symbol_short!("Test")]
        );
    }
}
```

---

## Contract Deployment

### 1. Deploy a Testnet

```bash
# Listar keys disponibles
stellar keys list

# Deploy del contrato
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/your_contract.wasm \
  --source YOUR_KEY_NAME \
  --network testnet

# Guardar el contract ID que retorna
export CONTRACT_ID="CXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
```

### 2. Contract Initialization

```bash
# Inicializar contrato (si requiere init)
stellar contract invoke \
  --id $CONTRACT_ID \
  --source YOUR_KEY_NAME \
  --network testnet \
  -- \
  initialize \
  --admin YOUR_ADMIN_ADDRESS
```

### 3. Verificación Post-Deploy

```bash
# Verificar que el contrato está deployed
stellar contract info \
  --id $CONTRACT_ID \
  --network testnet

# Probar una función básica
stellar contract invoke \
  --id $CONTRACT_ID \
  --source YOUR_KEY_NAME \
  --network testnet \
  -- \
  your_test_function
```

---

## Frontend Integration

### 1. Configuración Stellar SDK

```typescript
// src/lib/stellar-config.ts
import { Horizon, Networks, SorobanRpc } from '@stellar/stellar-sdk';

// Configuración para Testnet
export const NETWORK_CONFIG = {
  network: Networks.TESTNET,
  horizonUrl: 'https://horizon-testnet.stellar.org',
  sorobanRpcUrl: 'https://soroban-testnet.stellar.org',
};

// Cliente Horizon para transacciones
export const horizonServer = new Horizon.Server(NETWORK_CONFIG.horizonUrl);

// Cliente Soroban RPC para contratos
export const sorobanServer = new SorobanRpc.Server(NETWORK_CONFIG.sorobanRpcUrl);
```

### 2. Contract Client Service

```typescript
// src/services/contract-client.ts
import {
  Contract,
  SorobanRpc,
  TransactionBuilder,
  Account,
  Operation
} from '@stellar/stellar-sdk';
import { sorobanServer, NETWORK_CONFIG } from '@/lib/stellar-config';

export class ContractClient {
  private contract: Contract;

  constructor(contractId: string) {
    this.contract = new Contract(contractId);
  }

  async callContract(
    method: string,
    params: any[],
    sourceAccount: Account,
    signer: any
  ) {
    try {
      // 1. Construir la operación
      const operation = this.contract.call(method, ...params);

      // 2. Obtener base fee
      const baseFee = await sorobanServer.fetchBaseFee();

      // 3. Construir transacción
      const transaction = new TransactionBuilder(sourceAccount, {
        fee: (parseInt(baseFee) * 10).toString(), // Fee buffer para Soroban
        networkPassphrase: NETWORK_CONFIG.network
      })
        .addOperation(operation)
        .setTimeout(30)
        .build();

      // 4. Simular transacción PRIMERO
      const simulatedTx = await sorobanServer.simulateTransaction(transaction);

      if (SorobanRpc.Api.isSimulationError(simulatedTx)) {
        throw new Error(`Simulation failed: ${simulatedTx.error}`);
      }

      // 5. Preparar transacción con datos de simulación
      const preparedTx = SorobanRpc.assembleTransaction(
        transaction,
        simulatedTx
      );

      // 6. Firmar
      preparedTx.sign(signer);

      // 7. Enviar
      const sendResponse = await sorobanServer.sendTransaction(preparedTx);

      // 8. Esperar confirmación
      let getResponse = await sorobanServer.getTransaction(sendResponse.hash);

      while (getResponse.status === 'PENDING' || getResponse.status === 'NOT_FOUND') {
        await new Promise(resolve => setTimeout(resolve, 1000));
        getResponse = await sorobanServer.getTransaction(sendResponse.hash);
      }

      if (getResponse.status === 'SUCCESS') {
        return getResponse.returnValue;
      } else {
        throw new Error(`Transaction failed: ${getResponse.status}`);
      }

    } catch (error) {
      console.error('Contract call error:', error);
      throw error;
    }
  }
}
```

### 3. Transaction Streaming (Monitoring)

```typescript
// src/services/transaction-monitor.ts
import { horizonServer } from '@/lib/stellar-config';

export function streamAccountTransactions(
  accountId: string,
  onTransaction: (tx: any) => void,
  onError: (error: any) => void
) {
  let lastCursor = 'now';

  const txHandler = (txResponse: any) => {
    console.log('New transaction:', txResponse);
    lastCursor = txResponse.paging_token;
    onTransaction(txResponse);
  };

  const errorHandler = (error: any) => {
    console.error('Stream error:', error);
    onError(error);

    // Auto-reconexión después de 5 segundos
    setTimeout(() => {
      console.log('Reconnecting transaction stream...');
      startStream();
    }, 5000);
  };

  const startStream = () => {
    return horizonServer
      .transactions()
      .forAccount(accountId)
      .cursor(lastCursor)
      .stream({
        onmessage: txHandler,
        onerror: errorHandler
      });
  };

  return startStream();
}
```

### 4. Payment Streaming (Real-time Updates)

```typescript
// src/services/payment-monitor.ts
import { horizonServer } from '@/lib/stellar-config';

export function streamPayments(
  onPayment: (payment: any) => void
) {
  const paymentStream = horizonServer
    .payments()
    .cursor('now')
    .stream({
      onmessage: (message) => {
        console.log('Payment received:', message);
        onPayment(message);
      },
      onerror: (error) => {
        console.error('Payment stream error:', error);
      }
    });

  return paymentStream;
}
```

---

## Monitoring & Error Handling

### 1. Error Types a Manejar

```typescript
// src/types/errors.ts
export enum ContractErrorType {
  SIMULATION_FAILED = 'SIMULATION_FAILED',
  TRANSACTION_FAILED = 'TRANSACTION_FAILED',
  INSUFFICIENT_BALANCE = 'INSUFFICIENT_BALANCE',
  CONTRACT_ERROR = 'CONTRACT_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  WALLET_ERROR = 'WALLET_ERROR',
}

export class ContractError extends Error {
  constructor(
    public type: ContractErrorType,
    public message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'ContractError';
  }
}
```

### 2. Error Handler Service

```typescript
// src/services/error-handler.ts
import { ContractError, ContractErrorType } from '@/types/errors';
import { toast } from 'sonner';

export function handleContractError(error: any): ContractError {
  // Simulation errors
  if (error.message?.includes('Simulation failed')) {
    toast.error('Transaction simulation failed. Please check parameters.');
    return new ContractError(
      ContractErrorType.SIMULATION_FAILED,
      'Failed to simulate transaction',
      error
    );
  }

  // Insufficient balance
  if (error.message?.includes('insufficient balance')) {
    toast.error('Insufficient balance to complete transaction');
    return new ContractError(
      ContractErrorType.INSUFFICIENT_BALANCE,
      'Not enough funds',
      error
    );
  }

  // Network errors
  if (error.message?.includes('Network') || error.code === 'ECONNREFUSED') {
    toast.error('Network error. Please check your connection.');
    return new ContractError(
      ContractErrorType.NETWORK_ERROR,
      'Network connection failed',
      error
    );
  }

  // Default
  toast.error('An unexpected error occurred');
  return new ContractError(
    ContractErrorType.CONTRACT_ERROR,
    error.message || 'Unknown error',
    error
  );
}
```

### 3. Transaction Status Tracking

```typescript
// src/hooks/useTransactionStatus.ts
import { useState, useEffect } from 'react';
import { sorobanServer } from '@/lib/stellar-config';

export enum TxStatus {
  PENDING = 'PENDING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  NOT_FOUND = 'NOT_FOUND',
}

export function useTransactionStatus(txHash: string | null) {
  const [status, setStatus] = useState<TxStatus>(TxStatus.PENDING);
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    if (!txHash) return;

    let isCancelled = false;

    const pollStatus = async () => {
      try {
        const response = await sorobanServer.getTransaction(txHash);

        if (isCancelled) return;

        setStatus(response.status as TxStatus);
        setResult(response);

        // Continue polling if pending
        if (response.status === TxStatus.PENDING || response.status === TxStatus.NOT_FOUND) {
          setTimeout(pollStatus, 2000);
        }
      } catch (error) {
        console.error('Error polling transaction:', error);
        if (!isCancelled) {
          setTimeout(pollStatus, 2000);
        }
      }
    };

    pollStatus();

    return () => {
      isCancelled = true;
    };
  }, [txHash]);

  return { status, result };
}
```

---

## Security Checklist

### Pre-Deployment Security

- [ ] **Code Audit**: Revisar todo el código del contrato por vulnerabilidades
- [ ] **Test Coverage**: Mínimo 80% coverage en tests unitarios
- [ ] **Dependency Audit**: `cargo audit` para vulnerabilidades conocidas
- [ ] **Access Control**: Verificar que roles/permisos están implementados
- [ ] **Reentrancy Guards**: Protección contra ataques de reentrancia
- [ ] **Integer Overflow**: Usar checked arithmetic operations
- [ ] **Gas Limits**: Establecer límites razonables para evitar DoS

### Frontend Security

```typescript
// src/lib/security-validators.ts

/**
 * Validar address de Stellar
 */
export function isValidStellarAddress(address: string): boolean {
  return /^G[A-Z0-9]{55}$/.test(address);
}

/**
 * Validar contract ID
 */
export function isValidContractId(contractId: string): boolean {
  return /^C[A-Z0-9]{55}$/.test(contractId);
}

/**
 * Sanitizar input del usuario antes de enviar a contrato
 */
export function sanitizeUserInput(input: string): string {
  return input.trim().slice(0, 100); // Limitar longitud
}

/**
 * Validar amounts (evitar valores negativos o excesivos)
 */
export function isValidAmount(amount: string | number): boolean {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return !isNaN(num) && num > 0 && num < Number.MAX_SAFE_INTEGER;
}
```

### Transaction Security

```typescript
// src/services/secure-transaction.ts

export async function secureContractCall(
  contractClient: ContractClient,
  method: string,
  params: any[],
  validations: {
    maxFee?: number;
    minBalance?: number;
    requiresApproval?: boolean;
  }
) {
  // 1. Pre-validaciones
  if (validations.requiresApproval) {
    const approved = await askUserConfirmation(method, params);
    if (!approved) throw new Error('User cancelled transaction');
  }

  // 2. Check balance si es necesario
  if (validations.minBalance) {
    const balance = await checkUserBalance();
    if (balance < validations.minBalance) {
      throw new ContractError(
        ContractErrorType.INSUFFICIENT_BALANCE,
        'Insufficient balance'
      );
    }
  }

  // 3. Simular primero (SIEMPRE)
  const simulation = await contractClient.simulate(method, params);

  // 4. Verificar fee máximo
  if (validations.maxFee && simulation.fee > validations.maxFee) {
    throw new Error(`Fee exceeds maximum allowed: ${simulation.fee}`);
  }

  // 5. Ejecutar
  return await contractClient.callContract(method, params);
}
```

---

## Performance Optimization

### 1. Contract Caching

```typescript
// src/lib/contract-cache.ts
import { Contract } from '@stellar/stellar-sdk';

class ContractCache {
  private cache = new Map<string, Contract>();

  get(contractId: string): Contract {
    if (!this.cache.has(contractId)) {
      this.cache.set(contractId, new Contract(contractId));
    }
    return this.cache.get(contractId)!;
  }

  clear() {
    this.cache.clear();
  }
}

export const contractCache = new ContractCache();
```

### 2. Transaction Batching

```typescript
// src/services/transaction-batcher.ts

export class TransactionBatcher {
  private queue: Array<() => Promise<any>> = [];
  private processing = false;

  async add<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });

      if (!this.processing) {
        this.process();
      }
    });
  }

  private async process() {
    this.processing = true;

    while (this.queue.length > 0) {
      const task = this.queue.shift();
      if (task) {
        await task();
        // Rate limiting: 1 request per second
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    this.processing = false;
  }
}

export const txBatcher = new TransactionBatcher();
```

### 3. Response Caching con React Query

```typescript
// src/hooks/useContract.ts
import { useQuery } from '@tanstack/react-query';
import { ContractClient } from '@/services/contract-client';

export function useContractData(
  contractId: string,
  method: string,
  params: any[]
) {
  return useQuery({
    queryKey: ['contract', contractId, method, params],
    queryFn: async () => {
      const client = new ContractClient(contractId);
      return await client.callReadOnly(method, params);
    },
    staleTime: 30000, // 30 segundos
    cacheTime: 300000, // 5 minutos
    retry: 3,
  });
}
```

---

## Environment Variables

```bash
# .env.local
NEXT_PUBLIC_STELLAR_NETWORK=testnet
NEXT_PUBLIC_HORIZON_URL=https://horizon-testnet.stellar.org
NEXT_PUBLIC_SOROBAN_RPC_URL=https://soroban-testnet.stellar.org

# Contract IDs (reemplazar con los reales después de deploy)
NEXT_PUBLIC_TOKEN_FACTORY_CONTRACT_ID=
NEXT_PUBLIC_AMM_CONTRACT_ID=
NEXT_PUBLIC_SWAP_CONTRACT_ID=

# Monitoring (opcional)
NEXT_PUBLIC_SENTRY_DSN=
NEXT_PUBLIC_ANALYTICS_ID=
```

---

## Deployment Checklist

### Pre-Deploy

- [ ] Todos los tests pasan (`make test`)
- [ ] Build exitoso sin warnings (`make build`)
- [ ] Contract metadata verificado (`stellar contract info meta`)
- [ ] Security audit completo
- [ ] Environment variables configuradas

### Deploy

- [ ] Deploy a testnet exitoso
- [ ] Contract ID guardado en variables de entorno
- [ ] Contract initialization completada
- [ ] Verificación post-deploy exitosa

### Post-Deploy

- [ ] Frontend conectado y funcionando
- [ ] Monitoring configurado
- [ ] Error handling testeado
- [ ] Performance metrics establecidos
- [ ] Documentación actualizada
- [ ] Team notificado del nuevo deployment

---

## Recursos Adicionales

- [Soroban SDK Docs](https://github.com/stellar/rs-soroban-sdk)
- [Stellar JS SDK Docs](https://github.com/stellar/js-stellar-sdk)
- [Soroban Examples](https://github.com/stellar/soroban-examples)
- [Stellar Developers Discord](https://discord.gg/stellardev)

---

**Última actualización**: 2025-01-15
**Basado en**: Stellar Soroban SDK oficial y Stellar JS SDK
