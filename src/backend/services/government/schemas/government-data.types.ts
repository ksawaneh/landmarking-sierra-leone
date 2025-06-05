/**
 * Government Data Type Definitions
 * These interfaces represent the structure of data from various Sierra Leone government systems
 * 
 * Note: Sierra Leone expanded from 14 to 16 districts in July 2017
 * Always verify current administrative divisions before using
 */

/**
 * Ministry of Lands, Housing and Country Planning (MLHCP) data structure
 */
export interface MLHCPLandRecord {
  // Unique identifiers
  landId: string;                    // e.g., "WA/FT/001234/2020"
  registryNumber: string;            // Physical book reference
  pageNumber: string;                // Page in registry book
  
  // Ownership information
  ownerName: string;                 // May have spelling variations
  ownerNationalId?: string;          // Often missing in old records
  ownerAddress: string;              // Often incomplete
  ownerPhone?: string;               // Rarely available
  
  // Land details
  landType: 'residential' | 'commercial' | 'agricultural' | 'industrial' | 'mixed';
  landUse?: string;                  // Current use description
  size: {
    value: number;
    unit: 'acres' | 'hectares' | 'square_feet' | 'town_lots';
  };
  
  // Location data (often problematic)
  district: string;                  // One of 16 current districts
  chiefdom?: string;                 // One of 190 chiefdoms (as of 2017)
  section?: string;                  // Sub-division
  address?: string;                  // Street address if available
  
  // Boundaries (various formats)
  boundaries?: {
    north?: string;                  // e.g., "Property of Mohamed Kamara"
    south?: string;
    east?: string;
    west?: string;
    coordinates?: string;            // Rarely available, various formats
  };
  
  // Registration details
  registrationDate: string;          // Various date formats
  registrationOfficer?: string;
  registrationFee?: number;
  
  // Legal status
  encumbrances?: string[];           // Mortgages, liens, etc.
  disputes?: string[];               // Ongoing disputes
  previousOwners?: string[];         // Chain of title
  
  // Data quality flags
  dataQuality?: {
    isDigitized: boolean;
    hasPhysicalFile: boolean;
    lastVerified?: string;
    issues?: string[];               // Known data issues
  };
}

/**
 * National Revenue Authority (NRA) tax records
 */
export interface NRAPropertyRecord {
  taxId: string;                     // NRA tax identification
  propertyRef?: string;              // May link to MLHCP landId
  
  // Owner details (may differ from MLHCP)
  taxpayerName: string;
  taxpayerTin?: string;              // Taxpayer Identification Number
  taxpayerAddress: string;
  
  // Property details
  propertyAddress: string;
  propertyType: string;
  assessedValue?: number;            // In Leones
  lastAssessmentDate?: string;
  
  // Tax information
  annualTax: number;
  lastPaymentDate?: string;
  lastPaymentAmount?: number;
  arrears?: number;
  
  // Compliance
  isCompliant: boolean;
  complianceNotes?: string[];
}

/**
 * Office of Administrator and Registrar General (OARG) deed records
 */
export interface OARGDeedRecord {
  deedNumber: string;                // Unique deed reference
  volumeNumber: string;              // Deed book volume
  folioNumber: string;               // Page reference
  
  // Transaction details
  transactionType: 'sale' | 'gift' | 'inheritance' | 'lease' | 'mortgage';
  transactionDate: string;
  considerationAmount?: number;       // Purchase price
  
  // Parties
  grantor: {                         // Seller/giver
    name: string;
    address?: string;
    identification?: string;
  };
  grantee: {                         // Buyer/receiver
    name: string;
    address?: string;
    identification?: string;
  };
  
  // Property reference
  propertyDescription: string;        // Free text description
  mlhcpReference?: string;           // Link to MLHCP if available
  
  // Legal details
  witnesses?: Array<{
    name: string;
    address?: string;
  }>;
  lawyer?: {
    name: string;
    license?: string;
  };
  
  // Registration
  registrationDate: string;
  registrationOfficer: string;
  stampDuty?: number;
}

/**
 * Common data quality issues in government records
 */
export interface DataQualityIssues {
  // Name variations
  nameVariations: string[];          // Same person, different spellings
  
  // Location issues
  addressIncomplete: boolean;
  coordinatesInvalid: boolean;
  boundariesVague: boolean;
  
  // Data gaps
  missingFields: string[];
  
