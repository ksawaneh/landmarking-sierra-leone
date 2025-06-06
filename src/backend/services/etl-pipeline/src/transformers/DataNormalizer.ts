/**
 * Data normalizer transformer - standardizes formats and cleans data
 */

import { BaseTransformer } from './BaseTransformer';
import { LandRecord, QualityIssue } from '../types';
import { normalizeNames } from '../utils/NameNormalizer';
import { standardizeAddress } from '../utils/AddressStandardizer';
import { validateNationalId } from '../utils/Validators';

export class DataNormalizer extends BaseTransformer<LandRecord, LandRecord> {
  constructor() {
    super('DataNormalizer');
  }

  protected transformRecord(record: LandRecord): LandRecord {
    return {
      ...record,
      
      // Normalize parcel number
      parcelNumber: this.normalizeParcelNumber(record.parcelNumber),
      
      // Standardize location data
      district: this.normalizeDistrict(record.district),
      chiefdom: this.normalizeChiefdom(record.chiefdom),
      address: standardizeAddress(record.address),
      
      // Normalize owner information
      owner: {
        ...record.owner,
        name: normalizeNames(record.owner.name),
        nationalId: record.owner.nationalId ? 
          this.normalizeNationalId(record.owner.nationalId) : undefined,
        phoneNumber: record.owner.phoneNumber ? 
          this.normalizePhoneNumber(record.owner.phoneNumber) : undefined
      },
      
      // Normalize previous owners
      previousOwners: record.previousOwners?.map(owner => ({
        ...owner,
        name: normalizeNames(owner.name)
      })),
      
      // Standardize land type
      landType: this.normalizeLandType(record.landType),
      
      // Ensure numeric fields are valid
      area: this.normalizeNumeric(record.area),
      currentValue: record.currentValue ? 
        this.normalizeNumeric(record.currentValue) : undefined,
      taxAssessment: record.taxAssessment ? 
        this.normalizeNumeric(record.taxAssessment) : undefined,
      arrearsAmount: record.arrearsAmount ? 
        this.normalizeNumeric(record.arrearsAmount) : undefined,
      
      // Update metadata
      updatedAt: new Date()
    };
  }

  protected checkQuality(record: LandRecord): QualityIssue[] {
    const issues: QualityIssue[] = [];

    // Check completeness
    if (!record.owner.nationalId) {
      issues.push({
        field: 'owner.nationalId',
        issue: 'Missing national ID',
        severity: 'high',
        count: 1,
        examples: []
      });
    }

    if (!record.owner.phoneNumber) {
      issues.push({
        field: 'owner.phoneNumber',
        issue: 'Missing phone number',
        severity: 'medium',
        count: 1,
        examples: []
      });
    }

    if (!record.coordinates && (!record.boundaries || record.boundaries.length === 0)) {
      issues.push({
        field: 'location',
        issue: 'No geographic coordinates',
        severity: 'high',
        count: 1,
        examples: []
      });
    }

    if (!record.titleDeedNumber) {
      issues.push({
        field: 'titleDeedNumber',
        issue: 'Missing title deed number',
        severity: 'medium',
        count: 1,
        examples: []
      });
    }

    // Check data validity
    if (record.area <= 0) {
      issues.push({
        field: 'area',
        issue: 'Invalid area value',
        severity: 'critical',
        count: 1,
        examples: []
      });
    }

    if (record.owner.nationalId && !validateNationalId(record.owner.nationalId)) {
      issues.push({
        field: 'owner.nationalId',
        issue: 'Invalid national ID format',
        severity: 'high',
        count: 1,
        examples: []
      });
    }

    // Check verification status
    if (record.verificationStatus === 'pending') {
      issues.push({
        field: 'verificationStatus',
        issue: 'Pending verification',
        severity: 'low',
        count: 1,
        examples: []
      });
    }

    if (record.lastVerificationDate) {
      const daysSinceVerification = 
        (Date.now() - record.lastVerificationDate.getTime()) / (1000 * 60 * 60 * 24);
      
      if (daysSinceVerification > 1825) { // 5 years
        issues.push({
          field: 'lastVerificationDate',
          issue: 'Verification older than 5 years',
          severity: 'medium',
          count: 1,
          examples: []
        });
      }
    }

    return issues;
  }

  protected getFieldCount(): number {
    return 15; // Number of fields we check for quality
  }

  private normalizeParcelNumber(parcelNumber: string): string {
    // Standardize format: DISTRICT/CHIEFDOM/NUMBER/YEAR
    return parcelNumber
      .toUpperCase()
      .replace(/\s+/g, '')
      .replace(/[^\w\/\-]/g, '');
  }

  private normalizeDistrict(district: string): string {
    // Map common variations to standard names
    const districtMap: Record<string, string> = {
      'WESTERN AREA': 'Western Area Urban',
      'WESTERN URBAN': 'Western Area Urban',
      'WESTERN RURAL': 'Western Area Rural',
      'WESTERN AREA RURAL': 'Western Area Rural',
      'PORT LOKO': 'Port Loko',
      'PORTLOKO': 'Port Loko',
      // Add more mappings as needed
    };

    const normalized = district.trim().toUpperCase();
    return districtMap[normalized] || district.trim();
  }

  private normalizeChiefdom(chiefdom: string): string {
    // Capitalize properly
    return chiefdom
      .trim()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  private normalizeNationalId(id: string): string {
    // Remove spaces and special characters
    return id.replace(/[^\w]/g, '').toUpperCase();
  }

  private normalizePhoneNumber(phone: string): string {
    // Ensure Sierra Leone format
    let cleaned = phone.replace(/\D/g, '');
    
    // Add country code if missing
    if (!cleaned.startsWith('232')) {
      cleaned = '232' + cleaned;
    }
    
    return '+' + cleaned;
  }

  private normalizeLandType(type: string): LandRecord['landType'] {
    const typeMap: Record<string, LandRecord['landType']> = {
      'RESIDENTIAL': 'residential',
      'COMMERCIAL': 'commercial',
      'AGRICULTURAL': 'agricultural',
      'INDUSTRIAL': 'industrial',
      'MIXED': 'mixed',
      'FARMING': 'agricultural',
      'BUSINESS': 'commercial',
      'HOME': 'residential',
      'FACTORY': 'industrial'
    };

    const normalized = type.toUpperCase();
    return typeMap[normalized] || 'mixed';
  }

  private normalizeNumeric(value: number): number {
    // Ensure valid positive number
    if (isNaN(value) || value < 0) {
      return 0;
    }
    
    // Round to 2 decimal places for currency values
    return Math.round(value * 100) / 100;
  }
}