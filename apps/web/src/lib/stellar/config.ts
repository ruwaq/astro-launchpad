/**
 * Stellar Network Configuration
 *
 * Centralizes all Stellar/Soroban network configuration
 * for testnet and mainnet environments.
 *
 * CONTRACT ADDRESSES:
 * - Primary source: Environment variables from root .env
 * - Fallback: Hardcoded V5 values (updated Nov 27, 2024)
 *
 * To update contract addresses:
 * 1. Update the root .env file ONLY
 * 2. Restart dev servers
 */

// =============================================================================
// HARDCODED FALLBACKS (V3.0.0 - April 5, 2026)
// These are used when environment variables are not set
// V3.0.0: Security Grade A (95/100), 18-21% gas savings, Router events
// Changes: CEI pattern fix, batch reserves, router event tracking
// Deployed 2026-04-05 to Stellar Testnet
// =============================================================================
const FALLBACK_CONTRACT_IDS = {
  tokenFactory: 'CCQ4IMTQR3PIXQBLEZPFFUEPGMSHUE5AAD2CB6PXBOVR5G3EQKGTHUPD',
  astroToken: 'CBCX43B5YHWW5PGGRDFWRE3TCFMLOI3WU4WYOVNAUFFEGCKZFPLVJ5DP', // Not deployed yet
  dexFactory: 'CDXVWXJDBOLJU2DDTDSP4HY6HK3OTIYVD4SVG5MLTBOJ36OO5ASQUSCO', // V3 - Apr 5, 2026
  dexRouter: 'CDWNDJGOVT4G5G76R4KZ4G7X3OYUVSVSHIX3YWZY4LYACPHJEMK5RBES', // V3 - Apr 5, 2026
  dexPairWasmHash: '18413139c87885c16fad25a8d096c6612f9d6b2b98a93473b220ab49e6c1a72b', // V3 - Apr 5, 2026
  xlmSacAddress: 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
  oracle: 'CAEDPEZDRCEJCF73ASC5JGNKCIJDV2QJQSW6DJ6B74MYALBNKCJ5IFP4', // Not deployed yet
} as const;

export const STELLAR_CONFIG = {
  testnet: {
    networkPassphrase: 'Test SDF Network ; September 2015',
    rpcUrl: 'https://soroban-testnet.stellar.org',
    horizonUrl: 'https://horizon-testnet.stellar.org',
  },
  mainnet: {
    networkPassphrase: 'Public Global Stellar Network ; September 2015',
    rpcUrl: 'https://soroban.stellar.org',
    horizonUrl: 'https://horizon.stellar.org',
  },
} as const;

export type NetworkType = keyof typeof STELLAR_CONFIG;

/**
 * Get current network from environment
 */
export const NETWORK: NetworkType =
  (process.env.NEXT_PUBLIC_NETWORK as NetworkType) === 'mainnet'
    ? 'mainnet'
    : 'testnet';

/**
 * Get network configuration for current environment
 */
export const getNetworkConfig = () => STELLAR_CONFIG[NETWORK];

/**
 * Contract IDs from environment variables with fallbacks
 *
 * Priority:
 * 1. NEXT_PUBLIC_TOKEN_FACTORY_CONTRACT_ID (recommended)
 * 2. NEXT_PUBLIC_TESTNET_CONTRACT_ID (legacy)
 * 3. Hardcoded fallback (V5)
 */
export const CONTRACT_IDS = {
  // Token Factory: check multiple env var names for backwards compatibility
  tokenFactory:
    process.env.NEXT_PUBLIC_TOKEN_FACTORY_CONTRACT_ID ||
    process.env.NEXT_PUBLIC_TESTNET_CONTRACT_ID ||
    FALLBACK_CONTRACT_IDS.tokenFactory,
  // Astro Platform Token
  astroToken:
    process.env.NEXT_PUBLIC_ASTRO_TOKEN_ADDRESS ||
    FALLBACK_CONTRACT_IDS.astroToken,
  // AstroSwap DEX Contracts
  dexFactory:
    process.env.NEXT_PUBLIC_DEX_FACTORY_CONTRACT_ID ||
    FALLBACK_CONTRACT_IDS.dexFactory,
  dexRouter:
    process.env.NEXT_PUBLIC_DEX_ROUTER_CONTRACT_ID ||
    FALLBACK_CONTRACT_IDS.dexRouter,
  dexPairWasmHash:
    process.env.NEXT_PUBLIC_DEX_PAIR_WASM_HASH ||
    FALLBACK_CONTRACT_IDS.dexPairWasmHash,
  // XLM SAC Address
  xlmSacAddress:
    process.env.NEXT_PUBLIC_XLM_SAC_ADDRESS ||
    FALLBACK_CONTRACT_IDS.xlmSacAddress,
  // Oracle
  oracle:
    process.env.NEXT_PUBLIC_ORACLE_CONTRACT_ID ||
    FALLBACK_CONTRACT_IDS.oracle,
} as const;

/**
 * Validate that all required contract IDs are present
 */
export function validateContractIds(): boolean {
  const missing = Object.entries(CONTRACT_IDS)
    .filter(([_, id]) => !id)
    .map(([name]) => name);

  if (missing.length > 0) {
    console.warn(
      `Missing contract IDs in environment: ${missing.join(', ')}\n` +
      `Please set these environment variables in .env.local`
    );
    return false;
  }

  return true;
}

/**
 * Block explorer URLs for transaction viewing
 */
export const BLOCK_EXPLORER = {
  testnet: {
    base: 'https://testnet.stellarchain.io',
    tx: (hash: string) => `https://testnet.stellarchain.io/transactions/${hash}`,
    account: (address: string) => `https://testnet.stellarchain.io/accounts/${address}`,
    contract: (id: string) => `https://testnet.stellarchain.io/contracts/${id}`,
  },
  mainnet: {
    base: 'https://stellarchain.io',
    tx: (hash: string) => `https://stellarchain.io/transactions/${hash}`,
    account: (address: string) => `https://stellarchain.io/accounts/${address}`,
    contract: (id: string) => `https://stellarchain.io/contracts/${id}`,
  },
} as const;

/**
 * Get block explorer for current network
 */
export const getBlockExplorer = () => BLOCK_EXPLORER[NETWORK];

/**
 * Transaction configuration
 */
export const TRANSACTION_CONFIG = {
  /** Default timeout for transactions in seconds */
  timeout: 30,
  /** Base fee in stroops (0.00001 XLM) */
  baseFee: '100',
  /** Fee buffer multiplier for Soroban transactions */
  sorobanFeeMultiplier: 10,
  /** Maximum retries for transaction polling */
  maxRetries: 10,
  /** Polling interval in milliseconds */
  pollingInterval: 1000,
} as const;
