/**
 * Circuit Breaker Pattern Implementation
 *
 * Provides automatic failure detection and recovery for the Soroban RPC connection.
 * Uses exponential backoff to prevent overwhelming a failing service.
 *
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Too many failures, requests are blocked
 * - HALF_OPEN: Testing if service has recovered
 */

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  successThreshold: number;
  timeout: number;
  resetTimeout: number;
  maxDelay: number;
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private successCount: number = 0;
  private lastFailureTime: number | null = null;
  private currentDelay: number;

  constructor(private config: CircuitBreakerConfig) {
    this.currentDelay = config.timeout;
  }

  /**
   * Execute an operation with circuit breaker protection
   */
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.state = CircuitState.HALF_OPEN;
        console.log('Circuit breaker entering HALF_OPEN state');
      } else {
        throw new Error(`Circuit breaker is OPEN. Retry in ${this.getTimeUntilRetry()}ms`);
      }
    }

    try {
      const result = await this.executeWithTimeout(operation);
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Execute operation with timeout
   */
  private async executeWithTimeout<T>(operation: () => Promise<T>): Promise<T> {
    return Promise.race([
      operation(),
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error('Operation timeout')), this.config.timeout)
      ),
    ]);
  }

  /**
   * Handle successful operation
   */
  private onSuccess(): void {
    this.failureCount = 0;

    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= this.config.successThreshold) {
        this.state = CircuitState.CLOSED;
        this.successCount = 0;
        this.currentDelay = this.config.timeout;
        console.log('Circuit breaker CLOSED - service recovered');
      }
    }
  }

  /**
   * Handle failed operation with exponential backoff
   */
  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === CircuitState.HALF_OPEN) {
      this.state = CircuitState.OPEN;
      this.successCount = 0;
      console.log('Circuit breaker OPEN - service still failing');
    }

    if (this.failureCount >= this.config.failureThreshold) {
      this.state = CircuitState.OPEN;
      // Exponential backoff: double the delay up to maxDelay
      this.currentDelay = Math.min(this.currentDelay * 2, this.config.maxDelay);
      console.log(
        `Circuit breaker OPEN after ${this.failureCount} failures. Next retry in ${this.currentDelay}ms`
      );
    }
  }

  /**
   * Check if enough time has passed to attempt reset
   */
  private shouldAttemptReset(): boolean {
    if (!this.lastFailureTime) return false;
    const timeSinceLastFailure = Date.now() - this.lastFailureTime;
    return timeSinceLastFailure >= this.currentDelay;
  }

  /**
   * Get time remaining until next retry attempt
   */
  private getTimeUntilRetry(): number {
    if (!this.lastFailureTime) return 0;
    const timeSinceLastFailure = Date.now() - this.lastFailureTime;
    return Math.max(0, this.currentDelay - timeSinceLastFailure);
  }

  /**
   * Get current circuit breaker state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Get current failure count
   */
  getFailureCount(): number {
    return this.failureCount;
  }

  /**
   * Manually reset the circuit breaker
   */
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
    this.currentDelay = this.config.timeout;
    console.log('Circuit breaker manually reset');
  }

  /**
   * Get circuit breaker statistics
   */
  getStats() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      currentDelay: this.currentDelay,
      timeUntilRetry: this.getTimeUntilRetry(),
    };
  }
}

/**
 * Factory function to create a circuit breaker with default config
 */
export function createCircuitBreaker(
  overrides?: Partial<CircuitBreakerConfig>
): CircuitBreaker {
  const defaultConfig: CircuitBreakerConfig = {
    failureThreshold: 5, // Open after 5 failures
    successThreshold: 2, // Require 2 successes to close
    timeout: 30000, // 30 second timeout
    resetTimeout: 60000, // Try reset after 60 seconds
    maxDelay: 300000, // Max 5 minutes between retries
  };

  return new CircuitBreaker({ ...defaultConfig, ...overrides });
}
