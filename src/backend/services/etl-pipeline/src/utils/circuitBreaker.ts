/**
 * Circuit Breaker pattern implementation for fault tolerance
 */

import { EventEmitter } from 'events';
import { logger } from './logger';

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

export interface CircuitBreakerOptions {
  failureThreshold: number;
  successThreshold: number;
  timeout: number;
  resetTimeout: number;
  name: string;
}

export class CircuitBreaker extends EventEmitter {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime?: Date;
  private resetTimer?: NodeJS.Timeout;
  
  constructor(private options: CircuitBreakerOptions) {
    super();
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      const now = Date.now();
      const lastFailure = this.lastFailureTime?.getTime() || 0;
      
      if (now - lastFailure < this.options.resetTimeout) {
        throw new Error(`Circuit breaker is OPEN for ${this.options.name}`);
      }
      
      // Try to move to half-open state
      this.state = CircuitState.HALF_OPEN;
      logger.info(`Circuit breaker moving to HALF_OPEN`, { name: this.options.name });
    }

    try {
      // Set timeout for the operation
      const result = await this.withTimeout(fn(), this.options.timeout);
      
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error);
      throw error;
    }
  }

  /**
   * Record a successful operation
   */
  private onSuccess(): void {
    this.failureCount = 0;
    
    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      
      if (this.successCount >= this.options.successThreshold) {
        this.state = CircuitState.CLOSED;
        this.successCount = 0;
        logger.info(`Circuit breaker CLOSED`, { name: this.options.name });
        this.emit('stateChange', CircuitState.CLOSED);
      }
    }
  }

  /**
   * Record a failed operation
   */
  private onFailure(error: any): void {
    this.failureCount++;
    this.lastFailureTime = new Date();
    
    logger.warn(`Circuit breaker failure`, {
      name: this.options.name,
      failureCount: this.failureCount,
      error: error.message
    });

    if (this.state === CircuitState.HALF_OPEN) {
      // Immediately open on failure in half-open state
      this.openCircuit();
    } else if (this.failureCount >= this.options.failureThreshold) {
      this.openCircuit();
    }
  }

  /**
   * Open the circuit
   */
  private openCircuit(): void {
    this.state = CircuitState.OPEN;
    this.successCount = 0;
    
    logger.error(`Circuit breaker OPEN`, {
      name: this.options.name,
      failureCount: this.failureCount
    });
    
    this.emit('stateChange', CircuitState.OPEN);
    
    // Set timer to try half-open
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
    }
    
    this.resetTimer = setTimeout(() => {
      this.state = CircuitState.HALF_OPEN;
      logger.info(`Circuit breaker moving to HALF_OPEN after timeout`, {
        name: this.options.name
      });
      this.emit('stateChange', CircuitState.HALF_OPEN);
    }, this.options.resetTimeout);
  }

  /**
   * Get current circuit state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Get circuit statistics
   */
  getStats() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime
    };
  }

  /**
   * Reset the circuit breaker
   */
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = undefined;
    
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
      this.resetTimer = undefined;
    }
    
    logger.info(`Circuit breaker reset`, { name: this.options.name });
    this.emit('stateChange', CircuitState.CLOSED);
  }

  /**
   * Add timeout to a promise
   */
  private withTimeout<T>(promise: Promise<T>, timeout: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        setTimeout(() => reject(new Error('Operation timed out')), timeout);
      })
    ]);
  }
}

/**
 * Circuit breaker factory for different services
 */
export class CircuitBreakerFactory {
  private static breakers = new Map<string, CircuitBreaker>();

  static create(name: string, options?: Partial<CircuitBreakerOptions>): CircuitBreaker {
    if (!this.breakers.has(name)) {
      const breaker = new CircuitBreaker({
        name,
        failureThreshold: options?.failureThreshold ?? 5,
        successThreshold: options?.successThreshold ?? 3,
        timeout: options?.timeout ?? 30000, // 30 seconds
        resetTimeout: options?.resetTimeout ?? 60000, // 1 minute
        ...options
      });
      
      this.breakers.set(name, breaker);
    }
    
    return this.breakers.get(name)!;
  }

  static get(name: string): CircuitBreaker | undefined {
    return this.breakers.get(name);
  }

  static resetAll(): void {
    for (const breaker of this.breakers.values()) {
      breaker.reset();
    }
  }

  static getStats(): Map<string, any> {
    const stats = new Map();
    for (const [name, breaker] of this.breakers.entries()) {
      stats.set(name, breaker.getStats());
    }
    return stats;
  }
}