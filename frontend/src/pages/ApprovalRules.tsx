import { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon,
  Save,
  X,
  Loader2,
  Shield,
  ShieldCheck,
  Info,
  Zap,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { toast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { ApprovalSkipRulesManager } from '@/components/ApprovalSkipRulesManager';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

// Types for auto-approval settings
interface AutoApprovalSettings {
  auto_approval: boolean;
  enable_auto_approval: boolean;
  auto_skip_after_manager: boolean;
  auto_approval_threshold: number;
  max_auto_approval_amount: number;
  policy_compliance_threshold: number;
}

// API functions
async function fetchGeneralSettings(tenantId?: string): Promise<AutoApprovalSettings> {
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

async function updateGeneralSettings(settings: Partial<AutoApprovalSettings>, tenantId?: string): Promise<AutoApprovalSettings> {
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

export default function ApprovalRules() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('auto-approval');

  // Fetch settings from backend
  const { data: savedSettings, isLoading, error } = useQuery({
    queryKey: ['autoApprovalSettings', user?.tenantId],
    queryFn: () => fetchGeneralSettings(user?.tenantId),
    enabled: !!user?.tenantId,
  });

  // Local state for form
  const [formData, setFormData] = useState<AutoApprovalSettings>({
    auto_approval: true,
    enable_auto_approval: true,
    auto_skip_after_manager: true,
    auto_approval_threshold: 95,
    max_auto_approval_amount: 5000,
    policy_compliance_threshold: 80,
  });

  // Track if form has changes
  const [hasChanges, setHasChanges] = useState(false);

  // Update local state when saved settings load
  useEffect(() => {
    if (savedSettings) {
      setFormData({
        auto_approval: savedSettings.auto_approval ?? true,
        enable_auto_approval: savedSettings.enable_auto_approval ?? true,
        auto_skip_after_manager: savedSettings.auto_skip_after_manager ?? true,
        auto_approval_threshold: savedSettings.auto_approval_threshold ?? 95,
        max_auto_approval_amount: savedSettings.max_auto_approval_amount ?? 5000,
        policy_compliance_threshold: savedSettings.policy_compliance_threshold ?? 80,
      });
      setHasChanges(false);
    }
  }, [savedSettings]);

  // Check for changes
  useEffect(() => {
    if (savedSettings) {
      const changed = 
        formData.auto_approval !== (savedSettings.auto_approval ?? true) ||
        formData.enable_auto_approval !== (savedSettings.enable_auto_approval ?? true) ||
        formData.auto_skip_after_manager !== (savedSettings.auto_skip_after_manager ?? true) ||
        formData.auto_approval_threshold !== (savedSettings.auto_approval_threshold ?? 95) ||
        formData.max_auto_approval_amount !== (savedSettings.max_auto_approval_amount ?? 5000) ||
        formData.policy_compliance_threshold !== (savedSettings.policy_compliance_threshold ?? 80);
      setHasChanges(changed);
    }
  }, [formData, savedSettings]);

  // Mutation for saving settings
  const saveMutation = useMutation({
    mutationFn: (settings: Partial<AutoApprovalSettings>) => updateGeneralSettings(settings, user?.tenantId),
    onSuccess: (data) => {
      queryClient.setQueryData(['autoApprovalSettings', user?.tenantId], data);
      queryClient.invalidateQueries({ queryKey: ['generalSettings', user?.tenantId] });
      setHasChanges(false);
      toast({
        title: 'Settings saved',
        description: 'Auto-approval settings have been saved successfully.',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to save settings. Please try again.',
        variant: 'destructive',
      });
    },
  });

  // Handle form changes
  const handleChange = (key: keyof AutoApprovalSettings, value: boolean | string | number) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  // Handle save
  const handleSave = () => {
    saveMutation.mutate(formData);
  };

  // Handle cancel
  const handleCancel = () => {
    if (savedSettings) {
      setFormData({
        auto_approval: savedSettings.auto_approval ?? true,
        enable_auto_approval: savedSettings.enable_auto_approval ?? true,
        auto_skip_after_manager: savedSettings.auto_skip_after_manager ?? true,
        auto_approval_threshold: savedSettings.auto_approval_threshold ?? 95,
        max_auto_approval_amount: savedSettings.max_auto_approval_amount ?? 5000,
        policy_compliance_threshold: savedSettings.policy_compliance_threshold ?? 80,
      });
      setHasChanges(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Loading approval rules...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-destructive">Failed to load approval rules</p>
        <Button onClick={() => queryClient.invalidateQueries({ queryKey: ['autoApprovalSettings'] })}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Approval Rules</h1>
          <p className="text-muted-foreground">
            Configure auto-approval settings and approval skip rules for faster claim processing
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full max-w-lg grid-cols-2">
          <TabsTrigger value="auto-approval" className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Auto-Approval
          </TabsTrigger>
          <TabsTrigger value="skip-rules" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Skip Rules
          </TabsTrigger>
        </TabsList>

        {/* Auto-Approval Settings Tab */}
        <TabsContent value="auto-approval" className="space-y-4 mt-6">
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
            {/* Info Card */}
            <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/20">
              <CardContent className="pt-6">
                <div className="flex gap-3">
                  <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                      How Auto-Approval Works
                    </p>
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      Claims are automatically approved and sent to Finance when ALL conditions are met:
                      AI confidence ≥ threshold, amount ≤ maximum, and no policy violations.
                      This speeds up processing for routine, compliant expenses.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Auto-Approval Settings Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  Auto-Approval Settings
                </CardTitle>
                <CardDescription>
                  Configure AI-based automatic approval for high-confidence claims
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Auto-Approval</Label>
                    <p className="text-sm text-muted-foreground">
                      Automatically approve claims that meet threshold criteria
                    </p>
                  </div>
                  <Switch
                    checked={formData.auto_approval}
                    onCheckedChange={(checked) => handleChange('auto_approval', checked)}
                  />
                </div>

                {formData.auto_approval && (
                  <>
                    <div className="space-y-3 pl-4 border-l-2 border-muted">
                      {/* Admin Toggle for Enable/Disable Auto-Approval Feature */}
                      <div className="flex items-center justify-between bg-amber-50 dark:bg-amber-900/20 p-3 rounded-md">
                        <div className="space-y-0.5">
                          <Label className="flex items-center gap-2">
                            <Shield className="h-4 w-4 text-amber-600" />
                            Enable Auto-Approval Feature (Admin)
                          </Label>
                          <p className="text-sm text-muted-foreground">
                            Master switch to enable/disable all auto-approval functionality
                          </p>
                        </div>
                        <Switch
                          checked={formData.enable_auto_approval}
                          onCheckedChange={(checked) => handleChange('enable_auto_approval', checked)}
                        />
                      </div>

                      {formData.enable_auto_approval && (
                        <>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Label>AI Confidence Threshold</Label>
                              <span className="text-sm font-medium">{formData.auto_approval_threshold}%</span>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              Minimum AI confidence score required for auto-approval
                            </p>
                            <Slider
                              value={[formData.auto_approval_threshold]}
                              onValueChange={(value) => handleChange('auto_approval_threshold', value[0])}
                              min={50}
                              max={100}
                              step={5}
                              className="w-full"
                            />
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>50%</span>
                              <span>75%</span>
                              <span>100%</span>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label>Maximum Auto-Approval Amount</Label>
                            <p className="text-sm text-muted-foreground">
                              Claims above this amount require manual approval
                            </p>
                            <Input
                              type="number"
                              value={formData.max_auto_approval_amount}
                              onChange={(e) => handleChange('max_auto_approval_amount', parseFloat(e.target.value) || 0)}
                              className="w-[200px]"
                            />
                          </div>

                          <Separator />

                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <Label>Policy Compliance Threshold</Label>
                              <span className="text-sm font-medium">{formData.policy_compliance_threshold}%</span>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              Minimum AI confidence score for policy compliance. Claims must meet both this AND the AI Confidence Threshold for auto-approval.
                            </p>
                            <Slider
                              value={[formData.policy_compliance_threshold]}
                              onValueChange={(value) => handleChange('policy_compliance_threshold', value[0])}
                              min={50}
                              max={100}
                              step={5}
                              className="w-full"
                            />
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>50%</span>
                              <span>75%</span>
                              <span>100%</span>
                            </div>
                          </div>

                          <Separator />

                          {/* Auto-Skip HR/Finance Toggle */}
                          <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-900/20 p-3 rounded-md">
                            <div className="space-y-0.5">
                              <Label>Auto-Skip HR/Finance After Manager Approval</Label>
                              <p className="text-sm text-muted-foreground">
                                When enabled, claims that pass manager approval will skip HR and Finance review if confidence and amount thresholds are met
                              </p>
                            </div>
                            <Switch
                              checked={formData.auto_skip_after_manager}
                              onCheckedChange={(checked) => handleChange('auto_skip_after_manager', checked)}
                            />
                          </div>
                        </>
                      )}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Priority Explanation Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5" />
                  How Rules Interact
                </CardTitle>
                <CardDescription>
                  Understanding the priority between Auto-Approval and Skip Rules
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="p-4 border rounded-lg">
                      <h4 className="font-medium flex items-center gap-2 mb-2">
                        <Users className="h-4 w-4 text-primary" />
                        Skip Rules (Higher Priority)
                      </h4>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        <li>• Based on employee designation/email</li>
                        <li>• Applied at claim creation</li>
                        <li>• CXO/Executive fast-track</li>
                        <li>• Checked FIRST</li>
                      </ul>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <h4 className="font-medium flex items-center gap-2 mb-2">
                        <Zap className="h-4 w-4 text-primary" />
                        Auto-Approval (Lower Priority)
                      </h4>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        <li>• Based on AI confidence score</li>
                        <li>• Applied after validation</li>
                        <li>• High-confidence automation</li>
                        <li>• Checked if no skip rule matched</li>
                      </ul>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    <strong>Important:</strong> If a Skip Rule matches an employee, it takes precedence over Auto-Approval. 
                    Auto-Approval only applies when no Skip Rules match.
                  </p>
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

        {/* Skip Rules Tab */}
        <TabsContent value="skip-rules" className="space-y-4 mt-6">
          {/* Info Card */}
          <Card className="border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/20">
            <CardContent className="pt-6">
              <div className="flex gap-3">
                <Info className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-green-900 dark:text-green-100">
                    How Skip Rules Work
                  </p>
                  <p className="text-sm text-green-700 dark:text-green-300">
                    Skip Rules allow claims to bypass certain approval levels based on employee designation, email, or project.
                    Rules are checked by priority (lower number = higher priority). The first matching rule is applied.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <ApprovalSkipRulesManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}
