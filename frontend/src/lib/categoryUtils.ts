/**
 * Utility functions for formatting category codes to human-readable names
 */

// Static mapping for common category codes
const categoryMap: Record<string, string> = {
  // Backend uppercase categories
  'TEAM_LUNCH': 'Team Lunch',
  'FOOD': 'Food & Meals',
  'TRAVEL': 'Travel',
  'TRAVEL_WB': 'Travel',
  'TRAVEL_WOB': 'Travel',
  'CERTIFICATION': 'Certification',
  'ACCOMMODATION': 'Accommodation',
  'EQUIPMENT': 'Equipment',
  'SOFTWARE': 'Software',
  'OFFICE_SUPPLIES': 'Office Supplies',
  'MEDICAL': 'Medical',
  'MOBILE': 'Phone & Internet',
  'PHONE_INTERNET': 'Phone & Internet',
  'PASSPORT_VISA': 'Passport & Visa',
  'CONVEYANCE': 'Conveyance',
  'CLIENT_MEETING': 'Client Meeting',
  'OTHER': 'Other',
  // Frontend lowercase categories
  'team_lunch': 'Team Lunch',
  'food': 'Food & Meals',
  'travel': 'Travel',
  'travel_wb': 'Travel',
  'travel_wob': 'Travel',
  'certification': 'Certification',
  'accommodation': 'Accommodation',
  'equipment': 'Equipment',
  'software': 'Software',
  'office_supplies': 'Office Supplies',
  'medical': 'Medical',
  'phone_internet': 'Phone & Internet',
  'passport_visa': 'Passport & Visa',
  'conveyance': 'Conveyance',
  'client_meeting': 'Client Meeting',
  'other': 'Other',
  // Legacy mappings
  'RELOCATION': 'Other',
  'INTERNET': 'Software',
};

/**
 * Formats a category code to a human-readable name
 * Handles various formats: TRAVEL_WB, travel_wb, Cc-2025-0001, etc.
 */
export function formatCategory(category: string | undefined | null): string {
  if (!category) return 'Other';
  
  const categoryStr = typeof category === 'string' ? category : String(category);
  
  // Direct match first (case-sensitive)
  if (categoryMap[categoryStr]) {
    return categoryMap[categoryStr];
  }
  
  // Try lowercase match
  const lowerCategory = categoryStr.toLowerCase();
  if (categoryMap[lowerCategory]) {
    return categoryMap[lowerCategory];
  }
  
  // Try uppercase match
  const upperCategory = categoryStr.toUpperCase();
  if (categoryMap[upperCategory]) {
    return categoryMap[upperCategory];
  }
  
  // Check if it's a custom category code (e.g., CC-2025-0001, Cc-2025-0001, cc-2025-0001)
  // Pattern matches any case variations like CC, Cc, cC, cc followed by -YYYY-NNNN
  const customCodePattern = /^[Cc]{1,2}-\d{4}-\d{4,}$/i;
  if (customCodePattern.test(categoryStr)) {
    // This is a custom claim category code - return "Custom" or extract from context
    return 'Custom Claim';
  }
  
  // Smart formatting fallback - handle codes like TRAVEL_WB properly
  let formatted = lowerCategory
    .replace(/_wb$/i, '')  // Remove _WB suffix
    .replace(/_wob$/i, '') // Remove _WOB suffix  
    .replace(/_reimbursement$/i, '') // Remove _reimbursement suffix
    .replace(/[-_]/g, ' ')
    .trim();
  
  // Title case each word
  return formatted
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Gets category display info from a list of available categories
 * Returns both the formatted name and any additional info
 */
export function getCategoryDisplayName(
  categoryCode: string | undefined | null,
  availableCategories?: Array<{ category_code: string; category_name: string }>
): string {
  if (!categoryCode) return 'Other';
  
  // First, try to find in available categories by code match
  if (availableCategories && availableCategories.length > 0) {
    const normalizedCode = categoryCode.toLowerCase();
    const found = availableCategories.find(
      cat => cat.category_code.toLowerCase() === normalizedCode
    );
    if (found) {
      return found.category_name;
    }
  }
  
  // Fall back to static formatting
  return formatCategory(categoryCode);
}
