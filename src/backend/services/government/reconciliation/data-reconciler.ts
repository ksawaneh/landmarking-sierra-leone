/**
 * Data Reconciliation Engine
 * Intelligently merges land records from multiple government sources
 * Handles conflicts, detects duplicates, and produces unified records
 */

import { 
  MLHCPLandRecord, 
  NRAPropertyRecord, 
  OARGDeedRecord, 
  UnifiedLandRecord,
  DataQualityIssues 
} from '../schemas/government-data.types';

/**
 * Confidence scoring weights for different data sources
 */
const SOURCE_WEIGHTS = {
  mlhcp: 0.5,  // Primary land registry
  nra: 0.3,    // Tax records
  oarg: 0.2    // Deed records
};

/**
 * Name similarity threshold for matching
 */
const NAME_SIMILARITY_THRESHOLD = 0.8;

export interface ReconciliationResult {
  unified: UnifiedLandRecord;
  confidence: number;
  conflicts: DataQualityIssues;
  suggestions: string[];
}

export class DataReconciler {
  /**
   * Reconciles records from multiple sources into a unified record
   */
  async reconcile(
    mlhcp?: MLHCPLandRecord,
    nra?: NRAPropertyRecord,
    oarg?: OARGDeedRecord
  ): Promise<ReconciliationResult> {
    // At least one source must be provided
    if (!mlhcp && !nra && !oarg) {
      throw new Error('At least one data source must be provided');
    }
    
    const conflicts = this.detectConflicts(mlhcp, nra, oarg);
    const ownership = this.reconcileOwnership(mlhcp, nra, oarg, conflicts);
    const location = this.reconcileLocation(mlhcp, nra);
    const confidence = this.calculateConfidence(mlhcp, nra, oarg, conflicts);
    
    const unified: UnifiedLandRecord = {
      unifiedId: this.generateUnifiedId(mlhcp, nra, oarg),
      sources: {
        mlhcp,
        nra,
        oarg
      },
      ownership,
      location,
      status: {
        isDisputed: this.checkDisputed(mlhcp, conflicts),
        requiresFieldVerification: this.requiresVerification(conflicts, confidence),
        dataQuality: this.assessDataQuality(confidence, conflicts),
        lastUpdated: new Date()
      },
      reconciliation: {
        conflicts,
        mergeStrategy: this.determineMergeStrategy(mlhcp, nra, oarg),
        confidence,
        timestamp: new Date()
      }
    };
    
    const suggestions = this.generateSuggestions(unified, conflicts);
    
    return {
      unified,
      confidence,
      conflicts,
      suggestions
    };
  }
  
  /**
   * Detects conflicts between data sources
   */
  private detectConflicts(
    mlhcp?: MLHCPLandRecord,
    nra?: NRAPropertyRecord,
    oarg?: OARGDeedRecord
  ): DataQualityIssues {
    const conflicts: DataQualityIssues = {
      nameVariations: [],
      addressIncomplete: false,
      coordinatesInvalid: false,
      boundariesVague: false,
      missingFields: [],
      sizeDiscrepancy: false,
      ownershipConflict: false,
      dateInconsistency: false,
      possibleDuplicateIds: []
    };
    
    // Collect all owner names
    const ownerNames: string[] = [];
    if (mlhcp?.ownerName) ownerNames.push(mlhcp.ownerName);
    if (nra?.taxpayerName) ownerNames.push(nra.taxpayerName);
    if (oarg?.grantee.name) ownerNames.push(oarg.grantee.name);
    
    // Check name variations
    if (ownerNames.length > 1) {
      const uniqueNames = this.findNameVariations(ownerNames);
      if (uniqueNames.length > 1) {
        conflicts.nameVariations = uniqueNames;
        conflicts.ownershipConflict = !this.areNamesSimilar(uniqueNames);
      }
    }
    
    // Check address completeness
    if (mlhcp) {
      conflicts.addressIncomplete = !mlhcp.address || mlhcp.address === mlhcp.district;
      conflicts.coordinatesInvalid = !mlhcp.boundaries?.coordinates;
      conflicts.boundariesVague = this.areBoundariesVague(mlhcp.boundaries);
    }
    
    // Check missing fields
    if (mlhcp) {
      if (!mlhcp.ownerNationalId) conflicts.missingFields.push('ownerNationalId');
      if (!mlhcp.chiefdom) conflicts.missingFields.push('chiefdom');
      if (!mlhcp.boundaries?.coordinates) conflicts.missingFields.push('coordinates');
    }
    
    // Check size discrepancies
    if (mlhcp && nra && nra.assessedValue) {
      // Simple heuristic: very high or low value per acre might indicate size issue
      const valuePerAcre = nra.assessedValue / (mlhcp.size.value || 1);
      const expectedRange = { min: 5000000, max: 500000000 }; // 5M - 500M Leones per acre
      
      if (valuePerAcre < expectedRange.min || valuePerAcre > expectedRange.max) {
        conflicts.sizeDiscrepancy = true;
      }
    }
    
    // Check date inconsistencies
    if (mlhcp && oarg) {
      const mlhcpDate = new Date(mlhcp.registrationDate);
      const oargDate = new Date(oarg.transactionDate);
      
      // OARG transaction should not be before MLHCP registration
      if (oargDate < mlhcpDate) {
        conflicts.dateInconsistency = true;
      }
    }
    
    return conflicts;
  }
  
