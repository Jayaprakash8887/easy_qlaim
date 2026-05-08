import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { UUID } from 'crypto';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

// Auth helpers
function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('access_token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

// Types
export interface Notification {
  id: string;
  tenant_id: string | null;
  user_id: string;
  type: 'claim_approved' | 'claim_rejected' | 'claim_returned' | 'pending_approval' | 'claim_submitted' | 'system' | 'tenant';
  title: string;
  message: string;
  priority: 'high' | 'medium' | 'low';
  related_entity_type: string | null;
  related_entity_id: string | null;
  action_url: string | null;
  is_read: boolean;
  read_at: string | null;
  is_cleared: boolean;
  created_at: string;
}

export interface NotificationSummary {
  total: number;
  unread: number;
  high_priority_unread: number;
}

export interface NotificationCreateRequest {
  user_id: string;
  tenant_id?: string;
  type: string;
  title: string;
  message: string;
  priority?: string;
  related_entity_type?: string;
  related_entity_id?: string;
  action_url?: string;
}

// API Functions
async function fetchNotifications(userId: string, tenantId?: string): Promise<Notification[]> {
  const params = new URLSearchParams({ user_id: userId });
  if (tenantId) params.append('tenant_id', tenantId);
  
  const response = await fetch(`${API_BASE_URL}/notifications/?${params}`, {
    headers: getAuthHeaders(),
  });
  if (!response.ok) throw new Error('Failed to fetch notifications');
  return response.json();
}

async function fetchNotificationSummary(userId: string, tenantId?: string): Promise<NotificationSummary> {
  const params = new URLSearchParams({ user_id: userId });
  if (tenantId) params.append('tenant_id', tenantId);
  
  const response = await fetch(`${API_BASE_URL}/notifications/summary?${params}`, {
    headers: getAuthHeaders(),
  });
  if (!response.ok) throw new Error('Failed to fetch notification summary');
  return response.json();
}

async function markNotificationRead(notificationId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/notifications/${notificationId}/read`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  if (!response.ok) throw new Error('Failed to mark notification as read');
}

async function markNotificationUnread(notificationId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/notifications/${notificationId}/unread`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  if (!response.ok) throw new Error('Failed to mark notification as unread');
}

async function markAllNotificationsRead(userId: string, tenantId?: string): Promise<{ updated_count: number }> {
  const params = new URLSearchParams({ user_id: userId });
  if (tenantId) params.append('tenant_id', tenantId);
  
  const response = await fetch(`${API_BASE_URL}/notifications/mark-all-read?${params}`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  if (!response.ok) throw new Error('Failed to mark all notifications as read');
  return response.json();
}

async function clearNotification(notificationId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/notifications/${notificationId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!response.ok) throw new Error('Failed to clear notification');
}

async function clearAllNotifications(userId: string, tenantId?: string, onlyRead: boolean = false): Promise<{ cleared_count: number }> {
  const params = new URLSearchParams({ user_id: userId });
  if (tenantId) params.append('tenant_id', tenantId);
  if (onlyRead) params.append('only_read', 'true');
  
  const response = await fetch(`${API_BASE_URL}/notifications/clear-all?${params}`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  if (!response.ok) throw new Error('Failed to clear all notifications');
  return response.json();
}

// Hooks
export function useNotifications(userId?: string, tenantId?: string) {
  return useQuery({
    queryKey: ['notifications', userId, tenantId],
    queryFn: () => fetchNotifications(userId!, tenantId),
    enabled: !!userId,
    refetchInterval: 180000, // Refetch every 3 minutes
    staleTime: 120000, // Consider data stale after 2 minutes
  });
}

export function useNotificationSummary(userId?: string, tenantId?: string) {
  return useQuery({
    queryKey: ['notifications-summary', userId, tenantId],
    queryFn: () => fetchNotificationSummary(userId!, tenantId),
    enabled: !!userId,
    refetchInterval: 120000, // Refetch every 2 minutes
    staleTime: 60000,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-summary'] });
    },
  });
}

export function useMarkNotificationUnread() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: markNotificationUnread,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-summary'] });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ userId, tenantId }: { userId: string; tenantId?: string }) =>
      markAllNotificationsRead(userId, tenantId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-summary'] });
    },
  });
}

export function useClearNotification() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: clearNotification,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-summary'] });
    },
  });
}

export function useClearAllNotifications() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ userId, tenantId, onlyRead }: { userId: string; tenantId?: string; onlyRead?: boolean }) =>
      clearAllNotifications(userId, tenantId, onlyRead),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-summary'] });
    },
  });
}
