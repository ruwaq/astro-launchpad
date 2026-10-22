
    /**
 * Struct: InitializedEvent
 */
export interface InitializedEvent {
  setter: string;
}

/**
 * Struct: NewPairEvent
 */
export interface NewPairEvent {
  new_pairs_length: number;
  pair: string;
  token_0: string;
  token_1: string;
}

/**
 * Struct: FeeToSettedEvent
 */
export interface FeeToSettedEvent {
  new: string;
  old: string;
  setter: string;
}

/**
 * Struct: NewSetterEvent
 */
export interface NewSetterEvent {
  new: string;
  old: string;
}

/**
 * Struct: NewFeesEnabledEvent
 */
export interface NewFeesEnabledEvent {
  fees_enabled: boolean;
}

/**
 * Error Enum: PairError
 */
export const PairError = {
  /**
   * SoroswapFactory: token_a and token_b have identical addresses
   */
  901 : { message: "CreatePairIdenticalTokens" }
}

/**
 * Tuple Struct: Pair
 */
export type Pair = readonly [string, string];

/**
 * Union: DataKey
 */
 export type DataKey =
  { tag: "FeeTo"; values: void } |
  { tag: "FeeToSetter"; values: void } |
  { tag: "PairWasmHash"; values: void } |
  { tag: "FeesEnabled"; values: void } |
  { tag: "TotalPairs"; values: void } |
  { tag: "PairAddressesNIndexed"; values: readonly [number] } |
  { tag: "PairAddressesByTokens"; values: readonly [Pair] };

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
export type PairError = { message: string }
export type FactoryError = { message: string }
