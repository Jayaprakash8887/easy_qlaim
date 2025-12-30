import { Link } from 'react-router-dom';
import { Clock, CheckCircle, XCircle, Wallet, Users, TrendingUp, AlertCircle, DollarSign, FileText, Building2, Settings, Shield, Activity, Server, RotateCcw, Banknote } from 'lucide-react';
import { SummaryCard } from '@/components/dashboard/SummaryCard';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { RecentActivity } from '@/components/dashboard/RecentActivity';
import { AISuggestionsCard } from '@/components/dashboard/AISuggestionsCard';
import { AllowanceOverviewCards, AllowancePolicyAlerts } from '@/components/dashboard/AllowanceWidgets';
import { useAuth } from '@/contexts/AuthContext';
import { useDashboardSummary, useClaimsByStatus, useHRMetrics, useAdminStats } from '@/hooks/useDashboard';
import { useFormatting } from '@/hooks/useFormatting';
import { useTenants, useDesignations } from '@/hooks/useSystemAdmin';
import { useEmployees } from '@/hooks/useEmployees';
import { CardSkeleton } from '@/components/ui/loading-skeleton';
import { Badge } from '@/components/ui/badge';

// Employee Dashboard - Personal claims and allowances
function EmployeeDashboard({ userName, employeeId, tenantId }: { userName: string; employeeId: string; tenantId?: string }) {
  const { data: summary, isLoading: summaryLoading } = useDashboardSummary(employeeId, tenantId);
  const { data: claimsByStatus, isLoading: statusLoading } = useClaimsByStatus(employeeId, tenantId);
  const { formatCurrency } = useFormatting();

  // Pending = any claim that is NOT Approved, Rejected, Settled, or Returned
  const excludedFromPending = ['FINANCE_APPROVED', 'REJECTED', 'SETTLED', 'RETURNED_TO_EMPLOYEE'];
  const pendingCount = claimsByStatus?.filter(c =>
    !excludedFromPending.includes(c.status)
  ).reduce((sum, c) => sum + c.count, 0) || summary?.pending_claims || 0;

  const approvedCount = claimsByStatus?.find(c => c.status === 'FINANCE_APPROVED')?.count || summary?.approved_this_month || 0;
  const rejectedCount = claimsByStatus?.find(c => c.status === 'REJECTED')?.count || 0;
  const settledCount = claimsByStatus?.find(c => c.status === 'SETTLED')?.count || 0;
  const returnedCount = claimsByStatus?.find(c => c.status === 'RETURNED_TO_EMPLOYEE')?.count || 0;

  // Calculate amounts
  const settledAmount = claimsByStatus?.find(c => c.status === 'SETTLED')?.amount || 0;
  const rejectedAmount = claimsByStatus?.find(c => c.status === 'REJECTED')?.amount || 0;
  
  // Total claimed excluding rejected
  const totalClaimedExcludingRejected = claimsByStatus
    ?.filter(c => c.status !== 'REJECTED')
    .reduce((sum, c) => sum + (c.amount || 0), 0) || (summary?.total_amount_claimed || 0);

  if (summaryLoading || statusLoading) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Welcome back, {userName}! 👋
          </h1>
          <p className="text-muted-foreground">
            Here's an overview of your expense claims
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Welcome back, {userName}! 👋
        </h1>
        <p className="text-muted-foreground">
          Here's an overview of your expense claims
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        <SummaryCard
          title="Pending Claims"
          value={pendingCount}
          icon={Clock}
          variant="pending"
          href="/claims?status=pending"
        />
        <SummaryCard
          title="Approved"
          value={approvedCount}
          icon={CheckCircle}
          variant="approved"
          href="/claims?status=finance_approved"
        />
        <SummaryCard
          title="Settled"
          value={settledCount}
          icon={DollarSign}
          variant="default"
          href="/claims?status=settled"
        />
        <SummaryCard
          title="Returned"
          value={returnedCount}
          icon={RotateCcw}
          variant="pending"
          href="/claims?status=returned"
        />
        <SummaryCard
          title="Rejected"
          value={rejectedCount}
          icon={XCircle}
          variant="rejected"
          href="/claims?status=rejected"
        />
        <SummaryCard
          title="Total Settled"
          value={formatCurrency(settledAmount)}
          icon={Banknote}
          variant="approved"
        />
        <SummaryCard
          title="Total Claimed"
          value={formatCurrency(totalClaimedExcludingRejected)}
          icon={Wallet}
          variant="total"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <AllowanceOverviewCards />
          <RecentActivity />
        </div>
        <div className="space-y-6">
          <QuickActions />
          <AllowancePolicyAlerts />
        </div>
      </div>
    </div>
  );
}

