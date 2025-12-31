import { useState } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  ShieldCheck,
  User,
  Mail,
  CheckCircle,
  XCircle,
  AlertCircle,
  FolderKanban,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
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
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useFormatting } from '@/hooks/useFormatting';
import {
  useApprovalSkipRules,
  useCreateApprovalSkipRule,
  useUpdateApprovalSkipRule,
  useDeleteApprovalSkipRule,
  useAvailableDesignations,
  useAvailableProjects,
} from '@/hooks/useApprovalSkipRules';
import type { ApprovalSkipRule } from '@/types';

interface ApprovalSkipRuleFormData {
  rule_name: string;
  description: string;
  match_type: 'designation' | 'email' | 'project';
  designations: string[];
  emails: string[];
  project_codes: string[];
  skip_manager_approval: boolean;
  skip_hr_approval: boolean;
  skip_finance_approval: boolean;
  max_amount_threshold: string;
  category_codes: string[];
  priority: number;
  is_active: boolean;
}

const defaultFormData: ApprovalSkipRuleFormData = {
  rule_name: '',
  description: '',
  match_type: 'designation',
  designations: [],
  emails: [],
  project_codes: [],
  skip_manager_approval: true,
  skip_hr_approval: false,
  skip_finance_approval: false,
  max_amount_threshold: '',
  category_codes: [],
  priority: 100,
  is_active: true,
};

