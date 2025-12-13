import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { mockClaims } from '@/data/mockClaims';
import { Claim, ClaimStatus } from '@/types';

// Simulated API delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Mock API functions
async function fetchClaims(): Promise<Claim[]> {
  await delay(800);
  return mockClaims;
}

async function fetchClaimById(id: string): Promise<Claim | undefined> {
  await delay(500);
  return mockClaims.find(claim => claim.id === id);
}

async function updateClaimStatus(id: string, status: ClaimStatus): Promise<Claim> {
  await delay(500);
  const claim = mockClaims.find(c => c.id === id);
  if (!claim) throw new Error('Claim not found');
  return { ...claim, status };
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
