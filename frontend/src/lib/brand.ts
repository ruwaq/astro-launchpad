/**
 * Single source of truth for app branding.
 * Updating here rebrands the header, hero, index.html, and manifest.
 *
 * Name combination:
 * Unites the technical name from stellar-core `Floodgate` (src/overlay/Floodgate.cpp)
 * with the iconic Stellar meme token `Astro` -> **AstroGate** 🌊🚀.
 *
 * Genesis/Flagship Meme Token: ASTRO ($ASTRO), deployed and verified on Soroswap testnet.
 */
export const BRAND = {
  name: 'AstroGate',
  shortName: 'AstroGate',
  tokenName: 'ASTRO',
  emoji: '🌊🚀',
  tagline: 'Open the Floodgates',
  taglineEn: 'Open the Floodgates',
  hero: 'Fair Meme Launchpad + AMM on Stellar',
  description:
    'Launch fair meme tokens in seconds, burn 100% LP permanently to the dead address, and trade live on Stellar testnet — 100% on-chain, zero rug-pulls.',
  manifestDescription:
    'AstroGate — Fair meme launchpad & instant AMM trading on Stellar testnet.',
  provenance:
    'Union of stellar-core Floodgate (src/overlay/Floodgate.cpp) and Astro meme',
} as const
