/**
 * GraphQL Mutations
 * All mutations for modifying data via the API Gateway V2
 */

import { gql } from '@apollo/client';
import { TOKEN_FULL_FRAGMENT } from './fragments';

// ============================================================================
// Token Mutations
// ============================================================================

export const SYNC_TOKEN_MUTATION = gql`
  ${TOKEN_FULL_FRAGMENT}
  mutation SyncToken($tokenAddress: String!) {
    syncToken(tokenAddress: $tokenAddress) {
      ...TokenFullFragment
    }
  }
`;

// ============================================================================
// Mutation Response Types
// ============================================================================

export interface SyncTokenMutationResponse {
  syncToken: {
    id: string;
    address: string;
    name: string;
    symbol: string;
    // ... other token fields
  };
}

export interface SyncTokenVariables {
  tokenAddress: string;
}
