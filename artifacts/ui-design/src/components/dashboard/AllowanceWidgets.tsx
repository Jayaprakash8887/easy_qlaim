import { Link } from 'react-router-dom';
import { Phone, Clock, TrendingUp, Utensils, AlertCircle, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { allowanceSummaries } from '@/data/mockAllowances';
import { AllowanceType } from '@/types/allowance';

const iconMap: Record<AllowanceType, React.ElementType> = {
  on_call: Phone,
  shift: Clock,
  work_incentive: TrendingUp,
  food: Utensils,
};

const colorMap: Record<AllowanceType, string> = {
  on_call: 'text-blue-600 bg-blue-100 dark:bg-blue-900 dark:text-blue-400',
  shift: 'text-purple-600 bg-purple-100 dark:bg-purple-900 dark:text-purple-400',
  work_incentive: 'text-green-600 bg-green-100 dark:bg-green-900 dark:text-green-400',
  food: 'text-amber-600 bg-amber-100 dark:bg-amber-900 dark:text-amber-400',
};

export function AllowanceOverviewCards() {
  const totalPending = allowanceSummaries.reduce((sum, a) => sum + a.pending, 0);
  const totalApproved = allowanceSummaries.reduce((sum, a) => sum + a.approved, 0);
  const totalValue = allowanceSummaries.reduce((sum, a) => sum + a.totalValue, 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Allowances Overview</CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/allowances" className="gap-1">
              View All <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 p-3">
            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{totalPending}</p>
            <p className="text-xs text-muted-foreground">Pending</p>
          </div>
          <div className="rounded-lg bg-green-50 dark:bg-green-900/20 p-3">
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">{totalApproved}</p>
            <p className="text-xs text-muted-foreground">Approved</p>
          </div>
          <div className="rounded-lg bg-primary/10 p-3">
            <p className="text-2xl font-bold text-primary">₹{(totalValue / 1000).toFixed(0)}K</p>
            <p className="text-xs text-muted-foreground">This Month</p>
          </div>
        </div>

        {/* Allowance Types */}
        <div className="space-y-3">
          {allowanceSummaries.map((allowance) => {
            const Icon = iconMap[allowance.type];
            const total = allowance.pending + allowance.approved;
            const approvedPercentage = total > 0 ? (allowance.approved / total) * 100 : 0;
            
            return (
              <div key={allowance.type} className="flex items-center gap-3">
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${colorMap[allowance.type]}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">{allowance.label}</span>
                    <span className="text-xs text-muted-foreground">
                      {allowance.pending > 0 && (
                        <Badge variant="outline" className="mr-2 text-amber-600 border-amber-300">
                          {allowance.pending} pending
                        </Badge>
                      )}
                      ₹{allowance.totalValue.toLocaleString()}
                    </span>
                  </div>
                  <Progress value={approvedPercentage} className="h-1.5" />
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export function AllowancePolicyAlerts() {
  const alerts = [
    {
      type: 'warning',
      message: 'On-Call allowance cut-off in 3 days (Jan 25)',
      icon: AlertCircle,
    },
    {
      type: 'info',
      message: '2 allowance claims pending your approval',
      icon: Clock,
    },
  ];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Policy Alerts</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {alerts.map((alert, index) => (
          <div
            key={index}
            className={`flex items-start gap-3 rounded-lg p-3 ${
              alert.type === 'warning'
                ? 'bg-amber-50 dark:bg-amber-900/20'
                : 'bg-blue-50 dark:bg-blue-900/20'
            }`}
          >
            <alert.icon
              className={`h-5 w-5 mt-0.5 ${
                alert.type === 'warning'
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-blue-600 dark:text-blue-400'
              }`}
            />
            <p className="text-sm">{alert.message}</p>
          </div>
        ))}
        <Button variant="outline" size="sm" className="w-full" asChild>
          <Link to="/allowances/new">Submit New Allowance</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
