import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  FileText,
  User,
  Users,
  Building2,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
  X,
  Briefcase,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { useFormatting } from '@/hooks/useFormatting';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

// Auth helper
function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('access_token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

interface SearchResult {
  id: string;
  type: 'claim' | 'employee' | 'project' | 'tenant';
  title: string;
  subtitle: string;
  status?: string;
  amount?: number;
  icon: 'claim' | 'employee' | 'project' | 'tenant';
}

interface GlobalSearchProps {
  className?: string;
}

// Role-specific placeholders
const placeholderByRole: Record<string, string> = {
  employee: 'Search your claims...',
  manager: 'Search claims, team members...',
  hr: 'Search claims, employees...',
  finance: 'Search claims, payments...',
  admin: 'Search claims, employees, projects...',
  system_admin: 'Search tenants...',
};

export function GlobalSearch({ className }: GlobalSearchProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const { formatCurrency } = useFormatting();

  const placeholder = placeholderByRole[user?.role || 'employee'] || 'Search...';

  // Debounced search
  const searchDebounceRef = useRef<NodeJS.Timeout>();

  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setResults([]);
      return;
    }

    setIsLoading(true);
    const searchResults: SearchResult[] = [];

    try {
      // Search claims - all roles can search claims
      const claimsParams = new URLSearchParams();
      if (user?.tenantId) {
        claimsParams.append('tenant_id', user.tenantId);
      }
      const claimsResponse = await fetch(
        `${API_BASE_URL}/claims/?${claimsParams.toString()}`,
        { headers: getAuthHeaders() }
      );
      if (claimsResponse.ok) {
        const claimsData = await claimsResponse.json();
        const claims = claimsData.claims || [];

        // Filter claims based on role
        let filteredClaims = claims;
        if (user?.role === 'employee') {
          // Employees can only search their own claims
          filteredClaims = claims.filter((c: any) => c.employee_id === user.id);
        }

        // Search in claims
        filteredClaims
          .filter((claim: any) => {
            const searchLower = searchQuery.toLowerCase();
            return (
              claim.claim_number?.toLowerCase().includes(searchLower) ||
              claim.employee_name?.toLowerCase().includes(searchLower) ||
              claim.category?.toLowerCase().includes(searchLower) ||
              claim.description?.toLowerCase().includes(searchLower)
            );
          })
          .slice(0, 5)
          .forEach((claim: any) => {
            searchResults.push({
              id: claim.id,
              type: 'claim',
              title: claim.claim_number,
              subtitle: `${claim.employee_name} • ${claim.category} • ${formatCurrency(claim.amount || 0)}`,
              status: claim.status,
              amount: claim.amount,
              icon: 'claim',
            });
          });
      }

      // Search employees - only for HR, Admin, Manager, Finance, System Admin
      if (['hr', 'admin', 'system_admin', 'manager', 'finance'].includes(user?.role || '')) {
        const empParams = new URLSearchParams();
        if (user?.tenantId) {
          empParams.append('tenant_id', user.tenantId);
        }
        empParams.append('search', searchQuery);

        const employeesResponse = await fetch(
          `${API_BASE_URL}/employees/?${empParams.toString()}`,
          { headers: getAuthHeaders() }
        );
        if (employeesResponse.ok) {
          const employees = await employeesResponse.json();
          (Array.isArray(employees) ? employees : employees.employees || [])
            .slice(0, 5)
            .forEach((emp: any) => {
              searchResults.push({
                id: emp.id,
                type: 'employee',
                title: emp.full_name || `${emp.first_name} ${emp.last_name}`,
                subtitle: `${emp.department || 'N/A'} • ${emp.designation || 'N/A'}`,
                icon: 'employee',
              });
            });
        }
      }

      // Search projects - only for Admin, System Admin, Finance
      if (['admin', 'system_admin', 'finance'].includes(user?.role || '')) {
        const projectParams = new URLSearchParams();
        if (user?.tenantId) {
          projectParams.append('tenant_id', user.tenantId);
        }
        projectParams.append('search', searchQuery);

        const projectsResponse = await fetch(
          `${API_BASE_URL}/projects/?${projectParams.toString()}`,
          { headers: getAuthHeaders() }
        );
        if (projectsResponse.ok) {
          const projects = await projectsResponse.json();
          (Array.isArray(projects) ? projects : projects.projects || [])
            .slice(0, 3)
            .forEach((proj: any) => {
              searchResults.push({
                id: proj.id,
                type: 'project',
                title: proj.project_name || proj.name,
                subtitle: `Code: ${proj.project_code || proj.code}`,
                icon: 'project',
              });
            });
        }
      }

      // Search tenants - only for System Admin
      if (user?.role === 'system_admin') {
        const tenantsResponse = await fetch(
          `${API_BASE_URL}/tenants/?search=${encodeURIComponent(searchQuery)}`,
          { headers: getAuthHeaders() }
        );
        if (tenantsResponse.ok) {
          const tenants = await tenantsResponse.json();
          (Array.isArray(tenants) ? tenants : [])
            .slice(0, 5)
            .forEach((tenant: any) => {
              searchResults.push({
                id: tenant.id,
                type: 'tenant',
                title: tenant.name,
                subtitle: `Code: ${tenant.code}${tenant.domain ? ` • ${tenant.domain}` : ''}`,
                status: tenant.is_active ? 'active' : 'inactive',
                icon: 'tenant',
              });
            });
        }
      }

      setResults(searchResults);
    } catch (error) {
      console.error('Search error:', error);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, [user, formatCurrency]);

  useEffect(() => {
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    if (query.trim()) {
      searchDebounceRef.current = setTimeout(() => {
        performSearch(query);
      }, 300);
    } else {
      setResults([]);
    }

    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    };
  }, [query, performSearch]);

  // Handle click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && results[selectedIndex]) {
          handleResultClick(results[selectedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setQuery('');
        inputRef.current?.blur();
        break;
    }
  };

  const handleResultClick = (result: SearchResult) => {
    setIsOpen(false);
    setQuery('');

    switch (result.type) {
      case 'claim':
        navigate(`/claims/${result.id}`);
        break;
      case 'employee':
        navigate(`/employees/${result.id}`);
        break;
      case 'project':
        navigate(`/projects/${result.id}`);
        break;
      case 'tenant':
        navigate(`/system-admin/tenants/${result.id}`);
        break;
    }
  };

  const getStatusColor = (status?: string) => {
    if (!status) return 'bg-gray-100 text-gray-700';
    const statusLower = status.toLowerCase();
    if (statusLower.includes('approved') || statusLower.includes('settled') || statusLower === 'active') {
      return 'bg-green-100 text-green-700';
    }
    if (statusLower.includes('pending')) {
      return 'bg-yellow-100 text-yellow-700';
    }
    if (statusLower.includes('rejected') || statusLower === 'inactive') {
      return 'bg-red-100 text-red-700';
    }
    return 'bg-gray-100 text-gray-700';
  };

  const getIcon = (iconType: string) => {
    switch (iconType) {
      case 'claim':
        return <FileText className="h-4 w-4" />;
      case 'employee':
        return <User className="h-4 w-4" />;
      case 'project':
        return <Building2 className="h-4 w-4" />;
      case 'tenant':
        return <Briefcase className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const formatStatus = (status?: string) => {
    if (!status) return '';
    return status.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  };

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
            setSelectedIndex(-1);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          className="pl-9 pr-9 bg-secondary/50"
        />
        {query && (
          <button
            onClick={() => {
              setQuery('');
              setResults([]);
              inputRef.current?.focus();
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Search Results Dropdown */}
      {isOpen && (query.length >= 2 || results.length > 0) && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-lg shadow-lg overflow-hidden z-50">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Searching...</span>
            </div>
          ) : results.length > 0 ? (
            <div className="max-h-96 overflow-y-auto">
              {/* Group results by type */}
              {['tenant', 'claim', 'employee', 'project'].map((type) => {
                const typeResults = results.filter((r) => r.type === type);
                if (typeResults.length === 0) return null;

                const typeLabels: Record<string, string> = {
                  tenant: 'Tenants',
                  claim: 'Claims',
                  employee: 'Employees',
                  project: 'Projects',
                };

                return (
                  <div key={type}>
                    <div className="px-3 py-2 bg-muted/50 text-xs font-medium text-muted-foreground uppercase">
                      {typeLabels[type] || type}
                    </div>
                    {typeResults.map((result, idx) => {
                      const globalIndex = results.indexOf(result);
                      return (
                        <button
                          key={result.id}
                          onClick={() => handleResultClick(result)}
                          className={cn(
                            'w-full px-3 py-3 flex items-center gap-3 hover:bg-accent text-left transition-colors',
                            selectedIndex === globalIndex && 'bg-accent'
                          )}
                        >
                          <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                            {getIcon(result.icon)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate">{result.title}</div>
                            <div className="text-xs text-muted-foreground truncate">
                              {result.subtitle}
                            </div>
                          </div>
                          {result.status && (
                            <Badge variant="secondary" className={cn('text-xs', getStatusColor(result.status))}>
                              {formatStatus(result.status)}
                            </Badge>
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          ) : query.length >= 2 ? (
            <div className="py-8 text-center">
              <Search className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">No results found for "{query}"</p>
              <p className="text-xs text-muted-foreground mt-1">
                Try searching with different keywords
              </p>
            </div>
          ) : null}

          {/* Search Tips */}
          {results.length > 0 && (
            <div className="px-3 py-2 bg-muted/30 border-t border-border text-xs text-muted-foreground">
              <span className="font-medium">Tip:</span> Use ↑↓ to navigate, Enter to select, Esc to close
            </div>
          )}
        </div>
      )}
    </div>
  );
}
