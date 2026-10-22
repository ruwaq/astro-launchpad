
    /**
 * Error Enum: RoleTransferError
 */
export const RoleTransferError = {
  2200 : { message: "NoPendingTransfer" },
  2201 : { message: "InvalidLiveUntilLedger" },
  2202 : { message: "InvalidPendingAccount" },
  2203 : { message: "TransferExpired" }
}

/**
 * Error Enum: OwnableError
 */
export const OwnableError = {
  2100 : { message: "OwnerNotSet" },
  2101 : { message: "TransferInProgress" },
  2102 : { message: "OwnerAlreadySet" }
}

/**
 * Event emitted when an ownership transfer is initiated.
 */
export interface OwnershipTransferEvent {
  name: "OwnershipTransfer";
  data: {
    old_owner?: string;
    new_owner?: string;
    live_until_ledger?: number;
  };
}

/**
 * Event emitted when ownership is renounced.
 */
export interface OwnershipRenouncedEvent {
  name: "OwnershipRenounced";
  data: {
    old_owner?: string;
  };
}

/**
 * Event emitted when an ownership transfer is completed.
 */
export interface OwnershipTransferCompletedEvent {
  name: "OwnershipTransferCompleted";
  data: {
    new_owner?: string;
  };
}

/**
 * Event emitted when tokens are burned.
 */
export interface BurnEvent {
  name: "Burn";
  data: {
    from: string;
    amount?: bigint;
  };
}

/**
 * Event emitted when tokens are minted.
 */
export interface MintEvent {
  name: "Mint";
  data: {
    to: string;
    amount?: bigint;
  };
}

/**
 * Event emitted when an allowance is approved.
 */
export interface ApproveEvent {
  name: "Approve";
  data: {
    owner: string;
    spender: string;
    amount?: bigint;
    live_until_ledger?: number;
  };
}

/**
 * Event emitted when tokens are transferred between addresses without a
 * muxed destination.
 *
 * Per SEP-41, the event data is a bare `i128` when no muxed address is
 * involved. The `data_format = "single-value"` attribute ensures the
 * `amount` field is serialized as a bare value rather than a map.
 */
export interface TransferEvent {
  name: "Transfer";
  data: {
    from: string;
    to: string;
    amount: bigint;
  };
}

/**
 * Event emitted when tokens are transferred to a muxed address.
 *
 * Per SEP-41, when the destination is a [`MuxedAddress`] the event data
 * carries both the amount and the muxed identifier so that off-chain
 * consumers can attribute the transfer to the correct sub-account.
 *
 * Uses `topics = ["transfer"]` so that both [`Transfer`] and
 * [`MuxedTransfer`] share the same `"transfer"` event symbol, as required
 * by SEP-41.
 */
export interface MuxedTransferEvent {
  name: "MuxedTransfer";
  data: {
    from: string;
    to: string;
    to_muxed_id?: bigint | null;
    amount?: bigint;
  };
}

/**
 * Error Enum: FungibleTokenError
 */
export const FungibleTokenError = {
  /**
   * Indicates an error related to the current balance of account from which
   * tokens are expected to be transferred.
   */
  100 : { message: "InsufficientBalance" },
  /**
   * Indicates a failure with the allowance mechanism when a given spender
   * doesn't have enough allowance.
   */
  101 : { message: "InsufficientAllowance" },
  /**
   * Indicates an invalid value for `live_until_ledger` when setting an
   * allowance.
   */
  102 : { message: "InvalidLiveUntilLedger" },
  /**
   * Indicates an error when an input that must be >= 0
   */
  103 : { message: "LessThanZero" },
  /**
   * Indicates an overflow or underflow in an arithmetic operation
   */
  104 : { message: "MathOverflow" },
  /**
   * Indicates access to uninitialized metadata
   */
  105 : { message: "UnsetMetadata" },
  /**
   * Indicates that the operation would have caused `total_supply` to exceed
   * the `cap`.
   */
  106 : { message: "ExceededCap" },
  /**
   * Indicates the supplied `cap` is not a valid cap value.
   */
  107 : { message: "InvalidCap" },
  /**
   * Indicates the Cap was not set.
   */
  108 : { message: "CapNotSet" },
  /**
   * Indicates the SAC address was not set.
   */
  109 : { message: "SACNotSet" },
  /**
   * Indicates a SAC address different than expected.
   */
  110 : { message: "SACAddressMismatch" },
  /**
   * Indicates a missing function parameter in the SAC contract context.
   */
  111 : { message: "SACMissingFnParam" },
  /**
   * Indicates an invalid function parameter in the SAC contract context.
   */
  112 : { message: "SACInvalidFnParam" },
  /**
   * The user is not allowed to perform this operation
   */
  113 : { message: "UserNotAllowed" },
  /**
   * The user is blocked and cannot perform this operation
   */
  114 : { message: "UserBlocked" }
}
    export type ContractEvent = OwnershipTransferEvent | OwnershipRenouncedEvent | OwnershipTransferCompletedEvent | BurnEvent | MintEvent | ApproveEvent | TransferEvent | MuxedTransferEvent;

// Alias de tipo para los enums de error (usados como tipo en las firmas).
export type RoleTransferError = { message: string }
export type OwnableError = { message: string }
export type FungibleTokenError = { message: string }
