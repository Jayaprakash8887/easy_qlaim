import { useState } from 'react';
import {
  TrendingUp,
  Calendar,
  Download,
  DollarSign,
  Clock,
  CheckCircle2,
  AlertCircle,
  Building2,
  Users,
  Wallet,
  CreditCard,
  FileText,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useFormatting } from '@/hooks/useFormatting';
import {
  useFinanceMetrics,
  useClaimsByProject,
  useSettlementAnalytics,
  usePendingSettlements,
  useClaimsTrend,
  useExpenseBreakdown,
  useTopClaimants,
  useClaimsByStatus,
} from '@/hooks/useDashboard';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart as RechartsPie,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
  AreaChart,
  Area,
} from 'recharts';

const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#ec4899'];

const PAYMENT_METHOD_COLORS: Record<string, string> = {
  'NEFT': '#2563eb',
  'RTGS': '#10b981',
  'UPI': '#f59e0b',
  'CHEQUE': '#ef4444',
  'CASH': '#8b5cf6',
  'Unknown': '#94a3b8',
};

export default function Reports() {
  const [dateRange, setDateRange] = useState('6m');
  const [period, setPeriod] = useState('month');
  const { formatCurrency } = useFormatting();

  // Fetch data from APIs
  const { data: financeMetrics, isLoading: loadingMetrics } = useFinanceMetrics(undefined, period);
  const { data: claimsByProject, isLoading: loadingProjects } = useClaimsByProject(undefined, period);
  const { data: settlementAnalytics, isLoading: loadingSettlements } = useSettlementAnalytics(undefined, dateRange);
  const { data: pendingSettlements, isLoading: loadingPending } = usePendingSettlements();
  const { data: claimsTrend, isLoading: loadingTrend } = useClaimsTrend(undefined, dateRange);
  const { data: expenseBreakdown, isLoading: loadingBreakdown } = useExpenseBreakdown(undefined, period);
  const { data: topClaimants, isLoading: loadingClaimants } = useTopClaimants(undefined, 10, period);
  const { data: claimsByStatus } = useClaimsByStatus();

  // Handle export
  const handleExport = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Finance Reports Export\n\n";
    
    if (financeMetrics) {
      csvContent += "Financial Summary\n";
      csvContent += "Pending Finance Approvals," + financeMetrics.pending_finance.count + "," + financeMetrics.pending_finance.amount + "\n";
      csvContent += "Ready for Settlement," + financeMetrics.ready_for_settlement.count + "," + financeMetrics.ready_for_settlement.amount + "\n";
      csvContent += "Settled This Period," + financeMetrics.settled_this_period.count + "," + financeMetrics.settled_this_period.amount + "\n";
      csvContent += "\n";
    }

    if (claimsByProject && claimsByProject.length > 0) {
      csvContent += "Claims by Project\n";
      csvContent += "Project Code,Project Name,Budget Total,Budget Used,Claims Count,Claims Amount\n";
      claimsByProject.forEach(p => {
        csvContent += p.project_code + "," + p.project_name + "," + p.budget_total + "," + p.budget_utilized + "," + p.claims_count + "," + p.claims_amount + "\n";
      });
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "finance_reports_" + new Date().toISOString().split('T')[0] + ".csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getPeriodLabel = (p: string) => {
    switch (p) {
      case 'month': return 'This Month';
      case 'quarter': return 'This Quarter';
      case 'year': return 'This Year';
      default: return 'This Month';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Finance Reports & Analytics</h1>
          <p className="text-muted-foreground">
            Comprehensive financial insights, settlement tracking, and expense analysis
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[150px]">
              <Calendar className="mr-2 h-4 w-4" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="quarter">This Quarter</SelectItem>
              <SelectItem value="year">This Year</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900">
                <Clock className="h-6 w-6 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pending Finance</p>
                <p className="text-2xl font-bold">
                  {loadingMetrics ? <Loader2 className="h-6 w-6 animate-spin" /> : financeMetrics?.pending_finance.count || 0}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatCurrency(financeMetrics?.pending_finance.amount || 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900">
                <Wallet className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Ready for Settlement</p>
                <p className="text-2xl font-bold">
                  {loadingMetrics ? <Loader2 className="h-6 w-6 animate-spin" /> : financeMetrics?.ready_for_settlement.count || 0}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatCurrency(financeMetrics?.ready_for_settlement.amount || 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900">
                <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Settled {getPeriodLabel(period)}</p>
                <p className="text-2xl font-bold">
                  {loadingMetrics ? <Loader2 className="h-6 w-6 animate-spin" /> : financeMetrics?.settled_this_period.count || 0}
                </p>
                <p className="text-xs text-green-600">
                  {formatCurrency(financeMetrics?.settled_this_period.amount || 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900">
                <TrendingUp className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total {getPeriodLabel(period)}</p>
                <p className="text-2xl font-bold">
                  {loadingMetrics ? <Loader2 className="h-6 w-6 animate-spin" /> : financeMetrics?.total_this_period.count || 0}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatCurrency(financeMetrics?.total_this_period.amount || 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for different reports */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="settlements">Settlements</TabsTrigger>
          <TabsTrigger value="budget">Budget Analysis</TabsTrigger>
          <TabsTrigger value="expenses">Expense Analysis</TabsTrigger>
          <TabsTrigger value="employees">By Employee</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Claims Trend */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Claims Trend</CardTitle>
                <CardDescription>Submitted vs Approved vs Settled</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  {loadingTrend ? (
                    <div className="flex h-full items-center justify-center">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={claimsTrend || []}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="month" className="text-xs" />
                        <YAxis className="text-xs" />
                        <Tooltip />
                        <Legend />
                        <Area
                          type="monotone"
                          dataKey="submitted"
                          stackId="1"
                          stroke="#2563eb"
                          fill="#2563eb"
                          fillOpacity={0.6}
                          name="Submitted"
                        />
                        <Area
                          type="monotone"
                          dataKey="approved"
                          stackId="2"
                          stroke="#10b981"
                          fill="#10b981"
                          fillOpacity={0.6}
                          name="Approved"
                        />
                        <Area
                          type="monotone"
                          dataKey="settled"
                          stackId="3"
                          stroke="#f59e0b"
                          fill="#f59e0b"
                          fillOpacity={0.6}
                          name="Settled"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Expense Categories */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Expense Categories</CardTitle>
                <CardDescription>Distribution by category</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  {loadingBreakdown ? (
                    <div className="flex h-full items-center justify-center">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPie>
                        <Pie
                          data={expenseBreakdown?.by_category || []}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={2}
                          dataKey="amount"
                          nameKey="category"
                          label={({ category, percentage }) => `${category}: ${percentage}%`}
                        >
                          {(expenseBreakdown?.by_category || []).map((_, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={COLORS[index % COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: number) => formatCurrency(value)} />
                      </RechartsPie>
                    </ResponsiveContainer>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Monthly Amount Trend */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Monthly Expense Amount</CardTitle>
              <CardDescription>Total claim amounts over time</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                {loadingTrend ? (
                  <div className="flex h-full items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={claimsTrend || []}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="month" className="text-xs" />
                      <YAxis className="text-xs" />
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                      <Bar dataKey="amount" fill="#2563eb" radius={[4, 4, 0, 0]} name="Amount" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Claims by Status Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Claims Status Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-4 lg:grid-cols-7">
                {(claimsByStatus || []).map((status) => (
                  <div key={status.status} className="text-center p-4 rounded-lg bg-muted/50">
                    <p className="text-2xl font-bold">{status.count}</p>
                    <p className="text-xs text-muted-foreground truncate">{status.status.replace(/_/g, ' ')}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settlements Tab */}
        <TabsContent value="settlements" className="space-y-4">
          {/* Settlement Summary Cards */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">0-7 Days</p>
                    <p className="text-xl font-bold">{pendingSettlements?.aging_summary['0-7_days'] || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900">
                    <Clock className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">8-14 Days</p>
                    <p className="text-xl font-bold">{pendingSettlements?.aging_summary['8-14_days'] || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900">
                    <AlertCircle className="h-5 w-5 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">15-30 Days</p>
                    <p className="text-xl font-bold">{pendingSettlements?.aging_summary['15-30_days'] || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-900">
                    <AlertCircle className="h-5 w-5 text-red-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Over 30 Days</p>
                    <p className="text-xl font-bold">{pendingSettlements?.aging_summary['over_30_days'] || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Settlement by Payment Method */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Settlements by Payment Method</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  {loadingSettlements ? (
                    <div className="flex h-full items-center justify-center">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPie>
                        <Pie
                          data={settlementAnalytics?.payment_methods || []}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={2}
                          dataKey="count"
                          nameKey="method"
                          label={({ method, count }) => `${method}: ${count}`}
                        >
                          {(settlementAnalytics?.payment_methods || []).map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={PAYMENT_METHOD_COLORS[entry.method] || COLORS[index % COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip />
                      </RechartsPie>
                    </ResponsiveContainer>
                  )}
                </div>
                <div className="mt-4 flex flex-wrap gap-2 justify-center">
                  {(settlementAnalytics?.payment_methods || []).map((pm) => (
                    <Badge key={pm.method} variant="outline" className="text-xs">
                      <CreditCard className="h-3 w-3 mr-1" />
                      {pm.method}: {formatCurrency(pm.amount)}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Settlement Trend */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Monthly Settlement Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  {loadingSettlements ? (
                    <div className="flex h-full items-center justify-center">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={settlementAnalytics?.monthly_trend || []}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="month" className="text-xs" />
                        <YAxis yAxisId="left" className="text-xs" />
                        <YAxis yAxisId="right" orientation="right" className="text-xs" />
                        <Tooltip formatter={(value: number, name: string) => 
                          name === 'amount' ? formatCurrency(value) : value
                        } />
                        <Legend />
                        <Line
                          yAxisId="left"
                          type="monotone"
                          dataKey="count"
                          stroke="#2563eb"
                          strokeWidth={2}
                          name="Count"
                        />
                        <Bar
                          yAxisId="right"
                          dataKey="amount"
                          fill="#10b981"
                          name="Amount"
                          opacity={0.5}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Pending Settlements Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center justify-between">
                <span>Pending Settlements</span>
                <Badge variant="secondary">
                  {pendingSettlements?.total_count || 0} claims | {formatCurrency(pendingSettlements?.total_amount || 0)}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingPending ? (
                <div className="flex h-32 items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (pendingSettlements?.claims?.length || 0) === 0 ? (
                <div className="flex h-32 items-center justify-center text-muted-foreground">
                  No pending settlements
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Claim #</TableHead>
                      <TableHead>Employee</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Approved Date</TableHead>
                      <TableHead>Days Pending</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(pendingSettlements?.claims || []).slice(0, 10).map((claim) => (
                      <TableRow key={claim.id}>
                        <TableCell className="font-medium">{claim.claim_number}</TableCell>
                        <TableCell>{claim.employee_name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{claim.category}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(claim.amount)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {claim.approved_date ? new Date(claim.approved_date).toLocaleDateString() : '-'}
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={claim.days_pending > 14 ? 'destructive' : claim.days_pending > 7 ? 'secondary' : 'outline'}
                          >
                            {claim.days_pending} days
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Budget Analysis Tab */}
        <TabsContent value="budget" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Budget vs Actual by Project</CardTitle>
              <CardDescription>Project-wise budget utilization and claims analysis</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingProjects ? (
                <div className="flex h-32 items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (claimsByProject?.length || 0) === 0 ? (
                <div className="flex h-32 items-center justify-center text-muted-foreground">
                  No project data available
                </div>
              ) : (
                <div className="space-y-6">
                  {(claimsByProject || []).slice(0, 10).map((project) => (
                    <div key={project.project_code} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{project.project_name}</span>
                          <Badge variant="outline" className="text-xs">{project.project_code}</Badge>
                        </div>
                        <div className="text-right">
                          <span className="font-medium">{formatCurrency(project.budget_utilized)}</span>
                          <span className="text-muted-foreground"> / {formatCurrency(project.budget_total)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Progress 
                          value={Math.min(project.budget_percentage, 100)} 
                          className={`h-2 flex-1 ${project.budget_percentage > 90 ? '[&>div]:bg-red-500' : project.budget_percentage > 75 ? '[&>div]:bg-amber-500' : ''}`}
                        />
                        <span className={`text-sm font-medium ${
                          project.budget_percentage > 90 ? 'text-red-600' : 
                          project.budget_percentage > 75 ? 'text-amber-600' : 'text-green-600'
                        }`}>
                          {project.budget_percentage}%
                        </span>
                      </div>
                      <div className="flex gap-4 text-xs text-muted-foreground">
                        <span>{project.claims_count} claims</span>
                        <span>•</span>
                        <span>Claims Total: {formatCurrency(project.claims_amount)}</span>
                        <span>•</span>
                        <span>Settled: {formatCurrency(project.settled_amount)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Budget Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Budget Utilization Chart</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[400px]">
                {loadingProjects ? (
                  <div className="flex h-full items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart 
                      data={(claimsByProject || []).slice(0, 10)} 
                      layout="vertical"
                      margin={{ left: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis type="number" className="text-xs" />
                      <YAxis 
                        dataKey="project_code" 
                        type="category" 
                        width={100} 
                        className="text-xs" 
                      />
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                      <Legend />
                      <Bar dataKey="budget_total" fill="#e2e8f0" name="Budget" radius={[0, 4, 4, 0]} />
                      <Bar dataKey="budget_utilized" fill="#2563eb" name="Utilized" radius={[0, 4, 4, 0]} />
                      <Bar dataKey="claims_amount" fill="#10b981" name="Claims" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Expense Analysis Tab */}
        <TabsContent value="expenses" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            {/* By Category */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">By Category</CardTitle>
              </CardHeader>
              <CardContent>
                {loadingBreakdown ? (
                  <div className="flex h-32 items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    {(expenseBreakdown?.by_category || []).map((cat, index) => (
                      <div key={cat.category} className="flex items-center gap-4">
                        <div 
                          className="h-3 w-3 rounded-full" 
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        <div className="flex-1">
                          <div className="flex justify-between">
                            <span className="font-medium">{cat.category}</span>
                            <span className="text-muted-foreground">{cat.percentage}%</span>
                          </div>
                          <Progress value={cat.percentage} className="h-1.5 mt-1" />
                        </div>
                        <div className="text-right min-w-[100px]">
                          <p className="font-medium">{formatCurrency(cat.amount)}</p>
                          <p className="text-xs text-muted-foreground">{cat.count} claims</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* By Department */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">By Department</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  {loadingBreakdown ? (
                    <div className="flex h-full items-center justify-center">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={(expenseBreakdown?.by_department || []).slice(0, 8)}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="department" className="text-xs" angle={-45} textAnchor="end" height={80} />
                        <YAxis className="text-xs" />
                        <Tooltip formatter={(value: number) => formatCurrency(value)} />
                        <Bar dataKey="amount" fill="#2563eb" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Claim Type Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Reimbursement vs Allowance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                {(expenseBreakdown?.by_claim_type || []).map((type) => (
                  <div 
                    key={type.type} 
                    className="flex items-center justify-between p-4 rounded-lg border"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`h-12 w-12 rounded-full flex items-center justify-center ${
                        type.type === 'REIMBURSEMENT' ? 'bg-blue-100' : 'bg-green-100'
                      }`}>
                        {type.type === 'REIMBURSEMENT' ? (
                          <FileText className="h-6 w-6 text-blue-600" />
                        ) : (
                          <DollarSign className="h-6 w-6 text-green-600" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium">{type.type}</p>
                        <p className="text-sm text-muted-foreground">{type.count} claims</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold">{formatCurrency(type.amount)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* By Employee Tab */}
        <TabsContent value="employees" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5" />
                Top Claimants
              </CardTitle>
              <CardDescription>Employees with highest claim amounts {getPeriodLabel(period)}</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingClaimants ? (
                <div className="flex h-32 items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (topClaimants?.length || 0) === 0 ? (
                <div className="flex h-32 items-center justify-center text-muted-foreground">
                  No claimants data available
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">Rank</TableHead>
                      <TableHead>Employee</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead className="text-center">Claims</TableHead>
                      <TableHead className="text-right">Total Amount</TableHead>
                      <TableHead className="text-right">Avg/Claim</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(topClaimants || []).map((claimant, index) => (
                      <TableRow key={claimant.employee_id}>
                        <TableCell>
                          <Badge 
                            variant={index < 3 ? 'default' : 'outline'}
                            className={index === 0 ? 'bg-amber-500' : index === 1 ? 'bg-gray-400' : index === 2 ? 'bg-amber-700' : ''}
                          >
                            #{index + 1}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">{claimant.employee_name}</TableCell>
                        <TableCell className="text-muted-foreground">{claimant.department}</TableCell>
                        <TableCell className="text-center">{claimant.claim_count}</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(claimant.total_amount)}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {formatCurrency(claimant.total_amount / claimant.claim_count)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Top Claimants Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Claims Distribution - Top 10</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[400px]">
                {loadingClaimants ? (
                  <div className="flex h-full items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topClaimants || []} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis type="number" className="text-xs" />
                      <YAxis 
                        dataKey="employee_name" 
                        type="category" 
                        width={120} 
                        className="text-xs"
                        tick={{ fontSize: 11 }}
                      />
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                      <Bar dataKey="total_amount" fill="#2563eb" radius={[0, 4, 4, 0]} name="Total Amount" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
