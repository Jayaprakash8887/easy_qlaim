import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { useAuth } from './AuthContext';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

// Easy Qlaim default branding - used when tenant-specific branding is not configured
export const EASY_QLAIM_DEFAULTS = {
  logo_url: '/logo-horizontal.svg',
  logo_mark_url: '/logo-mark.svg',
  favicon_url: '/favicon.ico',
  app_name: 'Easy Qlaim',
  tagline: 'Simplifying expense management',
};

interface BrandingSettings {
  logo_url: string | null;
  logo_mark_url: string | null;
  favicon_url: string | null;
  login_background_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  accent_color: string | null;
  company_tagline: string | null;
}

interface BrandingContextType {
  branding: BrandingSettings | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const defaultBranding: BrandingSettings = {
  logo_url: null,
  logo_mark_url: null,
  favicon_url: null,
  login_background_url: null,
  primary_color: null,
  secondary_color: null,
  accent_color: null,
  company_tagline: null,
};

const BrandingContext = createContext<BrandingContextType | undefined>(undefined);

// Apply CSS custom properties for branding colors
function applyBrandingColors(branding: BrandingSettings | null) {
  const root = document.documentElement;
  
  if (branding?.primary_color) {
    // Convert hex to HSL for Tailwind compatibility
    const hsl = hexToHSL(branding.primary_color);
    if (hsl) {
      root.style.setProperty('--primary', `${hsl.h} ${hsl.s}% ${hsl.l}%`);
    }
  } else {
    root.style.removeProperty('--primary');
  }
  
  if (branding?.secondary_color) {
    const hsl = hexToHSL(branding.secondary_color);
    if (hsl) {
      root.style.setProperty('--secondary', `${hsl.h} ${hsl.s}% ${hsl.l}%`);
    }
  } else {
    root.style.removeProperty('--secondary');
  }
  
  if (branding?.accent_color) {
    const hsl = hexToHSL(branding.accent_color);
    if (hsl) {
      root.style.setProperty('--accent', `${hsl.h} ${hsl.s}% ${hsl.l}%`);
    }
  } else {
    root.style.removeProperty('--accent');
  }
}

// Apply favicon
function applyFavicon(faviconUrl: string | null) {
  if (!faviconUrl) return;
  
  let link = document.querySelector("link[rel*='icon']") as HTMLLinkElement;
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.href = faviconUrl;
}

// Convert hex color to HSL
function hexToHSL(hex: string): { h: number; s: number; l: number } | null {
  // Remove # if present
  hex = hex.replace(/^#/, '');
  
  if (hex.length !== 6) return null;
  
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;
  
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }
  
  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

export function BrandingProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, getAccessToken } = useAuth();
  const [branding, setBranding] = useState<BrandingSettings | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBranding = async () => {
    if (!user?.tenantId) {
      setBranding(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const token = getAccessToken();
      const response = await fetch(`${API_BASE_URL}/branding/${user.tenantId}`, {
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch branding');
      }

      const data = await response.json();
      const brandingData = data.branding || defaultBranding;
      setBranding(brandingData);
      
      // Apply branding to the DOM
      applyBrandingColors(brandingData);
      applyFavicon(brandingData.favicon_url);
    } catch (err) {
      console.error('Error fetching branding:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch branding');
      setBranding(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch branding when user changes
  useEffect(() => {
    if (isAuthenticated && user?.tenantId) {
      fetchBranding();
    } else {
      setBranding(null);
      // Reset branding colors when logged out
      applyBrandingColors(null);
    }
  }, [isAuthenticated, user?.tenantId]);

  return (
    <BrandingContext.Provider value={{ branding, isLoading, error, refetch: fetchBranding }}>
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding() {
  const context = useContext(BrandingContext);
  if (context === undefined) {
    throw new Error('useBranding must be used within a BrandingProvider');
  }
  return context;
}
