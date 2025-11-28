/**
 * Centralized Network Configuration
 *
 * IMPORTANT: Update network settings HERE ONLY.
 * All apps/packages in the monorepo import from this single source of truth.
 */

// =============================================================================
// NETWORK TYPES
// =============================================================================

export type NetworkType = 'testnet' | 'mainnet' | 'futurenet';

export interface NetworkConfig {
  name: NetworkType;
  rpcUrl: string;
  horizonUrl: string;
  passphrase: string;
  friendbotUrl?: string;
}

// =============================================================================
// NETWORK CONFIGURATIONS
// =============================================================================

export const NETWORKS: Record<NetworkType, NetworkConfig> = {
  testnet: {
    name: 'testnet',
    rpcUrl: 'https://soroban-testnet.stellar.org',
    horizonUrl: 'https://horizon-testnet.stellar.org',
    passphrase: 'Test SDF Network ; September 2015',
    friendbotUrl: 'https://friendbot.stellar.org',
  },
  mainnet: {
    name: 'mainnet',
    rpcUrl: 'https://soroban.stellar.org',
    horizonUrl: 'https://horizon.stellar.org',
    passphrase: 'Public Global Stellar Network ; September 2015',
  },
  futurenet: {
    name: 'futurenet',
    rpcUrl: 'https://rpc-futurenet.stellar.org',
    horizonUrl: 'https://horizon-futurenet.stellar.org',
    passphrase: 'Test SDF Future Network ; October 2022',
    friendbotUrl: 'https://friendbot-futurenet.stellar.org',
  },
};

// =============================================================================
// CURRENT NETWORK (determined by environment)
// =============================================================================

/**
 * Get the current network based on environment
 * Defaults to testnet for development
 */
export function getCurrentNetwork(): NetworkType {
  const envNetwork = process.env.STELLAR_NETWORK || process.env.NEXT_PUBLIC_STELLAR_NETWORK;

  if (envNetwork && isValidNetwork(envNetwork)) {
    return envNetwork as NetworkType;
  }

  // Default to testnet
  return 'testnet';
}

/**
 * Get the full network configuration for the current network
 */
export function getNetworkConfig(network?: NetworkType): NetworkConfig {
  const targetNetwork = network || getCurrentNetwork();
  return NETWORKS[targetNetwork];
}

/**
 * Validate if a string is a valid network type
 */
export function isValidNetwork(network: string): network is NetworkType {
  return ['testnet', 'mainnet', 'futurenet'].includes(network);
}

// =============================================================================
// CONVENIENCE EXPORTS
// =============================================================================

/**
 * Current network configuration (for direct import)
 * Note: This is evaluated at import time, so use getNetworkConfig() for dynamic access
 */
export const CURRENT_NETWORK = getCurrentNetwork();
export const CURRENT_NETWORK_CONFIG = NETWORKS[CURRENT_NETWORK];

/**
 * Direct access to current network values
 */
export const RPC_URL = CURRENT_NETWORK_CONFIG.rpcUrl;
export const HORIZON_URL = CURRENT_NETWORK_CONFIG.horizonUrl;
export const NETWORK_PASSPHRASE = CURRENT_NETWORK_CONFIG.passphrase;