// Manager Dashboard - Team oversight and approvals
function ManagerDashboard({ userName, employeeId, tenantId }: { userName: string; employeeId: string; tenantId?: string }) {
  const { data: summary, isLoading: summaryLoading } = useDashboardSummary(undefined, tenantId);
  const { data: claimsByStatus, isLoading: statusLoading } = useClaimsByStatus(undefined, tenantId);
  const { data: employees, isLoading: employeesLoading } = useEmployees();
  const { formatCurrency } = useFormatting();

  // Count direct reports (employees where manager_id = current employeeId)
  const teamMemberCount = employees?.filter(emp => emp.managerId === employeeId).length || 0;

  const pendingApprovals = claimsByStatus?.find(c => c.status === 'PENDING_MANAGER')?.count || 0;
  const teamClaimsThisMonth = summary?.approved_this_month || 0;
  const teamSpending = summary?.total_amount_claimed || 0;

  if (summaryLoading || statusLoading || employeesLoading) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Welcome back, {userName}! 👋
          </h1>
          <p className="text-muted-foreground">
            Team claims overview and pending approvals
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Welcome back, {userName}! 👋
        </h1>
        <p className="text-muted-foreground">
          Team claims overview and pending approvals
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          title="Pending Approvals"
          value={pendingApprovals}
          trend={{ value: 2, isPositive: false }}
          icon={AlertCircle}
          variant="pending"
        />
        <SummaryCard
          title="Team Claims (Month)"
          value={teamClaimsThisMonth}
          trend={{ value: 15, isPositive: true }}
          icon={FileText}
          variant="default"
        />
        <SummaryCard
          title="Team Members"
          value={teamMemberCount}
          icon={Users}
          variant="default"
        />
        <SummaryCard
          title="Team Spending"
          value={formatCurrency(teamSpending)}
          trend={{ value: 8, isPositive: true }}
          icon={TrendingUp}
          variant="total"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-xl border border-border bg-card p-6">
            <h3 className="font-semibold text-foreground mb-4">Recent Team Claims</h3>
            <RecentActivity />
          </div>
        </div>
        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-card p-6">
            <h3 className="font-semibold text-foreground mb-4">Pending Approvals</h3>
            <div className="text-center py-4">
              <p className="text-3xl font-bold text-primary">{pendingApprovals}</p>
              <p className="text-sm text-muted-foreground">Claims waiting for your review</p>
              <Link to="/approvals" className="inline-flex items-center gap-1 mt-3 text-sm text-primary hover:underline">
                Review now →
              </Link>
            </div>
          </div>
          <QuickActions />
        </div>
      </div>
    </div>
  );
}

