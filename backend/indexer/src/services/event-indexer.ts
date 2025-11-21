import { PrismaClient } from '@prisma/client';
import { Server, Horizon } from '@stellar/stellar-sdk';
import { logger } from '../lib/logger.js';
import { CircuitBreaker, DEFAULT_CIRCUIT_BREAKER_CONFIG, CircuitState } from '../lib/circuit-breaker.js';
import { TokenEventHandler } from './handlers/token-events.js';
import { PoolEventHandler } from './handlers/pool-events.js';

export class EventIndexer {
  private server: Server;
  private tokenFactory: string;
  private ammFactory: string | null;
  private eventStreams: any[] = [];
  private circuitBreaker: CircuitBreaker;
  private reconnectTimers: NodeJS.Timeout[] = [];
  private isShuttingDown: boolean = false;

  constructor(private prisma: PrismaClient) {
    const rpcUrl = process.env.STELLAR_RPC_URL!;
    this.server = new Server(rpcUrl);
    this.tokenFactory = process.env.TOKEN_FACTORY_CONTRACT_ID!;
    this.ammFactory = process.env.AMM_FACTORY_CONTRACT_ID || null;

    // Initialize circuit breaker for connection management
    this.circuitBreaker = new CircuitBreaker({
      ...DEFAULT_CIRCUIT_BREAKER_CONFIG,
      maxRetries: 10, // Allow more retries for critical indexer
      maxDelay: 600000, // Max 10 minutes backoff
    });
  }

  async start() {
    logger.info('Starting event streams...');

    // Index Token Factory events
    await this.indexTokenFactory();

    // Index AMM events (if deployed)
    if (this.ammFactory) {
      await this.indexAMMFactory();
    }

    logger.info('Event streams started');
  }

  async stop() {
    logger.info('Stopping event streams...');
    this.isShuttingDown = true;

    // Clear all reconnect timers
    for (const timer of this.reconnectTimers) {
      clearTimeout(timer);
    }
    this.reconnectTimers = [];

    // Stop all streams
    for (const stream of this.eventStreams) {
      if (stream && typeof stream === 'function') {
        stream();
      }
    }
    this.eventStreams = [];

    logger.info('All streams stopped');
  }

  getStatus() {
    const cbStats = this.circuitBreaker.getStats();
    return {
      isRunning: !this.isShuttingDown,
      activeStreams: this.eventStreams.length,
      circuitBreaker: cbStats,
      health: cbStats.state === CircuitState.CLOSED ? 'healthy' : 'degraded',
    };
  }

  private async indexTokenFactory() {
    if (this.isShuttingDown) {
      logger.info('Shutdown in progress, not starting Token Factory stream');
      return;
    }

    const tokenHandler = new TokenEventHandler(this.prisma);

    try {
      await this.circuitBreaker.execute(async () => {
        // Get last indexed ledger from database
        const lastIndexed = await this.getLastIndexedLedger('token_factory');
        const cursor = lastIndexed || 'now';

        logger.info(`Starting Token Factory stream from cursor: ${cursor}`);

        const stream = this.server
          .events()
          .forContract(this.tokenFactory)
          .cursor(cursor)
          .stream({
            onmessage: async (event: Horizon.ServerApi.EventRecord) => {
              try {
                await this.handleTokenFactoryEvent(event, tokenHandler);
                await this.updateLastIndexedLedger('token_factory', event.ledger);
              } catch (error) {
                logger.error('Error handling Token Factory event:', error);
              }
            },
            onerror: (error: any) => {
              logger.error('Token Factory stream error:', error);
              this.handleStreamError('token_factory', () => this.indexTokenFactory());
            },
          });

        this.eventStreams.push(stream);
        logger.info('Token Factory stream started successfully');
      });
    } catch (error) {
      logger.error('Failed to start Token Factory stream:', error);
      this.handleStreamError('token_factory', () => this.indexTokenFactory());
    }
  }

