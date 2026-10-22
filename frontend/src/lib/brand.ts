/**
 * Única fuente de verdad de la marca de la app.
 * Cambiar aquí rebrandea header, hero, `index.html` y el manifest.
 *
 * El nombre "Floodgate" viene del código interno de stellar-core:
 * `Floodgate` (src/overlay/Floodgate.cpp) es la compuerta que inunda la red
 * con las transacciones de los peers hasta que el ledger cierra. Los devs del
 * core y los operadores lo reconocen al instante y, como marca crypto, estaba
 * libre (verificado 2026-10: solo existe una firma de VC fuera del rubro).
 *
 * Importante: el token de ejemplo del launchpad (ASTRO) es otra cosa y no
 * cambia con la marca.
 */
export const BRAND = {
  name: 'Floodgate',
  emoji: '🌊',
  tagline: 'Abre la compuerta',
  taglineEn: 'Open the floodgates',
  hero: 'Launchpad + AMM en Stellar',
  description:
    'Crea tu token en segundos, añade liquidez y swapea en Stellar testnet — todo on-chain, con la red como única fuente de datos. Te quedas con tus LP tokens: ganas fees de cada swap mientras sostengas tu liquidez.',
  manifestDescription:
    'Floodgate — crea tu token en segundos y swapea en Stellar testnet.',
  provenance: 'nombre de stellar-core: Floodgate (src/overlay/Floodgate.cpp)',
} as const
