import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { format } from 'date-fns';
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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ClaimStatusBadge } from '@/components/claims/ClaimStatusBadge';
import { AIConfidenceBadge } from '@/components/claims/AIConfidenceBadge';
import { getClaimById } from '@/data/mockClaims';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { DataSource } from '@/types';

export default function ClaimDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [comment, setComment] = useState('');
  const [activeTab, setActiveTab] = useState('details');

  const claim = getClaimById(id || '');

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

  const handleAction = (action: 'approve' | 'reject' | 'return') => {
    const messages = {
      approve: 'Claim approved successfully',
      reject: 'Claim rejected',
      return: 'Claim returned to employee',
    };
    toast({ title: messages[action] });
  };

  const handleAddComment = () => {
    if (!comment.trim()) return;
    toast({ title: 'Comment added' });
    setComment('');
  };

  const getDataSourceBadge = (source: DataSource) => {
    const config = {
      ocr: { label: 'OCR', icon: Zap, className: 'bg-ai/10 text-ai' },
      manual: { label: 'Manual', icon: User, className: 'bg-secondary text-secondary-foreground' },
      edited: { label: 'Edited', icon: Edit, className: 'bg-warning/10 text-warning' },
    };
    const { label, icon: Icon, className } = config[source];
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

        {/* Actions */}
        {canApprove && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="gap-2 text-warning"
              onClick={() => handleAction('return')}
            >
              <RotateCcw className="h-4 w-4" />
              Return
            </Button>
            <Button
              variant="outline"
              className="gap-2 text-destructive"
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
                Documents ({claim.documents.length})
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
                    <Bot className="h-5 w-5 text-ai" />
                    AI Analysis
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">
                        Confidence Score
                      </p>
                      <AIConfidenceBadge score={claim.aiConfidenceScore || 0} />
                    </div>
                    {claim.policyViolations.length > 0 && (
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground mb-2">
                          Policy Violations
                        </p>
                        <div className="flex flex-wrap justify-end gap-2">
                          {claim.policyViolations.map((violation, idx) => (
                            <Badge
                              key={idx}
                              variant="destructive"
                              className="gap-1"
                            >
                              <AlertTriangle className="h-3 w-3" />
                              {violation}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Claim Information</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-muted-foreground flex items-center gap-2">
                        <CreditCard className="h-4 w-4" />
                        Amount
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-lg font-semibold">
                          ₹{claim.amount.toLocaleString()}
                        </p>
                        {claim.dataSource.amount && getDataSourceBadge(claim.dataSource.amount)}
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground flex items-center gap-2">
                        <Building className="h-4 w-4" />
                        Vendor
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="font-medium">{claim.vendor}</p>
                        {claim.dataSource.vendor && getDataSourceBadge(claim.dataSource.vendor)}
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        Expense Date
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="font-medium">
                          {format(claim.date, 'MMMM dd, yyyy')}
                        </p>
                        {claim.dataSource.date && getDataSourceBadge(claim.dataSource.date)}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Category</p>
                      <Badge variant="outline" className="mt-1">
                        {claim.category.name}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Project Code</p>
                      <p className="font-medium mt-1">{claim.projectCode || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Cost Center</p>
                      <p className="font-medium mt-1">{claim.costCenter || 'N/A'}</p>
                    </div>
                  </div>
                  {claim.description && (
                    <div className="sm:col-span-2">
                      <p className="text-sm text-muted-foreground">Description</p>
                      <p className="mt-1">{claim.description}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Documents Tab */}
            <TabsContent value="documents" className="mt-6">
              <Card>
                <CardContent className="pt-6">
                  {claim.documents.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                      <FileImage className="h-12 w-12 mb-4" />
                      <p>No documents attached</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {claim.documents.map((doc) => (
                        <div
                          key={doc.id}
                          className="flex items-center justify-between rounded-lg border border-border p-4"
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                              <FileText className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <p className="font-medium">{doc.name}</p>
                              <p className="text-sm text-muted-foreground">
                                {(doc.size / 1024).toFixed(1)} KB • OCR{' '}
                                {doc.ocrConfidence}% confidence
                              </p>
                            </div>
                          </div>
                          <Button variant="outline" size="sm" className="gap-2">
                            <Download className="h-4 w-4" />
                            Download
                          </Button>
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
                    {claim.approvalHistory.map((item, idx) => (
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
                              {format(item.timestamp, 'MMM dd, yyyy HH:mm')}
                            </p>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            by {item.actor.name} ({item.actor.role})
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
                  <AvatarImage src={claim.submittedBy.avatar} />
                  <AvatarFallback>
                    {claim.submittedBy.name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{claim.submittedBy.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {claim.submittedBy.department}
                  </p>
                </div>
              </div>
              <Separator className="my-4" />
              <p className="text-sm text-muted-foreground">
                Submitted on {format(claim.submittedAt, 'MMM dd, yyyy')}
              </p>
            </CardContent>
          </Card>

          {/* Comments */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Comments ({claim.comments.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {claim.comments.map((cmt) => (
                <div key={cmt.id} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={cmt.author.avatar} />
                      <AvatarFallback className="text-xs">
                        {cmt.author.name
                          .split(' ')
                          .map((n) => n[0])
                          .join('')}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium">{cmt.author.name}</span>
                    <Badge variant="outline" className="text-xs capitalize">
                      {cmt.role}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{cmt.content}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(cmt.createdAt, 'MMM dd, yyyy HH:mm')}
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
                  disabled={!comment.trim()}
                  size="sm"
                  className="w-full"
                >
                  Add Comment
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
