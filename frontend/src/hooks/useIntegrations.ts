import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

// Auth helper
function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('access_token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

// Helper function for API calls
async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
      ...options?.headers,
    },
    ...options,
  });
  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }
  // For DELETE requests that return no content
  if (response.status === 204 || options?.method === 'DELETE') {
    return null as T;
  }
  return response.json();
}

// Types
export interface ApiKey {
  id: string;
  name: string;
  description: string | null;
  key_prefix: string;
  permissions: string[];
  rate_limit: number;
  is_active: boolean;
  expires_at: string | null;
  last_used_at: string | null;
  usage_count: number;
  created_at: string;
}

export interface ApiKeyCreated extends ApiKey {
  api_key: string; // Full key - only on creation
}

export interface ApiKeyCreate {
  name: string;
  description?: string;
  permissions?: string[];
  rate_limit?: number;
  expires_at?: string;
}

export interface ApiKeyUpdate {
  name?: string;
  description?: string;
  permissions?: string[];
  rate_limit?: number;
  is_active?: boolean;
  expires_at?: string;
}

export interface Webhook {
  id: string;
  name: string;
  description: string | null;
  url: string;
  auth_type: string;
  events: string[];
  retry_count: number;
  retry_delay_seconds: number;
  is_active: boolean;
  last_triggered_at: string | null;
  last_success_at: string | null;
  last_failure_at: string | null;
  failure_count: number;
  success_count: number;
  created_at: string;
}

export interface WebhookCreated extends Webhook {
  secret: string; // Only on creation
}

export interface WebhookCreate {
  name: string;
  description?: string;
  url: string;
  auth_type?: string;
  auth_config?: Record<string, unknown>;
  events?: string[];
  retry_count?: number;
  retry_delay_seconds?: number;
}

export interface WebhookUpdate {
  name?: string;
  description?: string;
  url?: string;
  auth_type?: string;
  auth_config?: Record<string, unknown>;
  events?: string[];
  retry_count?: number;
  retry_delay_seconds?: number;
  is_active?: boolean;
}

