import { Link } from 'react-router-dom';
import { Clock, CheckCircle, XCircle, Wallet, Users, TrendingUp, AlertCircle, DollarSign, FileText, Building2 } from 'lucide-react';
import { SummaryCard } from '@/components/dashboard/SummaryCard';
import { AISuggestionsCard } from '@/components/dashboard/AISuggestionsCard';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { RecentActivity } from '@/components/dashboard/RecentActivity';
import { AllowanceOverviewCards, AllowancePolicyAlerts } from '@/components/dashboard/AllowanceWidgets';
import { useAuth } from '@/contexts/AuthContext';

// Employee Dashboard - Personal claims and allowances
function EmployeeDashboard({ userName }: { userName: string }) {
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          title="Pending Claims"
          value="3"
          trend={{ value: 10, isPositive: true }}
          icon={Clock}
          variant="pending"
        />
        <SummaryCard
          title="Approved"
          value="12"
          trend={{ value: 25, isPositive: true }}
          icon={CheckCircle}
          variant="approved"
        />
        <SummaryCard
          title="Rejected"
          value="1"
          trend={{ value: 0, isPositive: true }}
          icon={XCircle}
          variant="rejected"
        />
        <SummaryCard
          title="Total Claimed"
          value="₹1,24,500"
          trend={{ value: 15, isPositive: true }}
          icon={Wallet}
          variant="total"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <AISuggestionsCard />
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
function ManagerDashboard({ userName }: { userName: string }) {
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
          value="5"
          trend={{ value: 2, isPositive: false }}
          icon={AlertCircle}
          variant="pending"
        />
        <SummaryCard
          title="Team Claims (Month)"
          value="28"
          trend={{ value: 15, isPositive: true }}
          icon={FileText}
          variant="default"
        />
        <SummaryCard
          title="Team Members"
          value="12"
          icon={Users}
          variant="default"
        />
        <SummaryCard
          title="Team Spending"
          value="₹3,45,600"
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
              <p className="text-3xl font-bold text-primary">5</p>
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
function HRDashboard({ userName }: { userName: string }) {
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
          value="8"
          trend={{ value: 3, isPositive: false }}
          icon={AlertCircle}
          variant="pending"
        />
        <SummaryCard
          title="Total Employees"
          value="145"
          trend={{ value: 5, isPositive: true }}
          icon={Users}
          variant="default"
        />
        <SummaryCard
          title="Active Claims"
          value="32"
          trend={{ value: 12, isPositive: true }}
          icon={FileText}
          variant="default"
        />
        <SummaryCard
          title="Monthly Claims Value"
          value="₹12,45,000"
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
              <p className="text-3xl font-bold text-primary">8</p>
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
function FinanceDashboard({ userName }: { userName: string }) {
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
          value="15"
          trend={{ value: 5, isPositive: false }}
          icon={AlertCircle}
          variant="pending"
        />
        <SummaryCard
          title="Approved (Unpaid)"
          value="₹8,45,000"
          icon={DollarSign}
          variant="default"
        />
        <SummaryCard
          title="Paid This Month"
          value="₹15,67,500"
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
              <p className="text-3xl font-bold text-primary">15</p>
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
function AdminDashboard({ userName }: { userName: string }) {
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
          title="Total Users"
          value="145"
          trend={{ value: 5, isPositive: true }}
          icon={Users}
          variant="default"
        />
        <SummaryCard
          title="Active Projects"
          value="8"
          trend={{ value: 2, isPositive: true }}
          icon={Building2}
          variant="default"
        />
        <SummaryCard
          title="Total Claims (Month)"
          value="87"
          trend={{ value: 15, isPositive: true }}
          icon={FileText}
          variant="default"
        />
        <SummaryCard
          title="System Processing"
          value="98%"
          trend={{ value: 3, isPositive: true }}
          icon={TrendingUp}
          variant="total"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <AISuggestionsCard />
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
                <span className="text-lg font-semibold text-warning">23</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Pending Payments</span>
                <span className="text-lg font-semibold text-primary">15</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Active Employees</span>
                <span className="text-lg font-semibold text-success">142</span>
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

export default function Dashboard() {
  const { user } = useAuth();
  const userName = user?.name?.split(' ')[0] || 'User';

  // Route to appropriate dashboard based on role
  switch (user?.role) {
    case 'manager':
      return <ManagerDashboard userName={userName} />;
    case 'hr':
      return <HRDashboard userName={userName} />;
    case 'finance':
      return <FinanceDashboard userName={userName} />;
    case 'admin':
      return <AdminDashboard userName={userName} />;
    case 'employee':
    default:
      return <EmployeeDashboard userName={userName} />;
  }
}
