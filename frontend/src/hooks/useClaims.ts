import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Claim, ClaimStatus } from '@/types';
import { useAuth } from '@/contexts/AuthContext';

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

// API functions
async function fetchClaims(tenantId?: string, userId?: string, role?: string): Promise<Claim[]> {
  const params = new URLSearchParams();
  if (tenantId) {
    params.append('tenant_id', tenantId);
  }
  // For manager role, pass user_id and role for filtering to direct reports only
  if (userId && role) {
    params.append('user_id', userId);
    params.append('role', role);
  }
  const url = `${API_BASE_URL}/claims/${params.toString() ? '?' + params.toString() : ''}`;
  const response = await fetch(url, {
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error('Failed to fetch claims');
  }
  const data = await response.json();

  // Backend returns { claims: [...], total, page, page_size }
  const claimsList = data.claims || data;

  // Transform backend response to frontend format
  return claimsList.map((claim: any) => {
    const payload = claim.claim_payload || {};
    return {
      id: claim.id,
      claimNumber: claim.claim_number,
      employeeId: claim.employee_id,
      employeeName: claim.employee_name,
      department: claim.department,
      type: claim.claim_type?.toLowerCase() || 'reimbursement',
      category: claim.category_name || claim.category?.toLowerCase() || 'other',  // Use category_name if available
      title: payload.title || claim.description?.slice(0, 50) || 'Expense Claim',
      amount: parseFloat(claim.amount) || 0,
      currency: claim.currency || 'INR',
      status: mapBackendStatus(claim.status),
      submissionDate: claim.submission_date ? new Date(claim.submission_date) : new Date(),
      claimDate: claim.claim_date ? new Date(claim.claim_date) : new Date(),
      createdAt: claim.created_at ? new Date(claim.created_at) : new Date(),
      updatedAt: claim.updated_at ? new Date(claim.updated_at) : (claim.created_at ? new Date(claim.created_at) : new Date()),
      description: claim.description || '',
      projectCode: payload.project_code || '',
      projectName: claim.project_name || payload.project_name || '',  // Use project_name from API
      vendor: payload.vendor || '',
      transactionRef: payload.transaction_ref || '',
      documents: claim.documents || [],
      aiProcessed: payload.ai_analysis?.ai_confidence !== undefined,
      aiConfidence: payload.ai_analysis?.ai_confidence || 0,
      aiRecommendation: payload.ai_analysis?.ai_recommendation || 'review',
      aiRecommendationText: payload.ai_analysis?.recommendation_text || 'Manual review required',
      complianceScore: payload.policy_checks?.compliance_score || claim.compliance_score || 0,
      policyChecks: payload.policy_checks?.checks || [],
      // Settlement fields - check both direct fields and payload.settlement
      settledDate: claim.settled_date 
        ? new Date(claim.settled_date) 
        : payload.settlement?.settled_date 
          ? new Date(payload.settlement.settled_date) 
          : undefined,
      paymentReference: claim.payment_reference || payload.settlement?.payment_reference || undefined,
      paymentMethod: claim.payment_method || payload.settlement?.payment_method || undefined,
    };
  });
}

function mapBackendStatus(backendStatus: string): ClaimStatus {
  const statusMap: Record<string, ClaimStatus> = {
    'AI_PROCESSING': 'pending_manager',
    'PENDING_MANAGER': 'pending_manager',
    'RETURNED_TO_EMPLOYEE': 'returned',
    'MANAGER_APPROVED': 'pending_hr',
    'PENDING_HR': 'pending_hr',
    'HR_APPROVED': 'pending_finance',
    'PENDING_FINANCE': 'pending_finance',
    'FINANCE_APPROVED': 'finance_approved',
    'SETTLED': 'settled',
    'REJECTED': 'rejected'
  };
  return statusMap[backendStatus] || 'pending_manager';
}

async function fetchClaimById(id: string, tenantId: string): Promise<Claim | undefined> {
  const response = await fetch(`${API_BASE_URL}/claims/${id}?tenant_id=${tenantId}`, {
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    if (response.status === 404) return undefined;
    throw new Error('Failed to fetch claim');
  }
  const claim = await response.json();
  const payload = claim.claim_payload || {};

  return {
    id: claim.id,
    claimNumber: claim.claim_number,
    employeeId: claim.employee_id,
    employeeName: claim.employee_name,
    department: claim.department,
    type: claim.claim_type?.toLowerCase() || 'reimbursement',
    category: claim.category_name || claim.category?.toLowerCase() || 'other',  // Use category_name if available
    amount: parseFloat(claim.amount),
    currency: claim.currency || 'INR',
    status: mapBackendStatus(claim.status),
    submissionDate: claim.submission_date ? new Date(claim.submission_date) : new Date(),
    claimDate: claim.claim_date ? new Date(claim.claim_date) : new Date(),
    description: claim.description || '',
    title: payload.title || claim.description || '',
    projectCode: payload.project_code || '',
    projectName: claim.project_name || payload.project_name || '',  // Use project_name from API
    costCenter: payload.cost_center || '',
    vendor: payload.vendor || '',
    transactionRef: payload.transaction_ref || '',
    documents: claim.documents || [],
    aiProcessed: claim.claim_payload?.ai_analysis?.ai_confidence !== undefined,
    aiConfidence: claim.claim_payload?.ai_analysis?.ai_confidence || 0,
    aiRecommendation: claim.claim_payload?.ai_analysis?.ai_recommendation || 'review',
    aiRecommendationText: claim.claim_payload?.ai_analysis?.recommendation_text || 'Manual review required',
    complianceScore: claim.claim_payload?.policy_checks?.compliance_score || claim.compliance_score || 0,
    policyChecks: claim.claim_payload?.policy_checks?.checks || [],
    // Add dataSource based on whether data was auto-extracted or manual
    dataSource: {
      category: payload.category_source || 'manual',
      title: payload.title_source || 'manual',
      amount: payload.amount_source || 'manual',
      date: payload.date_source || 'manual',
      vendor: payload.vendor_source || 'manual',
      description: payload.description_source || 'manual',
      transactionRef: payload.transaction_ref_source || 'manual',
    },
    // Return workflow fields
    returnReason: claim.return_reason || undefined,
    returnCount: claim.return_count || 0,
    returnedAt: claim.returned_at ? new Date(claim.returned_at) : undefined,
    canEdit: claim.can_edit || false,
    // Settlement fields - check both direct fields and payload.settlement
    settledDate: claim.settled_date 
      ? new Date(claim.settled_date) 
      : payload.settlement?.settled_date 
        ? new Date(payload.settlement.settled_date) 
        : undefined,
    paymentReference: claim.payment_reference || payload.settlement?.payment_reference || undefined,
    paymentMethod: claim.payment_method || payload.settlement?.payment_method || undefined,
    // Approval history from claim_payload - only actual stored history
    approvalHistory: buildApprovalHistory(claim, payload),
  };
}

// Helper function to build approval history from claim data
function buildApprovalHistory(claim: any, payload: any): any[] {
  // Only return actual stored approval_history, no derived data
  if (payload.approval_history && payload.approval_history.length > 0) {
    return payload.approval_history.map((item: any) => ({
      id: item.id || `${item.timestamp}-${item.action}`,
      action: item.action,
      approverName: item.approver_name || item.approverName,
      approverRole: item.approver_role || item.approverRole,
      timestamp: item.timestamp,
      comment: item.comment || item.comments,
    }));
  }
  
  // No stored history - return empty array
  return [];
}

async function updateClaimStatus(id: string, status: ClaimStatus, tenantId: string): Promise<Claim> {
  const response = await fetch(`${API_BASE_URL}/claims/${id}?tenant_id=${tenantId}`, {
    method: 'PUT',
    headers: getAuthHeadersWithJson(),
    body: JSON.stringify({ status: status.toUpperCase() }),
  });

  if (!response.ok) {
    throw new Error('Failed to update claim status');
  }

  const claim = await response.json();
  const payload = claim.claim_payload || {};
  return {
    id: claim.id,
    claimNumber: claim.claim_number,
    employeeId: claim.employee_id,
    employeeName: claim.employee_name,
    department: claim.department,
    type: claim.claim_type?.toLowerCase() || 'reimbursement',
    category: claim.category?.toLowerCase() || 'other',
    title: payload.title || claim.description || '',
    amount: parseFloat(claim.amount),
    currency: claim.currency || 'INR',
    status: mapBackendStatus(claim.status),
    submissionDate: claim.submission_date ? new Date(claim.submission_date) : new Date(),
    claimDate: claim.claim_date ? new Date(claim.claim_date) : new Date(),
    description: claim.description || '',
    documents: claim.documents || [],
    aiProcessed: claim.claim_payload?.ai_analysis?.ai_confidence !== undefined,
    aiConfidence: claim.claim_payload?.ai_analysis?.ai_confidence || 0,
    aiRecommendation: claim.claim_payload?.ai_analysis?.ai_recommendation || 'review',
    aiRecommendationText: claim.claim_payload?.ai_analysis?.recommendation_text || 'Manual review required',
    complianceScore: claim.compliance_score || 0,
  };
}

// Custom hooks
export function useClaims() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['claims', user?.tenantId, user?.id, user?.role],
    queryFn: () => fetchClaims(user?.tenantId, user?.id, user?.role),
    enabled: !!user?.tenantId,
    staleTime: 30 * 1000, // 30 seconds - reduced for fresher approval data
    refetchOnWindowFocus: true, // Refetch when user returns to the tab
  });
}

