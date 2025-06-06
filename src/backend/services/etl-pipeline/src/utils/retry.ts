/**
 * Retry logic with exponential backoff and jitter
 */

import { logger } from './logger';

export interface RetryOptions {
  maxAttempts: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  jitter: boolean;
  retryableErrors?: string[];
  onRetry?: (error: Error, attempt: number) => void;
}

export class RetryError extends Error {
  constructor(
    message: string,
    public attempts: number,
    public lastError: Error
  ) {
    super(message);
    this.name = 'RetryError';
  }
}

/**
 * Default retry options
 */
const defaultOptions: RetryOptions = {
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
  jitter: true
};

/**
 * Check if an error is retryable
 */
function isRetryableError(error: Error, retryableErrors?: string[]): boolean {
  // Default retryable errors
  const defaultRetryable = [
    'ECONNREFUSED',
    'ETIMEDOUT',
    'ENOTFOUND',
    'ENETUNREACH',
    'EAI_AGAIN',
    'ECONNRESET',
    'EPIPE'
  ];

  const errorCode = (error as any).code;
  const errorMessage = error.message.toLowerCase();

  // Check error codes
  if (errorCode && defaultRetryable.includes(errorCode)) {
    return true;
  }

  // Check custom retryable errors
  if (retryableErrors) {
    return retryableErrors.some(pattern => 
      errorMessage.includes(pattern.toLowerCase())
    );
  }

  // Check for common retryable patterns
  const retryablePatterns = [
    'timeout',
    'timed out',
    'connection reset',
    'connection refused',
    'network',
    'temporarily unavailable',
    'too many requests',
    'rate limit',
    'service unavailable',
    '503',
    '429',
    '502'
  ];

  return retryablePatterns.some(pattern => errorMessage.includes(pattern));
}

/**
 * Calculate delay with exponential backoff and optional jitter
 */
function calculateDelay(
  attempt: number,
  options: RetryOptions
): number {
  let delay = options.initialDelay * Math.pow(options.backoffMultiplier, attempt - 1);
  
  // Cap at max delay
  delay = Math.min(delay, options.maxDelay);
  
  // Add jitter if enabled
  if (options.jitter) {
    // Random jitter between 0% and 25% of the delay
    const jitterAmount = delay * 0.25 * Math.random();
    delay = delay + jitterAmount;
  }
  
  return Math.floor(delay);
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options?: Partial<RetryOptions>
): Promise<T> {
  const opts: RetryOptions = { ...defaultOptions, ...options };
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      // Check if error is retryable
      if (!isRetryableError(lastError, opts.retryableErrors)) {
        logger.warn('Non-retryable error encountered', {
          error: lastError.message,
          attempt
        });
        throw lastError;
      }

      // Check if we've exhausted attempts
      if (attempt === opts.maxAttempts) {
        logger.error('Max retry attempts reached', {
          attempts: opts.maxAttempts,
          lastError: lastError.message
        });
        throw new RetryError(
          `Failed after ${opts.maxAttempts} attempts: ${lastError.message}`,
          opts.maxAttempts,
          lastError
        );
      }

      // Calculate delay
      const delay = calculateDelay(attempt, opts);
      
      logger.info('Retrying operation', {
        attempt,
        maxAttempts: opts.maxAttempts,
        delay,
        error: lastError.message
      });

      // Call retry callback if provided
      if (opts.onRetry) {
        opts.onRetry(lastError, attempt);
      }

      // Wait before retrying
      await sleep(delay);
    }
  }

  // This should never be reached
  throw new Error('Unexpected retry loop exit');
}

/**
 * Retry decorator for class methods
 */
export function Retryable(options?: Partial<RetryOptions>) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      return retry(
        () => originalMethod.apply(this, args),
        options
      );
    };

    return descriptor;
  };
}

/**
 * Batch retry for multiple operations
 */
export async function batchRetry<T, R>(
  items: T[],
  operation: (item: T) => Promise<R>,
  options?: Partial<RetryOptions> & { concurrency?: number }
): Promise<{ results: R[]; failures: Array<{ item: T; error: Error }> }> {
  const results: R[] = [];
  const failures: Array<{ item: T; error: Error }> = [];
  const concurrency = options?.concurrency || 5;
  
  // Process items in batches
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    
    const batchPromises = batch.map(async (item, index) => {
      try {
        const result = await retry(() => operation(item), options);
        return { success: true, result, index: i + index };
      } catch (error) {
        return { 
          success: false, 
          error: error as Error, 
          item, 
          index: i + index 
        };
      }
    });
    
    const batchResults = await Promise.all(batchPromises);
    
    for (const batchResult of batchResults) {
      if (batchResult.success) {
        results[batchResult.index] = batchResult.result;
      } else {
        failures.push({ 
          item: batchResult.item, 
          error: batchResult.error 
        });
      }
    }
  }
  
  return { results, failures };
}