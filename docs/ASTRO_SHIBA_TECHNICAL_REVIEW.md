### Resumen Ejecutivo: ¿Qué es Astro-Shiba?
**Astro-Shiba es un "Launchpad" de memecoins descentralizado sobre la blockchain de Stellar, utilizando su plataforma de Smart Contracts Soroban.**
Su propuesta de valor se centra en la creación y lanzamiento instantáneo de tokens, construida nativamente con **Smart Contracts (Soroban)** en lugar de usar solo el SDEX clásico de Stellar. Permite a los usuarios lanzar un token en <30 segundos sin proveer liquidez inicial, utilizando un mecanismo de **Bonding Curve**.

---

### 1. Stack Tecnológico (La verdad del código)

El proyecto es un **Monorepo** gestionado con **PNPM** y **Turborepo**.

#### **A. Smart Contracts (El Corazón - Rust/Soroban)**
*   **Lenguaje:** Rust (target `wasm32-unknown-unknown`).
*   **SDK:** Soroban SDK `23.2.1` (Versión muy reciente, compatible con Protocol 22/23), clave para interactuar con la plataforma de Smart Contracts de Stellar.
*   **Componentes Clave:**
    *   `contracts/sac-factory`: El contrato maestro, fundamental para el ecosistema Stellar. Maneja la creación de nuevos SAC (Stellar Asset Contracts) y orquesta la lógica de negocio dentro de la red Stellar.
    *   `contracts/amm-pair`: Implementa la lógica de intercambio descentralizado como un Automated Market Maker (AMM) nativo de Soroban.
*   **Seguridad:** El código muestra evidencia de auditoría interna (`cargo-audit`, `clippy`) y correcciones de "aritmética segura" (Safe Math) para evitar desbordamientos, crucial en Rust financiero.

#### **B. Frontend (La Interfaz - Next.js)**
*   **Framework:** **Next.js 15** (App Router) + **React 19**.
*   **Estilos:** TailwindCSS + Framer Motion (animaciones).
*   **Estado:** **Zustand** (ligero, reemplazando a Redux) y **React Query** (para data fetching y caché).
*   **Conexión Blockchain:**
    *   `@stellar/stellar-sdk`: Esencial para construir y firmar transacciones que interactúan con la red Stellar.
    *   `@creit.tech/stellar-wallets-kit`: Facilita la conexión y el manejo de diversas billeteras Stellar (como Freighter, Albedo) permitiendo la interacción del usuario con la blockchain.
    *   `@apollo/client`: Para hablar con el Backend vía GraphQL.

#### **C. Backend (La Infraestructura - Node.js)**
*   **API Gateway (`backend/api-gateway-v2`):**
    *   **Server:** **Fastify** (más rápido que Express).
    *   **API:** **GraphQL** (usando `mercurius` y `graphql-jit`).
    *   **ORM:** **Prisma** (conectado a PostgreSQL, probablemente).
*   **Indexer (`backend/indexer`):**
    *   Servicio dedicado a escuchar e indexar eventos y estados de la red Stellar y los Smart Contracts de Soroban, almacenando estos datos en la base de datos para consultas rápidas y escalables desde el frontend.

---

### 2. Análisis Funcional: ¿Cómo funciona realmente?

El flujo técnico, basado en la lectura de `contracts/sac-factory/README.md` y el código fuente, es el siguiente:

1.  **Lanzamiento (Factory):**
    *   El usuario llama a la función `launch_token` en el contrato `sac-factory`.
    *   El contrato despliega un nuevo **SAC (Stellar Asset Contract)**.
    *   **Dato Clave:** No hay pre-venta ni asignación al equipo. Es un "Fair Launch".

2.  **Trading (Bonding Curve):**
    *   El token no va a un DEX tradicional inmediatamente. Vive en una **Bonding Curve** interna (definida en `src/bonding_curve.rs`).
    *   La fórmula usada es **Constant Product AMM ($x * y = k$)**.
    *   A medida que la gente compra, el precio sube exponencialmente según la curva matemática programada en Rust.

3.  **Graduación (Auto-Graduation):**
    *   El código monitorea la capitalización de mercado (Market Cap).
    *   Cuando se alcanza el objetivo de **$69,000 USD** (valor hardcodeado o configurable en el contrato), ocurre la "Graduación".
    *   **Acción del Contrato:** El contrato retira la liquidez de la curva y la deposita automáticamente en un AMM permanente (como Uniswap v2 o Soroswap), y **quema los tokens de liquidez (LP tokens)**. Esto hace que el proyecto sea "Anti-Rug" (los creadores no pueden retirar la liquidez).

---

### 3. Diferenciadores Técnicos vs. Otros Proyectos Stellar

| Característica | Proyecto Stellar Clásico (Legacy) | **Astro-Shiba (Este Proyecto)** |
| :--- | :--- | :--- |
| **Mecanismo de Swap** | SDEX (Libro de órdenes nativo en Layer 1). | **Soroban Smart Contract AMM** (Implementación de lógica de swap personalizada en Rust/WASM, nativa del Layer 2 de Stellar). |
| **Creación de Token** | Emitir asset y crear oferta de venta manual. | **Factory Automatizada**: Despliegue de SAC (Stellar Asset Contracts) y pool de liquidez con un solo click. |
| **Descubrimiento de Precio** | Oferta y Demanda en libro de órdenes. | **Bonding Curve Matemática**: Precio predecible y algorítmico al inicio. |
| **Backend** | Frontend consulta Horizon directamente (Lento/Rate limits). | **Indexer Propio + GraphQL**: Indexación de eventos de la red Stellar y los contratos Soroban para una UI ultra-rápida. |

### Conclusión del Auditor

Astro-Shiba es un proyecto **técnicamente ambicioso y moderno**. Es un desarrollo original creado desde cero, utilizando las últimas capacidades de **Soroban (Smart Contracts)** para ofrecer una experiencia de usuario fluida y moderna.

**Punto fuerte:** La arquitectura Backend (Indexer + GraphQL) demuestra que está pensado para escalar y manejar miles de usuarios, no solo para un prototipo rápido.
**Punto crítico a vigilar:** La seguridad del contrato `bonding_curve.rs` es vital. Si la matemática falla ahí, se pueden drenar los fondos. El README menciona que han arreglado 4 vulnerabilidades críticas, lo cual es buena señal de madurez.
