import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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

export interface Comment {
  id: string;
  claim_id: string;
  comment_text: string;
  comment_type: string;
  user_id?: string;
  user_name: string;
  user_role: string;
  visible_to_employee: boolean;
  created_at: string;
}

export interface CommentCreate {
  claim_id: string;
  tenant_id: string;
  comment_text: string;
  comment_type?: string;
  user_name: string;
  user_role: string;
  visible_to_employee?: boolean;
}

// Fetch comments for a claim
async function fetchComments(claimId: string, tenantId: string): Promise<Comment[]> {
  const response = await fetch(`${API_BASE_URL}/comments/?claim_id=${claimId}&tenant_id=${tenantId}`, {
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error('Failed to fetch comments');
  }
  return response.json();
}

// Create a comment
async function createComment(comment: CommentCreate): Promise<Comment> {
  const response = await fetch(`${API_BASE_URL}/comments/`, {
    method: 'POST',
    headers: getAuthHeadersWithJson(),
    body: JSON.stringify(comment),
  });

  if (!response.ok) {
    throw new Error('Failed to create comment');
  }

  return response.json();
}

// Delete a comment
async function deleteComment(commentId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/comments/${commentId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to delete comment');
  }
}

// Hook to fetch comments for a claim
export function useComments(claimId: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['comments', claimId, user?.tenantId],
    queryFn: () => user?.tenantId ? fetchComments(claimId, user.tenantId) : [],
    enabled: !!claimId && !!user?.tenantId,
    staleTime: 1 * 60 * 1000, // 1 minute
  });
}

// Hook to create a comment
export function useCreateComment() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: (comment: Omit<CommentCreate, 'tenant_id'>) =>
      createComment({ ...comment, tenant_id: user?.tenantId || '' }),
    onSuccess: (_, variables) => {
      // Invalidate comments query to refetch
      queryClient.invalidateQueries({ queryKey: ['comments', variables.claim_id] });
    },
  });
}

// Hook to delete a comment
export function useDeleteComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteComment,
    onSuccess: () => {
      // Invalidate all comments queries
      queryClient.invalidateQueries({ queryKey: ['comments'] });
    },
  });
}
