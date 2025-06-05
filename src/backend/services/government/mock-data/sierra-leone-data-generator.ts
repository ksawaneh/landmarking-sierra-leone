/**
 * Sierra Leone Mock Data Generator
 * Generates realistic test data based on actual Sierra Leone patterns
 * 
 * This generator creates data that mimics real government records including:
 * - Common data quality issues
 * - Realistic naming patterns
 * - Actual district/chiefdom structures
 * - Typical land sizes and types
 */

import {
  MLHCPLandRecord,
  NRAPropertyRecord,
  OARGDeedRecord,
  DistrictName,
  SierraLeoneDistricts,
  SierraLeonePatterns
} from '../schemas/government-data.types';

/**
 * Generates a random element from an array
 */
function randomElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * Generates a random number between min and max
 */
function randomBetween(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

/**
 * Generates a random date between two dates
 */
function randomDate(start: Date, end: Date): Date {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

/**
 * Formats date with common variations found in government records
 */
function formatDateWithVariation(date: Date): string {
  const formats = [
    () => date.toISOString().split('T')[0], // 2024-01-15
    () => `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`, // 15/1/2024
    () => `${date.getDate()}-${date.getMonth() + 1}-${date.getFullYear()}`, // 15-1-2024
    () => date.toLocaleDateString('en-GB'), // 15/01/2024
    () => date.toLocaleDateString('en-US'), // 1/15/2024
  ];
  return randomElement(formats)();
}

/**
 * Generates realistic Sierra Leonean names with common variations
 */
export function generateSierraLeoneName(): {
  fullName: string;
  variations: string[];
} {
  const prefix = Math.random() > 0.7 ? randomElement(SierraLeonePatterns.namePrefixes) : '';
  const firstName = randomElement(SierraLeonePatterns.namePrefixes);
  const surname = randomElement(SierraLeonePatterns.surnames);
  
  const fullName = [prefix, firstName, surname].filter(Boolean).join(' ');
  
  // Generate common variations (misspellings, different orders)
  const variations = [
    fullName,
    `${firstName} ${surname}`, // Without prefix
    `${surname} ${firstName}`, // Reversed
    fullName.toLowerCase(),
    fullName.toUpperCase(),
  ];
  
  // Add spelling variations
  if (firstName === 'Mohamed') {
    variations.push(`${prefix} Mohammed ${surname}`.trim());
    variations.push(`${prefix} Muhammed ${surname}`.trim());
  }
  if (firstName === 'Fatmata') {
    variations.push(`${prefix} Fatima ${surname}`.trim());
    variations.push(`${prefix} Fatu ${surname}`.trim());
  }
  
  return { fullName, variations: [...new Set(variations)] };
}

/**
 * Generates a realistic address for a district
 */
export function generateAddress(district: DistrictName): string {
  const streetNumber = Math.floor(Math.random() * 200) + 1;
  const streetNames = [
    'Wilkinson Road', 'Sackville Street', 'Circular Road', 'Main Motor Road',
    'Lumley Beach Road', 'Hill Station', 'Jui Road', 'Waterloo Highway',
    'Bo-Kenema Highway', 'Makeni-Kabala Road'
  ];
  
  const formats = [
    () => `${streetNumber} ${randomElement(streetNames)}, ${district}`,
    () => `${randomElement(streetNames)}, ${district}`,
    () => `Near ${randomElement(['Police Station', 'Market', 'Mosque', 'Church', 'School'])}, ${district}`,
    () => district, // Just district name (common in records)
  ];
  
  return randomElement(formats)();
}

/**
 * Generates boundary descriptions as found in old records
 */
export function generateBoundaryDescriptions(district: DistrictName): {
  north?: string;
  south?: string;
  east?: string;
  west?: string;
} {
  const boundaryTypes = [
    () => `Property of ${generateSierraLeoneName().fullName}`,
    () => `${randomElement(['Main', 'Feeder', 'Foot'])} Road`,
    () => `${randomElement(['Stream', 'River', 'Creek'])}`,
    () => `${randomElement(['Mango', 'Orange', 'Palm', 'Cotton']} Tree`,
    () => `${randomElement(['Government', 'Community', 'School', 'Church'])} Land`,
  ];
  
  // Sometimes boundaries are missing (common in old records)
  const boundaries: any = {};
  const directions = ['north', 'south', 'east', 'west'];
  
  directions.forEach(dir => {
    if (Math.random() > 0.2) { // 80% chance of having boundary
      boundaries[dir] = randomElement(boundaryTypes)();
    }
  });
  
  return boundaries;
}

/**
 * Generates a realistic MLHCP land record with common data issues
 */
export function generateMLHCPRecord(options?: {
  hasDataIssues?: boolean;
  isDisputed?: boolean;
  district?: DistrictName;
}): MLHCPLandRecord {
  const hasDataIssues = options?.hasDataIssues ?? Math.random() > 0.6; // 40% have issues
  const district = options?.district ?? randomElement(SierraLeonePatterns.districts);
  const districtInfo = SierraLeoneDistricts[district];
  
  const owner = generateSierraLeoneName();
  const landType = randomElement(['residential', 'commercial', 'agricultural', 'industrial', 'mixed'] as const);
  const sizeConfig = SierraLeonePatterns.typicalSizes[landType] || SierraLeonePatterns.typicalSizes.residential;
  
  const registrationDate = randomDate(new Date('1990-01-01'), new Date());
  
  const record: MLHCPLandRecord = {
    landId: `${districtInfo.code}/${randomElement(['FH', 'LS', 'CP'])}/${Math.floor(Math.random() * 9999).toString().padStart(6, '0')}/${registrationDate.getFullYear()}`,
    registryNumber: `VOL${Math.floor(Math.random() * 500)}-${Math.floor(Math.random() * 1000)}`,
    pageNumber: Math.floor(Math.random() * 300).toString(),
    
    ownerName: hasDataIssues && Math.random() > 0.5 ? randomElement(owner.variations) : owner.fullName,
    ownerAddress: generateAddress(district),
    
    landType,
    size: {
      value: Number(randomBetween(sizeConfig.min, sizeConfig.max).toFixed(2)),
      unit: sizeConfig.unit
    },
    
    district,
    address: Math.random() > 0.5 ? generateAddress(district) : undefined,
    
    boundaries: generateBoundaryDescriptions(district),
    
    registrationDate: formatDateWithVariation(registrationDate),
  };
  
  // Add optional fields
  if (Math.random() > 0.7) {
    record.ownerNationalId = `SL${Math.floor(Math.random() * 999999999)}`;
  }
  
  if (Math.random() > 0.8) {
    record.ownerPhone = `+232${Math.floor(Math.random() * 100000000).toString().padStart(8, '0')}`;
  }
  
  if (Math.random() > 0.6) {
    record.chiefdom = `${randomElement(['Kakua', 'Tikonko', 'Bagbo', 'Lugbu', 'Bumpe'])} Chiefdom`;
  }
  
  if (options?.isDisputed) {
    record.disputes = [`Ownership dispute with ${generateSierraLeoneName().fullName}`];
  }
  
  if (Math.random() > 0.7) {
    record.encumbrances = ['Mortgage - Sierra Leone Commercial Bank'];
  }
  
  // Add data quality flags
  record.dataQuality = {
    isDigitized: Math.random() > 0.3,
    hasPhysicalFile: Math.random() > 0.1,
    lastVerified: Math.random() > 0.5 ? formatDateWithVariation(randomDate(new Date('2020-01-01'), new Date())) : undefined,
    issues: hasDataIssues ? ['Incomplete boundaries', 'Name variations detected'] : []
  };
  
  return record;
}

/**
 * Generates a realistic NRA property record
 */
export function generateNRARecord(mlhcpRecord?: MLHCPLandRecord): NRAPropertyRecord {
  const hasMLHCP = !!mlhcpRecord;
  const owner = hasMLHCP ? mlhcpRecord : { 
    ownerName: generateSierraLeoneName().fullName,
    district: randomElement(SierraLeonePatterns.districts)
  };
  
  // Sometimes names don't match exactly (common issue)
  const nameMatch = hasMLHCP && Math.random() > 0.3;
  const taxpayerName = nameMatch ? mlhcpRecord!.ownerName : generateSierraLeoneName().fullName;
  
  const assessedValue = randomBetween(5000000, 500000000); // 5M to 500M Leones
  const annualTax = assessedValue * 0.001; // 0.1% property tax
  
  return {
    taxId: `NRA-${Math.floor(Math.random() * 999999).toString().padStart(6, '0')}`,
    propertyRef: hasMLHCP && Math.random() > 0.5 ? mlhcpRecord!.landId : undefined,
    
    taxpayerName,
    taxpayerAddress: generateAddress(owner.district as DistrictName),
    
    propertyAddress: hasMLHCP ? mlhcpRecord!.address || generateAddress(owner.district as DistrictName) : generateAddress(owner.district as DistrictName),
    propertyType: randomElement(['Residential', 'Commercial', 'Mixed Use']),
    assessedValue,
    lastAssessmentDate: formatDateWithVariation(randomDate(new Date('2020-01-01'), new Date())),
    
    annualTax,
    lastPaymentDate: Math.random() > 0.3 ? formatDateWithVariation(randomDate(new Date('2023-01-01'), new Date())) : undefined,
    lastPaymentAmount: Math.random() > 0.3 ? annualTax : undefined,
    arrears: Math.random() > 0.7 ? annualTax * randomBetween(1, 5) : 0,
    
    isCompliant: Math.random() > 0.3,
    
    taxpayerTin: Math.random() > 0.6 ? `TIN${Math.floor(Math.random() * 999999999)}` : undefined,
  };
}

/**
 * Generates a realistic OARG deed record
 */
export function generateOARGDeedRecord(mlhcpRecord?: MLHCPLandRecord): OARGDeedRecord {
  const transactionDate = randomDate(new Date('2000-01-01'), new Date());
  const transactionType = randomElement(['sale', 'gift', 'inheritance', 'lease', 'mortgage'] as const);
  
  const grantor = generateSierraLeoneName();
  const grantee = mlhcpRecord ? { name: mlhcpRecord.ownerName } : generateSierraLeoneName();
  
  const considerationAmount = transactionType === 'sale' ? 
    randomBetween(10000000, 1000000000) : // 10M to 1B Leones
    transactionType === 'gift' || transactionType === 'inheritance' ? 0 : 
    randomBetween(500000, 10000000); // Lease amounts
  
  const record: OARGDeedRecord = {
    deedNumber: `DEED/${transactionDate.getFullYear()}/${Math.floor(Math.random() * 9999).toString().padStart(4, '0')}`,
    volumeNumber: `VOL-${Math.floor(Math.random() * 999)}`,
    folioNumber: Math.floor(Math.random() * 500).toString(),
    
    transactionType,
    transactionDate: formatDateWithVariation(transactionDate),
    considerationAmount,
    
    grantor: {
      name: grantor.fullName,
      address: Math.random() > 0.5 ? generateAddress(randomElement(SierraLeonePatterns.districts)) : undefined,
      identification: Math.random() > 0.6 ? `SL${Math.floor(Math.random() * 999999999)}` : undefined,
    },
    
    grantee: {
      name: grantee.name || grantee.fullName,
      address: Math.random() > 0.5 ? generateAddress(randomElement(SierraLeonePatterns.districts)) : undefined,
      identification: Math.random() > 0.6 ? `SL${Math.floor(Math.random() * 999999999)}` : undefined,
    },
    
    propertyDescription: `All that piece or parcel of land situate lying and being at ${generateAddress(randomElement(SierraLeonePatterns.districts))}`,
    mlhcpReference: mlhcpRecord && Math.random() > 0.4 ? mlhcpRecord.landId : undefined,
    
    registrationDate: formatDateWithVariation(transactionDate),
    registrationOfficer: generateSierraLeoneName().fullName,
    stampDuty: considerationAmount * 0.03, // 3% stamp duty
  };
  
  // Add witnesses (common for important transactions)
  if (Math.random() > 0.3) {
    record.witnesses = [
      { name: generateSierraLeoneName().fullName, address: generateAddress(randomElement(SierraLeonePatterns.districts)) },
      { name: generateSierraLeoneName().fullName }
    ];
  }
  
  // Add lawyer for formal transactions
  if (transactionType === 'sale' && Math.random() > 0.5) {
    record.lawyer = {
      name: `${randomElement(['Barrister', 'Solicitor'])} ${generateSierraLeoneName().fullName}`,
      license: `SLB/${Math.floor(Math.random() * 9999)}`
    };
  }
  
  return record;
}

/**
 * Generates a complete set of government records for testing
 */
export function generateCompleteRecordSet(options?: {
  includeDisputes?: boolean;
  dataQualityIssues?: boolean;
  count?: number;
}): {
  mlhcp: MLHCPLandRecord[];
  nra: NRAPropertyRecord[];
  oarg: OARGDeedRecord[];
} {
  const count = options?.count || 100;
  const mlhcpRecords: MLHCPLandRecord[] = [];
  const nraRecords: NRAPropertyRecord[] = [];
  const oargRecords: OARGDeedRecord[] = [];
  
  for (let i = 0; i < count; i++) {
    // Generate MLHCP record
    const mlhcp = generateMLHCPRecord({
      hasDataIssues: options?.dataQualityIssues,
      isDisputed: options?.includeDisputes && Math.random() > 0.8
    });
    mlhcpRecords.push(mlhcp);
    
    // 70% chance of having matching NRA record
    if (Math.random() > 0.3) {
      nraRecords.push(generateNRARecord(mlhcp));
    }
    
    // 60% chance of having OARG record
    if (Math.random() > 0.4) {
      oargRecords.push(generateOARGDeedRecord(mlhcp));
    }
  }
  
  // Add some orphan records (exist in one system but not others)
  const orphanCount = Math.floor(count * 0.1);
  for (let i = 0; i < orphanCount; i++) {
    if (Math.random() > 0.5) {
      nraRecords.push(generateNRARecord());
    } else {
      oargRecords.push(generateOARGDeedRecord());
    }
  }
  
  return { mlhcp: mlhcpRecords, nra: nraRecords, oarg: oargRecords };
}