  private async indexAMMFactory() {
    if (!this.ammFactory) return;
    if (this.isShuttingDown) {
      logger.info('Shutdown in progress, not starting AMM Factory stream');
      return;
    }

    const poolHandler = new PoolEventHandler(this.prisma);

    try {
      await this.circuitBreaker.execute(async () => {
        const lastIndexed = await this.getLastIndexedLedger('amm_factory');
        const cursor = lastIndexed || 'now';

        logger.info(`Starting AMM Factory stream from cursor: ${cursor}`);

        const stream = this.server
          .events()
          .forContract(this.ammFactory!)
          .cursor(cursor)
          .stream({
            onmessage: async (event: Horizon.ServerApi.EventRecord) => {
              try {
                await this.handleAMMEvent(event, poolHandler);
                await this.updateLastIndexedLedger('amm_factory', event.ledger);
              } catch (error) {
                logger.error('Error handling AMM event:', error);
              }
            },
            onerror: (error: any) => {
              logger.error('AMM stream error:', error);
              this.handleStreamError('amm_factory', () => this.indexAMMFactory());
            },
          });

        this.eventStreams.push(stream);
        logger.info('AMM Factory stream started successfully');
      });
    } catch (error) {
      logger.error('Failed to start AMM stream:', error);
      this.handleStreamError('amm_factory', () => this.indexAMMFactory());
    }
  }

  /**
   * Handles stream errors with circuit breaker pattern
   * Implements exponential backoff and automatic recovery
   */
  private handleStreamError(streamName: string, reconnectFn: () => Promise<void>) {
    if (this.isShuttingDown) {
      logger.info(`Shutdown in progress, not reconnecting ${streamName}`);
      return;
    }

    const cbStats = this.circuitBreaker.getStats();

    logger.warn(`Stream ${streamName} disconnected. Circuit breaker state: ${cbStats.state}`);

    if (cbStats.state === CircuitState.OPEN) {
      logger.error(
        `Circuit breaker is OPEN. Will attempt reconnect in ${cbStats.currentDelay / 1000}s`
      );
    }

    // Schedule reconnection attempt with circuit breaker delay
    const timer = setTimeout(async () => {
      if (!this.isShuttingDown) {
        logger.info(`Attempting to reconnect ${streamName}...`);
        try {
          await reconnectFn();
        } catch (error) {
          logger.error(`Reconnection attempt for ${streamName} failed:`, error);
        }
      }
    }, cbStats.currentDelay);

    this.reconnectTimers.push(timer);
  }

  private async handleTokenFactoryEvent(
    event: Horizon.ServerApi.EventRecord,
    handler: TokenEventHandler
  ) {
    const eventType = this.getEventType(event);

    logger.debug(`Token Factory event: ${eventType}`);

    switch (eventType) {
      case 'created':
        await handler.handleTokenCreated(event);
        break;
      case 'buy':
        await handler.handleTokenBuy(event);
        break;
      case 'sell':
        await handler.handleTokenSell(event);
        break;
      case 'graduate':
        await handler.handleTokenGraduated(event);
        break;
      default:
        logger.warn(`Unknown Token Factory event type: ${eventType}`);
    }
  }

  private async handleAMMEvent(
    event: Horizon.ServerApi.EventRecord,
    handler: PoolEventHandler
  ) {
    const eventType = this.getEventType(event);

    logger.debug(`AMM event: ${eventType}`);

    switch (eventType) {
      case 'liq_add':
        await handler.handleLiquidityAdded(event);
        break;
      case 'liq_rm':
        await handler.handleLiquidityRemoved(event);
        break;
      case 'swap':
        await handler.handleSwap(event);
        break;
      default:
        logger.warn(`Unknown AMM event type: ${eventType}`);
    }
  }

  private getEventType(event: Horizon.ServerApi.EventRecord): string {
    // Extract event type from topics
    // Soroban events have topics as Symbol short strings
    try {
      if (event.topic && Array.isArray(event.topic) && event.topic.length > 0) {
        return event.topic[0].toString();
      }
      return 'unknown';
    } catch (error) {
      logger.error('Error extracting event type:', error);
      return 'unknown';
    }
  }

  private async getLastIndexedLedger(contract: string): Promise<string | null> {
    // In production, store this in database
    // For MVP, start from 'now'
    return null;
  }

  private async updateLastIndexedLedger(contract: string, ledger: string) {
    // In production, update database with last indexed ledger
    // This allows resuming from last position on restart
  }
}
