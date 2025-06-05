/**
 * Base transformer class for all data transformations
 */

import { EventEmitter } from 'events';
import { TransformResult, TransformMetadata, TransformError, QualityReport, QualityIssue } from '../types';
import { logger } from '../utils/logger';

export abstract class BaseTransformer<TInput = any, TOutput = any> extends EventEmitter {
  protected name: string;

  constructor(name: string) {
    super();
    this.name = name;
  }

  /**
   * Transform a batch of records
   */
  async transform(records: TInput[]): Promise<TransformResult<TOutput>> {
    const startTime = Date.now();
    const transformedData: TOutput[] = [];
    const errors: TransformError[] = [];
    const qualityIssues: Map<string, QualityIssue> = new Map();

    logger.info(`Starting transformation: ${this.name}`, {
      recordCount: records.length
    });

    for (let i = 0; i < records.length; i++) {
      try {
        const transformed = await this.transformRecord(records[i]);
        transformedData.push(transformed);

        // Check quality
        const issues = this.checkQuality(transformed);
        issues.forEach(issue => {
          const key = `${issue.field}-${issue.issue}`;
          const existing = qualityIssues.get(key) || {
            ...issue,
            count: 0,
            examples: []
          };
          existing.count++;
          if (existing.examples.length < 5) {
            existing.examples.push(transformed);
          }
          qualityIssues.set(key, existing);
        });

        // Emit progress
        if (i % 100 === 0) {
          this.emit('progress', {
            processed: i,
            total: records.length,
            percentage: (i / records.length) * 100
          });
        }
      } catch (error) {
        errors.push({
          record: records[i],
          transformation: this.name,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date()
        });
      }
    }

    const qualityReport = this.generateQualityReport(
      transformedData,
      Array.from(qualityIssues.values())
    );

    const metadata: TransformMetadata = {
      recordCount: transformedData.length,
      transformedAt: new Date(),
      duration: Date.now() - startTime,
      transformations: [this.name]
    };

    logger.info(`Transformation completed: ${this.name}`, {
      recordCount: transformedData.length,
      errorCount: errors.length,
      duration: metadata.duration,
      qualityScore: qualityReport.overallScore
    });

    return {
      data: transformedData,
      metadata,
      qualityReport,
      errors
    };
  }

  /**
   * Transform a single record - to be implemented by subclasses
   */
  protected abstract transformRecord(record: TInput): Promise<TOutput> | TOutput;

  /**
   * Check quality issues in transformed record
   */
  protected abstract checkQuality(record: TOutput): QualityIssue[];

  /**
   * Generate quality report for the batch
   */
  protected generateQualityReport(
    records: TOutput[],
    issues: QualityIssue[]
  ): QualityReport {
    const dimensions = this.calculateQualityDimensions(records, issues);
    
    const overallScore = 
      dimensions.completeness * 0.3 +
      dimensions.accuracy * 0.3 +
      dimensions.consistency * 0.2 +
      dimensions.timeliness * 0.1 +
      dimensions.uniqueness * 0.1;

    return {
      overallScore: Math.round(overallScore * 100) / 100,
      dimensions,
      issues: issues.sort((a, b) => {
        const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        return severityOrder[a.severity] - severityOrder[b.severity];
      })
    };
  }

  /**
   * Calculate quality dimensions - can be overridden by subclasses
   */
  protected calculateQualityDimensions(
    records: TOutput[],
    issues: QualityIssue[]
  ): QualityReport['dimensions'] {
    // Default implementation - subclasses can override for specific calculations
    const totalFields = this.getFieldCount();
    const totalIssues = issues.reduce((sum, issue) => sum + issue.count, 0);
    const issueRate = totalIssues / (records.length * totalFields);

    return {
      completeness: Math.max(0, 1 - issueRate),
      accuracy: 0.9, // Default high accuracy
      consistency: 0.85, // Default good consistency
      timeliness: 1.0, // Default perfect timeliness
      uniqueness: 1.0 // Default perfect uniqueness
    };
  }

  /**
   * Get the number of fields being checked - to be implemented by subclasses
   */
  protected abstract getFieldCount(): number;

  /**
   * Batch transform with parallel processing
   */
  async transformParallel(
    records: TInput[],
    parallelism: number = 4
  ): Promise<TransformResult<TOutput>> {
    const batchSize = Math.ceil(records.length / parallelism);
    const batches: TInput[][] = [];

    for (let i = 0; i < records.length; i += batchSize) {
      batches.push(records.slice(i, i + batchSize));
    }

    const results = await Promise.all(
      batches.map(batch => this.transform(batch))
    );

    // Merge results
    const mergedData: TOutput[] = [];
    const mergedErrors: TransformError[] = [];
    const allIssues: QualityIssue[] = [];

    results.forEach(result => {
      mergedData.push(...result.data);
      mergedErrors.push(...result.errors);
      allIssues.push(...result.qualityReport.issues);
    });

    // Recalculate quality report for merged data
    const qualityReport = this.generateQualityReport(mergedData, allIssues);

    return {
      data: mergedData,
      metadata: {
        recordCount: mergedData.length,
        transformedAt: new Date(),
        duration: results.reduce((sum, r) => sum + r.metadata.duration, 0),
        transformations: [this.name]
      },
      qualityReport,
      errors: mergedErrors
    };
  }
}