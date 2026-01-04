import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

// Auth helper
function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('access_token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

// Custom field definition (matching backend schema)
export interface CustomFieldDefinition {
  name: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'select' | 'file' | 'boolean' | 'currency' | 'location';
  required: boolean;
  placeholder?: string;
  options: string[];
  validation?: {
    min_length?: number;
    max_length?: number;
    min?: number;
    max?: number;
    pattern?: string;
  };
  default_value?: unknown;
}

// Extracted claim category from API (includes both PolicyCategory and CustomClaim)
export interface ExtractedClaimCategory {
  id: string;
  policy_id: string | null;  // null for custom claims
  policy_name: string;
  policy_region: string | string[] | null;  // Can be a single string or array of regions
  policy_status: string;
  category_code: string;
  category_name: string;
  category_type: 'ALLOWANCE' | 'REIMBURSEMENT';
  max_amount: number | null;
  description: string | null;
  eligibility_criteria: {
    requirements?: string[];
    conditions?: string[];
    exclusions?: string[];
    allowance_frequency?: string;
    [key: string]: any;
  } | null;
  document_requirements: string[] | null;
  custom_fields?: CustomFieldDefinition[];  // Custom fields for this claim category
  created_at: string;
  updated_at: string;
  is_custom_claim?: boolean;  // True if this is a custom claim (not from policy)
  submission_window_days?: number;
}

// Fetch extracted claims from policies
async function fetchExtractedClaims(tenantId?: string): Promise<ExtractedClaimCategory[]> {
  const params = new URLSearchParams();
  if (tenantId) params.append('tenant_id', tenantId);

  const url = `${API_BASE_URL}/policies/extracted-claims${params.toString() ? '?' + params.toString() : ''}`;
  const response = await fetch(url, { headers: getAuthHeaders() });
  if (!response.ok) {
    throw new Error('Failed to fetch extracted claims');
  }
  return response.json();
}

// Hook to get all extracted claims
export function useExtractedClaims() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['extracted-claims', user?.tenantId],
    queryFn: () => fetchExtractedClaims(user?.tenantId),
    enabled: !!user?.tenantId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Helper to check if user region matches policy region
// Both can be string or array
function regionsMatch(userRegion: string | string[] | undefined, policyRegion: string | string[] | null): boolean {
  if (!userRegion) return true; // No user region filter, match all
  if (!policyRegion) return false; // No policy region, don't match
  
  const userRegions = Array.isArray(userRegion) ? userRegion : [userRegion];
  const policyRegions = Array.isArray(policyRegion) ? policyRegion : [policyRegion];
  
  // Check if any user region matches any policy region
  return userRegions.some(ur => policyRegions.includes(ur));
}

// Hook to get allowances filtered by region
export function useAllowancesByRegion(region: string | string[] | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['extracted-claims', 'allowances', region, user?.tenantId],
    queryFn: () => fetchExtractedClaims(user?.tenantId),
    enabled: !!user?.tenantId,
    select: (data) => {
      // Filter by category type ALLOWANCE and matching region
      return data.filter(
        (category) =>
          category.category_type === 'ALLOWANCE' &&
          category.policy_status === 'ACTIVE' &&
          regionsMatch(region, category.policy_region)
      );
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Hook to get reimbursement categories filtered by region
export function useReimbursementsByRegion(region: string | string[] | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['extracted-claims', 'reimbursements', region, user?.tenantId],
    queryFn: () => fetchExtractedClaims(user?.tenantId),
    enabled: !!user?.tenantId,
    select: (data) => {
      // Filter by category type REIMBURSEMENT and matching region
      return data.filter(
        (category) =>
          category.category_type === 'REIMBURSEMENT' &&
          category.policy_status === 'ACTIVE' &&
          regionsMatch(region, category.policy_region)
      );
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
