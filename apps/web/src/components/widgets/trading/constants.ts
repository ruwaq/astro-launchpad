/**
 * Trading Widget Constants
 */

// Popular Stellar Testnet Tokens for testing
export const TESTNET_TOKENS = [
  {
    address: 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA',
    classicIssuer: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
    name: 'USD Coin (Testnet)',
    symbol: 'USDC',
    imageUrl: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png',
    isTestnet: true,
    decimals: 7,
    description: 'Get testnet USDC from Circle Faucet',
  },
  {
    address: 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
    name: 'Native Stellar Lumens',
    symbol: 'XLM',
    imageUrl: 'https://stellar.org/favicon.ico',
    isTestnet: true,
    decimals: 7,
    description: 'Get testnet XLM from Stellar Friendbot',
  },
  {
    address: 'CA3D5KRYM6CB7OWQ6TWYRR3Z4T7GNZLKERYNZGGA5SOAOPIFY6YQGAXE',
    name: 'Testnet Token A',
    symbol: 'TTA',
    imageUrl: 'https://via.placeholder.com/32/3b82f6/ffffff?text=TTA',
    isTestnet: true,
    decimals: 7,
    description: 'Example testnet token for testing trades',
  },
  {
    address: 'CBGTG5WCUFKYTQGIOAOYUD7GZ4KXOYAIQX2ESMNKTVFHOXDS7G2Y7BOQ',
    name: 'Testnet Token B',
    symbol: 'TTB',
    imageUrl: 'https://via.placeholder.com/32/8b5cf6/ffffff?text=TTB',
    isTestnet: true,
    decimals: 7,
    description: 'Another testnet token for testing',
  },
];

// Simulated prices for testnet tokens (demo purposes)
export const SIMULATED_PRICES: Record<string, number> = {
  'USDC': 12.5,
  'EURC': 11.8,
  'XLM': 1,
  'TTA': 50,
  'TTB': 25,
  'AQUA': 100,
};

export const DEFAULT_SIMULATED_PRICE = 10;
export const STROOPS_PER_XLM = 10_000_000;
export const QUICK_AMOUNTS = [1, 10, 100];

/**
 * @deprecated Slippage doesn't apply to bonding curves - pricing is deterministic.
 * Only kept for backwards compatibility.
 */
export const SLIPPAGE_OPTIONS = [0.5, 1, 2, 5];
