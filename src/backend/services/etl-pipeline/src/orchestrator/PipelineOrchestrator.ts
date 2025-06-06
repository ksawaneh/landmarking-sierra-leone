/**
 * Main pipeline orchestrator that coordinates ETL operations
 */

import { EventEmitter } from 'events';
import { Transform, Readable, pipeline } from 'stream';
import { promisify } from 'util';
import Bull from 'bull';
import { 
  PipelineConfig, 
  PipelineMode, 
  PipelineStatus, 
  PipelineRun,
  PipelineMetrics,
  PipelineError,
  LandRecord
} from '../types';
import { MLHCPExtractor } from '../extractors/MLHCPExtractor';
import { NRAExtractor } from '../extractors/NRAExtractor';
import { DataNormalizer } from '../transformers/DataNormalizer';
import { DataMerger } from '../transformers/DataMerger';
import { PostgreSQLLoader } from '../loaders/PostgreSQLLoader';
import { logger } from '../utils/logger';
import { MetricsCollector } from '../monitoring/MetricsCollector';
import { AlertManager } from '../monitoring/AlertManager';
import { CircuitBreakerFactory } from '../utils/circuitBreaker';
import { retry } from '../utils/retry';
import { v4 as uuidv4 } from 'uuid';

const pipelineAsync = promisify(pipeline);

export class PipelineOrchestrator extends EventEmitter {
  private config: PipelineConfig;
  private jobQueue: Bull.Queue;
  private metricsCollector: MetricsCollector;
  private alertManager: AlertManager;
  private currentRun?: PipelineRun;
  private status: PipelineStatus = PipelineStatus.IDLE;

  constructor(config: PipelineConfig) {
    super();
    this.config = config;
    
    // Initialize job queue
    this.jobQueue = new Bull('etl-pipeline', {
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379')
      }
    });

    // Initialize monitoring
    this.metricsCollector = new MetricsCollector(config.monitoring.metricsPort);
    this.alertManager = new AlertManager(config.monitoring.alerts);