export interface SSOConfig {
  id: string;
  provider: string;
  client_id: string | null;
  issuer_url: string | null;
  authorization_url: string | null;
  token_url: string | null;
  userinfo_url: string | null;
  jwks_url: string | null;
  saml_metadata_url: string | null;
  saml_entity_id: string | null;
  attribute_mapping: Record<string, string>;
  auto_provision_users: boolean;
  sync_user_attributes: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SSOConfigCreate {
  provider: string;
  client_id?: string;
  client_secret?: string;
  issuer_url?: string;
  authorization_url?: string;
  token_url?: string;
  userinfo_url?: string;
  jwks_url?: string;
  saml_metadata_url?: string;
  saml_entity_id?: string;
  saml_certificate?: string;
  attribute_mapping?: Record<string, string>;
  auto_provision_users?: boolean;
  sync_user_attributes?: boolean;
}

export interface SSOConfigUpdate extends Partial<SSOConfigCreate> {
  is_active?: boolean;
}

export interface HRMSConfig {
  id: string;
  provider: string;
  api_url: string | null;
  oauth_client_id: string | null;
  oauth_token_url: string | null;
  oauth_scope: string | null;
  sync_enabled: boolean;
  sync_frequency: string;
  last_sync_at: string | null;
  last_sync_status: string | null;
  last_sync_error: string | null;
  field_mapping: Record<string, string>;
  sync_employees: boolean;
  sync_departments: boolean;
  sync_managers: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface HRMSConfigCreate {
  provider: string;
  api_url?: string;
  api_key?: string;
  api_secret?: string;
  oauth_client_id?: string;
  oauth_client_secret?: string;
  oauth_token_url?: string;
  oauth_scope?: string;
  sync_enabled?: boolean;
  sync_frequency?: string;
  field_mapping?: Record<string, string>;
  sync_employees?: boolean;
  sync_departments?: boolean;
  sync_managers?: boolean;
}

export interface HRMSConfigUpdate extends Partial<HRMSConfigCreate> {
  is_active?: boolean;
}

export interface ERPConfig {
  id: string;
  provider: string;
  api_url: string | null;
  oauth_client_id: string | null;
  oauth_token_url: string | null;
  oauth_scope: string | null;
  company_code: string | null;
  cost_center: string | null;
  gl_account_mapping: Record<string, string>;
  export_enabled: boolean;
  export_frequency: string;
  export_format: string;
  auto_export_on_settlement: boolean;
  last_export_at: string | null;
  last_export_status: string | null;
  last_export_error: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ERPConfigCreate {
  provider: string;
  api_url?: string;
  api_key?: string;
  api_secret?: string;
  oauth_client_id?: string;
  oauth_client_secret?: string;
  oauth_token_url?: string;
  oauth_scope?: string;
  company_code?: string;
  cost_center?: string;
  gl_account_mapping?: Record<string, string>;
  export_enabled?: boolean;
  export_frequency?: string;
  export_format?: string;
  auto_export_on_settlement?: boolean;
}

export interface ERPConfigUpdate extends Partial<ERPConfigCreate> {
  is_active?: boolean;
}

export interface CommunicationConfig {
  id: string;
  provider: string;
  slack_workspace_id: string | null;
  slack_channel_id: string | null;
  teams_tenant_id: string | null;
  teams_webhook_url: string | null;
  teams_channel_id: string | null;
  notify_on_claim_submitted: boolean;
  notify_on_claim_approved: boolean;
  notify_on_claim_rejected: boolean;
  notify_on_claim_settled: boolean;
  notify_managers: boolean;
  notify_finance: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CommunicationConfigCreate {
  provider: string;
  slack_workspace_id?: string;
  slack_bot_token?: string;
  slack_channel_id?: string;
  teams_tenant_id?: string;
  teams_webhook_url?: string;
  teams_channel_id?: string;
  notify_on_claim_submitted?: boolean;
  notify_on_claim_approved?: boolean;
  notify_on_claim_rejected?: boolean;
  notify_on_claim_settled?: boolean;
  notify_managers?: boolean;
  notify_finance?: boolean;
}

export interface CommunicationConfigUpdate extends Partial<Omit<CommunicationConfigCreate, 'provider'>> {
  is_active?: boolean;
}

export interface IntegrationsOverview {
  api_keys: {
    active_count: number;
    configured: boolean;
  };
  webhooks: {
    active_count: number;
    configured: boolean;
  };
  sso: {
    configured: boolean;
    provider: string | null;
    is_active: boolean;
  };
  hrms: {
    configured: boolean;
    provider: string | null;
    is_active: boolean;
    last_sync: string | null;
  };
  erp: {
    configured: boolean;
    provider: string | null;
    is_active: boolean;
    last_export: string | null;
  };
  communication: {
    configured_providers: string[];
    active_count: number;
  };
}

// API Functions
const integrationsApi = {
  // Overview
  getOverview: async (tenantId: string): Promise<IntegrationsOverview> => {
    const response = await apiFetch(`/integrations/overview?tenant_id=${tenantId}`);
    return response;
  },

  // API Keys
  listApiKeys: async (tenantId: string): Promise<ApiKey[]> => {
    const response = await apiFetch(`/integrations/api-keys?tenant_id=${tenantId}`);
    return response;
  },
  createApiKey: async (tenantId: string, data: ApiKeyCreate): Promise<ApiKeyCreated> => {
    const response = await apiFetch(`/integrations/api-keys?tenant_id=${tenantId}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return response;
  },
  updateApiKey: async (tenantId: string, keyId: string, data: ApiKeyUpdate): Promise<ApiKey> => {
    const response = await apiFetch(`/integrations/api-keys/${keyId}?tenant_id=${tenantId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return response;
  },
  deleteApiKey: async (tenantId: string, keyId: string): Promise<void> => {
    await apiFetch(`/integrations/api-keys/${keyId}?tenant_id=${tenantId}`, { method: 'DELETE' });
  },
  regenerateApiKey: async (tenantId: string, keyId: string): Promise<ApiKeyCreated> => {
    const response = await apiFetch(`/integrations/api-keys/${keyId}/regenerate?tenant_id=${tenantId}`, {
      method: 'POST',
    });
    return response;
  },

  // Webhooks
  listWebhooks: async (tenantId: string): Promise<Webhook[]> => {
    const response = await apiFetch(`/integrations/webhooks?tenant_id=${tenantId}`);
    return response;
  },
  createWebhook: async (tenantId: string, data: WebhookCreate): Promise<WebhookCreated> => {
    const response = await apiFetch(`/integrations/webhooks?tenant_id=${tenantId}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return response;
  },
  updateWebhook: async (tenantId: string, webhookId: string, data: WebhookUpdate): Promise<Webhook> => {
    const response = await apiFetch(`/integrations/webhooks/${webhookId}?tenant_id=${tenantId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return response;
  },
  deleteWebhook: async (tenantId: string, webhookId: string): Promise<void> => {
    await apiFetch(`/integrations/webhooks/${webhookId}?tenant_id=${tenantId}`, { method: 'DELETE' });
  },
  testWebhook: async (tenantId: string, webhookId: string): Promise<{ success: boolean; status_code?: number; error?: string; duration_ms: number }> => {
    const response = await apiFetch(`/integrations/webhooks/${webhookId}/test?tenant_id=${tenantId}`, {
      method: 'POST',
    });
    return response;
  },

  // SSO
  getSSOConfig: async (tenantId: string): Promise<SSOConfig | null> => {
    const response = await apiFetch(`/integrations/sso?tenant_id=${tenantId}`);
    return response;
  },
  createSSOConfig: async (tenantId: string, data: SSOConfigCreate): Promise<SSOConfig> => {
    const response = await apiFetch(`/integrations/sso?tenant_id=${tenantId}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return response;
  },
  updateSSOConfig: async (tenantId: string, data: SSOConfigUpdate): Promise<SSOConfig> => {
    const response = await apiFetch(`/integrations/sso?tenant_id=${tenantId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return response;
  },
  deleteSSOConfig: async (tenantId: string): Promise<void> => {
    await apiFetch(`/integrations/sso?tenant_id=${tenantId}`, { method: 'DELETE' });
  },

  // HRMS
  getHRMSConfig: async (tenantId: string): Promise<HRMSConfig | null> => {
    const response = await apiFetch(`/integrations/hrms?tenant_id=${tenantId}`);
    return response;
  },
  createHRMSConfig: async (tenantId: string, data: HRMSConfigCreate): Promise<HRMSConfig> => {
    const response = await apiFetch(`/integrations/hrms?tenant_id=${tenantId}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return response;
  },
  updateHRMSConfig: async (tenantId: string, data: HRMSConfigUpdate): Promise<HRMSConfig> => {
    const response = await apiFetch(`/integrations/hrms?tenant_id=${tenantId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return response;
  },
  deleteHRMSConfig: async (tenantId: string): Promise<void> => {
    await apiFetch(`/integrations/hrms?tenant_id=${tenantId}`, { method: 'DELETE' });
  },
  triggerHRMSSync: async (tenantId: string): Promise<{ message: string; status: string }> => {
    const response = await apiFetch(`/integrations/hrms/sync?tenant_id=${tenantId}`, {
      method: 'POST',
    });
    return response;
  },

  // ERP
  getERPConfig: async (tenantId: string): Promise<ERPConfig | null> => {
    const response = await apiFetch(`/integrations/erp?tenant_id=${tenantId}`);
    return response;
  },
  createERPConfig: async (tenantId: string, data: ERPConfigCreate): Promise<ERPConfig> => {
    const response = await apiFetch(`/integrations/erp?tenant_id=${tenantId}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return response;
  },
  updateERPConfig: async (tenantId: string, data: ERPConfigUpdate): Promise<ERPConfig> => {
    const response = await apiFetch(`/integrations/erp?tenant_id=${tenantId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return response;
  },
  deleteERPConfig: async (tenantId: string): Promise<void> => {
    await apiFetch(`/integrations/erp?tenant_id=${tenantId}`, { method: 'DELETE' });
  },
  triggerERPExport: async (tenantId: string): Promise<{ message: string; status: string }> => {
    const response = await apiFetch(`/integrations/erp/export?tenant_id=${tenantId}`, {
      method: 'POST',
    });
    return response;
  },

  // Communication
  listCommunicationConfigs: async (tenantId: string): Promise<CommunicationConfig[]> => {
    const response = await apiFetch(`/integrations/communication?tenant_id=${tenantId}`);
    return response;
  },
  getCommunicationConfig: async (tenantId: string, provider: string): Promise<CommunicationConfig | null> => {
    const response = await apiFetch(`/integrations/communication/${provider}?tenant_id=${tenantId}`);
    return response;
  },
  createCommunicationConfig: async (tenantId: string, data: CommunicationConfigCreate): Promise<CommunicationConfig> => {
    const response = await apiFetch(`/integrations/communication?tenant_id=${tenantId}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return response;
  },
  updateCommunicationConfig: async (tenantId: string, provider: string, data: CommunicationConfigUpdate): Promise<CommunicationConfig> => {
    const response = await apiFetch(`/integrations/communication/${provider}?tenant_id=${tenantId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return response;
  },
  deleteCommunicationConfig: async (tenantId: string, provider: string): Promise<void> => {
    await apiFetch(`/integrations/communication/${provider}?tenant_id=${tenantId}`, { method: 'DELETE' });
  },
  testCommunication: async (tenantId: string, provider: string): Promise<{ success: boolean; message?: string; error?: string }> => {
    const response = await apiFetch(`/integrations/communication/${provider}/test?tenant_id=${tenantId}`, {
      method: 'POST',
    });
    return response;
  },
};

// Hooks

// Overview
export function useIntegrationsOverview(tenantId: string | undefined) {
  return useQuery({
    queryKey: ['integrations', 'overview', tenantId],
    queryFn: () => integrationsApi.getOverview(tenantId!),
    enabled: !!tenantId,
  });
}

// API Keys
export function useApiKeys(tenantId: string | undefined) {
  return useQuery({
    queryKey: ['integrations', 'api-keys', tenantId],
    queryFn: () => integrationsApi.listApiKeys(tenantId!),
    enabled: !!tenantId,
  });
}

export function useCreateApiKey(tenantId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ApiKeyCreate) => integrationsApi.createApiKey(tenantId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations', 'api-keys', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['integrations', 'overview', tenantId] });
    },
  });
}

export function useUpdateApiKey(tenantId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ keyId, data }: { keyId: string; data: ApiKeyUpdate }) =>
      integrationsApi.updateApiKey(tenantId!, keyId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations', 'api-keys', tenantId] });
    },
  });
}

export function useDeleteApiKey(tenantId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (keyId: string) => integrationsApi.deleteApiKey(tenantId!, keyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations', 'api-keys', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['integrations', 'overview', tenantId] });
    },
  });
}

export function useRegenerateApiKey(tenantId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (keyId: string) => integrationsApi.regenerateApiKey(tenantId!, keyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations', 'api-keys', tenantId] });
    },
  });
}

// Webhooks
export function useWebhooks(tenantId: string | undefined) {
  return useQuery({
    queryKey: ['integrations', 'webhooks', tenantId],
    queryFn: () => integrationsApi.listWebhooks(tenantId!),
    enabled: !!tenantId,
  });
}

export function useCreateWebhook(tenantId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: WebhookCreate) => integrationsApi.createWebhook(tenantId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations', 'webhooks', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['integrations', 'overview', tenantId] });
    },
  });
}

export function useUpdateWebhook(tenantId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ webhookId, data }: { webhookId: string; data: WebhookUpdate }) =>
      integrationsApi.updateWebhook(tenantId!, webhookId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations', 'webhooks', tenantId] });
    },
  });
}

