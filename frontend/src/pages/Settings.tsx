import { useState, useEffect, useRef } from 'react';
import {
  Settings as SettingsIcon,
  Save,
  X,
  Loader2,
  Globe,
  Clock,
  Calendar,
  Shield,
  Palette,
  Image,
  Upload,
  Trash2,
  Info,
  MessageSquare,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';
import { toast as sonnerToast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import {
  useTenantBranding,
  useUploadBrandingFile,
  useDeleteBrandingFile,
  useUpdateBrandingColors,
  useUpdateBrandingSettings,
  BrandingFileSpec,
} from '@/hooks/useSystemAdmin';
import { CommunicationIntegrations } from '@/components/settings/CommunicationIntegrations';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

// Types
interface GeneralSettings {
  default_currency: string;
  fiscal_year_start: string;
  email_notifications: boolean;
  notification_email: string;
  timezone: string;
  date_format: string;
  number_format: string;
  working_days: string;
  week_start: string;
  session_timeout: string;
}

interface SettingOption {
  code: string;
  label: string;
  [key: string]: any;
}

interface AllSettingsOptions {
  timezones: { options: SettingOption[]; default: string };
  date_formats: { options: SettingOption[]; default: string };
  number_formats: { options: SettingOption[]; default: string };
  working_days: { options: SettingOption[]; default: string };
  week_start: { options: SettingOption[]; default: string };
  session_timeouts: { options: SettingOption[]; default: string; platform_max_minutes?: number };
}

// Branding file specs
const BRANDING_FILE_SPECS: Record<string, BrandingFileSpec> = {
  logo: {
    name: "Full Logo",
    description: "Primary logo with company name, used in headers and login pages",
    formats: ["svg", "png"],
    max_size_mb: 2,
    recommended_dimensions: "400x200 pixels (for PNG) or scalable (for SVG)",
    notes: "SVG is preferred for crisp rendering at all sizes. PNG should be at least 400px wide."
  },
  logo_mark: {
    name: "Logo Mark",
    description: "Icon or symbol only, used in sidebars and compact spaces",
    formats: ["svg", "png"],
    max_size_mb: 1,
    recommended_dimensions: "72x72 pixels minimum (for PNG) or scalable (for SVG)",
    notes: "Square format recommended. Used when space is limited."
  },
  favicon: {
    name: "Favicon",
    description: "Browser tab icon",
    formats: ["ico", "png"],
    max_size_mb: 0.5,
    recommended_dimensions: "32x32 or 16x16 pixels",
    notes: "ICO format supports multiple sizes. PNG should be 32x32 or 16x16."
  },
  login_background: {
    name: "Login Background",
    description: "Background image for the login page",
    formats: ["jpg", "jpeg", "png", "webp"],
    max_size_mb: 5,
    recommended_dimensions: "1920x1080 pixels",
    notes: "High resolution image recommended. Will be cropped/scaled to fit."
  }
};

// Branding File Upload Component
interface BrandingFileUploadProps {
  fileType: string;
  spec: BrandingFileSpec;
  currentUrl: string | null;
  tenantId: string;
  onUploadSuccess: () => void;
}

function BrandingFileUpload({ fileType, spec, currentUrl, tenantId, onUploadSuccess }: BrandingFileUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadMutation = useUploadBrandingFile();
  const deleteMutation = useDeleteBrandingFile();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.toLowerCase().split('.').pop();
    if (!ext || !spec.formats.includes(ext)) {
      sonnerToast.error(`Invalid file format. Allowed: ${spec.formats.join(', ').toUpperCase()}`);
      return;
    }

    const maxBytes = spec.max_size_mb * 1024 * 1024;
    if (file.size > maxBytes) {
      sonnerToast.error(`File too large. Maximum size: ${spec.max_size_mb}MB`);
      return;
    }

    try {
      await uploadMutation.mutateAsync({ tenantId, fileType, file });
      sonnerToast.success(`${spec.name} uploaded successfully`);
      onUploadSuccess();
    } catch (error: any) {
      sonnerToast.error(error.message || 'Failed to upload file');
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete ${spec.name}?`)) return;
    try {
      await deleteMutation.mutateAsync({ tenantId, fileType });
      sonnerToast.success(`${spec.name} deleted`);
      onUploadSuccess();
    } catch (error: any) {
      sonnerToast.error(error.message || 'Failed to delete file');
    }
  };

  const acceptedFormats = spec.formats.map(f => `.${f}`).join(',');

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="font-medium">{spec.name}</h4>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-4 w-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>{spec.notes}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <p className="text-sm text-muted-foreground">{spec.description}</p>
        </div>
        {currentUrl && (
          <Button variant="ghost" size="sm" onClick={handleDelete} disabled={deleteMutation.isPending}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        )}
      </div>

      <div className="text-xs text-muted-foreground space-y-1">
        <p><strong>Formats:</strong> {spec.formats.join(', ').toUpperCase()}</p>
        <p><strong>Max size:</strong> {spec.max_size_mb}MB</p>
        <p><strong>Recommended:</strong> {spec.recommended_dimensions}</p>
      </div>

      {currentUrl ? (
        <div className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg">
          <img src={currentUrl} alt={spec.name} className="h-16 w-auto max-w-[200px] object-contain" />
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploadMutation.isPending}>
            {uploadMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Replace'}
          </Button>
        </div>
      ) : (
        <div
          className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
          onClick={() => fileInputRef.current?.click()}
        >
          {uploadMutation.isPending ? (
            <Loader2 className="h-8 w-8 mx-auto animate-spin text-muted-foreground" />
          ) : (
            <>
              <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">Click to upload</p>
            </>
          )}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept={acceptedFormats}
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  );
}

// API functions
async function fetchGeneralSettings(tenantId?: string): Promise<GeneralSettings> {
  const params = tenantId ? `?tenant_id=${tenantId}` : '';
  const token = localStorage.getItem('access_token');
  const response = await fetch(`${API_BASE_URL}/settings/general${params}`, {
    headers: token ? { 'Authorization': `Bearer ${token}` } : {},
  });
  if (!response.ok) {
    throw new Error('Failed to fetch settings');
  }
  return response.json();
}

async function fetchAllSettingsOptions(): Promise<AllSettingsOptions> {
  const token = localStorage.getItem('access_token');
  const response = await fetch(`${API_BASE_URL}/settings/options/all`, {
    headers: token ? { 'Authorization': `Bearer ${token}` } : {},
  });
  if (!response.ok) {
    throw new Error('Failed to fetch settings options');
  }
  return response.json();
}

async function updateGeneralSettings(settings: Partial<GeneralSettings>, tenantId?: string): Promise<GeneralSettings> {
  const params = tenantId ? `?tenant_id=${tenantId}` : '';
  const token = localStorage.getItem('access_token');
  const response = await fetch(`${API_BASE_URL}/settings/general${params}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(settings),
  });
  if (!response.ok) {
    throw new Error('Failed to update settings');
  }
  return response.json();
}

export default function Settings() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('general');

  // Fetch settings from backend
  const { data: savedSettings, isLoading, error } = useQuery({
    queryKey: ['generalSettings', user?.tenantId],
    queryFn: () => fetchGeneralSettings(user?.tenantId),
    enabled: !!user?.tenantId,
  });

  // Fetch all available options
  const { data: optionsData } = useQuery({
    queryKey: ['allSettingsOptions'],
    queryFn: fetchAllSettingsOptions,
  });

  // Fetch branding data
  const { data: brandingData, isLoading: brandingLoading, refetch: refetchBranding } = useTenantBranding(user?.tenantId || '');
  const updateColorsMutation = useUpdateBrandingColors();
  const updateSettingsMutation = useUpdateBrandingSettings();

  // Branding local state
  const [brandingColors, setBrandingColors] = useState({
    primary_color: '#3B82F6',
    secondary_color: '#10B981',
    accent_color: '#F59E0B',
  });
  const [brandingTagline, setBrandingTagline] = useState('');
  const [hasBrandingChanges, setHasBrandingChanges] = useState(false);

  // Update branding state when data loads
  useEffect(() => {
    if (brandingData?.branding) {
      setBrandingColors({
        primary_color: brandingData.branding.primary_color || '#3B82F6',
        secondary_color: brandingData.branding.secondary_color || '#10B981',
        accent_color: brandingData.branding.accent_color || '#F59E0B',
      });
      setBrandingTagline(brandingData.branding.company_tagline || '');
    }
  }, [brandingData]);

  // Check for branding changes
  useEffect(() => {
    if (brandingData) {
      const colorsChanged = 
        brandingColors.primary_color !== (brandingData.branding?.primary_color || '#3B82F6') ||
        brandingColors.secondary_color !== (brandingData.branding?.secondary_color || '#10B981') ||
        brandingColors.accent_color !== (brandingData.branding?.accent_color || '#F59E0B');
      const taglineChanged = brandingTagline !== (brandingData.branding?.company_tagline || '');
      setHasBrandingChanges(colorsChanged || taglineChanged);
    }
  }, [brandingColors, brandingTagline, brandingData]);

  // Local state for form
  const [formData, setFormData] = useState<GeneralSettings>({
    default_currency: 'inr',
    fiscal_year_start: 'apr',
    email_notifications: true,
    notification_email: '',
    timezone: 'IST',
    date_format: 'DD/MM/YYYY',
    number_format: 'en-IN',
    working_days: 'mon-fri',
    week_start: 'monday',
    session_timeout: '480',
  });

  // Track if form has changes
  const [hasChanges, setHasChanges] = useState(false);

  // Update local state when saved settings load
  useEffect(() => {
    if (savedSettings) {
      setFormData(savedSettings);
      setHasChanges(false);
    }
  }, [savedSettings]);

  // Check for changes
  useEffect(() => {
    if (savedSettings) {
      const changed = JSON.stringify(formData) !== JSON.stringify(savedSettings);
      setHasChanges(changed);
    }
  }, [formData, savedSettings]);

  // Mutation for saving settings
  const saveMutation = useMutation({
    mutationFn: (settings: Partial<GeneralSettings>) => updateGeneralSettings(settings, user?.tenantId),
    onSuccess: (data) => {
      queryClient.setQueryData(['generalSettings', user?.tenantId], data);
      setHasChanges(false);
      toast({
        title: 'Settings saved',
        description: 'Your settings have been saved successfully.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'Failed to save settings. Please try again.',
        variant: 'destructive',
      });
    },
  });

  // Handle form changes
  const handleChange = (key: keyof GeneralSettings, value: boolean | string | number) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  // Handle save
  const handleSave = () => {
    saveMutation.mutate(formData);
  };

  // Handle cancel
  const handleCancel = () => {
    if (savedSettings) {
      setFormData(savedSettings);
      setHasChanges(false);
    }
  };

  // Format currency amount based on locale
  const formatAmount = (amount: number) => {
    const format = NUMBER_FORMAT_CHOICES[formData.number_format] || NUMBER_FORMAT_CHOICES['en-IN'];
    return new Intl.NumberFormat(formData.number_format, {
      style: 'currency',
      currency: formData.default_currency.toUpperCase(),
    }).format(amount);
  };

  // Number format options (fallback)
  const NUMBER_FORMAT_CHOICES: Record<string, { label: string }> = {
    'en-IN': { label: 'Indian (1,00,000.00)' },
    'en-US': { label: 'US/UK (100,000.00)' },
    'de-DE': { label: 'German (100.000,00)' },
    'fr-FR': { label: 'French (100 000,00)' },
    'es-ES': { label: 'Spanish (100.000,00)' },
  };

  // Handle branding colors save
  const handleSaveBrandingColors = async () => {
    if (!user?.tenantId) return;
    try {
      await updateColorsMutation.mutateAsync({ tenantId: user.tenantId, colors: brandingColors });
      sonnerToast.success('Brand colors updated successfully');
      refetchBranding();
    } catch (error: any) {
      sonnerToast.error(error.message || 'Failed to update colors');
    }
  };

  // Handle branding settings save
  const handleSaveBrandingSettings = async () => {
    if (!user?.tenantId) return;
    try {
      await updateSettingsMutation.mutateAsync({ tenantId: user.tenantId, settings: { tagline: brandingTagline } });
      sonnerToast.success('Branding settings updated successfully');
      refetchBranding();
    } catch (error: any) {
      sonnerToast.error(error.message || 'Failed to update settings');
    }
  };

  // Handle cancel branding changes
  const handleCancelBranding = () => {
    if (brandingData?.branding) {
      setBrandingColors({
        primary_color: brandingData.branding.primary_color || '#3B82F6',
        secondary_color: brandingData.branding.secondary_color || '#10B981',
        accent_color: brandingData.branding.accent_color || '#F59E0B',
      });
      setBrandingTagline(brandingData.branding.company_tagline || '');
    }
    setHasBrandingChanges(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Loading settings...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-destructive">Failed to load settings</p>
        <Button onClick={() => queryClient.invalidateQueries({ queryKey: ['generalSettings'] })}>
          Retry
        </Button>
      </div>
    );
  }

  const isAdmin = user?.role === 'admin';

  return (
    <div className="space-y-6">
      {!isAdmin && (
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">System Settings</h1>
            <p className="text-muted-foreground">
              Configure system-wide settings and integrations
            </p>
          </div>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full max-w-lg grid-cols-3">
          <TabsTrigger value="general" className="flex items-center gap-2">
            <SettingsIcon className="h-4 w-4" />
            General
          </TabsTrigger>
          <TabsTrigger value="integrations" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Integrations
          </TabsTrigger>
          <TabsTrigger value="branding" className="flex items-center gap-2">
            <Palette className="h-4 w-4" />
            Branding
          </TabsTrigger>
        </TabsList>

        {/* General Settings Tab */}
        <TabsContent value="general" className="space-y-4 mt-6">
          {/* Save/Cancel buttons - shown when there are changes */}
          {hasChanges && (
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={handleCancel}
                disabled={saveMutation.isPending}
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={saveMutation.isPending}
              >
                {saveMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save Changes
              </Button>
            </div>
          )}

          <div className={`space-y-4 ${hasChanges ? 'pb-24' : ''}`}>
        {/* General Settings Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <SettingsIcon className="h-5 w-5" />
              General Settings
            </CardTitle>
            <CardDescription>
              Basic configuration for the expense system
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Default Currency</Label>
              <Select
                value={formData.default_currency}
                onValueChange={(value) => handleChange('default_currency', value)}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="usd">USD ($)</SelectItem>
                  <SelectItem value="eur">EUR (€)</SelectItem>
                  <SelectItem value="gbp">GBP (£)</SelectItem>
                  <SelectItem value="inr">INR (₹)</SelectItem>
                  <SelectItem value="aed">AED (د.إ)</SelectItem>
                  <SelectItem value="sgd">SGD (S$)</SelectItem>
                  <SelectItem value="jpy">JPY (¥)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Fiscal Year Start</Label>
              <Select
                value={formData.fiscal_year_start}
                onValueChange={(value) => handleChange('fiscal_year_start', value)}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="jan">January</SelectItem>
                  <SelectItem value="apr">April</SelectItem>
                  <SelectItem value="jul">July</SelectItem>
                  <SelectItem value="oct">October</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Regional Settings Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Regional Settings
            </CardTitle>
            <CardDescription>
              Timezone, date format, and localization preferences
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Timezone</Label>
              <p className="text-sm text-muted-foreground">
                Default timezone for all dates and times
              </p>
              <Select
                value={formData.timezone}
                onValueChange={(value) => handleChange('timezone', value)}
              >
                <SelectTrigger className="w-[300px]">
                  <SelectValue placeholder="Select timezone" />
                </SelectTrigger>
                <SelectContent>
                  {optionsData?.timezones.options.map((tz) => (
                    <SelectItem key={tz.code} value={tz.code}>
                      {tz.label}
                    </SelectItem>
                  )) || (
                    <>
                      <SelectItem value="IST">IST (Asia/Kolkata)</SelectItem>
                      <SelectItem value="UTC">UTC</SelectItem>
                      <SelectItem value="EST">EST (America/New_York)</SelectItem>
                      <SelectItem value="PST">PST (America/Los_Angeles)</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
            <Separator />
            <div className="space-y-2">
              <Label>Date Format</Label>
              <p className="text-sm text-muted-foreground">
                How dates are displayed throughout the system
              </p>
              <Select
                value={formData.date_format}
                onValueChange={(value) => handleChange('date_format', value)}
              >
                <SelectTrigger className="w-[300px]">
                  <SelectValue placeholder="Select date format" />
                </SelectTrigger>
                <SelectContent>
                  {optionsData?.date_formats.options.map((df) => (
                    <SelectItem key={df.code} value={df.code}>
                      {df.label} ({df.example})
                    </SelectItem>
                  )) || (
                    <>
                      <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                      <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                      <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
            <Separator />
            <div className="space-y-2">
              <Label>Number Format</Label>
              <p className="text-sm text-muted-foreground">
                How numbers and currency amounts are displayed
              </p>
              <Select
                value={formData.number_format}
                onValueChange={(value) => handleChange('number_format', value)}
              >
                <SelectTrigger className="w-[300px]">
                  <SelectValue placeholder="Select number format" />
                </SelectTrigger>
                <SelectContent>
                  {optionsData?.number_formats.options.map((nf) => (
                    <SelectItem key={nf.code} value={nf.code}>
                      {nf.label}
                    </SelectItem>
                  )) || (
                    <>
                      <SelectItem value="en-IN">Indian (1,00,000.00)</SelectItem>
                      <SelectItem value="en-US">US/UK (100,000.00)</SelectItem>
                      <SelectItem value="de-DE">German (100.000,00)</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Working Days Settings Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Working Days
            </CardTitle>
            <CardDescription>
              Configure work week and calendar preferences
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Working Days</Label>
              <p className="text-sm text-muted-foreground">
                Which days are considered working days
              </p>
              <Select
                value={formData.working_days}
                onValueChange={(value) => handleChange('working_days', value)}
              >
                <SelectTrigger className="w-[300px]">
                  <SelectValue placeholder="Select working days" />
                </SelectTrigger>
                <SelectContent>
                  {optionsData?.working_days.options.map((wd) => (
                    <SelectItem key={wd.code} value={wd.code}>
                      {wd.label}
                    </SelectItem>
                  )) || (
                    <>
                      <SelectItem value="mon-fri">Monday - Friday</SelectItem>
                      <SelectItem value="mon-sat">Monday - Saturday</SelectItem>
                      <SelectItem value="sun-thu">Sunday - Thursday</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
            <Separator />
            <div className="space-y-2">
              <Label>Week Starts On</Label>
              <p className="text-sm text-muted-foreground">
                First day of the week in calendars
              </p>
              <Select
                value={formData.week_start}
                onValueChange={(value) => handleChange('week_start', value)}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Select day" />
                </SelectTrigger>
                <SelectContent>
                  {optionsData?.week_start.options.map((ws) => (
                    <SelectItem key={ws.code} value={ws.code}>
                      {ws.label}
                    </SelectItem>
                  )) || (
                    <>
                      <SelectItem value="sunday">Sunday</SelectItem>
                      <SelectItem value="monday">Monday</SelectItem>
                      <SelectItem value="saturday">Saturday</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Security Settings Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Security Settings
            </CardTitle>
            <CardDescription>
              Session and security preferences
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Session Timeout</Label>
              <p className="text-sm text-muted-foreground">
                How long users stay logged in without activity
              </p>
              <Select
                value={formData.session_timeout}
                onValueChange={(value) => handleChange('session_timeout', value)}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Select timeout" />
                </SelectTrigger>
                <SelectContent>
                  {optionsData?.session_timeouts.options.map((st) => (
                    <SelectItem key={st.code} value={st.code}>
                      {st.label}
                    </SelectItem>
                  )) || (
                    <>
                      <SelectItem value="30">30 minutes</SelectItem>
                      <SelectItem value="60">1 hour</SelectItem>
                      <SelectItem value="120">2 hours</SelectItem>
                      <SelectItem value="240">4 hours</SelectItem>
                      <SelectItem value="480">8 hours</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Maximum allowed by platform policy: {optionsData?.session_timeouts?.platform_max_minutes 
                  ? `${Math.floor(optionsData.session_timeouts.platform_max_minutes / 60)} hours` 
                  : '8 hours'}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Notification Settings Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Notification Settings
            </CardTitle>
            <CardDescription>
              Configure system-wide notification preferences
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Email Notifications</Label>
                <p className="text-sm text-muted-foreground">
                  Send email notifications for claim updates
                </p>
              </div>
              <Switch
                checked={formData.email_notifications}
                onCheckedChange={(checked) => handleChange('email_notifications', checked)}
              />
            </div>
            <div className="space-y-2">
              <Label>Notification Email</Label>
              <Input
                placeholder="noreply@company.com"
                value={formData.notification_email}
                onChange={(e) => handleChange('notification_email', e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Spacer to prevent overlap with floating save bar */}
        {hasChanges && <div className="h-20" />}

        {/* Floating save bar at bottom when changes exist */}
        {hasChanges && (
          <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur border-t p-4 flex justify-end gap-2 z-50">
            <div className="container mx-auto flex justify-between items-center">
              <p className="text-sm text-muted-foreground">
                You have unsaved changes
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleCancel}
                  disabled={saveMutation.isPending}
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={saveMutation.isPending}
                >
                  {saveMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Save Changes
                </Button>
              </div>
            </div>
          </div>
        )}
          </div>
        </TabsContent>

        {/* Integrations Tab */}
        <TabsContent value="integrations" className="space-y-4 mt-6">
          <CommunicationIntegrations tenantId={user?.tenant_id || ''} />
        </TabsContent>

        {/* Branding Settings Tab */}
        <TabsContent value="branding" className="space-y-4 mt-6">
          {/* Save/Cancel buttons for branding */}
          {hasBrandingChanges && (
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={handleCancelBranding}
                disabled={updateColorsMutation.isPending || updateSettingsMutation.isPending}
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button
                onClick={() => {
                  handleSaveBrandingColors();
                  handleSaveBrandingSettings();
                }}
                disabled={updateColorsMutation.isPending || updateSettingsMutation.isPending}
              >
                {(updateColorsMutation.isPending || updateSettingsMutation.isPending) ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save Changes
              </Button>
            </div>
          )}

          {brandingLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-2">Loading branding settings...</span>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Logo Files Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Image className="h-5 w-5" />
                    Logo Files
                  </CardTitle>
                  <CardDescription>
                    Upload your organization's logos and branding images
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-6 md:grid-cols-2">
                    {Object.entries(BRANDING_FILE_SPECS).map(([fileType, spec]) => {
                      // Map fileType to branding field name
                      const urlKey = `${fileType}_url` as keyof typeof brandingData.branding;
                      const currentUrl = brandingData?.branding?.[urlKey] as string | null;
                      return (
                        <BrandingFileUpload
                          key={fileType}
                          fileType={fileType}
                          spec={spec}
                          currentUrl={currentUrl || null}
                          tenantId={user?.tenantId || ''}
                          onUploadSuccess={() => refetchBranding()}
                        />
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Brand Colors Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Palette className="h-5 w-5" />
                    Brand Colors
                  </CardTitle>
                  <CardDescription>
                    Customize your organization's color scheme
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-6 md:grid-cols-3">
                    <div className="space-y-3">
                      <Label>Primary Color</Label>
                      <div className="flex items-center gap-3">
                        <input
                          type="color"
                          value={brandingColors.primary_color}
                          onChange={(e) => setBrandingColors(prev => ({ ...prev, primary_color: e.target.value }))}
                          className="h-10 w-14 cursor-pointer rounded border"
                        />
                        <Input
                          value={brandingColors.primary_color}
                          onChange={(e) => setBrandingColors(prev => ({ ...prev, primary_color: e.target.value }))}
                          className="font-mono"
                          placeholder="#3B82F6"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">Used for primary buttons and key actions</p>
                    </div>
                    <div className="space-y-3">
                      <Label>Secondary Color</Label>
                      <div className="flex items-center gap-3">
                        <input
                          type="color"
                          value={brandingColors.secondary_color}
                          onChange={(e) => setBrandingColors(prev => ({ ...prev, secondary_color: e.target.value }))}
                          className="h-10 w-14 cursor-pointer rounded border"
                        />
                        <Input
                          value={brandingColors.secondary_color}
                          onChange={(e) => setBrandingColors(prev => ({ ...prev, secondary_color: e.target.value }))}
                          className="font-mono"
                          placeholder="#10B981"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">Used for secondary elements and success states</p>
                    </div>
                    <div className="space-y-3">
                      <Label>Accent Color</Label>
                      <div className="flex items-center gap-3">
                        <input
                          type="color"
                          value={brandingColors.accent_color}
                          onChange={(e) => setBrandingColors(prev => ({ ...prev, accent_color: e.target.value }))}
                          className="h-10 w-14 cursor-pointer rounded border"
                        />
                        <Input
                          value={brandingColors.accent_color}
                          onChange={(e) => setBrandingColors(prev => ({ ...prev, accent_color: e.target.value }))}
                          className="font-mono"
                          placeholder="#F59E0B"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">Used for highlights and warnings</p>
                    </div>
                  </div>

                  {/* Color Preview */}
                  <div className="pt-4 border-t">
                    <Label className="mb-3 block">Color Preview</Label>
                    <div className="flex gap-4 items-center">
                      <div
                        className="h-12 w-24 rounded-lg flex items-center justify-center text-white text-sm font-medium"
                        style={{ backgroundColor: brandingColors.primary_color }}
                      >
                        Primary
                      </div>
                      <div
                        className="h-12 w-24 rounded-lg flex items-center justify-center text-white text-sm font-medium"
                        style={{ backgroundColor: brandingColors.secondary_color }}
                      >
                        Secondary
                      </div>
                      <div
                        className="h-12 w-24 rounded-lg flex items-center justify-center text-white text-sm font-medium"
                        style={{ backgroundColor: brandingColors.accent_color }}
                      >
                        Accent
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Other Branding Settings */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <SettingsIcon className="h-5 w-5" />
                    Other Settings
                  </CardTitle>
                  <CardDescription>
                    Additional branding customizations
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Company Tagline</Label>
                    <Input
                      placeholder="e.g., Simplifying expense management"
                      value={brandingTagline}
                      onChange={(e) => setBrandingTagline(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Displayed on the login page below your logo
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Floating save bar for branding */}
              {hasBrandingChanges && <div className="h-20" />}
              {hasBrandingChanges && (
                <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur border-t p-4 flex justify-end gap-2 z-50">
                  <div className="container mx-auto flex justify-between items-center">
                    <p className="text-sm text-muted-foreground">
                      You have unsaved branding changes
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={handleCancelBranding}
                        disabled={updateColorsMutation.isPending || updateSettingsMutation.isPending}
                      >
                        <X className="h-4 w-4 mr-2" />
                        Cancel
                      </Button>
                      <Button
                        onClick={() => {
                          handleSaveBrandingColors();
                          handleSaveBrandingSettings();
                        }}
                        disabled={updateColorsMutation.isPending || updateSettingsMutation.isPending}
                      >
                        {(updateColorsMutation.isPending || updateSettingsMutation.isPending) ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4 mr-2" />
                        )}
                        Save Changes
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
