import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const API_BASE_URL = 'http://localhost:8000/api/v1';

// ==================== TYPES ====================

export interface Tenant {
    id: string;
    name: string;
    code: string;
    domain: string | null;
    settings: Record<string, any>;
    is_active: boolean;
    created_at: string;
    updated_at: string | null;
}

export interface TenantCreate {
    name: string;
    code: string;
    domain?: string;
    settings?: Record<string, any>;
}

export interface Designation {
    id: string;
    tenant_id: string;
    name: string;
    code: string;
    description: string | null;
    level: number;
    is_active: boolean;
    roles: string[];
    created_at: string;
    updated_at: string | null;
}

export interface DesignationCreate {
    name: string;
    code: string;
    description?: string;
    level?: number;
}

// ==================== API FUNCTIONS ====================

// Tenants
async function fetchTenants(includeInactive = false): Promise<Tenant[]> {
    const response = await fetch(`${API_BASE_URL}/tenants/?include_inactive=${includeInactive}`);
    if (!response.ok) throw new Error('Failed to fetch tenants');
    return response.json();
}

async function createTenant(data: TenantCreate): Promise<Tenant> {
    const response = await fetch(`${API_BASE_URL}/tenants/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to create tenant');
    }
    return response.json();
}

async function updateTenant(id: string, data: Partial<Tenant>): Promise<Tenant> {
    const response = await fetch(`${API_BASE_URL}/tenants/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to update tenant');
    return response.json();
}

// Designations
async function fetchDesignations(tenantId?: string, includeInactive = false): Promise<Designation[]> {
    const params = new URLSearchParams();
    if (tenantId) params.append('tenant_id', tenantId);
    if (includeInactive) params.append('include_inactive', 'true');

    const response = await fetch(`${API_BASE_URL}/designations/?${params.toString()}`);
    if (!response.ok) throw new Error('Failed to fetch designations');
    return response.json();
}

async function fetchAvailableRoles(): Promise<string[]> {
    const response = await fetch(`${API_BASE_URL}/designations/available-roles`);
    if (!response.ok) throw new Error('Failed to fetch available roles');
    return response.json();
}

async function createDesignation(data: DesignationCreate, tenantId?: string): Promise<Designation> {
    const params = tenantId ? `?tenant_id=${tenantId}` : '';
    const response = await fetch(`${API_BASE_URL}/designations/${params}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to create designation');
    }
    return response.json();
}

async function updateDesignation(id: string, data: Partial<Designation>): Promise<Designation> {
    const response = await fetch(`${API_BASE_URL}/designations/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to update designation');
    return response.json();
}

async function setDesignationRoles(designationId: string, roles: string[]): Promise<string[]> {
    const response = await fetch(`${API_BASE_URL}/designations/${designationId}/roles`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(roles),
    });
    if (!response.ok) throw new Error('Failed to update roles');
    return response.json();
}

async function getTenantUsers(tenantId: string): Promise<any[]> {
    const response = await fetch(`${API_BASE_URL}/tenants/${tenantId}/users`);
    if (!response.ok) throw new Error('Failed to fetch tenant users');
    return response.json();
}

// ==================== HOOKS ====================

export function useTenants(includeInactive = false) {
    return useQuery({
        queryKey: ['tenants', includeInactive],
        queryFn: () => fetchTenants(includeInactive),
    });
}

export function useCreateTenant() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: createTenant,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tenants'] });
        },
    });
}

export function useUpdateTenant() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: Partial<Tenant> }) => updateTenant(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tenants'] });
        },
    });
}

export function useDesignations(tenantId?: string, includeInactive = false) {
    return useQuery({
        queryKey: ['designations', tenantId, includeInactive],
        queryFn: () => fetchDesignations(tenantId, includeInactive),
    });
}

export function useAvailableRoles() {
    return useQuery({
        queryKey: ['available-roles'],
        queryFn: fetchAvailableRoles,
        staleTime: Infinity, // Roles don't change often
    });
}

export function useCreateDesignation() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ data, tenantId }: { data: DesignationCreate; tenantId?: string }) =>
            createDesignation(data, tenantId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['designations'] });
        },
    });
}

export function useUpdateDesignation() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: Partial<Designation> }) => updateDesignation(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['designations'] });
        },
    });
}

export function useSetDesignationRoles() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ designationId, roles }: { designationId: string; roles: string[] }) =>
            setDesignationRoles(designationId, roles),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['designations'] });
        },
    });
}

export function useTenantUsers(tenantId: string) {
    return useQuery({
        queryKey: ['tenant-users', tenantId],
        queryFn: () => getTenantUsers(tenantId),
        enabled: !!tenantId,
    });
}
