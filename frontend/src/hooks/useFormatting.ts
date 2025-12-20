/**
 * Formatting utilities that use tenant-specific settings
 * for dates, numbers, and currency display.
 */
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { format as dateFnsFormat, parse } from 'date-fns';
import { useCallback, useMemo } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

// Types
interface GeneralSettings {
  timezone: string;
  date_format: string;
  number_format: string;
  default_currency: string;
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
  const response = await fetch(`${API_BASE_URL}/settings/general${params}`);
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
};

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

  /**
   * Format a date according to tenant settings
   */
  const formatDate = useCallback((date: Date | string | null | undefined): string => {
    if (!date) return '-';
    
    try {
      const dateObj = typeof date === 'string' ? new Date(date) : date;
      if (isNaN(dateObj.getTime())) return '-';
      
      const formatStr = DATE_FORMAT_MAP[currentSettings.date_format] || 'dd/MM/yyyy';
      return dateFnsFormat(dateObj, formatStr);
    } catch {
      return '-';
    }
  }, [currentSettings.date_format]);

  /**
   * Format a date with time according to tenant settings
   */
  const formatDateTime = useCallback((date: Date | string | null | undefined): string => {
    if (!date) return '-';
    
    try {
      const dateObj = typeof date === 'string' ? new Date(date) : date;
      if (isNaN(dateObj.getTime())) return '-';
      
      const formatStr = DATE_FORMAT_MAP[currentSettings.date_format] || 'dd/MM/yyyy';
      return dateFnsFormat(dateObj, `${formatStr} HH:mm`);
    } catch {
      return '-';
    }
  }, [currentSettings.date_format]);

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

  return {
    formatDate,
    formatDateTime,
    formatNumber,
    formatCurrency,
    formatCurrencyFull,
    getCurrencySymbol,
    getDateFormatDisplay,
    getDateFnsFormat,
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
