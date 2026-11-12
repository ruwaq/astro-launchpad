# Guía de Integración para Agentes de IA y Trading Bots en AstroGate

> [!NOTE]
> AstroGate está diseñado desde sus cimientos como un protocolo **AI-First**. Todo su estado se encuentra disponible on-chain o a través del SDK con tipado estricto en TypeScript y especificaciones legibles por LLMs.

---

## 1. Acceso Rápido para Modelos de Lenguaje (`llms.txt`)
AstroGate publica una especificación estandarizada en `/llms.txt` accesible tanto para bots web como para agentes que naveguen la plataforma.

* **URL en vivo**: `https://astrogate.workers.dev/llms.txt` (o `/public/llms.txt` en local).
* **Contratos clave**:
  * Factory: `CDP3HMUH6SMS3S7NPGNDJLULCOXXEPSHY4JKUKMBNQMATHDHWXRRJTBY`
  * Router: `CCJUD55AG6W5HAI5LRVNKAE5WDP5XGZBUDS5WNTIVDU7O264UZZE7BRD`
  * SAC XLM: `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC`
  * Token Base ASTRO: `CAI637WCEILQF3ZYOV6BRUCX532XQIVOOJ4CRWFPWHQRJHOH5OKHSXRE`
  * Launchpad Atómico (v2): `CB5LMSJ2Y2KEZEO2BXTRNA2OPFALVU6AVIOASVPZTQ66GRT3UEKOQ3O4`

---

## 2. Uso del SDK (@astrogate/sdk)

El SDK exportado en `src/sdk/index.ts` proporciona métodos directos con serialización JSON segura:

```typescript
import {
  getMarketTokens,
  getTokenDetails,
  quoteSwap,
  verifyAntiRug,
  launchFair,
  burnShout,
  getTokenShouts,
  localQuoteXlmForToken,
  checkRpcHealth,
  executeWithRpcFailover,
  fetchTokenEvents,
} from './src/sdk'

// 1. Verificar salud de la red y latencia RPC (con timeout y validación HTTP)
const health = await checkRpcHealth()
console.log(`RPC conectado: ${health.ok} (${health.latencyMs} ms)`)

// 2. Obtener lista de tokens con reservas
const market = await getMarketTokens({ maxTokens: 50 })
for (const token of market) {
  console.log(`${token.symbol}: ${token.priceXlm} XLM (Graduación: ${token.graduationPercent}%)`)
}

// 3. Cotizar un swap de 5 XLM por un token con impacto de precio
const quote = await quoteSwap({
  tokenId: market[0].id,
  amountIn: 50_000_000n, // 5 XLM en stroops (7 decimales)
  direction: 'buy',
  slippagePercent: 2,
})
console.log(
  `Recibes estimado: ${quote.amountOutEstimated} tokens (mínimo: ${quote.amountOutMinimum}, impacto: ${quote.priceImpactPercent}%)`
)

// 4. Auditar Anti-Rug on-chain (ownership renounced + 100% LP quemado en STELLAR_BURN_ADDRESS)
const audit = await verifyAntiRug(market[0].id)
console.log(`Es Anti-Rug Verificado: ${audit.isAntiRugVerified} (LP quemado: ${audit.lpBurned})`)

// 5. Historial reciente de órdenes/trades
const events = await fetchTokenEvents(market[0].id, { maxEvents: 20 })
```

---

## 3. Schemas de Function Calling para Agentes (OpenAI / Gemini / Anthropic)

Puedes proporcionar estas herramientas a cualquier agente autónomo para que monitoree mercados o ejecute operaciones:

```json
{
  "tools": [
    {
      "type": "function",
      "function": {
        "name": "get_market_tokens",
        "description": "Obtiene los tokens activos en el mercado de AstroGate con reservas y cotizaciones en vivo.",
        "parameters": {
          "type": "object",
          "properties": {
            "maxTokens": { "type": "number", "description": "Límite de tokens a consultar" }
          }
        }
      }
    },
    {
      "type": "function",
      "function": {
        "name": "quote_swap",
        "description": "Calcula la cotización exacta en el AMM de Soroswap con protección de slippage e impacto de precio.",
        "parameters": {
          "type": "object",
          "required": ["tokenId", "amountIn", "direction"],
          "properties": {
            "tokenId": { "type": "string" },
            "amountIn": { "type": "string", "description": "Monto en base units (7 decimales)" },
            "direction": { "type": "string", "enum": ["buy", "sell"] },
            "slippagePercent": { "type": "number", "description": "Slippage máximo porcentual (default 2)" }
          }
        }
      }
    },
    {
      "type": "function",
      "function": {
        "name": "verify_anti_rug",
        "description": "Audita si un token tiene el 100% de LP quemado irreversiblemente en GAAAA...WHF y propiedad renunciada.",
        "parameters": {
          "type": "object",
          "required": ["tokenId"],
          "properties": {
            "tokenId": { "type": "string", "description": "Dirección C... del contrato token" }
          }
        }
      }
    }
  ]
}
```

---

## 4. Reglas Críticas para Bots en Stellar/Soroban
1. **Decimales**: Tanto XLM nativo como los tokens estándar de AstroGate operan con **7 decimales** (`1 XLM = 10,000,000 stroops`).
2. **Sin Allowance en Soroswap**: El Router de Soroswap opera mediante `transfer` directo en su transacción atómica; no es necesario llamar a `approve` por separado.
3. **Quema de LP**: Todos los tokens de liquidez de un Fair Launch son enviados a `GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF` de forma permanente e irreversible.
4. **Alta Disponibilidad Multi-RPC**: Las consultas de mercado, eventos y cotizaciones utilizan failover automático y retroceso exponencial contra errores 429 de rate-limiting.
