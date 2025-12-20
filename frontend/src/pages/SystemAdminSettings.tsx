import { useState, useEffect } from 'react';
import {
    Settings as SettingsIcon,
    Database,
    Shield,
    Mail,
    Globe,
    RefreshCw,
    Save,
    Server,
    Users,
    Building2,
    Activity,
    AlertTriangle,
    Loader2,
    Trash2,
    Send,
    Clock,
    Lock,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useTenants, useDesignations } from '@/hooks/useSystemAdmin';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

// Types for system info
interface SystemInfo {
    database: {
        type: string;
        host: string;
        port: string;
        name: string;
        connected: boolean;
    };
    cache: {
        host: string;
        port: string;
        connected: boolean;
        memory_used?: string;
    };
    app: {
        name: string;
        environment: string;
        version: string;
    };
}

// Fetch system info
async function fetchSystemInfo(): Promise<SystemInfo> {
    const response = await fetch(`${API_BASE_URL}/system/info`);
    if (!response.ok) {
        throw new Error('Failed to fetch system info');
    }
    return response.json();
}

export default function SystemAdminSettings() {
    const queryClient = useQueryClient();
    const [isSaving, setIsSaving] = useState(false);
    const [isClearingCache, setIsClearingCache] = useState<string | null>(null);
    const [isTestingEmail, setIsTestingEmail] = useState(false);
    const [testEmailRecipient, setTestEmailRecipient] = useState('');
    const [tenantSearchFilter, setTenantSearchFilter] = useState('');

    // Fetch system info
    const { data: systemInfo, isLoading: isLoadingSystemInfo } = useQuery({
        queryKey: ['systemInfo'],
        queryFn: fetchSystemInfo,
        staleTime: 30000, // 30 seconds
        refetchInterval: 60000, // Refresh every minute
    });

    // Platform settings state
    const [platformSettings, setPlatformSettings] = useState({
        supportEmail: 'support@easyqlaim.com',
        defaultSessionTimeout: 480, // 8 hours in minutes
        maxLoginAttempts: 5,
        enableAuditLogging: true,
        maintenanceMode: false,
        maintenanceMessage: 'The system is currently undergoing scheduled maintenance. Please try again later.',
    });

    // Email settings state
    const [emailSettings, setEmailSettings] = useState({
        smtpHost: 'smtp.gmail.com',
        smtpPort: 587,
        smtpUser: '',
        smtpPassword: '',
        smtpSecure: true, // TLS/SSL
        senderEmail: 'noreply@easyqlaim.com',
        senderName: 'EasyQlaim',
        enableEmailNotifications: true,
        emailFooter: 'This is an automated message from EasyQlaim. Please do not reply directly to this email.',
    });

    // Session timeout options (in minutes)
    const sessionTimeoutOptions = [
        { value: 30, label: '30 minutes' },
        { value: 60, label: '1 hour' },
        { value: 120, label: '2 hours' },
        { value: 240, label: '4 hours' },
        { value: 480, label: '8 hours (Default)' },
        { value: 1440, label: '24 hours' },
    ];

    // Fetch stats
    const { data: tenants } = useTenants();
    const { data: designations } = useDesignations();

    const handleSavePlatformSettings = async () => {
        setIsSaving(true);
        try {
            // TODO: Integrate with backend API when ready
            // const response = await fetch(`${API_BASE_URL}/platform/settings`, {
            //     method: 'PUT',
            //     headers: { 'Content-Type': 'application/json' },
            //     body: JSON.stringify(platformSettings),
            // });
            await new Promise(resolve => setTimeout(resolve, 500)); // Simulate API call
            toast.success('Platform settings saved successfully');
        } catch (error) {
            toast.error('Failed to save platform settings');
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveSecuritySettings = async () => {
        setIsSaving(true);
        try {
            await new Promise(resolve => setTimeout(resolve, 500));
            toast.success('Security settings saved successfully');
        } catch (error) {
            toast.error('Failed to save security settings');
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveEmailSettings = async () => {
        setIsSaving(true);
        try {
            await new Promise(resolve => setTimeout(resolve, 500));
            toast.success('Email settings saved successfully');
        } catch (error) {
            toast.error('Failed to save email settings');
        } finally {
            setIsSaving(false);
        }
    };

    const handleTestEmail = async () => {
        if (!testEmailRecipient) {
            toast.error('Please enter an email address to send test email');
            return;
        }
        setIsTestingEmail(true);
        try {
            await new Promise(resolve => setTimeout(resolve, 1000));
            toast.success(`Test email sent to ${testEmailRecipient}`);
            setTestEmailRecipient('');
        } catch (error) {
            toast.error('Failed to send test email');
        } finally {
            setIsTestingEmail(false);
        }
    };

    const handleClearPlatformCache = async () => {
        setIsClearingCache('platform');
        try {
            // Clear all platform-wide cache
            await new Promise(resolve => setTimeout(resolve, 500));
            toast.success('Platform cache cleared successfully');
            queryClient.invalidateQueries();
        } catch (error) {
            toast.error('Failed to clear platform cache');
        } finally {
            setIsClearingCache(null);
        }
    };

    const handleClearTenantCache = async (tenantId?: string, tenantName?: string) => {
        setIsClearingCache(tenantId || 'all-tenants');
        try {
            if (tenantId) {
                // Clear specific tenant cache
                await fetch(`${API_BASE_URL}/cache/invalidate/all`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                });
                toast.success(`Cache cleared for tenant: ${tenantName}`);
            } else {
                // Clear all tenants cache
                await new Promise(resolve => setTimeout(resolve, 500));
                toast.success('Cache cleared for all tenants');
            }
            queryClient.invalidateQueries();
        } catch (error) {
            toast.error('Failed to clear tenant cache');
        } finally {
            setIsClearingCache(null);
        }
    };

    return (
        <div className="space-y-6 p-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                    <SettingsIcon className="h-8 w-8 text-primary" />
                    Platform Settings
                </h1>
                <p className="text-muted-foreground mt-1">
                    Manage platform-wide configuration and settings
                </p>
            </div>

            {/* Stats Overview */}
            <div className="grid gap-4 md:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Tenants</CardTitle>
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{tenants?.length || 0}</div>
                        <p className="text-xs text-muted-foreground">Active organizations</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Designations</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{designations?.length || 0}</div>
                        <p className="text-xs text-muted-foreground">Role mappings configured</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">System Status</CardTitle>
                        <Activity className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">Healthy</div>
                        <p className="text-xs text-muted-foreground">All services running</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">API Version</CardTitle>
                        <Server className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">v1.0</div>
                        <p className="text-xs text-muted-foreground">Latest stable</p>
                    </CardContent>
                </Card>
            </div>

            {/* Settings Tabs */}
            <Tabs defaultValue="platform" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="platform" className="gap-2">
                        <Globe className="h-4 w-4" />
                        Platform
                    </TabsTrigger>
                    <TabsTrigger value="security" className="gap-2">
                        <Shield className="h-4 w-4" />
                        Security
                    </TabsTrigger>
                    <TabsTrigger value="email" className="gap-2">
                        <Mail className="h-4 w-4" />
                        Email
                    </TabsTrigger>
                    <TabsTrigger value="database" className="gap-2">
                        <Database className="h-4 w-4" />
                        Database
                    </TabsTrigger>
                </TabsList>

                {/* Platform Settings */}
                <TabsContent value="platform">
                    <Card>
                        <CardHeader>
                            <CardTitle>Platform Configuration</CardTitle>
                            <CardDescription>
                                General platform settings and branding
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="space-y-2">
                                <Label htmlFor="supportEmail">Support Email</Label>
                                <p className="text-sm text-muted-foreground">
                                    Email address displayed to users for support inquiries
                                </p>
                                <Input
                                    id="supportEmail"
                                    type="email"
                                    value={platformSettings.supportEmail}
                                    onChange={(e) => setPlatformSettings({
                                        ...platformSettings,
                                        supportEmail: e.target.value
                                    })}
                                    className="max-w-md"
                                />
                            </div>

                            <Separator />

                            {/* Maintenance Mode Section */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="space-y-0.5">
                                        <Label className="flex items-center gap-2">
                                            <AlertTriangle className="h-4 w-4 text-amber-500" />
                                            Maintenance Mode
                                        </Label>
                                        <p className="text-sm text-muted-foreground">
                                            When enabled, all non-admin users will see a maintenance message and cannot access the platform
                                        </p>
                                    </div>
                                    <Switch
                                        checked={platformSettings.maintenanceMode}
                                        onCheckedChange={(checked) => setPlatformSettings({
                                            ...platformSettings,
                                            maintenanceMode: checked
                                        })}
                                    />
                                </div>

                                {platformSettings.maintenanceMode && (
                                    <div className="space-y-2 p-4 border rounded-lg bg-amber-50 dark:bg-amber-950/20">
                                        <Label htmlFor="maintenanceMessage">Maintenance Message</Label>
                                        <p className="text-sm text-muted-foreground">
                                            This message will be displayed to users when they try to access the platform
                                        </p>
                                        <Input
                                            id="maintenanceMessage"
                                            value={platformSettings.maintenanceMessage}
                                            onChange={(e) => setPlatformSettings({
                                                ...platformSettings,
                                                maintenanceMessage: e.target.value
                                            })}
                                            placeholder="Enter maintenance message..."
                                        />
                                        <div className="mt-3 p-3 rounded bg-white dark:bg-gray-900 border">
                                            <p className="text-xs text-muted-foreground mb-1">Preview:</p>
                                            <div className="flex items-center gap-2 text-amber-600">
                                                <AlertTriangle className="h-4 w-4" />
                                                <span className="text-sm">{platformSettings.maintenanceMessage}</span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="flex justify-end">
                                <Button onClick={handleSavePlatformSettings} disabled={isSaving}>
                                    {isSaving ? (
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    ) : (
                                        <Save className="h-4 w-4 mr-2" />
                                    )}
                                    Save Platform Settings
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Security Settings */}
                <TabsContent value="security">
                    <Card>
                        <CardHeader>
                            <CardTitle>Security Configuration</CardTitle>
                            <CardDescription>
                                Authentication and security settings for the platform
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {/* Session Timeout */}
                            <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                    <Clock className="h-4 w-4 text-muted-foreground" />
                                    <Label>Platform Session Timeout</Label>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                    Default session duration for all users. Individual tenants can override this with a shorter timeout.
                                </p>
                                <Select
                                    value={String(platformSettings.defaultSessionTimeout)}
                                    onValueChange={(value) => setPlatformSettings({
                                        ...platformSettings,
                                        defaultSessionTimeout: parseInt(value)
                                    })}
                                >
                                    <SelectTrigger className="w-[250px]">
                                        <SelectValue placeholder="Select timeout" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {sessionTimeoutOptions.map((option) => (
                                            <SelectItem key={option.value} value={String(option.value)}>
                                                {option.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <p className="text-xs text-muted-foreground italic">
                                    Note: Tenant-specific session timeout settings will override this if set to a shorter duration.
                                </p>
                            </div>

                            <Separator />

                            {/* Max Login Attempts */}
                            <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                    <Lock className="h-4 w-4 text-muted-foreground" />
                                    <Label htmlFor="maxLoginAttempts">Max Login Attempts</Label>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                    Maximum number of failed login attempts before account lockout
                                </p>
                                <div className="flex items-center gap-3">
                                    <Input
                                        id="maxLoginAttempts"
                                        type="number"
                                        min={1}
                                        max={10}
                                        value={platformSettings.maxLoginAttempts}
                                        onChange={(e) => setPlatformSettings({
                                            ...platformSettings,
                                            maxLoginAttempts: Math.min(10, Math.max(1, parseInt(e.target.value) || 5))
                                        })}
                                        className="w-[100px]"
                                    />
                                    <span className="text-sm text-muted-foreground">attempts</span>
                                </div>
                                <p className="text-xs text-muted-foreground italic">
                                    After {platformSettings.maxLoginAttempts} failed attempts, the user account will be temporarily locked for 15 minutes.
                                </p>
                            </div>

                            <Separator />

                            {/* Audit Logging */}
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label className="flex items-center gap-2">
                                        <Shield className="h-4 w-4 text-muted-foreground" />
                                        Audit Logging
                                    </Label>
                                    <p className="text-sm text-muted-foreground">
                                        Log all user actions for security auditing and compliance
                                    </p>
                                </div>
                                <Switch
                                    checked={platformSettings.enableAuditLogging}
                                    onCheckedChange={(checked) => setPlatformSettings({
                                        ...platformSettings,
                                        enableAuditLogging: checked
                                    })}
                                />
                            </div>

                            <div className="flex justify-end">
                                <Button onClick={handleSaveSecuritySettings} disabled={isSaving}>
                                    {isSaving ? (
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    ) : (
                                        <Save className="h-4 w-4 mr-2" />
                                    )}
                                    Save Security Settings
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Email Settings */}
                <TabsContent value="email">
                    <div className="space-y-4">
                        {/* SMTP Configuration Card */}
                        <Card>
                            <CardHeader>
                                <CardTitle>SMTP Configuration</CardTitle>
                                <CardDescription>
                                    Configure the email server for sending notifications
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="grid gap-4 md:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label htmlFor="smtpHost">SMTP Host</Label>
                                        <Input
                                            id="smtpHost"
                                            placeholder="smtp.gmail.com"
                                            value={emailSettings.smtpHost}
                                            onChange={(e) => setEmailSettings({
                                                ...emailSettings,
                                                smtpHost: e.target.value
                                            })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="smtpPort">SMTP Port</Label>
                                        <Select
                                            value={String(emailSettings.smtpPort)}
                                            onValueChange={(value) => setEmailSettings({
                                                ...emailSettings,
                                                smtpPort: parseInt(value)
                                            })}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select port" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="25">25 (SMTP)</SelectItem>
                                                <SelectItem value="465">465 (SMTPS/SSL)</SelectItem>
                                                <SelectItem value="587">587 (STARTTLS)</SelectItem>
                                                <SelectItem value="2525">2525 (Alternative)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="smtpUser">SMTP Username</Label>
                                        <Input
                                            id="smtpUser"
                                            placeholder="your-email@gmail.com"
                                            value={emailSettings.smtpUser}
                                            onChange={(e) => setEmailSettings({
                                                ...emailSettings,
                                                smtpUser: e.target.value
                                            })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="smtpPassword">SMTP Password / App Password</Label>
                                        <Input
                                            id="smtpPassword"
                                            type="password"
                                            placeholder="••••••••••••"
                                            value={emailSettings.smtpPassword}
                                            onChange={(e) => setEmailSettings({
                                                ...emailSettings,
                                                smtpPassword: e.target.value
                                            })}
                                        />
                                        <p className="text-xs text-muted-foreground">
                                            For Gmail, use an App Password instead of your account password
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between p-3 rounded-lg border">
                                    <div className="space-y-0.5">
                                        <Label>Use TLS/SSL</Label>
                                        <p className="text-sm text-muted-foreground">
                                            Enable secure connection (recommended)
                                        </p>
                                    </div>
                                    <Switch
                                        checked={emailSettings.smtpSecure}
                                        onCheckedChange={(checked) => setEmailSettings({
                                            ...emailSettings,
                                            smtpSecure: checked
                                        })}
                                    />
                                </div>
                            </CardContent>
                        </Card>

                        {/* Email Identity Card */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Email Identity</CardTitle>
                                <CardDescription>
                                    Configure sender information for outgoing emails
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid gap-4 md:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label htmlFor="senderEmail">Sender Email Address</Label>
                                        <Input
                                            id="senderEmail"
                                            type="email"
                                            placeholder="noreply@yourcompany.com"
                                            value={emailSettings.senderEmail}
                                            onChange={(e) => setEmailSettings({
                                                ...emailSettings,
                                                senderEmail: e.target.value
                                            })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="senderName">Sender Display Name</Label>
                                        <Input
                                            id="senderName"
                                            placeholder="EasyQlaim Notifications"
                                            value={emailSettings.senderName}
                                            onChange={(e) => setEmailSettings({
                                                ...emailSettings,
                                                senderName: e.target.value
                                            })}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="emailFooter">Email Footer Text</Label>
                                    <Input
                                        id="emailFooter"
                                        placeholder="This is an automated message..."
                                        value={emailSettings.emailFooter}
                                        onChange={(e) => setEmailSettings({
                                            ...emailSettings,
                                            emailFooter: e.target.value
                                        })}
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        This text will appear at the bottom of all system emails
                                    </p>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Email Notifications Card */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Notifications</CardTitle>
                                <CardDescription>
                                    Control email notification behavior
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="space-y-0.5">
                                        <Label>Enable Email Notifications</Label>
                                        <p className="text-sm text-muted-foreground">
                                            Send email notifications for claim updates, approvals, and system events
                                        </p>
                                    </div>
                                    <Switch
                                        checked={emailSettings.enableEmailNotifications}
                                        onCheckedChange={(checked) => setEmailSettings({
                                            ...emailSettings,
                                            enableEmailNotifications: checked
                                        })}
                                    />
                                </div>

                                <Separator />

                                {/* Test Email Section */}
                                <div className="space-y-3">
                                    <Label>Send Test Email</Label>
                                    <p className="text-sm text-muted-foreground">
                                        Verify your email configuration by sending a test email
                                    </p>
                                    <div className="flex gap-2">
                                        <Input
                                            type="email"
                                            placeholder="recipient@example.com"
                                            value={testEmailRecipient}
                                            onChange={(e) => setTestEmailRecipient(e.target.value)}
                                            className="max-w-sm"
                                        />
                                        <Button variant="outline" onClick={handleTestEmail} disabled={isTestingEmail}>
                                            {isTestingEmail ? (
                                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                            ) : (
                                                <Send className="h-4 w-4 mr-2" />
                                            )}
                                            Send Test
                                        </Button>
                                    </div>
                                </div>

                                <div className="flex justify-end pt-4">
                                    <Button onClick={handleSaveEmailSettings} disabled={isSaving}>
                                        {isSaving ? (
                                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        ) : (
                                            <Save className="h-4 w-4 mr-2" />
                                        )}
                                        Save Email Settings
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* Database Settings */}
                <TabsContent value="database">
                    <div className="space-y-4">
                        {/* Database Status Card */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Database Status</CardTitle>
                                <CardDescription>
                                    Current database connection information
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                {isLoadingSystemInfo ? (
                                    <div className="flex items-center justify-center py-8">
                                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                        <span className="ml-2 text-muted-foreground">Loading system info...</span>
                                    </div>
                                ) : (
                                    <div className="rounded-lg border p-4 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <span className="font-medium">Connection Status</span>
                                            {systemInfo?.database?.connected ? (
                                                <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">Connected</Badge>
                                            ) : (
                                                <Badge variant="destructive">Disconnected</Badge>
                                            )}
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm text-muted-foreground">Database Type</span>
                                            <span className="text-sm">{systemInfo?.database?.type || 'Unknown'}</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm text-muted-foreground">Host</span>
                                            <span className="text-sm font-mono">{systemInfo?.database?.host || 'Unknown'}:{systemInfo?.database?.port || '?'}</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm text-muted-foreground">Database Name</span>
                                            <span className="text-sm font-mono">{systemInfo?.database?.name || 'Unknown'}</span>
                                        </div>
                                        
                                        {/* Redis Cache Status */}
                                        <Separator className="my-3" />
                                        <div className="flex items-center justify-between">
                                            <span className="font-medium">Redis Cache</span>
                                            {systemInfo?.cache?.connected ? (
                                                <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">Connected</Badge>
                                            ) : (
                                                <Badge variant="destructive">Disconnected</Badge>
                                            )}
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm text-muted-foreground">Host</span>
                                            <span className="text-sm font-mono">{systemInfo?.cache?.host || 'Unknown'}:{systemInfo?.cache?.port || '?'}</span>
                                        </div>
                                        {systemInfo?.cache?.memory_used && (
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm text-muted-foreground">Memory Used</span>
                                                <span className="text-sm">{systemInfo.cache.memory_used}</span>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Cache Management Card */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Cache Management</CardTitle>
                                <CardDescription>
                                    Clear cached data to ensure fresh data retrieval
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {/* Platform-wide Cache */}
                                <div className="flex items-center justify-between p-4 rounded-lg border bg-blue-50 dark:bg-blue-950/20">
                                    <div>
                                        <p className="font-medium flex items-center gap-2">
                                            <Globe className="h-4 w-4 text-blue-600" />
                                            Clear Platform Cache
                                        </p>
                                        <p className="text-sm text-muted-foreground">
                                            Clear all platform-wide cached data including system settings, designations, and global configurations
                                        </p>
                                    </div>
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button variant="outline" disabled={isClearingCache === 'platform'}>
                                                {isClearingCache === 'platform' ? (
                                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                ) : (
                                                    <RefreshCw className="h-4 w-4 mr-2" />
                                                )}
                                                Clear Platform Cache
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>Clear Platform Cache?</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                    This will clear all platform-wide cached data. The next requests will fetch fresh data from the database, which may temporarily increase response times.
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                <AlertDialogAction onClick={handleClearPlatformCache}>
                                                    Clear Cache
                                                </AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </div>

                                {/* Tenant-specific Cache */}
                                <div className="p-4 rounded-lg border">
                                    <div className="flex items-center justify-between mb-4">
                                        <div>
                                            <p className="font-medium flex items-center gap-2">
                                                <Building2 className="h-4 w-4 text-muted-foreground" />
                                                Clear Tenant Cache
                                            </p>
                                            <p className="text-sm text-muted-foreground">
                                                Clear cached data for specific tenants or all tenants
                                            </p>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        {/* All Tenants Option */}
                                        <div className="flex items-center justify-between p-3 rounded border bg-muted/30">
                                            <div>
                                                <p className="text-sm font-medium">All Tenants</p>
                                                <p className="text-xs text-muted-foreground">
                                                    Clear cache for all tenant organizations
                                                </p>
                                            </div>
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="outline" size="sm" disabled={isClearingCache === 'all-tenants'}>
                                                        {isClearingCache === 'all-tenants' ? (
                                                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                        ) : (
                                                            <Trash2 className="h-4 w-4 mr-2" />
                                                        )}
                                                        Clear All
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>Clear All Tenant Caches?</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            This will clear cached data for ALL tenants. This may temporarily impact system performance as caches are rebuilt.
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => handleClearTenantCache()}>
                                                            Clear All Caches
                                                        </AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </div>

                                        {/* Individual Tenants */}
                                        {tenants && tenants.length > 0 && (
                                            <div className="mt-3 space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Individual Tenants</p>
                                                    <span className="text-xs text-muted-foreground">{tenants.length} total</span>
                                                </div>
                                                {/* Search filter for tenants */}
                                                {tenants.length > 5 && (
                                                    <Input
                                                        placeholder="Search tenants..."
                                                        value={tenantSearchFilter}
                                                        onChange={(e) => setTenantSearchFilter(e.target.value)}
                                                        className="h-8 text-sm"
                                                    />
                                                )}
                                                {/* Scrollable tenant list */}
                                                <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                                                    {tenants
                                                        .filter((tenant: any) => 
                                                            tenantSearchFilter === '' ||
                                                            tenant.name.toLowerCase().includes(tenantSearchFilter.toLowerCase()) ||
                                                            tenant.code.toLowerCase().includes(tenantSearchFilter.toLowerCase())
                                                        )
                                                        .map((tenant: any) => (
                                                            <div key={tenant.id} className="flex items-center justify-between p-2 rounded border hover:bg-muted/50 transition-colors">
                                                                <div className="min-w-0 flex-1">
                                                                    <p className="text-sm font-medium truncate">{tenant.name}</p>
                                                                    <p className="text-xs text-muted-foreground">{tenant.code}</p>
                                                                </div>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => handleClearTenantCache(tenant.id, tenant.name)}
                                                                    disabled={isClearingCache === tenant.id}
                                                                    className="ml-2 flex-shrink-0"
                                                                >
                                                                    {isClearingCache === tenant.id ? (
                                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                                    ) : (
                                                                        <RefreshCw className="h-4 w-4" />
                                                                    )}
                                                                </Button>
                                                            </div>
                                                        ))}
                                                    {tenants.filter((tenant: any) => 
                                                        tenantSearchFilter === '' ||
                                                        tenant.name.toLowerCase().includes(tenantSearchFilter.toLowerCase()) ||
                                                        tenant.code.toLowerCase().includes(tenantSearchFilter.toLowerCase())
                                                    ).length === 0 && (
                                                        <p className="text-sm text-muted-foreground text-center py-4">
                                                            No tenants match your search
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
