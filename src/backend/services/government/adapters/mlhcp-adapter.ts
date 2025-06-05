/**
 * Ministry of Lands, Housing and Country Planning (MLHCP) Adapter
 * Handles integration with the main land registry system
 */

import { z } from 'zod';
import { BaseGovernmentAdapter, AdapterConfig, QueryOptions, AdapterResponse } from './base-adapter';
import { MLHCPLandRecord, DistrictName, SierraLeoneDistricts } from '../schemas/government-data.types';
import { generateMLHCPRecord, generateCompleteRecordSet } from '../mock-data/sierra-leone-data-generator';

/**
 * Query parameters specific to MLHCP
 */
export interface MLHCPQuery {
  landId?: string;
  registryNumber?: string;
  ownerName?: string;
  district?: DistrictName;
  chiefdom?: string;
  landType?: MLHCPLandRecord['landType'];
  dateRange?: {
    start: Date;
    end: Date;
  };
}

/**
 * Validation schema for MLHCP records
 */
const MLHCPRecordSchema = z.object({
  landId: z.string(),
  registryNumber: z.string(),
  pageNumber: z.string(),
  ownerName: z.string(),
  ownerNationalId: z.string().optional(),
  ownerAddress: z.string(),
  ownerPhone: z.string().optional(),
  landType: z.enum(['residential', 'commercial', 'agricultural', 'industrial', 'mixed']),
  landUse: z.string().optional(),
  size: z.object({
    value: z.number(),
    unit: z.enum(['acres', 'hectares', 'square_feet', 'town_lots'])
  }),
  district: z.string(),
  chiefdom: z.string().optional(),
  section: z.string().optional(),
  address: z.string().optional(),
  boundaries: z.object({
    north: z.string().optional(),
    south: z.string().optional(),
    east: z.string().optional(),
    west: z.string().optional(),
    coordinates: z.string().optional()
  }).optional(),
  registrationDate: z.string(),
  registrationOfficer: z.string().optional(),
  registrationFee: z.number().optional(),
  encumbrances: z.array(z.string()).optional(),
  disputes: z.array(z.string()).optional(),
  previousOwners: z.array(z.string()).optional(),
  dataQuality: z.object({
    isDigitized: z.boolean(),
    hasPhysicalFile: z.boolean(),
    lastVerified: z.string().optional(),
    issues: z.array(z.string()).optional()
  }).optional()
});

export class MLHCPAdapter extends BaseGovernmentAdapter<MLHCPLandRecord, MLHCPQuery> {
  private mockData: MLHCPLandRecord[] = [];
  
  constructor(config: AdapterConfig) {
    super({
      name: 'MLHCP',
      ...config
    });
    
    // Initialize mock data if in mock mode
    if (this.config.mockMode) {
      this.initializeMockData();
    }
  }
  
  /**
   * Initialize mock data for testing
   */
  private initializeMockData(): void {
    const { mlhcp } = generateCompleteRecordSet({
      count: 1000,
      includeDisputes: true,
      dataQualityIssues: true
    });
    this.mockData = mlhcp;
    this.log('info', 'Initialized MLHCP mock data', { recordCount: this.mockData.length });
  }
  
  /**
   * Test connection to MLHCP system
   */
  async testConnection(): Promise<boolean> {
    if (this.config.mockMode) {
      return true;
    }
    
    try {
      // In production, this would test actual API/database connection
      const response = await this.retryOperation(async () => {
        // Simulate API call
        if (!this.config.baseUrl) {
          throw new Error('MLHCP base URL not configured');
        }
        
        // Would make actual HTTP request here
        return true;
      });
      
      return response;
    } catch (error) {
      this.log('error', 'Failed to connect to MLHCP', error);
      return false;
    }
  }
  