export function useDeleteWebhook(tenantId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (webhookId: string) => integrationsApi.deleteWebhook(tenantId!, webhookId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations', 'webhooks', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['integrations', 'overview', tenantId] });
    },
  });
}

export function useTestWebhook(tenantId: string | undefined) {
  return useMutation({
    mutationFn: (webhookId: string) => integrationsApi.testWebhook(tenantId!, webhookId),
  });
}

// SSO
export function useSSOConfig(tenantId: string | undefined) {
  return useQuery({
    queryKey: ['integrations', 'sso', tenantId],
    queryFn: () => integrationsApi.getSSOConfig(tenantId!),
    enabled: !!tenantId,
  });
}

export function useCreateSSOConfig(tenantId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: SSOConfigCreate) => integrationsApi.createSSOConfig(tenantId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations', 'sso', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['integrations', 'overview', tenantId] });
    },
  });
}

export function useUpdateSSOConfig(tenantId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: SSOConfigUpdate) => integrationsApi.updateSSOConfig(tenantId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations', 'sso', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['integrations', 'overview', tenantId] });
    },
  });
}

export function useDeleteSSOConfig(tenantId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => integrationsApi.deleteSSOConfig(tenantId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations', 'sso', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['integrations', 'overview', tenantId] });
    },
  });
}

