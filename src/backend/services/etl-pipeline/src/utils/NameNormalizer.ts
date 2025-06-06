/**
 * Name normalization utilities for Sierra Leone names
 */

// Common name variations in Sierra Leone
const nameVariations: Record<string, string[]> = {
  'MOHAMED': ['MOHAMMED', 'MUHAMMAD', 'MUHAMMED', 'MOHAMAD', 'MOHAMMAD'],
  'IBRAHIM': ['IBRAHIMA', 'BRAHIM', 'EBRAHIM'],
  'FATMATA': ['FATIMA', 'FATIMATA', 'FATU'],
  'AMINATA': ['AMINA', 'AMINATU', 'MINA'],
  'MARIAMA': ['MARIAM', 'MARYAM', 'MARIA'],
  'KADIATU': ['KADIJATU', 'KADI', 'KADIJA'],
  'MAMADU': ['MAMADOU', 'AMADOU', 'AMADU'],
  'ABUBAKARR': ['ABUBAKAR', 'ABUBAKR', 'ABU BAKR'],
  'ISATU': ['ISATA', 'ISA', 'ISSATU'],
  'HASSAN': ['HASAN', 'HASSANU'],
  'HUSSEIN': ['HUSSAIN', 'HUSEIN', 'HUSAIN']
};

// Create reverse mapping
const reverseNameMap: Record<string, string> = {};
for (const [standard, variations] of Object.entries(nameVariations)) {
  reverseNameMap[standard] = standard;
  for (const variation of variations) {
    reverseNameMap[variation] = standard;
  }
}

/**
 * Normalize a person's name
 */
export function normalizeNames(fullName: string): string {
  if (!fullName) return '';

  // Split into parts
  const parts = fullName
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase()
    .split(' ');

  // Normalize each part
  const normalizedParts = parts.map(part => {
    // Check if this part has a standard form
    const standard = reverseNameMap[part];
    if (standard) {
      return standard;
    }

    // Otherwise, proper case it
    return part.charAt(0) + part.slice(1).toLowerCase();
  });

  return normalizedParts.join(' ');
}

/**
 * Calculate name similarity score
 */
export function calculateNameSimilarity(name1: string, name2: string): number {
  const norm1 = normalizeNames(name1);
  const norm2 = normalizeNames(name2);

  if (norm1 === norm2) return 1.0;

  // Split into parts
  const parts1 = norm1.split(' ');
  const parts2 = norm2.split(' ');

  // Check for matching parts
  let matches = 0;
  for (const part1 of parts1) {
    if (parts2.includes(part1)) {
      matches++;
    }
  }

  // Calculate similarity
  const maxParts = Math.max(parts1.length, parts2.length);
  return matches / maxParts;
}

/**
 * Check if two names likely refer to the same person
 */
export function areNamesSimilar(name1: string, name2: string, threshold: number = 0.7): boolean {
  return calculateNameSimilarity(name1, name2) >= threshold;
}