/**
 * Application constants
 * Centralized place for magic numbers and configuration values
 */

// ===== Graduation Thresholds =====
export const GRADUATION_THRESHOLD_XLM = 30_000;
export const GRADUATION_THRESHOLD_STROOPS = BigInt(300_000_000_000);
export const GRADUATION_THRESHOLD_DISPLAY = '30,000 XLM';

// ===== Transaction Fees =====
export const TRANSACTION_FEE_STROOPS = '1000000'; // 0.1 XLM
export const TRANSACTION_FEE_XLM = 0.1;
export const CREATE_TOKEN_FEE_XLM = 0.01;

// ===== Polling Intervals (milliseconds) =====
export const PRICE_POLL_INTERVAL_MS = 30_000; // 30 seconds
export const BALANCE_POLL_INTERVAL_MS = 60_000; // 60 seconds
export const RECENT_TRADES_POLL_INTERVAL_MS = 15_000; // 15 seconds
export const TOKEN_TX_POLL_INTERVAL_MS = 10_000; // 10 seconds
export const LEADERBOARD_POLL_INTERVAL_MS = 60_000; // 60 seconds
export const WEBSOCKET_RECONNECT_INTERVAL_MS = 5_000; // 5 seconds

// ===== UI Timing (milliseconds) =====
export const TOAST_DISMISS_DELAY_MS = 2_000;
export const POLL_DELAY_MS = 1_000;
export const REDIRECT_DELAY_MS = 3_000;
export const CONFETTI_DELAY_MS = 500;
export const SUCCESS_REDIRECT_DELAY_MS = 5_000;

// ===== Transaction Confirmation =====
export const TX_CONFIRMATION_MAX_ATTEMPTS = 30;
export const TX_CONFIRMATION_POLL_MS = 1_000; // 1 second between polls

// ===== Trading Limits =====
export const MAX_HOLDINGS_PERCENTAGE = 50;
export const MIN_TRADE_AMOUNT_XLM = 0.1;
export const DEFAULT_SLIPPAGE_PERCENTAGE = 1;
export const SLIPPAGE_OPTIONS = [0.5, 1, 2, 5];

// ===== Quick Buy Amounts (XLM) =====
export const QUICK_BUY_AMOUNTS = [1, 5, 10, 50];
export const QUICK_SELL_PERCENTAGES = [25, 50, 75, 100];

// ===== Token Limits =====
export const MAX_TOKEN_NAME_LENGTH = 32;
export const MAX_TOKEN_SYMBOL_LENGTH = 12;
export const MAX_TOKEN_DESCRIPTION_LENGTH = 500;

// ===== Network Configuration =====
export const STELLAR_NETWORK = process.env.NEXT_PUBLIC_STELLAR_NETWORK || 'testnet';
export const STELLAR_EXPLORER_BASE_URL = STELLAR_NETWORK === 'mainnet'
  ? 'https://stellar.expert/explorer/public'
  : 'https://stellar.expert/explorer/testnet';

// ===== API Configuration =====
export const GRAPHQL_ENDPOINT = process.env.NEXT_PUBLIC_GRAPHQL_API || 'https://api-gateway-v2.vercel.app/graphql';

// ===== IPFS Gateway =====
export const IPFS_GATEWAY_URL = 'https://gateway.pinata.cloud/ipfs/';
export const IPFS_PROTOCOL_PREFIX = 'ipfs://';
