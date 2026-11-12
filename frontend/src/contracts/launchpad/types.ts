
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
  1 : { message: "NotInitialized" },
  2 : { message: "InvalidAmount" },
  /**
   * El par token/XLM ya existía y tiene reservas: no se va a añadir
   * liquidez encima de un par ajeno (el LP acuñado sería colateral de
   * una posición que este launchpad no controla).
   */
  3 : { message: "PairAlreadySeeded" },
  4 : { message: "InvalidMetadata" }
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
    export type ContractEvent = TokenLaunchedEventEvent;

// Alias de tipo para los enums de error (usados como tipo en las firmas).
export type LaunchpadError = { message: string }