  /**
   * Reconciles ownership information from multiple sources
   */
  private reconcileOwnership(
    mlhcp?: MLHCPLandRecord,
    nra?: NRAPropertyRecord,
    oarg?: OARGDeedRecord,
    conflicts?: DataQualityIssues
  ): UnifiedLandRecord['ownership'] {
    // Priority: MLHCP > OARG > NRA
    let ownerName = '';
    let nationalId: string | undefined;
    let confidence = 0;
    
    if (mlhcp) {
      ownerName = mlhcp.ownerName;
      nationalId = mlhcp.ownerNationalId;
      confidence = SOURCE_WEIGHTS.mlhcp;
    } else if (oarg) {
      ownerName = oarg.grantee.name;
      nationalId = oarg.grantee.identification;
      confidence = SOURCE_WEIGHTS.oarg;
    } else if (nra) {
      ownerName = nra.taxpayerName;
      confidence = SOURCE_WEIGHTS.nra;
    }
    
    // Boost confidence if sources agree
    if (mlhcp && nra && this.areNamesSimilar([mlhcp.ownerName, nra.taxpayerName])) {
      confidence += 0.2;
    }
    if (mlhcp && oarg && this.areNamesSimilar([mlhcp.ownerName, oarg.grantee.name])) {
      confidence += 0.1;
    }
    
    // Reduce confidence for conflicts
    if (conflicts?.ownershipConflict) {
      confidence *= 0.5;
    }
    
    return {
      currentOwner: {
        name: this.normalizeOwnerName(ownerName),
        nationalId,
        confidence: Math.min(confidence, 1)
      },
      verificationRequired: confidence < 0.7 || !!conflicts?.ownershipConflict
    };
  }
  
  /**
   * Reconciles location information
   */
  private reconcileLocation(
    mlhcp?: MLHCPLandRecord,
    nra?: NRAPropertyRecord
  ): UnifiedLandRecord['location'] {
    const district = mlhcp?.district || this.extractDistrictFromAddress(nra?.propertyAddress || '');
    const chiefdom = mlhcp?.chiefdom;
    
    let coordinates: UnifiedLandRecord['location']['coordinates'];
    
    if (mlhcp?.boundaries?.coordinates) {
      // Parse coordinates if available
      try {
        const parsed = this.parseCoordinates(mlhcp.boundaries.coordinates);
        if (parsed) {
          coordinates = {
            type: parsed.type,
            coordinates: parsed.coordinates,
            accuracy: 'low' // Government data usually not GPS-accurate
          };
        }
      } catch (error) {
        // Invalid coordinates
      }
    }
    
    return {
      district: district || 'Unknown',
      chiefdom,
      coordinates
    };
  }
  
  /**
   * Calculates overall confidence score
   */
  private calculateConfidence(
    mlhcp?: MLHCPLandRecord,
    nra?: NRAPropertyRecord,
    oarg?: OARGDeedRecord,
    conflicts?: DataQualityIssues
  ): number {
    let confidence = 0;
    let sources = 0;
    
    // Base confidence from available sources
    if (mlhcp) {
      confidence += SOURCE_WEIGHTS.mlhcp;
      sources++;
    }
    if (nra) {
      confidence += SOURCE_WEIGHTS.nra;
      sources++;
    }
    if (oarg) {
      confidence += SOURCE_WEIGHTS.oarg;
      sources++;
    }
    
    // Bonus for multiple sources
    if (sources > 1) {
      confidence += 0.1 * (sources - 1);
    }
    
    // Penalties for conflicts
    if (conflicts?.ownershipConflict) confidence -= 0.3;
    if (conflicts?.dateInconsistency) confidence -= 0.1;
    if (conflicts?.sizeDiscrepancy) confidence -= 0.1;
    if (conflicts?.missingFields.length > 3) confidence -= 0.1;
    
    // Data quality bonus
    if (mlhcp?.dataQuality?.isDigitized) confidence += 0.05;
    if (mlhcp?.dataQuality?.lastVerified) confidence += 0.05;
    
    return Math.max(0, Math.min(1, confidence));
  }
  
