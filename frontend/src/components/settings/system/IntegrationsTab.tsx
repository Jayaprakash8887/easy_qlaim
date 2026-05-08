import { useState } from 'react';
import {
    Key,
    Webhook as WebhookIcon,
    Shield,
    Users,
    Building2,
    Loader2,
    Save,
    Plus,
    Trash2,
    Copy,
    RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
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
import {
    useApiKeys,
    useCreateApiKey,
    useDeleteApiKey,
    useWebhooks,
    useCreateWebhook,
    useDeleteWebhook,
    useTestWebhook,
    useSSOConfig,
    useCreateSSOConfig,
    useUpdateSSOConfig,
    useHRMSConfig,
    useCreateHRMSConfig,
    useUpdateHRMSConfig,
    useTriggerHRMSSync,
    useERPConfig,
    useCreateERPConfig,
    useUpdateERPConfig,
    useTriggerERPExport,
} from '@/hooks/useIntegrations';
import type {
    SSOConfig,
    SSOConfigCreate,
    HRMSConfig,
    HRMSConfigCreate,
    ERPConfig,
    ERPConfigCreate,
} from '@/hooks/useIntegrations';
import { useFormatting } from '@/hooks/useFormatting';
import { WEBHOOK_EVENTS } from './types';

interface IntegrationsTabProps {
    tenantId: string;
}

export function IntegrationsTab({ tenantId }: IntegrationsTabProps) {
    const { formatDate, formatDateTime } = useFormatting();
    
    // Integration hooks
    const { data: apiKeys, isLoading: isLoadingApiKeys } = useApiKeys(tenantId);
    const { data: webhooks, isLoading: isLoadingWebhooks } = useWebhooks(tenantId);
    const { data: ssoConfig, isLoading: isLoadingSSOConfig } = useSSOConfig(tenantId);
    const { data: hrmsConfig, isLoading: isLoadingHRMSConfig } = useHRMSConfig(tenantId);
    const { data: erpConfig, isLoading: isLoadingERPConfig } = useERPConfig(tenantId);

    // Integration mutations
    const createApiKeyMutation = useCreateApiKey(tenantId);
    const deleteApiKeyMutation = useDeleteApiKey(tenantId);
    const createWebhookMutation = useCreateWebhook(tenantId);
    const deleteWebhookMutation = useDeleteWebhook(tenantId);
    const testWebhookMutation = useTestWebhook(tenantId);
    const createSSOConfigMutation = useCreateSSOConfig(tenantId);
    const updateSSOConfigMutation = useUpdateSSOConfig(tenantId);
    const createHRMSConfigMutation = useCreateHRMSConfig(tenantId);
    const updateHRMSConfigMutation = useUpdateHRMSConfig(tenantId);
    const triggerHRMSSyncMutation = useTriggerHRMSSync(tenantId);
    const createERPConfigMutation = useCreateERPConfig(tenantId);
    const updateERPConfigMutation = useUpdateERPConfig(tenantId);
    const triggerERPExportMutation = useTriggerERPExport(tenantId);

    // Form states
    const [newApiKeyForm, setNewApiKeyForm] = useState({ name: '', permissions: ['read'] as string[] });
    const [newWebhookForm, setNewWebhookForm] = useState({ name: '', url: '', events: [] as string[], secret: '' });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [ssoForm, setSSOForm] = useState<any>({ provider: 'azure_ad', client_id: '' });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [hrmsForm, setHRMSForm] = useState<any>({ provider: 'workday', api_url: '', sync_frequency: 'daily' });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [erpForm, setERPForm] = useState<any>({ provider: 'sap', api_url: '', export_frequency: 'daily' });

    // Modal states
    const [showNewApiKeyModal, setShowNewApiKeyModal] = useState(false);
    const [showNewWebhookModal, setShowNewWebhookModal] = useState(false);
    const [newlyCreatedApiKey, setNewlyCreatedApiKey] = useState<string | null>(null);

    return (
        <div className="space-y-4">
            {/* API Access Card */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Key className="h-5 w-5" />
                        API Access
                    </CardTitle>
                    <CardDescription>
                        Configure API keys for external system access to EasyQlaim
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {isLoadingApiKeys ? (
                        <div className="flex items-center justify-center py-4">
                            <Loader2 className="h-5 w-5 animate-spin" />
                        </div>
                    ) : (
                        <>
                            <div className="flex justify-between items-center">
                                <Label>API Keys ({apiKeys?.length || 0})</Label>
                                <AlertDialog open={showNewApiKeyModal} onOpenChange={setShowNewApiKeyModal}>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="outline" size="sm" className="gap-2">
                                            <Plus className="h-4 w-4" />
                                            Generate New Key
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Generate API Key</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                Create a new API key for external system integration.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <div className="space-y-4 py-4">
                                            <div className="space-y-2">
                                                <Label>Key Name</Label>
                                                <Input
                                                    placeholder="e.g., Production Integration"
                                                    value={newApiKeyForm.name}
                                                    onChange={(e) => setNewApiKeyForm({ ...newApiKeyForm, name: e.target.value })}
                                                />
                                            </div>
                                            {newlyCreatedApiKey && (
                                                <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-md">
                                                    <p className="text-sm font-medium text-green-800 dark:text-green-200 mb-2">
                                                        API Key Generated! Copy it now - it won't be shown again.
                                                    </p>
                                                    <div className="flex gap-2">
                                                        <Input value={newlyCreatedApiKey} readOnly className="font-mono text-xs" />
                                                        <Button
                                                            variant="outline"
                                                            size="icon"
                                                            onClick={() => {
                                                                navigator.clipboard.writeText(newlyCreatedApiKey);
                                                                toast.success('API key copied to clipboard');
                                                            }}
                                                        >
                                                            <Copy className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel onClick={() => {
                                                setNewApiKeyForm({ name: '', permissions: ['read'] });
                                                setNewlyCreatedApiKey(null);
                                            }}>
                                                {newlyCreatedApiKey ? 'Close' : 'Cancel'}
                                            </AlertDialogCancel>
                                            {!newlyCreatedApiKey && (
                                                <AlertDialogAction
                                                    disabled={!newApiKeyForm.name || createApiKeyMutation.isPending}
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        createApiKeyMutation.mutate(
                                                            { name: newApiKeyForm.name, permissions: newApiKeyForm.permissions },
                                                            {
                                                                onSuccess: (data) => {
                                                                    setNewlyCreatedApiKey(data.api_key || 'Key generated');
                                                                    toast.success('API key generated successfully');
                                                                },
                                                                onError: () => toast.error('Failed to generate API key'),
                                                            }
                                                        );
                                                    }}
                                                >
                                                    {createApiKeyMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Generate'}
                                                </AlertDialogAction>
                                            )}
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </div>
                            {apiKeys && apiKeys.length > 0 ? (
                                <div className="space-y-2">
                                    {apiKeys.map((key) => (
                                        <div key={key.id} className="flex items-center justify-between p-3 border rounded-md">
                                            <div className="space-y-1">
                                                <p className="font-medium">{key.name}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    Created: {formatDate(key.created_at)}
                                                    {key.last_used_at && ` • Last used: ${formatDate(key.last_used_at)}`}
                                                </p>
                                                <div className="flex gap-1">
                                                    {key.permissions?.map((perm) => (
                                                        <Badge key={perm} variant="secondary" className="text-xs">{perm}</Badge>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Badge variant={key.is_active ? "default" : "secondary"}>
                                                    {key.is_active ? 'Active' : 'Revoked'}
                                                </Badge>
                                                {key.is_active && (
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="text-destructive"
                                                        onClick={() => {
                                                            deleteApiKeyMutation.mutate(key.id, {
                                                                onSuccess: () => toast.success('API key revoked'),
                                                                onError: () => toast.error('Failed to revoke API key'),
                                                            });
                                                        }}
                                                    >
                                                        Revoke
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="rounded-md border p-4 bg-muted/30">
                                    <p className="text-sm text-muted-foreground text-center py-4">
                                        No API keys configured. Generate a key to enable external integrations.
                                    </p>
                                </div>
                            )}
                        </>
                    )}
                </CardContent>
            </Card>

            {/* Webhooks Card */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <WebhookIcon className="h-5 w-5" />
                        Webhooks
                    </CardTitle>
                    <CardDescription>
                        Send real-time notifications to external systems when events occur
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {isLoadingWebhooks ? (
                        <div className="flex items-center justify-center py-4">
                            <Loader2 className="h-5 w-5 animate-spin" />
                        </div>
                    ) : (
                        <>
                            <div className="flex justify-between items-center">
                                <Label>Configured Webhooks ({webhooks?.length || 0})</Label>
                                <AlertDialog open={showNewWebhookModal} onOpenChange={setShowNewWebhookModal}>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="outline" size="sm" className="gap-2">
                                            <Plus className="h-4 w-4" />
                                            Add Webhook
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Add Webhook</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                Configure a webhook to receive event notifications.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <div className="space-y-4 py-4">
                                            <div className="space-y-2">
                                                <Label>Webhook Name</Label>
                                                <Input
                                                    placeholder="e.g., ERP Integration"
                                                    value={newWebhookForm.name}
                                                    onChange={(e) => setNewWebhookForm({ ...newWebhookForm, name: e.target.value })}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Webhook URL</Label>
                                                <Input
                                                    placeholder="https://your-server.com/webhook"
                                                    value={newWebhookForm.url}
                                                    onChange={(e) => setNewWebhookForm({ ...newWebhookForm, url: e.target.value })}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Events</Label>
                                                <div className="grid grid-cols-2 gap-2">
                                                    {WEBHOOK_EVENTS.map((event) => (
                                                        <div key={event} className="flex items-center gap-2">
                                                            <input
                                                                type="checkbox"
                                                                id={event}
                                                                checked={newWebhookForm.events.includes(event)}
                                                                onChange={(e) => {
                                                                    if (e.target.checked) {
                                                                        setNewWebhookForm({ ...newWebhookForm, events: [...newWebhookForm.events, event] });
                                                                    } else {
                                                                        setNewWebhookForm({ ...newWebhookForm, events: newWebhookForm.events.filter(ev => ev !== event) });
                                                                    }
                                                                }}
                                                                className="rounded border-gray-300"
                                                            />
                                                            <Label htmlFor={event} className="text-sm font-normal">{event}</Label>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel onClick={() => setNewWebhookForm({ name: '', url: '', events: [], secret: '' })}>
                                                Cancel
                                            </AlertDialogCancel>
                                            <AlertDialogAction
                                                disabled={!newWebhookForm.name || !newWebhookForm.url || createWebhookMutation.isPending}
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    createWebhookMutation.mutate(
                                                        { name: newWebhookForm.name, url: newWebhookForm.url, events: newWebhookForm.events },
                                                        {
                                                            onSuccess: () => {
                                                                toast.success('Webhook created successfully');
                                                                setShowNewWebhookModal(false);
                                                                setNewWebhookForm({ name: '', url: '', events: [], secret: '' });
                                                            },
                                                            onError: () => toast.error('Failed to create webhook'),
                                                        }
                                                    );
                                                }}
                                            >
                                                {createWebhookMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create'}
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </div>
                            {webhooks && webhooks.length > 0 ? (
                                <div className="space-y-2">
                                    {webhooks.map((webhook) => (
                                        <div key={webhook.id} className="flex items-center justify-between p-3 border rounded-md">
                                            <div className="space-y-1 flex-1">
                                                <p className="font-medium">{webhook.name}</p>
                                                <p className="text-xs text-muted-foreground font-mono truncate max-w-md">{webhook.url}</p>
                                                <div className="flex gap-1 flex-wrap">
                                                    {webhook.events?.map((event) => (
                                                        <Badge key={event} variant="outline" className="text-xs">{event}</Badge>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Badge variant={webhook.is_active ? "default" : "secondary"}>
                                                    {webhook.is_active ? 'Active' : 'Inactive'}
                                                </Badge>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => {
                                                        testWebhookMutation.mutate(webhook.id, {
                                                            onSuccess: () => toast.success('Test webhook sent'),
                                                            onError: () => toast.error('Failed to send test webhook'),
                                                        });
                                                    }}
                                                >
                                                    <Send className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="text-destructive"
                                                    onClick={() => {
                                                        deleteWebhookMutation.mutate(webhook.id, {
                                                            onSuccess: () => toast.success('Webhook deleted'),
                                                            onError: () => toast.error('Failed to delete webhook'),
                                                        });
                                                    }}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="rounded-md border p-4 bg-muted/30">
                                    <p className="text-sm text-muted-foreground text-center py-4">
                                        No webhooks configured. Add a webhook to receive event notifications.
                                    </p>
                                </div>
                            )}
                            <div className="text-sm text-muted-foreground">
                                <p className="font-medium mb-2">Supported Events:</p>
                                <ul className="list-disc list-inside space-y-1">
                                    <li>claim.created - When a new claim is submitted</li>
                                    <li>claim.approved - When a claim is approved</li>
                                    <li>claim.rejected - When a claim is rejected</li>
                                    <li>claim.settled - When a claim payment is processed</li>
                                </ul>
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>

            {/* SSO Card */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Shield className="h-5 w-5" />
                        Single Sign-On (SSO)
                    </CardTitle>
                    <CardDescription>
                        Configure enterprise identity provider integration for seamless authentication
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {isLoadingSSOConfig ? (
                        <div className="flex items-center justify-center py-4">
                            <Loader2 className="h-5 w-5 animate-spin" />
                        </div>
                    ) : (
                        <div className="space-y-4 p-4 border rounded-md bg-muted/30">
                            {ssoConfig && (
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <p className="font-medium">SSO Configuration</p>
                                        <p className="text-sm text-muted-foreground">Provider: {ssoConfig.provider?.toUpperCase()}</p>
                                    </div>
                                    <Badge variant={ssoConfig.is_active ? "default" : "secondary"}>
                                        {ssoConfig.is_active ? 'Active' : 'Inactive'}
                                    </Badge>
                                </div>
                            )}
                            <div className="space-y-2">
                                <Label>Identity Provider</Label>
                                <Select
                                    value={ssoForm.provider || ssoConfig?.provider || 'azure_ad'}
                                    onValueChange={(value) => setSSOForm({ ...ssoForm, provider: value as SSOConfig['provider'] })}
                                >
                                    <SelectTrigger className="max-w-md">
                                        <SelectValue placeholder="Select provider" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="azure_ad">Microsoft Entra ID (Azure AD)</SelectItem>
                                        <SelectItem value="okta">Okta</SelectItem>
                                        <SelectItem value="google">Google Workspace</SelectItem>
                                        <SelectItem value="keycloak">Keycloak</SelectItem>
                                        <SelectItem value="saml">Generic SAML 2.0</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Client ID</Label>
                                <Input
                                    placeholder="Enter client ID"
                                    value={ssoForm.client_id ?? ssoConfig?.client_id ?? ''}
                                    onChange={(e) => setSSOForm({ ...ssoForm, client_id: e.target.value })}
                                    className="max-w-md"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>IDP URL</Label>
                                <Input
                                    placeholder="Enter identity provider URL"
                                    value={ssoForm.issuer_url ?? ssoConfig?.issuer_url ?? ''}
                                    onChange={(e) => setSSOForm({ ...ssoForm, idp_url: e.target.value })}
                                    className="max-w-md"
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <Switch
                                    checked={ssoForm.is_active ?? ssoConfig?.is_active ?? false}
                                    onCheckedChange={(checked) => setSSOForm({ ...ssoForm, enabled: checked })}
                                />
                                <Label>Enable SSO</Label>
                            </div>
                            <Button
                                onClick={() => {
                                    if (ssoConfig) {
                                        updateSSOConfigMutation.mutate(ssoForm as unknown as SSOConfigCreate, {
                                            onSuccess: () => toast.success('SSO configuration updated'),
                                            onError: () => toast.error('Failed to update SSO configuration'),
                                        });
                                    } else {
                                        createSSOConfigMutation.mutate(ssoForm as unknown as SSOConfigCreate, {
                                            onSuccess: () => toast.success('SSO configuration created'),
                                            onError: () => toast.error('Failed to create SSO configuration'),
                                        });
                                    }
                                }}
                                disabled={updateSSOConfigMutation.isPending || createSSOConfigMutation.isPending}
                            >
                                {(updateSSOConfigMutation.isPending || createSSOConfigMutation.isPending) ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                                {ssoConfig ? 'Save Changes' : 'Configure SSO'}
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* HRMS Integration Card */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Users className="h-5 w-5" />
                        HRMS Integration
                    </CardTitle>
                    <CardDescription>
                        Sync employee data from your Human Resource Management System
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {isLoadingHRMSConfig ? (
                        <div className="flex items-center justify-center py-4">
                            <Loader2 className="h-5 w-5 animate-spin" />
                        </div>
                    ) : (
                        <div className="space-y-4 p-4 border rounded-md bg-muted/30">
                            {hrmsConfig && (
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <p className="font-medium">HRMS Configuration</p>
                                        <p className="text-sm text-muted-foreground">
                                            Provider: {hrmsConfig.provider?.replace('_', ' ').toUpperCase()}
                                            {hrmsConfig.last_sync_at && ` • Last sync: ${formatDateTime(hrmsConfig.last_sync_at)}`}
                                        </p>
                                    </div>
                                    <Badge variant={hrmsConfig.is_active ? "default" : "secondary"}>
                                        {hrmsConfig.is_active ? 'Active' : 'Inactive'}
                                    </Badge>
                                </div>
                            )}
                            <div className="space-y-2">
                                <Label>HRMS Provider</Label>
                                <Select
                                    value={hrmsForm.provider || hrmsConfig?.provider || 'workday'}
                                    onValueChange={(value) => setHRMSForm({ ...hrmsForm, provider: value as HRMSConfig['provider'] })}
                                >
                                    <SelectTrigger className="max-w-md">
                                        <SelectValue placeholder="Select HRMS provider" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="workday">Workday</SelectItem>
                                        <SelectItem value="bamboohr">BambooHR</SelectItem>
                                        <SelectItem value="sap_successfactors">SAP SuccessFactors</SelectItem>
                                        <SelectItem value="oracle_hcm">Oracle HCM</SelectItem>
                                        <SelectItem value="zoho_people">Zoho People</SelectItem>
                                        <SelectItem value="darwinbox">Darwinbox</SelectItem>
                                        <SelectItem value="custom_api">Custom API</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>API Endpoint URL</Label>
                                <Input
                                    placeholder="https://api.hrms-provider.com/v1"
                                    value={hrmsForm.api_url ?? hrmsConfig?.api_url ?? ''}
                                    onChange={(e) => setHRMSForm({ ...hrmsForm, api_url: e.target.value })}
                                    className="max-w-md"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Sync Frequency</Label>
                                <Select
                                    value={hrmsForm.sync_frequency || hrmsConfig?.sync_frequency || 'daily'}
                                    onValueChange={(value) => setHRMSForm({ ...hrmsForm, sync_frequency: value as HRMSConfig['sync_frequency'] })}
                                >
                                    <SelectTrigger className="max-w-md">
                                        <SelectValue placeholder="Select frequency" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="hourly">Every Hour</SelectItem>
                                        <SelectItem value="daily">Daily</SelectItem>
                                        <SelectItem value="weekly">Weekly</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex items-center gap-2">
                                <Switch
                                    checked={hrmsForm.sync_enabled ?? hrmsConfig?.is_active ?? false}
                                    onCheckedChange={(checked) => setHRMSForm({ ...hrmsForm, enabled: checked })}
                                />
                                <Label>Enable HRMS Integration</Label>
                            </div>
                            <div className="flex gap-2 pt-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        if (hrmsConfig) {
                                            updateHRMSConfigMutation.mutate(hrmsForm as unknown as HRMSConfigCreate, {
                                                onSuccess: () => toast.success('HRMS configuration updated'),
                                                onError: () => toast.error('Failed to update configuration'),
                                            });
                                        } else {
                                            createHRMSConfigMutation.mutate(hrmsForm as unknown as HRMSConfigCreate, {
                                                onSuccess: () => toast.success('HRMS configuration created'),
                                                onError: () => toast.error('Failed to create HRMS configuration'),
                                            });
                                        }
                                    }}
                                    disabled={updateHRMSConfigMutation.isPending || createHRMSConfigMutation.isPending}
                                >
                                    {(updateHRMSConfigMutation.isPending || createHRMSConfigMutation.isPending) ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                                    {hrmsConfig ? 'Save Changes' : 'Configure HRMS'}
                                </Button>
                                {hrmsConfig && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="gap-2"
                                        onClick={() => {
                                            triggerHRMSSyncMutation.mutate(undefined, {
                                                onSuccess: () => toast.success('HRMS sync triggered'),
                                                onError: () => toast.error('Failed to trigger sync'),
                                            });
                                        }}
                                        disabled={triggerHRMSSyncMutation.isPending}
                                    >
                                        {triggerHRMSSyncMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                                        Sync Now
                                    </Button>
                                )}
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* ERP/Finance Integration Card */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Building2 className="h-5 w-5" />
                        ERP / Finance System Integration
                    </CardTitle>
                    <CardDescription>
                        Connect to your ERP or accounting system for expense and payment synchronization
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {isLoadingERPConfig ? (
                        <div className="flex items-center justify-center py-4">
                            <Loader2 className="h-5 w-5 animate-spin" />
                        </div>
                    ) : (
                        <div className="space-y-4 p-4 border rounded-md bg-muted/30">
                            {erpConfig && (
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <p className="font-medium">ERP Configuration</p>
                                        <p className="text-sm text-muted-foreground">
                                            Provider: {erpConfig.provider?.toUpperCase()}
                                            {erpConfig.last_export_at && ` • Last export: ${formatDateTime(erpConfig.last_export_at)}`}
                                        </p>
                                    </div>
                                    <Badge variant={erpConfig.is_active ? "default" : "secondary"}>
                                        {erpConfig.is_active ? 'Active' : 'Inactive'}
                                    </Badge>
                                </div>
                            )}
                            <div className="space-y-2">
                                <Label>ERP/Finance Provider</Label>
                                <Select
                                    value={erpForm.provider || erpConfig?.provider || 'sap'}
                                    onValueChange={(value) => setERPForm({ ...erpForm, provider: value as ERPConfig['provider'] })}
                                >
                                    <SelectTrigger className="max-w-md">
                                        <SelectValue placeholder="Select ERP provider" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="sap">SAP</SelectItem>
                                        <SelectItem value="oracle">Oracle Financials</SelectItem>
                                        <SelectItem value="dynamics365">Microsoft Dynamics 365</SelectItem>
                                        <SelectItem value="netsuite">NetSuite</SelectItem>
                                        <SelectItem value="quickbooks">QuickBooks</SelectItem>
                                        <SelectItem value="tally">Tally</SelectItem>
                                        <SelectItem value="zoho_books">Zoho Books</SelectItem>
                                        <SelectItem value="custom_api">Custom API</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>API Endpoint URL</Label>
                                <Input
                                    placeholder="https://api.erp-provider.com/v1"
                                    value={erpForm.api_url ?? erpConfig?.api_url ?? ''}
                                    onChange={(e) => setERPForm({ ...erpForm, api_url: e.target.value })}
                                    className="max-w-md"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Sync Frequency</Label>
                                <Select
                                    value={erpForm.export_frequency || erpConfig?.export_frequency || 'daily'}
                                    onValueChange={(value) => setERPForm({ ...erpForm, sync_frequency: value as ERPConfig['export_frequency'] })}
                                >
                                    <SelectTrigger className="max-w-md">
                                        <SelectValue placeholder="Select frequency" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="hourly">Every Hour</SelectItem>
                                        <SelectItem value="daily">Daily</SelectItem>
                                        <SelectItem value="weekly">Weekly</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex items-center gap-2">
                                <Switch
                                    checked={erpForm.export_enabled ?? erpConfig?.is_active ?? false}
                                    onCheckedChange={(checked) => setERPForm({ ...erpForm, enabled: checked })}
                                />
                                <Label>Enable ERP Integration</Label>
                            </div>
                            <div className="flex gap-2 pt-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        if (erpConfig) {
                                            updateERPConfigMutation.mutate(erpForm as unknown as ERPConfigCreate, {
                                                onSuccess: () => toast.success('ERP configuration updated'),
                                                onError: () => toast.error('Failed to update configuration'),
                                            });
                                        } else {
                                            createERPConfigMutation.mutate(erpForm as unknown as ERPConfigCreate, {
                                                onSuccess: () => toast.success('ERP configuration created'),
                                                onError: () => toast.error('Failed to create ERP configuration'),
                                            });
                                        }
                                    }}
                                    disabled={updateERPConfigMutation.isPending || createERPConfigMutation.isPending}
                                >
                                    {(updateERPConfigMutation.isPending || createERPConfigMutation.isPending) ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                                    {erpConfig ? 'Save Changes' : 'Configure ERP'}
                                </Button>
                                {erpConfig && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="gap-2"
                                        onClick={() => {
                                            triggerERPExportMutation.mutate(undefined, {
                                                onSuccess: () => toast.success('ERP export triggered'),
                                                onError: () => toast.error('Failed to trigger export'),
                                            });
                                        }}
                                        disabled={triggerERPExportMutation.isPending}
                                    >
                                        {triggerERPExportMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                                        Export Now
                                    </Button>
                                )}
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

export default IntegrationsTab;
