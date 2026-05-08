import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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

export interface Department {
    id: string;
    tenant_id: string;
    code: string;
    name: string;
    description?: string;
    head_id?: string;
    is_active: boolean;
    display_order: number;
    created_at: string;
    updated_at: string;
    head_name?: string;
    employee_count?: number;
}

export interface DepartmentCreate {
    code: string;
    name: string;
    description?: string;
    head_id?: string;
    display_order?: number;
}

export interface DepartmentUpdate {
    code?: string;
    name?: string;
    description?: string;
    head_id?: string;
    display_order?: number;
    is_active?: boolean;
}

// Fetch all departments for a tenant
async function fetchDepartments(tenantId?: string, includeInactive = false): Promise<Department[]> {
    if (!tenantId) return [];

    const params = new URLSearchParams({ tenant_id: tenantId });
    if (includeInactive) {
        params.append('include_inactive', 'true');
    }
    params.append('include_counts', 'true');

    const response = await fetch(`${API_BASE_URL}/departments?${params}`, {
        headers: getAuthHeaders(),
    });
    if (!response.ok) {
        throw new Error('Failed to fetch departments');
    }
    return response.json();
}

// Create a department
async function createDepartment(tenantId: string, data: DepartmentCreate): Promise<Department> {
    const response = await fetch(`${API_BASE_URL}/departments?tenant_id=${tenantId}`, {
        method: 'POST',
        headers: getAuthHeadersWithJson(),
        body: JSON.stringify(data),
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(extractErrorMessage(error, 'Failed to create department'));
    }
    return response.json();
}

// Update a department
async function updateDepartment(id: string, data: DepartmentUpdate, tenantId?: string): Promise<Department> {
    const params = tenantId ? `?tenant_id=${tenantId}` : '';
    const response = await fetch(`${API_BASE_URL}/departments/${id}${params}`, {
        method: 'PUT',
        headers: getAuthHeadersWithJson(),
        body: JSON.stringify(data),
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(extractErrorMessage(error, 'Failed to update department'));
    }
    return response.json();
}

// Delete a department
async function deleteDepartment(id: string, tenantId?: string): Promise<void> {
    const params = tenantId ? `?tenant_id=${tenantId}` : '';
    const response = await fetch(`${API_BASE_URL}/departments/${id}${params}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(extractErrorMessage(error, 'Failed to delete department'));
    }
}

// Hooks
export function useDepartments(tenantId?: string, includeInactive = false) {
    return useQuery({
        queryKey: ['departments', tenantId, includeInactive],
        queryFn: () => fetchDepartments(tenantId, includeInactive),
        enabled: !!tenantId,
        staleTime: 5 * 60 * 1000, // 5 minutes
    });
}

export function useCreateDepartment() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ tenantId, data }: { tenantId: string; data: DepartmentCreate }) =>
            createDepartment(tenantId, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['departments'] });
        },
    });
}

export function useUpdateDepartment() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data, tenantId }: { id: string; data: DepartmentUpdate; tenantId?: string }) =>
            updateDepartment(id, data, tenantId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['departments'] });
        },
    });
}

export function useDeleteDepartment() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, tenantId }: { id: string; tenantId?: string }) =>
            deleteDepartment(id, tenantId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['departments'] });
        },
    });
}
