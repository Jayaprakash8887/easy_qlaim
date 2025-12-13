import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { mockProjects, Project } from '@/data/mockEmployees';

// Simulated API delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Mock API functions
async function fetchProjects(): Promise<Project[]> {
  await delay(600);
  return mockProjects;
}

async function fetchProjectById(id: string): Promise<Project | undefined> {
  await delay(300);
  return mockProjects.find(project => project.id === id);
}

async function createProject(project: Omit<Project, 'id'>): Promise<Project> {
  await delay(500);
  const newProject: Project = {
    ...project,
    id: `prj-${Date.now()}`,
  };
  return newProject;
}

// Custom hooks
export function useProjects() {
  return useQuery({
    queryKey: ['projects'],
    queryFn: fetchProjects,
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

export function useActiveProjects() {
  const { data: projects, ...rest } = useProjects();
  
  const activeProjects = projects?.filter(project => project.status === 'active');
  
  return { data: activeProjects, ...rest };
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: createProject,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}

export function useProjectStats() {
  const { data: projects, ...rest } = useProjects();
  
  const stats = projects ? {
    totalBudget: projects.reduce((sum, p) => sum + p.budget, 0),
    totalSpent: projects.reduce((sum, p) => sum + p.spent, 0),
    activeCount: projects.filter(p => p.status === 'active').length,
    completedCount: projects.filter(p => p.status === 'completed').length,
    onHoldCount: projects.filter(p => p.status === 'on_hold').length,
  } : null;
  
  return { data: stats, ...rest };
}
