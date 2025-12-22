// API functions for Policies

import type {
    PolicyUpload,
    PolicyUploadListItem,
    CustomClaim,
    CustomClaimListItem,
} from './types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

// Policy API Functions
export async function fetchPolicies(tenantId?: string, region?: string): Promise<PolicyUploadListItem[]> {
    const params = new URLSearchParams();
    if (tenantId) params.append('tenant_id', tenantId);
    if (region) params.append('region', region);

    const url = `${API_BASE_URL}/policies/${params.toString() ? '?' + params.toString() : ''}`;
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error('Failed to fetch policies');
    }
    return response.json();
}

export async function fetchPolicy(id: string, tenantId: string): Promise<PolicyUpload> {
    const response = await fetch(`${API_BASE_URL}/policies/${id}?tenant_id=${tenantId}`);
    if (!response.ok) {
        throw new Error('Failed to fetch policy');
    }
    return response.json();
}

export async function uploadPolicy(data: FormData): Promise<PolicyUpload> {
    const response = await fetch(`${API_BASE_URL}/policies/upload`, {
        method: 'POST',
        body: data,
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to upload policy');
    }
    return response.json();
}

export async function approvePolicy(
    id: string,
    data: { review_notes?: string; effective_from?: string; approved_by?: string },
    tenantId: string
): Promise<PolicyUpload> {
    const response = await fetch(`${API_BASE_URL}/policies/${id}/approve?tenant_id=${tenantId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to approve policy');
    }
    return response.json();
}

export async function rejectPolicy(id: string, review_notes: string, tenantId: string): Promise<PolicyUpload> {
    const response = await fetch(`${API_BASE_URL}/policies/${id}/reject?tenant_id=${tenantId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ review_notes }),
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to reject policy');
    }
    return response.json();
}

export async function reExtractPolicy(id: string, tenantId: string): Promise<{ message: string }> {
    const response = await fetch(`${API_BASE_URL}/policies/${id}/reextract?tenant_id=${tenantId}`, {
        method: 'POST',
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to re-extract policy');
    }
    return response.json();
}

export async function uploadNewVersion(id: string, formData: FormData, tenantId: string): Promise<PolicyUpload> {
    if (!formData.has('tenant_id')) {
        formData.append('tenant_id', tenantId);
    }
    const response = await fetch(`${API_BASE_URL}/policies/${id}/new-version`, {
        method: 'POST',
        body: formData,
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to upload new version');
    }
    return response.json();
}

// Custom Claims API Functions
export async function fetchCustomClaims(tenantId: string): Promise<CustomClaimListItem[]> {
    const response = await fetch(`${API_BASE_URL}/custom-claims/?tenant_id=${tenantId}`);
    if (!response.ok) {
        throw new Error('Failed to fetch custom claims');
    }
    return response.json();
}

export async function fetchCustomClaim(id: string, tenantId: string): Promise<CustomClaim> {
    const response = await fetch(`${API_BASE_URL}/custom-claims/${id}?tenant_id=${tenantId}`);
    if (!response.ok) {
        throw new Error('Failed to fetch custom claim');
    }
    return response.json();
}

export async function createCustomClaim(
    data: Partial<CustomClaim>,
    createdBy: string,
    tenantId: string
): Promise<CustomClaim> {
    const response = await fetch(`${API_BASE_URL}/custom-claims/?created_by=${createdBy}&tenant_id=${tenantId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to create custom claim');
    }
    return response.json();
}

export async function updateCustomClaim(
    id: string,
    data: Partial<CustomClaim>,
    updatedBy: string,
    tenantId: string
): Promise<CustomClaim> {
    const response = await fetch(`${API_BASE_URL}/custom-claims/${id}?updated_by=${updatedBy}&tenant_id=${tenantId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to update custom claim');
    }
    return response.json();
}

export async function deleteCustomClaim(id: string, tenantId: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/custom-claims/${id}?tenant_id=${tenantId}`, {
        method: 'DELETE',
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to delete custom claim');
    }
}

export async function toggleCustomClaimStatus(
    id: string,
    updatedBy: string,
    tenantId: string
): Promise<CustomClaim> {
    const response = await fetch(
        `${API_BASE_URL}/custom-claims/${id}/toggle-status?updated_by=${updatedBy}&tenant_id=${tenantId}`,
        { method: 'POST' }
    );
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to toggle custom claim status');
    }
    return response.json();
}
