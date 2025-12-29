import { useState, useMemo } from 'react';
import { Plus, Search, FolderKanban, Users, Calendar, TrendingUp, Download, Edit, Building } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useProjects, useProjectStats, useCreateProject, useUpdateProject, useAllProjectMembers } from '@/hooks/useProjects';
import { useEmployees, useAllocateEmployeeToProject } from '@/hooks/useEmployees';
import { useIBUs } from '@/hooks/useIBUs';
import { useAuth } from '@/contexts/AuthContext';
import { useFormatting } from '@/hooks/useFormatting';
import { ProjectForm } from '@/components/forms/ProjectForm';
import { CardSkeleton } from '@/components/ui/loading-skeleton';
import { exportToCSV, formatCurrency, formatDate } from '@/lib/export-utils';
import { ProjectFormData } from '@/lib/validations';
import { Project } from '@/types';
import { toast } from 'sonner';

const statusStyles = {
  active: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  completed: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  on_hold: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300',
};

function ProjectCard({ 
  project, 
  employees,
  ibuLookup,
  onEdit,
  formatProjectDate,
  formatProjectCurrency
}: { 
  project: Project; 
  employees?: { id: string; name: string }[]; 
  ibuLookup?: Record<string, { id: string; name: string; code: string }>;
  onEdit: (project: Project) => void;
  formatProjectDate: (date: Date | string) => string;
  formatProjectCurrency: (amount: number) => string;
}) {
  const budgetUsed = (project.spent / project.budget) * 100;
  const manager = employees?.find((e) => e.id === project.managerId);
  const ibu = project.ibuId && ibuLookup ? ibuLookup[project.ibuId] : null;
  const isOverBudget = budgetUsed > 100;

  return (
    <Card className="hover:shadow-md transition-shadow group relative">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <FolderKanban className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">{project.name}</CardTitle>
              <p className="text-sm text-muted-foreground font-mono">
                {project.code}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => onEdit(project)}
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Badge variant="secondary" className={statusStyles[project.status]}>
              {project.status.replace('_', ' ')}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground line-clamp-2">
          {project.description}
        </p>

        {/* Budget Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Budget Used</span>
            <span className={isOverBudget ? 'text-destructive font-medium' : ''}>
              {formatProjectCurrency(project.spent)} / {formatProjectCurrency(project.budget)}
            </span>
          </div>
          <Progress
            value={Math.min(budgetUsed, 100)}
            className={isOverBudget ? '[&>div]:bg-destructive' : ''}
          />
          <p className="text-xs text-muted-foreground text-right">
            {budgetUsed.toFixed(1)}% utilized
          </p>
        </div>

        {/* Project Info */}
        <div className="grid grid-cols-2 gap-4 pt-2 border-t">
          <div className="flex items-center gap-2 text-sm">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span>{project.memberIds.length} members</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span>{formatProjectDate(project.startDate)}</span>
          </div>
        </div>

        {/* Manager */}
        {manager && (
          <div className="flex items-center gap-2 pt-2 border-t">
            <span className="text-xs text-muted-foreground">Manager:</span>
            <span className="text-sm font-medium">{manager.name}</span>
          </div>
        )}

        {/* IBU */}
        {ibu && (
          <div className="flex items-center gap-2 pt-2 border-t">
            <Building className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">IBU:</span>
            <span className="text-sm font-medium">{ibu.code} - {ibu.name}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function Projects() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  const { user } = useAuth();
  const tenantId = user?.tenantId;
  
  const { formatDate: formatTenantDate, formatCurrency: formatTenantCurrency } = useFormatting();
  const { data: projects, isLoading, error } = useProjects(tenantId);
  const { data: stats } = useProjectStats(tenantId);
  const { data: employees } = useEmployees(tenantId);
  const { data: ibusData } = useIBUs();
  const ibus = ibusData?.items || [];
  const { data: projectMembersMap } = useAllProjectMembers();
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  const allocateEmployee = useAllocateEmployeeToProject();

  const managers = useMemo(() => {
    if (!employees) return [];
    // Show all employees in the Project Manager dropdown
    return employees.map((e) => ({ id: e.id, name: e.name }));
  }, [employees]);

  const employeeMap = useMemo(() => {
    if (!employees) return [];
    return employees.map((e) => ({ id: e.id, name: e.name }));
  }, [employees]);

  const ibuMap = useMemo(() => {
    return ibus.filter((ibu) => ibu.is_active).map((ibu) => ({ 
      id: ibu.id, 
      name: ibu.name, 
      code: ibu.code 
    }));
  }, [ibus]);

  const ibuLookup = useMemo(() => {
    return ibus.reduce((acc, ibu) => {
      acc[ibu.id] = ibu;
      return acc;
    }, {} as Record<string, typeof ibus[0]>);
  }, [ibus]);

  const filteredProjects = useMemo(() => {
    if (!projects) return [];
    
    // Enrich projects with member IDs from the allocations API
    const enrichedProjects = projects.map((project) => {
      const memberIds = projectMembersMap?.[project.id] || [];
      
      return {
        ...project,
        memberIds,
      };
    });
    
    return enrichedProjects.filter((project) => {
      const matchesSearch =
        project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        project.code.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus =
        statusFilter === 'all' || project.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [projects, projectMembersMap, searchQuery, statusFilter]);

  const handleAddProject = async (data: ProjectFormData) => {
    try {
      const newProject = await createProject.mutateAsync({
        name: data.name,
        code: data.code,
        description: data.description || '',
        budget: data.budget,
        spent: 0,
        managerId: data.managerId,
        memberIds: data.memberIds || [],
        ibuId: data.ibuId || undefined,
        status: 'active',
        startDate: data.startDate,
        endDate: data.endDate,
      });
      
      // Allocate team members to the project
      if (data.memberIds && data.memberIds.length > 0) {
        for (const memberId of data.memberIds) {
          try {
            await allocateEmployee.mutateAsync({
              employeeId: memberId,
              projectId: newProject.id,
              role: 'MEMBER',
            });
          } catch (e) {
            const errorMessage = e instanceof Error ? e.message : 'Failed to allocate employee';
            console.error(`Failed to allocate employee ${memberId}:`, e);
            toast.error(errorMessage);
          }
        }
      }
      
      toast.success('Project created successfully');
      setIsAddDialogOpen(false);
    } catch {
      toast.error('Failed to create project');
    }
  };

  const handleEditProject = async (data: ProjectFormData) => {
    if (!selectedProject) return;
    
    try {
      await updateProject.mutateAsync({
        id: selectedProject.id,
        data: {
          name: data.name,
          code: data.code,
          description: data.description || '',
          budget: data.budget,
          managerId: data.managerId,
          ibuId: data.ibuId || undefined,
          status: data.status || selectedProject.status,
          startDate: data.startDate,
          endDate: data.endDate,
        },
      });
      
      // Handle member allocation changes
      const currentMemberIds = selectedProject.memberIds || [];
      const newMemberIds = data.memberIds || [];
      
      // Allocate new members
      const membersToAdd = newMemberIds.filter(id => !currentMemberIds.includes(id));
      for (const memberId of membersToAdd) {
        try {
          await allocateEmployee.mutateAsync({
            employeeId: memberId,
            projectId: selectedProject.id,
            role: 'MEMBER',
          });
        } catch (e) {
          const errorMessage = e instanceof Error ? e.message : 'Failed to allocate employee';
          console.error(`Failed to allocate employee ${memberId}:`, e);
          toast.error(errorMessage);
        }
      }
      
      toast.success('Project updated successfully');
      setIsEditDialogOpen(false);
      setSelectedProject(null);
    } catch {
      toast.error('Failed to update project');
    }
  };

  const handleEditClick = (project: Project) => {
    setSelectedProject(project);
    setIsEditDialogOpen(true);
  };

  const handleExport = () => {
    if (!filteredProjects.length) {
      toast.error('No projects to export');
      return;
    }
    exportToCSV(
      filteredProjects.map((p) => {
        const ibu = p.ibuId && ibuLookup ? ibuLookup[p.ibuId] : null;
        return {
          code: p.code,
          name: p.name,
          status: p.status,
          budget: formatCurrency(p.budget),
          spent: formatCurrency(p.spent),
          startDate: formatDate(p.startDate),
          ibu: ibu ? `${ibu.code} - ${ibu.name}` : '',
          members: p.memberIds.length,
        };
      }),
      'projects',
      [
        { key: 'code', label: 'Project Code' },
        { key: 'name', label: 'Name' },
        { key: 'status', label: 'Status' },
        { key: 'budget', label: 'Budget' },
        { key: 'spent', label: 'Spent' },
        { key: 'startDate', label: 'Start Date' },
        { key: 'ibu', label: 'Business Unit' },
        { key: 'members', label: 'Members' },
      ]
    );
    toast.success('Projects exported successfully');
  };

  if (error) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-destructive">Failed to load projects</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Project Management</h1>
          <p className="text-muted-foreground">
            Manage projects and track budget utilization
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="mr-2 h-4 w-4" />
                New Project
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Create New Project</DialogTitle>
              </DialogHeader>
              <ProjectForm
                managers={managers}
                employees={employeeMap}
                ibus={ibuMap}
                onSubmit={handleAddProject}
                onCancel={() => setIsAddDialogOpen(false)}
                isLoading={createProject.isPending}
              />
            </DialogContent>
          </Dialog>
          <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Edit Project</DialogTitle>
              </DialogHeader>
              <ProjectForm
                managers={managers}
                employees={employeeMap}
                ibus={ibuMap}
                onSubmit={handleEditProject}
                onCancel={() => {
                  setIsEditDialogOpen(false);
                  setSelectedProject(null);
                }}
                isLoading={updateProject.isPending}
                defaultValues={selectedProject ? {
                  name: selectedProject.name,
                  code: selectedProject.code,
                  description: selectedProject.description,
                  budget: selectedProject.budget,
                  managerId: selectedProject.managerId,
                  memberIds: selectedProject.memberIds,
                  ibuId: selectedProject.ibuId,
                  startDate: selectedProject.startDate,
                  endDate: selectedProject.endDate,
                } : undefined}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <FolderKanban className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active Projects</p>
                <p className="text-2xl font-bold">{stats?.activeCount ?? '-'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900">
                <TrendingUp className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Budget</p>
                <p className="text-2xl font-bold">
                  {stats ? formatTenantCurrency(stats.totalBudget) : '-'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900">
                <TrendingUp className="h-6 w-6 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Spent</p>
                <p className="text-2xl font-bold">
                  {stats ? formatTenantCurrency(stats.totalSpent) : '-'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name or code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="on_hold">On Hold</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Project Grid */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredProjects.map((project) => (
              <ProjectCard 
                key={project.id} 
                project={project} 
                employees={employeeMap}
                ibuLookup={ibuLookup}
                onEdit={handleEditClick}
                formatProjectDate={formatTenantDate}
                formatProjectCurrency={formatTenantCurrency}
              />
            ))}
          </div>

          {filteredProjects.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center">
                <FolderKanban className="mx-auto h-12 w-12 text-muted-foreground/50" />
                <p className="mt-4 text-muted-foreground">No projects found</p>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
