import { User, UserRole } from '@/types';

export interface Employee extends User {
  employeeId: string;
  phone?: string;
  joinDate: Date;
  status: 'active' | 'inactive' | 'on_leave';
  projectIds: string[];
}

export interface Project {
  id: string;
  code: string;
  name: string;
  description: string;
  budget: number;
  spent: number;
  startDate: Date;
  endDate?: Date;
  status: 'active' | 'completed' | 'on_hold';
  managerId: string;
  memberIds: string[];
}

export const mockEmployees: Employee[] = [
  {
    id: '1',
    employeeId: 'EMP001',
    email: 'john.doe@company.com',
    name: 'John Doe',
    role: 'employee',
    department: 'Engineering',
    phone: '+1 234 567 8900',
    joinDate: new Date('2022-01-15'),
    status: 'active',
    projectIds: ['P001', 'P002'],
  },
  {
    id: '2',
    employeeId: 'EMP002',
    email: 'jane.smith@company.com',
    name: 'Jane Smith',
    role: 'manager',
    department: 'Engineering',
    phone: '+1 234 567 8901',
    joinDate: new Date('2021-06-01'),
    status: 'active',
    projectIds: ['P001'],
  },
  {
    id: '3',
    employeeId: 'EMP003',
    email: 'bob.wilson@company.com',
    name: 'Bob Wilson',
    role: 'employee',
    department: 'Marketing',
    phone: '+1 234 567 8902',
    joinDate: new Date('2023-03-20'),
    status: 'active',
    projectIds: ['P003'],
  },
  {
    id: '4',
    employeeId: 'EMP004',
    email: 'alice.johnson@company.com',
    name: 'Alice Johnson',
    role: 'hr',
    department: 'Human Resources',
    phone: '+1 234 567 8903',
    joinDate: new Date('2020-09-10'),
    status: 'active',
    projectIds: [],
  },
  {
    id: '5',
    employeeId: 'EMP005',
    email: 'mike.brown@company.com',
    name: 'Mike Brown',
    role: 'finance',
    department: 'Finance',
    phone: '+1 234 567 8904',
    joinDate: new Date('2021-11-25'),
    status: 'on_leave',
    projectIds: [],
  },
];

export const mockProjects: Project[] = [
  {
    id: 'P001',
    code: 'PRJ-2024-001',
    name: 'Website Redesign',
    description: 'Complete overhaul of company website with modern design',
    budget: 50000,
    spent: 32500,
    startDate: new Date('2024-01-01'),
    endDate: new Date('2024-06-30'),
    status: 'active',
    managerId: '2',
    memberIds: ['1', '2'],
  },
  {
    id: 'P002',
    code: 'PRJ-2024-002',
    name: 'Mobile App Development',
    description: 'Native mobile application for iOS and Android',
    budget: 120000,
    spent: 45000,
    startDate: new Date('2024-02-15'),
    status: 'active',
    managerId: '2',
    memberIds: ['1'],
  },
  {
    id: 'P003',
    code: 'PRJ-2024-003',
    name: 'Marketing Campaign Q2',
    description: 'Digital marketing campaign for Q2 product launch',
    budget: 25000,
    spent: 25000,
    startDate: new Date('2024-04-01'),
    endDate: new Date('2024-06-30'),
    status: 'completed',
    managerId: '4',
    memberIds: ['3'],
  },
];
