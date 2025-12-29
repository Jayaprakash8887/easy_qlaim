
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Region } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
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

// Build URL with query params
const buildUrl = (baseUrl: string, params: Record<string, any>) => {
    const url = new URL(baseUrl, window.location.origin);
    Object.keys(params).forEach(key => {
        if (params[key]) {
            url.searchParams.append(key, params[key]);
        }
    });
    return url.toString();
};

async function fetchRegions(tenantId?: string): Promise<Region[]> {
    const url = buildUrl(`${API_BASE_URL}/regions/`, { tenant_id: tenantId });
    const response = await fetch(url, {
        headers: getAuthHeaders(),
    });
    if (!response.ok) {
        throw new Error('Failed to fetch regions');
    }
    const data = await response.json();

    // Transform backend response to frontend format
    return data.map((region: any) => ({
        id: region.id,
        name: region.name,
        code: region.code,
        currency: region.currency,
        description: region.description,
        isActive: region.is_active,
        createdAt: region.created_at,
        updatedAt: region.updated_at,
    }));
}

async function createRegion(region: Partial<Region>, tenantId?: string): Promise<Region> {
    const url = tenantId 
        ? `${API_BASE_URL}/regions/?tenant_id=${tenantId}`
        : `${API_BASE_URL}/regions/`;
    const response = await fetch(url, {
        method: 'POST',
        headers: getAuthHeadersWithJson(),
        body: JSON.stringify({
            name: region.name,
            code: region.code,
            currency: region.currency,
            description: region.description,
            is_active: region.isActive ?? true,
        }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(extractErrorMessage(error, 'Failed to create region'));
    }

    const data = await response.json();

    return {
        id: data.id,
        name: data.name,
        code: data.code,
        currency: data.currency,
        description: data.description,
        isActive: data.is_active,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
    };
}

async function updateRegion({ id, data, tenantId }: { id: string; data: Partial<Region>; tenantId?: string }): Promise<Region> {
    const url = tenantId 
        ? `${API_BASE_URL}/regions/${id}?tenant_id=${tenantId}`
        : `${API_BASE_URL}/regions/${id}`;
    const response = await fetch(url, {
        method: 'PUT',
        headers: getAuthHeadersWithJson(),
        body: JSON.stringify({
            name: data.name,
            code: data.code,
            currency: data.currency,
            description: data.description,
            is_active: data.isActive,
        }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(extractErrorMessage(error, 'Failed to update region'));
    }

    const result = await response.json();

    return {
        id: result.id,
        name: result.name,
        code: result.code,
        currency: result.currency,
        description: result.description,
        isActive: result.is_active,
        createdAt: result.created_at,
        updatedAt: result.updated_at,
    };
}

async function deleteRegion({ id, tenantId }: { id: string; tenantId?: string }): Promise<void> {
    const url = tenantId 
        ? `${API_BASE_URL}/regions/${id}?tenant_id=${tenantId}`
        : `${API_BASE_URL}/regions/${id}`;
    const response = await fetch(url, {
        method: 'DELETE',
        headers: getAuthHeaders(),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(extractErrorMessage(error, 'Failed to delete region'));
    }
}

// Custom hooks
export function useRegions(tenantIdOverride?: string) {
    const { user } = useAuth();
    const tenantId = tenantIdOverride || user?.tenantId;

    return useQuery({
        queryKey: ['regions', tenantId],
        queryFn: () => fetchRegions(tenantId),
        enabled: !!tenantId,
        staleTime: 5 * 60 * 1000,
    });
}

export function useCreateRegion() {
    const queryClient = useQueryClient();
    const { user } = useAuth();

    return useMutation({
        mutationFn: (data: Partial<Region>) => createRegion(data, user?.tenantId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['regions'] });
        },
    });
}

export function useUpdateRegion() {
    const queryClient = useQueryClient();
    const { user } = useAuth();

    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: Partial<Region> }) => 
            updateRegion({ id, data, tenantId: user?.tenantId }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['regions'] });
        },
    });
}

export function useDeleteRegion() {
    const queryClient = useQueryClient();
    const { user } = useAuth();

    return useMutation({
        mutationFn: (id: string) => deleteRegion({ id, tenantId: user?.tenantId }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['regions'] });
        },
    });
}