export function ApprovalSkipRulesManager() {
  const { user } = useAuth();
  const tenantId = user?.tenantId || '';
  const { formatCurrency, getCurrencySymbol } = useFormatting();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<ApprovalSkipRule | null>(null);
  const [formData, setFormData] = useState<ApprovalSkipRuleFormData>(defaultFormData);
  const [emailInput, setEmailInput] = useState('');
  
  const { data: rules = [], isLoading, error } = useApprovalSkipRules(tenantId, true);
  const { data: designations = [] } = useAvailableDesignations(tenantId);
  const { data: projects = [] } = useAvailableProjects(tenantId);
  const createMutation = useCreateApprovalSkipRule();
  const updateMutation = useUpdateApprovalSkipRule();
  const deleteMutation = useDeleteApprovalSkipRule();

  const handleOpenDialog = (rule?: ApprovalSkipRule) => {
    if (rule) {
      setEditingRule(rule);
      setFormData({
        rule_name: rule.rule_name,
        description: rule.description || '',
        match_type: rule.match_type,
        designations: rule.designations || [],
        emails: rule.emails || [],
        project_codes: rule.project_codes || [],
        skip_manager_approval: rule.skip_manager_approval,
        skip_hr_approval: rule.skip_hr_approval,
        skip_finance_approval: rule.skip_finance_approval,
        max_amount_threshold: rule.max_amount_threshold?.toString() || '',
        category_codes: rule.category_codes || [],
        priority: rule.priority,
        is_active: rule.is_active,
      });
    } else {
      setEditingRule(null);
      setFormData(defaultFormData);
    }
    setEmailInput('');
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingRule(null);
    setFormData(defaultFormData);
    setEmailInput('');
  };

  const handleSubmit = async () => {
    if (!formData.rule_name.trim()) {
      toast.error('Rule name is required');
      return;
    }

    if (formData.match_type === 'designation' && formData.designations.length === 0) {
      toast.error('Please select at least one designation');
      return;
    }

    if (formData.match_type === 'email' && formData.emails.length === 0) {
      toast.error('Please add at least one email address');
      return;
    }

    if (formData.match_type === 'project' && formData.project_codes.length === 0) {
      toast.error('Please select at least one project');
      return;
    }

    if (!formData.skip_manager_approval && !formData.skip_hr_approval && !formData.skip_finance_approval) {
      toast.error('Please select at least one approval level to skip');
      return;
    }

    const payload = {
      rule_name: formData.rule_name.trim(),
      description: formData.description.trim() || undefined,
      match_type: formData.match_type,
      designations: formData.match_type === 'designation' ? formData.designations : [],
      emails: formData.match_type === 'email' ? formData.emails : [],
      project_codes: formData.match_type === 'project' ? formData.project_codes : [],
      skip_manager_approval: formData.skip_manager_approval,
      skip_hr_approval: formData.skip_hr_approval,
      skip_finance_approval: formData.skip_finance_approval,
      max_amount_threshold: formData.max_amount_threshold ? parseFloat(formData.max_amount_threshold) : undefined,
      category_codes: formData.category_codes,
      priority: formData.priority,
      is_active: formData.is_active,
    };

    try {
      if (editingRule) {
        await updateMutation.mutateAsync({
          ruleId: editingRule.id,
          tenantId,
          data: payload,
        });
        toast.success('Rule updated successfully');
      } else {
        await createMutation.mutateAsync({
          tenantId,
          data: payload,
        });
        toast.success('Rule created successfully');
      }
      handleCloseDialog();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save rule');
    }
  };

  const handleDelete = async (rule: ApprovalSkipRule) => {
    try {
      await deleteMutation.mutateAsync({ ruleId: rule.id, tenantId });
      toast.success('Rule deleted successfully');
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete rule');
    }
  };

  const addEmail = () => {
    const email = emailInput.trim().toLowerCase();
    if (!email) return;
    
    // Basic email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error('Please enter a valid email address');
      return;
    }
    
    if (formData.emails.includes(email)) {
      toast.error('Email already added');
      return;
    }
    
    setFormData(prev => ({
      ...prev,
      emails: [...prev.emails, email],
    }));
    setEmailInput('');
  };

  const removeEmail = (email: string) => {
    setFormData(prev => ({
      ...prev,
      emails: prev.emails.filter(e => e !== email),
    }));
  };

  const toggleDesignation = (code: string) => {
    setFormData(prev => ({
      ...prev,
      designations: prev.designations.includes(code)
        ? prev.designations.filter(d => d !== code)
        : [...prev.designations, code],
    }));
  };

  const toggleProject = (code: string) => {
    setFormData(prev => ({
      ...prev,
      project_codes: prev.project_codes.includes(code)
        ? prev.project_codes.filter(p => p !== code)
        : [...prev.project_codes, code],
    }));
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="ml-2">Loading approval skip rules...</span>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8 text-red-500">
          <AlertCircle className="h-6 w-6 mr-2" />
          Failed to load approval skip rules
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            Approval Skip Rules
          </CardTitle>
          <CardDescription>
            Configure rules to automatically skip approval levels for executives or specific employees
          </CardDescription>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="h-4 w-4 mr-2" />
          Add Rule
        </Button>
      </CardHeader>
      <CardContent>
        {rules.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <ShieldCheck className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No approval skip rules configured yet.</p>
            <p className="text-sm">Click "Add Rule" to create your first rule.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rule Name</TableHead>
                <TableHead>Match Type</TableHead>
                <TableHead>Criteria</TableHead>
                <TableHead>Skip Levels</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((rule) => (
                <TableRow key={rule.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{rule.rule_name}</div>
                      {rule.description && (
                        <div className="text-sm text-muted-foreground truncate max-w-xs">
                          {rule.description}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {rule.match_type === 'designation' ? (
                        <User className="h-3 w-3 mr-1" />
                      ) : rule.match_type === 'project' ? (
                        <FolderKanban className="h-3 w-3 mr-1" />
                      ) : (
                        <Mail className="h-3 w-3 mr-1" />
                      )}
                      {rule.match_type}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {rule.match_type === 'designation' ? (
                        <span>{rule.designations?.join(', ') || 'None'}</span>
                      ) : rule.match_type === 'project' ? (
                        <span>{rule.project_codes?.join(', ') || 'None'}</span>
                      ) : (
                        <span>{rule.emails?.length || 0} email(s)</span>
                      )}
                    </div>
                    {rule.max_amount_threshold && (
                      <div className="text-xs text-muted-foreground">
                        Max: {formatCurrency(rule.max_amount_threshold)}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {rule.skip_manager_approval && (
                        <Badge variant="secondary" className="text-xs">Manager</Badge>
                      )}
                      {rule.skip_hr_approval && (
                        <Badge variant="secondary" className="text-xs">HR</Badge>
                      )}
                      {rule.skip_finance_approval && (
                        <Badge variant="secondary" className="text-xs">Finance</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{rule.priority}</TableCell>
                  <TableCell>
                    {rule.is_active ? (
                      <Badge variant="default" className="bg-green-100 text-green-800">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-gray-500">
                        <XCircle className="h-3 w-3 mr-1" />
                        Inactive
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenDialog(rule)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Rule</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete the rule "{rule.rule_name}"? 
                              This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(rule)}
                              className="bg-red-500 hover:bg-red-600"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {/* Create/Edit Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingRule ? 'Edit Approval Skip Rule' : 'Create Approval Skip Rule'}
              </DialogTitle>
              <DialogDescription>
                Configure when approval levels should be automatically skipped
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-4">
              {/* Basic Info */}
              <div className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="rule_name">Rule Name *</Label>
                  <Input
                    id="rule_name"
                    placeholder="e.g., CXO Fast Track"
                    value={formData.rule_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, rule_name: e.target.value }))}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Describe when this rule should apply..."
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  />
                </div>
              </div>

              {/* Match Type */}
              <div className="space-y-4">
                <Label>Match Type *</Label>
                <Select
                  value={formData.match_type}
                  onValueChange={(value: 'designation' | 'email' | 'project') => 
                    setFormData(prev => ({ ...prev, match_type: value, designations: [], emails: [], project_codes: [] }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="designation">
                      <div className="flex items-center">
                        <User className="h-4 w-4 mr-2" />
                        By Designation
                      </div>
                    </SelectItem>
                    <SelectItem value="email">
                      <div className="flex items-center">
                        <Mail className="h-4 w-4 mr-2" />
                        By Email
                      </div>
                    </SelectItem>
                    <SelectItem value="project">
                      <div className="flex items-center">
                        <FolderKanban className="h-4 w-4 mr-2" />
                        By Project
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Designation Selection */}
              {formData.match_type === 'designation' && (
                <div className="space-y-3">
                  <Label>Select Designations *</Label>
                  <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto border rounded-md p-3">
                    {designations.length > 0 ? (
                      designations.map((d) => (
                        <div
                          key={d.code}
                          className={`flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-muted ${
                            formData.designations.includes(d.code) ? 'bg-primary/10 border border-primary' : 'border'
                          }`}
                          onClick={() => toggleDesignation(d.code)}
                        >
                          <CheckCircle
                            className={`h-4 w-4 ${
                              formData.designations.includes(d.code) ? 'text-primary' : 'text-transparent'
                            }`}
                          />
                          <div className="font-medium text-sm">{d.name}</div>
                        </div>
                      ))
                    ) : (
                      <div className="col-span-2 text-center py-4 text-muted-foreground">
                        No designations found. Please add designations first.
                      </div>
                    )}
                  </div>
                  {formData.designations.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {formData.designations.map((d) => (
                        <Badge key={d} variant="secondary">
                          {d}
                          <button
                            className="ml-1 hover:text-red-500"
                            onClick={() => toggleDesignation(d)}
                          >
                            ×
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Email Selection */}
              {formData.match_type === 'email' && (
                <div className="space-y-3">
                  <Label>Email Addresses *</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Enter email address"
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addEmail())}
                    />
                    <Button type="button" onClick={addEmail}>Add</Button>
                  </div>
                  {formData.emails.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {formData.emails.map((email) => (
                        <Badge key={email} variant="secondary" className="py-1">
                          <Mail className="h-3 w-3 mr-1" />
                          {email}
                          <button
                            className="ml-2 hover:text-red-500"
                            onClick={() => removeEmail(email)}
                          >
                            ×
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Project Selection */}
              {formData.match_type === 'project' && (
                <div className="space-y-3">
                  <Label>Select Projects *</Label>
                  <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto border rounded-md p-3">
                    {projects.length > 0 ? (
                      projects.map((p) => (
                        <div
                          key={p.code}
                          className={`flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-muted ${
                            formData.project_codes.includes(p.code) ? 'bg-primary/10 border border-primary' : 'border'
                          }`}
                          onClick={() => toggleProject(p.code)}
                        >
                          <CheckCircle
                            className={`h-4 w-4 ${
                              formData.project_codes.includes(p.code) ? 'text-primary' : 'text-transparent'
                            }`}
                          />
                          <div>
                            <div className="font-medium text-sm">{p.name}</div>
                            <div className="text-xs text-muted-foreground">{p.code}</div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="col-span-2 text-center py-4 text-muted-foreground">
                        No active projects found.
                      </div>
                    )}
                  </div>
                  {formData.project_codes.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {formData.project_codes.map((p) => (
                        <Badge key={p} variant="secondary">
                          <FolderKanban className="h-3 w-3 mr-1" />
                          {p}
                          <button
                            className="ml-1 hover:text-red-500"
                            onClick={() => toggleProject(p)}
                          >
                            ×
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Skip Levels */}
              <div className="space-y-4">
                <Label>Approval Levels to Skip *</Label>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 border rounded-md">
                    <div>
                      <div className="font-medium">Skip Manager Approval</div>
                      <div className="text-sm text-muted-foreground">Claims go directly to HR</div>
                    </div>
                    <Switch
                      checked={formData.skip_manager_approval}
                      onCheckedChange={(checked) => 
                        setFormData(prev => ({ ...prev, skip_manager_approval: checked }))
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded-md">
                    <div>
                      <div className="font-medium">Skip HR Approval</div>
                      <div className="text-sm text-muted-foreground">Claims go directly to Finance</div>
                    </div>
                    <Switch
                      checked={formData.skip_hr_approval}
                      onCheckedChange={(checked) => 
                        setFormData(prev => ({ ...prev, skip_hr_approval: checked }))
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded-md">
                    <div>
                      <div className="font-medium">Skip Finance Approval</div>
                      <div className="text-sm text-muted-foreground">Claims auto-settle after prior approvals</div>
                    </div>
                    <Switch
                      checked={formData.skip_finance_approval}
                      onCheckedChange={(checked) => 
                        setFormData(prev => ({ ...prev, skip_finance_approval: checked }))
                      }
                    />
                  </div>
                </div>
              </div>

              {/* Optional Constraints */}
              <div className="space-y-4">
                <Label>Optional Constraints</Label>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="max_amount">Maximum Amount ({getCurrencySymbol()})</Label>
                    <Input
                      id="max_amount"
                      type="number"
                      placeholder="No limit"
                      value={formData.max_amount_threshold}
                      onChange={(e) => 
                        setFormData(prev => ({ ...prev, max_amount_threshold: e.target.value }))
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Leave empty for no amount limit
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="priority">Priority</Label>
                    <Input
                      id="priority"
                      type="number"
                      value={formData.priority}
                      onChange={(e) => 
                        setFormData(prev => ({ ...prev, priority: parseInt(e.target.value) || 100 }))
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Lower number = higher priority (checked first)
                    </p>
                  </div>
                </div>
              </div>

              {/* Active Status */}
              <div className="flex items-center justify-between p-3 border rounded-md">
                <div>
                  <div className="font-medium">Rule Active</div>
                  <div className="text-sm text-muted-foreground">Enable or disable this rule</div>
                </div>
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(checked) => 
                    setFormData(prev => ({ ...prev, is_active: checked }))
                  }
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleCloseDialog}>
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {(createMutation.isPending || updateMutation.isPending) && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                {editingRule ? 'Update Rule' : 'Create Rule'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
