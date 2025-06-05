/**
 * Data merger transformer - combines data from multiple sources
 */

import { BaseTransformer } from './BaseTransformer';
import { LandRecord, QualityIssue } from '../types';
import { logger } from '../utils/logger';

interface MergeInput {
  mlhcp?: LandRecord;
  nra?: Partial<LandRecord>;
  oarg?: Partial<LandRecord>;
}

export class DataMerger extends BaseTransformer<MergeInput, LandRecord> {
  constructor() {
    super('DataMerger');
  }

  protected transformRecord(input: MergeInput): LandRecord {
    if (!input.mlhcp) {
      throw new Error('MLHCP record is required for merging');
    }

    const base = input.mlhcp;
    const merged: LandRecord = { ...base };

    // Merge NRA data if available
    if (input.nra) {
      merged.taxStatus = input.nra.taxStatus || base.taxStatus;
      merged.lastPaymentDate = input.nra.lastPaymentDate || base.lastPaymentDate;
      merged.arrearsAmount = input.nra.arrearsAmount ?? base.arrearsAmount;
      
      // Use NRA valuation if more recent
      if (input.nra.currentValue && 
          (!base.lastValuationDate || 
           (input.nra.updatedAt && input.nra.updatedAt > base.lastValuationDate))) {
        merged.currentValue = input.nra.currentValue;
        merged.taxAssessment = input.nra.taxAssessment;
      }
      
      // Merge owner info (NRA might have updated contact)
      if (input.nra.owner) {
        merged.owner = {
          ...merged.owner,
          ...input.nra.owner,
          name: merged.owner.name // Keep MLHCP name as primary
        };
      }
    }

    // Merge OARG data if available
    if (input.oarg) {
      // OARG typically has the most authoritative deed information
      if (input.oarg.titleDeedNumber) {
        merged.titleDeedNumber = input.oarg.titleDeedNumber;
      }
      
      if (input.oarg.encumbrances) {
        merged.encumbrances = this.mergeArrays(
          merged.encumbrances || [],
          input.oarg.encumbrances
        );
      }
      
      if (input.oarg.previousOwners) {
        merged.previousOwners = this.mergePreviousOwners(
          merged.previousOwners || [],
          input.oarg.previousOwners
        );
      }
    }

    // Update metadata
    merged.sourceSystem = 'UNIFIED';
    merged.qualityScore = this.calculateMergedQualityScore(input);
    merged.updatedAt = new Date();
    merged.version = (base.version || 1) + 1;

    return merged;
  }

  protected checkQuality(record: LandRecord): QualityIssue[] {
    const issues: QualityIssue[] = [];

    // Check for data conflicts
    if (record.sourceSystem === 'UNIFIED') {
      // Check if critical fields are missing
      if (!record.taxStatus || record.taxStatus === 'pending') {
        issues.push({
          field: 'taxStatus',
          issue: 'Tax status not available from NRA',
          severity: 'medium',
          count: 1,
          examples: []
        });
      }

      if (!record.titleDeedNumber) {
        issues.push({
          field: 'titleDeedNumber',
          issue: 'Title deed not found in OARG',
          severity: 'high',
          count: 1,
          examples: []
        });
      }

      // Check for data consistency
      if (record.area && record.taxAssessment) {
        const assessmentPerSqm = record.taxAssessment / record.area;
        if (assessmentPerSqm < 10 || assessmentPerSqm > 10000) {
          issues.push({
            field: 'taxAssessment',
            issue: 'Unusual tax assessment value',
            severity: 'medium',
            count: 1,
            examples: []
          });
        }
      }
    }

    return issues;
  }

  protected getFieldCount(): number {
    return 8; // Fields checked during merge
  }

  protected calculateQualityDimensions(
    records: LandRecord[],
    issues: QualityIssue[]
  ): {
    completeness: number;
    accuracy: number;
    consistency: number;
    timeliness: number;
    uniqueness: number;
  } {
    const totalRecords = records.length;
    if (totalRecords === 0) {
      return {
        completeness: 0,
        accuracy: 0,
        consistency: 0,
        timeliness: 0,
        uniqueness: 0
      };
    }

    // Calculate completeness based on merged sources
    const recordsWithAllSources = records.filter(r => 
      r.sourceSystem === 'UNIFIED' && 
      r.taxStatus !== 'pending' &&
      r.titleDeedNumber
    ).length;
    const completeness = recordsWithAllSources / totalRecords;

    // Calculate consistency
    const consistentRecords = records.filter(r => {
      if (r.area && r.taxAssessment) {
        const assessmentPerSqm = r.taxAssessment / r.area;
        return assessmentPerSqm >= 10 && assessmentPerSqm <= 10000;
      }
      return true;
    }).length;
    const consistency = consistentRecords / totalRecords;

    // Calculate timeliness
    const recentRecords = records.filter(r => {
      const daysSinceUpdate = (Date.now() - r.updatedAt.getTime()) / (1000 * 60 * 60 * 24);
      return daysSinceUpdate < 30;
    }).length;
    const timeliness = recentRecords / totalRecords;

    return {
      completeness,
      accuracy: 0.95, // High accuracy assumed for merged data
      consistency,
      timeliness,
      uniqueness: 1.0 // Uniqueness maintained by ID
    };
  }

  private mergeArrays<T>(arr1: T[], arr2: T[]): T[] {
    const merged = [...arr1];
    for (const item of arr2) {
      if (!merged.includes(item)) {
        merged.push(item);
      }
    }
    return merged;
  }

  private mergePreviousOwners(
    owners1: NonNullable<LandRecord['previousOwners']>,
    owners2: NonNullable<LandRecord['previousOwners']>
  ): NonNullable<LandRecord['previousOwners']> {
    const ownerMap = new Map<string, typeof owners1[0]>();
    
    // Add all owners to map, using name+from as key
    [...owners1, ...owners2].forEach(owner => {
      const key = `${owner.name}-${owner.from.getTime()}`;
      ownerMap.set(key, owner);
    });
    
    // Sort by from date
    return Array.from(ownerMap.values()).sort((a, b) => 
      a.from.getTime() - b.from.getTime()
    );
  }

  private calculateMergedQualityScore(input: MergeInput): number {
    let score = 0;
    let sources = 0;

    if (input.mlhcp) {
      score += input.mlhcp.qualityScore || 70;
      sources++;
    }

    if (input.nra) {
      score += 10; // Bonus for NRA data
      sources++;
    }

    if (input.oarg) {
      score += 10; // Bonus for OARG data
      sources++;
    }

    // Additional bonus for multiple sources
    if (sources > 1) {
      score += sources * 5;
    }

    return Math.min(100, score);
  }

  /**
   * Merge records by parcel ID
   */
  async mergeByParcelId(records: LandRecord[]): Promise<TransformResult<LandRecord>> {
    // Group records by parcel ID
    const grouped = new Map<string, MergeInput>();

    for (const record of records) {
      const parcelId = record.parcelNumber;
      const existing = grouped.get(parcelId) || {};

      switch (record.sourceSystem) {
        case 'MLHCP':
          existing.mlhcp = record;
          break;
        case 'NRA':
          existing.nra = record;
          break;
        case 'OARG':
          existing.oarg = record;
          break;
      }

      grouped.set(parcelId, existing);
    }

    // Transform grouped records
    const inputs = Array.from(grouped.values());
    return this.transform(inputs);
  }
}