import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Send,
  Loader2,
  FileText,
  Calendar,
  DollarSign,
  AlertCircle,
  MessageSquare,
  Zap,
  User,
  CheckCircle2,
  Tag,
  Folder,
  Hash,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { DataSource } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ClaimStatusBadge } from '@/components/claims/ClaimStatusBadge';
import { useClaim, useUpdateClaim, ClaimUpdateData } from '@/hooks/useClaims';
import { useDocuments } from '@/hooks/useDocuments';
import { useComments, useCreateComment } from '@/hooks/useComments';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/contexts/AuthContext';
import { useFormatting } from '@/hooks/useFormatting';
import { toast } from '@/hooks/use-toast';
import { useReimbursementsByRegion } from '@/hooks/usePolicies';
import { PolicyChecks } from '@/components/claims/PolicyChecks';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function EditClaim() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const { data: claim, isLoading, error } = useClaim(id || '');
  const { data: documents = [] } = useDocuments(id || '');
  const { data: comments = [], isLoading: commentsLoading } = useComments(id || '');
  const updateClaim = useUpdateClaim();
  const createCommentMutation = useCreateComment();
  const { user } = useAuth();
  const { formatCurrency, formatDateTime, checkFinancialYear } = useFormatting();
  
  // Fetch reimbursement categories for policy validation
  const { data: reimbursementCategories = [] } = useReimbursementsByRegion(user?.region);
  
  const [formData, setFormData] = useState({
    amount: '',
    claim_date: '',
    description: '',
    category: '',
    title: '',
    project_code: '',
    transaction_ref: '',
  });
  const [editedFields, setEditedFields] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [comment, setComment] = useState('');

  // Helper to format date for input
  const formatDateForInput = (date: Date | string | null) => {
    if (!date) return new Date().toISOString().split('T')[0];
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toISOString().split('T')[0];
  };

  // Initialize form data when claim loads
  useEffect(() => {
    if (claim) {
      const payload = claim.claimPayload || {};
      setFormData({
        amount: claim.amount?.toString() || '',
        claim_date: formatDateForInput(claim.claimDate),
        description: claim.description || '',
        category: claim.category || '',
        title: payload.title || claim.title || '',
        project_code: payload.project_code || '',
        transaction_ref: payload.transaction_ref || '',
      });
    }
  }, [claim]);
  
  // Get the selected category's policy details
  const selectedCategoryPolicy = useMemo(() => {
    if (!claim?.category) return null;
    return reimbursementCategories.find(cat => 
      cat.category_code.toLowerCase() === claim.category.toLowerCase()
    ) || null;
  }, [claim?.category, reimbursementCategories]);
  
  // Amount validation against policy
  const amountValidation = useMemo(() => {
    if (!selectedCategoryPolicy) {
      return { 
        status: 'warning' as const, 
        message: "No policy limits for this category" 
      };
    }
    
    const claimAmount = parseFloat(formData.amount || '0');
    const maxAmount = selectedCategoryPolicy.max_amount;
    
    if (!claimAmount) {
      return { 
        status: 'checking' as const, 
        message: "Enter amount to validate against policy" 
      };
    }
    
    if (maxAmount && claimAmount > maxAmount) {
      return { 
        status: 'fail' as const, 
        message: `Amount ${formatCurrency(claimAmount)} exceeds policy limit of ${formatCurrency(maxAmount)}` 
      };
    }
    
    return { 
      status: 'pass' as const, 
      message: maxAmount 
        ? `Amount ${formatCurrency(claimAmount)} within policy limit of ${formatCurrency(maxAmount)}`
        : "Amount verified - no policy limit defined"
    };
  }, [formData.amount, selectedCategoryPolicy, formatCurrency]);
  
  // Date validation against policy
  const dateValidation = useMemo(() => {
    if (!selectedCategoryPolicy) {
      return { 
        status: 'warning' as const, 
        message: "No date restrictions for this category" 
      };
    }
    
    const claimDate = formData.claim_date;
    const submissionWindowDays = selectedCategoryPolicy.submission_window_days;
    
    if (!claimDate) {
      return { 
        status: 'checking' as const, 
        message: "Enter date to validate against policy" 
      };
    }
    
    if (submissionWindowDays) {
      const today = new Date();
      const daysDiff = Math.floor((today.getTime() - new Date(claimDate).getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysDiff > submissionWindowDays) {
        return { 
          status: 'fail' as const, 
          message: `Receipt date is ${daysDiff} days old, exceeds ${submissionWindowDays}-day submission window` 
        };
      }
      
      return { 
        status: 'pass' as const, 
        message: `Within ${submissionWindowDays}-day submission window (${daysDiff} days old)` 
      };
    }
    
    return { 
      status: 'pass' as const, 
      message: "Date verified - no submission window restriction" 
    };
  }, [formData.claim_date, selectedCategoryPolicy]);
  
  // Policy checks array for display
  const policyChecks = useMemo(() => {
    const allDocuments = documents.length > 0 ? documents : (claim?.documents || []);
    
    // Financial year validation
    let fyStatus: 'pass' | 'fail' | 'warning' | 'checking' = 'checking';
    let fyMessage = 'Enter date to check financial year';
    
    if (formData.claim_date) {
      const fyCheck = checkFinancialYear(formData.claim_date);
      if (fyCheck.isCurrentFY) {
        fyStatus = 'pass';
        fyMessage = `Within current ${fyCheck.fyLabel}`;
      } else {
        fyStatus = 'fail';
        fyMessage = `Outside current ${fyCheck.fyLabel}`;
      }
    }
    
    return [
      {
        id: "category",
        label: "Category",
        status: claim?.category ? "pass" as const : "warning" as const,
        message: claim?.category 
          ? `Category: ${claim.category}` 
          : "Category not set",
      },
      {
        id: "amount",
        label: "Amount within limit",
        status: amountValidation.status,
        message: amountValidation.message,
      },
      {
        id: "date",
        label: "Within submission window",
        status: dateValidation.status,
        message: dateValidation.message,
      },
      {
        id: "docs",
        label: "Required documents",
        status: allDocuments.length > 0 ? "pass" as const : "warning" as const,
        message: allDocuments.length > 0 
          ? `${allDocuments.length} document(s) attached` 
          : "No documents attached",
      },
      {
        id: "financial_year",
        label: "Current financial year",
        status: fyStatus,
        message: fyMessage,
      },
      {
        id: "description",
        label: "Description provided",
        status: formData.description && formData.description.length > 10 
          ? "pass" as const 
          : "warning" as const,
        message: formData.description && formData.description.length > 10
          ? "Description provided"
          : "Add a detailed description",
      },
    ];
  }, [claim, formData, amountValidation, dateValidation, documents, checkFinancialYear]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!id) return;
    
    setIsSaving(true);
    
    try {
      const updateData: ClaimUpdateData = {};
      
      if (formData.amount) {
        updateData.amount = parseFloat(formData.amount);
      }
      if (formData.claim_date) {
        updateData.claim_date = formData.claim_date;
      }
      if (formData.description) {
        updateData.description = formData.description;
      }
      if (formData.category) {
        updateData.category = formData.category;
      }
      if (formData.title) {
        updateData.title = formData.title;
      }
      if (formData.project_code) {
        updateData.project_code = formData.project_code;
      }
      if (formData.transaction_ref) {
        updateData.transaction_ref = formData.transaction_ref;
      }
      
      // Include edited field sources - mark as 'manual' for edited fields
      if (editedFields.size > 0) {
        updateData.edited_sources = Array.from(editedFields);
      }
      
      // Set status to PENDING_MANAGER for resubmission
      updateData.status = 'PENDING_MANAGER';
      
      await updateClaim.mutateAsync({ claimId: id, data: updateData });
      
      toast({
        title: "Claim Submitted",
        description: "Your claim has been resubmitted for approval.",
      });
      
      // Use replace to prevent going back to edit page via browser back button
      navigate(`/claims/${id}`, { replace: true });
    } catch (error: any) {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update claim. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex h-[50vh] flex-col items-center justify-center gap-4">
        <Loader2 className="h-16 w-16 text-primary animate-spin" />
        <p className="text-muted-foreground">Loading claim...</p>
      </div>
    );
  }

  // Error state
  if (error || !claim) {
    return (
      <div className="flex h-[50vh] flex-col items-center justify-center gap-4">
        <FileText className="h-16 w-16 text-muted-foreground" />
        <h2 className="text-xl font-semibold">Claim Not Found</h2>
        <p className="text-muted-foreground">
          The claim you're trying to edit doesn't exist.
        </p>
        <Button onClick={() => navigate('/claims')}>Back to Claims</Button>
      </div>
    );
  }

  // Check if claim can be edited - only returned claims can be edited
  const canEdit = claim.status === 'returned';
  
  if (!canEdit) {
    return (
      <div className="flex h-[50vh] flex-col items-center justify-center gap-4">
        <AlertCircle className="h-16 w-16 text-warning" />
        <h2 className="text-xl font-semibold">Cannot Edit Claim</h2>
        <p className="text-muted-foreground">
          Only claims returned for correction can be edited. Current status: {claim.status}.
        </p>
        <Button onClick={() => navigate(`/claims/${id}`)}>View Claim Details</Button>
      </div>
    );
  }

  const allDocuments = documents.length > 0 ? documents : (claim.documents || []);

  // Helper to get data source badge
  const getDataSourceBadge = (source: DataSource | string) => {
    const config = {
      ocr: { label: 'Auto', icon: Zap, className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
      auto: { label: 'Auto', icon: Zap, className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
      manual: { label: 'Manual', icon: User, className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
      edited: { label: 'Edited', icon: User, className: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300' },
    };
    const { label, icon: Icon, className } = config[source as keyof typeof config] || config.manual;
    return (
      <Badge variant="outline" className={cn('gap-1 text-xs ml-2', className)}>
        <Icon className="h-3 w-3" />
        {label}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/claims')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-foreground">
              Edit Claim
            </h1>
            <ClaimStatusBadge status={claim.status} />
          </div>
          <p className="text-muted-foreground">{claim.claimNumber}</p>
        </div>
      </div>

      {/* Return Reason Alert */}
      {claim.returnReason && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="ml-2">
            <strong>Reason for Return:</strong> {claim.returnReason}
            {claim.returnCount && claim.returnCount > 1 && (
              <span className="ml-2 text-sm">(Returned {claim.returnCount} times)</span>
            )}
          </AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit}>
        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - Claim Details */}
          <div className="space-y-6">
            {/* Claim Details Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Claim Details
                </CardTitle>
                <CardDescription>
                  Update the claim information below. Documents cannot be modified.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Category */}
                <div className="space-y-2">
                  <Label htmlFor="category" className="flex items-center">
                    <Tag className="h-4 w-4 mr-2" />
                    Category
                    {getDataSourceBadge(editedFields.has('category') ? 'manual' : (claim.dataSource?.category || 'manual'))}
                  </Label>
                  <Select
                    value={formData.category}
                    onValueChange={(value) => {
                      setFormData(prev => ({ ...prev, category: value }));
                      setEditedFields(prev => new Set(prev).add('category'));
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {reimbursementCategories.map((cat) => (
                        <SelectItem key={cat.category_code} value={cat.category_code}>
                          {cat.category_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Expense Title */}
                <div className="space-y-2">
                  <Label htmlFor="title" className="flex items-center">
                    <FileText className="h-4 w-4 mr-2" />
                    Expense Title
                    {getDataSourceBadge(editedFields.has('title') ? 'manual' : (claim.dataSource?.title || 'manual'))}
                  </Label>
                  <Input
                    id="title"
                    type="text"
                    value={formData.title}
                    onChange={(e) => {
                      setFormData(prev => ({ ...prev, title: e.target.value }));
                      setEditedFields(prev => new Set(prev).add('title'));
                    }}
                    placeholder="Enter expense title"
                  />
                </div>

                {/* Amount */}
                <div className="space-y-2">
                  <Label htmlFor="amount" className="flex items-center">
                    <DollarSign className="h-4 w-4 mr-2" />
                    Amount (INR)
                    {getDataSourceBadge(editedFields.has('amount') ? 'manual' : (claim.dataSource?.amount || 'manual'))}
                  </Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.amount}
                    onChange={(e) => {
                      setFormData(prev => ({ ...prev, amount: e.target.value }));
                      setEditedFields(prev => new Set(prev).add('amount'));
                    }}
                    placeholder="Enter amount"
                    required
                  />
                </div>

                {/* Expense Date */}
                <div className="space-y-2">
                  <Label htmlFor="claim_date" className="flex items-center">
                    <Calendar className="h-4 w-4 mr-2" />
                    Expense Date
                    {getDataSourceBadge(editedFields.has('date') ? 'manual' : (claim.dataSource?.date || 'manual'))}
                  </Label>
                  <Input
                    id="claim_date"
                    type="date"
                    value={formData.claim_date}
                    onChange={(e) => {
                      setFormData(prev => ({ ...prev, claim_date: e.target.value }));
                      setEditedFields(prev => new Set(prev).add('date'));
                    }}
                    required
                  />
                </div>

                {/* Project Code */}
                <div className="space-y-2">
                  <Label htmlFor="project_code" className="flex items-center">
                    <Folder className="h-4 w-4 mr-2" />
                    Project Code
                    {getDataSourceBadge(editedFields.has('project_code') ? 'manual' : 'manual')}
                  </Label>
                  <Input
                    id="project_code"
                    type="text"
                    value={formData.project_code}
                    onChange={(e) => {
                      setFormData(prev => ({ ...prev, project_code: e.target.value }));
                      setEditedFields(prev => new Set(prev).add('project_code'));
                    }}
                    placeholder="Enter project code"
                  />
                </div>

                {/* Transaction Ref ID */}
                <div className="space-y-2">
                  <Label htmlFor="transaction_ref" className="flex items-center">
                    <Hash className="h-4 w-4 mr-2" />
                    Transaction Ref ID
                    {getDataSourceBadge(editedFields.has('transaction_ref') ? 'manual' : (claim.dataSource?.transactionRef || 'manual'))}
                  </Label>
                  <Input
                    id="transaction_ref"
                    type="text"
                    value={formData.transaction_ref}
                    onChange={(e) => {
                      setFormData(prev => ({ ...prev, transaction_ref: e.target.value }));
                      setEditedFields(prev => new Set(prev).add('transaction_ref'));
                    }}
                    placeholder="Enter transaction reference ID"
                  />
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <Label htmlFor="description" className="flex items-center">
                    Description
                    {getDataSourceBadge(editedFields.has('description') ? 'manual' : (claim.dataSource?.description || 'manual'))}
                  </Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => {
                      setFormData(prev => ({ ...prev, description: e.target.value }));
                      setEditedFields(prev => new Set(prev).add('description'));
                    }}
                    placeholder="Enter claim description"
                    rows={4}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Alert */}
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Documents cannot be modified after upload. To change documents, please create a new claim.
              </AlertDescription>
            </Alert>

            {/* Actions */}
            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/claims')}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSaving}
                className="gap-2"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Submit
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Right Column - Documents & Comments */}
          <div className="space-y-6">
            {/* Documents Card (Read-only) */}
            <Card>
              <CardHeader>
                <CardTitle>Attached Documents</CardTitle>
                <CardDescription>
                  Documents cannot be modified after upload. View only.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {allDocuments.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No documents attached to this claim.</p>
                ) : (
                  <div className="space-y-2">
                    {allDocuments.map((doc: any, index: number) => (
                      <div 
                        key={doc.id || index}
                        className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <FileText className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium">{doc.filename || doc.name || `Document ${index + 1}`}</p>
                            <p className="text-xs text-muted-foreground">
                              {doc.file_type || doc.contentType || 'Unknown type'}
                            </p>
                          </div>
                        </div>
                        <Badge variant="outline">Read-only</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Policy Checks - Real-time validation */}
            <PolicyChecks checks={policyChecks} />

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
                ) : (
                  comments.map((cmt: any) => (
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
                        {cmt.comment_type && cmt.comment_type !== 'GENERAL' && (
                          <Badge 
                            variant={cmt.comment_type === 'RETURN' ? 'secondary' : 
                                    cmt.comment_type === 'REJECTION' ? 'destructive' : 'outline'} 
                            className="text-xs"
                          >
                            {cmt.comment_type}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{cmt.comment_text}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(cmt.created_at)}
                      </p>
                    </div>
                  ))
                )}

                <Separator />

                {/* Add Comment Form */}
                <div className="space-y-2">
                  <Textarea
                    placeholder="Add a comment..."
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={3}
                  />
                  <Button
                    type="button"
                    onClick={async () => {
                      if (!comment.trim() || !id) return;
                      try {
                        await createCommentMutation.mutateAsync({
                          claim_id: id,
                          comment_text: comment,
                          comment_type: 'GENERAL',
                          user_name: user?.name || 'Employee',
                          user_role: 'EMPLOYEE',
                          visible_to_employee: true,
                        });
                        toast({ title: 'Comment added successfully' });
                        setComment('');
                      } catch (error) {
                        toast({ title: 'Failed to add comment', variant: 'destructive' });
                      }
                    }}
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
      </form>
    </div>
  );
}
