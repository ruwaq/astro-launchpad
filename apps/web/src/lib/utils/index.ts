/**
 * Utility functions barrel export
 * Import utilities from '@/lib/utils'
 */

// Core utils
export { cn } from '../utils';

// Formatting utilities
export {
  formatAddress,
  formatNumber,
  formatXLM,
  formatPercentage,
  formatRelativeTime,
  truncateText,
} from './format';

// IPFS utilities
export { getIpfsUrl, getImageUrl } from './ipfs';

// Error handling
export {
  extractErrorMessage,
  parseContractError,
  isUserCancellation,
  logError,
  logWarning,
} from './errors';

// GraphQL utilities
export * from './graphql.utils';