  /**
   * Generates a unique ID for the unified record
   */
  private generateUnifiedId(
    mlhcp?: MLHCPLandRecord,
    nra?: NRAPropertyRecord,
    oarg?: OARGDeedRecord
  ): string {
    // Prefer MLHCP ID, then generate from other sources
    if (mlhcp?.landId) {
      return `UNI-${mlhcp.landId}`;
    }
    
    if (nra?.taxId) {
      return `UNI-NRA-${nra.taxId}`;
    }
    
    if (oarg?.deedNumber) {
      return `UNI-OARG-${oarg.deedNumber}`;
    }
    
    // Fallback to timestamp-based ID
    return `UNI-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Determines merge strategy used
   */
  private determineMergeStrategy(
    mlhcp?: MLHCPLandRecord,
    nra?: NRAPropertyRecord,
    oarg?: OARGDeedRecord
  ): string {
    const sources = [mlhcp && 'MLHCP', nra && 'NRA', oarg && 'OARG'].filter(Boolean);
    
    if (sources.length === 1) {
      return `Single source: ${sources[0]}`;
    }
    
    return `Multi-source merge: ${sources.join(' + ')}`;
  }
  
  /**
   * Checks if land is disputed
   */
  private checkDisputed(mlhcp?: MLHCPLandRecord, conflicts?: DataQualityIssues): boolean {
    return !!(mlhcp?.disputes?.length || conflicts?.ownershipConflict);
  }
  
  /**
   * Determines if field verification is required
   */
  private requiresVerification(conflicts: DataQualityIssues, confidence: number): boolean {
    return confidence < 0.6 || 
           conflicts.ownershipConflict || 
           conflicts.coordinatesInvalid ||
           conflicts.missingFields.length > 3;
  }
  
  /**
   * Assesses overall data quality
   */
  private assessDataQuality(confidence: number, conflicts: DataQualityIssues): 'high' | 'medium' | 'low' {
    if (confidence > 0.8 && !conflicts.ownershipConflict) return 'high';
    if (confidence > 0.5) return 'medium';
    return 'low';
  }
  
  /**
   * Generates actionable suggestions
   */
  private generateSuggestions(unified: UnifiedLandRecord, conflicts: DataQualityIssues): string[] {
    const suggestions: string[] = [];
    
    if (conflicts.ownershipConflict) {
      suggestions.push('Verify current owner through field visit and community verification');
    }
    
    if (conflicts.coordinatesInvalid || !unified.location.coordinates) {
      suggestions.push('Capture GPS coordinates through field mapping');
    }
    
    if (conflicts.missingFields.includes('ownerNationalId')) {
      suggestions.push('Obtain owner national ID for identity verification');
    }
    
    if (conflicts.boundariesVague) {
      suggestions.push('Clarify boundary descriptions with neighboring property owners');
    }
    
    if (conflicts.dateInconsistency) {
      suggestions.push('Verify transaction dates with original documents');
    }
    
    if (unified.reconciliation.confidence < 0.5) {
      suggestions.push('Priority case for comprehensive field verification');
    }
    
    return suggestions;
  }
  
  /**
   * Helper: Find name variations
   */
  private findNameVariations(names: string[]): string[] {
    const normalized = names.map(n => this.normalizeOwnerName(n));
    return [...new Set(normalized)];
  }
  
  /**
   * Helper: Check if names are similar enough to be the same person
   */
  private areNamesSimilar(names: string[]): boolean {
    if (names.length < 2) return true;
    
    const normalized = names.map(n => this.normalizeOwnerName(n).toLowerCase());
    
    // Check each pair
    for (let i = 0; i < normalized.length - 1; i++) {
      for (let j = i + 1; j < normalized.length; j++) {
        const similarity = this.calculateNameSimilarity(normalized[i], normalized[j]);
        if (similarity < NAME_SIMILARITY_THRESHOLD) {
          return false;
        }
      }
    }
    
    return true;
  }
  
  /**
   * Helper: Calculate name similarity (simple implementation)
   */
  private calculateNameSimilarity(name1: string, name2: string): number {
    // Simple token-based similarity
    const tokens1 = new Set(name1.split(' '));
    const tokens2 = new Set(name2.split(' '));
    
    const intersection = new Set([...tokens1].filter(x => tokens2.has(x)));
    const union = new Set([...tokens1, ...tokens2]);
    
    return intersection.size / union.size;
  }
  
  /**
   * Helper: Normalize owner name
   */
  private normalizeOwnerName(name: string): string {
    return name
      .trim()
      .replace(/\s+/g, ' ')
      .split(' ')
      .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(' ');
  }
  
  /**
   * Helper: Check if boundaries are vague
   */
  private areBoundariesVague(boundaries?: MLHCPLandRecord['boundaries']): boolean {
    if (!boundaries) return true;
    
    const directions = [boundaries.north, boundaries.south, boundaries.east, boundaries.west];
    const defined = directions.filter(Boolean).length;
    
    // Less than 3 boundaries defined is vague
    if (defined < 3) return true;
    
    // Check for vague descriptions
    const vagueTerms = ['road', 'stream', 'tree', 'land'];
    const hasVague = directions.some(desc => 
      desc && vagueTerms.some(term => desc.toLowerCase().includes(term))
    );
    
    return hasVague && !boundaries.coordinates;
  }
  
  /**
   * Helper: Extract district from address
   */
  private extractDistrictFromAddress(address: string): string {
    // Implementation would match against known districts
    // For now, return empty
    return '';
  }
  
  /**
   * Helper: Parse coordinate string
   */
  private parseCoordinates(coordString: string): { type: 'Point' | 'Polygon'; coordinates: any } | null {
    // Simple implementation - would need robust parsing in production
    try {
      const parsed = JSON.parse(coordString);
      if (parsed.type && parsed.coordinates) {
        return parsed;
      }
    } catch {
      // Try other formats
    }
    
    return null;
  }
}