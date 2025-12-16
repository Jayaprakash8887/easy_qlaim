import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  XCircle,
  RotateCcw,
  Eye,
  Bot,
  Clock,
  AlertTriangle,
  Filter,
  ArrowUpDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ClaimStatusBadge } from '@/components/claims/ClaimStatusBadge';
import { AIConfidenceBadge } from '@/components/claims/AIConfidenceBadge';
import { useClaims } from '@/hooks/useClaims';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { Claim, ClaimStatus } from '@/types';

// Helper to get pending status based on role
function getPendingStatusForRole(role: string): ClaimStatus | null {
  switch (role) {
    case 'manager': return 'pending_manager';
    case 'hr': return 'pending_hr';
    case 'finance': return 'pending_finance';
    case 'admin': return null; // Admin can see all pending
    default: return null;
  }
}

export default function ApprovalQueue() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [selectedClaimIndex, setSelectedClaimIndex] = useState(0);
  const [sortBy, setSortBy] = useState<'date' | 'amount' | 'confidence'>('date');
  const [actionDialog, setActionDialog] = useState<{
    open: boolean;
    action: 'approve' | 'reject' | 'return' | null;
  }>({ open: false, action: null });
  const [actionComment, setActionComment] = useState('');
  
  const { data: allClaims = [], isLoading, error, refetch } = useClaims();

  const pendingClaims = useMemo(() => {
    const pendingStatus = getPendingStatusForRole(user?.role || 'employee');
    
    // Filter claims based on role
    let claims = allClaims.filter(claim => {
      if (pendingStatus) {
        return claim.status === pendingStatus;
      }
      // Admin sees all pending claims
      return ['pending_manager', 'pending_hr', 'pending_finance'].includes(claim.status);
    });
    
    return claims.sort((a, b) => {
      switch (sortBy) {
        case 'amount':
          return b.amount - a.amount;
        case 'confidence':
          return (b.aiConfidence || 0) - (a.aiConfidence || 0);
        default:
          const aDate = a.submissionDate || new Date();
          const bDate = b.submissionDate || new Date();
          return bDate.getTime() - aDate.getTime();
      }
    });
  }, [allClaims, user?.role, sortBy]);

  const currentClaim = pendingClaims[selectedClaimIndex];

  const handleAction = (action: 'approve' | 'reject' | 'return') => {
    setActionDialog({ open: true, action });
  };

  const confirmAction = async () => {
    if (!currentClaim) return;
    
    const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';
    const action = actionDialog.action;
    
    try {
      let endpoint = '';
      let body: Record<string, string> = {};
      
      if (action === 'approve') {
        endpoint = `${API_BASE_URL}/claims/${currentClaim.id}/approve`;
        if (actionComment) body = { comment: actionComment };
      } else if (action === 'reject') {
        endpoint = `${API_BASE_URL}/claims/${currentClaim.id}/reject`;
        if (actionComment) body = { comment: actionComment };
      } else if (action === 'return') {
        endpoint = `${API_BASE_URL}/claims/${currentClaim.id}/return`;
        body = { return_reason: actionComment || 'Please review and correct the claim' };
      }
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Action failed');
      }
      
      const messages = {
        approve: 'Claim approved successfully',
        reject: 'Claim rejected',
        return: 'Claim returned to employee',
      };
      toast({ title: messages[action!] });
      
      // Refresh claims list
      await refetch();
      
      // Move to next claim or reset index
      if (pendingClaims.length <= 1) {
        setSelectedClaimIndex(0);
      } else if (selectedClaimIndex >= pendingClaims.length - 1) {
        setSelectedClaimIndex(Math.max(0, pendingClaims.length - 2));
      }
      
    } catch (error) {
      toast({ 
        title: 'Action failed', 
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive' 
      });
    }
    
    setActionDialog({ open: false, action: null });
    setActionComment('');
  };

  const navigateClaim = (direction: 'prev' | 'next') => {
    if (direction === 'prev' && selectedClaimIndex > 0) {
      setSelectedClaimIndex(selectedClaimIndex - 1);
    } else if (direction === 'next' && selectedClaimIndex < pendingClaims.length - 1) {
      setSelectedClaimIndex(selectedClaimIndex + 1);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Approval Queue</h1>
          <p className="text-muted-foreground">
            Review and approve pending expense claims
          </p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Bot className="h-16 w-16 text-primary animate-pulse mb-4" />
            <p className="text-muted-foreground">Loading pending claims...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (pendingClaims.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Approval Queue</h1>
          <p className="text-muted-foreground">
            Review and approve pending expense claims
          </p>
        </div>

        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <CheckCircle className="h-16 w-16 text-success mb-4" />
            <h2 className="text-xl font-semibold mb-2">All Caught Up!</h2>
            <p className="text-muted-foreground text-center max-w-md">
              You have no pending claims to review. New claims will appear here
              when submitted.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Approval Queue</h1>
          <p className="text-muted-foreground">
            {pendingClaims.length} claims pending your review
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
            <SelectTrigger className="w-[180px]">
              <ArrowUpDown className="mr-2 h-4 w-4" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date">Sort by Date</SelectItem>
              <SelectItem value="amount">Sort by Amount</SelectItem>
              <SelectItem value="confidence">Sort by AI Score</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Claims List */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                Pending Claims ({pendingClaims.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[600px] overflow-y-auto">
                {pendingClaims.map((claim, idx) => (
                  <div
                    key={claim.id}
                    onClick={() => setSelectedClaimIndex(idx)}
                    className={cn(
                      'flex cursor-pointer items-start gap-3 border-b border-border p-4 transition-colors hover:bg-accent/50',
                      selectedClaimIndex === idx && 'bg-accent'
                    )}
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={claim.submittedBy?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${claim.employeeName}`} />
                      <AvatarFallback className="text-xs">
                        {(claim.submittedBy?.name || claim.employeeName || 'UN')
                          .split(' ')
                          .map((n) => n[0])
                          .join('')}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium truncate">{claim.title}</p>
                        <span className="shrink-0 font-semibold text-sm">
                          ₹{claim.amount.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-muted-foreground">
                          {claim.employeeName || 'Unknown Employee'}
                        </span>
                        <span className="text-xs text-muted-foreground">•</span>
                        <span className="text-xs text-muted-foreground">
                          {format(claim.submissionDate || new Date(), 'MMM dd')}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <AIConfidenceBadge
                          score={claim.aiConfidence || 0}
                          size="sm"
                          showIcon={false}
                        />
                        {(claim.policyViolations?.length || 0) > 0 && (
                          <Badge variant="destructive" className="gap-1 text-xs px-1.5">
                            <AlertTriangle className="h-3 w-3" />
                            {claim.policyViolations?.length}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Claim Details */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <div className="flex items-center gap-3">
                <CardTitle>{currentClaim.claimNumber}</CardTitle>
                <ClaimStatusBadge status={currentClaim.status} />
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => navigateClaim('prev')}
                  disabled={selectedClaimIndex === 0}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground px-2">
                  {selectedClaimIndex + 1} / {pendingClaims.length}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => navigateClaim('next')}
                  disabled={selectedClaimIndex === pendingClaims.length - 1}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* AI Analysis - Compact */}
              <div className="rounded-lg bg-ai/5 border border-ai/20 p-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Bot className="h-4 w-4 text-ai" />
                    <span className="font-medium text-sm text-ai">AI Analysis</span>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-muted-foreground">Confidence Score</span>
                      <AIConfidenceBadge score={currentClaim.aiConfidence || 0} />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-muted-foreground">Compliance Score</span>
                      <Badge
                        variant="outline"
                        className={cn(
                          'gap-1 font-semibold text-xs',
                          (currentClaim.complianceScore || 0) >= 80
                            ? 'bg-success/10 text-success border-success/20'
                            : (currentClaim.complianceScore || 0) >= 60
                            ? 'bg-warning/10 text-warning border-warning/20'
                            : 'bg-destructive/10 text-destructive border-destructive/20'
                        )}
                      >
                        {(currentClaim.complianceScore || 0).toFixed(0)}% Compliant
                      </Badge>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        'gap-1 text-xs',
                        (currentClaim.aiConfidence || 0) >= 90
                          ? 'bg-success/10 text-success border-success/20'
                          : 'bg-warning/10 text-warning border-warning/20'
                      )}
                    >
                      {(currentClaim.aiConfidence || 0) >= 90 ? (
                        <>
                          <CheckCircle className="h-3 w-3" />
                          Auto-approve recommended
                        </>
                      ) : (
                        <>
                          <Clock className="h-3 w-3" />
                          Manual review required
                        </>
                      )}
                    </Badge>
                  </div>
                </div>
                {/* Policy Checks - Inline */}
                {currentClaim.policyChecks && currentClaim.policyChecks.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-ai/20">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-muted-foreground">
                        Policy Checks ({currentClaim.policyChecks.filter(c => c.status === 'pass').length}/{currentClaim.policyChecks.length} passed)
                      </span>
                      {currentClaim.policyChecks.map((check) => (
                        <div 
                          key={check.id}
                          className={cn(
                            "flex items-center gap-1 text-xs rounded px-1.5 py-0.5",
                            check.status === 'pass' ? "bg-success/10 text-success" :
                            check.status === 'warning' ? "bg-warning/10 text-warning" :
                            "bg-destructive/10 text-destructive"
                          )}
                        >
                          {check.status === 'pass' ? (
                            <CheckCircle className="h-3 w-3 shrink-0" />
                          ) : check.status === 'warning' ? (
                            <AlertTriangle className="h-3 w-3 shrink-0" />
                          ) : (
                            <XCircle className="h-3 w-3 shrink-0" />
                          )}
                          <span>{check.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {(currentClaim.policyViolations?.length || 0) > 0 && (
                  <div className="mt-2 pt-2 border-t border-ai/20">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-muted-foreground">Policy Violations</span>
                      {currentClaim.policyViolations?.map((violation, idx) => (
                        <Badge key={idx} variant="destructive" className="gap-1 text-xs">
                          <AlertTriangle className="h-3 w-3" />
                          {violation}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Claim Details */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-sm text-muted-foreground">Title</p>
                  <p className="font-medium">{currentClaim.title}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Amount</p>
                  <p className="font-semibold text-lg">
                    ₹{currentClaim.amount.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Category</p>
                  <Badge variant="outline" className="capitalize">
                    {typeof currentClaim.category === 'string' ? currentClaim.category : currentClaim.category?.name || 'Other'}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Description</p>
                  <p className="font-medium">{currentClaim.description || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Expense Date</p>
                  <p className="font-medium">
                    {format(currentClaim.claimDate || currentClaim.submissionDate || new Date(), 'MMMM dd, yyyy')}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Project Code</p>
                  <p className="font-medium">{currentClaim.projectCode || 'N/A'}</p>
                </div>
              </div>

              {/* Submitted By */}
              <div className="flex items-center gap-3 rounded-lg bg-secondary/50 p-4">
                <Avatar>
                  <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${currentClaim.employeeName || 'User'}`} />
                  <AvatarFallback>
                    {(currentClaim.employeeName || 'U')
                      .split(' ')
                      .map((n) => n[0])
                      .join('')}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{currentClaim.employeeName || 'Unknown Employee'}</p>
                  <p className="text-sm text-muted-foreground">
                    {currentClaim.department || 'Unknown Dept'} •{' '}
                    {format(currentClaim.submissionDate || new Date(), 'MMM dd, yyyy HH:mm')}
                  </p>
                </div>
              </div>

              {/* Documents */}
              {(currentClaim.documents?.length || 0) > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">
                    Attached Documents ({currentClaim.documents?.length || 0})
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {currentClaim.documents?.map((doc) => (
                      <Badge key={doc.id} variant="outline" className="gap-1">
                        {doc.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-col gap-3 sm:flex-row sm:justify-between pt-4 border-t">
                <Button
                  variant="outline"
                  asChild
                  className="gap-2"
                >
                  <Link to={`/claims/${currentClaim.id}`}>
                    <Eye className="h-4 w-4" />
                    View Full Details
                  </Link>
                </Button>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="gap-2 text-warning hover:text-warning"
                    onClick={() => handleAction('return')}
                  >
                    <RotateCcw className="h-4 w-4" />
                    Return
                  </Button>
                  <Button
                    variant="outline"
                    className="gap-2 text-destructive hover:text-destructive"
                    onClick={() => handleAction('reject')}
                  >
                    <XCircle className="h-4 w-4" />
                    Reject
                  </Button>
                  <Button
                    variant="gradient"
                    className="gap-2"
                    onClick={() => handleAction('approve')}
                  >
                    <CheckCircle className="h-4 w-4" />
                    Approve
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Action Confirmation Dialog */}
      <Dialog open={actionDialog.open} onOpenChange={(open) => setActionDialog({ open, action: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="capitalize">
              {actionDialog.action} Claim
            </DialogTitle>
            <DialogDescription>
              {actionDialog.action === 'approve' &&
                'Are you sure you want to approve this claim?'}
              {actionDialog.action === 'reject' &&
                'Please provide a reason for rejecting this claim.'}
              {actionDialog.action === 'return' &&
                'Please provide instructions for the employee to correct the claim.'}
            </DialogDescription>
          </DialogHeader>
          {actionDialog.action !== 'approve' && (
            <Textarea
              placeholder={
                actionDialog.action === 'reject'
                  ? 'Reason for rejection...'
                  : 'Instructions for correction...'
              }
              value={actionComment}
              onChange={(e) => setActionComment(e.target.value)}
              rows={4}
            />
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setActionDialog({ open: false, action: null })}
            >
              Cancel
            </Button>
            <Button
              variant={actionDialog.action === 'approve' ? 'gradient' : 'destructive'}
              onClick={confirmAction}
              disabled={
                actionDialog.action !== 'approve' && !actionComment.trim()
              }
            >
              Confirm {actionDialog.action}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
