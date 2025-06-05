/**
 * Base loader class for all data destinations
 */

import { EventEmitter } from 'events';
import { LoadResult, LoadMetadata, LoadError } from '../types';
import { logger } from '../utils/logger';

export abstract class BaseLoader<T = any> extends EventEmitter {
  protected name: string;
  protected batchSize: number;

  constructor(name: string, batchSize: number = 1000) {
    super();
    this.name = name;
    this.batchSize = batchSize;
  }

  /**
   * Initialize connection to destination
   */
  abstract connect(): Promise<void>;

  /**
   * Close connection to destination
   */
  abstract disconnect(): Promise<void>;

  /**
   * Load a batch of records
   */
  abstract loadBatch(records: T[]): Promise<LoadResult>;

  /**
   * Load all records with batching and error handling
   */
  async load(records: T[]): Promise<LoadResult> {
    const startTime = Date.now();
    const errors: LoadError[] = [];
    let recordsLoaded = 0;
    let recordsUpdated = 0;
    let recordsSkipped = 0;

    try {
      await this.connect();
      
      logger.info(`Starting load to ${this.name}`, {
        totalRecords: records.length,
        batchSize: this.batchSize
      });

      // Process in batches
      for (let i = 0; i < records.length; i += this.batchSize) {
        const batch = records.slice(i, i + this.batchSize);
        
        try {
          const batchResult = await this.loadBatch(batch);
          
          recordsLoaded += batchResult.metadata.recordsLoaded;
          recordsUpdated += batchResult.metadata.recordsUpdated;
          recordsSkipped += batchResult.metadata.recordsSkipped;
          errors.push(...batchResult.errors);

          this.emit('progress', {
            loaded: recordsLoaded + recordsUpdated,
            total: records.length,
            percentage: ((recordsLoaded + recordsUpdated) / records.length) * 100
          });
        } catch (error) {
          logger.error(`Error loading batch ${i / this.batchSize}`, error);
          
          // Add all records in batch as errors
          batch.forEach(record => {
            errors.push({
              record,
              error: error instanceof Error ? error.message : 'Batch load failed',
              timestamp: new Date(),
              retryable: true
            });
          });
        }
      }

      const metadata: LoadMetadata = {
        destination: this.name,
        recordsLoaded,
        recordsUpdated,
        recordsSkipped,
        loadedAt: new Date(),
        duration: Date.now() - startTime
      };

      logger.info(`Load completed to ${this.name}`, {
        ...metadata,
        errorCount: errors.length
      });

      return { metadata, errors };
    } catch (error) {
      logger.error(`Fatal load error for ${this.name}`, error);
      throw error;
    } finally {
      await this.disconnect();
    }
  }

  /**
   * Check if record exists in destination
   */
  protected abstract recordExists(record: T): Promise<boolean>;

  /**
   * Validate record before loading
   */
  protected abstract validateRecord(record: T): boolean;

  /**
   * Handle duplicate records
   */
  protected async handleDuplicate(
    existing: T,
    incoming: T
  ): Promise<'update' | 'skip'> {
    // Default strategy - can be overridden
    return 'update';
  }

  /**
   * Batch existence check for performance
   */
  protected async batchExistsCheck(records: T[]): Promise<Map<string, boolean>> {
    // Default implementation - check one by one
    const results = new Map<string, boolean>();
    
    for (const record of records) {
      const id = this.getRecordId(record);
      const exists = await this.recordExists(record);
      results.set(id, exists);
    }
    
    return results;
  }

  /**
   * Get record identifier
   */
  protected abstract getRecordId(record: T): string;

  /**
   * Begin transaction if supported
   */
  protected async beginTransaction(): Promise<any> {
    // Override in subclasses that support transactions
    return null;
  }

  /**
   * Commit transaction if supported
   */
  protected async commitTransaction(transaction: any): Promise<void> {
    // Override in subclasses that support transactions
  }

  /**
   * Rollback transaction if supported
   */
  protected async rollbackTransaction(transaction: any): Promise<void> {
    // Override in subclasses that support transactions
  }

  /**
   * Get loader statistics
   */
  getStats(): any {
    return {
      loader: this.name,
      batchSize: this.batchSize
    };
  }
}