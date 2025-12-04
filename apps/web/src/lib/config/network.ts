/**
 * Network Configuration
 * Modular system for testnet/mainnet switching
 *
 * IMPORTANT: This is the canonical network configuration.
 * Uses standardized environment variable names from root .env
 */

export type NetworkType = 'testnet' | 'mainnet';

export interface NetworkConfig {
  name: string;
  contractId: string;
  rpcUrl: string;
  horizonUrl: string;
  /** Network passphrase - use either `passphrase` or `networkPassphrase` */
  passphrase: string;
  /** Alias for passphrase - for compatibility with Stellar SDK naming */
  networkPassphrase: string;
}

/**
 * Get contract ID from environment with fallback to legacy variable names
 */
function getContractId(network: 'testnet' | 'mainnet'): string {
  if (network === 'testnet') {
    return (
      process.env.NEXT_PUBLIC_TOKEN_FACTORY_CONTRACT_ID ||
      process.env.NEXT_PUBLIC_TESTNET_CONTRACT_ID ||
      ''
    );
  }
  return process.env.NEXT_PUBLIC_MAINNET_CONTRACT_ID || '';
}

const TESTNET_PASSPHRASE = 'Test SDF Network ; September 2015';
const MAINNET_PASSPHRASE = 'Public Global Stellar Network ; September 2015';

const TESTNET_CONFIG: NetworkConfig = {
  name: 'Testnet',
  contractId: getContractId('testnet'),
  rpcUrl:
    process.env.NEXT_PUBLIC_STELLAR_RPC_URL ||
    process.env.NEXT_PUBLIC_TESTNET_RPC_URL ||
    'https://soroban-testnet.stellar.org',
  horizonUrl:
    process.env.NEXT_PUBLIC_TESTNET_HORIZON_URL ||
    'https://horizon-testnet.stellar.org',
  passphrase: TESTNET_PASSPHRASE,
  networkPassphrase: TESTNET_PASSPHRASE,
};

const MAINNET_CONFIG: NetworkConfig = {
  name: 'Mainnet',
  contractId: getContractId('mainnet'),
  rpcUrl:
    process.env.NEXT_PUBLIC_MAINNET_RPC_URL ||
    'https://soroban.stellar.org',
  horizonUrl:
    process.env.NEXT_PUBLIC_MAINNET_HORIZON_URL ||
    'https://horizon.stellar.org',
  passphrase: MAINNET_PASSPHRASE,
  networkPassphrase: MAINNET_PASSPHRASE,
};

/**
 * Get current network from environment
 */
export function getCurrentNetwork(): NetworkType {
  const network = (
    process.env.NEXT_PUBLIC_NETWORK ||
    process.env.NEXT_PUBLIC_STELLAR_NETWORK
  ) as NetworkType;

  if (network !== 'testnet' && network !== 'mainnet') {
    console.warn(`Invalid NEXT_PUBLIC_NETWORK: ${network}. Defaulting to testnet.`);
    return 'testnet';
  }
  return network;
}

/**
 * Get network configuration based on current network
 */
export function getNetworkConfig(network?: NetworkType): NetworkConfig {
  const currentNetwork = network || getCurrentNetwork();
  return currentNetwork === 'mainnet' ? MAINNET_CONFIG : TESTNET_CONFIG;
}

/**
 * Check if we're on mainnet
 */
export function isMainnet(): boolean {
  return getCurrentNetwork() === 'mainnet';
}

/**
 * Check if we're on testnet
 */
export function isTestnet(): boolean {
  return getCurrentNetwork() === 'testnet';
}

/**
 * Get API URL
 * Uses relative path in production (handled by Vercel rewrites)
 */
export function getApiUrl(): string {
  return (
    process.env.NEXT_PUBLIC_API_URL ||
    (typeof window !== 'undefined' && window.location.hostname !== 'localhost'
      ? ''
      : 'http://localhost:4000')
  );
}

/**
 * Get IPFS Gateway
 */
export function getIpfsGateway(): string {
  return process.env.NEXT_PUBLIC_IPFS_GATEWAY || 'https://gateway.pinata.cloud/ipfs/';
}

/**
 * Convert IPFS URI to HTTP URL
 */
export function ipfsToHttp(uri: string): string {
  if (uri.startsWith('ipfs://')) {
    return uri.replace('ipfs://', getIpfsGateway());
  }
  return uri;
}

/**
 * SECURITY: Validate network passphrase matches expected value
 * This prevents signing transactions on the wrong network (e.g., testnet vs mainnet)
 *
 * @param actualPassphrase - Passphrase returned from RPC/wallet
 * @returns true if passphrase matches current network config
 * @throws Error if passphrase doesn't match
 */
export function validateNetworkPassphrase(actualPassphrase: string): boolean {
  const config = getNetworkConfig();
  const expected = config.passphrase;

  if (actualPassphrase !== expected) {
    const currentNetwork = getCurrentNetwork();
    throw new Error(
      `Network passphrase mismatch! Expected ${currentNetwork} network. ` +
      `Got: "${actualPassphrase.substring(0, 20)}..." ` +
      `Expected: "${expected.substring(0, 20)}..."`
    );
  }

  return true;
}

/**
 * SECURITY: Check if a wallet is connected to the correct network
 * Call this before any transaction signing
 *
 * @param walletNetworkPassphrase - Passphrase from the connected wallet
 * @returns Object with validation result and error message if any
 */
export function checkWalletNetwork(walletNetworkPassphrase: string): {
  isCorrect: boolean;
  error?: string;
  expectedNetwork: NetworkType;
} {
  const config = getNetworkConfig();
  const expectedNetwork = getCurrentNetwork();

  if (walletNetworkPassphrase !== config.passphrase) {
    return {
      isCorrect: false,
      error: `Your wallet is connected to the wrong network. Please switch to ${config.name}.`,
      expectedNetwork,
    };
  }

  return {
    isCorrect: true,
    expectedNetwork,
  };
}
