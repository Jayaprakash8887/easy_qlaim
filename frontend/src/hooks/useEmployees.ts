import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Employee } from '@/types';

const API_BASE_URL = 'http://localhost:8000/api/v1';

// Map backend employee to frontend Employee type
function mapBackendEmployee(backendEmployee: any): Employee {
  return {
    id: backendEmployee.id,
    employeeId: backendEmployee.employee_id,
    name: `${backendEmployee.first_name} ${backendEmployee.last_name}`,
    firstName: backendEmployee.first_name,
    lastName: backendEmployee.last_name,
    email: backendEmployee.email,
    phone: backendEmployee.phone || '',
    mobile: backendEmployee.mobile || '',
    address: backendEmployee.address || '',
    department: backendEmployee.department,
    designation: backendEmployee.designation || '',
    region: backendEmployee.region || '',
    role: mapRolesToFrontend(backendEmployee.roles),
    status: mapEmploymentStatus(backendEmployee.employment_status),
    joinDate: backendEmployee.date_of_joining || '',
    managerId: backendEmployee.manager_id || undefined,
    projectIds: backendEmployee.employee_data?.project_ids || [],
  };
}

// Map backend roles array to frontend role
function mapRolesToFrontend(roles: string[] | null): Employee['role'] {
  if (!roles || roles.length === 0) return 'employee';
  // Check roles in order of priority (admin > hr > finance > manager > employee)
  const rolesUpper = roles.map(r => r.toUpperCase());
  if (rolesUpper.includes('ADMIN')) return 'admin';
  if (rolesUpper.includes('HR')) return 'hr';
  if (rolesUpper.includes('FINANCE')) return 'finance';
  if (rolesUpper.includes('MANAGER')) return 'manager';
  return 'employee';
}

// Map frontend role to backend roles array
function mapFrontendRoleToBackend(role: string): string[] {
  const roleUpper = role.toUpperCase();
  // Always include EMPLOYEE as base role, plus the specific role
  if (roleUpper === 'EMPLOYEE') return ['EMPLOYEE'];
  return ['EMPLOYEE', roleUpper];
}

// Map employment status
function mapEmploymentStatus(status: string): Employee['status'] {
  switch (status) {
    case 'ACTIVE':
      return 'active';
    case 'INACTIVE':
      return 'inactive';
    case 'ON_LEAVE':
      return 'on_leave';
    default:
      return 'active';
  }
}

// API functions
async function fetchEmployees(): Promise<Employee[]> {
  const response = await fetch(`${API_BASE_URL}/employees/`);
  if (!response.ok) {
    throw new Error('Failed to fetch employees');
  }
  const data = await response.json();
  return data.map(mapBackendEmployee);
}

async function fetchEmployeeById(id: string): Promise<Employee | undefined> {
  const response = await fetch(`${API_BASE_URL}/employees/${id}`);
  if (!response.ok) {
    if (response.status === 404) return undefined;
    throw new Error('Failed to fetch employee');
  }
  const data = await response.json();
  return mapBackendEmployee(data);
}

async function createEmployee(employee: Partial<Employee>): Promise<Employee> {
  const backendEmployee = {
    employee_id: employee.employeeId,
    first_name: employee.firstName,
    last_name: employee.lastName,
    email: employee.email,
    phone: employee.phone,
    mobile: employee.mobile,
    address: employee.address,
    department: employee.department,
    designation: employee.designation,
    region: employee.region || null,
    date_of_joining: employee.joinDate,
    manager_id: employee.managerId || null,
    project_ids: employee.projectIds ? [employee.projectIds] : [],
  };

  const response = await fetch(`${API_BASE_URL}/employees/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(backendEmployee),
  });

  if (!response.ok) {
    throw new Error('Failed to create employee');
  }

  const data = await response.json();
  return mapBackendEmployee(data);
}

async function updateEmployee(id: string, employee: Partial<Employee>): Promise<Employee> {
  const backendEmployee = {
    employee_id: employee.employeeId,
    first_name: employee.firstName,
    last_name: employee.lastName,
    email: employee.email,
    phone: employee.phone,
    mobile: employee.mobile,
    address: employee.address,
    department: employee.department,
    designation: employee.designation,
    region: employee.region || null,
    date_of_joining: employee.joinDate,
    manager_id: employee.managerId || null,
    project_ids: employee.projectIds ? [employee.projectIds] : [],
    roles: employee.role ? mapFrontendRoleToBackend(employee.role) : undefined,
  };

  const response = await fetch(`${API_BASE_URL}/employees/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(backendEmployee),
  });

  if (!response.ok) {
    throw new Error('Failed to update employee');
  }

  const data = await response.json();
  return mapBackendEmployee(data);
}

