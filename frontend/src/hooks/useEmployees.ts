import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Employee } from '@/data/mockEmployees';

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
    department: backendEmployee.department,
    designation: backendEmployee.designation || '',
    role: mapEmployeeRole(backendEmployee.designation),
    status: mapEmploymentStatus(backendEmployee.employment_status),
    joinDate: backendEmployee.date_of_joining || '',
    managerId: backendEmployee.manager_id || undefined,
    projectIds: [],
  };
}

// Map designation to role
function mapEmployeeRole(designation: string | null): Employee['role'] {
  if (!designation) return 'employee';
  const lower = designation.toLowerCase();
  if (lower.includes('manager')) return 'manager';
  if (lower.includes('hr') || lower.includes('human resource')) return 'hr';
  if (lower.includes('finance') || lower.includes('accountant')) return 'finance';
  if (lower.includes('admin')) return 'admin';
  return 'employee';
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
    department: employee.department,
    designation: employee.designation,
    date_of_joining: employee.joinDate,
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
