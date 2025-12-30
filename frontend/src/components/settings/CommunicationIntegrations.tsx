import { useState, useEffect } from 'react';
import {
    MessageSquare,
    Loader2,
    Save,
    Send,
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
    useCommunicationConfigs,
    useCreateCommunicationConfig,
    useUpdateCommunicationConfig,
    useTestCommunication,
} from '@/hooks/useIntegrations';
import type { CommunicationConfigCreate } from '@/hooks/useIntegrations';

interface CommunicationIntegrationsProps {
    tenantId: string;
}

export function CommunicationIntegrations({ tenantId }: CommunicationIntegrationsProps) {
    const { data: communicationConfigs, isLoading } = useCommunicationConfigs(tenantId);
    const createCommunicationConfigMutation = useCreateCommunicationConfig(tenantId);
    const updateCommunicationConfigMutation = useUpdateCommunicationConfig(tenantId);
    const testCommunicationMutation = useTestCommunication(tenantId);

    // Find specific communication configs
    const slackConfig = communicationConfigs?.find(c => c.provider === 'slack');
    const teamsConfig = communicationConfigs?.find(c => c.provider === 'teams');

    // Form states
    const [slackForm, setSlackForm] = useState({
        provider: 'slack',
        webhook_url: '',
        slack_channel_id: '',
        notify_on_claim_submitted: true,
        notify_on_claim_approved: true,
        notify_on_claim_rejected: true,
    });

    const [teamsForm, setTeamsForm] = useState({
        provider: 'teams',
        teams_webhook_url: '',
        teams_channel_id: '',
        notify_on_claim_submitted: true,
        notify_on_claim_approved: true,
        notify_on_claim_rejected: true,
    });

    // Initialize forms when configs load
    useEffect(() => {
        if (slackConfig) {
            setSlackForm({
                provider: 'slack',
                webhook_url: slackConfig.slack_workspace_id || '',
                slack_channel_id: slackConfig.slack_channel_id || '',
                notify_on_claim_submitted: slackConfig.notify_on_claim_submitted ?? true,
                notify_on_claim_approved: slackConfig.notify_on_claim_approved ?? true,
                notify_on_claim_rejected: slackConfig.notify_on_claim_rejected ?? true,
            });
        }
    }, [slackConfig]);

    useEffect(() => {
        if (teamsConfig) {
            setTeamsForm({
                provider: 'teams',
                teams_webhook_url: teamsConfig.teams_tenant_id || '', // webhook URL stored here
                teams_channel_id: teamsConfig.teams_channel_id || '',
                notify_on_claim_submitted: teamsConfig.notify_on_claim_submitted ?? true,
                notify_on_claim_approved: teamsConfig.notify_on_claim_approved ?? true,
                notify_on_claim_rejected: teamsConfig.notify_on_claim_rejected ?? true,
            });
        }
    }, [teamsConfig]);

    const handleSaveSlack = () => {
        const data = {
            provider: 'slack',
            slack_workspace_id: slackForm.webhook_url,
            slack_channel_id: slackForm.slack_channel_id,
            notify_on_claim_submitted: slackForm.notify_on_claim_submitted,
            notify_on_claim_approved: slackForm.notify_on_claim_approved,
            notify_on_claim_rejected: slackForm.notify_on_claim_rejected,
            is_active: true,
        };

        if (slackConfig) {
            updateCommunicationConfigMutation.mutate(
                { provider: 'slack', data },
                {
                    onSuccess: () => toast.success('Slack configuration updated'),
                    onError: () => toast.error('Failed to update Slack configuration'),
                }
            );
        } else {
            createCommunicationConfigMutation.mutate(
                data as CommunicationConfigCreate,
                {
                    onSuccess: () => toast.success('Slack configuration created'),
                    onError: () => toast.error('Failed to create Slack configuration'),
                }
            );
        }
    };

    const handleSaveTeams = () => {
        const data = {
            provider: 'teams',
            teams_webhook_url: teamsForm.teams_webhook_url,
            teams_channel_id: teamsForm.teams_channel_id,
            notify_on_claim_submitted: teamsForm.notify_on_claim_submitted,
            notify_on_claim_approved: teamsForm.notify_on_claim_approved,
            notify_on_claim_rejected: teamsForm.notify_on_claim_rejected,
            is_active: true,
        };

        if (teamsConfig) {
            updateCommunicationConfigMutation.mutate(
                { provider: 'teams', data },
                {
                    onSuccess: () => toast.success('Teams configuration updated'),
                    onError: () => toast.error('Failed to update Teams configuration'),
                }
            );
        } else {
            createCommunicationConfigMutation.mutate(
                data as CommunicationConfigCreate,
                {
                    onSuccess: () => toast.success('Teams configuration created'),
                    onError: () => toast.error('Failed to create Teams configuration'),
                }
            );
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    Communication Integrations
                </CardTitle>
                <CardDescription>
                    Send claim notifications to Slack or Microsoft Teams channels
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {isLoading ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                ) : (
                    <>
                        {/* Slack Integration */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-[#4A154B] rounded flex items-center justify-center">
                                        <span className="text-white font-bold text-sm">#</span>
                                    </div>
                                    <div className="space-y-0.5">
                                        <Label className="text-base font-medium">Slack</Label>
                                        <p className="text-sm text-muted-foreground">
                                            Post notifications to Slack channels
                                        </p>
                                    </div>
                                </div>
                                {slackConfig && (
                                    <Badge variant={slackConfig.is_active ? "default" : "secondary"}>
                                        {slackConfig.is_active ? 'Active' : 'Inactive'}
                                    </Badge>
                                )}
                            </div>
                            <div className="space-y-4 p-4 border rounded-md bg-muted/30 ml-11">
                                <div className="space-y-2">
                                    <Label>Webhook URL</Label>
                                    <Input
                                        placeholder="https://hooks.slack.com/services/..."
                                        value={slackForm.webhook_url}
                                        onChange={(e) => setSlackForm({ ...slackForm, webhook_url: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Default Channel</Label>
                                    <Input
                                        placeholder="#expense-notifications"
                                        value={slackForm.slack_channel_id}
                                        onChange={(e) => setSlackForm({ ...slackForm, slack_channel_id: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-3">
                                    <Label>Notification Events</Label>
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm">New claim submitted</span>
                                        <Switch
                                            checked={slackForm.notify_on_claim_submitted}
                                            onCheckedChange={(checked) => setSlackForm({ ...slackForm, notify_on_claim_submitted: checked })}
                                        />
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm">Claim approved</span>
                                        <Switch
                                            checked={slackForm.notify_on_claim_approved}
                                            onCheckedChange={(checked) => setSlackForm({ ...slackForm, notify_on_claim_approved: checked })}
                                        />
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm">Claim rejected</span>
                                        <Switch
                                            checked={slackForm.notify_on_claim_rejected}
                                            onCheckedChange={(checked) => setSlackForm({ ...slackForm, notify_on_claim_rejected: checked })}
                                        />
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <Button
                                        size="sm"
                                        className="gap-2"
                                        onClick={handleSaveSlack}
                                        disabled={createCommunicationConfigMutation.isPending || updateCommunicationConfigMutation.isPending}
                                    >
                                        {(createCommunicationConfigMutation.isPending || updateCommunicationConfigMutation.isPending) ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <Save className="h-4 w-4" />
                                        )}
                                        Save
                                    </Button>
                                    {slackConfig && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="gap-2"
                                            onClick={() => {
                                                testCommunicationMutation.mutate('slack', {
                                                    onSuccess: () => toast.success('Test message sent to Slack'),
                                                    onError: () => toast.error('Failed to send test message'),
                                                });
                                            }}
                                            disabled={testCommunicationMutation.isPending}
                                        >
                                            {testCommunicationMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                            Test
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </div>

                        <Separator />

                        {/* Microsoft Teams Integration */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-[#6264A7] rounded flex items-center justify-center">
                                        <span className="text-white font-bold text-sm">T</span>
                                    </div>
                                    <div className="space-y-0.5">
                                        <Label className="text-base font-medium">Microsoft Teams</Label>
                                        <p className="text-sm text-muted-foreground">
                                            Post notifications to Teams channels
                                        </p>
                                    </div>
                                </div>
                                {teamsConfig && (
                                    <Badge variant={teamsConfig.is_active ? "default" : "secondary"}>
                                        {teamsConfig.is_active ? 'Active' : 'Inactive'}
                                    </Badge>
                                )}
                            </div>
                            <div className="space-y-4 p-4 border rounded-md bg-muted/30 ml-11">
                                <div className="space-y-2">
                                    <Label>Incoming Webhook URL</Label>
                                    <Input
                                        placeholder="https://outlook.office.com/webhook/..."
                                        value={teamsForm.teams_webhook_url}
                                        onChange={(e) => setTeamsForm({ ...teamsForm, teams_webhook_url: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Channel Name (Optional)</Label>
                                    <Input
                                        placeholder="Expense Notifications"
                                        value={teamsForm.teams_channel_id}
                                        onChange={(e) => setTeamsForm({ ...teamsForm, teams_channel_id: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-3">
                                    <Label>Notification Events</Label>
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm">New claim submitted</span>
                                        <Switch
                                            checked={teamsForm.notify_on_claim_submitted}
                                            onCheckedChange={(checked) => setTeamsForm({ ...teamsForm, notify_on_claim_submitted: checked })}
                                        />
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm">Claim approved</span>
                                        <Switch
                                            checked={teamsForm.notify_on_claim_approved}
                                            onCheckedChange={(checked) => setTeamsForm({ ...teamsForm, notify_on_claim_approved: checked })}
                                        />
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm">Claim rejected</span>
                                        <Switch
                                            checked={teamsForm.notify_on_claim_rejected}
                                            onCheckedChange={(checked) => setTeamsForm({ ...teamsForm, notify_on_claim_rejected: checked })}
                                        />
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <Button
                                        size="sm"
                                        className="gap-2"
                                        onClick={handleSaveTeams}
                                        disabled={createCommunicationConfigMutation.isPending || updateCommunicationConfigMutation.isPending}
                                    >
                                        {(createCommunicationConfigMutation.isPending || updateCommunicationConfigMutation.isPending) ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <Save className="h-4 w-4" />
                                        )}
                                        Save
                                    </Button>
                                    {teamsConfig && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="gap-2"
                                            onClick={() => {
                                                testCommunicationMutation.mutate('teams', {
                                                    onSuccess: () => toast.success('Test message sent to Teams'),
                                                    onError: () => toast.error('Failed to send test message'),
                                                });
                                            }}
                                            disabled={testCommunicationMutation.isPending}
                                        >
                                            {testCommunicationMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                            Test
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </CardContent>
        </Card>
    );
}

export default CommunicationIntegrations;
