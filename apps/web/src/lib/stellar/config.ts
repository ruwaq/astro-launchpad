/**
 * Stellar Network Configuration
 *
 * Centralizes all Stellar/Soroban network configuration
 * for testnet and mainnet environments.
 */

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
 * Contract IDs from environment variables
 */
export const CONTRACT_IDS = {
  tokenFactory: process.env.NEXT_PUBLIC_TESTNET_CONTRACT_ID || '',
  // Add more contract IDs as needed
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
