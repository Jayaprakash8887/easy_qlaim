import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { format } from 'date-fns';
import {
  ArrowLeft,
  Phone,
  Clock,
  TrendingUp,
  Utensils,
  CheckCircle,
  XCircle,
  AlertTriangle,
  MessageSquare,
  Brain,
  Calendar,
  Building,
  User,
  FileText,
  Send,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { mockAllowances, allowancePolicies } from '@/data/mockAllowances';
import { AllowanceStatus, AllowanceType } from '@/types/allowance';
import { useAuth } from '@/contexts/AuthContext';

const typeIcons: Record<AllowanceType, React.ElementType> = {
  on_call: Phone,
  shift: Clock,
  work_incentive: TrendingUp,
  food: Utensils,
};

const statusColors: Record<AllowanceStatus, string> = {
  draft: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
  submitted: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  pending_manager: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300',
  approved: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
  payroll_ready: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
};

const statusLabels: Record<AllowanceStatus, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  pending_manager: 'Pending Manager',
  approved: 'Approved',
  rejected: 'Rejected',
  payroll_ready: 'Payroll Ready',
};

const typeLabels: Record<AllowanceType, string> = {
  on_call: 'On-Call Allowance',
  shift: 'Shift Allowance',
  work_incentive: 'Work Incentive',
  food: 'Food Allowance',
};