// HRMS
export function useHRMSConfig(tenantId: string | undefined) {
  return useQuery({
    queryKey: ['integrations', 'hrms', tenantId],
    queryFn: () => integrationsApi.getHRMSConfig(tenantId!),
    enabled: !!tenantId,
  });
}

export function useCreateHRMSConfig(tenantId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: HRMSConfigCreate) => integrationsApi.createHRMSConfig(tenantId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations', 'hrms', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['integrations', 'overview', tenantId] });
    },
  });
}

export function useUpdateHRMSConfig(tenantId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: HRMSConfigUpdate) => integrationsApi.updateHRMSConfig(tenantId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations', 'hrms', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['integrations', 'overview', tenantId] });
    },
  });
}

export function useDeleteHRMSConfig(tenantId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => integrationsApi.deleteHRMSConfig(tenantId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations', 'hrms', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['integrations', 'overview', tenantId] });
    },
  });
}

export function useTriggerHRMSSync(tenantId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => integrationsApi.triggerHRMSSync(tenantId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations', 'hrms', tenantId] });
    },
  });
}

// ERP
export function useERPConfig(tenantId: string | undefined) {
  return useQuery({
    queryKey: ['integrations', 'erp', tenantId],
    queryFn: () => integrationsApi.getERPConfig(tenantId!),
    enabled: !!tenantId,
  });
}

