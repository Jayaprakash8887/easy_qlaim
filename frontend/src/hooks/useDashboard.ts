import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

// Auth helper
function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('access_token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

interface DashboardSummary {
  total_claims: number;
  pending_claims: number;
  approved_this_month: number;
  total_amount_claimed: number;
  average_processing_time_days: number;
}

interface ClaimByStatus {
  status: string;
  count: number;
  amount: number;
}

interface ClaimByCategory {
  category: string;
  count: number;
  total_amount: number;
}

interface RecentActivity {
  id: string;
  claim_number: string;
  employee_name: string;
  category: string;
  amount: number;
  currency: string;
  status: string;
  updated_at: string;
}

interface AIMetrics {
  total_ai_processed: number;
  average_confidence_score: number;
  success_rate_percentage: number;
  total_time_saved_hours: number;
}

interface PendingApprovals {
  manager_pending: number;
  hr_pending: number;
  finance_pending: number;
  total_pending: number;
}

// Helper function to format currency
export function formatCurrency(amount: number, currency: string = 'INR'): string {
  if (currency === 'USD') {
    return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  // Default to INR
  return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

// Helper function to build URL with optional params
function buildUrl(base: string, params: Record<string, string | number | undefined>): string {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) {
      searchParams.append(key, String(value));
    }
  });
  const queryString = searchParams.toString();
  return queryString ? `${base}?${queryString}` : base;
}

// Fetch dashboard summary
async function fetchDashboardSummary(employeeId?: string, tenantId?: string): Promise<DashboardSummary> {
  const url = buildUrl(`${API_BASE_URL}/dashboard/summary`, { employee_id: employeeId, tenant_id: tenantId });
  const response = await fetch(url, { headers: getAuthHeaders() });
  if (!response.ok) {
    throw new Error('Failed to fetch dashboard summary');
  }
  return response.json();
}

// Fetch claims by status
async function fetchClaimsByStatus(employeeId?: string, tenantId?: string): Promise<ClaimByStatus[]> {
  const url = buildUrl(`${API_BASE_URL}/dashboard/claims-by-status`, { employee_id: employeeId, tenant_id: tenantId });
  const response = await fetch(url, { headers: getAuthHeaders() });
  if (!response.ok) {
    throw new Error('Failed to fetch claims by status');
  }
  return response.json();
}

// Fetch claims by category
async function fetchClaimsByCategory(employeeId?: string, tenantId?: string): Promise<ClaimByCategory[]> {
  const url = buildUrl(`${API_BASE_URL}/dashboard/claims-by-category`, { employee_id: employeeId, tenant_id: tenantId });
  const response = await fetch(url, { headers: getAuthHeaders() });
  if (!response.ok) {
    throw new Error('Failed to fetch claims by category');
  }
  return response.json();
}

// Fetch recent activity
async function fetchRecentActivity(limit: number = 10, employeeId?: string, tenantId?: string): Promise<RecentActivity[]> {
  const url = buildUrl(`${API_BASE_URL}/dashboard/recent-activity`, { limit, employee_id: employeeId, tenant_id: tenantId });
  const response = await fetch(url, { headers: getAuthHeaders() });
  if (!response.ok) {
    throw new Error('Failed to fetch recent activity');
  }
  return response.json();
}

// Fetch AI metrics
async function fetchAIMetrics(tenantId?: string): Promise<AIMetrics> {
  const url = buildUrl(`${API_BASE_URL}/dashboard/ai-metrics`, { tenant_id: tenantId });
  const response = await fetch(url, { headers: getAuthHeaders() });
  if (!response.ok) {
    throw new Error('Failed to fetch AI metrics');
  }
  return response.json();
}

// Fetch pending approvals
async function fetchPendingApprovals(tenantId?: string, userId?: string, role?: string): Promise<PendingApprovals> {
  const url = buildUrl(`${API_BASE_URL}/dashboard/pending-approvals`, { 
    tenant_id: tenantId,
    user_id: userId,
    role: role
  });
  const response = await fetch(url, { headers: getAuthHeaders() });
  if (!response.ok) {
    throw new Error('Failed to fetch pending approvals');
  }
  return response.json();
}

