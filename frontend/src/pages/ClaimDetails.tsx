import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  FileText,
  MessageSquare,
  History,
  Download,
  Edit,
  CheckCircle,
  XCircle,
  RotateCcw,
  Send,
  Bot,
  Zap,
  User,
  Calendar,
  Building,
  CreditCard,
  FileImage,
  AlertTriangle,
  Eye,
  ExternalLink,
  ZoomIn,
  ZoomOut,
  X,
  Maximize2,
  Minimize2,
  Save,
  UserCog,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { cn, extractErrorMessage } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ClaimStatusBadge } from '@/components/claims/ClaimStatusBadge';
import { useClaim, useClaims } from '@/hooks/useClaims';
import { useDocuments, getDocumentViewUrl, getDocumentDownloadUrl, useDocumentSignedUrl } from '@/hooks/useDocuments';
import { useComments, useCreateComment } from '@/hooks/useComments';
import { useProjects } from '@/hooks/useProjects';
import { useReimbursementsByRegion } from '@/hooks/usePolicies';
import { useAuth } from '@/contexts/AuthContext';
import { useFormatting } from '@/hooks/useFormatting';
import { toast } from '@/hooks/use-toast';
import { DataSource, Claim, ClaimDocument } from '@/types';
import { formatCategory } from '@/lib/categoryUtils';

