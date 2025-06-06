/**
 * Input validation and sanitization utilities
 */

import validator from 'validator';
import DOMPurify from 'isomorphic-dompurify';
import { logger } from './logger';

export class ValidationService {
  /**
   * Sanitize string input
   */
  sanitizeString(input: string): string {
    if (!input || typeof input !== 'string') {
      return '';
    }

    // Remove HTML tags and scripts
    let sanitized = DOMPurify.sanitize(input, { ALLOWED_TAGS: [] });
    
    // Trim whitespace
    sanitized = sanitized.trim();
    
    // Remove null bytes
    sanitized = sanitized.replace(/\0/g, '');
    
    return sanitized;
  }

  /**
   * Validate and sanitize email
   */
  validateEmail(email: string): string | null {
    const sanitized = this.sanitizeString(email);
    
    if (!sanitized || !validator.isEmail(sanitized)) {
      return null;
    }
    
    return validator.normalizeEmail(sanitized) || null;
  }

  /**
   * Validate and sanitize phone number
   */
  validatePhoneNumber(phone: string, countryCode: string = 'SL'): string | null {
    const sanitized = this.sanitizeString(phone);
    
    if (!sanitized) {
      return null;
    }

    // Remove all non-digit characters except + at the beginning
    let cleaned = sanitized.replace(/[^\d+]/g, '');
    
    // Handle Sierra Leone specific formats
    if (countryCode === 'SL') {
      // Remove country code if present
      cleaned = cleaned.replace(/^(\+?232)/, '');
      
      // Validate length (should be 8 digits after country code)
      if (cleaned.length !== 8) {
        return null;
      }
      
      // Validate prefix (76, 77, 78, 79, 30, 31, 32, 33, 34, etc.)
      const validPrefixes = ['76', '77', '78', '79', '30', '31', '32', '33', '34', '88'];
      const prefix = cleaned.substring(0, 2);
      
      if (!validPrefixes.includes(prefix)) {
        return null;
      }
      
      // Return in international format
      return `+232${cleaned}`;
    }
    
    return cleaned;
  }

  /**
   * Validate national ID
   */
  validateNationalId(id: string): string | null {
    const sanitized = this.sanitizeString(id);
    
    if (!sanitized) {
      return null;
    }

    // Sierra Leone National ID format validation
    // Format: XXXX-XXXX-XXXX-XXXX (16 alphanumeric characters)
    const cleaned = sanitized.replace(/[^A-Z0-9]/gi, '').toUpperCase();
    
    if (cleaned.length !== 16) {
      return null;
    }
    
    // Format with dashes
    return `${cleaned.slice(0, 4)}-${cleaned.slice(4, 8)}-${cleaned.slice(8, 12)}-${cleaned.slice(12, 16)}`;
  }

  /**
   * Validate parcel number
   */
  validateParcelNumber(parcelNumber: string): string | null {
    const sanitized = this.sanitizeString(parcelNumber);
    
    if (!sanitized) {
      return null;
    }

    // Parcel number format: DISTRICT-CHIEFDOM-WARD-XXXX
    // Example: WA-KAI-01-0001
    const pattern = /^[A-Z]{2,4}-[A-Z]{2,10}-\d{2}-\d{4}$/i;
    
    const upperCased = sanitized.toUpperCase();
    
    if (!pattern.test(upperCased)) {
      return null;
    }
    
    return upperCased;
  }

  /**
   * Validate coordinates
   */
  validateCoordinates(lat: number, lng: number): boolean {
    // Sierra Leone bounds approximately
    const bounds = {
      latMin: 6.9,
      latMax: 10.0,
      lngMin: -13.5,
      lngMax: -10.3
    };
    
    return lat >= bounds.latMin && 
           lat <= bounds.latMax && 
           lng >= bounds.lngMin && 
           lng <= bounds.lngMax;
  }

  /**
   * Validate district name
   */
  validateDistrict(district: string): string | null {
    const sanitized = this.sanitizeString(district);
    
    if (!sanitized) {
      return null;
    }

    // List of valid districts in Sierra Leone
    const validDistricts = [
      'BO', 'BOMBALI', 'BONTHE', 'KAILAHUN', 'KAMBIA',
      'KENEMA', 'KOINADUGU', 'KONO', 'MOYAMBA', 'PORT LOKO',
      'PUJEHUN', 'TONKOLILI', 'WESTERN AREA RURAL', 'WESTERN AREA URBAN',
      'KARENE', 'FALABA'
    ];
    
    const upperCased = sanitized.toUpperCase();
    
    if (!validDistricts.includes(upperCased)) {
      logger.warn('Invalid district name', { district: sanitized });
      return null;
    }
    
    return upperCased;
  }

