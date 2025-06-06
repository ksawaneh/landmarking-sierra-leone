/**
 * Address standardization for Sierra Leone addresses
 */

// Common address abbreviations and their expansions
const abbreviations: Record<string, string> = {
  'ST': 'STREET',
  'RD': 'ROAD',
  'AVE': 'AVENUE',
  'DR': 'DRIVE',
  'LN': 'LANE',
  'CT': 'COURT',
  'PL': 'PLACE',
  'HWY': 'HIGHWAY',
  'BLVD': 'BOULEVARD',
  'N': 'NORTH',
  'S': 'SOUTH',
  'E': 'EAST',
  'W': 'WEST',
  'APT': 'APARTMENT',
  'STE': 'SUITE',
  'FLR': 'FLOOR',
  'BLDG': 'BUILDING'
};

// Common Sierra Leone landmarks and areas
const knownAreas: Set<string> = new Set([
  'FREETOWN',
  'HILL STATION',
  'LUMLEY',
  'ABERDEEN',
  'WILBERFORCE',
  'BROOKFIELDS',
  'NEW ENGLAND',
  'KISSY',
  'WELLINGTON',
  'WATERLOO',
  'CONGO TOWN',
  'JUBA',
  'MURRAY TOWN',
  'FOURAH BAY',
  'TOWER HILL',
  'MAKENI',
  'KENEMA',
  'KOIDU',
  'PORT LOKO',
  'KABALA',
  'KAMBIA',
  'KAILAHUN',
  'PUJEHUN',
  'BONTHE',
  'MOYAMBA',
  'LUNSAR',
  'MAGBURAKA'
]);

/**
 * Standardize an address
 */
export function standardizeAddress(address: string): string {
  if (!address) return '';

  let standardized = address.trim().toUpperCase();

  // Replace multiple spaces with single space
  standardized = standardized.replace(/\s+/g, ' ');

  // Expand abbreviations
  for (const [abbr, full] of Object.entries(abbreviations)) {
    const regex = new RegExp(`\\b${abbr}\\b\\.?`, 'g');
    standardized = standardized.replace(regex, full);
  }

  // Remove unnecessary punctuation
  standardized = standardized.replace(/[,;]/g, ' ');
  standardized = standardized.replace(/\s+/g, ' ');

  // Ensure known areas are properly capitalized
  const words = standardized.split(' ');
  const finalWords = words.map(word => {
    if (knownAreas.has(word)) {
      // Proper case for known areas
      return word.charAt(0) + word.slice(1).toLowerCase();
    }
    // Check if it's a number or special case
    if (/^\d+$/.test(word) || word.length <= 2) {
      return word;
    }
    // Otherwise proper case
    return word.charAt(0) + word.slice(1).toLowerCase();
  });

  return finalWords.join(' ').trim();
}

/**
 * Extract components from address
 */
export interface AddressComponents {
  streetNumber?: string;
  streetName?: string;
  area?: string;
  city?: string;
  district?: string;
}

export function parseAddress(address: string): AddressComponents {
  const standardized = standardizeAddress(address);
  const parts = standardized.split(' ');
  const components: AddressComponents = {};

  // Extract street number if present
  if (parts.length > 0 && /^\d+[A-Z]?$/.test(parts[0])) {
    components.streetNumber = parts[0];
    parts.shift();
  }

  // Look for known areas
  for (const area of knownAreas) {
    if (standardized.includes(area)) {
      components.area = area.charAt(0) + area.slice(1).toLowerCase();
      break;
    }
  }

  // Remaining parts form the street name
  if (parts.length > 0) {
    components.streetName = parts.join(' ');
  }

  return components;
}

/**
 * Format address components into standard format
 */
export function formatAddress(components: AddressComponents): string {
  const parts: string[] = [];

  if (components.streetNumber) {
    parts.push(components.streetNumber);
  }

  if (components.streetName) {
    parts.push(components.streetName);
  }

  if (components.area) {
    parts.push(components.area);
  }

  if (components.city && components.city !== components.area) {
    parts.push(components.city);
  }

  if (components.district) {
    parts.push(components.district);
  }

  return parts.join(', ');
}