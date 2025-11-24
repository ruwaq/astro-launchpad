/**
 * Fee Stats Service Wrapper for API Gateway
 * 
 * Re-exports the FeeStatsService from indexer for use in API resolvers.
 * This maintains separation of concerns while allowing shared business logic.
 */

import { PrismaClient } from '@prisma/client';
import { FeeStatsService as IndexerFeeStatsService } from '../../../indexer/src/services/fee-stats.service.js';

/**
 * Fee Stats Service for API Gateway
 * 
 * This is a wrapper around the indexer's FeeStatsService to provide
 * fee statistics and analytics to GraphQL resolvers.
 */
export class FeeStatsService extends IndexerFeeStatsService {
  constructor(prisma: PrismaClient) {
    super(prisma);
  }
}

/**
 * Export for convenience
 */
export { IndexerFeeStatsService };