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
import { getPendingApprovals } from '@/data/mockClaims';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { Claim } from '@/types';

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

  const pendingClaims = useMemo(() => {
    const claims = getPendingApprovals(user?.role || 'employee');
    return claims.sort((a, b) => {
      switch (sortBy) {
        case 'amount':
          return b.amount - a.amount;
        case 'confidence':
          return (b.aiConfidenceScore || 0) - (a.aiConfidenceScore || 0);
        default:
          return b.submittedAt.getTime() - a.submittedAt.getTime();
      }
    });
  }, [user?.role, sortBy]);

  const currentClaim = pendingClaims[selectedClaimIndex];

  const handleAction = (action: 'approve' | 'reject' | 'return') => {
    setActionDialog({ open: true, action });
  };

  const confirmAction = () => {
    const messages = {
      approve: 'Claim approved successfully',
      reject: 'Claim rejected',
      return: 'Claim returned to employee',
    };
    toast({ title: messages[actionDialog.action!] });
    setActionDialog({ open: false, action: null });
    setActionComment('');

    // Move to next claim
    if (selectedClaimIndex < pendingClaims.length - 1) {
      setSelectedClaimIndex(selectedClaimIndex + 1);
    } else if (pendingClaims.length > 1) {
      setSelectedClaimIndex(0);
    }
  };

  const navigateClaim = (direction: 'prev' | 'next') => {
    if (direction === 'prev' && selectedClaimIndex > 0) {
      setSelectedClaimIndex(selectedClaimIndex - 1);
    } else if (direction === 'next' && selectedClaimIndex < pendingClaims.length - 1) {
      setSelectedClaimIndex(selectedClaimIndex + 1);
    }
  };

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
                      <AvatarImage src={claim.submittedBy.avatar} />
                      <AvatarFallback className="text-xs">
                        {claim.submittedBy.name
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
                          {claim.submittedBy.name}
                        </span>
                        <span className="text-xs text-muted-foreground">•</span>
                        <span className="text-xs text-muted-foreground">
                          {format(claim.submittedAt, 'MMM dd')}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <AIConfidenceBadge
                          score={claim.aiConfidenceScore || 0}
                          size="sm"
                          showIcon={false}
                        />
                        {claim.policyViolations.length > 0 && (
                          <Badge variant="destructive" className="gap-1 text-xs px-1.5">
                            <AlertTriangle className="h-3 w-3" />
                            {claim.policyViolations.length}
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
            <CardContent className="space-y-6">
              {/* AI Analysis */}
              <div className="rounded-lg bg-ai/5 border border-ai/20 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Bot className="h-5 w-5 text-ai" />
                  <span className="font-medium text-ai">AI Analysis</span>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">
                      Confidence Score
                    </p>
                    <AIConfidenceBadge score={currentClaim.aiConfidenceScore || 0} />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">
                      AI Recommendation
                    </p>
                    <Badge
                      variant="outline"
                      className={cn(
                        'gap-1',
                        (currentClaim.aiConfidenceScore || 0) >= 90
                          ? 'bg-success/10 text-success border-success/20'
                          : 'bg-warning/10 text-warning border-warning/20'
                      )}
                    >
                      {(currentClaim.aiConfidenceScore || 0) >= 90 ? (
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
                {currentClaim.policyViolations.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-ai/20">
                    <p className="text-sm text-muted-foreground mb-2">
                      Policy Violations
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {currentClaim.policyViolations.map((violation, idx) => (
                        <Badge key={idx} variant="destructive" className="gap-1">
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
                  <Badge variant="outline">{currentClaim.category.name}</Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Vendor</p>
                  <p className="font-medium">{currentClaim.vendor}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Expense Date</p>
                  <p className="font-medium">
                    {format(currentClaim.date, 'MMMM dd, yyyy')}
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
                  <AvatarImage src={currentClaim.submittedBy.avatar} />
                  <AvatarFallback>
                    {currentClaim.submittedBy.name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{currentClaim.submittedBy.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {currentClaim.submittedBy.department} •{' '}
                    {format(currentClaim.submittedAt, 'MMM dd, yyyy HH:mm')}
                  </p>
                </div>
              </div>

              {/* Documents */}
              {currentClaim.documents.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">
                    Attached Documents ({currentClaim.documents.length})
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {currentClaim.documents.map((doc) => (
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