// Hooks
export function useDashboardSummary(employeeId?: string | null, tenantId?: string) {
  const { user } = useAuth();
  // Pass null to skip employee filtering, undefined will default to current user
  const effectiveEmployeeId = employeeId === null ? undefined : (employeeId || user?.id);
  const effectiveTenantId = tenantId || user?.tenantId;

  return useQuery({
    queryKey: ['dashboard-summary', effectiveEmployeeId, effectiveTenantId],
    queryFn: () => fetchDashboardSummary(effectiveEmployeeId, effectiveTenantId),
    enabled: !!effectiveTenantId,
    refetchInterval: 180000, // Refetch every 3 minutes
    staleTime: 120000, // Consider data stale after 2 minutes
  });
}

export function useClaimsByStatus(employeeId?: string | null, tenantId?: string) {
  const { user } = useAuth();
  // Pass null to skip employee filtering, undefined will default to current user
  const effectiveEmployeeId = employeeId === null ? undefined : (employeeId || user?.id);
  const effectiveTenantId = tenantId || user?.tenantId;

  return useQuery({
    queryKey: ['claims-by-status', effectiveEmployeeId, effectiveTenantId],
    queryFn: () => fetchClaimsByStatus(effectiveEmployeeId, effectiveTenantId),
    enabled: !!effectiveTenantId,
    refetchInterval: 180000, // Refetch every 3 minutes
    staleTime: 120000,
  });
}

export function useClaimsByCategory(employeeId?: string, tenantId?: string) {
  const { user } = useAuth();
  const effectiveEmployeeId = employeeId || user?.id;
  const effectiveTenantId = tenantId || user?.tenantId;

  return useQuery({
    queryKey: ['claims-by-category', effectiveEmployeeId, effectiveTenantId],
    queryFn: () => fetchClaimsByCategory(effectiveEmployeeId, effectiveTenantId),
    enabled: !!effectiveTenantId,
    refetchInterval: 180000, // Refetch every 3 minutes
    staleTime: 120000,
  });
}

export function useRecentActivity(limit: number = 10, employeeId?: string, tenantId?: string) {
  const { user } = useAuth();
  const effectiveEmployeeId = employeeId || user?.id;
  const effectiveTenantId = tenantId || user?.tenantId;

  return useQuery({
    queryKey: ['recent-activity', limit, effectiveEmployeeId, effectiveTenantId],
    queryFn: () => fetchRecentActivity(limit, effectiveEmployeeId, effectiveTenantId),
    enabled: !!effectiveTenantId,
    refetchInterval: 120000, // Refetch every 2 minutes
    staleTime: 60000,
  });
}

export function useAIMetrics(tenantId?: string) {
  const { user } = useAuth();
  const effectiveTenantId = tenantId || user?.tenantId;

  return useQuery({
    queryKey: ['ai-metrics', effectiveTenantId],
    queryFn: () => fetchAIMetrics(effectiveTenantId),
    enabled: !!effectiveTenantId,
    refetchInterval: 300000, // Refetch every 5 minutes
    staleTime: 180000,
  });
}

export function usePendingApprovals(tenantId?: string) {
  const { user } = useAuth();
  const effectiveTenantId = tenantId || user?.tenantId;
  const userId = user?.id;
  const role = user?.role;

  return useQuery({
    queryKey: ['pending-approvals', effectiveTenantId, userId, role],
    queryFn: () => fetchPendingApprovals(effectiveTenantId, userId, role),
    enabled: !!effectiveTenantId,
    refetchInterval: 60000, // Refetch every minute for more responsive updates
    staleTime: 30000, // Consider data stale after 30 seconds
  });
}

// HR Metrics interface and fetch function
interface HRMetrics {
  total_employees: number;
  hr_pending: number;
  hr_approved_this_month: number;
  monthly_claims_value: number;
  active_claims: number;
}

