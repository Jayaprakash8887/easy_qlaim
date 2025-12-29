import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Project } from '@/types';
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

// API functions
async function fetchProjects(tenantId?: string): Promise<Project[]> {
  const url = tenantId
    ? `${API_BASE_URL}/projects/?tenant_id=${tenantId}`
    : `${API_BASE_URL}/projects/`;
  const response = await fetch(url, {
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error('Failed to fetch projects');
  }
  const data = await response.json();

  // Transform backend response to frontend format
  return data.map((proj: any) => ({
    id: proj.id,
    code: proj.project_code,
    name: proj.project_name,
    description: proj.description || '',
    budget: parseFloat(proj.budget_allocated || 0),
    spent: parseFloat(proj.budget_spent || 0),
    startDate: proj.start_date ? new Date(proj.start_date) : new Date(),
    endDate: proj.end_date ? new Date(proj.end_date) : undefined,
    status: proj.status?.toLowerCase() === 'active' ? 'active' : proj.status?.toLowerCase() === 'completed' ? 'completed' : 'on_hold',
    managerId: proj.manager_id || '',
    memberIds: [],
    ibuId: proj.ibu_id || undefined,
  }));
}

async function fetchProjectById(id: string): Promise<Project | undefined> {
  const response = await fetch(`${API_BASE_URL}/projects/${id}`, {
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    if (response.status === 404) return undefined;
    throw new Error('Failed to fetch project');
  }
  const proj = await response.json();

  return {
    id: proj.id,
    code: proj.project_code,
    name: proj.project_name,
    description: proj.description || '',
    budget: parseFloat(proj.budget_allocated || 0),
    spent: parseFloat(proj.budget_spent || 0),
    startDate: proj.start_date ? new Date(proj.start_date) : new Date(),
    endDate: proj.end_date ? new Date(proj.end_date) : undefined,
    status: proj.status?.toLowerCase() === 'active' ? 'active' : proj.status?.toLowerCase() === 'completed' ? 'completed' : 'on_hold',
    managerId: proj.manager_id || '',
    memberIds: [],
    ibuId: proj.ibu_id || undefined,
  };
}

async function createProject(project: Omit<Project, 'id'>): Promise<Project> {
  const response = await fetch(`${API_BASE_URL}/projects/`, {
    method: 'POST',
    headers: getAuthHeadersWithJson(),
    body: JSON.stringify({
      project_code: project.code,
      project_name: project.name,
      description: project.description,
      budget_allocated: project.budget,
      start_date: project.startDate.toISOString().split('T')[0],
      end_date: project.endDate?.toISOString().split('T')[0],
      manager_id: project.managerId || null,
      ibu_id: project.ibuId || null,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(extractErrorMessage(error, 'Failed to create project'));
  }

  const data = await response.json();

  return {
    id: data.id,
    code: data.project_code,
    name: data.project_name,
    description: data.description || '',
    budget: parseFloat(data.budget_allocated || 0),
    spent: parseFloat(data.budget_spent || 0),
    startDate: data.start_date ? new Date(data.start_date) : new Date(),
    endDate: data.end_date ? new Date(data.end_date) : undefined,
    status: 'active',
    managerId: data.manager_id || '',
    memberIds: [],
    ibuId: data.ibu_id || undefined,
  };
}

// Custom hooks
export function useProjects(tenantIdOverride?: string) {
  const { user } = useAuth();
  const tenantId = tenantIdOverride || user?.tenantId;
  return useQuery({
    queryKey: ['projects', tenantId],
    queryFn: () => fetchProjects(tenantId),
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useProject(id: string) {
  return useQuery({
    queryKey: ['projects', id],
    queryFn: () => fetchProjectById(id),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });
}

export function useActiveProjects(tenantId?: string) {
  const { data: projects, ...rest } = useProjects(); // Changed to useProjects() without tenantId parameter

  const activeProjects = projects?.filter(project => project.status === 'active');

  return { data: activeProjects, ...rest };
}

export function useCreateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createProject,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['project-members-all'] });
    },
  });
}

async function updateProject(id: string, project: Partial<Project>): Promise<Project> {
  const response = await fetch(`${API_BASE_URL}/projects/${id}`, {
    method: 'PUT',
    headers: getAuthHeadersWithJson(),
    body: JSON.stringify({
      project_code: project.code,
      project_name: project.name,
      description: project.description,
      budget_allocated: project.budget,
      start_date: project.startDate ? new Date(project.startDate).toISOString().split('T')[0] : undefined,
      end_date: project.endDate ? new Date(project.endDate).toISOString().split('T')[0] : undefined,
      status: project.status?.toUpperCase(),
      manager_id: project.managerId,
      ibu_id: project.ibuId || null,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(extractErrorMessage(error, 'Failed to update project'));
  }

  const data = await response.json();

  return {
    id: data.id,
    code: data.project_code,
    name: data.project_name,
    description: data.description || '',
    budget: parseFloat(data.budget_allocated || 0),
    spent: parseFloat(data.budget_spent || 0),
    startDate: data.start_date ? new Date(data.start_date) : new Date(),
    endDate: data.end_date ? new Date(data.end_date) : undefined,
    status: data.status?.toLowerCase() === 'active' ? 'active' : data.status?.toLowerCase() === 'completed' ? 'completed' : 'on_hold',
    managerId: data.manager_id || '',
    memberIds: [],
    ibuId: data.ibu_id || undefined,
  };
}

export function useUpdateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Project> }) => updateProject(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['project-members-all'] });
    },
  });
}

export function useProjectStats(tenantId?: string) {
  const { data: projects, ...rest } = useProjects(); // Changed to useProjects() without tenantId parameter

  const stats = projects ? {
    totalBudget: projects.reduce((sum, p) => sum + p.budget, 0),
    totalSpent: projects.reduce((sum, p) => sum + p.spent, 0),
    activeCount: projects.filter(p => p.status === 'active').length,
    completedCount: projects.filter(p => p.status === 'completed').length,
    onHoldCount: projects.filter(p => p.status === 'on_hold').length,
  } : null;

  return { data: stats, ...rest };
}

// Define ProjectMember type if not already defined
type ProjectMember = any; // Replace 'any' with actual type if available

// Fetch all project members mapping
async function fetchAllProjectMembers(tenantId?: string): Promise<ProjectMember[]> {
  const url = tenantId
    ? `${API_BASE_URL}/projects/members/all?tenant_id=${tenantId}`
    : `${API_BASE_URL}/projects/members/all`;
  const response = await fetch(url, {
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error('Failed to fetch all project members');
  }
  return response.json();
}

export function useAllProjectMembers() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['project-members-all', user?.tenantId],
    queryFn: () => fetchAllProjectMembers(user?.tenantId),
    enabled: !!user?.tenantId,
    staleTime: 30 * 1000, // 30 seconds
  });
}