  /**
   * Validate land type
   */
  validateLandType(type: string): string | null {
    const sanitized = this.sanitizeString(type);
    
    if (!sanitized) {
      return null;
    }

    const validTypes = [
      'RESIDENTIAL', 'COMMERCIAL', 'AGRICULTURAL', 
      'INDUSTRIAL', 'MIXED_USE', 'PUBLIC', 'VACANT'
    ];
    
    const upperCased = sanitized.toUpperCase();
    
    if (!validTypes.includes(upperCased)) {
      return null;
    }
    
    return upperCased;
  }

  /**
   * Validate area (in square meters)
   */
  validateArea(area: number): number | null {
    if (typeof area !== 'number' || isNaN(area)) {
      return null;
    }
    
    // Reasonable bounds for land area (0.1 sqm to 1,000,000 sqm)
    if (area < 0.1 || area > 1000000) {
      return null;
    }
    
    // Round to 2 decimal places
    return Math.round(area * 100) / 100;
  }

  /**
   * Validate currency amount
   */
  validateAmount(amount: number): number | null {
    if (typeof amount !== 'number' || isNaN(amount)) {
      return null;
    }
    
    // Must be non-negative
    if (amount < 0) {
      return null;
    }
    
    // Round to 2 decimal places
    return Math.round(amount * 100) / 100;
  }

  /**
   * Validate and sanitize land record
   */
  validateLandRecord(record: any): any {
    const validated: any = {};
    
    // Required fields
    validated.id = this.sanitizeString(record.id);
    validated.parcelNumber = this.validateParcelNumber(record.parcelNumber);
    validated.district = this.validateDistrict(record.district);
    validated.chiefdom = this.sanitizeString(record.chiefdom);
    
    if (!validated.id || !validated.parcelNumber || !validated.district || !validated.chiefdom) {
      throw new Error('Missing required fields');
    }
    
    // Optional fields
    validated.ward = this.sanitizeString(record.ward);
    validated.address = this.sanitizeString(record.address);
    
    // Owner information
    if (record.owner) {
      validated.owner = {
        name: this.sanitizeString(record.owner.name),
        nationalId: this.validateNationalId(record.owner.nationalId),
        phoneNumber: this.validatePhoneNumber(record.owner.phoneNumber),
        email: this.validateEmail(record.owner.email)
      };
      
      if (!validated.owner.name) {
        throw new Error('Owner name is required');
      }
    }
    
    // Property details
    validated.landType = this.validateLandType(record.landType) || 'VACANT';
    validated.area = this.validateArea(record.area);
    validated.landUse = this.sanitizeString(record.landUse);
    
    if (!validated.area) {
      throw new Error('Valid area is required');
    }
    
    // Coordinates
    if (record.coordinates) {
      if (this.validateCoordinates(record.coordinates.latitude, record.coordinates.longitude)) {
        validated.coordinates = {
          latitude: record.coordinates.latitude,
          longitude: record.coordinates.longitude
        };
      }
    }
    
    // Financial fields
    if (record.currentValue !== undefined) {
      validated.currentValue = this.validateAmount(record.currentValue);
    }
    
    if (record.taxAssessment !== undefined) {
      validated.taxAssessment = this.validateAmount(record.taxAssessment);
    }
    
    if (record.arrearsAmount !== undefined) {
      validated.arrearsAmount = this.validateAmount(record.arrearsAmount);
    }
    
    // Other fields
    validated.titleDeedNumber = this.sanitizeString(record.titleDeedNumber);
    validated.taxStatus = this.sanitizeString(record.taxStatus);
    validated.verificationStatus = this.sanitizeString(record.verificationStatus);
    validated.verificationMethod = this.sanitizeString(record.verificationMethod);
    validated.sourceSystem = this.sanitizeString(record.sourceSystem);
    
    // Dates
    validated.lastValuationDate = record.lastValuationDate;
    validated.lastPaymentDate = record.lastPaymentDate;
    validated.lastVerificationDate = record.lastVerificationDate;
    validated.createdAt = record.createdAt || new Date();
    validated.updatedAt = record.updatedAt || new Date();
    
    // Arrays
    validated.encumbrances = Array.isArray(record.encumbrances) ? 
      record.encumbrances.map(e => this.sanitizeString(e)).filter(Boolean) : [];
    
    validated.boundaries = Array.isArray(record.boundaries) ?
      record.boundaries.filter(b => 
        b && this.validateCoordinates(b.latitude, b.longitude)
      ) : [];
    
    // Metadata
    validated.qualityScore = typeof record.qualityScore === 'number' ? 
      Math.max(0, Math.min(100, record.qualityScore)) : 50;
    
    validated.version = typeof record.version === 'number' ? 
      record.version : 1;
    
    return validated;
  }
}

// Export singleton instance
export const validationService = new ValidationService();