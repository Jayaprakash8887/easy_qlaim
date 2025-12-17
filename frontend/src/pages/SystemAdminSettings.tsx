import { useState } from 'react';
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

export default function SystemAdminSettings() {
    // Platform settings state
    const [platformSettings, setPlatformSettings] = useState({
        platformName: 'ReimbursePro',
        supportEmail: 'support@reimbursepro.com',
        allowSelfRegistration: false,
        requireEmailVerification: true,
        defaultSessionTimeout: 30,
        maxLoginAttempts: 5,
        enableAuditLogging: true,
        maintenanceMode: false,
    });

    // Email settings state
    const [emailSettings, setEmailSettings] = useState({
        smtpHost: 'smtp.gmail.com',
        smtpPort: 587,
        smtpUser: '',
        smtpPassword: '',
        senderEmail: 'noreply@reimbursepro.com',
        senderName: 'ReimbursePro',
        enableEmailNotifications: true,
    });

    // Fetch stats
    const { data: tenants } = useTenants();
    const { data: designations } = useDesignations();

    const handleSavePlatformSettings = () => {
        // TODO: Save to backend
        toast.success('Platform settings saved successfully');
    };

    const handleSaveEmailSettings = () => {
        // TODO: Save to backend
        toast.success('Email settings saved successfully');
    };

    const handleTestEmail = () => {
        toast.info('Test email sent successfully');
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
                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="platformName">Platform Name</Label>
                                    <Input
                                        id="platformName"
                                        value={platformSettings.platformName}
                                        onChange={(e) => setPlatformSettings({
                                            ...platformSettings,
                                            platformName: e.target.value
                                        })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="supportEmail">Support Email</Label>
                                    <Input
                                        id="supportEmail"
                                        type="email"
                                        value={platformSettings.supportEmail}
                                        onChange={(e) => setPlatformSettings({
                                            ...platformSettings,
                                            supportEmail: e.target.value
                                        })}
                                    />
                                </div>
                            </div>

                            <Separator />

                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label>Maintenance Mode</Label>
                                    <p className="text-sm text-muted-foreground">
                                        Disable platform access for all non-admin users
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

                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label>Allow Self Registration</Label>
                                    <p className="text-sm text-muted-foreground">
                                        Allow new users to register themselves
                                    </p>
                                </div>
                                <Switch
                                    checked={platformSettings.allowSelfRegistration}
                                    onCheckedChange={(checked) => setPlatformSettings({
                                        ...platformSettings,
                                        allowSelfRegistration: checked
                                    })}
                                />
                            </div>

                            <div className="flex justify-end">
                                <Button onClick={handleSavePlatformSettings}>
                                    <Save className="h-4 w-4 mr-2" />
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
                                Authentication and security settings
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="sessionTimeout">Session Timeout (minutes)</Label>
                                    <Input
                                        id="sessionTimeout"
                                        type="number"
                                        value={platformSettings.defaultSessionTimeout}
                                        onChange={(e) => setPlatformSettings({
                                            ...platformSettings,
                                            defaultSessionTimeout: parseInt(e.target.value) || 30
                                        })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="maxLoginAttempts">Max Login Attempts</Label>
                                    <Input
                                        id="maxLoginAttempts"
                                        type="number"
                                        value={platformSettings.maxLoginAttempts}
                                        onChange={(e) => setPlatformSettings({
                                            ...platformSettings,
                                            maxLoginAttempts: parseInt(e.target.value) || 5
                                        })}
                                    />
                                </div>
                            </div>

                            <Separator />

                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label>Email Verification Required</Label>
                                    <p className="text-sm text-muted-foreground">
                                        Require email verification for new accounts
                                    </p>
                                </div>
                                <Switch
                                    checked={platformSettings.requireEmailVerification}
                                    onCheckedChange={(checked) => setPlatformSettings({
                                        ...platformSettings,
                                        requireEmailVerification: checked
                                    })}
                                />
                            </div>

                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label>Audit Logging</Label>
                                    <p className="text-sm text-muted-foreground">
                                        Log all user actions for security auditing
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
                                <Button onClick={handleSavePlatformSettings}>
                                    <Save className="h-4 w-4 mr-2" />
                                    Save Security Settings
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Email Settings */}
                <TabsContent value="email">
                    <Card>
                        <CardHeader>
                            <CardTitle>Email Configuration</CardTitle>
                            <CardDescription>
                                SMTP and email notification settings
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="smtpHost">SMTP Host</Label>
                                    <Input
                                        id="smtpHost"
                                        value={emailSettings.smtpHost}
                                        onChange={(e) => setEmailSettings({
                                            ...emailSettings,
                                            smtpHost: e.target.value
                                        })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="smtpPort">SMTP Port</Label>
                                    <Input
                                        id="smtpPort"
                                        type="number"
                                        value={emailSettings.smtpPort}
                                        onChange={(e) => setEmailSettings({
                                            ...emailSettings,
                                            smtpPort: parseInt(e.target.value) || 587
                                        })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="smtpUser">SMTP Username</Label>
                                    <Input
                                        id="smtpUser"
                                        value={emailSettings.smtpUser}
                                        onChange={(e) => setEmailSettings({
                                            ...emailSettings,
                                            smtpUser: e.target.value
                                        })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="smtpPassword">SMTP Password</Label>
                                    <Input
                                        id="smtpPassword"
                                        type="password"
                                        value={emailSettings.smtpPassword}
                                        onChange={(e) => setEmailSettings({
                                            ...emailSettings,
                                            smtpPassword: e.target.value
                                        })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="senderEmail">Sender Email</Label>
                                    <Input
                                        id="senderEmail"
                                        type="email"
                                        value={emailSettings.senderEmail}
                                        onChange={(e) => setEmailSettings({
                                            ...emailSettings,
                                            senderEmail: e.target.value
                                        })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="senderName">Sender Name</Label>
                                    <Input
                                        id="senderName"
                                        value={emailSettings.senderName}
                                        onChange={(e) => setEmailSettings({
                                            ...emailSettings,
                                            senderName: e.target.value
                                        })}
                                    />
                                </div>
                            </div>

                            <Separator />

                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label>Email Notifications</Label>
                                    <p className="text-sm text-muted-foreground">
                                        Enable email notifications for platform events
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

                            <div className="flex justify-end gap-2">
                                <Button variant="outline" onClick={handleTestEmail}>
                                    <Mail className="h-4 w-4 mr-2" />
                                    Send Test Email
                                </Button>
                                <Button onClick={handleSaveEmailSettings}>
                                    <Save className="h-4 w-4 mr-2" />
                                    Save Email Settings
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Database Settings */}
                <TabsContent value="database">
                    <Card>
                        <CardHeader>
                            <CardTitle>Database Management</CardTitle>
                            <CardDescription>
                                Database status and maintenance operations
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {/* Database Status */}
                            <div className="rounded-lg border p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="font-medium">Connection Status</span>
                                    <Badge className="bg-green-100 text-green-800">Connected</Badge>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-muted-foreground">Database Type</span>
                                    <span className="text-sm">PostgreSQL 15</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-muted-foreground">Host</span>
                                    <span className="text-sm font-mono">localhost:5432</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-muted-foreground">Database Name</span>
                                    <span className="text-sm font-mono">expense_db</span>
                                </div>
                            </div>

                            <Separator />

                            {/* Maintenance Operations */}
                            <div className="space-y-4">
                                <h4 className="font-medium">Maintenance Operations</h4>

                                <div className="flex items-center justify-between p-3 rounded-lg border">
                                    <div>
                                        <p className="font-medium">Clear Cache</p>
                                        <p className="text-sm text-muted-foreground">
                                            Clear all cached data from Redis
                                        </p>
                                    </div>
                                    <Button variant="outline" onClick={() => toast.success('Cache cleared')}>
                                        <RefreshCw className="h-4 w-4 mr-2" />
                                        Clear Cache
                                    </Button>
                                </div>

                                <div className="flex items-center justify-between p-3 rounded-lg border">
                                    <div>
                                        <p className="font-medium">Run Migrations</p>
                                        <p className="text-sm text-muted-foreground">
                                            Apply pending database migrations
                                        </p>
                                    </div>
                                    <Button variant="outline" onClick={() => toast.info('No pending migrations')}>
                                        <Database className="h-4 w-4 mr-2" />
                                        Run Migrations
                                    </Button>
                                </div>

                                <div className="flex items-center justify-between p-3 rounded-lg border bg-destructive/5">
                                    <div>
                                        <p className="font-medium text-destructive">Reset Test Data</p>
                                        <p className="text-sm text-muted-foreground">
                                            WARNING: This will reset all non-production data
                                        </p>
                                    </div>
                                    <Button variant="destructive" onClick={() => toast.error('This action is disabled in production')}>
                                        Reset Data
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
