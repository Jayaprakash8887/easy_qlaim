import { Link } from 'react-router-dom';
import { Clock, CheckCircle, XCircle, Wallet } from 'lucide-react';
import { SummaryCard } from '@/components/dashboard/SummaryCard';
import { AISuggestionsCard } from '@/components/dashboard/AISuggestionsCard';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { RecentActivity } from '@/components/dashboard/RecentActivity';
import { AllowanceOverviewCards, AllowancePolicyAlerts } from '@/components/dashboard/AllowanceWidgets';
import { useAuth } from '@/contexts/AuthContext';

export default function Dashboard() {
  const { user } = useAuth();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Welcome back, {user?.name?.split(' ')[0]}! 👋
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
          {(user?.role === 'manager' || user?.role === 'hr' || user?.role === 'finance') && (
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
          )}
        </div>
      </div>
    </div>
  );
}
