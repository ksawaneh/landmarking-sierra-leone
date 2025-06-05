/**
 * Retry helper for handling transient failures
 */

import { RetryConfig } from '../types';
import { logger } from './logger';

export class RetryHelper {
  private config: Required<RetryConfig>;

  constructor(config: Partial<RetryConfig> = {}) {
    this.config = {
      maxRetries: config.maxRetries || 3,
      initialDelay: config.initialDelay || 1000,
      maxDelay: config.maxDelay || 30000,
      backoffMultiplier: config.backoffMultiplier || 2
    };
  }

  /**
   * Execute a function with retry logic
   */
  async retry<T>(
    fn: () => Promise<T>,
    operation: string
  ): Promise<T> {
    let lastError: Error | undefined;
    let delay = this.config.initialDelay;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (attempt === this.config.maxRetries) {
          logger.error(`${operation} failed after ${attempt + 1} attempts`, {
            error: lastError.message
          });
          throw lastError;
        }

        logger.warn(`${operation} failed, retrying...`, {
          attempt: attempt + 1,
          delay,
          error: lastError.message
        });

        await this.sleep(delay);
        delay = Math.min(delay * this.config.backoffMultiplier, this.config.maxDelay);
      }
    }

    throw lastError || new Error('Retry failed');
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}