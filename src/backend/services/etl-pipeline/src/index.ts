/**
 * ETL Pipeline Service Entry Point
 */

import dotenv from 'dotenv';
import cron from 'node-cron';
import { PipelineConfig, PipelineMode } from './types';
import { PipelineOrchestrator } from './orchestrator/PipelineOrchestrator';
import { logger } from './utils/logger';
import { loadConfig } from './config/ConfigLoader';

// Load environment variables
dotenv.config();

class ETLPipelineService {
  private orchestrator: PipelineOrchestrator;
  private config: PipelineConfig;
  private cronJob?: cron.ScheduledTask;

  constructor() {
    // Load configuration
    this.config = loadConfig();
    
    // Initialize orchestrator
    this.orchestrator = new PipelineOrchestrator(this.config);
    
    // Setup event listeners
    this.setupEventListeners();
  }

  /**
   * Start the ETL service
   */
  async start(): Promise<void> {
    logger.info('Starting ETL Pipeline Service', {
      pipeline: this.config.name,
      schedule: this.config.schedule
    });

    // Setup scheduled runs if configured
    if (this.config.schedule) {
      this.setupSchedule();
    }

    // Run initial pipeline based on startup mode
    const startupMode = process.env.STARTUP_MODE as PipelineMode || PipelineMode.INCREMENTAL;
    if (process.env.RUN_ON_STARTUP === 'true') {
      await this.runPipeline(startupMode);
    }

    // Setup graceful shutdown
    this.setupGracefulShutdown();
  }

  /**
   * Run the pipeline manually
   */
  async runPipeline(mode: PipelineMode): Promise<void> {
    try {
      const run = await this.orchestrator.run(mode);
      logger.info('Pipeline run completed', {
        runId: run.id,
        status: run.status,
        metrics: run.metrics
      });
    } catch (error) {
      logger.error('Pipeline run failed', error);
      throw error;
    }
  }

  /**
   * Setup scheduled pipeline runs
   */
  private setupSchedule(): void {
    if (!this.config.schedule) return;

    this.cronJob = cron.schedule(this.config.schedule, async () => {
      logger.info('Starting scheduled pipeline run');
      try {
        await this.runPipeline(PipelineMode.INCREMENTAL);
      } catch (error) {
        logger.error('Scheduled pipeline run failed', error);
      }
    });

    logger.info('Pipeline scheduled', { schedule: this.config.schedule });
  }

  /**
   * Setup event listeners for monitoring
   */
  private setupEventListeners(): void {
    // Pipeline events
    this.orchestrator.on('pipeline:start', (run) => {
      logger.info('Pipeline started', { runId: run.id });
    });

    this.orchestrator.on('pipeline:complete', (run) => {
      logger.info('Pipeline completed', { 
        runId: run.id,
        duration: run.metrics.duration,
        records: run.metrics.recordsLoaded
      });
    });

    this.orchestrator.on('pipeline:error', (error) => {
      logger.error('Pipeline error', error);
    });

    // Stage events
    this.orchestrator.on('extract:start', ({ source }) => {
      logger.debug(`Extraction started for ${source}`);
    });

    this.orchestrator.on('extract:complete', ({ source, result }) => {
      logger.debug(`Extraction completed for ${source}`, {
        records: result.data.length
      });
    });

    this.orchestrator.on('transform:start', ({ transformer }) => {
      logger.debug(`Transformation started: ${transformer}`);
    });

    this.orchestrator.on('transform:complete', ({ transformer, result }) => {
      logger.debug(`Transformation completed: ${transformer}`, {
        records: result.data.length,
        quality: result.qualityReport.overallScore
      });
    });

    this.orchestrator.on('load:start', ({ destination }) => {
      logger.debug(`Loading started to ${destination}`);
    });

    this.orchestrator.on('load:complete', ({ destination, result }) => {
      logger.debug(`Loading completed to ${destination}`, {
        loaded: result.metadata.recordsLoaded,
        updated: result.metadata.recordsUpdated
      });
    });
  }

  /**
   * Setup graceful shutdown
   */
  private setupGracefulShutdown(): void {
    const shutdown = async () => {
      logger.info('Shutting down ETL Pipeline Service...');
      
      try {
        // Stop scheduled jobs
        if (this.cronJob) {
          this.cronJob.stop();
        }

        // Pause pipeline if running
        await this.orchestrator.pause();

        // Cleanup resources
        await this.orchestrator.cleanup();

        logger.info('ETL Pipeline Service shut down successfully');
        process.exit(0);
      } catch (error) {
        logger.error('Error during shutdown', error);
        process.exit(1);
      }
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  }

  /**
   * Get pipeline status
   */
  getStatus(): any {
    return {
      status: this.orchestrator.getStatus(),
      currentRun: this.orchestrator.getCurrentRun(),
      config: {
        name: this.config.name,
        schedule: this.config.schedule,
        mode: this.config.mode
      }
    };
  }
}

// Start the service if run directly
if (require.main === module) {
  const service = new ETLPipelineService();
  
  service.start().catch(error => {
    logger.error('Failed to start ETL Pipeline Service', error);
    process.exit(1);
  });
}

export { ETLPipelineService };