/**
 * Formatting utilities that use tenant-specific settings
 * for dates, numbers, and currency display.
 */
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { format as dateFnsFormat, parse } from 'date-fns';
import { toZonedTime, format as formatTz } from 'date-fns-tz';
import { useCallback, useMemo } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

// Auth helper
function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('access_token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

// Types
interface GeneralSettings {
  timezone: string;
  date_format: string;
  number_format: string;
  default_currency: string;
  fiscal_year_start: string; // Month code like 'jan', 'apr', etc.
}

// Currency symbols map
const CURRENCY_SYMBOLS: Record<string, string> = {
  inr: '₹',
  usd: '$',
  eur: '€',
  gbp: '£',
  aed: 'د.إ',
  sgd: 'S$',
  jpy: '¥',
};

// Timezone code to IANA timezone mapping
const TIMEZONE_MAP: Record<string, string> = {
  'IST': 'Asia/Kolkata',
  'UTC': 'UTC',
  'EST': 'America/New_York',
  'PST': 'America/Los_Angeles',
  'GMT': 'Europe/London',
  'CET': 'Europe/Paris',
  'JST': 'Asia/Tokyo',
  'AEST': 'Australia/Sydney',
  'SGT': 'Asia/Singapore',
  'GST': 'Asia/Dubai',
};

// Date format mapping from settings to date-fns format strings
const DATE_FORMAT_MAP: Record<string, string> = {
  'DD/MM/YYYY': 'dd/MM/yyyy',
  'MM/DD/YYYY': 'MM/dd/yyyy',
  'YYYY-MM-DD': 'yyyy-MM-dd',
  'DD-MM-YYYY': 'dd-MM-yyyy',
  'DD.MM.YYYY': 'dd.MM.yyyy',
};

// Number format locale mapping
const NUMBER_FORMAT_LOCALES: Record<string, string> = {
  'en-IN': 'en-IN',
  'en-US': 'en-US',
  'de-DE': 'de-DE',
  'fr-FR': 'fr-FR',
  'es-ES': 'es-ES',
};

// Fetch settings
async function fetchGeneralSettings(tenantId?: string): Promise<GeneralSettings> {
  const params = tenantId ? `?tenant_id=${tenantId}` : '';
  const response = await fetch(`${API_BASE_URL}/settings/general${params}`, {
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error('Failed to fetch settings');
  }
  return response.json();
}

// Default settings
const DEFAULT_SETTINGS: GeneralSettings = {
  timezone: 'IST',
  date_format: 'DD/MM/YYYY',
  number_format: 'en-IN',
  default_currency: 'inr',
  fiscal_year_start: 'apr', // Default fiscal year starts in April
};

// Month name to number mapping
const MONTH_TO_NUMBER: Record<string, number> = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
};

/**
 * Get the current financial year range based on fiscal year start month
 */
export function getCurrentFinancialYear(fiscalYearStart: string): { start: Date; end: Date; label: string } {
  const fiscalStartMonth = MONTH_TO_NUMBER[fiscalYearStart.toLowerCase()] || 4; // Default April
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1; // getMonth() is 0-indexed
  
  // Determine the fiscal year based on current date
  let fyStartYear: number;
  if (currentMonth >= fiscalStartMonth) {
    // We're in the fiscal year that started this calendar year
    fyStartYear = currentYear;
  } else {
    // We're in the fiscal year that started last calendar year
    fyStartYear = currentYear - 1;
  }
  
  const fyEndYear = fyStartYear + 1;
  
  // Calculate fiscal year start date (first day of start month)
  const fyStart = new Date(fyStartYear, fiscalStartMonth - 1, 1);
  
  // Calculate fiscal year end date (last day of month before fiscal start)
  const fyEndMonth = fiscalStartMonth - 1 || 12; // If start is Jan (1), end month is Dec (12)
  const fyEndYearActual = fiscalStartMonth === 1 ? fyStartYear : fyEndYear;
  // Get last day of the ending month
  const fyEnd = new Date(fyEndYearActual, fyEndMonth, 0); // Day 0 gives last day of previous month
  
  // Create label like "FY 2025-26"
  const label = `FY ${fyStartYear}-${String(fyEndYear).slice(-2)}`;
  
  return { start: fyStart, end: fyEnd, label };
}

/**
 * Check if a date falls within the current financial year
 */
export function isDateInCurrentFinancialYear(date: Date | string, fiscalYearStart: string): {
  isCurrentFY: boolean;
  fyLabel: string;
  fyStart: Date;
  fyEnd: Date;
} {
  const checkDate = typeof date === 'string' ? new Date(date) : date;
  const fy = getCurrentFinancialYear(fiscalYearStart);
  
  const isCurrentFY = checkDate >= fy.start && checkDate <= fy.end;
  
  return {
    isCurrentFY,
    fyLabel: fy.label,
    fyStart: fy.start,
    fyEnd: fy.end,
  };
}

/**
 * Hook to get formatting functions based on tenant settings
 */
export function useFormatting() {
  const { user } = useAuth();

  const { data: settings } = useQuery({
    queryKey: ['generalSettings', user?.tenantId],
    queryFn: () => fetchGeneralSettings(user?.tenantId),
    enabled: !!user?.tenantId,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    gcTime: 10 * 60 * 1000,
  });

  const currentSettings = settings || DEFAULT_SETTINGS;

  // Get the IANA timezone from settings timezone code
  const ianaTimezone = useMemo(() => {
    return TIMEZONE_MAP[currentSettings.timezone] || 'Asia/Kolkata';
  }, [currentSettings.timezone]);

  /**
   * Format a date according to tenant settings (date only, no timezone conversion needed)
   */
  const formatDate = useCallback((date: Date | string | null | undefined): string => {
    if (!date) return '-';
    
    try {
      const dateObj = typeof date === 'string' ? new Date(date) : date;
      if (isNaN(dateObj.getTime())) return '-';
      
      const formatStr = DATE_FORMAT_MAP[currentSettings.date_format] || 'dd/MM/yyyy';
      // Convert to tenant timezone for display
      const zonedDate = toZonedTime(dateObj, ianaTimezone);
      return dateFnsFormat(zonedDate, formatStr);
    } catch {
      return '-';
    }
  }, [currentSettings.date_format, ianaTimezone]);

  /**
   * Format a date with time according to tenant settings and timezone
   */
  const formatDateTime = useCallback((date: Date | string | null | undefined): string => {
    if (!date) return '-';
    
    try {
      const dateObj = typeof date === 'string' ? new Date(date) : date;
      if (isNaN(dateObj.getTime())) return '-';
      
      const formatStr = DATE_FORMAT_MAP[currentSettings.date_format] || 'dd/MM/yyyy';
      // Convert to tenant timezone for display
      const zonedDate = toZonedTime(dateObj, ianaTimezone);
      return dateFnsFormat(zonedDate, `${formatStr} HH:mm`);
    } catch {
      return '-';
    }
  }, [currentSettings.date_format, ianaTimezone]);

  /**
   * Format a number according to tenant settings
   */
  const formatNumber = useCallback((value: number | null | undefined): string => {
    if (value === null || value === undefined) return '-';
    
    const locale = NUMBER_FORMAT_LOCALES[currentSettings.number_format] || 'en-IN';
    return new Intl.NumberFormat(locale).format(value);
  }, [currentSettings.number_format]);

  /**
   * Format currency amount according to tenant settings
   */
  const formatCurrency = useCallback((
    amount: number | null | undefined, 
    currency?: string
  ): string => {
    if (amount === null || amount === undefined) return '-';
    
    const currencyCode = currency || currentSettings.default_currency;
    const symbol = CURRENCY_SYMBOLS[currencyCode.toLowerCase()] || currencyCode.toUpperCase();
    const locale = NUMBER_FORMAT_LOCALES[currentSettings.number_format] || 'en-IN';
    
    // Format with locale-specific number formatting
    const formattedNumber = new Intl.NumberFormat(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
    
    return `${symbol}${formattedNumber}`;
  }, [currentSettings.default_currency, currentSettings.number_format]);

  /**
   * Format currency amount with full Intl.NumberFormat
   * (includes proper currency symbol placement for the locale)
   */
  const formatCurrencyFull = useCallback((
    amount: number | null | undefined,
    currency?: string
  ): string => {
    if (amount === null || amount === undefined) return '-';
    
    const currencyCode = (currency || currentSettings.default_currency).toUpperCase();
    const locale = NUMBER_FORMAT_LOCALES[currentSettings.number_format] || 'en-IN';
    
    try {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currencyCode,
      }).format(amount);
    } catch {
      // Fallback if currency code is not valid
      return formatCurrency(amount, currency);
    }
  }, [currentSettings.default_currency, currentSettings.number_format, formatCurrency]);

  /**
   * Get the currency symbol for current tenant
   */
  const getCurrencySymbol = useCallback((currency?: string): string => {
    const currencyCode = currency || currentSettings.default_currency;
    return CURRENCY_SYMBOLS[currencyCode.toLowerCase()] || currencyCode.toUpperCase();
  }, [currentSettings.default_currency]);

  /**
   * Get the current date format string (for display)
   */
  const getDateFormatDisplay = useCallback((): string => {
    return currentSettings.date_format;
  }, [currentSettings.date_format]);

  /**
   * Get date-fns format string for use in date pickers
   */
  const getDateFnsFormat = useCallback((): string => {
    return DATE_FORMAT_MAP[currentSettings.date_format] || 'dd/MM/yyyy';
  }, [currentSettings.date_format]);

  /**
   * Get fiscal year start month
   */
  const getFiscalYearStart = useCallback((): string => {
    return currentSettings.fiscal_year_start || 'apr';
  }, [currentSettings.fiscal_year_start]);

  /**
   * Check if a date is within the current financial year
   */
  const checkFinancialYear = useCallback((date: Date | string) => {
    return isDateInCurrentFinancialYear(date, currentSettings.fiscal_year_start || 'apr');
  }, [currentSettings.fiscal_year_start]);

  return {
    formatDate,
    formatDateTime,
    formatNumber,
    formatCurrency,
    formatCurrencyFull,
    getCurrencySymbol,
    getDateFormatDisplay,
    getDateFnsFormat,
    getFiscalYearStart,
    checkFinancialYear,
    settings: currentSettings,
  };
}

/**
 * Standalone format functions for use outside of React components
 * These use default settings
 */
export const standaloneFormatters = {
  formatDate: (date: Date | string, dateFormat: string = 'DD/MM/YYYY'): string => {
    if (!date) return '-';
    try {
      const dateObj = typeof date === 'string' ? new Date(date) : date;
      const formatStr = DATE_FORMAT_MAP[dateFormat] || 'dd/MM/yyyy';
      return dateFnsFormat(dateObj, formatStr);
    } catch {
      return '-';
    }
  },
  
  formatCurrency: (amount: number, currency: string = 'inr', locale: string = 'en-IN'): string => {
    const symbol = CURRENCY_SYMBOLS[currency.toLowerCase()] || currency.toUpperCase();
    const formattedNumber = new Intl.NumberFormat(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
    return `${symbol}${formattedNumber}`;
  },
};
