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
  mutation SyncToken(
    $tokenAddress: String!
    $name: String
    $symbol: String
    $creator: String
    $imageUrl: String
    $description: String
    $website: String
    $telegram: String
  ) {
    syncToken(
      tokenAddress: $tokenAddress
      name: $name
      symbol: $symbol
      creator: $creator
      imageUrl: $imageUrl
      description: $description
      website: $website
      telegram: $telegram
    ) {
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
  name?: string;
  symbol?: string;
  creator?: string;
  imageUrl?: string;
  description?: string;
  website?: string;
  telegram?: string;
}