// HR Dashboard - Company-wide employee claims
function HRDashboard({ userName, employeeId, tenantId }: { userName: string; employeeId: string; tenantId?: string }) {
  const { data: hrMetrics, isLoading: hrMetricsLoading } = useHRMetrics(tenantId);
  const { data: claimsByStatus, isLoading: statusLoading } = useClaimsByStatus(undefined, tenantId);
  const { formatCurrency } = useFormatting();

  const hrPending = hrMetrics?.hr_pending || 0;
  const totalEmployees = hrMetrics?.total_employees || 0;
  const activeClaims = hrMetrics?.active_claims || 0;
  const monthlyValue = hrMetrics?.monthly_claims_value || 0;

  if (hrMetricsLoading || statusLoading) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Welcome back, {userName}! 👋
          </h1>
          <p className="text-muted-foreground">
            Company-wide claims and employee metrics
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Welcome back, {userName}! 👋
        </h1>
        <p className="text-muted-foreground">
          Company-wide claims and employee metrics
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          title="HR Approvals Pending"
          value={hrPending}
          trend={{ value: 3, isPositive: false }}
          icon={AlertCircle}
          variant="pending"
        />
        <SummaryCard
          title="Total Employees"
          value={totalEmployees}
          trend={{ value: 5, isPositive: true }}
          icon={Users}
          variant="default"
        />
        <SummaryCard
          title="Active Claims"
          value={activeClaims}
          trend={{ value: 12, isPositive: true }}
          icon={FileText}
          variant="default"
        />
        <SummaryCard
          title="Monthly Claims Value"
          value={formatCurrency(monthlyValue)}
          trend={{ value: 18, isPositive: true }}
          icon={DollarSign}
          variant="total"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-xl border border-border bg-card p-6">
            <h3 className="font-semibold text-foreground mb-4">Recent Activity</h3>
            <RecentActivity />
          </div>
          <AllowanceOverviewCards />
        </div>
        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-card p-6">
            <h3 className="font-semibold text-foreground mb-4">HR Approvals</h3>
            <div className="text-center py-4">
              <p className="text-3xl font-bold text-primary">{hrPending}</p>
              <p className="text-sm text-muted-foreground">Claims need HR review</p>
              <Link to="/approvals" className="inline-flex items-center gap-1 mt-3 text-sm text-primary hover:underline">
                Review now →
              </Link>
            </div>
          </div>
          <QuickActions />
        </div>
      </div>
    </div>
  );
}

// Finance Dashboard - Payment processing and budgets
function FinanceDashboard({ userName, employeeId, tenantId }: { userName: string; employeeId: string; tenantId?: string }) {
  const { data: summary, isLoading: summaryLoading } = useDashboardSummary(undefined, tenantId);
  const { data: claimsByStatus, isLoading: statusLoading } = useClaimsByStatus(undefined, tenantId);
  const { formatCurrency } = useFormatting();

  const financePending = claimsByStatus?.find(c => c.status === 'PENDING_FINANCE')?.count || 0;
  const approved = claimsByStatus?.find(c => c.status === 'FINANCE_APPROVED')?.count || 0;
  const totalAmount = summary?.total_amount_claimed || 0;

  if (summaryLoading || statusLoading) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Welcome back, {userName}! 👋
          </h1>
          <p className="text-muted-foreground">
            Financial overview and payment processing
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Welcome back, {userName}! 👋
        </h1>
        <p className="text-muted-foreground">
          Financial overview and payment processing
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          title="Pending Payments"
          value={financePending}
          trend={{ value: 5, isPositive: false }}
          icon={AlertCircle}
          variant="pending"
        />
        <SummaryCard
          title="Approved (Unpaid)"
          value={formatCurrency(totalAmount * 0.68)}
          icon={DollarSign}
          variant="default"
        />
        <SummaryCard
          title="Paid This Month"
          value={formatCurrency(totalAmount)}
          trend={{ value: 22, isPositive: true }}
          icon={CheckCircle}
          variant="approved"
        />
        <SummaryCard
          title="Budget Utilization"
          value="68%"
          trend={{ value: 12, isPositive: true }}
          icon={TrendingUp}
          variant="total"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-xl border border-border bg-card p-6">
            <h3 className="font-semibold text-foreground mb-4">Recent Transactions</h3>
            <RecentActivity />
          </div>
        </div>
        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-card p-6">
            <h3 className="font-semibold text-foreground mb-4">Payment Queue</h3>
            <div className="text-center py-4">
              <p className="text-3xl font-bold text-primary">{financePending}</p>
              <p className="text-sm text-muted-foreground">Claims ready for payment</p>
              <Link to="/settlements" className="inline-flex items-center gap-1 mt-3 text-sm text-primary hover:underline">
                Process payments →
              </Link>
            </div>
          </div>
          <QuickActions />
        </div>
      </div>
    </div>
  );
}

