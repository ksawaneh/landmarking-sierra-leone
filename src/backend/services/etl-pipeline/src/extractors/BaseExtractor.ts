/**
 * Base extractor class for all data sources
 */

import { EventEmitter } from 'events';
import { ExtractResult, ExtractMetadata, ExtractError, SourceConfig, RetryConfig } from '../types';
import { logger } from '../utils/logger';
import { RetryHelper } from '../utils/RetryHelper';

export abstract class BaseExtractor<T = any> extends EventEmitter {
  protected config: SourceConfig;
  protected retryHelper: RetryHelper;
  protected isConnected: boolean = false;

  constructor(config: SourceConfig) {
    super();
    this.config = config;
    this.retryHelper = new RetryHelper(config.retryConfig || {
      maxRetries: 3,
      initialDelay: 1000,
      maxDelay: 30000,
      backoffMultiplier: 2
    });
  }

  /**
   * Initialize connection to data source
   */
  abstract connect(): Promise<void>;

  /**
   * Close connection to data source
   */
  abstract disconnect(): Promise<void>;

  /**
   * Extract data from source
   */
  abstract extractBatch(offset: number, limit: number): Promise<ExtractResult<T>>;

  /**
   * Get total record count for full extraction
   */
  abstract getTotalCount(): Promise<number>;

  /**
   * Extract all data with pagination
   */
  async extractAll(): Promise<ExtractResult<T>> {
    const startTime = Date.now();
    const allData: T[] = [];
    const errors: ExtractError[] = [];
    let offset = 0;
    const batchSize = this.config.batchSize;

    try {
      await this.connect();
      const totalCount = await this.getTotalCount();
      
      logger.info(`Starting extraction from ${this.config.name}`, {
        totalCount,
        batchSize
      });

      while (offset < totalCount) {
        const result = await this.retryHelper.retry(
          () => this.extractBatch(offset, batchSize),
          `Extract batch ${offset}-${offset + batchSize}`
        );

        allData.push(...result.data);
        errors.push(...result.errors);

        this.emit('progress', {
          extracted: allData.length,
          total: totalCount,
          percentage: (allData.length / totalCount) * 100
        });

        offset += batchSize;

        // Add small delay to avoid overwhelming the source
        if (offset < totalCount) {
          await this.delay(100);
        }
      }

      const metadata: ExtractMetadata = {
        source: this.config.name,
        recordCount: allData.length,
        extractedAt: new Date(),
        duration: Date.now() - startTime,
        hasMore: false
      };

      logger.info(`Extraction completed for ${this.config.name}`, {
        recordCount: allData.length,
        duration: metadata.duration,
        errors: errors.length
      });

      return { data: allData, metadata, errors };
    } catch (error) {
      logger.error(`Fatal extraction error for ${this.config.name}`, error);
      throw error;
    } finally {
      await this.disconnect();
    }
  }

  /**
   * Extract incremental changes since last run
   */
  async extractIncremental(lastRunTime: Date): Promise<ExtractResult<T>> {
    const startTime = Date.now();
    const allData: T[] = [];
    const errors: ExtractError[] = [];

    try {
      await this.connect();
      
      logger.info(`Starting incremental extraction from ${this.config.name}`, {
        lastRunTime
      });

      const result = await this.extractIncrementalData(lastRunTime);
      allData.push(...result.data);
      errors.push(...result.errors);

      const metadata: ExtractMetadata = {
        source: this.config.name,
        recordCount: allData.length,
        extractedAt: new Date(),
        duration: Date.now() - startTime,
        hasMore: false
      };

      logger.info(`Incremental extraction completed for ${this.config.name}`, {
        recordCount: allData.length,
        duration: metadata.duration
      });

      return { data: allData, metadata, errors };
    } catch (error) {
      logger.error(`Incremental extraction error for ${this.config.name}`, error);
      throw error;
    } finally {
      await this.disconnect();
    }
  }

  /**
   * Extract incremental data - to be implemented by subclasses
   */
  protected abstract extractIncrementalData(lastRunTime: Date): Promise<ExtractResult<T>>;

  /**
   * Validate extracted data
   */
  protected validateData(data: any[]): { valid: any[], errors: ExtractError[] } {
    const valid: any[] = [];
    const errors: ExtractError[] = [];

    for (const record of data) {
      try {
        if (this.isValidRecord(record)) {
          valid.push(record);
        } else {
          errors.push({
            record,
            error: 'Record failed validation',
            timestamp: new Date(),
            retryable: false
          });
        }
      } catch (error) {
        errors.push({
          record,
          error: error instanceof Error ? error.message : 'Unknown validation error',
          timestamp: new Date(),
          retryable: false
        });
      }
    }

    return { valid, errors };
  }

  /**
   * Check if record is valid - to be implemented by subclasses
   */
  protected abstract isValidRecord(record: any): boolean;

  /**
   * Helper to create delay
   */
  protected delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get extractor statistics
   */
  getStats(): any {
    return {
      source: this.config.name,
      connected: this.isConnected,
      config: {
        batchSize: this.config.batchSize,
        parallelWorkers: this.config.parallelWorkers
      }
    };
  }
}