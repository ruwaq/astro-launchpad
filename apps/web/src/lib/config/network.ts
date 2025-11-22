/**
 * Network Configuration
 * Modular system para fácil migración de testnet a mainnet
 */

export type NetworkType = 'testnet' | 'mainnet';

export interface NetworkConfig {
  name: string;
  contractId: string;
  rpcUrl: string;
  horizonUrl: string;
  passphrase: string;
}

const TESTNET_CONFIG: NetworkConfig = {
  name: 'Testnet',
  contractId: process.env.NEXT_PUBLIC_TESTNET_CONTRACT_ID || '',
  rpcUrl: process.env.NEXT_PUBLIC_TESTNET_RPC_URL || 'https://soroban-testnet.stellar.org',
  horizonUrl: process.env.NEXT_PUBLIC_TESTNET_HORIZON_URL || 'https://horizon-testnet.stellar.org',
  passphrase: process.env.NEXT_PUBLIC_TESTNET_PASSPHRASE || 'Test SDF Network ; September 2015',
};

const MAINNET_CONFIG: NetworkConfig = {
  name: 'Mainnet',
  contractId: process.env.NEXT_PUBLIC_MAINNET_CONTRACT_ID || '',
  rpcUrl: process.env.NEXT_PUBLIC_MAINNET_RPC_URL || 'https://soroban.stellar.org',
  horizonUrl: process.env.NEXT_PUBLIC_MAINNET_HORIZON_URL || 'https://horizon.stellar.org',
  passphrase: process.env.NEXT_PUBLIC_MAINNET_PASSPHRASE || 'Public Global Stellar Network ; September 2015',
};

/**
 * Get current network from environment
 */
export function getCurrentNetwork(): NetworkType {
  const network = process.env.NEXT_PUBLIC_NETWORK as NetworkType;
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
 */
export function getApiUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
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
