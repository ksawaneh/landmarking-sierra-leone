/**
 * Integration tests for ETL pipeline
 */

import { PipelineOrchestrator } from '../orchestrator/PipelineOrchestrator';
import { PipelineConfig, PipelineMode, PipelineStatus } from '../types';
import { PostgreSQLLoader } from '../loaders/PostgreSQLLoader';

describe('ETL Pipeline Integration Tests', () => {
  let orchestrator: PipelineOrchestrator;
  
  const testConfig: PipelineConfig = {
    name: 'test-pipeline',
    mode: PipelineMode.FULL,
    sources: [
      {
        name: 'mlhcp',
        type: 'database',
        batchSize: 100,
        mockMode: true
      },
      {
        name: 'nra',
        type: 'api',
        batchSize: 100,
        mockMode: true
      }
    ],
    transformations: [
      {
        name: 'normalize',
        type: 'DataNormalizer',
        order: 1
      },
      {
        name: 'merge',
        type: 'DataMerger',
        order: 2
      }
    ],
    destinations: [
      {
        name: 'postgresql',
        type: 'postgresql',
        connection: process.env.TEST_DATABASE_URL || 'postgresql://localhost/landmarking_test'
      }
    ],
    monitoring: {
      metricsPort: 9099,
      alerts: {}
    }
  };

  beforeEach(() => {
    orchestrator = new PipelineOrchestrator(testConfig);
  });

  afterEach(async () => {
    await orchestrator.cleanup();
  });

  describe('Pipeline Execution', () => {
    it('should run full pipeline successfully', async () => {
      const run = await orchestrator.run(PipelineMode.FULL);
      
      expect(run.status).toBe(PipelineStatus.COMPLETED);
      expect(run.metrics.recordsExtracted).toBeGreaterThan(0);
      expect(run.metrics.recordsTransformed).toBeGreaterThan(0);
      expect(run.metrics.recordsLoaded).toBeGreaterThan(0);
      expect(run.errors).toHaveLength(0);
    }, 30000);

    it('should handle incremental runs', async () => {
      // First run
      const firstRun = await orchestrator.run(PipelineMode.INCREMENTAL);
      expect(firstRun.status).toBe(PipelineStatus.COMPLETED);
      
      // Second run should process fewer records
      const secondRun = await orchestrator.run(PipelineMode.INCREMENTAL);
      expect(secondRun.status).toBe(PipelineStatus.COMPLETED);
      expect(secondRun.metrics.recordsExtracted).toBeLessThanOrEqual(
        firstRun.metrics.recordsExtracted
      );
    }, 30000);

    it('should emit progress events', async () => {
      const progressEvents: any[] = [];
      
      orchestrator.on('extract:progress', (data) => {
        progressEvents.push({ stage: 'extract', ...data });
      });
      
      orchestrator.on('transform:progress', (data) => {
        progressEvents.push({ stage: 'transform', ...data });
      });
      
      orchestrator.on('load:progress', (data) => {
        progressEvents.push({ stage: 'load', ...data });
      });
      
      await orchestrator.run(PipelineMode.FULL);
      
      expect(progressEvents.length).toBeGreaterThan(0);
      expect(progressEvents.some(e => e.stage === 'extract')).toBe(true);
      expect(progressEvents.some(e => e.stage === 'load')).toBe(true);
    }, 30000);
  });

  describe('Error Handling', () => {
    it('should handle extraction errors gracefully', async () => {
      // Create config with invalid source
      const errorConfig = {
        ...testConfig,
        sources: [
          {
            name: 'invalid',
            type: 'database',
            connection: 'invalid://connection',
            batchSize: 100,
            mockMode: false
          }
        ]
      };
      
      const errorOrchestrator = new PipelineOrchestrator(errorConfig);
      
      try {
        const run = await errorOrchestrator.run(PipelineMode.FULL);
        expect(run.status).toBe(PipelineStatus.FAILED);
        expect(run.errors.length).toBeGreaterThan(0);
      } finally {
        await errorOrchestrator.cleanup();
      }
    });

    it('should continue processing valid records on partial failures', async () => {
      const run = await orchestrator.run(PipelineMode.FULL);
      
      expect(run.status).toBe(PipelineStatus.COMPLETED);
      // Even with some failures, should process valid records
      expect(run.metrics.recordsLoaded).toBeGreaterThan(0);
    }, 30000);
  });

  describe('Data Quality', () => {
    it('should generate quality reports', async () => {
      let qualityReport: any;
      
      orchestrator.on('transform:complete', ({ result }) => {
        if (result.qualityReport) {
          qualityReport = result.qualityReport;
        }
      });
      
      await orchestrator.run(PipelineMode.FULL);
      
      expect(qualityReport).toBeDefined();
      expect(qualityReport.overallScore).toBeGreaterThan(0);
      expect(qualityReport.dimensions).toHaveProperty('completeness');
      expect(qualityReport.dimensions).toHaveProperty('accuracy');
      expect(qualityReport.dimensions).toHaveProperty('consistency');
    }, 30000);

    it('should identify quality issues', async () => {
      let qualityReport: any;
      
      orchestrator.on('transform:complete', ({ result }) => {
        if (result.qualityReport) {
          qualityReport = result.qualityReport;
        }
      });
      
      await orchestrator.run(PipelineMode.FULL);
      
      expect(qualityReport.issues).toBeDefined();
      expect(Array.isArray(qualityReport.issues)).toBe(true);
      
      // Check for common issues
      const hasNationalIdIssues = qualityReport.issues.some(
        (issue: any) => issue.field === 'owner.nationalId'
      );
      expect(hasNationalIdIssues).toBe(true);
    }, 30000);
  });

  describe('Performance', () => {
    it('should process records within acceptable time', async () => {
      const startTime = Date.now();
      const run = await orchestrator.run(PipelineMode.FULL);
      const duration = Date.now() - startTime;
      
      expect(run.status).toBe(PipelineStatus.COMPLETED);
      expect(duration).toBeLessThan(30000); // Should complete within 30 seconds
      
      // Check throughput
      const throughput = run.metrics.recordsLoaded / (duration / 1000);
      expect(throughput).toBeGreaterThan(10); // At least 10 records/second
    }, 30000);
  });
});