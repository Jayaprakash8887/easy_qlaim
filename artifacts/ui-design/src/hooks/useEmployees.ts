import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { mockEmployees, Employee } from '@/data/mockEmployees';

// Simulated API delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Mock API functions
async function fetchEmployees(): Promise<Employee[]> {
  await delay(600);
  return mockEmployees;
}

async function fetchEmployeeById(id: string): Promise<Employee | undefined> {
  await delay(300);
  return mockEmployees.find(emp => emp.id === id);
}

async function createEmployee(employee: Omit<Employee, 'id'>): Promise<Employee> {
  await delay(500);
  const newEmployee: Employee = {
    ...employee,
    id: `emp-${Date.now()}`,
  };
  return newEmployee;
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