// Custom hooks
export function useEmployees() {
  return useQuery({
    queryKey: ['employees'],
    queryFn: fetchEmployees,
    staleTime: 5 * 60 * 1000,
  });
}

export function useEmployee(id: string) {
  return useQuery({
    queryKey: ['employees', id],
    queryFn: () => fetchEmployeeById(id),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });
}

export function useEmployeesByDepartment(department: string | 'all') {
  const { data: employees, ...rest } = useEmployees();

  const filteredEmployees = department === 'all'
    ? employees
    : employees?.filter(emp => emp.department === department);

  return { data: filteredEmployees, ...rest };
}

export function useCreateEmployee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createEmployee,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
  });
}

export function useUpdateEmployee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Employee> }) => updateEmployee(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
  });
}

// Project History Types
export interface EmployeeProjectHistory {
  id: string;
  employee_id: string;
  project_id: string;
  project_code: string;
  project_name: string;
  project_status: string;
  role: string | null;
  allocation_percentage: number;
  status: 'ACTIVE' | 'COMPLETED' | 'REMOVED';
  allocated_date: string;
  deallocated_date: string | null;
}

// Fetch employee project history
async function fetchEmployeeProjectHistory(employeeId: string, includeInactive: boolean = true): Promise<EmployeeProjectHistory[]> {
  const response = await fetch(`${API_BASE_URL}/employees/${employeeId}/project-history?include_inactive=${includeInactive}`);
  if (!response.ok) {
    if (response.status === 404) return [];
    throw new Error('Failed to fetch employee project history');
  }
  return response.json();
}

// Hook to get employee project history (all projects - current and past)
export function useEmployeeProjectHistory(employeeId: string | undefined, includeInactive: boolean = true) {
  return useQuery({
    queryKey: ['employeeProjectHistory', employeeId, includeInactive],
    queryFn: () => fetchEmployeeProjectHistory(employeeId!, includeInactive),
    enabled: !!employeeId,
    staleTime: 5 * 60 * 1000,
  });
}

// Hook to get only current projects for an employee
export function useEmployeeCurrentProjects(employeeId: string | undefined) {
  return useEmployeeProjectHistory(employeeId, false);
}

// Allocate employee to project
interface AllocateEmployeeData {
  employeeId: string;
  projectId: string;
  role?: string;
  allocationPercentage?: number;
  allocatedDate?: string;
  notes?: string;
}

async function allocateEmployeeToProject(data: AllocateEmployeeData): Promise<EmployeeProjectHistory> {
  const response = await fetch(`${API_BASE_URL}/employees/${data.employeeId}/allocate-project`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      project_id: data.projectId,
      role: data.role || 'MEMBER',
      allocation_percentage: data.allocationPercentage || 100,
      allocated_date: data.allocatedDate || new Date().toISOString().split('T')[0],
      notes: data.notes,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to allocate employee to project');
  }

  return response.json();
}

export function useAllocateEmployeeToProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: allocateEmployeeToProject,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['employeeProjectHistory'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['projectMembers'] });
    },
  });
}
