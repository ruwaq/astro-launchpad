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
// HARDCODED FALLBACKS (V5 - November 27, 2024)
// These are used when environment variables are not set
// =============================================================================
const FALLBACK_CONTRACT_IDS = {
  tokenFactory: 'CAETFO74SF5GSPA2SCUIR6P5XET6ASEMQPESLRWNWRDC37UX32HBKEMK',
  astroToken: 'CBCX43B5YHWW5PGGRDFWRE3TCFMLOI3WU4WYOVNAUFFEGCKZFPLVJ5DP',
  dexFactory: 'CDC22YEAGFSW7AO5I2FQAAJ7PMHMN5Q76ER6BT7XALZ4UQCFEKA2G2WT',
  dexRouter: 'CCBNY4JPDHS45KXK34HI4VSYE7P2YKOZEHFVXQ4UZMYHVHOAS7DLPWUM',
  dexPairWasmHash: 'cf8d4b116f6c23ab1102d7f7d928d638ec4fd37ce90ea290cde31f60f6807c9d',
  xlmSacAddress: 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
  oracle: 'CAEDPEZDRCEJCF73ASC5JGNKCIJDV2QJQSW6DJ6B74MYALBNKCJ5IFP4',
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
