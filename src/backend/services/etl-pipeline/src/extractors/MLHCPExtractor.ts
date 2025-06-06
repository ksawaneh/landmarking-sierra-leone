/**
 * MLHCP (Ministry of Lands) data extractor
 */

import { BaseExtractor } from './BaseExtractor';
import { ExtractResult, ExtractError, LandRecord } from '../types';
import { MLHCPAdapter } from '../../government/adapters/mlhcp-adapter';
import { GovernmentLandRecord } from '../../government/schemas/government-data.types';
import { logger } from '../utils/logger';

export class MLHCPExtractor extends BaseExtractor<LandRecord> {
  private adapter: MLHCPAdapter;

  constructor(config: any) {
    super(config);
    this.adapter = new MLHCPAdapter({
      baseUrl: config.baseUrl || process.env.MLHCP_BASE_URL,
      apiKey: config.apiKey || process.env.MLHCP_API_KEY,
      mockMode: config.mockMode !== false
    });
  }

  async connect(): Promise<void> {
    try {
      logger.info('Connecting to MLHCP...');
      // In real implementation, test connection
      this.isConnected = true;
      logger.info('Connected to MLHCP successfully');
    } catch (error) {
      logger.error('Failed to connect to MLHCP', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    this.isConnected = false;
    logger.info('Disconnected from MLHCP');
  }

  async extractBatch(offset: number, limit: number): Promise<ExtractResult<LandRecord>> {
    try {
      const result = await this.adapter.query({}, { 
        limit, 
        offset 
      });

      const { valid, errors } = this.validateData(result.data);
      const transformedData = valid.map(record => this.transformRecord(record));

      return {
        data: transformedData,
        metadata: {
          source: 'MLHCP',
          recordCount: transformedData.length,
          extractedAt: new Date(),
          duration: 0,
          hasMore: result.pagination.hasMore
        },
        errors
      };
    } catch (error) {
      logger.error('Error extracting batch from MLHCP', error);
      throw error;
    }
  }

  async getTotalCount(): Promise<number> {
    try {
      const result = await this.adapter.query({}, { limit: 1 });
      return result.pagination.total;
    } catch (error) {
      logger.error('Error getting total count from MLHCP', error);
      throw error;
    }
  }

  protected async extractIncrementalData(lastRunTime: Date): Promise<ExtractResult<LandRecord>> {
    try {
      // Query for records updated since last run
      const result = await this.adapter.query({
        updatedAfter: lastRunTime.toISOString()
      });

      const { valid, errors } = this.validateData(result.data);
      const transformedData = valid.map(record => this.transformRecord(record));

      return {
        data: transformedData,
        metadata: {
          source: 'MLHCP',
          recordCount: transformedData.length,
          extractedAt: new Date(),
          duration: 0,
          hasMore: false
        },
        errors
      };
    } catch (error) {
      logger.error('Error extracting incremental data from MLHCP', error);
      throw error;
    }
  }

  protected isValidRecord(record: any): boolean {
    // Basic validation
    if (!record.parcelNumber || !record.district) {
      return false;
    }
    
    // Check required fields
    if (!record.ownership?.currentOwner?.name) {
      return false;
    }

    // Validate boundaries if present
    if (record.boundaries?.coordinates) {
      if (!Array.isArray(record.boundaries.coordinates) || 
          record.boundaries.coordinates.length < 3) {
        return false;
      }
    }

    return true;
  }

  private transformRecord(mlhcpRecord: GovernmentLandRecord): LandRecord {
    const owner = mlhcpRecord.ownership.currentOwner;
    
    return {
      id: mlhcpRecord.id,
      parcelNumber: mlhcpRecord.parcelNumber,
      
      // Location
      district: mlhcpRecord.location.district,
      chiefdom: mlhcpRecord.location.chiefdom,
      ward: mlhcpRecord.location.ward,
      address: mlhcpRecord.location.address || '',
      coordinates: mlhcpRecord.location.coordinates ? {
        latitude: mlhcpRecord.location.coordinates.lat,
        longitude: mlhcpRecord.location.coordinates.lng
      } : undefined,
      boundaries: this.transformBoundaries(mlhcpRecord.boundaries),
      
      // Ownership
      owner: {
        name: owner.name,
        nationalId: owner.nationalId,
        phoneNumber: owner.contact?.phone,
        email: owner.contact?.email
      },
      previousOwners: mlhcpRecord.ownership.history?.map(h => ({
        name: h.name,
        from: new Date(h.from),
        to: new Date(h.to)
      })),
      
      // Property details
      landType: mlhcpRecord.landType,
      area: mlhcpRecord.area,
      landUse: mlhcpRecord.landUse,
      structures: mlhcpRecord.structures,
      
      // Valuation
      currentValue: mlhcpRecord.valuation?.currentValue,
      lastValuationDate: mlhcpRecord.valuation?.lastAssessment ? 
        new Date(mlhcpRecord.valuation.lastAssessment) : undefined,
      taxAssessment: mlhcpRecord.valuation?.taxValue,
      
      // Legal
      titleDeedNumber: mlhcpRecord.titleDeed?.number,
      encumbrances: mlhcpRecord.encumbrances || [],
      disputes: mlhcpRecord.disputes?.map(d => ({
        type: d.type,
        status: d.status,
        filedDate: new Date(d.filedDate)
      })),
      
      // Tax compliance (will be enriched from NRA)
      taxStatus: 'pending' as const,
      
      // Verification
      verificationStatus: mlhcpRecord.verificationStatus || 'pending',
      lastVerificationDate: mlhcpRecord.lastVerified ? 
        new Date(mlhcpRecord.lastVerified) : undefined,
      
      // Metadata
      sourceSystem: 'MLHCP',
      qualityScore: 0, // Will be calculated during transformation
      createdAt: new Date(mlhcpRecord.createdAt),
      updatedAt: new Date(mlhcpRecord.updatedAt),
      version: 1
    };
  }

  private transformBoundaries(boundaries: any): Array<{ latitude: number; longitude: number }> {
    if (!boundaries?.coordinates || !Array.isArray(boundaries.coordinates)) {
      return [];
    }

    return boundaries.coordinates.map((coord: any) => ({
      latitude: coord.lat || coord.latitude || coord[1],
      longitude: coord.lng || coord.longitude || coord[0]
    }));
  }
}