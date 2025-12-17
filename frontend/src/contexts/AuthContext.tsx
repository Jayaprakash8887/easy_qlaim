import { createContext, useContext, useState, ReactNode, useCallback, useEffect } from 'react';
import { User, UserRole } from '@/types';

const API_BASE_URL = 'http://localhost:8000/api/v1';

// Map designation to role - fallback only if no roles from backend
function mapEmployeeRole(designation: string | null): UserRole {
  if (!designation) return 'employee';
  const lower = designation.toLowerCase();
  if (lower.includes('manager')) return 'manager';
  if (lower.includes('hr') || lower.includes('human resource')) return 'hr';
  if (lower.includes('finance') || lower.includes('accountant')) return 'finance';
  if (lower.includes('admin')) return 'admin';
  return 'employee';
}

// Map backend roles array to frontend UserRole
function mapBackendRolesToUserRole(roles: string[] | null): UserRole {
  if (!roles || roles.length === 0) return 'employee';

  // Priority order: SYSTEM_ADMIN > ADMIN > FINANCE > HR > MANAGER > EMPLOYEE
  if (roles.includes('SYSTEM_ADMIN')) return 'system_admin';
  if (roles.includes('ADMIN')) return 'admin';
  if (roles.includes('FINANCE')) return 'finance';
  if (roles.includes('HR')) return 'hr';
  if (roles.includes('MANAGER')) return 'manager';
  return 'employee';
}

// Map backend employee to User type
function mapBackendEmployeeToUser(backendEmployee: any): User {
  // Use roles from backend (dynamically resolved from designation-role mappings)
  // Fallback to designation-based role mapping if no roles
  const role = backendEmployee.roles && backendEmployee.roles.length > 0
    ? mapBackendRolesToUserRole(backendEmployee.roles)
    : mapEmployeeRole(backendEmployee.designation);

  return {
    id: backendEmployee.id,
    email: backendEmployee.email,
    name: `${backendEmployee.first_name} ${backendEmployee.last_name}`,
    role: role,
    department: backendEmployee.department,
    managerId: backendEmployee.manager_id || undefined,
    avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${backendEmployee.first_name} ${backendEmployee.last_name}`,
    // Extended employee fields
    employeeId: backendEmployee.employee_id,
    firstName: backendEmployee.first_name,
    lastName: backendEmployee.last_name,
    phone: backendEmployee.phone || '',
    mobile: backendEmployee.mobile || '',
    address: backendEmployee.address || '',
    designation: backendEmployee.designation || '',
    region: backendEmployee.region || '',
    joinDate: backendEmployee.date_of_joining || '',
    status: backendEmployee.employment_status === 'ACTIVE' ? 'active' :
      backendEmployee.employment_status === 'ON_LEAVE' ? 'on_leave' : 'inactive',
    projectIds: backendEmployee.employee_data?.project_ids || [],
  };
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  switchRole: (role: UserRole) => void;
  switchEmployee: (employeeId: string) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Default admin user for demo (will be replaced when employee is selected)
const mockUser: User = {
  id: 'admin',
  email: 'admin@company.com',
  name: 'Admin User',
  role: 'admin',
  department: 'Administration',
  avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Admin',
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(mockUser);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch employee details from API
  const fetchEmployeeById = useCallback(async (employeeId: string): Promise<User | null> => {
    try {
      const response = await fetch(`${API_BASE_URL}/employees/${employeeId}`);
      if (!response.ok) {
        console.error('Failed to fetch employee:', response.status);
        return null;
      }
      const data = await response.json();
      return mapBackendEmployeeToUser(data);
    } catch (error) {
      console.error('Error fetching employee:', error);
      return null;
    }
  }, []);

  const login = async (email: string, password: string) => {
    // Mock login - in production, this would call an API
    setUser(mockUser);
  };

  const logout = () => {
    setUser(null);
    // Clear any session storage
    sessionStorage.removeItem('currentEmployeeId');
  };

  const switchRole = (role: UserRole) => {
    if (user) {
      setUser({ ...user, role });
    }
  };

  // Switch to a different employee - fetches full details from API
  const switchEmployee = useCallback(async (employeeId: string) => {
    setIsLoading(true);
    try {
      const employeeUser = await fetchEmployeeById(employeeId);
      if (employeeUser) {
        setUser(employeeUser);
        // Store in session storage for persistence during page refresh
        sessionStorage.setItem('currentEmployeeId', employeeId);
      } else {
        console.error('Employee not found:', employeeId);
      }
    } catch (error) {
      console.error('Error switching employee:', error);
    } finally {
      setIsLoading(false);
    }
  }, [fetchEmployeeById]);

  // Refresh current user data from API
  const refreshUser = useCallback(async () => {
    if (user?.id) {
      const updatedUser = await fetchEmployeeById(user.id);
      if (updatedUser) {
        setUser(updatedUser);
      }
    }
  }, [user?.id, fetchEmployeeById]);

  // Restore session on mount - check if there's a saved employee ID
  useEffect(() => {
    const savedEmployeeId = sessionStorage.getItem('currentEmployeeId');
    if (savedEmployeeId) {
      fetchEmployeeById(savedEmployeeId).then((employeeUser) => {
        if (employeeUser) {
          setUser(employeeUser);
        }
      });
    }
  }, [fetchEmployeeById]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        switchRole,
        switchEmployee,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
