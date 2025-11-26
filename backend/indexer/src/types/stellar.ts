/**
 * Stellar / Soroban Types
 * Definitions for Soroban RPC responses based on @stellar/stellar-sdk
 */

export interface SorobanEvent {
  type: string;
  ledger: string;
  ledgerClosedAt: string;
  contractId: string;
  id: string;
  pagingToken: string;
  topic: string[];
  value: {
    xdr: string;
  };
  inSuccessfulContractCall: boolean;
}

// Helper to replace any
export type StellarEvent = SorobanEvent;