export function useClaim(id: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['claims', id, user?.tenantId],
    queryFn: () => user?.tenantId ? fetchClaimById(id, user.tenantId) : undefined,
    enabled: !!id && !!user?.tenantId,
    staleTime: 10 * 1000, // 10 seconds - ensure claim details are fresh
    refetchOnWindowFocus: true, // Refetch when user returns to the tab
  });
}

export function useClaimsByStatus(status: ClaimStatus | 'all') {
  const { data: claims, ...rest } = useClaims();

  const filteredClaims = status === 'all'
    ? claims
    : claims?.filter(claim => claim.status === status);

  return { data: filteredClaims, ...rest };
}

export function usePendingApprovals() {
  return useClaimsByStatus('pending_manager');
}

export function useUpdateClaimStatus() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: ClaimStatus }) =>
      updateClaimStatus(id, status, user?.tenantId || ''),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['claims'] });
    },
  });
}

// Batch claims creation types
export interface BatchClaimItem {
  category: string;
  amount: number;
  claim_date: string;  // ISO date string YYYY-MM-DD
  title?: string;
  vendor?: string;
  description?: string;
  transaction_ref?: string;
  // Field source tracking: 'ocr' for auto-extracted, 'manual' for user-entered
  category_source?: 'ocr' | 'manual';
  title_source?: 'ocr' | 'manual';
  amount_source?: 'ocr' | 'manual';
  date_source?: 'ocr' | 'manual';
  vendor_source?: 'ocr' | 'manual';
  description_source?: 'ocr' | 'manual';
  transaction_ref_source?: 'ocr' | 'manual';
}

