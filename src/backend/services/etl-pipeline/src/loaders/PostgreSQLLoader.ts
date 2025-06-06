/**
 * PostgreSQL loader for land records
 */

import { Pool, PoolClient } from 'pg';
import { BaseLoader } from './BaseLoader';
import { LoadResult, LoadError, LandRecord } from '../types';
import { logger } from '../utils/logger';
import { encryptionService } from '../utils/encryption';
import { validationService } from '../utils/validation';
import * as copyFrom from 'pg-copy-streams';

export class PostgreSQLLoader extends BaseLoader<LandRecord> {
  private pool: Pool;
  private client?: PoolClient;

  constructor(connectionString: string, batchSize: number = 1000) {
    super('PostgreSQL', batchSize);
    
    this.pool = new Pool({
      connectionString,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000
    });
  }

  async connect(): Promise<void> {
    try {
      this.client = await this.pool.connect();
      logger.info('Connected to PostgreSQL');
      
      // Ensure tables exist
      await this.ensureTables();
    } catch (error) {
      logger.error('Failed to connect to PostgreSQL', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      this.client.release();
      this.client = undefined;
    }
    await this.pool.end();
    logger.info('Disconnected from PostgreSQL');
  }

  async loadBatch(records: LandRecord[]): Promise<LoadResult> {
    if (!this.client) {
      throw new Error('Not connected to database');
    }

    const errors: LoadError[] = [];
    let recordsLoaded = 0;
    let recordsUpdated = 0;
    let recordsSkipped = 0;

    // Start transaction
    await this.client.query('BEGIN');

    try {
      // Check which records exist
      const existsMap = await this.batchExistsCheck(records);

      for (const record of records) {
        try {
          if (!this.validateRecord(record)) {
            recordsSkipped++;
            continue;
          }

          const exists = existsMap.get(record.id);
          
          if (exists) {
            // Update existing record
            await this.updateRecord(record);
            recordsUpdated++;
          } else {
            // Insert new record
            await this.insertRecord(record);
            recordsLoaded++;
          }
        } catch (error) {
          errors.push({
            record,
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date(),
            retryable: true
          });
        }
      }

      // Commit transaction
      await this.client.query('COMMIT');
    } catch (error) {
      // Rollback on error
      await this.client.query('ROLLBACK');
      throw error;
    }

    return {
      metadata: {
        destination: this.name,
        recordsLoaded,
        recordsUpdated,
        recordsSkipped,
        loadedAt: new Date(),
        duration: 0
      },
      errors
    };
  }

  protected async recordExists(record: LandRecord): Promise<boolean> {
    if (!this.client) return false;

    const result = await this.client.query(
      'SELECT 1 FROM land_records WHERE id = $1',
      [record.id]
    );

    return result.rows.length > 0;
  }

  protected validateRecord(record: LandRecord): boolean {
    try {
      // Use validation service for thorough validation
      const validated = validationService.validateLandRecord(record);
      return true;
    } catch (error) {
      logger.warn('Record validation failed', { 
        recordId: record.id, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      return false;
    }
  }

  protected getRecordId(record: LandRecord): string {
    return record.id;
  }

  protected async batchExistsCheck(records: LandRecord[]): Promise<Map<string, boolean>> {
    if (!this.client) return new Map();

    const ids = records.map(r => r.id);
    const result = await this.client.query(
      'SELECT id FROM land_records WHERE id = ANY($1)',
      [ids]
    );

    const existsMap = new Map<string, boolean>();
    ids.forEach(id => existsMap.set(id, false));
    result.rows.forEach(row => existsMap.set(row.id, true));

    return existsMap;
  }

  private async ensureTables(): Promise<void> {
    if (!this.client) return;

    // Create main land records table
    await this.client.query(`
      CREATE TABLE IF NOT EXISTS land_records (
        id VARCHAR(100) PRIMARY KEY,
        parcel_number VARCHAR(100) NOT NULL,
        district VARCHAR(100) NOT NULL,
        chiefdom VARCHAR(100) NOT NULL,
        ward VARCHAR(100),
        address TEXT,
        coordinates POINT,
        boundaries POLYGON,
        
        -- Owner information
        owner_name VARCHAR(255) NOT NULL,
        owner_national_id VARCHAR(255), -- Encrypted
        owner_national_id_hash VARCHAR(64), -- For indexing
        owner_phone VARCHAR(255), -- Encrypted
        owner_phone_hash VARCHAR(64), -- For indexing
        owner_email VARCHAR(255), -- Encrypted
        owner_email_hash VARCHAR(64), -- For indexing,
        
        -- Property details
        land_type VARCHAR(50) NOT NULL,
        area DECIMAL(10, 2) NOT NULL,
        land_use VARCHAR(100),
        
        -- Valuation
        current_value DECIMAL(15, 2),
        last_valuation_date DATE,
        tax_assessment DECIMAL(15, 2),
        
        -- Legal
        title_deed_number VARCHAR(100),
        encumbrances TEXT[],
        
        -- Tax compliance
        tax_status VARCHAR(20),
        last_payment_date DATE,
        arrears_amount DECIMAL(15, 2),
        
        -- Verification
        verification_status VARCHAR(20),
        last_verification_date DATE,
        verification_method VARCHAR(50),
        
        -- Metadata
        source_system VARCHAR(20),
        quality_score INTEGER,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        version INTEGER NOT NULL DEFAULT 1,
        
        -- Indexes
        UNIQUE(parcel_number)
      );
    `);

    // Create indexes
    await this.client.query(`
      CREATE INDEX IF NOT EXISTS idx_land_records_district ON land_records(district);
      CREATE INDEX IF NOT EXISTS idx_land_records_owner_name ON land_records(owner_name);
      CREATE INDEX IF NOT EXISTS idx_land_records_owner_national_id_hash ON land_records(owner_national_id_hash);
      CREATE INDEX IF NOT EXISTS idx_land_records_owner_phone_hash ON land_records(owner_phone_hash);
      CREATE INDEX IF NOT EXISTS idx_land_records_owner_email_hash ON land_records(owner_email_hash);
      CREATE INDEX IF NOT EXISTS idx_land_records_tax_status ON land_records(tax_status);
      CREATE INDEX IF NOT EXISTS idx_land_records_verification_status ON land_records(verification_status);
    `);

    // Create previous owners table
    await this.client.query(`
      CREATE TABLE IF NOT EXISTS land_record_previous_owners (
        id SERIAL PRIMARY KEY,
        land_record_id VARCHAR(100) REFERENCES land_records(id) ON DELETE CASCADE,
        owner_name VARCHAR(255) NOT NULL,
        from_date DATE NOT NULL,
        to_date DATE NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    // Create structures table
    await this.client.query(`
      CREATE TABLE IF NOT EXISTS land_record_structures (
        id SERIAL PRIMARY KEY,
        land_record_id VARCHAR(100) REFERENCES land_records(id) ON DELETE CASCADE,
        structure_type VARCHAR(100) NOT NULL,
        year_built INTEGER,
        condition VARCHAR(50),
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    // Create disputes table
    await this.client.query(`
      CREATE TABLE IF NOT EXISTS land_record_disputes (
        id SERIAL PRIMARY KEY,
        land_record_id VARCHAR(100) REFERENCES land_records(id) ON DELETE CASCADE,
        dispute_type VARCHAR(100) NOT NULL,
        status VARCHAR(50) NOT NULL,
        filed_date DATE NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    // Create audit log table
    await this.client.query(`
      CREATE TABLE IF NOT EXISTS etl_audit_log (
        id SERIAL PRIMARY KEY,
        pipeline_run_id VARCHAR(100),
        record_id VARCHAR(100),
        action VARCHAR(20),
        source_system VARCHAR(20),
        changes JSONB,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
  }

  private async insertRecord(record: LandRecord): Promise<void> {
    if (!this.client) return;

    // Validate and sanitize record
    const validated = validationService.validateLandRecord(record);
    
    // Encrypt PII fields
    const encrypted = encryptionService.encryptPII(validated);
    
    // Generate hashes for indexing
    const nationalIdHash = validated.owner?.nationalId ? 
      encryptionService.hash(validated.owner.nationalId) : null;
    const phoneHash = validated.owner?.phoneNumber ? 
      encryptionService.hash(validated.owner.phoneNumber) : null;
    const emailHash = validated.owner?.email ? 
      encryptionService.hash(validated.owner.email) : null;

    // Insert main record
    await this.client.query(`
      INSERT INTO land_records (
        id, parcel_number, district, chiefdom, ward, address,
        coordinates, boundaries,
        owner_name, owner_national_id, owner_national_id_hash,
        owner_phone, owner_phone_hash, owner_email, owner_email_hash,
        land_type, area, land_use,
        current_value, last_valuation_date, tax_assessment,
        title_deed_number, encumbrances,
        tax_status, last_payment_date, arrears_amount,
        verification_status, last_verification_date, verification_method,
        source_system, quality_score, created_at, updated_at, version
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        ${encrypted.coordinates ? `POINT($7, $8)` : 'NULL'},
        ${encrypted.boundaries?.length ? `POLYGON($9)` : 'NULL'},
        $10, $11, $12, $13, $14, $15, $16,
        $17, $18, $19,
        $20, $21, $22,
        $23, $24,
        $25, $26, $27,
        $28, $29, $30,
        $31, $32, $33, $34, $35
      )
    `, [
      encrypted.id, encrypted.parcelNumber, encrypted.district, encrypted.chiefdom, 
      encrypted.ward, encrypted.address,
      encrypted.coordinates?.latitude, encrypted.coordinates?.longitude,
      this.formatBoundaries(encrypted.boundaries),
      encrypted.owner.name, encrypted.owner.nationalId, nationalIdHash,
      encrypted.owner.phoneNumber, phoneHash, encrypted.owner.email, emailHash,
      encrypted.landType, encrypted.area, encrypted.landUse,
      encrypted.currentValue, encrypted.lastValuationDate, encrypted.taxAssessment,
      encrypted.titleDeedNumber, encrypted.encumbrances,
      encrypted.taxStatus, encrypted.lastPaymentDate, encrypted.arrearsAmount,
      encrypted.verificationStatus, encrypted.lastVerificationDate, encrypted.verificationMethod,
      encrypted.sourceSystem, encrypted.qualityScore, encrypted.createdAt, 
      encrypted.updatedAt, encrypted.version
    ]);

    // Insert related data
    await this.insertRelatedData(record);
  }

  private async updateRecord(record: LandRecord): Promise<void> {
    if (!this.client) return;

    // Validate and sanitize record
    const validated = validationService.validateLandRecord(record);
    
    // Encrypt PII fields
    const encrypted = encryptionService.encryptPII(validated);
    
    // Generate hashes for indexing
    const nationalIdHash = validated.owner?.nationalId ? 
      encryptionService.hash(validated.owner.nationalId) : null;
    const phoneHash = validated.owner?.phoneNumber ? 
      encryptionService.hash(validated.owner.phoneNumber) : null;
    const emailHash = validated.owner?.email ? 
      encryptionService.hash(validated.owner.email) : null;

    // Update main record
    await this.client.query(`
      UPDATE land_records SET
        parcel_number = $2,
        district = $3,
        chiefdom = $4,
        ward = $5,
        address = $6,
        coordinates = ${encrypted.coordinates ? `POINT($7, $8)` : 'NULL'},
        boundaries = ${encrypted.boundaries?.length ? `POLYGON($9)` : 'NULL'},
        owner_name = $10,
        owner_national_id = $11,
        owner_national_id_hash = $12,
        owner_phone = $13,
        owner_phone_hash = $14,
        owner_email = $15,
        owner_email_hash = $16,
        land_type = $17,
        area = $18,
        land_use = $19,
        current_value = $20,
        last_valuation_date = $21,
        tax_assessment = $22,
        title_deed_number = $23,
        encumbrances = $24,
        tax_status = $25,
        last_payment_date = $26,
        arrears_amount = $27,
        verification_status = $28,
        last_verification_date = $29,
        verification_method = $30,
        source_system = $31,
        quality_score = $32,
        updated_at = $33,
        version = version + 1
      WHERE id = $1
    `, [
      encrypted.id, encrypted.parcelNumber, encrypted.district, encrypted.chiefdom, 
      encrypted.ward, encrypted.address,
      encrypted.coordinates?.latitude, encrypted.coordinates?.longitude,
      this.formatBoundaries(encrypted.boundaries),
      encrypted.owner.name, encrypted.owner.nationalId, nationalIdHash,
      encrypted.owner.phoneNumber, phoneHash, encrypted.owner.email, emailHash,
      encrypted.landType, encrypted.area, encrypted.landUse,
      encrypted.currentValue, encrypted.lastValuationDate, encrypted.taxAssessment,
      encrypted.titleDeedNumber, encrypted.encumbrances,
      encrypted.taxStatus, encrypted.lastPaymentDate, encrypted.arrearsAmount,
      encrypted.verificationStatus, encrypted.lastVerificationDate, encrypted.verificationMethod,
      encrypted.sourceSystem, encrypted.qualityScore, encrypted.updatedAt
    ]);

    // Delete and re-insert related data
    await this.client.query('DELETE FROM land_record_previous_owners WHERE land_record_id = $1', [record.id]);
    await this.client.query('DELETE FROM land_record_structures WHERE land_record_id = $1', [record.id]);
    await this.client.query('DELETE FROM land_record_disputes WHERE land_record_id = $1', [record.id]);
    
    await this.insertRelatedData(record);
  }

  private async insertRelatedData(record: LandRecord): Promise<void> {
    if (!this.client) return;

    // Insert previous owners
    if (record.previousOwners?.length) {
      for (const owner of record.previousOwners) {
        await this.client.query(`
          INSERT INTO land_record_previous_owners (land_record_id, owner_name, from_date, to_date)
          VALUES ($1, $2, $3, $4)
        `, [record.id, owner.name, owner.from, owner.to]);
      }
    }

    // Insert structures
    if (record.structures?.length) {
      for (const structure of record.structures) {
        await this.client.query(`
          INSERT INTO land_record_structures (land_record_id, structure_type, year_built, condition)
          VALUES ($1, $2, $3, $4)
        `, [record.id, structure.type, structure.yearBuilt, structure.condition]);
      }
    }

    // Insert disputes
    if (record.disputes?.length) {
      for (const dispute of record.disputes) {
        await this.client.query(`
          INSERT INTO land_record_disputes (land_record_id, dispute_type, status, filed_date)
          VALUES ($1, $2, $3, $4)
        `, [record.id, dispute.type, dispute.status, dispute.filedDate]);
      }
    }
  }

  private formatBoundaries(boundaries?: Array<{ latitude: number; longitude: number }>): string | null {
    if (!boundaries || boundaries.length < 3) {
      return null;
    }

    // Format as PostgreSQL polygon
    const points = boundaries.map(b => `(${b.longitude},${b.latitude})`).join(',');
    return `(${points})`;
  }
}