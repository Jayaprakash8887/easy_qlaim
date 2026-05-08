import { useState } from 'react';
import {
    Settings as SettingsIcon,
    Database,
    Shield,
    Mail,
    Globe,
    Server,
    Users,
    Building2,
    Activity,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useTenants, useDesignations } from '@/hooks/useSystemAdmin';
import { useQuery } from '@tanstack/react-query';

// Import extracted tab components
import {
    PlatformTab,
    SecurityTab,
    EmailTab,
    DatabaseTab,
    SystemInfo,
    PlatformSettings,
    DEFAULT_PLATFORM_SETTINGS,
} from '@/components/settings/system';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

// Fetch system info
async function fetchSystemInfo(): Promise<SystemInfo> {
    const token = localStorage.getItem('access_token');
    const response = await fetch(`${API_BASE_URL}/system/info`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
    });
    if (!response.ok) {
        throw new Error('Failed to fetch system info');
    }
    return response.json();
}

export default function SystemAdminSettings() {
    // Shared state for platform settings (if needed across tabs)
    const [platformSettings, setPlatformSettings] = useState<PlatformSettings>(DEFAULT_PLATFORM_SETTINGS);

    // Fetch tenants for cache management
    const { data: tenants } = useTenants(false);
    const { data: designations } = useDesignations();

    // Fetch system info for database status
    const { data: systemInfo, isLoading: isLoadingSystemInfo } = useQuery({
        queryKey: ['system-info'],
        queryFn: fetchSystemInfo,
        staleTime: 30000,
    });

    return (
        <div className="space-y-6 p-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-2">
                        <SettingsIcon className="h-8 w-8" />
                        System Administration
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Platform-wide settings and configuration for system administrators
                    </p>
                </div>
                <Badge variant="outline" className="text-lg px-4 py-2">
                    <Server className="h-4 w-4 mr-2" />
                    {systemInfo?.app?.environment || 'Development'}
                </Badge>
            </div>

            {/* Stats Overview */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Active Tenants</CardTitle>
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{tenants?.length || 0}</div>
                        <p className="text-xs text-muted-foreground">Organizations using the platform</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Active Users</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {tenants?.reduce((acc, t) => acc + (t.user_count || 0), 0) || 0}
                        </div>
                        <p className="text-xs text-muted-foreground">Across all tenants</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Designations</CardTitle>
                        <Activity className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{designations?.length || 0}</div>
                        <p className="text-xs text-muted-foreground">Job titles configured</p>
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

                {/* Platform Settings Tab */}
                <TabsContent value="platform">
                    <PlatformTab
                        platformSettings={platformSettings}
                        onSettingsChange={setPlatformSettings}
                    />
                </TabsContent>

                {/* Security Settings Tab */}
                <TabsContent value="security">
                    <SecurityTab
                        platformSettings={platformSettings}
                        onSettingsChange={setPlatformSettings}
                    />
                </TabsContent>

                {/* Email Settings Tab */}
                <TabsContent value="email">
                    <EmailTab />
                </TabsContent>

                {/* Database Settings Tab */}
                <TabsContent value="database">
                    <DatabaseTab
                        systemInfo={systemInfo}
                        isLoadingSystemInfo={isLoadingSystemInfo}
                        tenants={tenants?.map(t => ({ id: t.id, name: t.name, code: t.code })) || []}
                    />
                </TabsContent>
            </Tabs>
        </div>
    );
}