export default function AllowanceDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [comment, setComment] = useState('');

  const allowance = mockAllowances.find((a) => a.id === id);
  const policy = allowance
    ? allowancePolicies.find((p) => p.type === allowance.type)
    : null;

  if (!allowance || !policy) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <FileText className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Allowance Not Found</h2>
        <p className="text-muted-foreground mb-4">
          The allowance you're looking for doesn't exist.
        </p>
        <Button asChild>
          <Link to="/allowances">Back to Allowances</Link>
        </Button>
      </div>
    );
  }

  const TypeIcon = typeIcons[allowance.type];
  const canApprove =
    (user?.role === 'manager' || user?.role === 'hr' || user?.role === 'finance') &&
    allowance.status === 'pending_manager';

  const handleApprove = () => {
    toast.success('Allowance approved successfully!');
  };

  const handleReject = () => {
    toast.error('Allowance rejected');
  };

  const handleAddComment = () => {
    if (!comment.trim()) return;
    toast.success('Comment added');
    setComment('');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/allowances')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-foreground">
                {allowance.allowanceNumber}
              </h1>
              <Badge className={statusColors[allowance.status]}>
                {statusLabels[allowance.status]}
              </Badge>
            </div>
            <p className="text-muted-foreground">{typeLabels[allowance.type]}</p>
          </div>
        </div>
        {canApprove && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleReject}>
              <XCircle className="mr-2 h-4 w-4" />
              Reject
            </Button>
            <Button onClick={handleApprove}>
              <CheckCircle className="mr-2 h-4 w-4" />
              Approve
            </Button>
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Allowance Details */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <TypeIcon className="h-5 w-5 text-primary" />
                </div>
                <CardTitle>{typeLabels[allowance.type]}</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Period</p>
                    <p className="font-medium">
                      {format(allowance.period.startDate, 'MMM dd')} -{' '}
                      {format(allowance.period.endDate, 'MMM dd, yyyy')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Building className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Payroll Month</p>
                    <p className="font-medium">{allowance.payrollMonth}</p>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-lg border p-4 text-center">
                  <p className="text-2xl font-bold text-primary">
                    ₹{allowance.amount.toLocaleString()}
                  </p>
                  <p className="text-sm text-muted-foreground">Amount</p>
                </div>
                <div className="rounded-lg border p-4 text-center">
                  <p className="text-2xl font-bold">
                    {allowance.taxable ? 'Yes' : 'No'}
                  </p>
                  <p className="text-sm text-muted-foreground">Taxable</p>
                </div>
                <div className="rounded-lg border p-4 text-center">
                  <p className="text-2xl font-bold">{allowance.payrollCycle}</p>
                  <p className="text-sm text-muted-foreground">Pay Cycle</p>
                </div>
              </div>

              {/* Source Data */}
              {allowance.sourceData && (
                <>
                  <Separator />
                  <div>
                    <h4 className="font-medium mb-3">Source Data</h4>
                    <div className="grid gap-2 text-sm">
                      {allowance.sourceData.timesheetHours && (
                        <div className="flex justify-between rounded-lg bg-muted/30 p-3">
                          <span className="text-muted-foreground">Timesheet Hours</span>
                          <span className="font-medium">
                            {allowance.sourceData.timesheetHours} hours
                          </span>
                        </div>
                      )}
                      {allowance.sourceData.shiftCount && (
                        <div className="flex justify-between rounded-lg bg-muted/30 p-3">
                          <span className="text-muted-foreground">Shift Count</span>
                          <span className="font-medium">
                            {allowance.sourceData.shiftCount} shifts
                          </span>
                        </div>
                      )}
                      {allowance.sourceData.attendancePercentage && (
                        <div className="flex justify-between rounded-lg bg-muted/30 p-3">
                          <span className="text-muted-foreground">Attendance</span>
                          <span className="font-medium">
                            {allowance.sourceData.attendancePercentage}%
                          </span>
                        </div>
                      )}
                      {allowance.sourceData.location && (
                        <div className="flex justify-between rounded-lg bg-muted/30 p-3">
                          <span className="text-muted-foreground">Location</span>
                          <span className="font-medium">{allowance.sourceData.location}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Approval History */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Approval History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {allowance.approvalHistory.map((item, index) => (
                  <div key={item.id} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div
                        className={cn(
                          'flex h-8 w-8 items-center justify-center rounded-full',
                          item.action === 'approved'
                            ? 'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-400'
                            : item.action === 'rejected'
                            ? 'bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-400'
                            : 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-400'
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
                      {index < allowance.approvalHistory.length - 1 && (
                        <div className="h-full w-px bg-border mt-2" />
                      )}
                    </div>
                    <div className="flex-1 pb-4">
                      <div className="flex items-center justify-between">
                        <p className="font-medium capitalize">{item.action}</p>
                        <span className="text-sm text-muted-foreground">
                          {format(item.timestamp, 'MMM dd, yyyy HH:mm')}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        by {item.actor.name} ({item.actor.role})
                      </p>
                      {item.comment && (
                        <p className="text-sm mt-1 bg-muted/30 rounded-lg p-2">
                          {item.comment}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Comments */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Comments
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {allowance.comments.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">
                  No comments yet
                </p>
              ) : (
                allowance.comments.map((c) => (
                  <div key={c.id} className="flex gap-3">
                    <Avatar>
                      <AvatarFallback>{c.author.name[0]}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{c.author.name}</span>
                        <Badge variant="outline" className="text-xs">
                          {c.author.role}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {format(c.createdAt, 'MMM dd, HH:mm')}
                        </span>
                      </div>
                      <p className="text-sm mt-1">{c.content}</p>
                    </div>
                  </div>
                ))
              )}
              <Separator />
              <div className="flex gap-3">
                <Textarea
                  placeholder="Add a comment..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  className="min-h-[80px]"
                />
              </div>
              <Button onClick={handleAddComment} className="w-full">
                Add Comment
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* AI Decision */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Brain className="h-5 w-5 text-primary" />
                AI Analysis
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-center">
                <div className="relative h-24 w-24">
                  <svg className="h-full w-full -rotate-90 transform">
                    <circle
                      className="text-muted"
                      strokeWidth="8"
                      stroke="currentColor"
                      fill="transparent"
                      r="42"
                      cx="48"
                      cy="48"
                    />
                    <circle
                      className={cn(
                        (allowance.aiEligibilityScore || 0) >= 80
                          ? 'text-green-500'
                          : (allowance.aiEligibilityScore || 0) >= 60
                          ? 'text-amber-500'
                          : 'text-red-500'
                      )}
                      strokeWidth="8"
                      strokeDasharray={`${(allowance.aiEligibilityScore || 0) * 2.64} 264`}
                      strokeLinecap="round"
                      stroke="currentColor"
                      fill="transparent"
                      r="42"
                      cx="48"
                      cy="48"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-2xl font-bold">
                      {allowance.aiEligibilityScore}%
                    </span>
                  </div>
                </div>
              </div>
              {allowance.aiDecisionReason && (
                <div className="rounded-lg bg-muted/30 p-3">
                  <p className="text-sm">{allowance.aiDecisionReason}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Submitter Info */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Submitted By</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarFallback>{allowance.submittedBy.name[0]}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{allowance.submittedBy.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {allowance.submittedBy.department}
                  </p>
                </div>
              </div>
              <Separator className="my-4" />
              <div className="text-sm space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Email</span>
                  <span>{allowance.submittedBy.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Submitted</span>
                  <span>{format(allowance.submittedAt, 'MMM dd, yyyy')}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Policy Info */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Policy Rules</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {policy.eligibilityRules.map((rule, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                    <span className="text-sm">{rule}</span>
                  </div>
                ))}
              </div>
              <Separator className="my-4" />
              <div className="text-sm space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Max Amount</span>
                  <span className="font-medium">₹{policy.maxAmount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cut-off Date</span>
                  <span className="font-medium">{policy.cutOffDate}th of month</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
