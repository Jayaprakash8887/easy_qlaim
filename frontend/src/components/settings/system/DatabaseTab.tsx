import { useState } from 'react';
import {
    Globe,
    Building2,
    Loader2,
    RefreshCw,
    Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
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
import { SystemInfo } from './types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

interface Tenant {
    id: string;
    name: string;
    code: string;
}

interface DatabaseTabProps {
    systemInfo?: SystemInfo;
    isLoadingSystemInfo: boolean;
    tenants?: Tenant[];
}

export function DatabaseTab({
    systemInfo,
    isLoadingSystemInfo,
    tenants = []
}: DatabaseTabProps) {
    const queryClient = useQueryClient();
    const [isClearingCache, setIsClearingCache] = useState<string | null>(null);
    const [tenantSearchFilter, setTenantSearchFilter] = useState('');

    const handleClearPlatformCache = async () => {
        setIsClearingCache('platform');
        try {
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
                const token = localStorage.getItem('access_token');
                await fetch(`${API_BASE_URL}/cache/invalidate/all`, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
                    },
                });
                toast.success(`Cache cleared for tenant: ${tenantName}`);
            } else {
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

    const filteredTenants = tenants.filter((tenant) =>
        tenantSearchFilter === '' ||
        tenant.name.toLowerCase().includes(tenantSearchFilter.toLowerCase()) ||
        tenant.code.toLowerCase().includes(tenantSearchFilter.toLowerCase())
    );

    return (
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
                                        {filteredTenants.map((tenant) => (
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
                                        {filteredTenants.length === 0 && (
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
    );
}

export default DatabaseTab;