export interface BatchClaimCreate {
  employee_id: string;
  claim_type: 'REIMBURSEMENT' | 'ALLOWANCE';
  project_code?: string;
  claims: BatchClaimItem[];
}

export interface BatchClaimWithDocumentCreate {
  batchData: BatchClaimCreate;
  file?: File;  // Optional document file
}

export interface BatchClaimResponse {
  success: boolean;
  total_claims: number;
  total_amount: number;
  claim_ids: string[];
  claim_numbers: string[];
  message: string;
}

async function createBatchClaims(batch: BatchClaimCreate): Promise<BatchClaimResponse> {
  const response = await fetch(`${API_BASE_URL}/claims/batch`, {
    method: 'POST',
    headers: getAuthHeadersWithJson(),
    body: JSON.stringify(batch),
  });

  if (!response.ok) {
    const error = await response.json();
    // Handle both string and object error details (e.g., duplicate claim errors)
    const errorMessage = typeof error.detail === 'object'
      ? error.detail.message || JSON.stringify(error.detail)
      : error.detail || 'Failed to create claims';
    throw new Error(errorMessage);
  }

  return response.json();
}

async function createBatchClaimsWithDocument(data: BatchClaimWithDocumentCreate): Promise<BatchClaimResponse> {
  const formData = new FormData();
  formData.append('batch_data', JSON.stringify(data.batchData));

  if (data.file) {
    formData.append('file', data.file);
  }

  const response = await fetch(`${API_BASE_URL}/claims/batch-with-document`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: formData,  // No Content-Type header - browser sets it with boundary
  });

  if (!response.ok) {
    const error = await response.json();
    // Handle both string and object error details (e.g., duplicate claim errors)
    const errorMessage = typeof error.detail === 'object'
      ? error.detail.message || JSON.stringify(error.detail)
      : error.detail || 'Failed to create claims';
    throw new Error(errorMessage);
  }

  return response.json();
}

