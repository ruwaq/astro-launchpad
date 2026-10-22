
    /**
 * Struct: InitializedEvent
 */
export interface InitializedEvent {
  factory: string;
}

/**
 * Struct: AddLiquidityEvent
 */
export interface AddLiquidityEvent {
  amount_a: bigint;
  amount_b: bigint;
  liquidity: bigint;
  pair: string;
  to: string;
  token_a: string;
  token_b: string;
}

/**
 * Struct: RemoveLiquidityEvent
 */
export interface RemoveLiquidityEvent {
  amount_a: bigint;
  amount_b: bigint;
  liquidity: bigint;
  pair: string;
  to: string;
  token_a: string;
  token_b: string;
}

/**
 * Struct: SwapEvent
 */
export interface SwapEvent {
  amounts: Array<bigint>;
  path: Array<string>;
  to: string;
}

/**
 * Error Enum: SoroswapRouterError
 */
export const SoroswapRouterError = {
  /**
   * SoroswapRouter: not yet initialized
   */
  401 : { message: "NotInitialized" },
  /**
   * SoroswapRouter: negative amount is not allowed
   */
  402 : { message: "NegativeNotAllowed" },
  /**
   * SoroswapRouter: deadline expired
   */
  403 : { message: "DeadlineExpired" },
  /**
   * SoroswapRouter: already initialized
   */
  404 : { message: "InitializeAlreadyInitialized" },
  /**
   * SoroswapRouter: insufficient a amount
   */
  405 : { message: "InsufficientAAmount" },
  /**
   * SoroswapRouter: insufficient b amount
   */
  406 : { message: "InsufficientBAmount" },
  /**
   * SoroswapRouter: insufficient output amount
   */
  407 : { message: "InsufficientOutputAmount" },
  /**
   * SoroswapRouter: excessive input amount
   */
  408 : { message: "ExcessiveInputAmount" },
  /**
   * SoroswapRouter: pair does not exist
   */
  409 : { message: "PairDoesNotExist" }
}

/**
 * Error Enum: CombinedRouterError
 */
export const CombinedRouterError = {
  501 : { message: "RouterNotInitialized" },
  502 : { message: "RouterNegativeNotAllowed" },
  503 : { message: "RouterDeadlineExpired" },
  504 : { message: "RouterInitializeAlreadyInitialized" },
  505 : { message: "RouterInsufficientAAmount" },
  506 : { message: "RouterInsufficientBAmount" },
  507 : { message: "RouterInsufficientOutputAmount" },
  508 : { message: "RouterExcessiveInputAmount" },
  509 : { message: "RouterPairDoesNotExist" },
  510 : { message: "LibraryInsufficientAmount" },
  511 : { message: "LibraryInsufficientLiquidity" },
  512 : { message: "LibraryInsufficientInputAmount" },
  513 : { message: "LibraryInsufficientOutputAmount" },
  514 : { message: "LibraryInvalidPath" },
  515 : { message: "LibrarySortIdenticalTokens" }
}

/**
 * Error Enum: SoroswapLibraryError
 */
export const SoroswapLibraryError = {
  /**
   * SoroswapLibrary: insufficient amount
   */
  301 : { message: "InsufficientAmount" },
  /**
   * SoroswapLibrary: insufficient liquidity
   */
  302 : { message: "InsufficientLiquidity" },
  /**
   * SoroswapLibrary: insufficient input amount
   */
  303 : { message: "InsufficientInputAmount" },
  /**
   * SoroswapLibrary: insufficient output amount
   */
  304 : { message: "InsufficientOutputAmount" },
  /**
   * SoroswapLibrary: invalid path
   */
  305 : { message: "InvalidPath" },
  /**
   * SoroswapLibrary: token_a and token_b have identical addresses
   */
  306 : { message: "SortIdenticalTokens" }
}

// Alias de tipo para los enums de error (usados como tipo en las firmas).
export type SoroswapRouterError = { message: string }
export type CombinedRouterError = { message: string }
export type SoroswapLibraryError = { message: string }
