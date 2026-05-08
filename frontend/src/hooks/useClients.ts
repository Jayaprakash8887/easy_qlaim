import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('access_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  };
}

// Helper to extract error message from API response
function extractErrorMessage(error: any, fallback: string): string {
  if (error.detail) {
    if (Array.isArray(error.detail)) {
      return error.detail.map((e: any) => e.msg || e.message || JSON.stringify(e)).join(', ');
    } else if (typeof error.detail === 'string') {
      return error.detail;
    }
  }
  return fallback;
}

// Types
export interface Client {
  id: string;
  tenant_id: string;
  client_code: string;
  client_name: string;
  description?: string;
  contact_person?: string;
  contact_email?: string;
  contact_phone?: string;
  address?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  project_count: number;
}

export interface ClientWithProjects extends Client {
  projects: Array<{
    id: string;
    project_code: string;
    project_name: string;
    description?: string;
    status: string;
    budget_allocated?: number;
    budget_spent: number;
    start_date?: string;
    end_date?: string;
    ibu_name?: string;
    ibu_code?: string;
  }>;
}

export interface ClientCreate {
  client_code: string;
  client_name: string;
  description?: string;
  contact_person?: string;
  contact_email?: string;
  contact_phone?: string;
  address?: string;
}

export interface ClientUpdate {
  client_code?: string;
  client_name?: string;
  description?: string;
  contact_person?: string;
  contact_email?: string;
  contact_phone?: string;
  address?: string;
  is_active?: boolean;
}

// API Functions
async function fetchClients(tenantId: string, isActive?: boolean): Promise<Client[]> {
  const params = new URLSearchParams({ tenant_id: tenantId });
  if (isActive !== undefined) {
    params.append('is_active', String(isActive));
  }
  const response = await fetch(`${API_BASE_URL}/clients/?${params.toString()}`, {
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error('Failed to fetch clients');
  }
  return response.json();
}

async function fetchClient(clientId: string, tenantId: string): Promise<ClientWithProjects> {
  const response = await fetch(
    `${API_BASE_URL}/clients/${clientId}?tenant_id=${tenantId}&include_projects=true`,
    { headers: getAuthHeaders() }
  );
  if (!response.ok) {
    throw new Error('Failed to fetch client');
  }
  return response.json();
}

async function createClient(data: ClientCreate, tenantId: string): Promise<Client> {
  const response = await fetch(`${API_BASE_URL}/clients/?tenant_id=${tenantId}`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(extractErrorMessage(error, 'Failed to create client'));
  }
  return response.json();
}

async function updateClient(
  clientId: string,
  data: ClientUpdate,
  tenantId: string
): Promise<Client> {
  const response = await fetch(`${API_BASE_URL}/clients/${clientId}?tenant_id=${tenantId}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(extractErrorMessage(error, 'Failed to update client'));
  }
  return response.json();
}

async function deleteClient(clientId: string, tenantId: string): Promise<{ message: string }> {
  const response = await fetch(`${API_BASE_URL}/clients/${clientId}?tenant_id=${tenantId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(extractErrorMessage(error, 'Failed to delete client'));
  }
  return response.json();
}

async function linkProjectsToClient(
  clientId: string,
  projectIds: string[],
  tenantId: string
): Promise<{ message: string; linked_count: number }> {
  const response = await fetch(
    `${API_BASE_URL}/clients/${clientId}/link-projects?tenant_id=${tenantId}`,
    {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(projectIds),
    }
  );
  if (!response.ok) {
    const error = await response.json();
    throw new Error(extractErrorMessage(error, 'Failed to link projects'));
  }
  return response.json();
}

async function unlinkProjectsFromClient(
  clientId: string,
  projectIds: string[],
  tenantId: string
): Promise<{ message: string; unlinked_count: number }> {
  const response = await fetch(
    `${API_BASE_URL}/clients/${clientId}/unlink-projects?tenant_id=${tenantId}`,
    {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(projectIds),
    }
  );
  if (!response.ok) {
    const error = await response.json();
    throw new Error(extractErrorMessage(error, 'Failed to unlink projects'));
  }
  return response.json();
}

// Hooks
export function useClients(isActive?: boolean) {
  const { user } = useAuth();
  const tenantId = user?.tenantId;

  return useQuery({
    queryKey: ['clients', tenantId, isActive],
    queryFn: () => fetchClients(tenantId!, isActive),
    enabled: !!tenantId,
  });
}

export function useClient(clientId: string | null) {
  const { user } = useAuth();
  const tenantId = user?.tenantId;

  return useQuery({
    queryKey: ['client', clientId, tenantId],
    queryFn: () => fetchClient(clientId!, tenantId!),
    enabled: !!clientId && !!tenantId,
  });
}

export function useCreateClient() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ClientCreate) => createClient(data, user?.tenantId || ''),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
  });
}

export function useUpdateClient() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ clientId, data }: { clientId: string; data: ClientUpdate }) =>
      updateClient(clientId, data, user?.tenantId || ''),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['client'] });
    },
  });
}

export function useDeleteClient() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (clientId: string) => deleteClient(clientId, user?.tenantId || ''),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
  });
}

export function useLinkProjectsToClient() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ clientId, projectIds }: { clientId: string; projectIds: string[] }) =>
      linkProjectsToClient(clientId, projectIds, user?.tenantId || ''),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['client'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}

export function useUnlinkProjectsFromClient() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ clientId, projectIds }: { clientId: string; projectIds: string[] }) =>
      unlinkProjectsFromClient(clientId, projectIds, user?.tenantId || ''),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['client'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}
