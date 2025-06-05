/**
 * Metrics collector for pipeline monitoring
 */

import { register, Counter, Gauge, Histogram, collectDefaultMetrics } from 'prom-client';
import express from 'express';
import { ExtractMetadata, TransformMetadata, LoadMetadata } from '../types';
import { logger } from '../utils/logger';

export class MetricsCollector {
  private app: express.Express;
  private server: any;

  // Metrics
  private extractedRecords: Counter;
  private transformedRecords: Counter;
  private loadedRecords: Counter;
  private failedRecords: Counter;
  private pipelineRuns: Counter;
  private pipelineDuration: Histogram;
  private dataQualityScore: Gauge;
  private activeJobs: Gauge;

  constructor(port: number) {
    this.app = express();
    
    // Collect default metrics
    collectDefaultMetrics();

    // Initialize custom metrics
    this.extractedRecords = new Counter({
      name: 'etl_extracted_records_total',
      help: 'Total number of records extracted',
      labelNames: ['source']
    });

    this.transformedRecords = new Counter({
      name: 'etl_transformed_records_total',
      help: 'Total number of records transformed',
      labelNames: ['transformer']
    });

    this.loadedRecords = new Counter({
      name: 'etl_loaded_records_total',
      help: 'Total number of records loaded',
      labelNames: ['destination']
    });

    this.failedRecords = new Counter({
      name: 'etl_failed_records_total',
      help: 'Total number of failed records',
      labelNames: ['stage', 'reason']
    });

    this.pipelineRuns = new Counter({
      name: 'etl_pipeline_runs_total',
      help: 'Total number of pipeline runs',
      labelNames: ['status', 'mode']
    });

    this.pipelineDuration = new Histogram({
      name: 'etl_pipeline_duration_seconds',
      help: 'Pipeline execution duration in seconds',
      labelNames: ['stage'],
      buckets: [10, 30, 60, 120, 300, 600, 1200, 3600]
    });

    this.dataQualityScore = new Gauge({
      name: 'etl_data_quality_score',
      help: 'Current data quality score',
      labelNames: ['dimension']
    });

    this.activeJobs = new Gauge({
      name: 'etl_active_jobs',
      help: 'Number of active ETL jobs',
      labelNames: ['type']
    });

    // Setup metrics endpoint
    this.setupRoutes();
    
    // Start server
    this.server = this.app.listen(port, () => {
      logger.info(`Metrics server listening on port ${port}`);
    });
  }

  /**
   * Record extraction metrics
   */
  recordExtraction(source: string, metadata: ExtractMetadata): void {
    this.extractedRecords.labels(source).inc(metadata.recordCount);
    this.pipelineDuration.labels('extract').observe(metadata.duration / 1000);
  }

  /**
   * Record transformation metrics
   */
  recordTransformation(transformer: string, metadata: TransformMetadata): void {
    this.transformedRecords.labels(transformer).inc(metadata.recordCount);
    this.pipelineDuration.labels('transform').observe(metadata.duration / 1000);
  }

  /**
   * Record load metrics
   */
  recordLoad(destination: string, metadata: LoadMetadata): void {
    this.loadedRecords.labels(destination).inc(metadata.recordsLoaded);
    this.pipelineDuration.labels('load').observe(metadata.duration / 1000);
  }

  /**
   * Record failed records
   */
  recordFailure(stage: string, reason: string, count: number = 1): void {
    this.failedRecords.labels(stage, reason).inc(count);
  }

  /**
   * Record pipeline run
   */
  recordPipelineRun(status: string, mode: string): void {
    this.pipelineRuns.labels(status, mode).inc();
  }

  /**
   * Update data quality metrics
   */
  updateDataQuality(dimensions: Record<string, number>): void {
    for (const [dimension, score] of Object.entries(dimensions)) {
      this.dataQualityScore.labels(dimension).set(score);
    }
  }

  /**
   * Update active jobs gauge
   */
  updateActiveJobs(type: string, count: number): void {
    this.activeJobs.labels(type).set(count);
  }

  /**
   * Setup routes
   */
  private setupRoutes(): void {
    // Metrics endpoint
    this.app.get('/metrics', async (req, res) => {
      try {
        res.set('Content-Type', register.contentType);
        const metrics = await register.metrics();
        res.end(metrics);
      } catch (error) {
        res.status(500).end(error);
      }
    });

    // Health check
    this.app.get('/health', (req, res) => {
      res.json({ status: 'healthy' });
    });
  }

  /**
   * Stop metrics server
   */
  async stop(): Promise<void> {
    return new Promise((resolve) => {
      this.server.close(() => {
        logger.info('Metrics server stopped');
        resolve();
      });
    });
  }
}