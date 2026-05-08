import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ClaimDocument } from '@/types';
import { useAuth } from '@/contexts/AuthContext';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

// Auth helpers
function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('access_token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

// Transform backend document to frontend format
function transformDocument(doc: any): ClaimDocument {
  return {
    id: doc.id,
    name: doc.filename || doc.name || 'Document',
    filename: doc.filename,
    url: doc.download_url || `${API_BASE_URL}/documents/${doc.id}/view`,
    type: doc.file_type || doc.type || 'UNKNOWN',
    size: doc.file_size || doc.size || 0,
    uploadedAt: doc.uploaded_at ? new Date(doc.uploaded_at) : new Date(),
    ocrData: doc.ocr_data,
    ocrConfidence: doc.ocr_confidence,
    gcsUri: doc.gcs_uri,
    gcsBlobName: doc.gcs_blob_name,
    storageType: doc.storage_type || 'local',
    contentType: doc.content_type,
    downloadUrl: doc.download_url || `${API_BASE_URL}/documents/${doc.id}/view`,
  };
}

// Fetch documents for a claim
async function fetchDocumentsForClaim(claimId: string, tenantId: string): Promise<ClaimDocument[]> {
  const response = await fetch(`${API_BASE_URL}/documents/?claim_id=${claimId}&tenant_id=${tenantId}`, {
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error('Failed to fetch documents');
  }
  const data = await response.json();
  return data.map(transformDocument);
}

// Fetch a single document
async function fetchDocument(documentId: string): Promise<ClaimDocument | undefined> {
  const response = await fetch(`${API_BASE_URL}/documents/${documentId}`, {
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    if (response.status === 404) return undefined;
    throw new Error('Failed to fetch document');
  }
  const doc = await response.json();
  return transformDocument(doc);
}

// Upload a document
async function uploadDocument(claimId: string, file: File): Promise<ClaimDocument> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_BASE_URL}/documents/upload/${claimId}`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: formData,
  });

  if (!response.ok) {
    throw new Error('Failed to upload document');
  }

  const doc = await response.json();
  return transformDocument(doc);
}

// Delete a document
async function deleteDocument(documentId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/documents/${documentId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to delete document');
  }
}

// Hook to fetch documents for a claim
export function useDocuments(claimId: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['documents', claimId, user?.tenantId],
    queryFn: () => user?.tenantId ? fetchDocumentsForClaim(claimId, user.tenantId) : [],
    enabled: !!claimId && !!user?.tenantId,
  });
}

// Hook to fetch a single document
export function useDocument(documentId: string) {
  return useQuery({
    queryKey: ['document', documentId],
    queryFn: () => fetchDocument(documentId),
    enabled: !!documentId,
  });
}

// Hook to upload a document
export function useUploadDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ claimId, file }: { claimId: string; file: File }) =>
      uploadDocument(claimId, file),
    onSuccess: (_, variables) => {
      // Invalidate documents query to refetch
      queryClient.invalidateQueries({ queryKey: ['documents', variables.claimId] });
    },
  });
}

// Hook to delete a document
export function useDeleteDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteDocument,
    onSuccess: () => {
      // Invalidate all document queries
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
  });
}

// Get the view URL for a document
export function getDocumentViewUrl(documentId: string): string {
  return `${API_BASE_URL}/documents/${documentId}/view`;
}

// Get the download URL for a document
export function getDocumentDownloadUrl(documentId: string): string {
  return `${API_BASE_URL}/documents/${documentId}/download`;
}

// Fetch the signed URL for a document (for direct image/pdf loading)
export async function fetchDocumentSignedUrl(documentId: string): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/documents/${documentId}/signed-url`, {
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error('Failed to get document URL');
  }
  const data = await response.json();
  return data.url;
}

// Hook to fetch signed URL for a document
export function useDocumentSignedUrl(documentId: string | null) {
  return useQuery({
    queryKey: ['documentSignedUrl', documentId],
    queryFn: () => fetchDocumentSignedUrl(documentId!),
    enabled: !!documentId,
    staleTime: 30 * 60 * 1000, // 30 minutes (less than the 60 min expiry)
  });
}
