
    /**
 * Event: ShoutEvent
 */
export interface ShoutEventEvent {
  name: "ShoutEvent";
  data: {
    token: string;
    sender?: string;
    amount?: bigint;
    message?: string;
    ledger?: number;
  };
}

/**
 * Struct: ShoutRecord
 */
export interface ShoutRecord {
  amount: bigint;
  ledger: number;
  message: string;
  sender: string;
  timestamp: bigint;
}

/**
 * Struct: LaunchParams
 */
export interface LaunchParams {
  creator: string;
  decimals: number;
  initial_supply: bigint;
  name: string;
  salt: Uint8Array;
  symbol: string;
  token_lp_amount: bigint;
  xlm_lp_amount: bigint;
}

/**
 * Struct: LaunchRecord
 */
export interface LaunchRecord {
  creator: string;
  decimals: number;
  index: number;
  initial_supply: bigint;
  ledger: number;
  lp_minted: bigint;
  meta: string;
  name: string;
  pair: string;
  symbol: string;
  timestamp: bigint;
  token: string;
  token_lp_amount: bigint;
  xlm_lp_amount: bigint;
}

/**
 * Struct: LaunchResult
 */
export interface LaunchResult {
  lp_minted: bigint;
  pair: string;
  token: string;
}

/**
 * Error Enum: LaunchpadError
 */
export const LaunchpadError = {
  /**
   * Instance configuration missing from contract storage.
   */
  1 : { message: "NotInitialized" },
  /**
   * Invalid supply, LP seed amount, or burn shout amount.
   */
  2 : { message: "InvalidAmount" },
  /**
   * The token/XLM pair already existed with non-zero reserves: liquidity will
   * not be added on top of an external pair.
   */
  3 : { message: "PairAlreadySeeded" },
  /**
   * Token metadata, shout message, or off-chain JSON metadata violates bounds.
   */
  4 : { message: "InvalidMetadata" }
}

/**
 * Minimalist fair-launch parameters: supply (1B), decimals (7), and 99.5% LP
 * allocation are enforced on-chain, reducing user input to identity + seed XLM.
 */
export interface FairLaunchParams {
  creator: string;
  meta: string;
  name: string;
  salt: Uint8Array;
  symbol: string;
  xlm_lp_amount: bigint;
}

/**
 * Event: TokenLaunchedEvent
 */
export interface TokenLaunchedEventEvent {
  name: "TokenLaunchedEvent";
  data: {
    creator: string;
    token?: string;
    pair?: string;
    initial_supply?: bigint;
    token_lp_amount?: bigint;
    xlm_lp_amount?: bigint;
    lp_minted?: bigint;
  };
}
    export type ContractEvent = ShoutEventEvent | TokenLaunchedEventEvent;

// Alias de tipo para los enums de error (usados como tipo en las firmas).
export type LaunchpadError = { message: string }