async function fetchHRMetrics(tenantId?: string): Promise<HRMetrics> {
  const url = buildUrl(`${API_BASE_URL}/dashboard/hr-metrics`, { tenant_id: tenantId });
  const response = await fetch(url, { headers: getAuthHeaders() });
  if (!response.ok) {
    throw new Error('Failed to fetch HR metrics');
  }
  return response.json();
}

export function useHRMetrics(tenantId?: string) {
  const { user } = useAuth();
  const effectiveTenantId = tenantId || user?.tenantId;

  return useQuery({
    queryKey: ['hr-metrics', effectiveTenantId],
    queryFn: () => fetchHRMetrics(effectiveTenantId),
    enabled: !!effectiveTenantId,
    refetchInterval: 180000, // Refetch every 3 minutes
    staleTime: 120000,
  });
}

// Fetch draft claims (AI suggestions)
async function fetchDraftClaims(employeeId?: string, limit: number = 5, tenantId?: string): Promise<RecentActivity[]> {
  const url = buildUrl(`${API_BASE_URL}/dashboard/recent-activity`, { limit, employee_id: employeeId, tenant_id: tenantId, status: 'DRAFT' });
  const response = await fetch(url, { headers: getAuthHeaders() });
  if (!response.ok) {
    throw new Error('Failed to fetch draft claims');
  }
  return response.json();
}

export function useDraftClaims(employeeId?: string, limit: number = 5, tenantId?: string) {
  const { user } = useAuth();
  const effectiveEmployeeId = employeeId || user?.id;
  const effectiveTenantId = tenantId || user?.tenantId;

  return useQuery({
    queryKey: ['draft-claims', effectiveEmployeeId, limit, effectiveTenantId],
    queryFn: () => fetchDraftClaims(effectiveEmployeeId, limit, effectiveTenantId),
    enabled: !!effectiveTenantId,
    refetchInterval: 120000, // Refetch every 2 minutes
    staleTime: 60000,
  });
}

// Fetch allowance summary
interface AllowanceSummary {
  category: string;
  total: number;
  pending: number;
  approved: number;
  total_value: number;
}

async function fetchAllowanceSummary(employeeId?: string, tenantId?: string): Promise<AllowanceSummary[]> {
  const url = buildUrl(`${API_BASE_URL}/dashboard/allowance-summary`, { employee_id: employeeId, tenant_id: tenantId });
  const response = await fetch(url, { headers: getAuthHeaders() });
  if (!response.ok) {
    throw new Error('Failed to fetch allowance summary');
  }
  return response.json();
}

export function useAllowanceSummary(employeeId?: string, tenantId?: string) {
  const { user } = useAuth();
  const effectiveEmployeeId = employeeId || user?.id;
  const effectiveTenantId = tenantId || user?.tenantId;

  return useQuery({
    queryKey: ['allowance-summary', effectiveEmployeeId, effectiveTenantId],
    queryFn: () => fetchAllowanceSummary(effectiveEmployeeId, effectiveTenantId),
    enabled: !!effectiveTenantId,
    refetchInterval: 180000, // Refetch every 3 minutes
    staleTime: 120000,
  });
}

// Admin Stats interface and hooks
interface AdminStats {
  unique_claimants: number;
  active_projects: number;
  active_employees: number;
  ai_success_rate: number;
}

async function fetchAdminStats(tenantId?: string): Promise<AdminStats> {
  const url = buildUrl(`${API_BASE_URL}/dashboard/admin-stats`, { tenant_id: tenantId });
  const response = await fetch(url, { headers: getAuthHeaders() });
  if (!response.ok) {
    throw new Error('Failed to fetch admin stats');
  }
  return response.json();
}

export function useAdminStats(tenantId?: string) {
  const { user } = useAuth();
  const effectiveTenantId = tenantId || user?.tenantId;

  return useQuery({
    queryKey: ['admin-stats', effectiveTenantId],
    queryFn: () => fetchAdminStats(effectiveTenantId),
    enabled: !!effectiveTenantId,
    refetchInterval: 180000, // Refetch every 3 minutes
    staleTime: 120000,
  });
}

// ==================== FINANCE REPORTS ====================