export function useCreateBatchClaims() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createBatchClaims,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['claims'] });
    },
  });
}

export function useCreateBatchClaimsWithDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createBatchClaimsWithDocument,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['claims'] });
    },
  });
}

// Delete a claim
async function deleteClaim(claimId: string, tenantId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/claims/${claimId}?tenant_id=${tenantId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to delete claim');
  }
}

export function useDeleteClaim() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: (claimId: string) => deleteClaim(claimId, user?.tenantId || ''),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['claims'] });
    },
  });
}

// Update a claim (fields only, not documents)
export interface ClaimUpdateData {
  amount?: number;
  claim_date?: string;  // YYYY-MM-DD format
  description?: string;
  category?: string;  // Category code
  title?: string;  // Expense title
  project_code?: string;  // Project code
  transaction_ref?: string;  // Transaction reference ID
  status?: string;  // e.g., 'PENDING_MANAGER' to resubmit
  edited_sources?: string[];  // Fields that were edited (e.g., ['amount', 'date', 'description'])
}

async function updateClaim(claimId: string, data: ClaimUpdateData, tenantId: string): Promise<Claim> {
  const response = await fetch(`${API_BASE_URL}/claims/${claimId}?tenant_id=${tenantId}`, {
    method: 'PUT',
    headers: getAuthHeadersWithJson(),
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    // Handle both string and object error details (e.g., duplicate claim errors)
    const errorMessage = typeof error.detail === 'object'
      ? error.detail.message || JSON.stringify(error.detail)
      : error.detail || 'Failed to update claim';
    throw new Error(errorMessage);
  }

  const claim = await response.json();
  const payload = claim.claim_payload || {};
  return {
    id: claim.id,
    claimNumber: claim.claim_number,
    employeeId: claim.employee_id,
    employeeName: claim.employee_name,
    department: claim.department,
    type: claim.claim_type?.toLowerCase() || 'reimbursement',
    category: claim.category_name || claim.category?.toLowerCase() || 'other',  // Use category_name if available
    title: payload.title || claim.description || '',
    amount: parseFloat(claim.amount),
    currency: claim.currency || 'INR',
    status: mapBackendStatus(claim.status),
    submissionDate: claim.submission_date ? new Date(claim.submission_date) : new Date(),
    claimDate: claim.claim_date ? new Date(claim.claim_date) : new Date(),
    description: claim.description || '',
    documents: claim.documents || [],
    aiProcessed: claim.claim_payload?.ai_analysis?.ai_confidence !== undefined,
    aiConfidence: claim.claim_payload?.ai_analysis?.ai_confidence || 0,
    aiRecommendation: claim.claim_payload?.ai_analysis?.ai_recommendation || 'review',
    aiRecommendationText: claim.claim_payload?.ai_analysis?.recommendation_text || 'Manual review required',
    complianceScore: claim.compliance_score || 0,
  };
}

export function useUpdateClaim() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: ({ claimId, data }: { claimId: string; data: ClaimUpdateData }) =>
      updateClaim(claimId, data, user?.tenantId || ''),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['claims'] });
    },
  });
}
