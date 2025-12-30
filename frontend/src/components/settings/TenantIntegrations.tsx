import { useState } from 'react';
import {
    Webhook as WebhookIcon,
    Shield,
    Users,
    Building2,
    Loader2,
    Save,
    Plus,
    Trash2,
    RefreshCw,
    ExternalLink,
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
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from '@/components/ui/accordion';
import {
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
    SSOConfigCreate,
    HRMSConfigCreate,
    ERPConfigCreate,
} from '@/hooks/useIntegrations';
import { useFormatting } from '@/hooks/useFormatting';
import { CommunicationIntegrations } from './CommunicationIntegrations';

const WEBHOOK_EVENTS = [
    { value: 'claim.created', label: 'Claim Created' },
    { value: 'claim.approved', label: 'Claim Approved' },
    { value: 'claim.rejected', label: 'Claim Rejected' },
    { value: 'claim.settled', label: 'Claim Settled' },
];

interface TenantIntegrationsProps {
    tenantId: string;
}

export function TenantIntegrations({ tenantId }: TenantIntegrationsProps) {
    const { formatDate } = useFormatting();

    // Webhooks
    const { data: webhooks, isLoading: isLoadingWebhooks } = useWebhooks(tenantId);
    const createWebhookMutation = useCreateWebhook(tenantId);
    const deleteWebhookMutation = useDeleteWebhook(tenantId);
    const testWebhookMutation = useTestWebhook(tenantId);

    // SSO
    const { data: ssoConfig, isLoading: isLoadingSSOConfig } = useSSOConfig(tenantId);
    const createSSOConfigMutation = useCreateSSOConfig(tenantId);
    const updateSSOConfigMutation = useUpdateSSOConfig(tenantId);

    // HRMS
    const { data: hrmsConfig, isLoading: isLoadingHRMSConfig } = useHRMSConfig(tenantId);
    const createHRMSConfigMutation = useCreateHRMSConfig(tenantId);
    const updateHRMSConfigMutation = useUpdateHRMSConfig(tenantId);
    const triggerHRMSSyncMutation = useTriggerHRMSSync(tenantId);

    // ERP
    const { data: erpConfig, isLoading: isLoadingERPConfig } = useERPConfig(tenantId);
    const createERPConfigMutation = useCreateERPConfig(tenantId);
    const updateERPConfigMutation = useUpdateERPConfig(tenantId);
    const triggerERPExportMutation = useTriggerERPExport(tenantId);

    // Form states
    const [newWebhookForm, setNewWebhookForm] = useState({ name: '', url: '', events: [] as string[], secret: '' });
    const [ssoForm, setSSOForm] = useState<any>({ provider: 'azure_ad', client_id: '', client_secret: '', tenant_id: '' });
    const [hrmsForm, setHRMSForm] = useState<any>({ provider: 'workday', api_url: '', api_key: '', sync_frequency: 'daily' });
    const [erpForm, setERPForm] = useState<any>({ provider: 'sap', api_url: '', api_key: '', export_frequency: 'daily' });

    // Modal states
    const [showNewWebhookModal, setShowNewWebhookModal] = useState(false);

    return (
        <div className="space-y-6">
            {/* Communication Integrations (Slack/Teams) */}
            <CommunicationIntegrations tenantId={tenantId} />

            <Accordion type="multiple" className="w-full" defaultValue={[]}>
                {/* Webhooks Section */}
                <AccordionItem value="webhooks">
                    <AccordionTrigger className="hover:no-underline">
                        <div className="flex items-center gap-2">
                            <WebhookIcon className="h-5 w-5" />
                            <span className="font-semibold">Webhooks</span>
                            <Badge variant="secondary" className="ml-2">{webhooks?.length || 0} configured</Badge>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent>
                        <Card className="border-0 shadow-none">
                            <CardContent className="pt-4 space-y-4">
                                <CardDescription>
                                    Send real-time notifications to external systems when events occur
                                </CardDescription>

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
                                                            Configure a webhook endpoint to receive event notifications.
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <div className="space-y-4 py-4">
                                                        <div className="space-y-2">
                                                            <Label>Webhook Name</Label>
                                                            <Input
                                                                placeholder="e.g., Expense Tracker Webhook"
                                                                value={newWebhookForm.name}
                                                                onChange={(e) => setNewWebhookForm({ ...newWebhookForm, name: e.target.value })}
                                                            />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Label>Endpoint URL</Label>
                                                            <Input
                                                                placeholder="https://your-app.com/webhook"
                                                                value={newWebhookForm.url}
                                                                onChange={(e) => setNewWebhookForm({ ...newWebhookForm, url: e.target.value })}
                                                            />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Label>Events</Label>
                                                            <div className="space-y-2">
                                                                {WEBHOOK_EVENTS.map((event) => (
                                                                    <div key={event.value} className="flex items-center gap-2">
                                                                        <Switch
                                                                            checked={newWebhookForm.events.includes(event.value)}
                                                                            onCheckedChange={(checked) => {
                                                                                if (checked) {
                                                                                    setNewWebhookForm({
                                                                                        ...newWebhookForm,
                                                                                        events: [...newWebhookForm.events, event.value]
                                                                                    });
                                                                                } else {
                                                                                    setNewWebhookForm({
                                                                                        ...newWebhookForm,
                                                                                        events: newWebhookForm.events.filter(e => e !== event.value)
                                                                                    });
                                                                                }
                                                                            }}
                                                                        />
                                                                        <span className="text-sm">{event.label}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel onClick={() => {
                                                            setNewWebhookForm({ name: '', url: '', events: [], secret: '' });
                                                        }}>
                                                            Cancel
                                                        </AlertDialogCancel>
                                                        <AlertDialogAction
                                                            disabled={!newWebhookForm.name || !newWebhookForm.url || newWebhookForm.events.length === 0 || createWebhookMutation.isPending}
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                createWebhookMutation.mutate(
                                                                    { name: newWebhookForm.name, url: newWebhookForm.url, events: newWebhookForm.events },
                                                                    {
                                                                        onSuccess: () => {
                                                                            toast.success('Webhook created successfully');
                                                                            setNewWebhookForm({ name: '', url: '', events: [], secret: '' });
                                                                            setShowNewWebhookModal(false);
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
                                                        <div className="space-y-1">
                                                            <p className="font-medium">{webhook.name}</p>
                                                            <p className="text-xs text-muted-foreground truncate max-w-[300px]">
                                                                {webhook.url}
                                                            </p>
                                                            <div className="flex gap-1 flex-wrap">
                                                                {webhook.events?.map((event) => (
                                                                    <Badge key={event} variant="outline" className="text-xs">{event}</Badge>
                                                                ))}
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => {
                                                                    testWebhookMutation.mutate(webhook.id, {
                                                                        onSuccess: () => toast.success('Test event sent'),
                                                                        onError: () => toast.error('Failed to send test event'),
                                                                    });
                                                                }}
                                                                disabled={testWebhookMutation.isPending}
                                                            >
                                                                Test
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
                                            <p className="text-sm text-muted-foreground text-center py-4">
                                                No webhooks configured. Add a webhook to receive event notifications.
                                            </p>
                                        )}
                                    </>
                                )}
                            </CardContent>
                        </Card>
                    </AccordionContent>
                </AccordionItem>

                {/* SSO / SAML Section */}
                <AccordionItem value="sso">
                    <AccordionTrigger className="hover:no-underline">
                        <div className="flex items-center gap-2">
                            <Shield className="h-5 w-5" />
                            <span className="font-semibold">Single Sign-On (SSO)</span>
                            {ssoConfig && <Badge variant="default" className="ml-2">Configured</Badge>}
                        </div>
                    </AccordionTrigger>
                    <AccordionContent>
                        <Card className="border-0 shadow-none">
                            <CardContent className="pt-4 space-y-4">
                                <CardDescription>
                                    Configure SSO to allow users to sign in using your organization's identity provider
                                </CardDescription>

                                {isLoadingSSOConfig ? (
                                    <div className="flex items-center justify-center py-4">
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <Label>Identity Provider</Label>
                                            <Select
                                                value={ssoForm.provider || ssoConfig?.provider || 'azure_ad'}
                                                onValueChange={(value) => setSSOForm({ ...ssoForm, provider: value })}
                                            >
                                                <SelectTrigger className="w-full max-w-xs">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="azure_ad">Microsoft Entra ID (Azure AD)</SelectItem>
                                                    <SelectItem value="okta">Okta</SelectItem>
                                                    <SelectItem value="google">Google Workspace</SelectItem>
                                                    <SelectItem value="onelogin">OneLogin</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Client ID</Label>
                                            <Input
                                                placeholder="Enter client ID from your IdP"
                                                value={ssoForm.client_id || ssoConfig?.client_id || ''}
                                                onChange={(e) => setSSOForm({ ...ssoForm, client_id: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Client Secret</Label>
                                            <Input
                                                type="password"
                                                placeholder="Enter client secret"
                                                value={ssoForm.client_secret || ''}
                                                onChange={(e) => setSSOForm({ ...ssoForm, client_secret: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Tenant ID / Issuer URL</Label>
                                            <Input
                                                placeholder="Enter tenant ID or issuer URL"
                                                value={ssoForm.tenant_id || ssoConfig?.issuer_url || ''}
                                                onChange={(e) => setSSOForm({ ...ssoForm, tenant_id: e.target.value })}
                                            />
                                        </div>
                                        <div className="flex items-center justify-between pt-2">
                                            <div className="space-y-0.5">
                                                <Label>Enable SSO</Label>
                                                <p className="text-sm text-muted-foreground">
                                                    Allow users to sign in with their organizational account
                                                </p>
                                            </div>
                                            <Switch
                                                checked={ssoForm.is_active ?? ssoConfig?.is_active ?? false}
                                                onCheckedChange={(checked) => setSSOForm({ ...ssoForm, is_active: checked })}
                                            />
                                        </div>
                                        <Separator />
                                        <div className="flex gap-2">
                                            <Button
                                                onClick={() => {
                                                    const data = {
                                                        provider: ssoForm.provider || 'azure_ad',
                                                        client_id: ssoForm.client_id,
                                                        client_secret: ssoForm.client_secret,
                                                        sso_domain: ssoForm.tenant_id,
                                                        is_active: ssoForm.is_active ?? false,
                                                    };
                                                    if (ssoConfig) {
                                                        updateSSOConfigMutation.mutate(data, {
                                                            onSuccess: () => toast.success('SSO configuration updated'),
                                                            onError: () => toast.error('Failed to update SSO configuration'),
                                                        });
                                                    } else {
                                                        createSSOConfigMutation.mutate(data as SSOConfigCreate, {
                                                            onSuccess: () => toast.success('SSO configuration created'),
                                                            onError: () => toast.error('Failed to create SSO configuration'),
                                                        });
                                                    }
                                                }}
                                                disabled={createSSOConfigMutation.isPending || updateSSOConfigMutation.isPending}
                                            >
                                                {(createSSOConfigMutation.isPending || updateSSOConfigMutation.isPending) ? (
                                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                                ) : (
                                                    <Save className="h-4 w-4 mr-2" />
                                                )}
                                                Save SSO Settings
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </AccordionContent>
                </AccordionItem>

                {/* HRMS Integration Section */}
                <AccordionItem value="hrms">
                    <AccordionTrigger className="hover:no-underline">
                        <div className="flex items-center gap-2">
                            <Users className="h-5 w-5" />
                            <span className="font-semibold">HRMS Integration</span>
                            {hrmsConfig && <Badge variant="default" className="ml-2">Configured</Badge>}
                        </div>
                    </AccordionTrigger>
                    <AccordionContent>
                        <Card className="border-0 shadow-none">
                            <CardContent className="pt-4 space-y-4">
                                <CardDescription>
                                    Sync employee data from your HR management system
                                </CardDescription>

                                {isLoadingHRMSConfig ? (
                                    <div className="flex items-center justify-center py-4">
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <Label>HRMS Provider</Label>
                                            <Select
                                                value={hrmsForm.provider || hrmsConfig?.provider || 'workday'}
                                                onValueChange={(value) => setHRMSForm({ ...hrmsForm, provider: value })}
                                            >
                                                <SelectTrigger className="w-full max-w-xs">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="workday">Workday</SelectItem>
                                                    <SelectItem value="bamboohr">BambooHR</SelectItem>
                                                    <SelectItem value="adp">ADP</SelectItem>
                                                    <SelectItem value="successfactors">SAP SuccessFactors</SelectItem>
                                                    <SelectItem value="other">Other (Custom API)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>API URL</Label>
                                            <Input
                                                placeholder="https://api.yourhrms.com/v1"
                                                value={hrmsForm.api_url || hrmsConfig?.api_url || ''}
                                                onChange={(e) => setHRMSForm({ ...hrmsForm, api_url: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>API Key / Token</Label>
                                            <Input
                                                type="password"
                                                placeholder="Enter API key"
                                                value={hrmsForm.api_key || ''}
                                                onChange={(e) => setHRMSForm({ ...hrmsForm, api_key: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Sync Frequency</Label>
                                            <Select
                                                value={hrmsForm.sync_frequency || hrmsConfig?.sync_frequency || 'daily'}
                                                onValueChange={(value) => setHRMSForm({ ...hrmsForm, sync_frequency: value })}
                                            >
                                                <SelectTrigger className="w-full max-w-xs">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="hourly">Hourly</SelectItem>
                                                    <SelectItem value="daily">Daily</SelectItem>
                                                    <SelectItem value="weekly">Weekly</SelectItem>
                                                    <SelectItem value="manual">Manual Only</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <Separator />
                                        <div className="flex gap-2">
                                            <Button
                                                onClick={() => {
                                                    const data = {
                                                        provider: hrmsForm.provider || 'workday',
                                                        api_url: hrmsForm.api_url,
                                                        api_key: hrmsForm.api_key,
                                                        sync_frequency: hrmsForm.sync_frequency || 'daily',
                                                    };
                                                    if (hrmsConfig) {
                                                        updateHRMSConfigMutation.mutate(data, {
                                                            onSuccess: () => toast.success('HRMS configuration updated'),
                                                            onError: () => toast.error('Failed to update HRMS configuration'),
                                                        });
                                                    } else {
                                                        createHRMSConfigMutation.mutate(data as HRMSConfigCreate, {
                                                            onSuccess: () => toast.success('HRMS configuration created'),
                                                            onError: () => toast.error('Failed to create HRMS configuration'),
                                                        });
                                                    }
                                                }}
                                                disabled={createHRMSConfigMutation.isPending || updateHRMSConfigMutation.isPending}
                                            >
                                                {(createHRMSConfigMutation.isPending || updateHRMSConfigMutation.isPending) ? (
                                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                                ) : (
                                                    <Save className="h-4 w-4 mr-2" />
                                                )}
                                                Save HRMS Settings
                                            </Button>
                                            {hrmsConfig && (
                                                <Button
                                                    variant="outline"
                                                    onClick={() => {
                                                        triggerHRMSSyncMutation.mutate(undefined, {
                                                            onSuccess: () => toast.success('HRMS sync triggered'),
                                                            onError: () => toast.error('Failed to trigger sync'),
                                                        });
                                                    }}
                                                    disabled={triggerHRMSSyncMutation.isPending}
                                                >
                                                    {triggerHRMSSyncMutation.isPending ? (
                                                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                                    ) : (
                                                        <RefreshCw className="h-4 w-4 mr-2" />
                                                    )}
                                                    Sync Now
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </AccordionContent>
                </AccordionItem>

                {/* ERP Integration Section */}
                <AccordionItem value="erp">
                    <AccordionTrigger className="hover:no-underline">
                        <div className="flex items-center gap-2">
                            <Building2 className="h-5 w-5" />
                            <span className="font-semibold">ERP Integration</span>
                            {erpConfig && <Badge variant="default" className="ml-2">Configured</Badge>}
                        </div>
                    </AccordionTrigger>
                    <AccordionContent>
                        <Card className="border-0 shadow-none">
                            <CardContent className="pt-4 space-y-4">
                                <CardDescription>
                                    Export approved expense data to your ERP/accounting system
                                </CardDescription>

                                {isLoadingERPConfig ? (
                                    <div className="flex items-center justify-center py-4">
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <Label>ERP Provider</Label>
                                            <Select
                                                value={erpForm.provider || erpConfig?.provider || 'sap'}
                                                onValueChange={(value) => setERPForm({ ...erpForm, provider: value })}
                                            >
                                                <SelectTrigger className="w-full max-w-xs">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="sap">SAP</SelectItem>
                                                    <SelectItem value="oracle">Oracle</SelectItem>
                                                    <SelectItem value="netsuite">NetSuite</SelectItem>
                                                    <SelectItem value="quickbooks">QuickBooks</SelectItem>
                                                    <SelectItem value="xero">Xero</SelectItem>
                                                    <SelectItem value="tally">Tally</SelectItem>
                                                    <SelectItem value="other">Other (Custom API)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>API URL</Label>
                                            <Input
                                                placeholder="https://api.yourerp.com/v1"
                                                value={erpForm.api_url || erpConfig?.api_url || ''}
                                                onChange={(e) => setERPForm({ ...erpForm, api_url: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>API Key / Token</Label>
                                            <Input
                                                type="password"
                                                placeholder="Enter API key"
                                                value={erpForm.api_key || ''}
                                                onChange={(e) => setERPForm({ ...erpForm, api_key: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Export Frequency</Label>
                                            <Select
                                                value={erpForm.export_frequency || erpConfig?.export_frequency || 'daily'}
                                                onValueChange={(value) => setERPForm({ ...erpForm, export_frequency: value })}
                                            >
                                                <SelectTrigger className="w-full max-w-xs">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="realtime">Real-time</SelectItem>
                                                    <SelectItem value="hourly">Hourly</SelectItem>
                                                    <SelectItem value="daily">Daily</SelectItem>
                                                    <SelectItem value="weekly">Weekly</SelectItem>
                                                    <SelectItem value="manual">Manual Only</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <Separator />
                                        <div className="flex gap-2">
                                            <Button
                                                onClick={() => {
                                                    const data = {
                                                        provider: erpForm.provider || 'sap',
                                                        api_url: erpForm.api_url,
                                                        api_key: erpForm.api_key,
                                                        export_frequency: erpForm.export_frequency || 'daily',
                                                    };
                                                    if (erpConfig) {
                                                        updateERPConfigMutation.mutate(data, {
                                                            onSuccess: () => toast.success('ERP configuration updated'),
                                                            onError: () => toast.error('Failed to update ERP configuration'),
                                                        });
                                                    } else {
                                                        createERPConfigMutation.mutate(data as ERPConfigCreate, {
                                                            onSuccess: () => toast.success('ERP configuration created'),
                                                            onError: () => toast.error('Failed to create ERP configuration'),
                                                        });
                                                    }
                                                }}
                                                disabled={createERPConfigMutation.isPending || updateERPConfigMutation.isPending}
                                            >
                                                {(createERPConfigMutation.isPending || updateERPConfigMutation.isPending) ? (
                                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                                ) : (
                                                    <Save className="h-4 w-4 mr-2" />
                                                )}
                                                Save ERP Settings
                                            </Button>
                                            {erpConfig && (
                                                <Button
                                                    variant="outline"
                                                    onClick={() => {
                                                        triggerERPExportMutation.mutate(undefined, {
                                                            onSuccess: () => toast.success('ERP export triggered'),
                                                            onError: () => toast.error('Failed to trigger export'),
                                                        });
                                                    }}
                                                    disabled={triggerERPExportMutation.isPending}
                                                >
                                                    {triggerERPExportMutation.isPending ? (
                                                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                                    ) : (
                                                        <ExternalLink className="h-4 w-4 mr-2" />
                                                    )}
                                                    Export Now
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        </div>
    );
}

export default TenantIntegrations;