// Finance Metrics interface
interface FinanceMetrics {
  pending_finance: { count: number; amount: number };
  ready_for_settlement: { count: number; amount: number };
  settled_this_period: { count: number; amount: number };
  total_this_period: { count: number; amount: number };
  avg_settlement_time_days: number;
  rejection_rate_percentage: number;
  period: string;
}

async function fetchFinanceMetrics(tenantId?: string, period: string = 'month'): Promise<FinanceMetrics> {
  const url = buildUrl(`${API_BASE_URL}/dashboard/finance-metrics`, { tenant_id: tenantId, period });
  const response = await fetch(url, { headers: getAuthHeaders() });
  if (!response.ok) {
    throw new Error('Failed to fetch finance metrics');
  }
  return response.json();
}

export function useFinanceMetrics(tenantId?: string, period: string = 'month') {
  const { user } = useAuth();
  const effectiveTenantId = tenantId || user?.tenantId;

  return useQuery({
    queryKey: ['finance-metrics', effectiveTenantId, period],
    queryFn: () => fetchFinanceMetrics(effectiveTenantId, period),
    enabled: !!effectiveTenantId,
    refetchInterval: 120000,
    staleTime: 60000,
  });
}

// Claims by Project interface
interface ClaimsByProject {
  project_code: string;
  project_name: string;
  budget_total: number;
  budget_utilized: number;
  budget_percentage: number;
  claims_count: number;
  claims_amount: number;
  settled_amount: number;
}

async function fetchClaimsByProject(tenantId?: string, period: string = 'month'): Promise<ClaimsByProject[]> {
  const url = buildUrl(`${API_BASE_URL}/dashboard/claims-by-project`, { tenant_id: tenantId, period });
  const response = await fetch(url, { headers: getAuthHeaders() });
  if (!response.ok) {
    throw new Error('Failed to fetch claims by project');
  }
  return response.json();
}

export function useClaimsByProject(tenantId?: string, period: string = 'month') {
  const { user } = useAuth();
  const effectiveTenantId = tenantId || user?.tenantId;

  return useQuery({
    queryKey: ['claims-by-project', effectiveTenantId, period],
    queryFn: () => fetchClaimsByProject(effectiveTenantId, period),
    enabled: !!effectiveTenantId,
    refetchInterval: 180000,
    staleTime: 120000,
  });
}

// Settlement Analytics interface
interface SettlementAnalytics {
  payment_methods: { method: string; count: number; amount: number }[];
  monthly_trend: { month: string; count: number; amount: number }[];
  by_category: { category: string; count: number; amount: number }[];
  period: string;
}

async function fetchSettlementAnalytics(tenantId?: string, period: string = '6m'): Promise<SettlementAnalytics> {
  const url = buildUrl(`${API_BASE_URL}/dashboard/settlement-analytics`, { tenant_id: tenantId, period });
  const response = await fetch(url, { headers: getAuthHeaders() });
  if (!response.ok) {
    throw new Error('Failed to fetch settlement analytics');
  }
  return response.json();
}

export function useSettlementAnalytics(tenantId?: string, period: string = '6m') {
  const { user } = useAuth();
  const effectiveTenantId = tenantId || user?.tenantId;

  return useQuery({
    queryKey: ['settlement-analytics', effectiveTenantId, period],
    queryFn: () => fetchSettlementAnalytics(effectiveTenantId, period),
    enabled: !!effectiveTenantId,
    refetchInterval: 180000,
    staleTime: 120000,
  });
}

// Pending Settlements interface
interface PendingSettlement {
  id: string;
  claim_number: string;
  employee_name: string;
  employee_id: string;
  category: string;
  amount: number;
  currency: string;
  approved_date: string | null;
  days_pending: number;
  description: string;
}

interface PendingSettlementsResponse {
  claims: PendingSettlement[];
  total_count: number;
  total_amount: number;
  aging_summary: {
    '0-7_days': number;
    '8-14_days': number;
    '15-30_days': number;
    'over_30_days': number;
  };
}

