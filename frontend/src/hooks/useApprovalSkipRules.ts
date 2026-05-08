import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ApprovalSkipRule, ApprovalSkipResult } from '@/types';
import { extractErrorMessage } from '@/lib/utils';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

// Auth helpers
function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('access_token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

function getAuthHeadersWithJson(): HeadersInit {
  const token = localStorage.getItem('access_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  };
}

// API Functions
const fetchApprovalSkipRules = async (tenantId: string, includeInactive = false): Promise<ApprovalSkipRule[]> => {
  const params = new URLSearchParams({ tenant_id: tenantId });
  if (includeInactive) params.append('include_inactive', 'true');
  
  const response = await fetch(`${API_BASE_URL}/approval-skip-rules/?${params}`, {
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error('Failed to fetch approval skip rules');
  }
  return response.json();
};

const fetchApprovalSkipRule = async (ruleId: string, tenantId: string): Promise<ApprovalSkipRule> => {
  const params = new URLSearchParams({ tenant_id: tenantId });
  const response = await fetch(`${API_BASE_URL}/approval-skip-rules/${ruleId}?${params}`, {
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error('Failed to fetch approval skip rule');
  }
  return response.json();
};

const createApprovalSkipRule = async (tenantId: string, data: Partial<ApprovalSkipRule>): Promise<ApprovalSkipRule> => {
  const params = new URLSearchParams({ tenant_id: tenantId });
  const response = await fetch(`${API_BASE_URL}/approval-skip-rules/?${params}`, {
    method: 'POST',
    headers: getAuthHeadersWithJson(),
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(extractErrorMessage(error, 'Failed to create approval skip rule'));
  }
  return response.json();
};

const updateApprovalSkipRule = async (
  ruleId: string,
  tenantId: string,
  data: Partial<ApprovalSkipRule>
): Promise<ApprovalSkipRule> => {
  const params = new URLSearchParams({ tenant_id: tenantId });
  const response = await fetch(`${API_BASE_URL}/approval-skip-rules/${ruleId}?${params}`, {
    method: 'PUT',
    headers: getAuthHeadersWithJson(),
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(extractErrorMessage(error, 'Failed to update approval skip rule'));
  }
  return response.json();
};

const deleteApprovalSkipRule = async (ruleId: string, tenantId: string): Promise<void> => {
  const params = new URLSearchParams({ tenant_id: tenantId });
  const response = await fetch(`${API_BASE_URL}/approval-skip-rules/${ruleId}?${params}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(extractErrorMessage(error, 'Failed to delete approval skip rule'));
  }
};

const checkApprovalSkip = async (
  tenantId: string,
  employeeEmail: string,
  claimAmount: number,
  employeeDesignation?: string,
  categoryCode?: string
): Promise<ApprovalSkipResult> => {
  const params = new URLSearchParams({
    tenant_id: tenantId,
    employee_email: employeeEmail,
    claim_amount: claimAmount.toString(),
  });
  if (employeeDesignation) params.append('employee_designation', employeeDesignation);
  if (categoryCode) params.append('category_code', categoryCode);
  
  const response = await fetch(`${API_BASE_URL}/approval-skip-rules/check?${params}`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error('Failed to check approval skip rules');
  }
  return response.json();
};

const fetchAvailableDesignations = async (tenantId: string): Promise<{ code: string; name: string; level: number }[]> => {
  const params = new URLSearchParams({ tenant_id: tenantId });
  const response = await fetch(`${API_BASE_URL}/approval-skip-rules/designations?${params}`, {
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error('Failed to fetch designations');
  }
  return response.json();
};

const fetchAvailableProjects = async (tenantId: string): Promise<{ code: string; name: string }[]> => {
  const params = new URLSearchParams({ tenant_id: tenantId });
  const response = await fetch(`${API_BASE_URL}/approval-skip-rules/projects/list?${params}`, {
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error('Failed to fetch projects');
  }
  return response.json();
};

// Hooks
export const useApprovalSkipRules = (tenantId: string, includeInactive = false) => {
  return useQuery({
    queryKey: ['approval-skip-rules', tenantId, includeInactive],
    queryFn: () => fetchApprovalSkipRules(tenantId, includeInactive),
    enabled: !!tenantId,
  });
};

export const useApprovalSkipRule = (ruleId: string, tenantId: string) => {
  return useQuery({
    queryKey: ['approval-skip-rule', ruleId, tenantId],
    queryFn: () => fetchApprovalSkipRule(ruleId, tenantId),
    enabled: !!ruleId && !!tenantId,
  });
};

export const useCreateApprovalSkipRule = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ tenantId, data }: { tenantId: string; data: Partial<ApprovalSkipRule> }) =>
      createApprovalSkipRule(tenantId, data),
    onSuccess: (_, { tenantId }) => {
      queryClient.invalidateQueries({ queryKey: ['approval-skip-rules', tenantId] });
    },
  });
};

export const useUpdateApprovalSkipRule = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ ruleId, tenantId, data }: { ruleId: string; tenantId: string; data: Partial<ApprovalSkipRule> }) =>
      updateApprovalSkipRule(ruleId, tenantId, data),
    onSuccess: (_, { tenantId }) => {
      queryClient.invalidateQueries({ queryKey: ['approval-skip-rules', tenantId] });
    },
  });
};

export const useDeleteApprovalSkipRule = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ ruleId, tenantId }: { ruleId: string; tenantId: string }) =>
      deleteApprovalSkipRule(ruleId, tenantId),
    onSuccess: (_, { tenantId }) => {
      queryClient.invalidateQueries({ queryKey: ['approval-skip-rules', tenantId] });
    },
  });
};

export const useCheckApprovalSkip = (tenantId: string) => {
  return useMutation({
    mutationFn: ({
      employeeEmail,
      claimAmount,
      employeeDesignation,
      categoryCode,
    }: {
      employeeEmail: string;
      claimAmount: number;
      employeeDesignation?: string;
      categoryCode?: string;
    }) => checkApprovalSkip(tenantId, employeeEmail, claimAmount, employeeDesignation, categoryCode),
  });
};

export const useAvailableDesignations = (tenantId: string) => {
  return useQuery({
    queryKey: ['available-designations', tenantId],
    queryFn: () => fetchAvailableDesignations(tenantId),
    enabled: !!tenantId,
  });
};

export const useAvailableProjects = (tenantId: string) => {
  return useQuery({
    queryKey: ['available-projects-skip-rules', tenantId],
    queryFn: () => fetchAvailableProjects(tenantId),
    enabled: !!tenantId,
  });
};