  // Inconsistencies
  sizeDiscrepancy?: boolean;         // Different sizes in different systems
  ownershipConflict?: boolean;       // Different owners in different systems
  dateInconsistency?: boolean;       // Conflicting dates
  
  // Duplicates
  possibleDuplicateIds?: string[];
}

/**
 * Unified land record after reconciliation
 */
export interface UnifiedLandRecord {
  // System ID
  unifiedId: string;                 // Our system's unique ID
  
  // Source references
  sources: {
    mlhcp?: MLHCPLandRecord;
    nra?: NRAPropertyRecord;
    oarg?: OARGDeedRecord;
  };
  
  // Reconciled data
  ownership: {
    currentOwner: {
      name: string;
      nationalId?: string;
      confidence: number;            // 0-1 confidence score
    };
    verificationRequired: boolean;
  };
  
  // Location (best available data)
  location: {
    district: string;
    chiefdom?: string;
    coordinates?: {
      type: 'Point' | 'Polygon';
      coordinates: number[] | number[][];
      accuracy: 'high' | 'medium' | 'low';
    };
  };
  
  // Status
  status: {
    isDisputed: boolean;
    requiresFieldVerification: boolean;
    dataQuality: 'high' | 'medium' | 'low';
    lastUpdated: Date;
  };
  
  // Reconciliation metadata
  reconciliation: {
    conflicts: DataQualityIssues;
    mergeStrategy: string;
    confidence: number;
    timestamp: Date;
  };
}

/**
 * Current administrative divisions of Sierra Leone (as of 2017)
 * 16 Districts across 5 Provinces/Areas
 */
export const SierraLeoneDistricts = {
  // Eastern Province
  'Kailahun': { code: 'KL', province: 'Eastern', capital: 'Kailahun' },
  'Kenema': { code: 'KN', province: 'Eastern', capital: 'Kenema' },
  'Kono': { code: 'KO', province: 'Eastern', capital: 'Koidu' },
  
  // Northern Province
  'Bombali': { code: 'BM', province: 'Northern', capital: 'Makeni' },
  'Falaba': { code: 'FL', province: 'Northern', capital: 'Falaba' },
  'Koinadugu': { code: 'KD', province: 'Northern', capital: 'Kabala' },
  'Tonkolili': { code: 'TN', province: 'Northern', capital: 'Magburaka' },
  
  // North West Province
  'Kambia': { code: 'KM', province: 'North West', capital: 'Kambia' },
  'Karene': { code: 'KR', province: 'North West', capital: 'Kamakwie' },
  'Port Loko': { code: 'PT', province: 'North West', capital: 'Port Loko' },
  
  // Southern Province
  'Bo': { code: 'BO', province: 'Southern', capital: 'Bo' },
  'Bonthe': { code: 'BN', province: 'Southern', capital: 'Bonthe' },
  'Moyamba': { code: 'MO', province: 'Southern', capital: 'Moyamba' },
  'Pujehun': { code: 'PU', province: 'Southern', capital: 'Pujehun' },
  
  // Western Area
  'Western Area Rural': { code: 'WR', province: 'Western Area', capital: 'Waterloo' },
  'Western Area Urban': { code: 'WU', province: 'Western Area', capital: 'Freetown' }
} as const;

export type DistrictName = keyof typeof SierraLeoneDistricts;

/**
 * Common Sierra Leone specific patterns
 */
export const SierraLeonePatterns = {
  // All 16 current districts
  districts: Object.keys(SierraLeoneDistricts) as DistrictName[],
  
  // Common name prefixes
  namePrefixes: ['Mohamed', 'Fatmata', 'Ibrahim', 'Aminata', 'Abu', 'Isata', 'Alhaji', 'Hajia', 'Alpha', 'Mariama'],
  
  // Common surnames
  surnames: ['Kamara', 'Sesay', 'Koroma', 'Bangura', 'Conteh', 'Jalloh', 'Kanu', 'Mansaray', 'Fofanah', 'Turay', 'Bah', 'Tarawally'],
  
  // Land size patterns
  typicalSizes: {
    residential: { min: 0.05, max: 2, unit: 'acres' as const },
    commercial: { min: 0.1, max: 5, unit: 'acres' as const },
    agricultural: { min: 1, max: 100, unit: 'acres' as const }
  },
  
  // Common place name components
  placeNameComponents: {
    prefixes: ['New', 'Old', 'Upper', 'Lower', 'Big', 'Small'],
    suffixes: ['Town', 'Village', 'Junction', 'Street', 'Road', 'Hill', 'Wharf']
  }
};