async function fetchPendingSettlements(tenantId?: string): Promise<PendingSettlementsResponse> {
  const url = buildUrl(`${API_BASE_URL}/dashboard/pending-settlements`, { tenant_id: tenantId });
  const response = await fetch(url, { headers: getAuthHeaders() });
  if (!response.ok) {
    throw new Error('Failed to fetch pending settlements');
  }
  return response.json();
}

export function usePendingSettlements(tenantId?: string) {
  const { user } = useAuth();
  const effectiveTenantId = tenantId || user?.tenantId;

  return useQuery({
    queryKey: ['pending-settlements', effectiveTenantId],
    queryFn: () => fetchPendingSettlements(effectiveTenantId),
    enabled: !!effectiveTenantId,
    refetchInterval: 60000,
    staleTime: 30000,
  });
}

// Claims Trend interface
interface ClaimsTrendData {
  month: string;
  month_year: string;
  submitted: number;
  approved: number;
  settled: number;
  amount: number;
}

async function fetchClaimsTrend(tenantId?: string, period: string = '6m'): Promise<ClaimsTrendData[]> {
  const url = buildUrl(`${API_BASE_URL}/dashboard/claims-trend`, { tenant_id: tenantId, period });
  const response = await fetch(url, { headers: getAuthHeaders() });
  if (!response.ok) {
    throw new Error('Failed to fetch claims trend');
  }
  return response.json();
}

export function useClaimsTrend(tenantId?: string, period: string = '6m') {
  const { user } = useAuth();
  const effectiveTenantId = tenantId || user?.tenantId;

  return useQuery({
    queryKey: ['claims-trend', effectiveTenantId, period],
    queryFn: () => fetchClaimsTrend(effectiveTenantId, period),
    enabled: !!effectiveTenantId,
    refetchInterval: 180000,
    staleTime: 120000,
  });
}

// Expense Breakdown interface
interface ExpenseBreakdown {
  by_category: { category: string; count: number; amount: number; percentage: number }[];
  by_claim_type: { type: string; count: number; amount: number }[];
  by_department: { department: string; count: number; amount: number }[];
  total_amount: number;
  period: string;
}

async function fetchExpenseBreakdown(tenantId?: string, period: string = 'month'): Promise<ExpenseBreakdown> {
  const url = buildUrl(`${API_BASE_URL}/dashboard/expense-breakdown`, { tenant_id: tenantId, period });
  const response = await fetch(url, { headers: getAuthHeaders() });
  if (!response.ok) {
    throw new Error('Failed to fetch expense breakdown');
  }
  return response.json();
}

export function useExpenseBreakdown(tenantId?: string, period: string = 'month') {
  const { user } = useAuth();
  const effectiveTenantId = tenantId || user?.tenantId;

  return useQuery({
    queryKey: ['expense-breakdown', effectiveTenantId, period],
    queryFn: () => fetchExpenseBreakdown(effectiveTenantId, period),
    enabled: !!effectiveTenantId,
    refetchInterval: 180000,
    staleTime: 120000,
  });
}

// Top Claimants interface
interface TopClaimant {
  employee_id: string;
  employee_name: string;
  department: string;
  claim_count: number;
  total_amount: number;
}

async function fetchTopClaimants(tenantId?: string, limit: number = 10, period: string = 'month'): Promise<TopClaimant[]> {
  const url = buildUrl(`${API_BASE_URL}/dashboard/top-claimants`, { tenant_id: tenantId, limit, period });
  const response = await fetch(url, { headers: getAuthHeaders() });
  if (!response.ok) {
    throw new Error('Failed to fetch top claimants');
  }
  return response.json();
}

export function useTopClaimants(tenantId?: string, limit: number = 10, period: string = 'month') {
  const { user } = useAuth();
  const effectiveTenantId = tenantId || user?.tenantId;

  return useQuery({
    queryKey: ['top-claimants', effectiveTenantId, limit, period],
    queryFn: () => fetchTopClaimants(effectiveTenantId, limit, period),
    enabled: !!effectiveTenantId,
    refetchInterval: 180000,
    staleTime: 120000,
  });
}
