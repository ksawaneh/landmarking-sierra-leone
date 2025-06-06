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

  /**
   * Merge multiple records for the same parcel
   */
  async mergeRecords(records: LandRecord[]): Promise<LandRecord> {
    if (records.length === 0) {
      throw new Error('No records to merge');
    }
    
    if (records.length === 1) {
      return records[0];
    }

    // Sort by source priority and updated date
    const sortedRecords = records.sort((a, b) => {
      const sourcePriority = { 'MLHCP': 3, 'NRA': 2, 'OARG': 1, 'UNIFIED': 4 };
      const aPriority = sourcePriority[a.sourceSystem as keyof typeof sourcePriority] || 0;
      const bPriority = sourcePriority[b.sourceSystem as keyof typeof sourcePriority] || 0;
      
      if (aPriority !== bPriority) {
        return bPriority - aPriority;
      }
      
      return (b.updatedAt?.getTime() || 0) - (a.updatedAt?.getTime() || 0);
    });

    // Use the highest priority record as base
    const base = sortedRecords[0];
    const merged: LandRecord = { ...base };

    // Merge data from other sources
    for (let i = 1; i < sortedRecords.length; i++) {
      const record = sortedRecords[i];
      
      // Merge fields based on source
      if (record.sourceSystem === 'NRA') {
        // Tax-related fields from NRA have priority
        merged.taxStatus = record.taxStatus || merged.taxStatus;
        merged.lastPaymentDate = record.lastPaymentDate || merged.lastPaymentDate;
        merged.arrearsAmount = record.arrearsAmount ?? merged.arrearsAmount;
        merged.currentValue = record.currentValue || merged.currentValue;
        merged.taxAssessment = record.taxAssessment || merged.taxAssessment;
      }
      
      if (record.sourceSystem === 'OARG') {
        // Legal fields from OARG have priority
        merged.titleDeedNumber = record.titleDeedNumber || merged.titleDeedNumber;
        merged.encumbrances = this.mergeArrays(
          merged.encumbrances || [],
          record.encumbrances || []
        );
      }
      
      // Merge structures and disputes
      if (record.structures?.length) {
        merged.structures = this.mergeStructures(
          merged.structures || [],
          record.structures
        );
      }
      
      if (record.disputes?.length) {
        merged.disputes = this.mergeDisputes(
          merged.disputes || [],
          record.disputes
        );
      }
    }

    // Update metadata
    merged.sourceSystem = 'UNIFIED';
    merged.qualityScore = this.calculateMergedQualityScore({ mlhcp: base });
    merged.updatedAt = new Date();
    merged.version = Math.max(...records.map(r => r.version || 1)) + 1;

    return merged;
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

  private mergeStructures(
    structures1: NonNullable<LandRecord['structures']>,
    structures2: NonNullable<LandRecord['structures']>
  ): NonNullable<LandRecord['structures']> {
    const structureMap = new Map<string, typeof structures1[0]>();
    
    // Add all structures to map, using type+yearBuilt as key
    [...structures1, ...structures2].forEach(structure => {
      const key = `${structure.type}-${structure.yearBuilt || 'unknown'}`;
      structureMap.set(key, structure);
    });
    
    return Array.from(structureMap.values());
  }

  private mergeDisputes(
    disputes1: NonNullable<LandRecord['disputes']>,
    disputes2: NonNullable<LandRecord['disputes']>
  ): NonNullable<LandRecord['disputes']> {
    const disputeMap = new Map<string, typeof disputes1[0]>();
    
    // Add all disputes to map, using type+filedDate as key
    [...disputes1, ...disputes2].forEach(dispute => {
      const key = `${dispute.type}-${dispute.filedDate.getTime()}`;
      disputeMap.set(key, dispute);
    });
    
    // Sort by filed date (most recent first)
    return Array.from(disputeMap.values()).sort((a, b) => 
      b.filedDate.getTime() - a.filedDate.getTime()
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