export function useCreateERPConfig(tenantId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ERPConfigCreate) => integrationsApi.createERPConfig(tenantId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations', 'erp', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['integrations', 'overview', tenantId] });
    },
  });
}

export function useUpdateERPConfig(tenantId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ERPConfigUpdate) => integrationsApi.updateERPConfig(tenantId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations', 'erp', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['integrations', 'overview', tenantId] });
    },
  });
}

export function useDeleteERPConfig(tenantId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => integrationsApi.deleteERPConfig(tenantId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations', 'erp', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['integrations', 'overview', tenantId] });
    },
  });
}

export function useTriggerERPExport(tenantId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => integrationsApi.triggerERPExport(tenantId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations', 'erp', tenantId] });
    },
  });
}

// Communication
export function useCommunicationConfigs(tenantId: string | undefined) {
  return useQuery({
    queryKey: ['integrations', 'communication', tenantId],
    queryFn: () => integrationsApi.listCommunicationConfigs(tenantId!),
    enabled: !!tenantId,
  });
}

export function useCreateCommunicationConfig(tenantId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CommunicationConfigCreate) => integrationsApi.createCommunicationConfig(tenantId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations', 'communication', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['integrations', 'overview', tenantId] });
    },
  });
}

export function useUpdateCommunicationConfig(tenantId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ provider, data }: { provider: string; data: CommunicationConfigUpdate }) =>
      integrationsApi.updateCommunicationConfig(tenantId!, provider, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations', 'communication', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['integrations', 'overview', tenantId] });
    },
  });
}

export function useDeleteCommunicationConfig(tenantId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (provider: string) => integrationsApi.deleteCommunicationConfig(tenantId!, provider),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations', 'communication', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['integrations', 'overview', tenantId] });
    },
  });
}

export function useTestCommunication(tenantId: string | undefined) {
  return useMutation({
    mutationFn: (provider: string) => integrationsApi.testCommunication(tenantId!, provider),
  });
}
