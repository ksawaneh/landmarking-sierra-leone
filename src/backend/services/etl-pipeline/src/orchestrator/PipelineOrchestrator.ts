/**
 * Main pipeline orchestrator that coordinates ETL operations
 */

import { EventEmitter } from 'events';
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
import { v4 as uuidv4 } from 'uuid';

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

      // Execute pipeline stages
      const extractedData = await this.extractStage(mode);
      const transformedData = await this.transformStage(extractedData);
      const loadResult = await this.loadStage(transformedData);

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
   * Extract stage - get data from all sources
   */
  private async extractStage(mode: PipelineMode): Promise<Map<string, LandRecord[]>> {
    logger.info('Starting extract stage');
    const extractedData = new Map<string, LandRecord[]>();
    const extractors = this.createExtractors();

    // Get last run time for incremental mode
    const lastRunTime = mode === PipelineMode.INCREMENTAL ? 
      await this.getLastRunTime() : undefined;

    // Extract from each source in parallel
    const extractPromises = Array.from(extractors.entries()).map(async ([name, extractor]) => {
      try {
        this.emit('extract:start', { source: name });
        
        const result = mode === PipelineMode.INCREMENTAL && lastRunTime ?
          await extractor.extractIncremental(lastRunTime) :
          await extractor.extractAll();

        extractedData.set(name, result.data);
        
        if (this.currentRun) {
          this.currentRun.metrics.recordsExtracted += result.data.length;
          this.currentRun.errors.push(...result.errors.map(e => ({
            stage: 'extract' as const,
            source: name,
            error: e.error,
            timestamp: e.timestamp,
            context: e.record
          })));
        }

        this.metricsCollector.recordExtraction(name, result.metadata);
        this.emit('extract:complete', { source: name, result });
        
        return result;
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
    });

    await Promise.all(extractPromises);
    
    logger.info('Extract stage completed', {
      sources: extractedData.size,
      totalRecords: Array.from(extractedData.values()).reduce((sum, records) => sum + records.length, 0)
    });

    return extractedData;
  }

  /**
   * Transform stage - normalize and merge data
   */
  private async transformStage(
    extractedData: Map<string, LandRecord[]>
  ): Promise<LandRecord[]> {
    logger.info('Starting transform stage');
    
    // First, normalize all data
    const normalizer = new DataNormalizer();
    const normalizedData = new Map<string, LandRecord[]>();

    for (const [source, records] of extractedData) {
      this.emit('transform:start', { transformer: 'DataNormalizer', source });
      
      const result = await normalizer.transform(records);
      normalizedData.set(source, result.data);
      
      if (this.currentRun) {
        this.currentRun.metrics.recordsTransformed += result.data.length;
      }

      this.metricsCollector.recordTransformation('normalize', result.metadata);
      this.emit('transform:complete', { transformer: 'DataNormalizer', result });
    }

    // Then merge data from different sources
    const merger = new DataMerger();
    const allRecords: LandRecord[] = [];
    
    // Collect all records for merging
    for (const records of normalizedData.values()) {
      allRecords.push(...records);
    }

    this.emit('transform:start', { transformer: 'DataMerger' });
    const mergeResult = await merger.mergeByParcelId(allRecords);
    
    if (this.currentRun) {
      this.currentRun.metrics.recordsTransformed = mergeResult.data.length;
      
      // Check quality and send alerts if needed
      if (mergeResult.qualityReport.overallScore < 0.7) {
        await this.alertManager.sendAlert({
          id: uuidv4(),
          type: 'warning',
          severity: 'medium',
          title: 'Low Data Quality',
          message: `Data quality score: ${mergeResult.qualityReport.overallScore}`,
          source: 'DataMerger',
          timestamp: new Date(),
          resolved: false,
          metadata: mergeResult.qualityReport
        });
      }
    }

    this.metricsCollector.recordTransformation('merge', mergeResult.metadata);
    this.emit('transform:complete', { transformer: 'DataMerger', result: mergeResult });

    logger.info('Transform stage completed', {
      recordsTransformed: mergeResult.data.length,
      qualityScore: mergeResult.qualityReport.overallScore
    });

    return mergeResult.data;
  }

  /**
   * Load stage - save data to destinations
   */
  private async loadStage(records: LandRecord[]): Promise<void> {
    logger.info('Starting load stage');
    
    const loaders = this.createLoaders();
    
    // Load to each destination
    const loadPromises = Array.from(loaders.entries()).map(async ([name, loader]) => {
      try {
        this.emit('load:start', { destination: name });
        
        const result = await loader.load(records);
        
        if (this.currentRun) {
          this.currentRun.metrics.recordsLoaded += result.metadata.recordsLoaded;
          this.currentRun.metrics.recordsFailed += result.errors.length;
        }

        this.metricsCollector.recordLoad(name, result.metadata);
        this.emit('load:complete', { destination: name, result });
        
        return result;
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