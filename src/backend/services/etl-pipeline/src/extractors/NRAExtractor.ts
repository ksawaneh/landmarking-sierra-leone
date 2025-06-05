/**
 * NRA (National Revenue Authority) data extractor
 */

import { BaseExtractor } from './BaseExtractor';
import { ExtractResult, LandRecord } from '../types';
import { NRAAdapter } from '../../government/adapters/nra-adapter';
import { GovernmentTaxRecord } from '../../government/schemas/government-data.types';
import { logger } from '../utils/logger';

export class NRAExtractor extends BaseExtractor<Partial<LandRecord>> {
  private adapter: NRAAdapter;

  constructor(config: any) {
    super(config);
    this.adapter = new NRAAdapter({
      baseUrl: config.baseUrl || process.env.NRA_BASE_URL,
      apiKey: config.apiKey || process.env.NRA_API_KEY,
      mockMode: config.mockMode !== false
    });
  }

  async connect(): Promise<void> {
    try {
      logger.info('Connecting to NRA...');
      // Test connection in real implementation
      this.isConnected = true;
      logger.info('Connected to NRA successfully');
    } catch (error) {
      logger.error('Failed to connect to NRA', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    this.isConnected = false;
    logger.info('Disconnected from NRA');
  }

  async extractBatch(offset: number, limit: number): Promise<ExtractResult<Partial<LandRecord>>> {
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
          source: 'NRA',
          recordCount: transformedData.length,
          extractedAt: new Date(),
          duration: 0,
          hasMore: result.pagination.hasMore
        },
        errors
      };
    } catch (error) {
      logger.error('Error extracting batch from NRA', error);
      throw error;
    }
  }

  async getTotalCount(): Promise<number> {
    try {
      const result = await this.adapter.query({}, { limit: 1 });
      return result.pagination.total;
    } catch (error) {
      logger.error('Error getting total count from NRA', error);
      throw error;
    }
  }

  protected async extractIncrementalData(lastRunTime: Date): Promise<ExtractResult<Partial<LandRecord>>> {
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
          source: 'NRA',
          recordCount: transformedData.length,
          extractedAt: new Date(),
          duration: 0,
          hasMore: false
        },
        errors
      };
    } catch (error) {
      logger.error('Error extracting incremental data from NRA', error);
      throw error;
    }
  }

  protected isValidRecord(record: any): boolean {
    // Basic validation for tax records
    if (!record.propertyId || !record.tin) {
      return false;
    }

    // Must have some tax information
    if (!record.assessment && !record.payments) {
      return false;
    }

    return true;
  }

  private transformRecord(nraRecord: GovernmentTaxRecord): Partial<LandRecord> {
    // NRA provides partial data that will be merged with MLHCP data
    return {
      id: nraRecord.propertyId, // Will be matched with MLHCP parcel ID
      
      // Tax-specific fields
      currentValue: nraRecord.assessment?.propertyValue,
      taxAssessment: nraRecord.assessment?.taxAmount,
      
      // Compliance status
      taxStatus: this.determineTaxStatus(nraRecord),
      lastPaymentDate: this.getLastPaymentDate(nraRecord),
      arrearsAmount: this.calculateArrears(nraRecord),
      
      // Owner information (partial)
      owner: {
        name: nraRecord.taxpayer.name,
        nationalId: nraRecord.tin // TIN as identifier
      },
      
      // Metadata
      sourceSystem: 'NRA' as const
    };
  }

  private determineTaxStatus(record: GovernmentTaxRecord): 'compliant' | 'arrears' | 'exempt' {
    if (record.compliance.isExempt) {
      return 'exempt';
    }
    
    if (record.compliance.hasArrears || !record.compliance.isCompliant) {
      return 'arrears';
    }
    
    return 'compliant';
  }

  private getLastPaymentDate(record: GovernmentTaxRecord): Date | undefined {
    if (!record.payments || record.payments.length === 0) {
      return undefined;
    }

    // Find the most recent payment
    const sortedPayments = [...record.payments].sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    return new Date(sortedPayments[0].date);
  }

  private calculateArrears(record: GovernmentTaxRecord): number {
    if (!record.compliance.hasArrears) {
      return 0;
    }

    // Calculate total outstanding amount
    const totalAssessed = record.assessment?.taxAmount || 0;
    const totalPaid = record.payments?.reduce((sum, payment) => sum + payment.amount, 0) || 0;
    
    return Math.max(0, totalAssessed - totalPaid);
  }

  /**
   * Extract tax records by parcel IDs for targeted updates
   */
  async extractByParcelIds(parcelIds: string[]): Promise<ExtractResult<Partial<LandRecord>>> {
    const allData: Partial<LandRecord>[] = [];
    const errors: any[] = [];
    const batchSize = 100; // Process in batches to avoid API limits

    try {
      await this.connect();

      for (let i = 0; i < parcelIds.length; i += batchSize) {
        const batch = parcelIds.slice(i, i + batchSize);
        
        const results = await Promise.all(
          batch.map(async (parcelId) => {
            try {
              const result = await this.adapter.getById(parcelId);
              if (result.data) {
                return this.transformRecord(result.data);
              }
              return null;
            } catch (error) {
              errors.push({
                record: { parcelId },
                error: error instanceof Error ? error.message : 'Unknown error',
                timestamp: new Date(),
                retryable: true
              });
              return null;
            }
          })
        );

        allData.push(...results.filter(r => r !== null) as Partial<LandRecord>[]);
      }

      return {
        data: allData,
        metadata: {
          source: 'NRA',
          recordCount: allData.length,
          extractedAt: new Date(),
          duration: 0,
          hasMore: false
        },
        errors
      };
    } finally {
      await this.disconnect();
    }
  }
}