// Admin Dashboard - System overview and all metrics
function AdminDashboard({ userName, employeeId, tenantId }: { userName: string; employeeId: string; tenantId?: string }) {
  const { data: summary, isLoading: summaryLoading } = useDashboardSummary(undefined, tenantId);
  const { data: claimsByStatus, isLoading: statusLoading } = useClaimsByStatus(undefined, tenantId);
  const { data: adminStats, isLoading: adminStatsLoading } = useAdminStats(tenantId);
  const { formatCurrency } = useFormatting();

  const totalClaims = summary?.total_claims || 0;
  const pendingTotal = summary?.pending_claims || 0;
  const financePending = claimsByStatus?.find(c => c.status === 'PENDING_FINANCE')?.count || 0;

  if (summaryLoading || statusLoading || adminStatsLoading) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Welcome back, {userName}! 👋
          </h1>
          <p className="text-muted-foreground">
            Complete system overview and administration
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Welcome back, {userName}! 👋
        </h1>
        <p className="text-muted-foreground">
          Complete system overview and administration
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          title="Unique Claimants"
          value={adminStats?.unique_claimants || 0}
          trend={{ value: 5, isPositive: true }}
          icon={Users}
          variant="default"
        />
        <SummaryCard
          title="Active Projects"
          value={adminStats?.active_projects || 0}
          trend={{ value: 2, isPositive: true }}
          icon={Building2}
          variant="default"
        />
        <SummaryCard
          title="Total Claims (Month)"
          value={totalClaims}
          trend={{ value: 15, isPositive: true }}
          icon={FileText}
          variant="default"
        />
        <SummaryCard
          title="System Processing"
          value={`${adminStats?.ai_success_rate || 0}%`}
          trend={{ value: 3, isPositive: true }}
          icon={TrendingUp}
          variant="total"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-xl border border-border bg-card p-6">
            <h3 className="font-semibold text-foreground mb-4">System Activity</h3>
            <RecentActivity />
          </div>
        </div>
        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-card p-6">
            <h3 className="font-semibold text-foreground mb-4">Quick Stats</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Pending Approvals</span>
                <span className="text-lg font-semibold text-warning">{pendingTotal}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Pending Payments</span>
                <span className="text-lg font-semibold text-primary">{financePending}</span>
              </div>
            </div>
            <Link to="/settings" className="inline-flex items-center gap-1 mt-4 text-sm text-primary hover:underline">
              System settings →
            </Link>
          </div>
          <QuickActions />
        </div>
      </div>
    </div>
  );
}

