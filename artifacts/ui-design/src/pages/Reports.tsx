import { useState } from 'react';
import {
  BarChart3,
  TrendingUp,
  PieChart,
  Calendar,
  Download,
  Filter,
  Brain,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
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
} from 'recharts';

const monthlyData = [
  { month: 'Jan', claims: 45, amount: 12500, approved: 38 },
  { month: 'Feb', claims: 52, amount: 15200, approved: 45 },
  { month: 'Mar', claims: 48, amount: 13800, approved: 42 },
  { month: 'Apr', claims: 61, amount: 18500, approved: 55 },
  { month: 'May', claims: 55, amount: 16200, approved: 48 },
  { month: 'Jun', claims: 67, amount: 21000, approved: 60 },
];

const categoryData = [
  { name: 'Travel', value: 35, amount: 45000 },
  { name: 'Meals', value: 25, amount: 15000 },
  { name: 'Equipment', value: 20, amount: 32000 },
  { name: 'Supplies', value: 12, amount: 8000 },
  { name: 'Other', value: 8, amount: 5000 },
];

const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

const aiMetrics = {
  autoApprovalRate: 88,
  avgConfidence: 92,
  processingTime: '2.3 hours',
  accuracyRate: 96,
};

const departmentData = [
  { department: 'Engineering', claims: 120, amount: 45000 },
  { department: 'Marketing', claims: 85, amount: 32000 },
  { department: 'Sales', claims: 95, amount: 38000 },
  { department: 'HR', claims: 45, amount: 18000 },
  { department: 'Finance', claims: 35, amount: 12000 },
];

export default function Reports() {
  const [dateRange, setDateRange] = useState('6m');

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Reports & Analytics</h1>
          <p className="text-muted-foreground">
            Insights into expense processing and AI performance
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[150px]">
              <Calendar className="mr-2 h-4 w-4" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1m">Last Month</SelectItem>
              <SelectItem value="3m">Last 3 Months</SelectItem>
              <SelectItem value="6m">Last 6 Months</SelectItem>
              <SelectItem value="1y">Last Year</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm">
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
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <BarChart3 className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Claims</p>
                <p className="text-2xl font-bold">328</p>
                <p className="text-xs text-green-600">+12% from last period</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900">
                <TrendingUp className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Amount</p>
                <p className="text-2xl font-bold">$97,200</p>
                <p className="text-xs text-green-600">+8% from last period</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900">
                <Brain className="h-6 w-6 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">AI Auto-Approval</p>
                <p className="text-2xl font-bold">{aiMetrics.autoApprovalRate}%</p>
                <p className="text-xs text-muted-foreground">Target: 85%</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900">
                <PieChart className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg Processing</p>
                <p className="text-2xl font-bold">{aiMetrics.processingTime}</p>
                <p className="text-xs text-green-600">-30% from last period</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for different reports */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="ai-performance">AI Performance</TabsTrigger>
          <TabsTrigger value="department">By Department</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Claims Trend */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Claims Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="month" className="text-xs" />
                      <YAxis className="text-xs" />
                      <Tooltip />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="claims"
                        stroke="#2563eb"
                        strokeWidth={2}
                        name="Total Claims"
                      />
                      <Line
                        type="monotone"
                        dataKey="approved"
                        stroke="#10b981"
                        strokeWidth={2}
                        name="Approved"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Category Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Expense Categories</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPie>
                      <Pie
                        data={categoryData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={2}
                        dataKey="value"
                        label={({ name, value }) => `${name}: ${value}%`}
                      >
                        {categoryData.map((_, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={COLORS[index % COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip />
                    </RechartsPie>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Amount by Month */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Monthly Expense Amount</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="month" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip
                      formatter={(value: number) => `$${value.toLocaleString()}`}
                    />
                    <Bar dataKey="amount" fill="#2563eb" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ai-performance" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">AI Confidence Distribution</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>High Confidence (≥95%)</span>
                    <span className="font-medium">72%</span>
                  </div>
                  <Progress value={72} className="h-2" />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Medium Confidence (80-95%)</span>
                    <span className="font-medium">20%</span>
                  </div>
                  <Progress value={20} className="h-2 [&>div]:bg-amber-500" />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Low Confidence (&lt;80%)</span>
                    <span className="font-medium">8%</span>
                  </div>
                  <Progress value={8} className="h-2 [&>div]:bg-destructive" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Processing Metrics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Auto-Approval Rate</span>
                  <span className="text-2xl font-bold text-green-600">
                    {aiMetrics.autoApprovalRate}%
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Average Confidence</span>
                  <span className="text-2xl font-bold">{aiMetrics.avgConfidence}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Accuracy Rate</span>
                  <span className="text-2xl font-bold text-primary">
                    {aiMetrics.accuracyRate}%
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Avg Processing Time</span>
                  <span className="text-2xl font-bold">{aiMetrics.processingTime}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">AI Learning Insights</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="rounded-lg border p-4">
                  <div className="flex items-start gap-3">
                    <Brain className="h-5 w-5 text-primary mt-0.5" />
                    <div>
                      <p className="font-medium">Pattern Recognition Improvement</p>
                      <p className="text-sm text-muted-foreground">
                        Travel expense recognition accuracy improved by 5% after processing
                        1,200+ receipts from hotel chains.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="rounded-lg border p-4">
                  <div className="flex items-start gap-3">
                    <Brain className="h-5 w-5 text-green-600 mt-0.5" />
                    <div>
                      <p className="font-medium">Fraud Detection Enhancement</p>
                      <p className="text-sm text-muted-foreground">
                        System detected and flagged 12 potentially duplicate submissions
                        this month, saving an estimated $4,500.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="department" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Expenses by Department</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={departmentData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis type="number" className="text-xs" />
                    <YAxis dataKey="department" type="category" width={100} className="text-xs" />
                    <Tooltip
                      formatter={(value: number) => `$${value.toLocaleString()}`}
                    />
                    <Bar dataKey="amount" fill="#2563eb" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            {departmentData.map((dept) => (
              <Card key={dept.department}>
                <CardContent className="pt-6">
                  <p className="text-sm font-medium text-muted-foreground">
                    {dept.department}
                  </p>
                  <p className="text-2xl font-bold">${dept.amount.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">{dept.claims} claims</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
