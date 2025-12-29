import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { extractErrorMessage } from '@/lib/utils';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

// Types
export interface IBU {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  description?: string;
  head_id?: string;
  head_name?: string;
  annual_budget?: number;
  budget_spent: number;
  is_active: boolean;
  project_count?: number;
  created_at: string;
  updated_at: string;
}

export interface IBUCreate {
  code: string;
  name: string;
  description?: string;
  head_id?: string;
  annual_budget?: number;
}

export interface IBUUpdate {
  code?: string;
  name?: string;
  description?: string;
  head_id?: string;
  annual_budget?: number;
  is_active?: boolean;
}

export interface IBUListResponse {
  items: IBU[];
  total: number;
  page: number;
  limit: number;
}

export interface IBUSummary {
  ibu_id: string;
  ibu_code: string;
  ibu_name: string;
  project_count: number;
  total_budget: number;
  total_spent: number;
  claims: {
    total_count: number;
    total_amount: number;
    by_status: Record<string, { count: number; amount: number }>;
    by_category: Record<string, { count: number; amount: number }>;
  };
}

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

// API functions
async function fetchIBUs(tenantId: string, params?: {
  search?: string;
  is_active?: boolean;
  page?: number;
  limit?: number;
}): Promise<IBUListResponse> {
  const searchParams = new URLSearchParams();
  searchParams.set('tenant_id', tenantId);
  if (params?.search) searchParams.set('search', params.search);
  if (params?.is_active !== undefined) searchParams.set('is_active', String(params.is_active));
  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.limit) searchParams.set('limit', String(params.limit));
  
  const response = await fetch(`${API_BASE_URL}/ibus/?${searchParams.toString()}`, {
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error('Failed to fetch IBUs');
  }
  return response.json();
}

async function fetchIBU(ibuId: string, tenantId: string): Promise<IBU> {
  const response = await fetch(`${API_BASE_URL}/ibus/${ibuId}?tenant_id=${tenantId}`, {
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error('Failed to fetch IBU');
  }
  return response.json();
}

async function createIBU(data: IBUCreate, tenantId: string): Promise<IBU> {
  const response = await fetch(`${API_BASE_URL}/ibus/?tenant_id=${tenantId}`, {
    method: 'POST',
    headers: getAuthHeadersWithJson(),
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(extractErrorMessage(error, 'Failed to create IBU'));
  }
  return response.json();
}

async function updateIBU(ibuId: string, data: IBUUpdate, tenantId: string): Promise<IBU> {
  const response = await fetch(`${API_BASE_URL}/ibus/${ibuId}?tenant_id=${tenantId}`, {
    method: 'PUT',
    headers: getAuthHeadersWithJson(),
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(extractErrorMessage(error, 'Failed to update IBU'));
  }
  return response.json();
}

async function deleteIBU(ibuId: string, tenantId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/ibus/${ibuId}?tenant_id=${tenantId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(extractErrorMessage(error, 'Failed to delete IBU'));
  }
}

async function fetchIBUProjects(ibuId: string, tenantId: string): Promise<any[]> {
  const response = await fetch(`${API_BASE_URL}/ibus/${ibuId}/projects?tenant_id=${tenantId}`, {
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error('Failed to fetch IBU projects');
  }
  return response.json();
}

async function fetchIBUSummary(ibuId: string, tenantId: string): Promise<IBUSummary> {
  const response = await fetch(`${API_BASE_URL}/ibus/${ibuId}/summary?tenant_id=${tenantId}`, {
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error('Failed to fetch IBU summary');
  }
  return response.json();
}

// Hooks
export function useIBUs(params?: {
  search?: string;
  is_active?: boolean;
  page?: number;
  limit?: number;
}) {
  const { user } = useAuth();
  const tenantId = user?.tenantId;
  
  return useQuery({
    queryKey: ['ibus', tenantId, params],
    queryFn: () => fetchIBUs(tenantId!, params),
    enabled: !!tenantId,
  });
}

export function useIBU(ibuId: string) {
  const { user } = useAuth();
  const tenantId = user?.tenantId;
  
  return useQuery({
    queryKey: ['ibu', ibuId, tenantId],
    queryFn: () => fetchIBU(ibuId, tenantId!),
    enabled: !!tenantId && !!ibuId,
  });
}

export function useCreateIBU() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const tenantId = user?.tenantId;
  
  return useMutation({
    mutationFn: (data: IBUCreate) => createIBU(data, tenantId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ibus'] });
    },
  });
}

export function useUpdateIBU() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const tenantId = user?.tenantId;
  
  return useMutation({
    mutationFn: ({ ibuId, data }: { ibuId: string; data: IBUUpdate }) => 
      updateIBU(ibuId, data, tenantId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ibus'] });
    },
  });
}

export function useDeleteIBU() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const tenantId = user?.tenantId;
  
  return useMutation({
    mutationFn: (ibuId: string) => deleteIBU(ibuId, tenantId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ibus'] });
    },
  });
}

export function useIBUProjects(ibuId: string) {
  const { user } = useAuth();
  const tenantId = user?.tenantId;
  
  return useQuery({
    queryKey: ['ibu-projects', ibuId, tenantId],
    queryFn: () => fetchIBUProjects(ibuId, tenantId!),
    enabled: !!tenantId && !!ibuId,
  });
}

export function useIBUSummary(ibuId: string) {
  const { user } = useAuth();
  const tenantId = user?.tenantId;
  
  return useQuery({
    queryKey: ['ibu-summary', ibuId, tenantId],
    queryFn: () => fetchIBUSummary(ibuId, tenantId!),
    enabled: !!tenantId && !!ibuId,
  });
}
