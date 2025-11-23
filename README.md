<div align="center">

# 🚀 Astro-Shiba
### Infraestructura de Tokenización Descentralizada & Launchpad en Soroban

**Lanza. Intercambia. Escala.**
*La primera plataforma nativa de Stellar para economías de tokens programables.*

[![Stellar](https://img.shields.io/badge/Stellar-Protocol%2024-7D00FF?style=for-the-badge&logo=stellar)](https://stellar.org)
[![Soroban](https://img.shields.io/badge/Soroban-Native-orange?style=for-the-badge)](https://soroban.stellar.org)
[![Rust](https://img.shields.io/badge/Built_With-Rust-black?style=for-the-badge&logo=rust)](https://www.rust-lang.org)
[![Status](https://img.shields.io/badge/Status-Production_Ready-success?style=for-the-badge)]()

[Explorar DApp](https://astroshiba.com) · [Documentación Técnica](./docs) · [Reportar Bug](https://github.com/nunalabs/Astro-Shiba-Pop/issues)

</div>

---

## 📖 Resumen Ejecutivo

**Astro-Shiba** no es solo un launchpad; es una infraestructura completa de **Token Economies** construida nativamente sobre **Soroban**, la plataforma de contratos inteligentes de Stellar.

A diferencia de los modelos tradicionales limitados al SDEX, Astro-Shiba utiliza una arquitectura **cross-contract de nivel industrial** ejecutada en **Rust/WASM**. Esto permite crear **Stellar Asset Contracts (SAC)** reales—no wrappers—en menos de **30 segundos**, ofreciendo una experiencia de tokenización inmediata, segura y matemáticamente justa.

> **💡 La Innovación:** Eliminamos la necesidad de liquidez inicial y prevenimos los *rug-pulls* mediante un sistema de **Auto-Graduación** matemáticamente irreversible.

---

## ⚙️ Mecánicas Core: El Motor de Astro-Shiba

El sistema se basa en tres pilares fundamentales que garantizan equidad y seguridad sin intervención humana:

### 1. Algorithmic Bonding Curve (AMM $x \cdot y = k$)
Cada lanzamiento comienza en un entorno de liquidez aislado gobernado por una curva de vinculación.
- **Precio Justo:** Determinado algorítmicamente desde el primer segundo.
- **Anti-Manipulación:** Elimina pre-ventas ocultas y esquemas de *pump-and-dump*.
- **Accesibilidad:** Permite el descubrimiento de precios orgánico sin capital inicial masivo.

### 2. Auto-Graduación Autónoma
Cuando un token alcanza la tracción de mercado necesaria (ej. Market Cap objetivo), el **Graduation Engine** se activa automáticamente:
1.  **Migración:** Retira la liquidez de la curva de vinculación.
2.  **Despliegue:** Deposita los fondos en un AMM permanente (compatible con Soroswap).
3.  **Bloqueo Irreversible:** Quema los tokens de liquidez (LP Tokens).
4.  **Resultado:** Liquidez bloqueada permanentemente. **Sin vectores de rug-pull.**

### 3. Seguridad y Oráculos
- **Validación Externa:** Integración con **DIA Price Oracle** para validar umbrales de mercado.
- **Protección:** Guardas contra MEV (Maximum Extractable Value), *deadlines* estrictos y protección contra *slippage*.
- **Gobernanza:** Sin claves de administración (*Admin Keys*) ni puertas traseras (*Backdoors*).

---

## 🏗️ Arquitectura Técnica

Astro-Shiba es un **Monorepo** gestionado con **Turbo**, diseñado para alta concurrencia y escalabilidad bajo el **Protocolo 24** de Stellar.

### 🧠 Smart Contracts (Rust/Soroban)
El núcleo inmutable de la plataforma.
- **SAC Factory:** Orquesta el despliegue de nuevos activos digitales visibles en todo el ecosistema (Freighter, Lobstr, xBull).
- **Bonding Curve AMM:** Lógica de intercambio con protección de desbordamiento (*Safe Math*) y ejecución paralela.
- **Características:** Validación nativa `Secp256r1`, precompiles `BN254` y compatibilidad ZK (Zero-Knowledge).

### ⚡ Backend (Node.js / Indexer)
Infraestructura de datos optimizada para velocidad (<100ms).
- **Indexer Propio:** Escucha eventos *on-chain* en tiempo real, eliminando la latencia de Horizon.
- **API Gateway v2:** Construido con **Fastify + Mercurius (GraphQL)**.
- **Base de Datos:** Prisma ORM con PostgreSQL + Redis Caching para Leaderboards calientes.

### 💻 Frontend (Next.js 15)
Experiencia de usuario moderna y reactiva.
- **Stack:** React 19, TailwindCSS, Framer Motion.
- **Estado:** Gestión global ligera con **Zustand** y **React Query**.
- **Integración:** `@creit.tech/stellar-wallets-kit` para conexión universal de billeteras.

---

## 📊 Comparativa: Evolución en Stellar

| Característica | Stellar Clásico (SDEX) | 🚀 Astro-Shiba (Soroban) |
| :--- | :--- | :--- |
| **Infraestructura** | Order Book (Layer 1) | **Smart Contracts Rust/WASM (Layer 2)** |
| **Creación de Token** | Manual + Oferta de venta | **Factory Automatizada (<30s)** |
| **Liquidez** | Requiere aporte inicial | **Bonding Curve (Cero capital inicial)** |
| **Seguridad** | Confianza en el creador | **Liquidez Bloqueada (Code is Law)** |
| **Data Layer** | Horizon (Rate limits) | **Indexer GraphQL Propio (Real-time)** |

---

## 🌍 Impacto Real y Casos de Uso

Astro-Shiba democratiza el acceso financiero en LATAM y el mundo, habilitando:

*   🎵 **Artistas:** Monetización de pre-ventas y comunidades de fans.
*   🏙️ **Comunidades:** Lanzamiento de monedas barriales y locales.
*   🏪 **Comercios:** Sistemas de fidelización (*loyalty*) dinámicos.
*   🗳️ **DAOs:** Gobernanza nativa y tesorería transparente.
*   🤝 **DeFi:** Bootstrap de liquidez sin fricción para nuevos protocolos.

---

## 🛡️ Calidad y Auditoría

*   **Cobertura de Tests:** 80% (77 tests unitarios y de integración).
*   **Control de Acceso:** RBAC con 5 niveles de roles.
*   **Seguridad Operativa:** Mecanismos de *Emergency Pause* y 15 tipos de errores personalizados.
*   **Estado:** Listo para auditoría externa y escalado industrial.

---

<div align="center">

**Construido con ❤️ para la comunidad de Stellar.**

🚀 *Llevando la tokenización al siguiente nivel.*

</div>