export default function ClaimDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { formatDate, formatDateTime, formatCurrency, getCurrencySymbol } = useFormatting();
  const [comment, setComment] = useState('');
  const [activeTab, setActiveTab] = useState('details');
  const [viewingDocument, setViewingDocument] = useState<ClaimDocument | null>(null);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [actionDialog, setActionDialog] = useState<{
    open: boolean;
    action: 'approve' | 'reject' | 'return' | null;
  }>({ open: false, action: null });
  const [actionComment, setActionComment] = useState('');

  // HR Edit Mode state
  const [isHrEditing, setIsHrEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editedFields, setEditedFields] = useState<Record<string, any>>({});
  const [hrEditedFields, setHrEditedFields] = useState<Set<string>>(new Set());

  const { data: claim, isLoading, error, refetch } = useClaim(id || '');
  const { data: documents = [], isLoading: documentsLoading } = useDocuments(id || '');
  const { data: comments = [], isLoading: commentsLoading } = useComments(id || '');
  const createCommentMutation = useCreateComment();
  
  // Fetch projects and categories for HR editing
  const { data: projects = [] } = useProjects();
  const { data: reimbursementCategories = [] } = useReimbursementsByRegion(user?.region);
  
  // Create category options with 'Other' at the end
  const categoryOptions = useMemo(() => {
    const apiCategories = reimbursementCategories.map(cat => ({
      value: cat.category_code.toLowerCase(),
      label: cat.category_name,
      categoryCode: cat.category_code,
    }));
    // Add 'Other' category at the end
    return [...apiCategories, { value: 'other', label: 'Other', categoryCode: 'OTHER' }];
  }, [reimbursementCategories]);

  // Fetch all claims for navigation (only for approvers)
  const { data: allClaims = [] } = useClaims();

  // Calculate pending claims queue for approvers
  const pendingClaimsQueue = useMemo(() => {
    // Get pending status based on role
    const roleStatusMap: Record<string, string[]> = {
      'manager': ['pending_manager'],
      'hr': ['pending_hr'],
      'finance': ['pending_finance'],
      'admin': ['pending_manager', 'pending_hr', 'pending_finance'],
    };
    const pendingStatuses = roleStatusMap[user?.role || ''] || [];
    if (pendingStatuses.length === 0) return [];

    return allClaims
      .filter(c => pendingStatuses.includes(c.status))
      .sort((a, b) => {
        const aDate = a.submissionDate || new Date();
        const bDate = b.submissionDate || new Date();
        return bDate.getTime() - aDate.getTime(); // Most recent first
      });
  }, [allClaims, user?.role]);

  // Find current claim position in queue
  const currentQueueIndex = useMemo(() => {
    return pendingClaimsQueue.findIndex(c => c.id === id);
  }, [pendingClaimsQueue, id]);

  const navigateToClaim = (direction: 'prev' | 'next') => {
    const newIndex = direction === 'prev' ? currentQueueIndex - 1 : currentQueueIndex + 1;
    if (newIndex >= 0 && newIndex < pendingClaimsQueue.length) {
      navigate(`/claims/${pendingClaimsQueue[newIndex].id}`);
    }
  };

  // Show navigation if there are pending claims in the queue (even if current claim is not in queue)
  const showNavigation = pendingClaimsQueue.length > 0 && ['manager', 'hr', 'finance', 'admin'].includes(user?.role || '');

  // Refetch claim data on window focus to ensure fresh status
  useEffect(() => {
    const handleFocus = () => {
      refetch();
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [refetch]);

  // Get signed URL for the currently viewed document
  const { data: signedUrl, isLoading: signedUrlLoading } = useDocumentSignedUrl(viewingDocument?.id || null);

  // Combine claim documents with fetched documents (prefer API data)
  const allDocuments = documents.length > 0 ? documents : (claim?.documents || []);

  // Handle document view inline
  const handleViewDocument = (doc: ClaimDocument) => {
    setViewingDocument(doc);
    setZoomLevel(100);
  };

  // Close document preview
  const handleClosePreview = () => {
    setViewingDocument(null);
    setZoomLevel(100);
  };

  // Zoom controls
  const handleZoomIn = () => setZoomLevel(prev => Math.min(prev + 25, 300));
  const handleZoomOut = () => setZoomLevel(prev => Math.max(prev - 25, 25));
  const handleResetZoom = () => setZoomLevel(100);

  // Handle document download
  const handleDownloadDocument = (doc: ClaimDocument) => {
    const downloadUrl = getDocumentDownloadUrl(doc.id);
    window.open(downloadUrl, '_blank');
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex h-[50vh] flex-col items-center justify-center gap-4">
        <Bot className="h-16 w-16 text-primary animate-pulse" />
        <p className="text-muted-foreground">Loading claim details...</p>
      </div>
    );
  }

  if (!claim) {
    return (
      <div className="flex h-[50vh] flex-col items-center justify-center gap-4">
        <FileText className="h-16 w-16 text-muted-foreground" />
        <h2 className="text-xl font-semibold">Claim Not Found</h2>
        <p className="text-muted-foreground">
          The claim you're looking for doesn't exist.
        </p>
        <Button onClick={() => navigate('/claims')}>Back to Claims</Button>
      </div>
    );
  }

  const canApprove =
    (user?.role === 'manager' && claim.status === 'pending_manager') ||
    (user?.role === 'hr' && claim.status === 'pending_hr') ||
    (user?.role === 'finance' && claim.status === 'pending_finance');

  const handleActionClick = (action: 'approve' | 'reject' | 'return') => {
    setActionDialog({ open: true, action });
  };

  const confirmAction = async () => {
    if (!id || !actionDialog.action) return;

    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';
    const action = actionDialog.action;

    try {
      let endpoint = '';
      let body: Record<string, any> = {};

      // Include approver info for all actions
      const approverInfo = {
        approver_id: user?.id,
        approver_name: user?.name || user?.username,
        approver_role: user?.role?.toUpperCase()
      };

      if (action === 'approve') {
        endpoint = `${API_BASE_URL}/claims/${id}/approve?tenant_id=${user?.tenantId || ''}`;
        body = { ...approverInfo };
        if (actionComment) body.comment = actionComment;
      } else if (action === 'reject') {
        endpoint = `${API_BASE_URL}/claims/${id}/reject?tenant_id=${user?.tenantId || ''}`;
        body = { ...approverInfo };
        if (actionComment) body.comment = actionComment;
      } else if (action === 'return') {
        endpoint = `${API_BASE_URL}/claims/${id}/return?tenant_id=${user?.tenantId || ''}`;
        body = {
          ...approverInfo,
          return_reason: actionComment || 'Please review and correct the claim details'
        };
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(localStorage.getItem('access_token') ? { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` } : {}),
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = await response.json();
        // Handle Pydantic validation errors (array of detail objects) or simple string errors
        let errorMessage = 'Action failed';
        if (error.detail) {
          if (Array.isArray(error.detail)) {
            // Pydantic validation error format: [{loc: [...], msg: "...", type: "..."}]
            errorMessage = error.detail.map((e: any) => e.msg || e.message || JSON.stringify(e)).join(', ');
          } else if (typeof error.detail === 'string') {
            errorMessage = error.detail;
          } else {
            errorMessage = JSON.stringify(error.detail);
          }
        }
        throw new Error(errorMessage);
      }

      const messages = {
        approve: 'Claim approved successfully',
        reject: 'Claim rejected',
        return: 'Claim returned to employee',
      };
      toast({ title: messages[action] });

      setActionDialog({ open: false, action: null });
      setActionComment('');

      // Invalidate pending-approvals query to update sidebar count
      queryClient.invalidateQueries({ queryKey: ['pending-approvals'] });

      // Refresh the page to show updated status
      window.location.reload();

    } catch (error) {
      toast({
        title: 'Action failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      });
    }
  };

  // HR Edit Mode functions
  const handleStartHrEdit = () => {
    if (!claim) return;
    setIsHrEditing(true);
    // Initialize edited fields with current claim values
    // Find matching category from options (compare case-insensitively with flexible matching)
    const claimCategory = claim.category?.toLowerCase() || '';
    const claimCategoryNormalized = claimCategory.replace(/[_\-\s]+/g, ''); // Remove separators for fuzzy matching
    
    const matchedCategory = categoryOptions.find(opt => {
      const optValue = opt.value.toLowerCase();
      const optCode = opt.categoryCode.toLowerCase();
      const optValueNormalized = optValue.replace(/[_\-\s]+/g, '');
      const optCodeNormalized = optCode.replace(/[_\-\s]+/g, '');
      
      // Exact match
      if (optValue === claimCategory || optCode === claimCategory) return true;
      // Normalized match (ignore underscores, hyphens, spaces)
      if (optValueNormalized === claimCategoryNormalized || optCodeNormalized === claimCategoryNormalized) return true;
      // Partial match - if one contains the other
      if (claimCategoryNormalized && (optCodeNormalized.includes(claimCategoryNormalized) || claimCategoryNormalized.includes(optCodeNormalized))) return true;
      
      return false;
    });
    
    setEditedFields({
      amount: claim.amount,
      vendor: claim.vendor || '',
      description: claim.description || '',
      transactionRef: claim.transactionRef || '',
      category: matchedCategory?.value || 'other',
      projectCode: claim.projectCode || '',
    });
    setHrEditedFields(new Set());
  };

  const handleCancelHrEdit = () => {
    setIsHrEditing(false);
    setEditedFields({});
    setHrEditedFields(new Set());
  };

  const handleHrFieldChange = (field: string, value: any) => {
    setEditedFields(prev => ({ ...prev, [field]: value }));
    setHrEditedFields(prev => new Set(prev).add(field));
  };

  const handleSaveHrEdit = async () => {
    if (!id || !claim) return;
    setIsSaving(true);

    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

    try {
      // Build the update payload
      const hrEditedFieldsArray = Array.from(hrEditedFields);
      const updatePayload: Record<string, any> = {
        hr_edited_fields: hrEditedFieldsArray,
      };

      // Add modified fields to payload
      if (hrEditedFields.has('amount')) {
        updatePayload.amount = parseFloat(editedFields.amount);
      }
      if (hrEditedFields.has('description')) {
        updatePayload.description = editedFields.description;
      }

      // Build claim_payload update for other fields
      const payloadUpdate: Record<string, any> = {};
      if (hrEditedFields.has('vendor')) {
        payloadUpdate.vendor = editedFields.vendor;
        payloadUpdate.vendor_source = 'hr';
      }
      if (hrEditedFields.has('transactionRef')) {
        payloadUpdate.transaction_ref = editedFields.transactionRef;
        payloadUpdate.transaction_ref_source = 'hr';
      }
      if (hrEditedFields.has('amount')) {
        payloadUpdate.amount_source = 'hr';
      }
      if (hrEditedFields.has('description')) {
        payloadUpdate.description_source = 'hr';
      }
      if (hrEditedFields.has('category')) {
        // Find the category code from the selected value
        const selectedCategory = categoryOptions.find(c => c.value === editedFields.category);
        updatePayload.category = selectedCategory?.categoryCode || editedFields.category?.toUpperCase();
        payloadUpdate.category_source = 'hr';
      }
      if (hrEditedFields.has('projectCode')) {
        updatePayload.project_code = editedFields.projectCode || null;
        payloadUpdate.project_code_source = 'hr';
      }

      if (Object.keys(payloadUpdate).length > 0) {
        updatePayload.claim_payload = {
          ...(claim as any).claim_payload,
          ...payloadUpdate,
        };
      }

      const response = await fetch(
        `${API_BASE_URL}/claims/${id}/hr-edit?tenant_id=${user?.tenantId || ''}`,
        {
          method: 'PUT',
          headers: { 
            'Content-Type': 'application/json',
            ...(localStorage.getItem('access_token') ? { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` } : {}),
          },
          body: JSON.stringify(updatePayload),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(extractErrorMessage(error, 'Failed to save HR edits'));
      }

      toast({ title: 'Claim updated successfully' });
      setIsHrEditing(false);
      setEditedFields({});
      setHrEditedFields(new Set());

      // Refresh claim data
      await refetch();

    } catch (error) {
      toast({
        title: 'Failed to save',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddComment = async () => {
    if (!comment.trim() || !id) return;

    try {
      await createCommentMutation.mutateAsync({
        claim_id: id,
        comment_text: comment.trim(),
        comment_type: 'GENERAL',
        user_name: user?.name || 'Anonymous',
        user_role: user?.role || 'employee',
        visible_to_employee: true,
      });
      toast({ title: 'Comment added successfully' });
      setComment('');
    } catch (error) {
      toast({ title: 'Failed to add comment', variant: 'destructive' });
    }
  };

  const getDataSourceBadge = (source: DataSource) => {
    const config = {
      ocr: { label: 'Auto', icon: Zap, className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
      auto: { label: 'Auto', icon: Zap, className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },  // Support both 'ocr' and 'auto'
      manual: { label: 'Manual', icon: User, className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
      edited: { label: 'Edited', icon: Edit, className: 'bg-warning/10 text-warning' },
      hr: { label: 'HR', icon: UserCog, className: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
    };
    const { label, icon: Icon, className } = config[source] || config.manual;
    return (
      <Badge variant="outline" className={cn('gap-1 text-xs', className)}>
        <Icon className="h-3 w-3" />
        {label}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-foreground">
                {claim.claimNumber}
              </h1>
              <ClaimStatusBadge status={claim.status} />
            </div>
            <p className="text-muted-foreground">{claim.title}</p>
          </div>
        </div>

        {/* Queue Navigation (for approvers) */}
        {showNavigation && (
          <div className="flex items-center gap-2 border rounded-lg px-2 py-1 bg-muted/30">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => navigateToClaim('prev')}
              disabled={currentQueueIndex <= 0}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground px-2 min-w-[50px] text-center">
              {currentQueueIndex >= 0 
                ? `${currentQueueIndex + 1} / ${pendingClaimsQueue.length}`
                : `${pendingClaimsQueue.length} pending`
              }
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => {
                // If current claim is not in queue, go to first pending claim
                if (currentQueueIndex < 0 && pendingClaimsQueue.length > 0) {
                  navigate(`/claims/${pendingClaimsQueue[0].id}`);
                } else {
                  navigateToClaim('next');
                }
              }}
              disabled={currentQueueIndex >= 0 && currentQueueIndex === pendingClaimsQueue.length - 1}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Actions */}
        {canApprove && (
          <div className="flex gap-2">
            {/* HR Edit Mode: Show Save and Cancel buttons */}
            {isHrEditing ? (
              <>
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={handleCancelHrEdit}
                  disabled={isSaving}
                >
                  <X className="h-4 w-4" />
                  Cancel
                </Button>
                <Button
                  variant="gradient"
                  className="gap-2"
                  onClick={handleSaveHrEdit}
                  disabled={isSaving || hrEditedFields.size === 0}
                >
                  <Save className="h-4 w-4" />
                  {isSaving ? 'Saving...' : 'Save'}
                </Button>
              </>
            ) : (
              <>
                {/* Edit button only for HR role */}
                {user?.role === 'hr' && (
                  <Button
                    variant="outline"
                    className="gap-2 text-purple-600 hover:text-purple-700"
                    onClick={handleStartHrEdit}
                  >
                    <Edit className="h-4 w-4" />
                    Edit
                  </Button>
                )}
                {/* Return button visible to managers, HR, and finance */}
                {(user?.role === 'manager' || user?.role === 'hr' || user?.role === 'finance') && (
                  <Button
                    variant="outline"
                    className="gap-2 text-warning"
                    onClick={() => handleActionClick('return')}
                  >
                    <RotateCcw className="h-4 w-4" />
                    Return
                  </Button>
                )}
                <Button
                  variant="outline"
                  className="gap-2 text-destructive"
                  onClick={() => handleActionClick('reject')}
                >
                  <XCircle className="h-4 w-4" />
                  Reject
                </Button>
                <Button
                  variant="gradient"
                  className="gap-2"
                  onClick={() => handleActionClick('approve')}
                >
                  <CheckCircle className="h-4 w-4" />
                  Approve
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="details" className="gap-2">
                <FileText className="h-4 w-4" />
                Details
              </TabsTrigger>
              <TabsTrigger value="documents" className="gap-2">
                <FileImage className="h-4 w-4" />
                Documents ({allDocuments.length})
              </TabsTrigger>
              <TabsTrigger value="history" className="gap-2">
                <History className="h-4 w-4" />
                History
              </TabsTrigger>
            </TabsList>

            {/* Details Tab */}
            <TabsContent value="details" className="space-y-6 mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    Claim Information
                    {isHrEditing && (
                      <Badge variant="outline" className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                        <Edit className="h-3 w-3 mr-1" />
                        Editing
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-muted-foreground flex items-center gap-2">
                        <CreditCard className="h-4 w-4" />
                        Amount
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        {isHrEditing ? (
                          <div className={cn(
                            "flex items-center gap-2 w-full",
                            hrEditedFields.has('amount') && "bg-purple-50 dark:bg-purple-900/20 rounded-md p-1 -m-1"
                          )}>
                            <span className="text-lg font-semibold">{getCurrencySymbol()}</span>
                            <Input
                              type="number"
                              value={editedFields.amount || ''}
                              onChange={(e) => handleHrFieldChange('amount', e.target.value)}
                              className="max-w-32"
                            />
                            {hrEditedFields.has('amount') && getDataSourceBadge('hr')}
                          </div>
                        ) : (
                          <>
                            <p className="text-lg font-semibold">
                              {formatCurrency(claim.amount)}
                            </p>
                            {getDataSourceBadge(claim.dataSource?.amount || 'manual')}
                          </>
                        )}
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        Expense Date
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="font-medium">
                          {formatDate(claim.claimDate || claim.submissionDate)}
                        </p>
                        {getDataSourceBadge(claim.dataSource?.date || 'manual')}
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground flex items-center gap-2">
                        <Building className="h-4 w-4" />
                        Vendor
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        {isHrEditing ? (
                          <div className={cn(
                            "flex items-center gap-2 w-full",
                            hrEditedFields.has('vendor') && "bg-purple-50 dark:bg-purple-900/20 rounded-md p-1 -m-1"
                          )}>
                            <Input
                              type="text"
                              value={editedFields.vendor || ''}
                              onChange={(e) => handleHrFieldChange('vendor', e.target.value)}
                              placeholder="Enter vendor"
                            />
                            {hrEditedFields.has('vendor') && getDataSourceBadge('hr')}
                          </div>
                        ) : (
                          <>
                            <p className="font-medium">{claim.vendor || 'N/A'}</p>
                            {getDataSourceBadge(claim.dataSource?.vendor || 'manual')}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Category</p>
                      <div className="flex items-center gap-2 mt-1">
                        {isHrEditing ? (
                          <div className={cn(
                            "flex items-center gap-2 w-full",
                            hrEditedFields.has('category') && "bg-purple-50 dark:bg-purple-900/20 rounded-md p-1 -m-1"
                          )}>
                            <Select
                              value={editedFields.category || 'other'}
                              onValueChange={(value) => handleHrFieldChange('category', value)}
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select category" />
                              </SelectTrigger>
                              <SelectContent>
                                {categoryOptions.map((cat) => (
                                  <SelectItem key={cat.value} value={cat.value}>
                                    {cat.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {hrEditedFields.has('category') && getDataSourceBadge('hr')}
                          </div>
                        ) : (
                          <>
                            <Badge variant="outline">
                              {formatCategory(typeof claim.category === 'string' ? claim.category : claim.category?.name || 'Other')}
                            </Badge>
                            {getDataSourceBadge(claim.dataSource?.category || 'manual')}
                          </>
                        )}
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Project</p>
                      <div className="flex items-center gap-2 mt-1">
                        {isHrEditing ? (
                          <div className={cn(
                            "flex items-center gap-2 w-full",
                            hrEditedFields.has('projectCode') && "bg-purple-50 dark:bg-purple-900/20 rounded-md p-1 -m-1"
                          )}>
                            <Select
                              value={editedFields.projectCode || '_none_'}
                              onValueChange={(value) => handleHrFieldChange('projectCode', value === '_none_' ? '' : value)}
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select project" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="_none_">No Project</SelectItem>
                                {projects.map((proj) => (
                                  <SelectItem key={proj.code} value={proj.code}>
                                    {proj.name} ({proj.code})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {hrEditedFields.has('projectCode') && getDataSourceBadge('hr')}
                          </div>
                        ) : (
                          <>
                            <p className="font-medium">{claim.projectName || claim.projectCode || 'N/A'}</p>
                            {getDataSourceBadge('manual')}
                          </>
                        )}
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Transaction Ref</p>
                      <div className="flex items-center gap-2 mt-1">
                        {isHrEditing ? (
                          <div className={cn(
                            "flex items-center gap-2 w-full",
                            hrEditedFields.has('transactionRef') && "bg-purple-50 dark:bg-purple-900/20 rounded-md p-1 -m-1"
                          )}>
                            <Input
                              type="text"
                              value={editedFields.transactionRef || ''}
                              onChange={(e) => handleHrFieldChange('transactionRef', e.target.value)}
                              placeholder="Enter transaction ref"
                            />
                            {hrEditedFields.has('transactionRef') && getDataSourceBadge('hr')}
                          </div>
                        ) : (
                          <>
                            <p className="font-medium">{claim.transactionRef || 'N/A'}</p>
                            {getDataSourceBadge(claim.dataSource?.transactionRef || 'manual')}
                          </>
                        )}
                      </div>
                    </div>

                  </div>
                  {(claim.description || isHrEditing) && (
                    <div className="sm:col-span-2">
                      <p className="text-sm text-muted-foreground">Description</p>
                      <div className="flex items-center gap-2 mt-1">
                        {isHrEditing ? (
                          <div className={cn(
                            "flex items-center gap-2 w-full",
                            hrEditedFields.has('description') && "bg-purple-50 dark:bg-purple-900/20 rounded-md p-1 -m-1"
                          )}>
                            <Textarea
                              value={editedFields.description || ''}
                              onChange={(e) => handleHrFieldChange('description', e.target.value)}
                              placeholder="Enter description"
                              rows={2}
                              className="w-full"
                            />
                            {hrEditedFields.has('description') && getDataSourceBadge('hr')}
                          </div>
                        ) : (
                          <>
                            <p>{claim.description}</p>
                            {getDataSourceBadge(claim.dataSource?.description || 'manual')}
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Documents Tab */}
            <TabsContent value="documents" className="mt-6">
              <Card>
                <CardContent className="pt-6">
                  {documentsLoading ? (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                      <FileImage className="h-12 w-12 mb-4 animate-pulse" />
                      <p>Loading documents...</p>
                    </div>
                  ) : allDocuments.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                      <FileImage className="h-12 w-12 mb-4" />
                      <p>No documents attached</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {allDocuments.map((doc) => (
                        <div
                          key={doc.id}
                          className={cn(
                            "rounded-lg border border-border p-4 transition-colors",
                            viewingDocument?.id === doc.id ? "bg-muted/50 border-primary" : "hover:bg-muted/50"
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                                <FileText className="h-5 w-5 text-primary" />
                              </div>
                              <div>
                                <p className="font-medium">{doc.name || doc.filename}</p>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <span>{(doc.size / 1024).toFixed(1)} KB</span>
                                  {doc.ocrConfidence !== undefined && doc.ocrConfidence > 0 && (
                                    <>
                                      <span>•</span>
                                      <span>OCR {Math.round(doc.ocrConfidence * 100)}% confidence</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant={viewingDocument?.id === doc.id ? "default" : "outline"}
                                size="sm"
                                className="gap-2"
                                onClick={() => viewingDocument?.id === doc.id ? handleClosePreview() : handleViewDocument(doc)}
                              >
                                {viewingDocument?.id === doc.id ? (
                                  <>
                                    <X className="h-4 w-4" />
                                    Close
                                  </>
                                ) : (
                                  <>
                                    <Eye className="h-4 w-4" />
                                    View
                                  </>
                                )}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-2"
                                onClick={() => handleDownloadDocument(doc)}
                              >
                                <Download className="h-4 w-4" />
                                Download
                              </Button>
                            </div>
                          </div>

                          {/* Inline Document Preview */}
                          {viewingDocument?.id === doc.id && (
                            <div className="mt-4 border-t pt-4">
                              {/* Zoom Controls */}
                              <div className="flex items-center justify-between mb-3 pb-3 border-b">
                                <div className="flex items-center gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleZoomOut}
                                    disabled={zoomLevel <= 25}
                                  >
                                    <ZoomOut className="h-4 w-4" />
                                  </Button>
                                  <span className="text-sm font-medium min-w-[60px] text-center">
                                    {zoomLevel}%
                                  </span>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleZoomIn}
                                    disabled={zoomLevel >= 300}
                                  >
                                    <ZoomIn className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleResetZoom}
                                    className="ml-2"
                                  >
                                    Reset
                                  </Button>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    if (signedUrl) {
                                      window.open(signedUrl, '_blank');
                                    } else {
                                      const viewUrl = doc.downloadUrl || getDocumentViewUrl(doc.id);
                                      window.open(viewUrl, '_blank');
                                    }
                                  }}
                                  className="gap-2"
                                >
                                  <ExternalLink className="h-4 w-4" />
                                  Open in New Tab
                                </Button>
                              </div>

                              {/* Preview Container with scroll */}
                              <div
                                className="relative bg-muted/30 rounded-lg overflow-auto"
                                style={{ maxHeight: '500px' }}
                              >
                                {signedUrlLoading ? (
                                  <div className="flex items-center justify-center min-h-[300px]">
                                    <div className="text-center">
                                      <FileImage className="h-12 w-12 mx-auto mb-4 animate-pulse text-muted-foreground" />
                                      <p className="text-muted-foreground">Loading document preview...</p>
                                    </div>
                                  </div>
                                ) : (
                                  <div
                                    className="flex items-center justify-center min-h-[300px] p-4"
                                    style={{
                                      transform: `scale(${zoomLevel / 100})`,
                                      transformOrigin: 'top center',
                                      transition: 'transform 0.2s ease-out'
                                    }}
                                  >
                                    {doc.type?.toLowerCase().includes('pdf') || doc.contentType?.includes('pdf') ? (
                                      <iframe
                                        src={signedUrl || doc.downloadUrl || getDocumentViewUrl(doc.id)}
                                        className="w-full border-0 rounded"
                                        style={{ height: '450px', minWidth: '600px' }}
                                        title={doc.name || doc.filename}
                                      />
                                    ) : (
                                      <img
                                        src={signedUrl || doc.downloadUrl || getDocumentViewUrl(doc.id)}
                                        alt={doc.name || doc.filename}
                                        className="max-w-full rounded shadow-lg"
                                        style={{ maxHeight: '450px', objectFit: 'contain' }}
                                        onError={(e) => {
                                          const target = e.target as HTMLImageElement;
                                          target.onerror = null;
                                          target.src = '/placeholder-document.png';
                                          target.alt = 'Document preview unavailable';
                                        }}
                                      />
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* History Tab */}
            <TabsContent value="history" className="mt-6">
              <Card>
                <CardContent className="pt-6">
                  <div className="space-y-6">
                    {(!claim.approvalHistory || claim.approvalHistory.length === 0) ? (
                      <p className="text-muted-foreground text-center py-4">No approval history yet</p>
                    ) : claim.approvalHistory.map((item, idx) => (
                      <div key={item.id} className="flex gap-4">
                        <div className="relative flex flex-col items-center">
                          <div
                            className={cn(
                              'flex h-8 w-8 items-center justify-center rounded-full',
                              item.action === 'approved'
                                ? 'bg-success/10 text-success'
                                : item.action === 'rejected'
                                  ? 'bg-destructive/10 text-destructive'
                                  : 'bg-primary/10 text-primary'
                            )}
                          >
                            {item.action === 'approved' ? (
                              <CheckCircle className="h-4 w-4" />
                            ) : item.action === 'rejected' ? (
                              <XCircle className="h-4 w-4" />
                            ) : (
                              <Send className="h-4 w-4" />
                            )}
                          </div>
                          {idx < claim.approvalHistory.length - 1 && (
                            <div className="absolute top-8 h-full w-px bg-border" />
                          )}
                        </div>
                        <div className="flex-1 pb-6">
                          <div className="flex items-center justify-between">
                            <p className="font-medium capitalize">{item.action}</p>
                            <p className="text-sm text-muted-foreground">
                              {formatDateTime(item.timestamp)}
                            </p>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            by {item.approverName || item.approverRole || 'Unknown'}
                          </p>
                          {item.comment && (
                            <p className="mt-2 text-sm rounded-lg bg-muted/50 p-3">
                              {item.comment}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* AI Analysis & Policy Checks - Only visible for Manager, HR, and Finance */}
          {(user?.role === 'manager' || user?.role === 'hr' || user?.role === 'finance') && (
            <div className="grid gap-6 md:grid-cols-2 mt-6">
              {/* AI Analysis Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bot className="h-5 w-5 text-primary" />
                    AI Analysis
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* AI Confidence Score */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Confidence Score</span>
                      <Badge
                        variant="outline"
                        className={cn(
                          "font-semibold",
                          (claim.aiConfidence || 0) >= 90 ? "bg-success/10 text-success border-success/20" :
                            (claim.aiConfidence || 0) >= 70 ? "bg-warning/10 text-warning border-warning/20" :
                              "bg-destructive/10 text-destructive border-destructive/20"
                        )}
                      >
                        {claim.aiConfidence?.toFixed(1) || '0'}%
                      </Badge>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className={cn(
                          "h-2 rounded-full transition-all",
                          (claim.aiConfidence || 0) >= 90 ? "bg-success" :
                            (claim.aiConfidence || 0) >= 70 ? "bg-warning" :
                              "bg-destructive"
                        )}
                        style={{ width: `${Math.min(claim.aiConfidence || 0, 100)}%` }}
                      />
                    </div>
                  </div>

                  <Separator />

                  {/* AI Recommendation */}
                  <div className="space-y-2">
                    <span className="text-sm text-muted-foreground">Recommendation</span>
                    <div className="flex items-center gap-2">
                      {claim.aiRecommendation === 'approve' ? (
                        <CheckCircle className="h-5 w-5 text-success" />
                      ) : claim.aiRecommendation === 'reject' ? (
                        <XCircle className="h-5 w-5 text-destructive" />
                      ) : (
                        <AlertTriangle className="h-5 w-5 text-warning" />
                      )}
                      <span className={cn(
                        "font-medium",
                        claim.aiRecommendation === 'approve' ? "text-success" :
                          claim.aiRecommendation === 'reject' ? "text-destructive" :
                            "text-warning"
                      )}>
                        {claim.aiRecommendationText || 'Manual review required'}
                      </span>
                    </div>
                  </div>

                  <Separator />

                  {/* Compliance Score */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Compliance Score</span>
                      <Badge
                        variant="outline"
                        className={cn(
                          "font-semibold",
                          (claim.complianceScore || 0) >= 90 ? "bg-success/10 text-success border-success/20" :
                            (claim.complianceScore || 0) >= 70 ? "bg-warning/10 text-warning border-warning/20" :
                              "bg-destructive/10 text-destructive border-destructive/20"
                        )}
                      >
                        {claim.complianceScore?.toFixed(0) || '0'}%
                      </Badge>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className={cn(
                          "h-2 rounded-full transition-all",
                          (claim.complianceScore || 0) >= 90 ? "bg-success" :
                            (claim.complianceScore || 0) >= 70 ? "bg-warning" :
                              "bg-destructive"
                        )}
                        style={{ width: `${Math.min(claim.complianceScore || 0, 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* AI Processing Status */}
                  <div className="flex items-center gap-2 pt-2">
                    <Zap className={cn(
                      "h-4 w-4",
                      claim.aiProcessed ? "text-primary" : "text-muted-foreground"
                    )} />
                    <span className="text-sm text-muted-foreground">
                      {claim.aiProcessed ? 'AI Processed' : 'Pending AI Analysis'}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Policy Checks Card */}
              {claim.policyChecks && claim.policyChecks.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <FileText className="h-5 w-5 text-primary" />
                        Policy Checks
                      </span>
                      <Badge
                        variant="outline"
                        className={cn(
                          "font-semibold",
                          (claim.complianceScore || 0) >= 80 ? "bg-success/10 text-success border-success/20" :
                            (claim.complianceScore || 0) >= 60 ? "bg-warning/10 text-warning border-warning/20" :
                              "bg-destructive/10 text-destructive border-destructive/20"
                        )}
                      >
                        {claim.policyChecks.filter(c => c.status === 'pass').length}/{claim.policyChecks.length}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {claim.policyChecks.map((check) => (
                      <div
                        key={check.id}
                        className={cn(
                          "flex items-start gap-3 rounded-lg p-3 transition-all",
                          check.status === 'pass' ? "bg-success/10" :
                            check.status === 'warning' ? "bg-warning/10" :
                              check.status === 'fail' ? "bg-destructive/10" :
                                "bg-secondary"
                        )}
                      >
                        <div className={cn(
                          "shrink-0 mt-0.5",
                          check.status === 'pass' ? "text-success" :
                            check.status === 'warning' ? "text-warning" :
                              check.status === 'fail' ? "text-destructive" :
                                "text-muted-foreground"
                        )}>
                          {check.status === 'pass' ? (
                            <CheckCircle className="h-4 w-4" />
                          ) : check.status === 'warning' ? (
                            <AlertTriangle className="h-4 w-4" />
                          ) : (
                            <XCircle className="h-4 w-4" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={cn(
                            "text-sm font-medium",
                            check.status === 'pass' ? "text-foreground" :
                              check.status === 'warning' ? "text-warning" :
                                check.status === 'fail' ? "text-destructive" :
                                  "text-muted-foreground"
                          )}>
                            {check.label}
                          </p>
                          {check.message && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {check.message}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Submitted By */}
          <Card>
            <CardHeader>
              <CardTitle>Submitted By</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarImage src={claim.submittedBy?.avatar} />
                  <AvatarFallback>
                    {(claim.submittedBy?.name || claim.employeeName || 'U')
                      .split(' ')
                      .map((n: string) => n[0])
                      .join('')}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{claim.submittedBy?.name || claim.employeeName || 'Unknown'}</p>
                  <p className="text-sm text-muted-foreground">
                    {claim.submittedBy?.department || claim.department || 'N/A'}
                  </p>
                </div>
              </div>
              <Separator className="my-4" />
              <p className="text-sm text-muted-foreground">
                Submitted on {formatDate(claim.submittedAt || claim.submissionDate)}
              </p>
            </CardContent>
          </Card>

          {/* Comments */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Comments ({comments.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {commentsLoading ? (
                <p className="text-muted-foreground text-center py-2">Loading comments...</p>
              ) : comments.length === 0 ? (
                <p className="text-muted-foreground text-center py-2">No comments yet</p>
              ) : comments.map((cmt) => (
                <div key={cmt.id} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="text-xs">
                        {cmt.user_name
                          .split(' ')
                          .map((n: string) => n[0])
                          .join('')}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium">{cmt.user_name}</span>
                    <Badge variant="outline" className="text-xs capitalize">
                      {cmt.user_role}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{cmt.comment_text}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(cmt.created_at)}
                  </p>
                </div>
              ))}

              <Separator />

              <div className="space-y-2">
                <Textarea
                  placeholder="Add a comment..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={3}
                />
                <Button
                  onClick={handleAddComment}
                  disabled={!comment.trim() || createCommentMutation.isPending}
                  size="sm"
                  className="w-full"
                >
                  {createCommentMutation.isPending ? 'Adding...' : 'Add Comment'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Action Confirmation Dialog */}
      <Dialog open={actionDialog.open} onOpenChange={(open) => setActionDialog({ open, action: open ? actionDialog.action : null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionDialog.action === 'approve' && 'Approve Claim'}
              {actionDialog.action === 'reject' && 'Reject Claim'}
              {actionDialog.action === 'return' && 'Return Claim'}
            </DialogTitle>
            <DialogDescription>
              {actionDialog.action === 'approve' && 'Are you sure you want to approve this claim?'}
              {actionDialog.action === 'reject' && 'Are you sure you want to reject this claim?'}
              {actionDialog.action === 'return' && 'Please provide instructions for the employee to correct the claim.'}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              placeholder={actionDialog.action === 'return' ? 'Instructions for correction...' : 'Add a comment (optional)...'}
              value={actionComment}
              onChange={(e) => setActionComment(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setActionDialog({ open: false, action: null }); setActionComment(''); }}>
              Cancel
            </Button>
            <Button
              variant={actionDialog.action === 'reject' ? 'destructive' : actionDialog.action === 'return' ? 'outline' : 'default'}
              onClick={confirmAction}
              disabled={actionDialog.action === 'return' && actionComment.length < 10}
            >
              {actionDialog.action === 'approve' && 'Confirm Approve'}
              {actionDialog.action === 'reject' && 'Confirm Reject'}
              {actionDialog.action === 'return' && 'Confirm Return'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
