/**
 * Utility functions for formatting region codes to human-readable names
 */

// Static mapping for common region codes
const regionCodeToNameMap: Record<string, string> = {
  // India regions
  'INDIA': 'India',
  'IND': 'India',
  'INDBLR': 'India - Bangalore',
  'INDCHN': 'India - Chennai',
  'INDDEL': 'India - Delhi',
  'INDMUM': 'India - Mumbai',
  'INDHYD': 'India - Hyderabad',
  'INDPUN': 'India - Pune',
  'INDKOL': 'India - Kolkata',
  
  // SEZ/STP regions
  'SEZ': 'SEZ',
  'STP': 'STP',
  'STPIDR': 'STP IDR',
  'STPDEL': 'STP Delhi',
  'STPBLR': 'STP Bangalore',
  'STPCHN': 'STP Chennai',
  'SEZBLR': 'SEZ Bangalore',
  'SEZCHN': 'SEZ Chennai',
  'SEZDEL': 'SEZ Delhi',
  
  // Compound codes
  'INDBLR-STPIDR-STPDEL-SEZ': 'India (Bangalore, STP IDR, STP Delhi, SEZ)',
  
  // US regions
  'USA': 'United States',
  'US': 'United States',
  
  // Other regions
  'GLOBAL': 'Global',
  'APAC': 'Asia Pacific',
  'EMEA': 'Europe, Middle East & Africa',
};

/**
 * Formats a region code to a human-readable name
 * Handles compound codes like "INDBLR-STPIDR-STPDEL-SEZ"
 */
export function formatRegion(regionCode: string | string[] | undefined | null): string {
  if (!regionCode) return 'Global';
  
  // Handle array of regions
  if (Array.isArray(regionCode)) {
    if (regionCode.length === 0) return 'Global';
    return regionCode.map(code => formatSingleRegion(code)).join(', ');
  }
  
  return formatSingleRegion(regionCode);
}

function formatSingleRegion(code: string): string {
  if (!code) return 'Global';
  
  const trimmedCode = code.trim().toUpperCase();
  
  // Direct match first
  if (regionCodeToNameMap[trimmedCode]) {
    return regionCodeToNameMap[trimmedCode];
  }
  
  // Check if it's a compound code with hyphens
  if (trimmedCode.includes('-')) {
    const parts = trimmedCode.split('-');
    const mappedParts = parts.map(part => {
      const mapped = regionCodeToNameMap[part];
      if (mapped) return mapped;
      // Format the part nicely if not in mapping
      return formatUnknownCode(part);
    });
    return mappedParts.join(', ');
  }
  
  // Fallback: format the code nicely
  return formatUnknownCode(trimmedCode);
}

function formatUnknownCode(code: string): string {
  if (!code) return 'Unknown';
  
  // Handle common patterns
  // IND prefix = India
  if (code.startsWith('IND') && code.length > 3) {
    const suffix = code.slice(3);
    const cityMap: Record<string, string> = {
      'BLR': 'Bangalore',
      'CHN': 'Chennai', 
      'DEL': 'Delhi',
      'MUM': 'Mumbai',
      'HYD': 'Hyderabad',
      'PUN': 'Pune',
      'KOL': 'Kolkata',
    };
    if (cityMap[suffix]) {
      return `India - ${cityMap[suffix]}`;
    }
  }
  
  // STP/SEZ prefix
  if (code.startsWith('STP') && code.length > 3) {
    const suffix = code.slice(3);
    return `STP ${suffix}`;
  }
  if (code.startsWith('SEZ') && code.length > 3) {
    const suffix = code.slice(3);
    return `SEZ ${suffix}`;
  }
  
  // Default: title case with underscores replaced
  return code
    .replace(/_/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Get region display info from a list of available regions
 */
export function getRegionDisplayName(
  regionCode: string | string[] | undefined | null,
  availableRegions?: Array<{ code: string; name: string }>
): string {
  if (!regionCode) return 'Global';
  
  const codes = Array.isArray(regionCode) ? regionCode : [regionCode];
  
  if (availableRegions && availableRegions.length > 0) {
    const names = codes.map(code => {
      const found = availableRegions.find(r => 
        r.code.toLowerCase() === code.toLowerCase()
      );
      return found?.name || formatSingleRegion(code);
    });
    return names.join(', ');
  }
  
  return formatRegion(regionCode);
}
