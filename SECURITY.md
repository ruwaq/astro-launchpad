# Security policy — Floodgate (testnet)

Floodgate es un launchpad **solo para testnet de Stellar**. No hay fondos
reales, no hay mainnet y las cuentas de demostración son desechables.

## Alcance

- `contracts/token/`: token fungible SEP-41 sobre OpenZeppelin Stellar.
- `frontend/`: SPA estática (Vite + React) desplegable como Worker de
  Cloudflare; la identidad es la wallet y los datos se leen de Soroban
  RPC/Horizon.
- Integración con **Soroswap** (factory/router ya desplegados en testnet) como
  AMM externo.

## Modelo de confianza

- **La red es la fuente de verdad** para balances, supply, reservas y eventos.
- No hay backend de usuarios, JWT, base de datos ni secretos de servidor en el
  flujo del producto.
- La wallet firma todas las operaciones que cambian estado.
- El modo prueba guarda semillas **de testnet** en `localStorage`; son claves
  públicas para cualquiera con acceso a ese navegador y no deben reutilizarse.
- Los contratos de Soroswap y el RPC/Horizon públicos son dependencias
  externas: su disponibilidad y corrección no las controla este repositorio.

## Propiedades y controles actuales

- CSP y headers de seguridad en `frontend/public/_headers` (`nosniff`,
  `frame-ancestors 'none'`, `object-src 'none'`, orígenes permitidos).
- Sin secretos en el bundle; las variables públicas de Vite no se usan para
  custodiar claves.
- Renderizado de metadata on-chain como texto, sin `dangerouslySetInnerHTML`.
- Swaps con cotización real del router, mínimo de salida por slippage (2%) y
  validación de balance antes de firmar.
- El service worker solo precachea el shell y assets; **nunca** cachea RPC,
  Horizon, relays de wallet ni datos financieros.
- `verify:demo` y `verify:token-events` firman únicamente con cuentas nuevas de
  testnet fondeadas por Friendbot.

## Limitaciones conocidas (no son vulnerabilidades ocultas)

- **El owner puede emitir más supply**: el contrato usa `mint` con
  `only_owner` y este MVP no tiene cap de supply. La UI lo muestra en la página
  del token y al crearlo. Un comprador debe revisar el owner on-chain.
- **Sin auditoría**: ni los contratos ni el frontend tienen auditoría externa.
  No usar con fondos reales ni presentar como producto de mainnet.
- **Sin indexer**: la actividad on-chain visible depende de la retención del
  RPC; el par de Soroswap no emite eventos `swap`, así que no hay histórico
  global de trades. Los snapshots de precio/liquidez son locales.
- **Modo demo**: las semillas viven en `localStorage`; es deliberado para
  testnet y nunca debe usarse con una clave real.
- **Dependencias**: `npm audit` puede reportar vulnerabilidades transitivas de
  wallet-kit. No se aplica `npm audit fix --force` porque degradaría la wallet;
  se revisan y actualizan con pruebas.
- **Sin E2E de navegador en este entorno**: hay smoke SSR y verificación de
  artefactos PWA; falta Playwright con navegador real.
- **Deploy**: el Worker de producción requiere `wrangler login`; el repositorio
  remoto `main` es un monorepo legacy sin historia común con este proyecto.

## Reportar una vulnerabilidad

No abras un issue público con detalles explotables. Usa un **GitHub Security
Advisory** privado en el repositorio e incluye:

1. commit/rama afectada,
2. impacto y activos afectados (contrato, frontend, wallet, demo),
3. pasos de reproducción en testnet,
4. evidencia (hash de transacción, logs sin secretos).

No incluyas semillas, tokens de API ni datos personales. No pruebes con fondos
reales.

## Buenas prácticas para probar

- Usa solo testnet y cuentas desechables.
- Nunca importes una semilla de mainnet en el modo demo.
- Revisa el contrato, el owner y el mínimo de salida en la wallet antes de
  firmar.
- Si una transacción falla, no reintentes en bucle: revisa el error y el
  explorer.
