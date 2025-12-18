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

// ==================== BRANDING TYPES ====================

export interface BrandingFileSpec {
    name: string;
    description: string;
    formats: string[];
    max_size_mb: number;
    recommended_dimensions: string;
    notes: string;
}

export interface BrandingSettings {
    logo_url: string | null;
    logo_mark_url: string | null;
    favicon_url: string | null;
    login_background_url: string | null;
    primary_color: string | null;
    secondary_color: string | null;
    accent_color: string | null;
    company_tagline: string | null;
    custom_css: string | null;
}

export interface BrandingResponse {
    tenant_id: string;
    tenant_name: string;
    branding: BrandingSettings;
    file_specs: Record<string, BrandingFileSpec>;
}

export interface BrandingColors {
    primary_color?: string;
    secondary_color?: string;
    accent_color?: string;
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

async function getTenantAdmins(tenantId: string): Promise<any[]> {
    const response = await fetch(`${API_BASE_URL}/tenants/${tenantId}/users?admin_only=true`);
    if (!response.ok) throw new Error('Failed to fetch tenant admins');
    return response.json();
}

async function createTenantAdminByEmail(tenantId: string, email: string): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/tenants/${tenantId}/admins`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to add tenant admin');
    }
    return response.json();
}

async function removeTenantAdmin(tenantId: string, userId: string): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/tenants/${tenantId}/admins/${userId}`, {
        method: 'DELETE',
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to remove tenant admin');
    }
    return response.json();
}

// ==================== BRANDING API FUNCTIONS ====================

async function fetchBrandingSpecs(): Promise<{ file_specs: Record<string, BrandingFileSpec>; notes: Record<string, string> }> {
    const response = await fetch(`${API_BASE_URL}/branding/specs`);
    if (!response.ok) throw new Error('Failed to fetch branding specs');
    return response.json();
}

async function fetchTenantBranding(tenantId: string): Promise<BrandingResponse> {
    const response = await fetch(`${API_BASE_URL}/branding/${tenantId}`);
    if (!response.ok) throw new Error('Failed to fetch tenant branding');
    return response.json();
}

async function uploadBrandingFile(tenantId: string, fileType: string, file: File): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await fetch(`${API_BASE_URL}/branding/${tenantId}/upload/${fileType}`, {
        method: 'POST',
        body: formData,
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to upload branding file');
    }
    return response.json();
}

async function deleteBrandingFile(tenantId: string, fileType: string): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/branding/${tenantId}/files/${fileType}`, {
        method: 'DELETE',
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to delete branding file');
    }
    return response.json();
}

async function updateBrandingColors(tenantId: string, colors: BrandingColors): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/branding/${tenantId}/colors`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(colors),
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to update branding colors');
    }
    return response.json();
}

async function updateBrandingSettings(tenantId: string, settings: Partial<BrandingSettings>): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/branding/${tenantId}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to update branding settings');
    }
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

export function useTenantAdmins(tenantId: string) {
    return useQuery({
        queryKey: ['tenant-admins', tenantId],
        queryFn: () => getTenantAdmins(tenantId),
        enabled: !!tenantId,
    });
}

export function useCreateTenantAdmin() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ tenantId, email }: { tenantId: string; email: string }) =>
            createTenantAdminByEmail(tenantId, email),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['tenant-admins', variables.tenantId] });
        },
    });
}

export function useRemoveTenantAdmin() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ tenantId, userId }: { tenantId: string; userId: string }) =>
            removeTenantAdmin(tenantId, userId),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['tenant-admins', variables.tenantId] });
        },
    });
}

// ==================== BRANDING HOOKS ====================

export function useBrandingSpecs() {
    return useQuery({
        queryKey: ['branding-specs'],
        queryFn: fetchBrandingSpecs,
        staleTime: Infinity, // Specs don't change
    });
}

export function useTenantBranding(tenantId: string) {
    return useQuery({
        queryKey: ['tenant-branding', tenantId],
        queryFn: () => fetchTenantBranding(tenantId),
        enabled: !!tenantId,
    });
}

export function useUploadBrandingFile() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ tenantId, fileType, file }: { tenantId: string; fileType: string; file: File }) =>
            uploadBrandingFile(tenantId, fileType, file),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['tenant-branding', variables.tenantId] });
            queryClient.invalidateQueries({ queryKey: ['tenants'] });
        },
    });
}

export function useDeleteBrandingFile() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ tenantId, fileType }: { tenantId: string; fileType: string }) =>
            deleteBrandingFile(tenantId, fileType),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['tenant-branding', variables.tenantId] });
            queryClient.invalidateQueries({ queryKey: ['tenants'] });
        },
    });
}

export function useUpdateBrandingColors() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ tenantId, colors }: { tenantId: string; colors: BrandingColors }) =>
            updateBrandingColors(tenantId, colors),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['tenant-branding', variables.tenantId] });
        },
    });
}

export function useUpdateBrandingSettings() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ tenantId, settings }: { tenantId: string; settings: Partial<BrandingSettings> }) =>
            updateBrandingSettings(tenantId, settings),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['tenant-branding', variables.tenantId] });
        },
    });
}