  /**
   * Query MLHCP records
   */
  async query(params: MLHCPQuery, options?: QueryOptions): Promise<AdapterResponse<MLHCPLandRecord[]>> {
    const { result, duration } = await this.measurePerformance(
      async () => {
        if (this.config.mockMode) {
          return this.queryMockData(params, options);
        }
        
        // Production implementation would query actual MLHCP API/database
        throw new Error('Production MLHCP integration not yet implemented');
      },
      'MLHCP query'
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
  private queryMockData(params: MLHCPQuery, options?: QueryOptions): AdapterResponse<MLHCPLandRecord[]> {
    let filtered = [...this.mockData];
    
    // Apply filters
    if (params.landId) {
      filtered = filtered.filter(r => r.landId === params.landId);
    }
    
    if (params.registryNumber) {
      filtered = filtered.filter(r => r.registryNumber === params.registryNumber);
    }
    
    if (params.ownerName) {
      // Case-insensitive partial match to handle variations
      const searchName = params.ownerName.toLowerCase();
      filtered = filtered.filter(r => 
        r.ownerName.toLowerCase().includes(searchName)
      );
    }
    
    if (params.district) {
      filtered = filtered.filter(r => r.district === params.district);
    }
    
    if (params.chiefdom) {
      filtered = filtered.filter(r => r.chiefdom === params.chiefdom);
    }
    
    if (params.landType) {
      filtered = filtered.filter(r => r.landType === params.landType);
    }
    
    if (params.dateRange) {
      filtered = filtered.filter(r => {
        const regDate = new Date(r.registrationDate);
        return regDate >= params.dateRange!.start && regDate <= params.dateRange!.end;
      });
    }
    
    // Apply pagination
    const limit = options?.limit || 100;
    const offset = options?.offset || 0;
    const paginated = filtered.slice(offset, offset + limit);
    
    return {
      data: paginated,
      metadata: {
        source: 'MLHCP',
        timestamp: new Date(),
        queryTime: 0,
        recordCount: paginated.length,
        hasMore: filtered.length > offset + limit
      },
      warnings: this.generateDataQualityWarnings(paginated)
    };
  }
  
  /**
   * Get record by ID
   */
  async getById(landId: string): Promise<AdapterResponse<MLHCPLandRecord | null>> {
    const result = await this.query({ landId }, { limit: 1 });
    
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
   * Validate MLHCP record structure
   */
  validateRecord(record: unknown): MLHCPLandRecord {
    try {
      return MLHCPRecordSchema.parse(record);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const issues = error.errors.map(e => `${e.path.join('.')}: ${e.message}`);
        throw new Error(`Invalid MLHCP record: ${issues.join(', ')}`);
      }
      throw error;
    }
  }
  
  /**
   * Transform raw MLHCP data to our schema
   */
  transformRecord(rawRecord: any): MLHCPLandRecord {
    // Handle different date formats
    const parseDate = (dateStr: string): string => {
      // Convert various formats to ISO
      const date = new Date(dateStr);
      return date.toISOString().split('T')[0];
    };
    
    // Handle size unit variations
    const normalizeUnit = (unit: string): MLHCPLandRecord['size']['unit'] => {
      const unitMap: Record<string, MLHCPLandRecord['size']['unit']> = {
        'acre': 'acres',
        'acres': 'acres',
        'ha': 'hectares',
        'hectare': 'hectares',
        'hectares': 'hectares',
        'sq_ft': 'square_feet',
        'sqft': 'square_feet',
        'square_feet': 'square_feet',
        'town_lot': 'town_lots',
        'town_lots': 'town_lots'
      };
      
      return unitMap[unit.toLowerCase()] || 'acres';
    };
    
    // Transform the record
    const transformed: MLHCPLandRecord = {
      landId: rawRecord.land_id || rawRecord.landId || '',
      registryNumber: rawRecord.registry_number || rawRecord.registryNumber || '',
      pageNumber: String(rawRecord.page_number || rawRecord.pageNumber || ''),
      
      ownerName: this.normalizeOwnerName(rawRecord.owner_name || rawRecord.ownerName || ''),
      ownerNationalId: rawRecord.owner_national_id || rawRecord.ownerNationalId,
      ownerAddress: rawRecord.owner_address || rawRecord.ownerAddress || '',
      ownerPhone: rawRecord.owner_phone || rawRecord.ownerPhone,
      
      landType: this.normalizeLandType(rawRecord.land_type || rawRecord.landType || 'residential'),
      landUse: rawRecord.land_use || rawRecord.landUse,
      
      size: {
        value: Number(rawRecord.size_value || rawRecord.size?.value || 0),
        unit: normalizeUnit(rawRecord.size_unit || rawRecord.size?.unit || 'acres')
      },
      
      district: this.normalizeDistrict(rawRecord.district || ''),
      chiefdom: rawRecord.chiefdom,
      section: rawRecord.section,
      address: rawRecord.address,
      
      boundaries: rawRecord.boundaries || {},
      
      registrationDate: parseDate(rawRecord.registration_date || rawRecord.registrationDate || ''),
      registrationOfficer: rawRecord.registration_officer || rawRecord.registrationOfficer,
      registrationFee: Number(rawRecord.registration_fee || rawRecord.registrationFee || 0),
      
      encumbrances: rawRecord.encumbrances || [],
      disputes: rawRecord.disputes || [],
      previousOwners: rawRecord.previous_owners || rawRecord.previousOwners || [],
      
      dataQuality: {
        isDigitized: Boolean(rawRecord.is_digitized ?? rawRecord.dataQuality?.isDigitized ?? false),
        hasPhysicalFile: Boolean(rawRecord.has_physical_file ?? rawRecord.dataQuality?.hasPhysicalFile ?? true),
        lastVerified: rawRecord.last_verified || rawRecord.dataQuality?.lastVerified,
        issues: rawRecord.data_issues || rawRecord.dataQuality?.issues || []
      }
    };
    
    return this.validateRecord(transformed);
  }
  
  /**
   * Normalize owner names to handle variations
   */
  private normalizeOwnerName(name: string): string {
    return name
      .trim()
      .replace(/\s+/g, ' ') // Multiple spaces to single
      .split(' ')
      .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(' ');
  }
  
  /**
   * Normalize land type values
   */
  private normalizeLandType(type: string): MLHCPLandRecord['landType'] {
    const typeMap: Record<string, MLHCPLandRecord['landType']> = {
      'res': 'residential',
      'residential': 'residential',
      'com': 'commercial',
      'commercial': 'commercial',
      'agr': 'agricultural',
      'agricultural': 'agricultural',
      'farming': 'agricultural',
      'ind': 'industrial',
      'industrial': 'industrial',
      'mix': 'mixed',
      'mixed': 'mixed',
      'mixed_use': 'mixed'
    };
    
    return typeMap[type.toLowerCase()] || 'residential';
  }
  
  /**
   * Normalize district names
   */
  private normalizeDistrict(district: string): string {
    // Try to match against known districts
    const normalized = district.trim();
    
    // Check exact match first
    if (normalized in SierraLeoneDistricts) {
      return normalized as DistrictName;
    }
    
    // Check case-insensitive match
    for (const [name] of Object.entries(SierraLeoneDistricts)) {
      if (name.toLowerCase() === normalized.toLowerCase()) {
        return name;
      }
    }
    
    // Check if it contains a district name
    for (const [name] of Object.entries(SierraLeoneDistricts)) {
      if (normalized.toLowerCase().includes(name.toLowerCase())) {
        return name;
      }
    }
    
    // Return as-is if no match found
    this.log('warn', 'Unknown district name', { district });
    return normalized;
  }
  
  /**
   * Generate data quality warnings
   */
  private generateDataQualityWarnings(records: MLHCPLandRecord[]): string[] {
    const warnings: string[] = [];
    
    const missingNationalIds = records.filter(r => !r.ownerNationalId).length;
    if (missingNationalIds > 0) {
      warnings.push(`${missingNationalIds} records missing owner national ID`);
    }
    
    const incompleteBoundaries = records.filter(r => {
      const b = r.boundaries;
      return !b || (!b.north || !b.south || !b.east || !b.west);
    }).length;
    if (incompleteBoundaries > 0) {
      warnings.push(`${incompleteBoundaries} records have incomplete boundary descriptions`);
    }
    
    const oldRecords = records.filter(r => {
      const regDate = new Date(r.registrationDate);
      const fiveYearsAgo = new Date();
      fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
      return regDate < fiveYearsAgo && !r.dataQuality?.lastVerified;
    }).length;
    if (oldRecords > 0) {
      warnings.push(`${oldRecords} records not verified in the last 5 years`);
    }
    
    return warnings;
  }
}