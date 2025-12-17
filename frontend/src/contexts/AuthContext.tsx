import { createContext, useContext, useState, ReactNode, useCallback, useEffect } from 'react';
import { User, UserRole } from '@/types';

const API_BASE_URL = 'http://localhost:8000/api/v1';

// Storage keys for authentication
const TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';
const USER_KEY = 'user';

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
  const role = backendEmployee.roles && backendEmployee.roles.length > 0
    ? mapBackendRolesToUserRole(backendEmployee.roles)
    : backendEmployee.role || 'employee';

  return {
    id: backendEmployee.id,
    tenantId: backendEmployee.tenant_id,
    email: backendEmployee.email,
    name: backendEmployee.full_name || `${backendEmployee.first_name} ${backendEmployee.last_name}`,
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
  logout: () => Promise<void>;
  switchRole: (role: UserRole) => void;
  switchEmployee: (employeeId: string) => Promise<void>;
  refreshUser: () => Promise<void>;
  getAccessToken: () => string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Helper to clear all auth storage
const clearAuthStorage = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  sessionStorage.removeItem('currentEmployeeId');
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize auth state from storage on mount
  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem(TOKEN_KEY);
      const storedUser = localStorage.getItem(USER_KEY);

      if (storedToken && storedUser) {
        try {
          // Verify token is still valid
          const response = await fetch(`${API_BASE_URL}/auth/verify`, {
            headers: {
              'Authorization': `Bearer ${storedToken}`,
            },
          });

          if (response.ok) {
            const userData = JSON.parse(storedUser);
            setUser(userData);
          } else {
            // Token invalid, try to refresh
            const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
            if (refreshToken) {
              try {
                const refreshResponse = await fetch(`${API_BASE_URL}/auth/refresh`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({ refresh_token: refreshToken }),
                });

                if (refreshResponse.ok) {
                  const tokens = await refreshResponse.json();
                  localStorage.setItem(TOKEN_KEY, tokens.access_token);
                  localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refresh_token);
                  const userData = JSON.parse(storedUser);
                  setUser(userData);
                } else {
                  clearAuthStorage();
                }
              } catch {
                clearAuthStorage();
              }
            } else {
              clearAuthStorage();
            }
          }
        } catch (error) {
          console.error('Auth initialization error:', error);
          clearAuthStorage();
        }
      }
      setIsLoading(false);
    };

    initAuth();
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Login failed');
      }

      const data = await response.json();

      // Store tokens
      localStorage.setItem(TOKEN_KEY, data.access_token);
      localStorage.setItem(REFRESH_TOKEN_KEY, data.refresh_token);

      // Map user data
      const userData = mapBackendEmployeeToUser(data.user);
      localStorage.setItem(USER_KEY, JSON.stringify(userData));
      setUser(userData);
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
      if (refreshToken) {
        await fetch(`${API_BASE_URL}/auth/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ refresh_token: refreshToken }),
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      clearAuthStorage();
      setUser(null);
    }
  };

  const switchRole = (role: UserRole) => {
    if (user) {
      const updatedUser = { ...user, role };
      setUser(updatedUser);
      localStorage.setItem(USER_KEY, JSON.stringify(updatedUser));
    }
  };

  // Fetch employee details from API
  const fetchEmployeeById = useCallback(async (employeeId: string): Promise<User | null> => {
    try {
      const token = localStorage.getItem(TOKEN_KEY);
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${API_BASE_URL}/employees/${employeeId}`, { headers });
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

  // Switch to a different employee - fetches full details from API
  const switchEmployee = useCallback(async (employeeId: string) => {
    setIsLoading(true);
    try {
      const employeeUser = await fetchEmployeeById(employeeId);
      if (employeeUser) {
        setUser(employeeUser);
        localStorage.setItem(USER_KEY, JSON.stringify(employeeUser));
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
        localStorage.setItem(USER_KEY, JSON.stringify(updatedUser));
      }
    }
  }, [user?.id, fetchEmployeeById]);

  const getAccessToken = useCallback(() => {
    return localStorage.getItem(TOKEN_KEY);
  }, []);

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
        getAccessToken,
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
