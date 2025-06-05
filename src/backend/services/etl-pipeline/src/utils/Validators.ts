/**
 * Validation utilities for Sierra Leone data
 */

/**
 * Validate Sierra Leone National ID
 * Format: Usually alphanumeric, varies by issuing authority
 */
export function validateNationalId(id: string): boolean {
  if (!id) return false;
  
  // Remove spaces and special characters
  const cleaned = id.replace(/[^\w]/g, '');
  
  // Sierra Leone IDs are typically 8-15 characters
  if (cleaned.length < 8 || cleaned.length > 15) {
    return false;
  }
  
  // Must contain at least some numbers
  if (!/\d/.test(cleaned)) {
    return false;
  }
  
  return true;
}

/**
 * Validate Sierra Leone phone number
 */
export function validatePhoneNumber(phone: string): boolean {
  if (!phone) return false;
  
  // Remove all non-digits
  const digits = phone.replace(/\D/g, '');
  
  // Check if it's a valid Sierra Leone number
  // Should be 11 or 12 digits (with or without country code)
  if (digits.length === 8) {
    // Local format without country code
    return /^(76|77|78|88|99|30|31|32|33|34)\d{6}$/.test(digits);
  } else if (digits.length === 11) {
    // With country code 232
    return /^232(76|77|78|88|99|30|31|32|33|34)\d{6}$/.test(digits);
  } else if (digits.length === 12) {
    // With + and country code
    return /^\+?232(76|77|78|88|99|30|31|32|33|34)\d{6}$/.test('+' + digits);
  }
  
  return false;
}

/**
 * Validate coordinates for Sierra Leone
 */
export function validateCoordinates(lat: number, lng: number): boolean {
  // Sierra Leone approximate bounds
  const minLat = 6.9;
  const maxLat = 10.0;
  const minLng = -13.5;
  const maxLng = -10.3;
  
  return lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng;
}

/**
 * Validate parcel number format
 * Expected format: DISTRICT/CHIEFDOM/NUMBER/YEAR
 */
export function validateParcelNumber(parcelNumber: string): boolean {
  if (!parcelNumber) return false;
  
  const parts = parcelNumber.split('/');
  
  // Should have 3-4 parts
  if (parts.length < 3 || parts.length > 4) {
    return false;
  }
  
  // Each part should have content
  if (parts.some(part => !part || part.length === 0)) {
    return false;
  }
  
  // If year is present, validate it
  if (parts.length === 4) {
    const year = parseInt(parts[3]);
    const currentYear = new Date().getFullYear();
    if (isNaN(year) || year < 1900 || year > currentYear) {
      return false;
    }
  }
  
  return true;
}

/**
 * Validate land area (in square meters)
 */
export function validateArea(area: number): boolean {
  // Minimum 1 sq meter, maximum 10 sq km
  return area > 0 && area <= 10000000;
}

/**
 * Validate district name
 */
export function validateDistrict(district: string): boolean {
  const validDistricts = new Set([
    'BO',
    'BOMBALI',
    'BONTHE',
    'KAILAHUN',
    'KAMBIA',
    'KENEMA',
    'KOINADUGU',
    'KONO',
    'MOYAMBA',
    'PORT LOKO',
    'PUJEHUN',
    'TONKOLILI',
    'WESTERN AREA RURAL',
    'WESTERN AREA URBAN',
    'FALABA',
    'KARENE'
  ]);
  
  return validDistricts.has(district.toUpperCase());
}

/**
 * Validate tax identification number (TIN)
 */
export function validateTIN(tin: string): boolean {
  if (!tin) return false;
  
  // Remove spaces and hyphens
  const cleaned = tin.replace(/[\s-]/g, '');
  
  // TIN should be 9-12 digits
  if (!/^\d{9,12}$/.test(cleaned)) {
    return false;
  }
  
  return true;
}

/**
 * Validate date is not in future
 */
export function validatePastDate(date: Date): boolean {
  return date <= new Date();
}

/**
 * Validate date is within reasonable range
 */
export function validateDateRange(date: Date, yearsBack: number = 100): boolean {
  const minDate = new Date();
  minDate.setFullYear(minDate.getFullYear() - yearsBack);
  
  return date >= minDate && date <= new Date();
}