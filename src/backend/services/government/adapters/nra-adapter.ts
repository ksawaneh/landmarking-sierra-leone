/**
 * National Revenue Authority (NRA) Adapter
 * Handles integration with tax records system
 */

import { z } from 'zod';
import { BaseGovernmentAdapter, AdapterConfig, QueryOptions, AdapterResponse } from './base-adapter';
import { NRAPropertyRecord } from '../schemas/government-data.types';
import { generateNRARecord, generateCompleteRecordSet } from '../mock-data/sierra-leone-data-generator';

/**
 * Query parameters specific to NRA
 */
export interface NRAQuery {
  taxId?: string;
  taxpayerName?: string;
  taxpayerTin?: string;
  propertyAddress?: string;
  isCompliant?: boolean;
  hasArrears?: boolean;
}

/**
 * Validation schema for NRA records
 */
const NRARecordSchema = z.object({
  taxId: z.string(),
  propertyRef: z.string().optional(),
  taxpayerName: z.string(),
  taxpayerTin: z.string().optional(),
  taxpayerAddress: z.string(),
  propertyAddress: z.string(),
  propertyType: z.string(),
  assessedValue: z.number().optional(),
  lastAssessmentDate: z.string().optional(),
  annualTax: z.number(),
  lastPaymentDate: z.string().optional(),
  lastPaymentAmount: z.number().optional(),
  arrears: z.number().optional(),
  isCompliant: z.boolean(),
  complianceNotes: z.array(z.string()).optional()
});

export class NRAAdapter extends BaseGovernmentAdapter<NRAPropertyRecord, NRAQuery> {
  private mockData: NRAPropertyRecord[] = [];
  
  constructor(config: AdapterConfig) {
    super({
      name: 'NRA',
      ...config
    });
    
    if (this.config.mockMode) {
      this.initializeMockData();
    }
  }
  
  /**
   * Initialize mock data for testing
   */
  private initializeMockData(): void {
    const { nra } = generateCompleteRecordSet({
      count: 800,
      dataQualityIssues: true
    });
    this.mockData = nra;
    this.log('info', 'Initialized NRA mock data', { recordCount: this.mockData.length });
  }
  
  /**
   * Test connection to NRA system
   */
  async testConnection(): Promise<boolean> {
    if (this.config.mockMode) {
      return true;
    }
    
    try {
      // In production, test actual NRA API connection
      const response = await this.retryOperation(async () => {
        if (!this.config.baseUrl) {
          throw new Error('NRA base URL not configured');
        }
        
        // Would make actual HTTP request here
        return true;
      });
      
      return response;
    } catch (error) {
      this.log('error', 'Failed to connect to NRA', error);
      return false;
    }
  }
  
  /**
   * Query NRA records
   */
  async query(params: NRAQuery, options?: QueryOptions): Promise<AdapterResponse<NRAPropertyRecord[]>> {
    const { result, duration } = await this.measurePerformance(
      async () => {
        if (this.config.mockMode) {
          return this.queryMockData(params, options);
        }
        
        // Production implementation would query actual NRA API
        throw new Error('Production NRA integration not yet implemented');
      },
      'NRA query'
    );
    
    return {
      ...result,
      metadata: {
        ...result.metadata,
        queryTime: duration
      }
    };
  }
  
  /**
   * Query mock data for testing
   */
  private queryMockData(params: NRAQuery, options?: QueryOptions): AdapterResponse<NRAPropertyRecord[]> {
    let filtered = [...this.mockData];
    
    // Apply filters
    if (params.taxId) {
      filtered = filtered.filter(r => r.taxId === params.taxId);
    }
    
    if (params.taxpayerName) {
      const searchName = params.taxpayerName.toLowerCase();
      filtered = filtered.filter(r => 
        r.taxpayerName.toLowerCase().includes(searchName)
      );
    }
    
    if (params.taxpayerTin) {
      filtered = filtered.filter(r => r.taxpayerTin === params.taxpayerTin);
    }
    
    if (params.propertyAddress) {
      const searchAddr = params.propertyAddress.toLowerCase();
      filtered = filtered.filter(r => 
        r.propertyAddress.toLowerCase().includes(searchAddr)
      );
    }
    
    if (params.isCompliant !== undefined) {
      filtered = filtered.filter(r => r.isCompliant === params.isCompliant);
    }
    
    if (params.hasArrears !== undefined) {
      filtered = filtered.filter(r => 
        params.hasArrears ? (r.arrears || 0) > 0 : (r.arrears || 0) === 0
      );
    }
    
    // Apply pagination
    const limit = options?.limit || 100;
    const offset = options?.offset || 0;
    const paginated = filtered.slice(offset, offset + limit);
    
    return {
      data: paginated,
      metadata: {
        source: 'NRA',
        timestamp: new Date(),
        queryTime: 0,
        recordCount: paginated.length,
        hasMore: filtered.length > offset + limit
      },
      warnings: this.generateTaxWarnings(paginated)
    };
  }
  
