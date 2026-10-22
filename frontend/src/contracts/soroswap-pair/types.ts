
    /**
 * Struct: AllowanceDataKey
 */
export interface AllowanceDataKey {
  from: string;
  spender: string;
}

/**
 * Struct: AllowanceValue
 */
export interface AllowanceValue {
  amount: bigint;
  expiration_ledger: number;
}

/**
 * Union: DataKey
 */
 export type DataKey =
  { tag: "Allowance"; values: readonly [AllowanceDataKey] } |
  { tag: "Balance"; values: readonly [string] } |
  { tag: "TotalSupply"; values: void };

/**
 * Struct: DepositEvent
 */
export interface DepositEvent {
  amount_0: bigint;
  amount_1: bigint;
  liquidity: bigint;
  new_reserve_0: bigint;
  new_reserve_1: bigint;
  to: string;
}

/**
 * Struct: SwapEvent
 */
export interface SwapEvent {
  amount_0_in: bigint;
  amount_0_out: bigint;
  amount_1_in: bigint;
  amount_1_out: bigint;
  to: string;
}

/**
 * Struct: WithdrawEvent
 */
export interface WithdrawEvent {
  amount_0: bigint;
  amount_1: bigint;
  liquidity: bigint;
  new_reserve_0: bigint;
  new_reserve_1: bigint;
  to: string;
}

/**
 * Struct: SyncEvent
 */
export interface SyncEvent {
  new_reserve_0: bigint;
  new_reserve_1: bigint;
}

/**
 * Struct: SkimEvent
 */
export interface SkimEvent {
  skimmed_0: bigint;
  skimmed_1: bigint;
}

/**
 * Error Enum: SoroswapPairError
 */
export const SoroswapPairError = {
  /**
   * SoroswapPair: already initialized
   */
  101 : { message: "InitializeAlreadyInitialized" },
  /**
   * SoroswapPair: not yet initialized
   */
  102 : { message: "NotInitialized" },
  /**
   * SoroswapPair: token_0 must be less than token_1 while initializing
   */
  103 : { message: "InitializeTokenOrderInvalid" },
  /**
   * SoroswapPair: insufficient amount of token 0 sent while doing deposit
   */
  104 : { message: "DepositInsufficientAmountToken0" },
  /**
   * SoroswapPair: insufficient amount of token 1 sent while doing deposit
   */
  105 : { message: "DepositInsufficientAmountToken1" },
  /**
   * SoroswapPair: insufficient first liquidity minted while doing deposit
   */
  106 : { message: "DepositInsufficientFirstLiquidity" },
  /**
   * SoroswapPair: insufficient liquidity minted while doing deposit
   */
  107 : { message: "DepositInsufficientLiquidityMinted" },
  /**
   * SoroswapPair: insufficient output amount while doing deposDepositit
   */
  108 : { message: "SwapInsufficientOutputAmount" },
  /**
   * SoroswapPair: negatives amounts out dont supported while doing swap
   */
  109 : { message: "SwapNegativesOutNotSupported" },
  /**
   * SoroswapPair: insufficient liquidity to do the swap
   */
  110 : { message: "SwapInsufficientLiquidity" },
  /**
   * SoroswapPair: invalid to to do the swap
   */
  111 : { message: "SwapInvalidTo" },
  /**
   * SoroswapPair: insufficient input amount while doing swap
   */
  112 : { message: "SwapInsufficientInputAmount" },
  /**
   * SoroswapPair: negatives amounts in dont supported while doing swap
   */
  113 : { message: "SwapNegativesInNotSupported" },
  /**
   * SoroswapPair: K constant is not met while doing swap
   */
  114 : { message: "SwapKConstantNotMet" },
  /**
   * SoroswapPair: liquidity was not initialized yet while doing withdraw
   */
  115 : { message: "WithdrawLiquidityNotInitialized" },
  /**
   * SoroswapPair: insufficient sent shares while doing withdraw
   */
  116 : { message: "WithdrawInsufficientSentShares" },
  /**
   * SoroswapPair: insufficient liquidity burned while doing withdraw
   */
  117 : { message: "WithdrawInsufficientLiquidityBurned" },
  /**
   * SoroswapPair: OVERFLOW while updating
   */
  118 : { message: "UpdateOverflow" }
}

/**
 * Struct: TokenMetadata
 */
export interface TokenMetadata {
  decimal: number;
  name: string;
  symbol: string;
}

/**
 * Error Enum: FactoryError
 */
export const FactoryError = {
  /**
   * SoroswapFactory: not yet initialized
   */
  201 : { message: "NotInitialized" },
  /**
   * SoroswapFactory: token_a and token_b have identical addresses
   */
  202 : { message: "CreatePairIdenticalTokens" },
  /**
   * SoroswapFactory: pair already exists between token_a and token_b
   */
  203 : { message: "CreatePairAlreadyExists" },
  /**
   * SoroswapFactory: already initialized
   */
  204 : { message: "InitializeAlreadyInitialized" },
  /**
   * SoroswapFactory: pair does not exist
   */
  205 : { message: "PairDoesNotExist" },
  /**
   * SoroswapFactory: index does not exist
   */
  206 : { message: "IndexDoesNotExist" }
}

// Alias de tipo para los enums de error (usados como tipo en las firmas).
export type SoroswapPairError = { message: string }
export type FactoryError = { message: string }
