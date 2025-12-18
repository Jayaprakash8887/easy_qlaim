import { useState, useRef } from 'react';
import {
    Building2,
    Plus,
    Globe,
    Users,
    Settings,
    CheckCircle,
    XCircle,
    Edit,
    Eye,
    UserPlus,
    Shield,
    Trash2,
    Mail,
    Palette,
    Upload,
    Image,
    FileImage,
    X,
    Info
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import {
    useTenants,
    useCreateTenant,
    useUpdateTenant,
    useTenantAdmins,
    useCreateTenantAdmin,
    useRemoveTenantAdmin,
    useTenantBranding,
    useUploadBrandingFile,
    useDeleteBrandingFile,
    useUpdateBrandingColors,
    useUpdateBrandingSettings,
    Tenant,
    TenantCreate,
    BrandingFileSpec,
    BrandingSettings
} from '@/hooks/useSystemAdmin';

function TenantFormDialog({
    open,
    onOpenChange,
    tenant
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    tenant?: Tenant;
}) {
    const [formData, setFormData] = useState<TenantCreate>({
        name: tenant?.name || '',
        code: tenant?.code || '',
        domain: tenant?.domain || '',
    });

    const createTenant = useCreateTenant();
    const updateTenant = useUpdateTenant();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (tenant) {
                await updateTenant.mutateAsync({ id: tenant.id, data: formData });
                toast.success('Tenant updated successfully');
            } else {
                await createTenant.mutateAsync(formData);
                toast.success('Tenant created successfully');
            }
            onOpenChange(false);
            setFormData({ name: '', code: '', domain: '' });
        } catch (error: any) {
            toast.error(error.message || 'Operation failed');
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>{tenant ? 'Edit Tenant' : 'Create New Tenant'}</DialogTitle>
                    <DialogDescription>
                        {tenant ? 'Update tenant details below.' : 'Add a new organization to the platform.'}
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit}>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="name">Organization Name *</Label>
                            <Input
                                id="name"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="Acme Corporation"
                                required
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="code">Tenant Code *</Label>
                            <Input
                                id="code"
                                value={formData.code}
                                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                                placeholder="ACME"
                                maxLength={20}
                                required
                                disabled={!!tenant}
                            />
                            <p className="text-xs text-muted-foreground">
                                Unique identifier for the tenant (max 20 characters)
                            </p>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="domain">Email Domain</Label>
                            <Input
                                id="domain"
                                value={formData.domain || ''}
                                onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                                placeholder="acme.com"
                            />
                            <p className="text-xs text-muted-foreground">
                                Optional: Auto-associate users with this email domain
                            </p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={createTenant.isPending || updateTenant.isPending}
                        >
                            {createTenant.isPending || updateTenant.isPending ? 'Saving...' : tenant ? 'Update' : 'Create'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function TenantUsersDialog({ tenant }: { tenant: Tenant }) {
    const [open, setOpen] = useState(false);
    const [showAddAdmin, setShowAddAdmin] = useState(false);
    const [adminEmail, setAdminEmail] = useState('');
    
    const { data: admins, isLoading } = useTenantAdmins(tenant.id);
    const createAdminMutation = useCreateTenantAdmin();
    const removeAdminMutation = useRemoveTenantAdmin();

    const handleAddAdmin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!adminEmail.trim()) return;
        
        try {
            const result = await createAdminMutation.mutateAsync({ 
                tenantId: tenant.id, 
                email: adminEmail.trim() 
            });
            toast.success(result.message || 'Admin added successfully. Credentials sent via email.');
            setShowAddAdmin(false);
            setAdminEmail('');
        } catch (error: any) {
            toast.error(error.message || 'Failed to add admin');
        }
    };

    const handleRemoveAdmin = async (userId: string) => {
        try {
            await removeAdminMutation.mutateAsync({ tenantId: tenant.id, userId });
            toast.success('Admin role removed successfully');
        } catch (error: any) {
            toast.error(error.message || 'Failed to remove admin');
        }
    };

    return (
        <Dialog open={open} onOpenChange={(isOpen) => {
            setOpen(isOpen);
            if (!isOpen) {
                setShowAddAdmin(false);
                setAdminEmail('');
            }
        }}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="sm" title="Manage Tenant Admins">
                    <Shield className="h-4 w-4" />
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[700px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Shield className="h-5 w-5 text-primary" />
                        Tenant Admins - {tenant.name}
                    </DialogTitle>
                    <DialogDescription>
                        Manage administrators for this tenant organization. Admins can configure designations, policies, and other tenant settings.
                    </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4">
                    {/* Current Admins Section */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <h4 className="font-medium text-sm">Current Administrators</h4>
                            <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => setShowAddAdmin(!showAddAdmin)}
                            >
                                <UserPlus className="h-4 w-4 mr-2" />
                                Add Admin
                            </Button>
                        </div>
                        
                        <div className="max-h-[200px] overflow-y-auto border rounded-md">
                            {isLoading ? (
                                <div className="p-4 space-y-2">
                                    <Skeleton className="h-10 w-full" />
                                    <Skeleton className="h-10 w-full" />
                                </div>
                            ) : admins && admins.length > 0 ? (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Name</TableHead>
                                            <TableHead>Email</TableHead>
                                            <TableHead>Designation</TableHead>
                                            <TableHead className="w-[80px]">Action</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {admins.map((user: any) => (
                                            <TableRow key={user.id}>
                                                <TableCell className="font-medium">
                                                    {user.first_name} {user.last_name}
                                                </TableCell>
                                                <TableCell>{user.email}</TableCell>
                                                <TableCell>{user.designation || '-'}</TableCell>
                                                <TableCell>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="text-destructive hover:text-destructive"
                                                        onClick={() => handleRemoveAdmin(user.id)}
                                                        disabled={removeAdminMutation.isPending}
                                                        title="Remove Admin Role"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            ) : (
                                <p className="text-center text-muted-foreground py-6">
                                    No administrators configured for this tenant.
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Add Admin Section */}
                    {showAddAdmin && (
                        <div className="border-t pt-4">
                            <h4 className="font-medium text-sm mb-3">Add New Administrator</h4>
                            <form onSubmit={handleAddAdmin} className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="admin-email">Email Address</Label>
                                    <Input
                                        id="admin-email"
                                        type="email"
                                        placeholder="admin@company.com"
                                        value={adminEmail}
                                        onChange={(e) => setAdminEmail(e.target.value)}
                                        required
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Enter the email address for the new administrator. If the user doesn't exist, a new account will be created and login credentials will be sent to this email.
                                    </p>
                                </div>
                                <div className="flex gap-2">
                                    <Button 
                                        type="submit" 
                                        disabled={createAdminMutation.isPending || !adminEmail.trim()}
                                    >
                                        {createAdminMutation.isPending ? 'Adding...' : 'Add Administrator'}
                                    </Button>
                                    <Button 
                                        type="button" 
                                        variant="outline" 
                                        onClick={() => {
                                            setShowAddAdmin(false);
                                            setAdminEmail('');
                                        }}
                                    >
                                        Cancel
                                    </Button>
                                </div>
                            </form>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

// ==================== BRANDING DIALOG ====================

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

        // Validate file extension
        const ext = file.name.toLowerCase().split('.').pop();
        if (!ext || !spec.formats.includes(ext)) {
            toast.error(`Invalid file format. Allowed: ${spec.formats.join(', ').toUpperCase()}`);
            return;
        }

        // Validate file size
        const maxBytes = spec.max_size_mb * 1024 * 1024;
        if (file.size > maxBytes) {
            toast.error(`File too large. Maximum size: ${spec.max_size_mb}MB`);
            return;
        }

        try {
            await uploadMutation.mutateAsync({ tenantId, fileType, file });
            toast.success(`${spec.name} uploaded successfully`);
            onUploadSuccess();
        } catch (error: any) {
            toast.error(error.message || 'Failed to upload file');
        }

        // Reset input
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleDelete = async () => {
        if (!currentUrl) return;
        
        try {
            await deleteMutation.mutateAsync({ tenantId, fileType });
            toast.success(`${spec.name} deleted successfully`);
            onUploadSuccess();
        } catch (error: any) {
            toast.error(error.message || 'Failed to delete file');
        }
    };

    const acceptedFormats = spec.formats.map(f => `.${f}`).join(',');

    return (
        <div className="border rounded-lg p-4 space-y-3">
            <div className="flex items-start justify-between">
                <div>
                    <h4 className="font-medium flex items-center gap-2">
                        {spec.name}
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
                    </h4>
                    <p className="text-sm text-muted-foreground">{spec.description}</p>
                </div>
                {currentUrl && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleDelete}
                        disabled={deleteMutation.isPending}
                        className="text-destructive hover:text-destructive"
                    >
                        <X className="h-4 w-4" />
                    </Button>
                )}
            </div>

            {/* File specs */}
            <div className="text-xs text-muted-foreground space-y-1">
                <p><strong>Formats:</strong> {spec.formats.join(', ').toUpperCase()}</p>
                <p><strong>Max size:</strong> {spec.max_size_mb}MB</p>
                <p><strong>Recommended:</strong> {spec.recommended_dimensions}</p>
            </div>

            {/* Preview or Upload */}
            {currentUrl ? (
                <div className="space-y-2">
                    <div className="flex items-center justify-center bg-muted/30 rounded-md p-4 min-h-[80px]">
                        {fileType === 'login_background' ? (
                            <img
                                src={`http://localhost:8000${currentUrl}`}
                                alt={spec.name}
                                className="max-h-20 max-w-full object-contain rounded"
                            />
                        ) : (
                            <img
                                src={`http://localhost:8000${currentUrl}`}
                                alt={spec.name}
                                className="max-h-16 max-w-full object-contain"
                            />
                        )}
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadMutation.isPending}
                    >
                        {uploadMutation.isPending ? 'Uploading...' : 'Replace File'}
                    </Button>
                </div>
            ) : (
                <div
                    className="border-2 border-dashed rounded-md p-4 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                >
                    <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">
                        {uploadMutation.isPending ? 'Uploading...' : 'Click to upload'}
                    </p>
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

function TenantBrandingDialog({ tenant }: { tenant: Tenant }) {
    const [open, setOpen] = useState(false);
    const { data: brandingData, isLoading, refetch } = useTenantBranding(tenant.id);
    const updateColorsMutation = useUpdateBrandingColors();
    const updateSettingsMutation = useUpdateBrandingSettings();

    const [colors, setColors] = useState({
        primary_color: '',
        secondary_color: '',
        accent_color: ''
    });

    const [tagline, setTagline] = useState('');

    // Update local state when branding data loads
    const handleDialogChange = (isOpen: boolean) => {
        setOpen(isOpen);
        if (isOpen && brandingData) {
            setColors({
                primary_color: brandingData.branding.primary_color || '',
                secondary_color: brandingData.branding.secondary_color || '',
                accent_color: brandingData.branding.accent_color || ''
            });
            setTagline(brandingData.branding.company_tagline || '');
        }
    };

    const handleSaveColors = async () => {
        try {
            const colorData: any = {};
            if (colors.primary_color) colorData.primary_color = colors.primary_color;
            if (colors.secondary_color) colorData.secondary_color = colors.secondary_color;
            if (colors.accent_color) colorData.accent_color = colors.accent_color;

            await updateColorsMutation.mutateAsync({ tenantId: tenant.id, colors: colorData });
            toast.success('Brand colors updated successfully');
        } catch (error: any) {
            toast.error(error.message || 'Failed to update colors');
        }
    };

    const handleSaveSettings = async () => {
        try {
            await updateSettingsMutation.mutateAsync({
                tenantId: tenant.id,
                settings: { company_tagline: tagline }
            });
            toast.success('Branding settings updated successfully');
        } catch (error: any) {
            toast.error(error.message || 'Failed to update settings');
        }
    };

    return (
        <Dialog open={open} onOpenChange={handleDialogChange}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="sm" title="Branding Settings">
                    <Palette className="h-4 w-4" />
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Palette className="h-5 w-5 text-primary" />
                        Branding Settings - {tenant.name}
                    </DialogTitle>
                    <DialogDescription>
                        Configure custom branding for this tenant including logos, colors, and other visual elements.
                    </DialogDescription>
                </DialogHeader>

                {isLoading ? (
                    <div className="space-y-4 py-4">
                        <Skeleton className="h-32 w-full" />
                        <Skeleton className="h-32 w-full" />
                    </div>
                ) : (
                    <Tabs defaultValue="logos" className="w-full">
                        <TabsList className="grid w-full grid-cols-3">
                            <TabsTrigger value="logos" className="gap-2">
                                <Image className="h-4 w-4" />
                                Logos
                            </TabsTrigger>
                            <TabsTrigger value="colors" className="gap-2">
                                <Palette className="h-4 w-4" />
                                Colors
                            </TabsTrigger>
                            <TabsTrigger value="other" className="gap-2">
                                <Settings className="h-4 w-4" />
                                Other
                            </TabsTrigger>
                        </TabsList>

                        {/* Logos Tab */}
                        <TabsContent value="logos" className="space-y-4 mt-4">
                            <div className="grid gap-4 md:grid-cols-2">
                                <BrandingFileUpload
                                    fileType="logo"
                                    spec={BRANDING_FILE_SPECS.logo}
                                    currentUrl={brandingData?.branding.logo_url || null}
                                    tenantId={tenant.id}
                                    onUploadSuccess={() => refetch()}
                                />
                                <BrandingFileUpload
                                    fileType="logo_mark"
                                    spec={BRANDING_FILE_SPECS.logo_mark}
                                    currentUrl={brandingData?.branding.logo_mark_url || null}
                                    tenantId={tenant.id}
                                    onUploadSuccess={() => refetch()}
                                />
                                <BrandingFileUpload
                                    fileType="favicon"
                                    spec={BRANDING_FILE_SPECS.favicon}
                                    currentUrl={brandingData?.branding.favicon_url || null}
                                    tenantId={tenant.id}
                                    onUploadSuccess={() => refetch()}
                                />
                                <BrandingFileUpload
                                    fileType="login_background"
                                    spec={BRANDING_FILE_SPECS.login_background}
                                    currentUrl={brandingData?.branding.login_background_url || null}
                                    tenantId={tenant.id}
                                    onUploadSuccess={() => refetch()}
                                />
                            </div>
                        </TabsContent>

                        {/* Colors Tab */}
                        <TabsContent value="colors" className="space-y-4 mt-4">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-lg">Brand Colors</CardTitle>
                                    <CardDescription>
                                        Define the primary, secondary, and accent colors for the tenant's UI.
                                        Colors should be in hex format (e.g., #00928F).
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="grid gap-4 md:grid-cols-3">
                                        <div className="space-y-2">
                                            <Label htmlFor="primary">Primary Color</Label>
                                            <div className="flex gap-2">
                                                <div
                                                    className="w-10 h-10 rounded border cursor-pointer"
                                                    style={{ backgroundColor: colors.primary_color || '#ccc' }}
                                                    onClick={() => document.getElementById('primary-picker')?.click()}
                                                />
                                                <Input
                                                    id="primary"
                                                    value={colors.primary_color}
                                                    onChange={(e) => setColors({ ...colors, primary_color: e.target.value })}
                                                    placeholder="#00928F"
                                                />
                                                <input
                                                    id="primary-picker"
                                                    type="color"
                                                    value={colors.primary_color || '#00928F'}
                                                    onChange={(e) => setColors({ ...colors, primary_color: e.target.value })}
                                                    className="sr-only"
                                                />
                                            </div>
                                            <p className="text-xs text-muted-foreground">Main brand color (buttons, links)</p>
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="secondary">Secondary Color</Label>
                                            <div className="flex gap-2">
                                                <div
                                                    className="w-10 h-10 rounded border cursor-pointer"
                                                    style={{ backgroundColor: colors.secondary_color || '#ccc' }}
                                                    onClick={() => document.getElementById('secondary-picker')?.click()}
                                                />
                                                <Input
                                                    id="secondary"
                                                    value={colors.secondary_color}
                                                    onChange={(e) => setColors({ ...colors, secondary_color: e.target.value })}
                                                    placeholder="#13283E"
                                                />
                                                <input
                                                    id="secondary-picker"
                                                    type="color"
                                                    value={colors.secondary_color || '#13283E'}
                                                    onChange={(e) => setColors({ ...colors, secondary_color: e.target.value })}
                                                    className="sr-only"
                                                />
                                            </div>
                                            <p className="text-xs text-muted-foreground">Secondary color (sidebar, headers)</p>
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="accent">Accent Color</Label>
                                            <div className="flex gap-2">
                                                <div
                                                    className="w-10 h-10 rounded border cursor-pointer"
                                                    style={{ backgroundColor: colors.accent_color || '#ccc' }}
                                                    onClick={() => document.getElementById('accent-picker')?.click()}
                                                />
                                                <Input
                                                    id="accent"
                                                    value={colors.accent_color}
                                                    onChange={(e) => setColors({ ...colors, accent_color: e.target.value })}
                                                    placeholder="#1E3754"
                                                />
                                                <input
                                                    id="accent-picker"
                                                    type="color"
                                                    value={colors.accent_color || '#1E3754'}
                                                    onChange={(e) => setColors({ ...colors, accent_color: e.target.value })}
                                                    className="sr-only"
                                                />
                                            </div>
                                            <p className="text-xs text-muted-foreground">Accent color (highlights, focus)</p>
                                        </div>
                                    </div>

                                    {/* Color Preview */}
                                    {(colors.primary_color || colors.secondary_color) && (
                                        <div className="mt-6 p-4 rounded-lg border">
                                            <p className="text-sm font-medium mb-3">Preview</p>
                                            <div className="flex gap-4 items-center">
                                                <div 
                                                    className="px-4 py-2 rounded text-white text-sm"
                                                    style={{ backgroundColor: colors.primary_color || '#00928F' }}
                                                >
                                                    Primary Button
                                                </div>
                                                <div 
                                                    className="px-4 py-2 rounded text-white text-sm"
                                                    style={{ backgroundColor: colors.secondary_color || '#13283E' }}
                                                >
                                                    Secondary
                                                </div>
                                                {colors.accent_color && (
                                                    <div 
                                                        className="px-4 py-2 rounded text-white text-sm"
                                                        style={{ backgroundColor: colors.accent_color }}
                                                    >
                                                        Accent
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex justify-end">
                                        <Button
                                            onClick={handleSaveColors}
                                            disabled={updateColorsMutation.isPending}
                                        >
                                            {updateColorsMutation.isPending ? 'Saving...' : 'Save Colors'}
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        {/* Other Settings Tab */}
                        <TabsContent value="other" className="space-y-4 mt-4">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-lg">Additional Branding</CardTitle>
                                    <CardDescription>
                                        Configure additional branding elements like taglines and custom styling.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="tagline">Company Tagline</Label>
                                        <Input
                                            id="tagline"
                                            value={tagline}
                                            onChange={(e) => setTagline(e.target.value)}
                                            placeholder="Smart Claims Settlement Made Easy"
                                        />
                                        <p className="text-xs text-muted-foreground">
                                            Displayed on the login page below the logo
                                        </p>
                                    </div>

                                    <div className="flex justify-end">
                                        <Button
                                            onClick={handleSaveSettings}
                                            disabled={updateSettingsMutation.isPending}
                                        >
                                            {updateSettingsMutation.isPending ? 'Saving...' : 'Save Settings'}
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* File Requirements Summary */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-lg">File Requirements Summary</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Asset</TableHead>
                                                <TableHead>Formats</TableHead>
                                                <TableHead>Max Size</TableHead>
                                                <TableHead>Recommended Size</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {Object.entries(BRANDING_FILE_SPECS).map(([key, spec]) => (
                                                <TableRow key={key}>
                                                    <TableCell className="font-medium">{spec.name}</TableCell>
                                                    <TableCell>
                                                        {spec.formats.map(f => (
                                                            <Badge key={f} variant="outline" className="mr-1">
                                                                {f.toUpperCase()}
                                                            </Badge>
                                                        ))}
                                                    </TableCell>
                                                    <TableCell>{spec.max_size_mb}MB</TableCell>
                                                    <TableCell className="text-sm text-muted-foreground">
                                                        {spec.recommended_dimensions}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </CardContent>
                            </Card>
                        </TabsContent>
                    </Tabs>
                )}
            </DialogContent>
        </Dialog>
    );
}

export default function Tenants() {
    const [showInactive, setShowInactive] = useState(false);
    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    const [editTenant, setEditTenant] = useState<Tenant | undefined>();

    const { data: tenants, isLoading, error } = useTenants(showInactive);
    const updateTenant = useUpdateTenant();

    const handleToggleActive = async (tenant: Tenant) => {
        try {
            await updateTenant.mutateAsync({
                id: tenant.id,
                data: { is_active: !tenant.is_active }
            });
            toast.success(`Tenant ${tenant.is_active ? 'deactivated' : 'activated'} successfully`);
        } catch (error) {
            toast.error('Failed to update tenant status');
        }
    };

    if (error) {
        return (
            <div className="p-6">
                <Card className="border-destructive">
                    <CardContent className="pt-6">
                        <p className="text-destructive">Error loading tenants: {(error as Error).message}</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-6 p-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                        <Building2 className="h-8 w-8 text-primary" />
                        Tenant Management
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Manage organizations using the platform
                    </p>
                </div>
                <Button onClick={() => setCreateDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Tenant
                </Button>
            </div>

            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Tenants</CardTitle>
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{tenants?.length || 0}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Active Tenants</CardTitle>
                        <CheckCircle className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">
                            {tenants?.filter(t => t.is_active).length || 0}
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Inactive Tenants</CardTitle>
                        <XCircle className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-muted-foreground">
                            {tenants?.filter(t => !t.is_active).length || 0}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Tenants Table */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle>Organizations</CardTitle>
                        <div className="flex items-center gap-2">
                            <Label htmlFor="showInactive" className="text-sm">Show inactive</Label>
                            <input
                                id="showInactive"
                                type="checkbox"
                                checked={showInactive}
                                onChange={(e) => setShowInactive(e.target.checked)}
                                className="rounded border-gray-300"
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="space-y-3">
                            <Skeleton className="h-12 w-full" />
                            <Skeleton className="h-12 w-full" />
                            <Skeleton className="h-12 w-full" />
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Organization</TableHead>
                                    <TableHead>Code</TableHead>
                                    <TableHead>Domain</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Created</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {tenants?.map((tenant) => (
                                    <TableRow key={tenant.id}>
                                        <TableCell className="font-medium">{tenant.name}</TableCell>
                                        <TableCell>
                                            <Badge variant="outline">{tenant.code}</Badge>
                                        </TableCell>
                                        <TableCell>
                                            {tenant.domain ? (
                                                <span className="flex items-center gap-1">
                                                    <Globe className="h-3 w-3" />
                                                    {tenant.domain}
                                                </span>
                                            ) : (
                                                <span className="text-muted-foreground">-</span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {tenant.is_active ? (
                                                <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                                                    Active
                                                </Badge>
                                            ) : (
                                                <Badge variant="secondary">Inactive</Badge>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {new Date(tenant.created_at).toLocaleDateString()}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <TenantBrandingDialog tenant={tenant} />
                                                <TenantUsersDialog tenant={tenant} />
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => setEditTenant(tenant)}
                                                    title="Edit Tenant"
                                                >
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleToggleActive(tenant)}
                                                    title={tenant.is_active ? 'Deactivate' : 'Activate'}
                                                >
                                                    {tenant.is_active ? (
                                                        <XCircle className="h-4 w-4 text-destructive" />
                                                    ) : (
                                                        <CheckCircle className="h-4 w-4 text-green-500" />
                                                    )}
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {(!tenants || tenants.length === 0) && (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                            No tenants found. Click "Add Tenant" to create one.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* Create Dialog */}
            <TenantFormDialog
                open={createDialogOpen}
                onOpenChange={setCreateDialogOpen}
            />

            {/* Edit Dialog */}
            {editTenant && (
                <TenantFormDialog
                    open={!!editTenant}
                    onOpenChange={(open) => !open && setEditTenant(undefined)}
                    tenant={editTenant}
                />
            )}
        </div>
    );
}
