import { useState, useRef } from 'react';
import {
  FileText,
  Upload,
  Plus,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
  Eye,
  Edit,
  Loader2,
  Trash2,
  Settings,
  PlusCircle,
  Sparkles,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { MultiSelect } from '@/components/ui/multi-select';
import { useRegions } from '@/hooks/useRegions';
import { useFormatting } from '@/hooks/useFormatting';

// Import from extracted modules
import {
  // Types
  type PolicyUpload,
  type PolicyUploadListItem,
  type PolicyCategory,
  type CustomClaim,
  type CustomClaimListItem,
  type CustomFieldDefinition,
  type CustomClaimFormState,
  // Constants
  FIELD_TYPE_OPTIONS,
  FREQUENCY_OPTIONS,
  DEFAULT_CUSTOM_CLAIM_FORM,
  getEmptyCustomField,
  // API functions
  fetchPolicies,
  fetchPolicy,
  uploadPolicy,
  approvePolicy,
  rejectPolicy,
  reExtractPolicy,
  uploadNewVersion,
  fetchCustomClaims,
  fetchCustomClaim,
  createCustomClaim,
  updateCustomClaim,
  deleteCustomClaim,
  toggleCustomClaimStatus,
  // Utils
  getStatusBadge,
  formatFileSize,
} from '@/components/policies';

export default function Policies() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { formatCurrency, formatDate, formatDateTime } = useFormatting();

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch dynamic regions
  const { data: regionList = [] } = useRegions();

  // Map regions to options format for MultiSelect
  const regionOptions = [
    { value: 'GLOBAL', label: 'Global (All Regions)' },
    ...regionList.map(r => ({ value: r.name, label: r.name }))
  ];

  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [isApproveOpen, setIsApproveOpen] = useState(false);
  const [isRejectOpen, setIsRejectOpen] = useState(false);
  const [isNewVersionOpen, setIsNewVersionOpen] = useState(false);
  const [selectedPolicyId, setSelectedPolicyId] = useState<string | null>(null);
  const [selectedPolicyName, setSelectedPolicyName] = useState<string>('');
  const [regionFilter, setRegionFilter] = useState<string>('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const newVersionFileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [uploadForm, setUploadForm] = useState({
    policy_name: '',
    description: '',
    region: [] as string[],
    file: null as File | null,
  });
  const [newVersionForm, setNewVersionForm] = useState({
    description: '',
    region: [] as string[],
    file: null as File | null,
  });
  const [approveNotes, setApproveNotes] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [rejectNotes, setRejectNotes] = useState('');

  // Custom Claims State
  const [isCreateCustomClaimOpen, setIsCreateCustomClaimOpen] = useState(false);
  const [isViewCustomClaimOpen, setIsViewCustomClaimOpen] = useState(false);
  const [isEditCustomClaimOpen, setIsEditCustomClaimOpen] = useState(false);
  const [selectedCustomClaimId, setSelectedCustomClaimId] = useState<string | null>(null);
  const [customClaimRegionFilter, setCustomClaimRegionFilter] = useState<string>('');

  // Custom Claim Form State
  const [customClaimForm, setCustomClaimForm] = useState<{
    claim_name: string;
    description: string;
    category_type: 'REIMBURSEMENT' | 'ALLOWANCE';
    region: string[];
    max_amount: string;
    min_amount: string;
    default_amount: string;
    currency: string;
    frequency_limit: string;
    frequency_count: string;
    requires_receipt: boolean;
    requires_approval_above: string;
    submission_window_days: string;
    custom_fields: CustomFieldDefinition[];
  }>({
    claim_name: '',
    description: '',
    category_type: 'REIMBURSEMENT',
    region: [] as string[],
    max_amount: '',
    min_amount: '',
    default_amount: '',
    currency: 'INR',
    frequency_limit: '',
    frequency_count: '',
    requires_receipt: true,
    requires_approval_above: '',
    submission_window_days: '',
    custom_fields: [],
  });

  const resetCustomClaimForm = () => {
    setCustomClaimForm({
      claim_name: '',
      description: '',
      category_type: 'REIMBURSEMENT',
      region: [],
      max_amount: '',
      min_amount: '',
      default_amount: '',
      currency: 'INR',
      frequency_limit: '',
      frequency_count: '',
      requires_receipt: true,
      requires_approval_above: '',
      submission_window_days: '',
      custom_fields: [],
    });
  };

  // Queries
  const { data: policies, isLoading, error } = useQuery({
    queryKey: ['policies', user?.tenantId],
    queryFn: () => user?.tenantId ? fetchPolicies(user.tenantId) : Promise.resolve([]),
    enabled: !!user?.tenantId,
  });

  const { data: customClaims, isLoading: isLoadingCustomClaims } = useQuery({
    queryKey: ['custom-claims', user?.tenantId],
    queryFn: () => user?.tenantId ? fetchCustomClaims(user.tenantId) : Promise.resolve([]),
    enabled: !!user?.tenantId,
  });

  const { data: selectedPolicy, isLoading: isLoadingPolicy } = useQuery({
    queryKey: ['policy', selectedPolicyId, user?.tenantId],
    queryFn: () => (selectedPolicyId && user?.tenantId) ? fetchPolicy(selectedPolicyId, user.tenantId) : null,
    enabled: !!selectedPolicyId && !!user?.tenantId && (isViewOpen || isApproveOpen),
  });

  const { data: selectedCustomClaim, isLoading: isLoadingCustomClaim } = useQuery({
    queryKey: ['custom-claim', selectedCustomClaimId, user?.tenantId],
    queryFn: () => (selectedCustomClaimId && user?.tenantId) ? fetchCustomClaim(selectedCustomClaimId, user.tenantId) : null,
    enabled: !!selectedCustomClaimId && !!user?.tenantId && (isViewCustomClaimOpen || isEditCustomClaimOpen),
  });

  // Mutations
  const uploadMutation = useMutation({
    mutationFn: uploadPolicy,
    onSuccess: () => {
      toast({ title: 'Success', description: 'Policy uploaded successfully. AI extraction in progress.' });
      setIsUploadOpen(false);
      setUploadForm({ policy_name: '', description: '', region: [], file: null });
      queryClient.invalidateQueries({ queryKey: ['policies'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { review_notes?: string; effective_from?: string; approved_by?: string } }) =>
      approvePolicy(id, data, user?.tenantId || ''),
    onSuccess: () => {
      toast({ title: 'Success', description: 'Policy approved and activated.' });
      setIsApproveOpen(false);
      setApproveNotes('');
      setEffectiveFrom('');
      queryClient.invalidateQueries({ queryKey: ['policies'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes: string }) => rejectPolicy(id, notes, user?.tenantId || ''),
    onSuccess: () => {
      toast({ title: 'Success', description: 'Policy rejected.' });
      setIsRejectOpen(false);
      setRejectNotes('');
      queryClient.invalidateQueries({ queryKey: ['policies'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const reExtractMutation = useMutation({
    mutationFn: (id: string) => reExtractPolicy(id, user?.tenantId || ''),
    onSuccess: () => {
      toast({ title: 'Success', description: 'Re-extraction started. Refresh in a moment.' });
      queryClient.invalidateQueries({ queryKey: ['policies'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const newVersionMutation = useMutation({
    mutationFn: ({ id, formData }: { id: string; formData: FormData }) => uploadNewVersion(id, formData, user?.tenantId || ''),
    onSuccess: () => {
      toast({ title: 'Success', description: 'New version uploaded successfully. AI extraction in progress.' });
      setIsNewVersionOpen(false);
      setNewVersionForm({ description: '', region: [], file: null });
      queryClient.invalidateQueries({ queryKey: ['policies'] });
      queryClient.invalidateQueries({ queryKey: ['extracted-claims'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Custom Claims Mutations
  const createCustomClaimMutation = useMutation({
    mutationFn: (data: Partial<CustomClaim>) => createCustomClaim(data, user?.id || '', user?.tenantId || ''),
    onSuccess: () => {
      toast({ title: 'Success', description: 'Custom claim created successfully.' });
      setIsCreateCustomClaimOpen(false);
      resetCustomClaimForm();
      queryClient.invalidateQueries({ queryKey: ['custom-claims'] });
      queryClient.invalidateQueries({ queryKey: ['extracted-claims'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const updateCustomClaimMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CustomClaim> }) =>
      updateCustomClaim(id, data, user?.id || '', user?.tenantId || ''),
    onSuccess: () => {
      toast({ title: 'Success', description: 'Custom claim updated successfully.' });
      setIsEditCustomClaimOpen(false);
      resetCustomClaimForm();
      queryClient.invalidateQueries({ queryKey: ['custom-claims'] });
      queryClient.invalidateQueries({ queryKey: ['custom-claim', selectedCustomClaimId] });
      queryClient.invalidateQueries({ queryKey: ['extracted-claims'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const deleteCustomClaimMutation = useMutation({
    mutationFn: (id: string) => deleteCustomClaim(id, user?.tenantId || ''),
    onSuccess: () => {
      toast({ title: 'Success', description: 'Custom claim deleted successfully.' });
      queryClient.invalidateQueries({ queryKey: ['custom-claims'] });
      queryClient.invalidateQueries({ queryKey: ['extracted-claims'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const toggleCustomClaimStatusMutation = useMutation({
    mutationFn: (id: string) => toggleCustomClaimStatus(id, user?.id || '', user?.tenantId || ''),
    onSuccess: () => {
      toast({ title: 'Success', description: 'Custom claim status updated.' });
      queryClient.invalidateQueries({ queryKey: ['custom-claims'] });
      queryClient.invalidateQueries({ queryKey: ['extracted-claims'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const handleUpload = () => {
    if (!uploadForm.file || !uploadForm.policy_name) {
      toast({ title: 'Error', description: 'Please provide a policy name and file.', variant: 'destructive' });
      return;
    }

    // Validate region is provided
    if (!uploadForm.region || uploadForm.region.length === 0) {
      toast({ title: 'Error', description: 'Please select at least one region.', variant: 'destructive' });
      return;
    }

    const formData = new FormData();
    formData.append('file', uploadForm.file);
    formData.append('policy_name', uploadForm.policy_name);
    if (uploadForm.description) {
      formData.append('description', uploadForm.description);
    }

    if (uploadForm.region && uploadForm.region.length > 0) {
      // Append each region separately for List[str] binding
      uploadForm.region.forEach(r => formData.append('region', r));
    }
    formData.append('uploaded_by', user?.id || '');
    if (user?.tenantId) {
      formData.append('tenant_id', user.tenantId);
    }

    uploadMutation.mutate(formData);
  };

  const handleApprove = () => {
    if (!selectedPolicyId) return;
    approveMutation.mutate({
      id: selectedPolicyId,
      data: {
        review_notes: approveNotes || undefined,
        effective_from: effectiveFrom || undefined,
        approved_by: user?.id,  // Pass current user as approver
      },
    });
  };

  const handleReject = () => {
    if (!selectedPolicyId || !rejectNotes.trim()) {
      toast({ title: 'Error', description: 'Please provide rejection notes.', variant: 'destructive' });
      return;
    }
    rejectMutation.mutate({ id: selectedPolicyId, notes: rejectNotes });
  };

  const toggleCategoryExpand = (categoryId: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpandedCategories(newExpanded);
  };

  const handleNewVersionUpload = () => {
    if (!newVersionForm.file || !selectedPolicyId) {
      toast({ title: 'Error', description: 'Please select a file.', variant: 'destructive' });
      return;
    }

    // Validate region is provided for new version
    if (!newVersionForm.region || newVersionForm.region.length === 0) {
      toast({ title: 'Error', description: 'Please select at least one region.', variant: 'destructive' });
      return;
    }

    const formData = new FormData();
    formData.append('file', newVersionForm.file);
    if (newVersionForm.description) {
      formData.append('description', newVersionForm.description);
    }

    if (newVersionForm.region && newVersionForm.region.length > 0) {
      newVersionForm.region.forEach(r => formData.append('region', r));
    }
    formData.append('uploaded_by', user?.id || '');

    newVersionMutation.mutate({ id: selectedPolicyId, formData });
  };

  // Custom Claims Handlers
  const addCustomField = () => {
    setCustomClaimForm(prev => ({
      ...prev,
      custom_fields: [...prev.custom_fields, getEmptyCustomField()],
    }));
  };

  const removeCustomField = (index: number) => {
    setCustomClaimForm(prev => ({
      ...prev,
      custom_fields: prev.custom_fields.filter((_, i) => i !== index),
    }));
  };

  const updateCustomField = (index: number, field: Partial<CustomFieldDefinition>) => {
    setCustomClaimForm(prev => ({
      ...prev,
      custom_fields: prev.custom_fields.map((f, i) =>
        i === index ? { ...f, ...field } : f
      ),
    }));
  };

  const handleCreateCustomClaim = () => {
    if (!customClaimForm.claim_name.trim()) {
      toast({ title: 'Error', description: 'Please provide a claim name.', variant: 'destructive' });
      return;
    }

    // Validate region is provided
    if (!customClaimForm.region || customClaimForm.region.length === 0) {
      toast({ title: 'Error', description: 'Please select at least one region.', variant: 'destructive' });
      return;
    }

    // Validate custom fields
    for (const field of customClaimForm.custom_fields) {
      if (!field.name.trim() || !field.label.trim()) {
        toast({ title: 'Error', description: 'All custom fields must have a name and label.', variant: 'destructive' });
        return;
      }
      // Validate field name format (no spaces, alphanumeric and underscore only)
      if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(field.name)) {
        toast({ title: 'Error', description: `Field name "${field.name}" is invalid. Use letters, numbers, and underscores only, starting with a letter.`, variant: 'destructive' });
        return;
      }
    }

    const data: Partial<CustomClaim> = {
      claim_name: customClaimForm.claim_name,
      description: customClaimForm.description || undefined,
      category_type: customClaimForm.category_type,
      region: customClaimForm.region || undefined,
      max_amount: customClaimForm.max_amount ? parseFloat(customClaimForm.max_amount) : undefined,
      min_amount: customClaimForm.min_amount ? parseFloat(customClaimForm.min_amount) : undefined,
      default_amount: customClaimForm.default_amount ? parseFloat(customClaimForm.default_amount) : undefined,
      currency: customClaimForm.currency,
      frequency_limit: customClaimForm.frequency_limit || undefined,
      frequency_count: customClaimForm.frequency_count ? parseInt(customClaimForm.frequency_count) : undefined,
      requires_receipt: customClaimForm.requires_receipt,
      requires_approval_above: customClaimForm.requires_approval_above ? parseFloat(customClaimForm.requires_approval_above) : undefined,
      submission_window_days: customClaimForm.submission_window_days ? parseInt(customClaimForm.submission_window_days) : undefined,
      custom_fields: customClaimForm.custom_fields,
    };

    createCustomClaimMutation.mutate(data);
  };

  const handleEditCustomClaim = () => {
    if (!selectedCustomClaimId || !customClaimForm.claim_name.trim()) {
      toast({ title: 'Error', description: 'Please provide a claim name.', variant: 'destructive' });
      return;
    }

    const data: Partial<CustomClaim> = {
      claim_name: customClaimForm.claim_name,
      description: customClaimForm.description || undefined,
      category_type: customClaimForm.category_type,
      region: customClaimForm.region || undefined,
      max_amount: customClaimForm.max_amount ? parseFloat(customClaimForm.max_amount) : undefined,
      min_amount: customClaimForm.min_amount ? parseFloat(customClaimForm.min_amount) : undefined,
      default_amount: customClaimForm.default_amount ? parseFloat(customClaimForm.default_amount) : undefined,
      currency: customClaimForm.currency,
      frequency_limit: customClaimForm.frequency_limit || undefined,
      frequency_count: customClaimForm.frequency_count ? parseInt(customClaimForm.frequency_count) : undefined,
      requires_receipt: customClaimForm.requires_receipt,
      requires_approval_above: customClaimForm.requires_approval_above ? parseFloat(customClaimForm.requires_approval_above) : undefined,
      submission_window_days: customClaimForm.submission_window_days ? parseInt(customClaimForm.submission_window_days) : undefined,
      custom_fields: customClaimForm.custom_fields,
    };

    updateCustomClaimMutation.mutate({ id: selectedCustomClaimId, data });
  };

  const openEditCustomClaim = (claim: CustomClaim) => {
    setCustomClaimForm({
      claim_name: claim.claim_name,
      description: claim.description || '',
      category_type: claim.category_type,
      region: claim.region || [],
      max_amount: claim.max_amount?.toString() || '',
      min_amount: claim.min_amount?.toString() || '',
      default_amount: claim.default_amount?.toString() || '',
      currency: claim.currency,
      frequency_limit: claim.frequency_limit || '',
      frequency_count: claim.frequency_count?.toString() || '',
      requires_receipt: claim.requires_receipt,
      requires_approval_above: claim.requires_approval_above?.toString() || '',
      submission_window_days: claim.submission_window_days?.toString() || '',
      custom_fields: claim.custom_fields || [],
    });
    setSelectedCustomClaimId(claim.id);
    setIsEditCustomClaimOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 text-destructive">
        <AlertCircle className="h-8 w-8 mr-2" />
        <span>Failed to load policies</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Policy Management</h1>
          <p className="text-muted-foreground">
            Upload policy documents and manage extracted claim categories
          </p>
        </div>
        <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Policy
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Upload Policy Document</DialogTitle>
              <DialogDescription>
                Upload a policy document (PDF, DOCX, or image). AI will automatically extract claim categories and rules.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="policy_name">Policy Name *</Label>
                <Input
                  id="policy_name"
                  value={uploadForm.policy_name}
                  onChange={(e) => setUploadForm({ ...uploadForm, policy_name: e.target.value })}
                  placeholder="e.g., Travel & Expense Policy 2024"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description" className="flex items-center gap-2">
                  Description
                  <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                    <Sparkles className="h-3 w-3 mr-1" />
                    AI-Assisted
                  </Badge>
                </Label>
                <Textarea
                  id="description"
                  value={uploadForm.description}
                  onChange={(e) => setUploadForm({ ...uploadForm, description: e.target.value })}
                  placeholder="Describe the policy purpose, target employees, key expense types covered..."
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">
                  <span className="text-blue-600 font-medium">AI Tip:</span> This description will be used by AI to better understand and extract claim categories from your policy document.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="region">Region / Location</Label>
                <MultiSelect
                  options={regionOptions}
                  selected={uploadForm.region || []}
                  onChange={(selected) => setUploadForm({ ...uploadForm, region: selected })}
                  placeholder="Select regions..."
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">
                  Select the region this policy applies to. Leave empty for global policies.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Policy Document *</Label>
                <div
                  className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.docx,.jpg,.jpeg,.png"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setUploadForm({ ...uploadForm, file });
                      }
                    }}
                  />
                  {uploadForm.file ? (
                    <div className="flex items-center justify-center gap-2">
                      <FileText className="h-8 w-8 text-primary" />
                      <div>
                        <p className="font-medium">{uploadForm.file.name}</p>
                        <p className="text-sm text-muted-foreground">{formatFileSize(uploadForm.file.size)}</p>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                      <p className="text-muted-foreground">Click to upload or drag and drop</p>
                      <p className="text-xs text-muted-foreground mt-1">PDF, DOCX, JPG, PNG (max 10MB)</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsUploadOpen(false)}>Cancel</Button>
              <Button onClick={handleUpload} disabled={uploadMutation.isPending}>
                {uploadMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Upload
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Policies</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{policies?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {policies?.filter(p => p.is_active).length || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending Review</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {policies?.filter(p => p.status === 'EXTRACTED').length || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Categories</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {policies?.reduce((sum, p) => sum + p.categories_count, 0) || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Policies List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Policy Documents</CardTitle>
              <CardDescription>
                Uploaded policy documents and their extraction status
              </CardDescription>
            </div>
            <div className="w-48">
              <Select value={regionFilter} onValueChange={setRegionFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by Region" />
                </SelectTrigger>
                <SelectContent>
                  {regionOptions.map((option) => (
                    <SelectItem key={option.value || 'all'} value={option.value || ' '}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {(() => {
            const filteredPolicies = policies?.filter(p =>
              !regionFilter || regionFilter === ' ' || p.region === regionFilter || (!p.region && regionFilter === ' ')
            );

            if (!filteredPolicies || filteredPolicies.length === 0) {
              return (
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">
                    {regionFilter && regionFilter !== ' ' ? 'No policies found for this region' : 'No policies uploaded'}
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    {regionFilter && regionFilter !== ' '
                      ? 'Try selecting a different region or clear the filter.'
                      : 'Upload a policy document to get started with AI-powered category extraction.'}
                  </p>
                  {(!regionFilter || regionFilter === ' ') && (
                    <Button onClick={() => setIsUploadOpen(true)}>
                      <Upload className="h-4 w-4 mr-2" />
                      Upload First Policy
                    </Button>
                  )}
                </div>
              );
            }

            return (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Policy</TableHead>
                    <TableHead>Region</TableHead>
                    <TableHead>File</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Categories</TableHead>
                    <TableHead>Uploaded</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPolicies.map((policy) => (
                    <TableRow key={policy.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{policy.policy_name}</p>
                          <p className="text-sm text-muted-foreground">{policy.policy_number}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {policy.region || 'Global'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{policy.file_name}</span>
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(policy.status)}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{policy.categories_count} categories</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(new Date(policy.created_at))}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedPolicyId(policy.id);
                              setIsViewOpen(true);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {policy.status === 'EXTRACTED' && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-green-600"
                                onClick={() => {
                                  setSelectedPolicyId(policy.id);
                                  setIsApproveOpen(true);
                                }}
                              >
                                <CheckCircle className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-600"
                                onClick={() => {
                                  setSelectedPolicyId(policy.id);
                                  setIsRejectOpen(true);
                                }}
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          {policy.status === 'ACTIVE' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              title="Upload new version"
                              onClick={() => {
                                setSelectedPolicyId(policy.id);
                                setSelectedPolicyName(policy.policy_name);
                                setIsNewVersionOpen(true);
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            );
          })()}
        </CardContent>
      </Card>

      {/* Custom Claims Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Custom Claims
              </CardTitle>
              <CardDescription>
                Standalone claim definitions not linked to any policy document
              </CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-48">
                <Select value={customClaimRegionFilter} onValueChange={setCustomClaimRegionFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by Region" />
                  </SelectTrigger>
                  <SelectContent>
                    {regionOptions.map((option) => (
                      <SelectItem key={option.value || 'all'} value={option.value || ' '}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={() => setIsCreateCustomClaimOpen(true)}>
                <PlusCircle className="h-4 w-4 mr-2" />
                Create Claim
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingCustomClaims ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (() => {
            const filteredCustomClaims = customClaims?.filter(cc =>
              !customClaimRegionFilter || customClaimRegionFilter === ' ' ||
              cc.region === customClaimRegionFilter || (!cc.region && customClaimRegionFilter === ' ')
            );

            if (!filteredCustomClaims || filteredCustomClaims.length === 0) {
              return (
                <div className="text-center py-12">
                  <Settings className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">
                    {customClaimRegionFilter && customClaimRegionFilter !== ' '
                      ? 'No custom claims found for this region'
                      : 'No custom claims defined'}
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    {customClaimRegionFilter && customClaimRegionFilter !== ' '
                      ? 'Try selecting a different region or clear the filter.'
                      : 'Create custom claim definitions for reimbursements and allowances.'}
                  </p>
                  {(!customClaimRegionFilter || customClaimRegionFilter === ' ') && (
                    <Button onClick={() => setIsCreateCustomClaimOpen(true)}>
                      <PlusCircle className="h-4 w-4 mr-2" />
                      Create First Custom Claim
                    </Button>
                  )}
                </div>
              );
            }

            return (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Claim Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Region</TableHead>
                    <TableHead>Max Amount</TableHead>
                    <TableHead>Fields</TableHead>
                    <TableHead>Receipt</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCustomClaims.map((claim) => (
                    <TableRow key={claim.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{claim.claim_name}</p>
                          <p className="text-sm text-muted-foreground">{claim.claim_code}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={claim.category_type === 'REIMBURSEMENT' ? 'default' : 'secondary'}>
                          {claim.category_type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {claim.region || 'Global'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {claim.max_amount
                          ? `${claim.currency} ${claim.max_amount.toLocaleString()}`
                          : 'No limit'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{claim.fields_count} fields</Badge>
                      </TableCell>
                      <TableCell>
                        {claim.requires_receipt ? (
                          <Badge variant="outline" className="text-green-600">Required</Badge>
                        ) : (
                          <Badge variant="outline" className="text-gray-500">Optional</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {claim.is_active ? (
                          <Badge className="bg-green-100 text-green-700">Active</Badge>
                        ) : (
                          <Badge variant="outline" className="text-gray-500">Inactive</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedCustomClaimId(claim.id);
                              setIsViewCustomClaimOpen(true);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={async () => {
                              if (user?.tenantId) {
                                const fullClaim = await fetchCustomClaim(claim.id, user.tenantId);
                                openEditCustomClaim(fullClaim);
                              }
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className={claim.is_active ? 'text-orange-600' : 'text-green-600'}
                            onClick={() => toggleCustomClaimStatusMutation.mutate(claim.id)}
                          >
                            {claim.is_active ? <XCircle className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600"
                            onClick={() => {
                              if (confirm('Are you sure you want to delete this custom claim?')) {
                                deleteCustomClaimMutation.mutate(claim.id);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            );
          })()}
        </CardContent>
      </Card>

      {/* View Policy Dialog */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Policy Details</DialogTitle>
            <DialogDescription>
              {selectedPolicy?.policy_name} ({selectedPolicy?.policy_number})
            </DialogDescription>
          </DialogHeader>
          {isLoadingPolicy ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : selectedPolicy ? (
            <div className="space-y-6">
              {/* Policy Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <div className="mt-1">{getStatusBadge(selectedPolicy.status)}</div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Version</Label>
                  <p className="mt-1">v{selectedPolicy.version}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Region</Label>
                  <div className="mt-1">
                    <Badge variant="outline">{selectedPolicy.region || 'Global'}</Badge>
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground">File</Label>
                  <p className="mt-1">{selectedPolicy.file_name} ({formatFileSize(selectedPolicy.file_size)})</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Uploaded</Label>
                  <p className="mt-1">{formatDateTime(new Date(selectedPolicy.created_at))}</p>
                </div>
              </div>

              {selectedPolicy.description && (
                <div>
                  <Label className="text-muted-foreground">Description</Label>
                  <p className="mt-1">{selectedPolicy.description}</p>
                </div>
              )}

              <Separator />

              {/* Extracted Categories */}
              <div>
                <h3 className="text-lg font-semibold mb-4">
                  Extracted Categories ({selectedPolicy.categories.length})
                </h3>
                {selectedPolicy.categories.length === 0 ? (
                  <p className="text-muted-foreground">No categories extracted yet.</p>
                ) : (
                  <div className="space-y-3">
                    {selectedPolicy.categories.map((category) => (
                      <Card key={category.id} className="overflow-hidden">
                        <div
                          className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50"
                          onClick={() => toggleCategoryExpand(category.id)}
                        >
                          <div className="flex items-center gap-3">
                            <Badge variant={category.category_type === 'REIMBURSEMENT' ? 'default' : 'secondary'}>
                              {category.category_type}
                            </Badge>
                            <div>
                              <p className="font-medium">{category.category_name}</p>
                              <p className="text-sm text-muted-foreground">{category.category_code}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            {category.max_amount && (
                              <span className="text-sm">Max: {formatCurrency(category.max_amount)}</span>
                            )}
                            {category.ai_confidence && (
                              <Badge variant="outline" className="text-xs">
                                {Math.round(category.ai_confidence * 100)}% confidence
                              </Badge>
                            )}
                            {expandedCategories.has(category.id) ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </div>
                        </div>
                        {expandedCategories.has(category.id) && (
                          <div className="border-t px-4 py-3 bg-muted/30">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <Label className="text-muted-foreground text-xs">Description</Label>
                                <p>{category.description || 'N/A'}</p>
                              </div>
                              <div>
                                <Label className="text-muted-foreground text-xs">Frequency</Label>
                                <p>{category.frequency_limit || 'Unlimited'}</p>
                              </div>
                              <div>
                                <Label className="text-muted-foreground text-xs">Receipt Required</Label>
                                <p>{category.requires_receipt ? 'Yes' : 'No'}</p>
                              </div>
                              <div>
                                <Label className="text-muted-foreground text-xs">Submission Window</Label>
                                <p>{category.submission_window_days ? `${category.submission_window_days} days` : 'No limit'}</p>
                              </div>
                              <div>
                                <Label className="text-muted-foreground text-xs">Allowed Documents</Label>
                                <p>{category.allowed_document_types.join(', ')}</p>
                              </div>
                              <div>
                                <Label className="text-muted-foreground text-xs">Status</Label>
                                <p>{category.is_active ? 'Active' : 'Inactive'}</p>
                              </div>
                            </div>
                          </div>
                        )}
                      </Card>
                    ))}
                  </div>
                )}
              </div>

              {selectedPolicy.review_notes && (
                <>
                  <Separator />
                  <div>
                    <Label className="text-muted-foreground">Review Notes</Label>
                    <p className="mt-1">{selectedPolicy.review_notes}</p>
                  </div>
                </>
              )}
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsViewOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approve Policy Dialog */}
      <Dialog open={isApproveOpen} onOpenChange={setIsApproveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Policy</DialogTitle>
            <DialogDescription>
              Approving will activate the extracted categories for claim submission.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="effective_from">Effective From</Label>
              <Input
                id="effective_from"
                type="date"
                value={effectiveFrom}
                onChange={(e) => setEffectiveFrom(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="approve_notes">Review Notes (Optional)</Label>
              <Textarea
                id="approve_notes"
                value={approveNotes}
                onChange={(e) => setApproveNotes(e.target.value)}
                placeholder="Add any notes about this approval..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsApproveOpen(false)}>Cancel</Button>
            <Button onClick={handleApprove} disabled={approveMutation.isPending}>
              {approveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Approve & Activate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Policy Dialog */}
      <Dialog open={isRejectOpen} onOpenChange={setIsRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Policy</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this policy.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reject_notes">Rejection Notes *</Label>
              <Textarea
                id="reject_notes"
                value={rejectNotes}
                onChange={(e) => setRejectNotes(e.target.value)}
                placeholder="Explain why this policy is being rejected..."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRejectOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={rejectMutation.isPending || !rejectNotes.trim()}
            >
              {rejectMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload New Version Dialog */}
      <Dialog open={isNewVersionOpen} onOpenChange={setIsNewVersionOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Upload New Version</DialogTitle>
            <DialogDescription>
              Upload a new version for "{selectedPolicyName}". The current version will be archived when the new version is approved.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new_version_description">Description (Optional)</Label>
              <Textarea
                id="new_version_description"
                value={newVersionForm.description}
                onChange={(e) => setNewVersionForm({ ...newVersionForm, description: e.target.value })}
                placeholder="What's changed in this version..."
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new_version_region">Region / Location</Label>
              <MultiSelect
                options={regionOptions}
                selected={newVersionForm.region || []}
                onChange={(selected) => setNewVersionForm({ ...newVersionForm, region: selected })}
                placeholder="Select regions..."
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                Leave empty to keep the existing region setting
              </p>
            </div>
            <div className="space-y-2">
              <Label>New Policy Document *</Label>
              <div
                className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => newVersionFileInputRef.current?.click()}
              >
                <input
                  ref={newVersionFileInputRef}
                  type="file"
                  accept=".pdf,.docx,.jpg,.jpeg,.png"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setNewVersionForm({ ...newVersionForm, file });
                    }
                  }}
                />
                {newVersionForm.file ? (
                  <div className="flex items-center justify-center gap-2">
                    <FileText className="h-8 w-8 text-primary" />
                    <div>
                      <p className="font-medium">{newVersionForm.file.name}</p>
                      <p className="text-sm text-muted-foreground">{formatFileSize(newVersionForm.file.size)}</p>
                    </div>
                  </div>
                ) : (
                  <div>
                    <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                    <p className="text-muted-foreground">Click to upload or drag and drop</p>
                    <p className="text-xs text-muted-foreground mt-1">PDF, DOCX, JPG, PNG (max 10MB)</p>
                  </div>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsNewVersionOpen(false);
              setNewVersionForm({ description: '', region: [], file: null });
            }}>Cancel</Button>
            <Button onClick={handleNewVersionUpload} disabled={newVersionMutation.isPending || !newVersionForm.file}>
              {newVersionMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Upload New Version
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Custom Claim Dialog */}
      <Dialog open={isCreateCustomClaimOpen} onOpenChange={(open) => {
        setIsCreateCustomClaimOpen(open);
        if (!open) resetCustomClaimForm();
      }}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Custom Claim</DialogTitle>
            <DialogDescription>
              Define a new custom claim type with custom fields, limits, and validation rules.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            {/* Basic Info */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Basic Information</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cc_claim_name">Claim Name *</Label>
                  <Input
                    id="cc_claim_name"
                    value={customClaimForm.claim_name}
                    onChange={(e) => setCustomClaimForm({ ...customClaimForm, claim_name: e.target.value })}
                    placeholder="e.g., Office Supplies Reimbursement"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cc_category_type">Category Type *</Label>
                  <Select
                    value={customClaimForm.category_type}
                    onValueChange={(value: 'REIMBURSEMENT' | 'ALLOWANCE') =>
                      setCustomClaimForm({ ...customClaimForm, category_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="REIMBURSEMENT">Reimbursement</SelectItem>
                      <SelectItem value="ALLOWANCE">Allowance</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cc_region">Region</Label>
                  <MultiSelect
                    options={regionOptions}
                    selected={customClaimForm.region || []}
                    onChange={(selected) => setCustomClaimForm({ ...customClaimForm, region: selected })}
                    placeholder="Select regions..."
                    className="w-full"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cc_currency">Currency</Label>
                  <Select
                    value={customClaimForm.currency}
                    onValueChange={(value) => setCustomClaimForm({ ...customClaimForm, currency: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="INR">INR (₹)</SelectItem>
                      <SelectItem value="USD">USD ($)</SelectItem>
                      <SelectItem value="EUR">EUR (€)</SelectItem>
                      <SelectItem value="GBP">GBP (£)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="cc_description">Description</Label>
                  <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                    🤖 Used by AI for policy validation
                  </Badge>
                </div>
                <Textarea
                  id="cc_description"
                  value={customClaimForm.description}
                  onChange={(e) => setCustomClaimForm({ ...customClaimForm, description: e.target.value })}
                  placeholder="Describe this claim type in detail. This description will be used by AI for policy compliance validation..."
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">Provide a clear description including eligibility criteria, limits, and conditions. AI will use this for claim validation.</p>
              </div>
            </div>

            <Separator />

            {/* Amount Limits */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Amount Limits</h4>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cc_min_amount">Min Amount</Label>
                  <Input
                    id="cc_min_amount"
                    type="number"
                    value={customClaimForm.min_amount}
                    onChange={(e) => setCustomClaimForm({ ...customClaimForm, min_amount: e.target.value })}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cc_max_amount">Max Amount</Label>
                  <Input
                    id="cc_max_amount"
                    type="number"
                    value={customClaimForm.max_amount}
                    onChange={(e) => setCustomClaimForm({ ...customClaimForm, max_amount: e.target.value })}
                    placeholder="No limit"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cc_default_amount">Default Amount</Label>
                  <Input
                    id="cc_default_amount"
                    type="number"
                    value={customClaimForm.default_amount}
                    onChange={(e) => setCustomClaimForm({ ...customClaimForm, default_amount: e.target.value })}
                    placeholder="For allowances"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cc_requires_approval_above">Requires Approval Above</Label>
                <Input
                  id="cc_requires_approval_above"
                  type="number"
                  value={customClaimForm.requires_approval_above}
                  onChange={(e) => setCustomClaimForm({ ...customClaimForm, requires_approval_above: e.target.value })}
                  placeholder="Amount threshold for approval"
                />
              </div>
            </div>

            <Separator />

            {/* Frequency & Requirements */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Frequency & Requirements</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cc_frequency_limit">Frequency Limit</Label>
                  <Select
                    value={customClaimForm.frequency_limit}
                    onValueChange={(value) => setCustomClaimForm({ ...customClaimForm, frequency_limit: value === ' ' ? '' : value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select frequency" />
                    </SelectTrigger>
                    <SelectContent>
                      {FREQUENCY_OPTIONS.map((option) => (
                        <SelectItem key={option.value || 'none'} value={option.value || ' '}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cc_frequency_count">Frequency Count</Label>
                  <Input
                    id="cc_frequency_count"
                    type="number"
                    value={customClaimForm.frequency_count}
                    onChange={(e) => setCustomClaimForm({ ...customClaimForm, frequency_count: e.target.value })}
                    placeholder="Times per period"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cc_submission_window">Submission Window (days)</Label>
                  <Input
                    id="cc_submission_window"
                    type="number"
                    value={customClaimForm.submission_window_days}
                    onChange={(e) => setCustomClaimForm({ ...customClaimForm, submission_window_days: e.target.value })}
                    placeholder="Days to submit claim"
                  />
                </div>
                <div className="flex items-center space-x-2 pt-6">
                  <input
                    type="checkbox"
                    id="cc_requires_receipt"
                    checked={customClaimForm.requires_receipt}
                    onChange={(e) => setCustomClaimForm({ ...customClaimForm, requires_receipt: e.target.checked })}
                    className="h-4 w-4"
                  />
                  <Label htmlFor="cc_requires_receipt">Receipt Required</Label>
                </div>
              </div>
            </div>

            <Separator />

            {/* Custom Fields */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Custom Fields</h4>
                <Button type="button" variant="outline" size="sm" onClick={addCustomField}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Field
                </Button>
              </div>

              {customClaimForm.custom_fields.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No custom fields defined. Click "Add Field" to create custom fields for this claim.
                </p>
              ) : (
                <div className="space-y-4">
                  {customClaimForm.custom_fields.map((field, index) => (
                    <Card key={index} className="p-4">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">Field {index + 1}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-red-600"
                            onClick={() => removeCustomField(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs">Field Name *</Label>
                            <Input
                              value={field.name}
                              onChange={(e) => updateCustomField(index, { name: e.target.value })}
                              placeholder="field_name"
                              className="text-sm"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Label *</Label>
                            <Input
                              value={field.label}
                              onChange={(e) => updateCustomField(index, { label: e.target.value })}
                              placeholder="Field Label"
                              className="text-sm"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Type</Label>
                            <Select
                              value={field.type}
                              onValueChange={(value: CustomFieldDefinition['type']) =>
                                updateCustomField(index, { type: value })}
                            >
                              <SelectTrigger className="text-sm">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {FIELD_TYPE_OPTIONS.map((opt) => (
                                  <SelectItem key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs">Placeholder</Label>
                            <Input
                              value={field.placeholder || ''}
                              onChange={(e) => updateCustomField(index, { placeholder: e.target.value })}
                              placeholder="Enter placeholder text"
                              className="text-sm"
                            />
                          </div>
                          <div className="flex items-center space-x-2 pt-5">
                            <input
                              type="checkbox"
                              checked={field.required}
                              onChange={(e) => updateCustomField(index, { required: e.target.checked })}
                              className="h-4 w-4"
                            />
                            <Label className="text-xs">Required</Label>
                          </div>
                        </div>
                        {field.type === 'select' && (
                          <div className="space-y-1">
                            <Label className="text-xs">Options (comma-separated)</Label>
                            <Input
                              value={field.options.join(', ')}
                              onChange={(e) => updateCustomField(index, {
                                options: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                              })}
                              placeholder="Option 1, Option 2, Option 3"
                              className="text-sm"
                            />
                          </div>
                        )}
                        {(field.type === 'number' || field.type === 'currency') && (
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <Label className="text-xs">Min Value</Label>
                              <Input
                                type="number"
                                value={field.validation?.min || ''}
                                onChange={(e) => updateCustomField(index, {
                                  validation: { ...field.validation, min: e.target.value ? parseFloat(e.target.value) : undefined }
                                })}
                                placeholder="Min"
                                className="text-sm"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Max Value</Label>
                              <Input
                                type="number"
                                value={field.validation?.max || ''}
                                onChange={(e) => updateCustomField(index, {
                                  validation: { ...field.validation, max: e.target.value ? parseFloat(e.target.value) : undefined }
                                })}
                                placeholder="Max"
                                className="text-sm"
                              />
                            </div>
                          </div>
                        )}
                        {field.type === 'text' && (
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <Label className="text-xs">Min Length</Label>
                              <Input
                                type="number"
                                value={field.validation?.min_length || ''}
                                onChange={(e) => updateCustomField(index, {
                                  validation: { ...field.validation, min_length: e.target.value ? parseInt(e.target.value) : undefined }
                                })}
                                placeholder="Min chars"
                                className="text-sm"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Max Length</Label>
                              <Input
                                type="number"
                                value={field.validation?.max_length || ''}
                                onChange={(e) => updateCustomField(index, {
                                  validation: { ...field.validation, max_length: e.target.value ? parseInt(e.target.value) : undefined }
                                })}
                                placeholder="Max chars"
                                className="text-sm"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsCreateCustomClaimOpen(false);
              resetCustomClaimForm();
            }}>Cancel</Button>
            <Button onClick={handleCreateCustomClaim} disabled={createCustomClaimMutation.isPending}>
              {createCustomClaimMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Custom Claim
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Custom Claim Dialog */}
      <Dialog open={isViewCustomClaimOpen} onOpenChange={setIsViewCustomClaimOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Custom Claim Details</DialogTitle>
            <DialogDescription>
              {selectedCustomClaim?.claim_name} ({selectedCustomClaim?.claim_code})
            </DialogDescription>
          </DialogHeader>
          {isLoadingCustomClaim ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : selectedCustomClaim ? (
            <div className="space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Type</Label>
                  <div className="mt-1">
                    <Badge variant={selectedCustomClaim.category_type === 'REIMBURSEMENT' ? 'default' : 'secondary'}>
                      {selectedCustomClaim.category_type}
                    </Badge>
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <div className="mt-1">
                    {selectedCustomClaim.is_active ? (
                      <Badge className="bg-green-100 text-green-700">Active</Badge>
                    ) : (
                      <Badge variant="outline" className="text-gray-500">Inactive</Badge>
                    )}
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Region</Label>
                  <div className="mt-1">
                    <Badge variant="outline">{selectedCustomClaim.region || 'Global'}</Badge>
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Currency</Label>
                  <p className="mt-1">{selectedCustomClaim.currency}</p>
                </div>
              </div>

              {selectedCustomClaim.description && (
                <div>
                  <Label className="text-muted-foreground">Description</Label>
                  <p className="mt-1">{selectedCustomClaim.description}</p>
                </div>
              )}

              <Separator />

              {/* Amount Limits */}
              <div>
                <h4 className="text-sm font-semibold mb-3">Amount Limits</h4>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <Label className="text-muted-foreground text-xs">Min Amount</Label>
                    <p>{selectedCustomClaim.min_amount ? `${selectedCustomClaim.currency} ${selectedCustomClaim.min_amount.toLocaleString()}` : 'No minimum'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">Max Amount</Label>
                    <p>{selectedCustomClaim.max_amount ? `${selectedCustomClaim.currency} ${selectedCustomClaim.max_amount.toLocaleString()}` : 'No limit'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">Default Amount</Label>
                    <p>{selectedCustomClaim.default_amount ? `${selectedCustomClaim.currency} ${selectedCustomClaim.default_amount.toLocaleString()}` : 'N/A'}</p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Requirements */}
              <div>
                <h4 className="text-sm font-semibold mb-3">Requirements</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <Label className="text-muted-foreground text-xs">Frequency</Label>
                    <p>{selectedCustomClaim.frequency_limit || 'Unlimited'} {selectedCustomClaim.frequency_count ? `(${selectedCustomClaim.frequency_count}x)` : ''}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">Receipt Required</Label>
                    <p>{selectedCustomClaim.requires_receipt ? 'Yes' : 'No'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">Approval Above</Label>
                    <p>{selectedCustomClaim.requires_approval_above ? `${selectedCustomClaim.currency} ${selectedCustomClaim.requires_approval_above.toLocaleString()}` : 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">Submission Window</Label>
                    <p>{selectedCustomClaim.submission_window_days ? `${selectedCustomClaim.submission_window_days} days` : 'No limit'}</p>
                  </div>
                </div>
              </div>

              {/* Custom Fields */}
              {selectedCustomClaim.custom_fields && selectedCustomClaim.custom_fields.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <h4 className="text-sm font-semibold mb-3">Custom Fields ({selectedCustomClaim.custom_fields.length})</h4>
                    <div className="space-y-2">
                      {selectedCustomClaim.custom_fields.map((field, index) => (
                        <Card key={index} className="p-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">{field.label}</p>
                              <p className="text-sm text-muted-foreground">{field.name} • {field.type}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              {field.required && <Badge variant="outline" className="text-xs">Required</Badge>}
                              {field.type === 'select' && field.options.length > 0 && (
                                <Badge variant="secondary" className="text-xs">{field.options.length} options</Badge>
                              )}
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsViewCustomClaimOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Custom Claim Dialog */}
      <Dialog open={isEditCustomClaimOpen} onOpenChange={(open) => {
        setIsEditCustomClaimOpen(open);
        if (!open) {
          resetCustomClaimForm();
          setSelectedCustomClaimId(null);
        }
      }}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Custom Claim</DialogTitle>
            <DialogDescription>
              Update the custom claim definition.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            {/* Basic Info */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Basic Information</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit_cc_claim_name">Claim Name *</Label>
                  <Input
                    id="edit_cc_claim_name"
                    value={customClaimForm.claim_name}
                    onChange={(e) => setCustomClaimForm({ ...customClaimForm, claim_name: e.target.value })}
                    placeholder="e.g., Office Supplies Reimbursement"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_cc_category_type">Category Type *</Label>
                  <Select
                    value={customClaimForm.category_type}
                    onValueChange={(value: 'REIMBURSEMENT' | 'ALLOWANCE') =>
                      setCustomClaimForm({ ...customClaimForm, category_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="REIMBURSEMENT">Reimbursement</SelectItem>
                      <SelectItem value="ALLOWANCE">Allowance</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit_cc_region">Region</Label>
                  <MultiSelect
                    options={regionOptions}
                    selected={customClaimForm.region || []}
                    onChange={(selected) => setCustomClaimForm({ ...customClaimForm, region: selected })}
                    placeholder="Select regions..."
                    className="w-full"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_cc_currency">Currency</Label>
                  <Select
                    value={customClaimForm.currency}
                    onValueChange={(value) => setCustomClaimForm({ ...customClaimForm, currency: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="INR">INR (₹)</SelectItem>
                      <SelectItem value="USD">USD ($)</SelectItem>
                      <SelectItem value="EUR">EUR (€)</SelectItem>
                      <SelectItem value="GBP">GBP (£)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="edit_cc_description">Description</Label>
                  <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                    🤖 Used by AI for policy validation
                  </Badge>
                </div>
                <Textarea
                  id="edit_cc_description"
                  value={customClaimForm.description}
                  onChange={(e) => setCustomClaimForm({ ...customClaimForm, description: e.target.value })}
                  placeholder="Describe this claim type in detail. This description will be used by AI for policy compliance validation..."
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">Provide a clear description including eligibility criteria, limits, and conditions. AI will use this for claim validation.</p>
              </div>
            </div>

            <Separator />

            {/* Amount Limits */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Amount Limits</h4>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Min Amount</Label>
                  <Input
                    type="number"
                    value={customClaimForm.min_amount}
                    onChange={(e) => setCustomClaimForm({ ...customClaimForm, min_amount: e.target.value })}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Max Amount</Label>
                  <Input
                    type="number"
                    value={customClaimForm.max_amount}
                    onChange={(e) => setCustomClaimForm({ ...customClaimForm, max_amount: e.target.value })}
                    placeholder="No limit"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Default Amount</Label>
                  <Input
                    type="number"
                    value={customClaimForm.default_amount}
                    onChange={(e) => setCustomClaimForm({ ...customClaimForm, default_amount: e.target.value })}
                    placeholder="For allowances"
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Frequency & Requirements */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Frequency & Requirements</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Frequency Limit</Label>
                  <Select
                    value={customClaimForm.frequency_limit}
                    onValueChange={(value) => setCustomClaimForm({ ...customClaimForm, frequency_limit: value === ' ' ? '' : value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select frequency" />
                    </SelectTrigger>
                    <SelectContent>
                      {FREQUENCY_OPTIONS.map((option) => (
                        <SelectItem key={option.value || 'none'} value={option.value || ' '}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Frequency Count</Label>
                  <Input
                    type="number"
                    value={customClaimForm.frequency_count}
                    onChange={(e) => setCustomClaimForm({ ...customClaimForm, frequency_count: e.target.value })}
                    placeholder="Times per period"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Submission Window (days)</Label>
                  <Input
                    type="number"
                    value={customClaimForm.submission_window_days}
                    onChange={(e) => setCustomClaimForm({ ...customClaimForm, submission_window_days: e.target.value })}
                    placeholder="Days to submit claim"
                  />
                </div>
                <div className="flex items-center space-x-2 pt-6">
                  <input
                    type="checkbox"
                    id="edit_cc_requires_receipt"
                    checked={customClaimForm.requires_receipt}
                    onChange={(e) => setCustomClaimForm({ ...customClaimForm, requires_receipt: e.target.checked })}
                    className="h-4 w-4"
                  />
                  <Label htmlFor="edit_cc_requires_receipt">Receipt Required</Label>
                </div>
              </div>
            </div>

            <Separator />

            {/* Custom Fields */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Custom Fields</h4>
                <Button type="button" variant="outline" size="sm" onClick={addCustomField}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Field
                </Button>
              </div>

              {customClaimForm.custom_fields.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No custom fields defined.
                </p>
              ) : (
                <div className="space-y-4">
                  {customClaimForm.custom_fields.map((field, index) => (
                    <Card key={index} className="p-4">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">Field {index + 1}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-red-600"
                            onClick={() => removeCustomField(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs">Field Name *</Label>
                            <Input
                              value={field.name}
                              onChange={(e) => updateCustomField(index, { name: e.target.value })}
                              placeholder="field_name"
                              className="text-sm"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Label *</Label>
                            <Input
                              value={field.label}
                              onChange={(e) => updateCustomField(index, { label: e.target.value })}
                              placeholder="Field Label"
                              className="text-sm"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Type</Label>
                            <Select
                              value={field.type}
                              onValueChange={(value: CustomFieldDefinition['type']) =>
                                updateCustomField(index, { type: value })}
                            >
                              <SelectTrigger className="text-sm">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {FIELD_TYPE_OPTIONS.map((opt) => (
                                  <SelectItem key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs">Placeholder</Label>
                            <Input
                              value={field.placeholder || ''}
                              onChange={(e) => updateCustomField(index, { placeholder: e.target.value })}
                              placeholder="Enter placeholder text"
                              className="text-sm"
                            />
                          </div>
                          <div className="flex items-center space-x-2 pt-5">
                            <input
                              type="checkbox"
                              checked={field.required}
                              onChange={(e) => updateCustomField(index, { required: e.target.checked })}
                              className="h-4 w-4"
                            />
                            <Label className="text-xs">Required</Label>
                          </div>
                        </div>
                        {field.type === 'select' && (
                          <div className="space-y-1">
                            <Label className="text-xs">Options (comma-separated)</Label>
                            <Input
                              value={field.options.join(', ')}
                              onChange={(e) => updateCustomField(index, {
                                options: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                              })}
                              placeholder="Option 1, Option 2, Option 3"
                              className="text-sm"
                            />
                          </div>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsEditCustomClaimOpen(false);
              resetCustomClaimForm();
              setSelectedCustomClaimId(null);
            }}>Cancel</Button>
            <Button onClick={handleEditCustomClaim} disabled={updateCustomClaimMutation.isPending}>
              {updateCustomClaimMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Update Custom Claim
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