    this.setupJobProcessors();
  }

  /**
   * Run the pipeline
   */
  async run(mode: PipelineMode = PipelineMode.INCREMENTAL): Promise<PipelineRun> {
    if (this.status !== PipelineStatus.IDLE) {
      throw new Error(`Pipeline is already ${this.status}`);
    }

    const runId = uuidv4();
    this.currentRun = {
      id: runId,
      pipelineName: this.config.name,
      mode,
      status: PipelineStatus.RUNNING,
      startTime: new Date(),
      metrics: {
        totalRecords: 0,
        recordsExtracted: 0,
        recordsTransformed: 0,
        recordsLoaded: 0,
        recordsFailed: 0
      },
      errors: []
    };

    this.status = PipelineStatus.RUNNING;
    this.emit('pipeline:start', this.currentRun);

    try {
      logger.info('Starting pipeline run', {
        runId,
        mode,
        pipelineName: this.config.name
      });

      // Execute pipeline stages with streaming
      const extractedStreams = await this.extractStage(mode);
      const transformedStream = await this.transformStage(extractedStreams);
      await this.loadStage(transformedStream);

      // Update metrics
      this.currentRun.endTime = new Date();
      this.currentRun.status = PipelineStatus.COMPLETED;
      this.currentRun.metrics.duration = 
        this.currentRun.endTime.getTime() - this.currentRun.startTime.getTime();
      this.currentRun.metrics.throughput = 
        this.currentRun.metrics.recordsLoaded / (this.currentRun.metrics.duration / 1000);

      logger.info('Pipeline run completed', {
        runId,
        metrics: this.currentRun.metrics
      });

      this.emit('pipeline:complete', this.currentRun);
      return this.currentRun;
    } catch (error) {
      logger.error('Pipeline run failed', error);
      
      if (this.currentRun) {
        this.currentRun.status = PipelineStatus.FAILED;
        this.currentRun.endTime = new Date();
        this.currentRun.errors.push({
          stage: 'pipeline',
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date()
        });
      }

      await this.alertManager.sendAlert({
        id: uuidv4(),
        type: 'error',
        severity: 'critical',
        title: 'Pipeline Failed',
        message: `Pipeline ${this.config.name} failed: ${error}`,
        source: 'PipelineOrchestrator',
        timestamp: new Date(),
        resolved: false
      });

      this.emit('pipeline:error', error);
      throw error;
    } finally {
      this.status = PipelineStatus.IDLE;
    }
  }

  /**
   * Extract stage - get data from all sources with streaming support
   */
  private async extractStage(mode: PipelineMode): Promise<Map<string, AsyncIterable<LandRecord>>> {
    logger.info('Starting extract stage');
    const extractedStreams = new Map<string, AsyncIterable<LandRecord>>();
    const extractors = this.createExtractors();

    // Get last run time for incremental mode
    const lastRunTime = mode === PipelineMode.INCREMENTAL ? 
      await this.getLastRunTime() : undefined;

    // Create extraction streams for each source
    for (const [name, extractor] of extractors) {
      const circuitBreaker = CircuitBreakerFactory.create(`extractor-${name}`, {
        failureThreshold: 3,
        resetTimeout: 60000
      });

      // Create async generator for streaming extraction
      const extractStream = async function* () {
        try {
          this.emit('extract:start', { source: name });
          
          // Get data in batches
          let offset = 0;
          const batchSize = extractor.batchSize || 1000;
          let hasMore = true;
          
          while (hasMore) {
            const batch = await circuitBreaker.execute(async () => {
              return retry(async () => {
                if (mode === PipelineMode.INCREMENTAL && lastRunTime) {
                  return await extractor.extractIncrementalBatch(lastRunTime, offset, batchSize);
                } else {
                  return await extractor.extractBatch(offset, batchSize);
                }
              }, {
                maxAttempts: 3,
                initialDelay: 1000,
                onRetry: (error, attempt) => {
                  logger.warn(`Retrying extraction for ${name}`, { attempt, error: error.message });
                }
              });
            });
            
            if (batch.data.length === 0) {
              hasMore = false;
            } else {
              // Yield each record
              for (const record of batch.data) {
                yield record;
              }
              
              if (this.currentRun) {
                this.currentRun.metrics.recordsExtracted += batch.data.length;
              }
              
              offset += batch.data.length;
              
              // Check if we got less than batch size (indicates end of data)
              if (batch.data.length < batchSize) {
                hasMore = false;
              }
            }
          }
          
          this.emit('extract:complete', { source: name });
        } catch (error) {
          logger.error(`Extract failed for ${name}`, error);
          
          if (this.currentRun) {
            this.currentRun.errors.push({
              stage: 'extract',
              source: name,
              error: error instanceof Error ? error.message : 'Extract failed',
              timestamp: new Date()
            });
          }
          
          throw error;
        }
      }.bind(this)();
      
      extractedStreams.set(name, extractStream);
    }
    
    logger.info('Extract stage initialized', {
      sources: extractedStreams.size
    });

    return extractedStreams;
  }

  /**
   * Transform stage - normalize and merge data with streaming
   */
  private async transformStage(
    extractedStreams: Map<string, AsyncIterable<LandRecord>>
  ): Promise<AsyncIterable<LandRecord>> {
    logger.info('Starting transform stage');
    
    const normalizer = new DataNormalizer();
    const merger = new DataMerger();
    
    // Create transform stream
    const transformStream = async function* () {
      // Process each source stream in parallel
      const sourcePromises = Array.from(extractedStreams.entries()).map(async ([source, stream]) => {
        const normalizedRecords: LandRecord[] = [];
        
        this.emit('transform:start', { transformer: 'DataNormalizer', source });
        
        // Process records in batches
        const batchSize = 100;
        let batch: LandRecord[] = [];
        
        for await (const record of stream) {
          batch.push(record);
          
          if (batch.length >= batchSize) {
            // Normalize batch
            const result = await normalizer.transform(batch);
            normalizedRecords.push(...result.data);
            
            if (this.currentRun) {
              this.currentRun.metrics.recordsTransformed += result.data.length;
            }
            
            batch = [];
          }
        }
        
        // Process remaining records
        if (batch.length > 0) {
          const result = await normalizer.transform(batch);
          normalizedRecords.push(...result.data);
          
          if (this.currentRun) {
            this.currentRun.metrics.recordsTransformed += result.data.length;
          }
        }
        
        this.emit('transform:complete', { transformer: 'DataNormalizer', source });
        
        return { source, records: normalizedRecords };
      });
      
      // Wait for all sources to be normalized
      const normalizedSources = await Promise.all(sourcePromises);
      
      // Merge records by parcel ID in batches
      this.emit('transform:start', { transformer: 'DataMerger' });
      
      const recordsByParcelId = new Map<string, LandRecord[]>();
      
      // Group records by parcel ID
      for (const { records } of normalizedSources) {
        for (const record of records) {
          const existing = recordsByParcelId.get(record.parcelNumber) || [];
          existing.push(record);
          recordsByParcelId.set(record.parcelNumber, existing);
        }
      }
      
      // Merge and yield records
      const mergeBatchSize = 50;
      let mergeBatch: LandRecord[] = [];
      
      for (const [parcelId, records] of recordsByParcelId) {
        if (records.length === 1) {
          // No merge needed
          mergeBatch.push(records[0]);
        } else {
          // Merge multiple records
          const merged = await merger.mergeRecords(records);
          mergeBatch.push(merged);
        }
        
        if (mergeBatch.length >= mergeBatchSize) {
          // Yield batch
          for (const record of mergeBatch) {
            yield record;
          }
          mergeBatch = [];
        }
      }
      
      // Yield remaining records
      for (const record of mergeBatch) {
        yield record;
      }
      
      this.emit('transform:complete', { transformer: 'DataMerger' });
      
      logger.info('Transform stage completed');
    }.bind(this)();
    
    return transformStream;
  }

  /**
   * Load stage - save data to destinations with streaming
   */
  private async loadStage(recordStream: AsyncIterable<LandRecord>): Promise<void> {
    logger.info('Starting load stage');
    
    const loaders = this.createLoaders();
    const loadBatchSize = 100;
    
    // Create load streams for each destination
    const loadPromises = Array.from(loaders.entries()).map(async ([name, loader]) => {
      const circuitBreaker = CircuitBreakerFactory.create(`loader-${name}`, {
        failureThreshold: 3,
        resetTimeout: 60000
      });
      
      try {
        this.emit('load:start', { destination: name });
        
        await loader.connect();
        
        let batch: LandRecord[] = [];
        let totalLoaded = 0;
        let totalFailed = 0;
        
        // Process records in batches
        for await (const record of recordStream) {
          batch.push(record);
          
          if (batch.length >= loadBatchSize) {
            // Load batch with circuit breaker and retry
            const result = await circuitBreaker.execute(async () => {
              return retry(async () => {
                return await loader.loadBatch(batch);
              }, {
                maxAttempts: 3,
                initialDelay: 1000,
                onRetry: (error, attempt) => {
                  logger.warn(`Retrying load for ${name}`, { attempt, error: error.message });
                }
              });
            });
            
            totalLoaded += result.metadata.recordsLoaded;
            totalFailed += result.errors.length;
            
            if (this.currentRun) {
              this.currentRun.metrics.recordsLoaded += result.metadata.recordsLoaded;
              this.currentRun.metrics.recordsFailed += result.errors.length;
            }
            
            this.metricsCollector.recordLoad(name, result.metadata);
            
            batch = [];
          }
        }
        
        // Load remaining records
        if (batch.length > 0) {
          const result = await circuitBreaker.execute(async () => {
            return retry(async () => {
              return await loader.loadBatch(batch);
            });
          });
          
          totalLoaded += result.metadata.recordsLoaded;
          totalFailed += result.errors.length;
          
          if (this.currentRun) {
            this.currentRun.metrics.recordsLoaded += result.metadata.recordsLoaded;
            this.currentRun.metrics.recordsFailed += result.errors.length;
          }
        }
        
        await loader.disconnect();
        
        this.emit('load:complete', { 
          destination: name, 
          totalLoaded,
          totalFailed
        });
        
        logger.info(`Load completed for ${name}`, {
          recordsLoaded: totalLoaded,
          recordsFailed: totalFailed
        });
      } catch (error) {
        logger.error(`Load failed for ${name}`, error);
        
        if (this.currentRun) {
          this.currentRun.errors.push({
            stage: 'load',
            source: name,
            error: error instanceof Error ? error.message : 'Load failed',
            timestamp: new Date()
          });
        }
        
        // Don't throw - allow other loaders to continue
      }
    });

    await Promise.all(loadPromises);
    
    logger.info('Load stage completed', {
      recordsLoaded: this.currentRun?.metrics.recordsLoaded || 0
    });
  }

  /**
   * Create extractors based on configuration
   */
  private createExtractors(): Map<string, any> {
    const extractors = new Map();

    for (const source of this.config.sources) {
      switch (source.name) {
        case 'mlhcp':
          extractors.set('mlhcp', new MLHCPExtractor(source));
          break;
        case 'nra':
          extractors.set('nra', new NRAExtractor(source));
          break;
        // Add more extractors as needed
      }
    }

    return extractors;
  }

  /**
   * Create loaders based on configuration
   */
  private createLoaders(): Map<string, any> {
    const loaders = new Map();

    for (const destination of this.config.destinations) {
      switch (destination.type) {
        case 'postgresql':
          loaders.set(
            'postgresql', 
            new PostgreSQLLoader(
              destination.connection || process.env.DATABASE_URL || ''
            )
          );
          break;
        // Add more loaders as needed
      }
    }

    return loaders;
  }

  /**
   * Get last successful run time
   */
  private async getLastRunTime(): Promise<Date | undefined> {
    // In production, this would query a metadata store
    // For now, return 24 hours ago
    return new Date(Date.now() - 24 * 60 * 60 * 1000);
  }

  /**
   * Setup job processors for async operations
   */
  private setupJobProcessors(): void {
    this.jobQueue.process('extract', async (job) => {
      const { source, config } = job.data;
      // Process extraction job
      return { success: true };
    });

    this.jobQueue.process('transform', async (job) => {
      const { records, transformations } = job.data;
      // Process transformation job
      return { success: true };
    });

    this.jobQueue.process('load', async (job) => {
      const { records, destination } = job.data;
      // Process load job
      return { success: true };
    });
  }

  /**
   * Pause the pipeline
   */
  async pause(): Promise<void> {
    if (this.status === PipelineStatus.RUNNING) {
      this.status = PipelineStatus.PAUSED;
      await this.jobQueue.pause();
      logger.info('Pipeline paused');
    }
  }

  /**
   * Resume the pipeline
   */
  async resume(): Promise<void> {
    if (this.status === PipelineStatus.PAUSED) {
      this.status = PipelineStatus.RUNNING;
      await this.jobQueue.resume();
      logger.info('Pipeline resumed');
    }
  }

  /**
   * Get pipeline status
   */
  getStatus(): PipelineStatus {
    return this.status;
  }

  /**
   * Get current run information
   */
  getCurrentRun(): PipelineRun | undefined {
    return this.currentRun;
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    await this.jobQueue.close();
    await this.metricsCollector.stop();
  }
}