  /**
   * Get record by tax ID
   */
  async getById(taxId: string): Promise<AdapterResponse<NRAPropertyRecord | null>> {
    const result = await this.query({ taxId }, { limit: 1 });
    
    return {
      data: result.data.length > 0 ? result.data[0] : null,
      metadata: {
        ...result.metadata,
        recordCount: result.data.length > 0 ? 1 : 0
      },
      warnings: result.warnings
    };
  }
  
  /**
   * Validate NRA record structure
   */
  validateRecord(record: unknown): NRAPropertyRecord {
    try {
      return NRARecordSchema.parse(record);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const issues = error.errors.map(e => `${e.path.join('.')}: ${e.message}`);
        throw new Error(`Invalid NRA record: ${issues.join(', ')}`);
      }
      throw error;
    }
  }
  
  /**
   * Transform raw NRA data to our schema
   */
  transformRecord(rawRecord: any): NRAPropertyRecord {
    // Handle different date formats
    const parseDate = (dateStr: string): string => {
      const date = new Date(dateStr);
      return date.toISOString().split('T')[0];
    };
    
    // Transform the record
    const transformed: NRAPropertyRecord = {
      taxId: rawRecord.tax_id || rawRecord.taxId || '',
      propertyRef: rawRecord.property_ref || rawRecord.propertyRef,
      
      taxpayerName: this.normalizeOwnerName(rawRecord.taxpayer_name || rawRecord.taxpayerName || ''),
      taxpayerTin: rawRecord.taxpayer_tin || rawRecord.taxpayerTin,
      taxpayerAddress: rawRecord.taxpayer_address || rawRecord.taxpayerAddress || '',
      
      propertyAddress: rawRecord.property_address || rawRecord.propertyAddress || '',
      propertyType: rawRecord.property_type || rawRecord.propertyType || 'Residential',
      assessedValue: Number(rawRecord.assessed_value || rawRecord.assessedValue || 0),
      lastAssessmentDate: rawRecord.last_assessment_date ? parseDate(rawRecord.last_assessment_date) : undefined,
      
      annualTax: Number(rawRecord.annual_tax || rawRecord.annualTax || 0),
      lastPaymentDate: rawRecord.last_payment_date ? parseDate(rawRecord.last_payment_date) : undefined,
      lastPaymentAmount: rawRecord.last_payment_amount ? Number(rawRecord.last_payment_amount) : undefined,
      arrears: Number(rawRecord.arrears || 0),
      
      isCompliant: Boolean(rawRecord.is_compliant ?? rawRecord.isCompliant ?? false),
      complianceNotes: rawRecord.compliance_notes || rawRecord.complianceNotes || []
    };
    
    return this.validateRecord(transformed);
  }
  
  /**
   * Normalize owner names
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
   * Generate tax-specific warnings
   */
  private generateTaxWarnings(records: NRAPropertyRecord[]): string[] {
    const warnings: string[] = [];
    
    const withArrears = records.filter(r => (r.arrears || 0) > 0);
    if (withArrears.length > 0) {
      const totalArrears = withArrears.reduce((sum, r) => sum + (r.arrears || 0), 0);
      warnings.push(`${withArrears.length} properties have tax arrears totaling ${totalArrears.toLocaleString()} Leones`);
    }
    
    const nonCompliant = records.filter(r => !r.isCompliant).length;
    if (nonCompliant > 0) {
      warnings.push(`${nonCompliant} properties are non-compliant with tax regulations`);
    }
    
    const oldAssessments = records.filter(r => {
      if (!r.lastAssessmentDate) return true;
      const assessmentDate = new Date(r.lastAssessmentDate);
      const threeYearsAgo = new Date();
      threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);
      return assessmentDate < threeYearsAgo;
    }).length;
    
    if (oldAssessments > 0) {
      warnings.push(`${oldAssessments} properties need reassessment (over 3 years old)`);
    }
    
    return warnings;
  }
  
  /**
   * Calculate tax compliance for a property
   */
  async calculateCompliance(taxId: string): Promise<{
    isCompliant: boolean;
    arrears: number;
    lastPaymentDays: number;
    recommendations: string[];
  }> {
    const record = await this.getById(taxId);
    
    if (!record.data) {
      throw new Error(`No tax record found for ID: ${taxId}`);
    }
    
    const arrears = record.data.arrears || 0;
    const lastPaymentDate = record.data.lastPaymentDate ? new Date(record.data.lastPaymentDate) : null;
    const daysSincePayment = lastPaymentDate 
      ? Math.floor((Date.now() - lastPaymentDate.getTime()) / (1000 * 60 * 60 * 24))
      : 999;
    
    const recommendations: string[] = [];
    
    if (arrears > 0) {
      recommendations.push(`Pay outstanding arrears of ${arrears.toLocaleString()} Leones`);
    }
    
    if (daysSincePayment > 365) {
      recommendations.push('Property tax payment is overdue');
    }
    
    if (!record.data.lastAssessmentDate) {
      recommendations.push('Property needs assessment for accurate tax calculation');
    }
    
    return {
      isCompliant: record.data.isCompliant,
      arrears,
      lastPaymentDays: daysSincePayment,
      recommendations
    };
  }
}