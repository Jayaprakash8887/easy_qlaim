import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Claim, ClaimStatus } from '@/types';

const API_BASE_URL = 'http://localhost:8000/api/v1';

// API functions
async function fetchClaims(): Promise<Claim[]> {
  const response = await fetch(`${API_BASE_URL}/claims/`);
  if (!response.ok) {
    throw new Error('Failed to fetch claims');
  }
  const data = await response.json();
  
  // Transform backend response to frontend format
  return data.map((claim: any) => ({
    id: claim.id,
    claimNumber: claim.claim_number,
    employeeId: claim.employee_id,
    employeeName: claim.employee_name,
    department: claim.department,
    type: claim.claim_type?.toLowerCase() || 'reimbursement',
    category: claim.category?.toLowerCase() || 'other',
    amount: parseFloat(claim.amount),
    currency: claim.currency || 'INR',
    status: mapBackendStatus(claim.status),
    submissionDate: claim.submission_date ? new Date(claim.submission_date) : new Date(),
    claimDate: claim.claim_date ? new Date(claim.claim_date) : new Date(),
    description: claim.description || '',
    documents: claim.documents || [],
    aiProcessed: claim.ai_validation_score !== null,
    aiConfidence: claim.ai_validation_score || 0,
    complianceScore: claim.compliance_score || 0,
  }));
}

function mapBackendStatus(backendStatus: string): ClaimStatus {
  const statusMap: Record<string, ClaimStatus> = {
    'DRAFT': 'draft',
    'SUBMITTED': 'submitted',
    'AI_PROCESSING': 'submitted',
    'PENDING_MANAGER': 'pending_manager',
    'RETURNED_TO_EMPLOYEE': 'returned',
    'MANAGER_APPROVED': 'pending_hr',
    'PENDING_HR': 'pending_hr',
    'HR_APPROVED': 'pending_finance',
    'PENDING_FINANCE': 'pending_finance',
    'FINANCE_APPROVED': 'approved',
    'SETTLED': 'settled',
    'REJECTED': 'rejected'
  };
  return statusMap[backendStatus] || 'draft';
}

async function fetchClaimById(id: string): Promise<Claim | undefined> {
  const response = await fetch(`${API_BASE_URL}/claims/${id}`);
  if (!response.ok) {
    if (response.status === 404) return undefined;
    throw new Error('Failed to fetch claim');
  }
  const claim = await response.json();
  
  return {
    id: claim.id,
    claimNumber: claim.claim_number,
    employeeId: claim.employee_id,
    employeeName: claim.employee_name,
    department: claim.department,
    type: claim.claim_type?.toLowerCase() || 'reimbursement',
    category: claim.category?.toLowerCase() || 'other',
    amount: parseFloat(claim.amount),
    currency: claim.currency || 'INR',
    status: mapBackendStatus(claim.status),
    submissionDate: claim.submission_date ? new Date(claim.submission_date) : new Date(),
    claimDate: claim.claim_date ? new Date(claim.claim_date) : new Date(),
    description: claim.description || '',
    documents: claim.documents || [],
    aiProcessed: claim.ai_validation_score !== null,
    aiConfidence: claim.ai_validation_score || 0,
    complianceScore: claim.compliance_score || 0,
  };
}

async function updateClaimStatus(id: string, status: ClaimStatus): Promise<Claim> {
  const response = await fetch(`${API_BASE_URL}/claims/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ status: status.toUpperCase() }),
  });
  
  if (!response.ok) {
    throw new Error('Failed to update claim status');
  }
  
  const claim = await response.json();
  return {
    id: claim.id,
    claimNumber: claim.claim_number,
    employeeId: claim.employee_id,
    employeeName: claim.employee_name,
    department: claim.department,
    type: claim.claim_type?.toLowerCase() || 'reimbursement',
    category: claim.category?.toLowerCase() || 'other',
    amount: parseFloat(claim.amount),
    currency: claim.currency || 'INR',
    status: mapBackendStatus(claim.status),
    submissionDate: claim.submission_date ? new Date(claim.submission_date) : new Date(),
    claimDate: claim.claim_date ? new Date(claim.claim_date) : new Date(),
    description: claim.description || '',
    documents: claim.documents || [],
    aiProcessed: claim.ai_validation_score !== null,
    aiConfidence: claim.ai_validation_score || 0,
    complianceScore: claim.compliance_score || 0,
  };
}

// Custom hooks
export function useClaims() {
  return useQuery({
    queryKey: ['claims'],
    queryFn: fetchClaims,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useClaim(id: string) {
  return useQuery({
    queryKey: ['claims', id],
    queryFn: () => fetchClaimById(id),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
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
  
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: ClaimStatus }) => 
      updateClaimStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['claims'] });
    },
  });
}