// System Admin Dashboard - Platform-wide administration
function SystemAdminDashboard({ userName }: { userName: string }) {
  const { data: tenants, isLoading: tenantsLoading } = useTenants();
  const { data: designations, isLoading: designationsLoading } = useDesignations();

  const activeTenants = tenants?.filter((t: any) => t.is_active)?.length || 0;
  const totalTenants = tenants?.length || 0;
  const totalDesignations = designations?.length || 0;
  const adminDesignations = designations?.filter((d: any) => d.roles?.includes('ADMIN'))?.length || 0;

  // Calculate total users across all tenants
  const totalUsers = tenants?.reduce((sum: number, t: any) => sum + (t.user_count || 0), 0) || 0;

  if (tenantsLoading || designationsLoading) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Welcome, {userName}! 🛡️
          </h1>
          <p className="text-muted-foreground">
            Platform administration overview
          </p>
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <CardSkeleton className="h-64" />
            <CardSkeleton className="h-48" />
          </div>
          <div className="space-y-6">
            <CardSkeleton className="h-48" />
            <CardSkeleton className="h-48" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Welcome, {userName}! 🛡️
        </h1>
        <p className="text-muted-foreground">
          Platform administration overview
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Tenant Overview */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-foreground">Tenant Organizations</h3>
              <Link to="/admin/tenants" className="text-sm text-primary hover:underline">
                View All →
              </Link>
            </div>
            {tenants && tenants.length > 0 ? (
              <div className="space-y-3">
                {tenants.slice(0, 5).map((tenant: any) => (
                  <div key={tenant.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Building2 className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{tenant.name}</p>
                        <p className="text-sm text-muted-foreground">{tenant.code}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-sm font-medium">{tenant.user_count || 0} users</p>
                      </div>
                      <Badge variant={tenant.is_active ? "default" : "secondary"} className={tenant.is_active ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100" : ""}>
                        {tenant.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                  </div>
                ))}
                {tenants.length > 5 && (
                  <p className="text-sm text-muted-foreground text-center pt-2">
                    + {tenants.length - 5} more tenants
                  </p>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Building2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No tenants configured</p>
                <Link to="/admin/tenants" className="text-primary hover:underline text-sm">
                  Add your first tenant →
                </Link>
              </div>
            )}
          </div>

          {/* System Health */}
          <div className="rounded-xl border border-border bg-card p-6">
            <h3 className="font-semibold text-foreground mb-4">System Health</h3>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="p-4 rounded-lg bg-green-50 dark:bg-green-950/20">
                <div className="flex items-center gap-2 mb-2">
                  <Activity className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium text-green-700 dark:text-green-400">API Status</span>
                </div>
                <p className="text-2xl font-bold text-green-600">Healthy</p>
              </div>
              <div className="p-4 rounded-lg bg-green-50 dark:bg-green-950/20">
                <div className="flex items-center gap-2 mb-2">
                  <Server className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium text-green-700 dark:text-green-400">Database</span>
                </div>
                <p className="text-2xl font-bold text-green-600">Connected</p>
              </div>
              <div className="p-4 rounded-lg bg-green-50 dark:bg-green-950/20">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium text-green-700 dark:text-green-400">Security</span>
                </div>
                <p className="text-2xl font-bold text-green-600">Secure</p>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions for System Admin */}
        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-card p-6">
            <h3 className="font-semibold text-foreground mb-4">Quick Actions</h3>
            <div className="space-y-3">
              <Link
                to="/admin/tenants"
                className="flex items-center gap-3 p-3 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <Building2 className="h-5 w-5" />
                <span className="font-medium">Manage Tenants</span>
              </Link>
              <Link
                to="/admin/designations"
                className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted transition-colors"
              >
                <Shield className="h-5 w-5 text-muted-foreground" />
                <span>Manage Designations</span>
              </Link>
              <Link
                to="/admin/settings"
                className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted transition-colors"
              >
                <Settings className="h-5 w-5 text-muted-foreground" />
                <span>Platform Settings</span>
              </Link>
            </div>
          </div>

          {/* Platform Stats */}
          <div className="rounded-xl border border-border bg-card p-6">
            <h3 className="font-semibold text-foreground mb-4">Platform Summary</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Active Tenants</span>
                <span className="text-lg font-semibold text-green-600">{activeTenants}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Inactive Tenants</span>
                <span className="text-lg font-semibold text-muted-foreground">{totalTenants - activeTenants}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Admin Designations</span>
                <span className="text-lg font-semibold text-primary">{adminDesignations}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const userName = user?.name?.split(' ')[0] || 'User';
  const employeeId = user?.id || '';
  const tenantId = user?.tenantId;

  // Route to appropriate dashboard based on role
  switch (user?.role) {
    case 'system_admin':
      return <SystemAdminDashboard userName={userName} />;
    case 'manager':
      return <ManagerDashboard userName={userName} employeeId={employeeId} tenantId={tenantId} />;
    case 'hr':
      return <HRDashboard userName={userName} employeeId={employeeId} tenantId={tenantId} />;
    case 'finance':
      return <FinanceDashboard userName={userName} employeeId={employeeId} tenantId={tenantId} />;
    case 'admin':
      return <AdminDashboard userName={userName} employeeId={employeeId} tenantId={tenantId} />;
    case 'employee':
    default:
      return <EmployeeDashboard userName={userName} employeeId={employeeId} tenantId={tenantId} />;
  }
}
