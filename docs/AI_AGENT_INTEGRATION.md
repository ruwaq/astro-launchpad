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

---

## 2. Uso del SDK (@astrogate/sdk)

El SDK exportado en `src/sdk/index.ts` proporciona métodos directos con serialización JSON segura:

```typescript
import {
  getMarketTokens,
  getTokenDetails,
  quoteSwap,
  verifyAntiRug,
  checkRpcHealth,
} from './src/sdk'

// 1. Verificar salud de la red y latencia RPC
const health = await checkRpcHealth()
console.log(`RPC conectado: ${health.ok} (${health.latencyMs} ms)`)

// 2. Obtener lista de tokens con reservas
const market = await getMarketTokens({ maxTokens: 50 })
for (const token of market) {
  console.log(`${token.symbol}: ${token.priceXlm} XLM (Graduación: ${token.graduationPercent}%)`)
}

// 3. Cotizar un swap de 5 XLM por un token
const quote = await quoteSwap({
  tokenId: market[0].id,
  amountIn: 50_000_000n, // 5 XLM en stroops (7 decimales)
  direction: 'buy',
  slippagePercent: 2,
})
console.log(`Recibes estimado: ${quote.amountOutEstimated} tokens (mínimo garantizado: ${quote.amountOutMinimum})`)

// 4. Auditar Anti-Rug on-chain
const audit = await verifyAntiRug(market[0].id)
console.log(`Es Anti-Rug Verificado: ${audit.isAntiRugVerified}`)
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
        "description": "Calcula la cotización exacta en el AMM de Soroswap con protección de slippage.",
        "parameters": {
          "type": "object",
          "required": ["tokenId", "amountIn", "direction"],
          "properties": {
            "tokenId": { "type": "string" },
            "amountIn": { "type": "string", "description": "Monto en base units (7 decimales)" },
            "direction": { "type": "string", "enum": ["buy", "sell"] }
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
